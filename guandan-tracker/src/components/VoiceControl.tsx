/**
 * 移动端连续语音记牌。
 * 浏览器每次只识别一句，组件在句末自动重启，从而兼顾移动端稳定性与连续操作。
 */

import React, { useEffect, useRef, useState } from 'react';
import type { GameRank } from '../types/game';
import {
  getVoiceCommandKey,
  isIncompleteVoiceTranscript,
  parseVoiceTranscript,
  splitVoiceTranscript,
  type VoiceCommandAction,
  type VoiceCommandOutcome
} from '../utils/voiceCommand';
import { transcribeWithGroq } from '../utils/groqSpeech';
import { convertAudioToBaiduWav, transcribeWithBaidu } from '../utils/baiduSpeech';

interface VoiceRecognitionCandidate {
  text: string;
  confidence: number;
  index: number;
}

type ParsedVoiceCandidate = VoiceRecognitionCandidate & {
  parsed: ReturnType<typeof parseVoiceTranscript>;
};

interface VoiceRecognitionDisplay {
  text: string;
  normalizedText: string;
  confidence: number;
}

interface SpeechRecognitionAlternativeLike {
  transcript?: string;
  confidence?: number;
}

interface SpeechRecognitionResultLike {
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results?: {
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface VoiceControlProps {
  onVoiceCommand?: (
    command: VoiceCommandAction
  ) => VoiceCommandOutcome | void;
  className?: string;
  disabled?: boolean;
  /** 当前掼蛋级数，用于把“红心配/配牌”自动解释成红心级牌。 */
  currentRank?: GameRank;
}

const RESTART_DELAY_MS = 280;
const DUPLICATE_WINDOW_MS = 1400;
// 牌局播报常在“下家”和“四个六”之间有短暂停顿，过短会把玩家与牌面拆成两段。
const GROQ_SILENCE_MS = 1300;
const GROQ_MIN_SEGMENT_MS = 350;
const GROQ_MAX_SEGMENT_MS = 6500;
const GROQ_VAD_INTERVAL_MS = 100;
const GROQ_VAD_THRESHOLD = 0.018;

export const VoiceControl: React.FC<VoiceControlProps> = ({
  onVoiceCommand,
  className = '',
  disabled = false,
  currentRank
}) => {
  const [sessionActive, setSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<VoiceRecognitionDisplay | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  // 浏览器识别不消耗 API；Groq 和百度均通过 VPS 同源代理，密钥不会进入浏览器。
  const [provider, setProvider] = useState<'groq' | 'baidu' | 'browser'>('browser');

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startRecognitionRef = useRef<() => void>(() => undefined);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRunningRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const disabledRef = useRef(disabled);
  const onVoiceCommandRef = useRef(onVoiceCommand);
  const lastCommandRef = useRef<{ key: string; timestamp: number } | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const groqChunksRef = useRef<BlobPart[]>([]);
  const groqSegmentStartedAtRef = useRef(0);
  const groqLastVoiceAtRef = useRef(0);
  const groqHeardVoiceRef = useRef(false);
  const groqStoppingRef = useRef(false);
  const pendingTranscriptRef = useRef<{ text: string; timestamp: number } | null>(null);
  const currentRankRef = useRef<GameRank | undefined>(currentRank);

  disabledRef.current = disabled;
  currentRankRef.current = currentRank;
  onVoiceCommandRef.current = onVoiceCommand;

  // 浏览器识别和 API 识别共用同一条命令处理路径。
  // API 识别不能依赖 SpeechRecognition 对象，否则在不支持浏览器识别的手机上会被丢弃。
  const consumeVoiceCandidate = (candidate: ParsedVoiceCandidate) => {
    const parsedCommand = candidate.parsed.command;
    if (!parsedCommand) return;
    const now = Date.now();
    const commandKey = getVoiceCommandKey(parsedCommand);
    const lastCommand = lastCommandRef.current;
    const isDuplicate = Boolean(
      lastCommand &&
      lastCommand.key === commandKey &&
      now - lastCommand.timestamp < DUPLICATE_WINDOW_MS
    );

    setLastResult({
      text: candidate.text,
      normalizedText: candidate.parsed.normalizedText,
      confidence: candidate.confidence
    });

    if (isDuplicate) {
      setError(null);
      setNotice('检测到重复语音，已忽略');
      setIsProcessing(false);
      return;
    }

    const command: VoiceCommandAction = {
      ...parsedCommand,
      rawText: candidate.text,
      confidence: candidate.confidence,
      timestamp: now
    };
    let outcome: VoiceCommandOutcome | void;
    try {
      outcome = onVoiceCommandRef.current?.(command);
    } catch (commandError) {
      console.error('处理语音记牌命令失败:', commandError);
      setError('命令处理失败，本次未记录');
      setNotice(null);
      setIsProcessing(false);
      return;
    }

    if (outcome && !outcome.success) {
      setError(outcome.message);
      setNotice(null);
    } else {
      lastCommandRef.current = { key: commandKey, timestamp: now };
      setError(null);
      setNotice(outcome && 'message' in outcome && outcome.message
        ? outcome.message
        : `已记录：${command.normalizedText}`);
      navigator.vibrate?.(45);
    }
    setIsProcessing(false);
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.lang = 'zh-CN';

    const clearRestartTimer = () => {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
    };

    const scheduleRestart = (delay = RESTART_DELAY_MS) => {
      clearRestartTimer();
      if (!sessionActiveRef.current || disabledRef.current) return;
      restartTimerRef.current = setTimeout(() => {
        startRecognitionRef.current();
      }, delay);
    };

    const startRecognition = () => {
      if (
        !sessionActiveRef.current ||
        disabledRef.current ||
        recognitionRunningRef.current
      ) {
        return;
      }

      try {
        recognition.start();
      } catch (startError) {
        const errorName = startError instanceof DOMException ? startError.name : '';
        if (errorName === 'InvalidStateError') {
          scheduleRestart(450);
          return;
        }
        setError('启动语音识别失败，请重新开启连续监听');
        sessionActiveRef.current = false;
        setSessionActive(false);
      }
    };
    startRecognitionRef.current = startRecognition;

    recognition.onstart = () => {
      recognitionRunningRef.current = true;
      setIsListening(true);
      setIsProcessing(false);
      setError(null);
      setNotice('连续监听中，说完后会自动继续');
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      setIsListening(false);
      setIsProcessing(true);

      // 仅在一句话中出现多个明确玩家称呼时拆分批量口令。
      // “上对7对8对9”属于同一手三连对，不能按单字“对”切开。
      const firstResult = event.results?.[event.resultIndex ?? 0] ?? event.results?.[0];
      const firstTranscript = firstResult?.[0]?.transcript?.trim() ?? '';
      let effectiveFirstTranscript = firstTranscript;
      const pendingTranscript = pendingTranscriptRef.current;
      if (pendingTranscript) {
        const pendingExpired = Date.now() - pendingTranscript.timestamp > 2500;
        const directParsed = parseVoiceTranscript(
          firstTranscript,
          currentRankRef.current
        );
        const combinedTranscript = `${pendingTranscript.text}${firstTranscript}`;
        const combinedParsed = parseVoiceTranscript(
          combinedTranscript,
          currentRankRef.current
        );

        if (!pendingExpired && !directParsed.command && combinedParsed.command) {
          effectiveFirstTranscript = combinedTranscript;
          pendingTranscriptRef.current = null;
        } else if (pendingExpired || directParsed.command) {
          pendingTranscriptRef.current = null;
        }
      }

      const batchedTranscripts = splitVoiceTranscript(effectiveFirstTranscript);
      if (batchedTranscripts.length > 1) {
        batchedTranscripts.forEach(transcript => {
          recognition.onresult?.({
            resultIndex: 0,
            results: {
              0: {
                length: 1,
                0: { transcript, confidence: firstResult?.[0]?.confidence ?? 0 }
              }
            }
          });
        });
        return;
      }

      const resultList = event.results?.[event.resultIndex ?? 0] ?? event.results?.[0];
      const candidates: VoiceRecognitionCandidate[] = [];
      if (effectiveFirstTranscript !== firstTranscript) {
        candidates.push({
          text: effectiveFirstTranscript,
          confidence: Number(firstResult?.[0]?.confidence) || 0,
          index: 0
        });
      } else {
        for (let index = 0; index < (resultList?.length ?? 0); index += 1) {
          const result = resultList[index];
          const text = result?.transcript?.trim();
          if (text) {
            candidates.push({
              text,
              confidence: Number(result.confidence) || 0,
              index
            });
          }
        }
      }

      const parsedCandidates = candidates
        .map(candidate => ({
          ...candidate,
          parsed: parseVoiceTranscript(candidate.text, currentRankRef.current)
        }))
        .filter(candidate => candidate.parsed.command);

      const primaryCandidate = parsedCandidates.find(candidate => candidate.index === 0);
      // SpeechRecognition 已按可信度排列候选。只要第一候选可以解析就直接采用；
      // 第一候选无法解析时才回退到后备候选，避免正确口令被“近似候选”误判为歧义。
      const chosenCandidate = primaryCandidate ?? parsedCandidates[0];

      if (!chosenCandidate) {
        if (parsedCandidates.length === 0) {
          const firstCandidate = candidates[0];
          const firstParsed = firstCandidate
            ? parseVoiceTranscript(firstCandidate.text, currentRankRef.current)
            : undefined;
          setLastResult(firstCandidate ? {
            text: firstCandidate.text,
            normalizedText: firstParsed?.normalizedText ?? '',
            confidence: firstCandidate.confidence
          } : null);
          if (firstCandidate && isIncompleteVoiceTranscript(firstCandidate.text)) {
            pendingTranscriptRef.current = {
              text: firstCandidate.text,
              timestamp: Date.now()
            };
            setError(null);
            setNotice('已听到玩家和数量，请继续说牌面');
          } else {
            setError(firstParsed?.error ?? '没有听到有效口令，本次未记录');
            setNotice(null);
          }
        }
        setIsProcessing(false);
        return;
      }

      consumeVoiceCandidate(chosenCandidate);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      recognitionRunningRef.current = false;
      setIsListening(false);
      setIsProcessing(false);

      if (event.error === 'aborted') return;
      if (event.error === 'no-speech') {
        setError(null);
        setNotice('未听清，正在继续监听');
        return;
      }

      const errorMessages: Record<string, string> = {
        'audio-capture': '无法使用麦克风，请检查系统麦克风设置',
        'not-allowed': '没有麦克风权限，请在浏览器设置中允许访问',
        'service-not-allowed': '浏览器禁止使用语音识别服务',
        'network': '语音识别网络不可用，请检查网络后重试'
      };
      setError(errorMessages[event.error] ?? '语音识别失败，请重新开启');
      setNotice(null);

      if (['audio-capture', 'not-allowed', 'service-not-allowed', 'network'].includes(event.error)) {
        sessionActiveRef.current = false;
        setSessionActive(false);
      }
    };

    recognition.onend = () => {
      recognitionRunningRef.current = false;
      setIsListening(false);
      setIsProcessing(false);
      scheduleRestart();
    };

    recognitionRef.current = recognition;
    return () => {
      sessionActiveRef.current = false;
      clearRestartTimer();
      if (vadTimerRef.current) clearInterval(vadTimerRef.current);
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      void audioContextRef.current?.close();
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
      startRecognitionRef.current = () => undefined;
    };
  }, []);

  useEffect(() => {
    if (!disabled) return;
    sessionActiveRef.current = false;
    setSessionActive(false);
    setIsListening(false);
    recognitionRef.current?.abort();
  }, [disabled]);

  const submitApiTranscript = (text: string) => {
    const parsed = parseVoiceTranscript(text, currentRankRef.current);
    if (!parsed.command) {
      setLastResult({ text, normalizedText: parsed.normalizedText, confidence: 0 });
      setError(parsed.error ?? '没有听到有效口令，本次未记录');
      setNotice(null);
      setIsProcessing(false);
      return;
    }
    consumeVoiceCandidate({
      text,
      confidence: 0,
      index: 0,
      parsed
    });
  };

  const stopGroqListening = () => {
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    groqStoppingRef.current = true;
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setIsListening(false);
    setIsProcessing(false);
  };

  const startGroqSegment = () => {
    const stream = mediaStreamRef.current;
    if (!stream || !sessionActiveRef.current || disabledRef.current) return;
    // Chrome/Android 优先使用 WebM/Opus；Safari 不支持时再退回 MP4。
    // 通用 MediaRecorder 生成的 audio/mp4 不一定符合百度对 m4a(AAC-LC/brand) 的严格要求。
    const supportedMimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4'
    ];
    const mimeType = supportedMimeTypes.find(type =>
      typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(type)
    );
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (recorderError) {
      const name = recorderError instanceof DOMException ? recorderError.name : '';
      setError(name === 'NotSupportedError'
        ? '手机不支持当前录音格式，请使用最新版 Chrome 或 Safari'
        : '无法创建手机录音器，请检查浏览器麦克风权限');
      sessionActiveRef.current = false;
      setSessionActive(false);
      return;
    }
    groqChunksRef.current = [];
    groqSegmentStartedAtRef.current = Date.now();
    groqLastVoiceAtRef.current = Date.now();
    groqHeardVoiceRef.current = false;
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = event => {
      if (event.data.size > 0) groqChunksRef.current.push(event.data);
    };
    recorder.onstart = () => {
      setIsListening(true);
      setNotice(`${provider === 'baidu' ? '百度' : 'Groq'}连续监听中，请播报实际出牌`);
    };
    recorder.onstop = () => {
      const blob = new Blob(groqChunksRef.current, { type: mimeType });
      const shouldTranscribe = groqHeardVoiceRef.current && blob.size > 0;
      groqChunksRef.current = [];
      if (!shouldTranscribe) {
        if (sessionActiveRef.current && !disabledRef.current && !groqStoppingRef.current) {
          startGroqSegment();
        }
        return;
      }
      setIsListening(false);
      setIsProcessing(true);
      const transcribe = async () => {
        // 百度只接收严格规格的 PCM/WAV/AMR/M4A。无论浏览器录成 WebM 还是 MP4，
        // 都先统一转换成 16kHz、16bit、单声道 PCM WAV，避免把普通 MP4 冒充 M4A。
        const requestBlob = provider === 'baidu'
          ? await convertAudioToBaiduWav(blob)
          : blob;
        return provider === 'baidu'
          ? transcribeWithBaidu(requestBlob)
          : transcribeWithGroq(requestBlob);
      };
      void transcribe()
        .then(result => {
          if (result.text) submitApiTranscript(result.text);
          else setIsProcessing(false);
        })
        .catch(error => {
          setError(error instanceof Error
            ? error.message
            : `${provider === 'baidu' ? '百度' : 'Groq'}语音识别失败`);
          setNotice(null);
          setIsProcessing(false);
        })
        .finally(() => {
          if (sessionActiveRef.current && !disabledRef.current && !groqStoppingRef.current) {
            setTimeout(startGroqSegment, 60);
          }
        });
    };
    recorder.start();
  };

  const startGroqListening = async () => {
    if (disabled || sessionActiveRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('当前浏览器不支持录音上传，请切换手机 Chrome');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) throw new Error('当前浏览器不支持音频检测');
      const audioContext = new AudioContextConstructor();
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      audioContextRef.current = audioContext;
      sessionActiveRef.current = true;
      groqStoppingRef.current = false;
      setSessionActive(true);
      setError(null);
      setNotice(`正在启动${provider === 'baidu' ? '百度' : 'Groq'}连续监听…`);
      startGroqSegment();
      vadTimerRef.current = setInterval(() => {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state !== 'recording') return;
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += sample * sample;
        const rms = Math.sqrt(sum / samples.length);
        const now = Date.now();
        if (rms >= GROQ_VAD_THRESHOLD) {
          groqHeardVoiceRef.current = true;
          groqLastVoiceAtRef.current = now;
        }
        const elapsed = now - groqSegmentStartedAtRef.current;
        const silence = now - groqLastVoiceAtRef.current;
        if (
          groqHeardVoiceRef.current &&
          elapsed >= GROQ_MIN_SEGMENT_MS &&
          (silence >= GROQ_SILENCE_MS || elapsed >= GROQ_MAX_SEGMENT_MS)
        ) {
          recorder.stop();
        }
      }, GROQ_VAD_INTERVAL_MS);
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : '';
      const errorMessage = error instanceof Error ? error.message : '';
      setError(errorName === 'NotAllowedError'
        ? '没有麦克风权限，请在浏览器设置中允许访问'
        : errorName === 'NotFoundError'
          ? '手机没有可用麦克风，请检查系统输入设备'
          : errorName === 'NotSupportedError'
            ? '当前手机不支持录音格式，请使用最新版 Chrome 或 Safari'
            : `无法启动${provider === 'baidu' ? '百度' : 'Groq'}录音${errorMessage ? `：${errorMessage}` : ''}`);
      stopGroqListening();
    }
  };

  const startContinuousListening = () => {
    if (provider !== 'browser') {
      void startGroqListening();
      return;
    }
    if (!recognitionRef.current || disabled) return;
    sessionActiveRef.current = true;
    setSessionActive(true);
    setError(null);
    setNotice('正在启动连续监听…');
    startRecognitionRef.current();
  };

  const stopContinuousListening = () => {
    if (provider !== 'browser') {
      sessionActiveRef.current = false;
      setSessionActive(false);
      stopGroqListening();
      setNotice(`${provider === 'baidu' ? '百度' : 'Groq'}连续监听已停止`);
      return;
    }
    sessionActiveRef.current = false;
    setSessionActive(false);
    setIsListening(false);
    setIsProcessing(false);
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRunningRef.current) {
      recognitionRef.current?.stop();
    }
    setNotice('连续监听已停止');
  };

  const providerLabel = provider === 'baidu'
    ? '百度 API'
    : provider === 'groq'
      ? 'Groq API'
      : '浏览器识别';

  if (!isSupported && provider === 'browser') {
    return (
      <div className={`rounded-xl bg-gray-100 p-4 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="mb-2 text-2xl">🎤</div>
          <p className="text-sm">当前浏览器不支持浏览器识别；点击右上角切换到百度 API 或 Groq API</p>
          <button
            type="button"
            className="mt-3 rounded-full bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
            onClick={() => setProvider('baidu')}
          >
            使用百度 API
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl bg-white p-3 shadow-md sm:p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center font-semibold text-gray-800">
          <span className="mr-2 text-xl">🎤</span>
          连续语音记牌
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
            onClick={() => {
              if (sessionActive) return;
              setProvider(current => current === 'browser'
                ? 'groq'
                : current === 'groq'
                  ? 'baidu'
                  : 'browser');
            }}
          >
            {providerLabel}
          </button>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${
            sessionActive
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {sessionActive ? '已开启' : '未开启'}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={sessionActive ? stopContinuousListening : startContinuousListening}
        disabled={disabled || (provider === 'browser' && !isSupported)}
        aria-pressed={sessionActive}
        className={`flex min-h-14 w-full items-center justify-center rounded-xl px-4 text-base font-bold text-white shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
          sessionActive
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        <span className="mr-2 text-xl">
          {isProcessing ? '⏳' : isListening ? '🔴' : sessionActive ? '⏹️' : '🎤'}
        </span>
        {disabled
          ? '开始游戏后可用'
          : sessionActive
            ? '停止连续监听'
          : `点击一次，开始${providerLabel}连续监听`}
      </button>

      <div className="mt-3 min-h-6 text-center text-sm">
        {isListening && (
          <p className="animate-pulse font-medium text-blue-600">正在听，请说“上家……”</p>
        )}
        {isProcessing && (
          <p className="font-medium text-amber-600">正在核对牌面…</p>
        )}
        {!isListening && !isProcessing && notice && (
          <p className={sessionActive ? 'text-emerald-700' : 'text-gray-500'}>{notice}</p>
        )}
        {!isListening && !isProcessing && disabled && (
          <p className="text-gray-500">完成手牌录入并开始游戏后，即可开启连续监听</p>
        )}
        {!isListening && !isProcessing && !disabled && !notice && !error && (
          <p className="text-gray-500">只播报实际出牌；跳过的玩家会自动记为过牌</p>
        )}
      </div>

      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {lastResult && (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div className="font-medium text-emerald-800">
            {lastResult.text} → {lastResult.normalizedText || '未解析'}
          </div>
          <div className="mt-1 text-xs text-emerald-600">
            {lastResult.confidence > 0
              ? `语音置信度 ${Math.round(lastResult.confidence * 100)}%`
              : '浏览器未提供置信度，已按牌型规则校验'}
          </div>
        </div>
      )}

      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <div className="mb-1 font-medium text-slate-700">短口令示例</div>
        <div>“上家七八九十勾” · “对家两个八”</div>
        <div>“下家四个八” · “我三个尖带一对五”</div>
        <div>无需说谁过牌；直接播报下一位实际出牌者</div>
        <div>说“撤销”可撤回最后一次记录</div>
      </div>
    </div>
  );
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    webkitAudioContext?: typeof AudioContext;
  }
}

export default VoiceControl;
