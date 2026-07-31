/**
 * 移动端连续语音记牌。
 * 浏览器每次只识别一句，组件在句末自动重启，从而兼顾移动端稳定性与连续操作。
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  getVoiceCommandKey,
  parseVoiceTranscript,
  type VoiceCommandAction,
  type VoiceCommandOutcome
} from '../utils/voiceCommand';

interface VoiceRecognitionCandidate {
  text: string;
  confidence: number;
  index: number;
}

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
}

const RESTART_DELAY_MS = 280;
const DUPLICATE_WINDOW_MS = 1400;
const AMBIGUOUS_CONFIDENCE_GAP = 0.12;

export const VoiceControl: React.FC<VoiceControlProps> = ({
  onVoiceCommand,
  className = '',
  disabled = false
}) => {
  const [sessionActive, setSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<VoiceRecognitionDisplay | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startRecognitionRef = useRef<() => void>(() => undefined);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRunningRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const disabledRef = useRef(disabled);
  const onVoiceCommandRef = useRef(onVoiceCommand);
  const lastCommandRef = useRef<{ key: string; timestamp: number } | null>(null);

  disabledRef.current = disabled;
  onVoiceCommandRef.current = onVoiceCommand;

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

      const resultList = event.results?.[event.resultIndex ?? 0] ?? event.results?.[0];
      const candidates: VoiceRecognitionCandidate[] = [];
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

      const parsedCandidates = candidates
        .map(candidate => ({
          ...candidate,
          parsed: parseVoiceTranscript(candidate.text)
        }))
        .filter(candidate => candidate.parsed.command);

      const primaryCandidate = parsedCandidates.find(candidate => candidate.index === 0);
      let chosenCandidate = primaryCandidate ?? parsedCandidates[0];

      if (chosenCandidate) {
        const chosenKey = getVoiceCommandKey(chosenCandidate.parsed.command!);
        const conflictingCandidate = parsedCandidates.find(candidate => {
          if (candidate === chosenCandidate) return false;
          const candidateKey = getVoiceCommandKey(candidate.parsed.command!);
          if (candidateKey === chosenKey) return false;

          const chosenConfidence = chosenCandidate?.confidence ?? 0;
          if (chosenConfidence === 0 || candidate.confidence === 0) return true;
          return chosenConfidence - candidate.confidence < AMBIGUOUS_CONFIDENCE_GAP;
        });

        if (conflictingCandidate) {
          const conflictingLabels = [
            chosenCandidate.parsed.normalizedText,
            conflictingCandidate.parsed.normalizedText
          ];
          setError(`识别结果有歧义：${conflictingLabels.join(' / ')}，本次未记录`);
          setNotice(null);
          chosenCandidate = undefined;
        }
      }

      if (!chosenCandidate) {
        if (parsedCandidates.length === 0) {
          const firstCandidate = candidates[0];
          const firstParsed = firstCandidate
            ? parseVoiceTranscript(firstCandidate.text)
            : undefined;
          setLastResult(firstCandidate ? {
            text: firstCandidate.text,
            normalizedText: firstParsed?.normalizedText ?? '',
            confidence: firstCandidate.confidence
          } : null);
          setError(firstParsed?.error ?? '没有听到有效口令，本次未记录');
          setNotice(null);
        }
        setIsProcessing(false);
        return;
      }

      const parsedCommand = chosenCandidate.parsed.command!;
      const now = Date.now();
      const commandKey = getVoiceCommandKey(parsedCommand);
      const lastCommand = lastCommandRef.current;
      const isDuplicate = Boolean(
        lastCommand &&
        lastCommand.key === commandKey &&
        now - lastCommand.timestamp < DUPLICATE_WINDOW_MS
      );

      setLastResult({
        text: chosenCandidate.text,
        normalizedText: chosenCandidate.parsed.normalizedText,
        confidence: chosenCandidate.confidence
      });

      if (isDuplicate) {
        setError(null);
        setNotice('检测到重复语音，已忽略');
        setIsProcessing(false);
        return;
      }

      const command: VoiceCommandAction = {
        ...parsedCommand,
        rawText: chosenCandidate.text,
        confidence: chosenCandidate.confidence,
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
        setNotice(outcome?.message ?? `已记录：${command.normalizedText}`);
        navigator.vibrate?.(45);
      }
      setIsProcessing(false);
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

  const startContinuousListening = () => {
    if (!recognitionRef.current || disabled) return;
    sessionActiveRef.current = true;
    setSessionActive(true);
    setError(null);
    setNotice('正在启动连续监听…');
    startRecognitionRef.current();
  };

  const stopContinuousListening = () => {
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

  if (!isSupported) {
    return (
      <div className={`rounded-xl bg-gray-100 p-4 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="mb-2 text-2xl">🎤</div>
          <p className="text-sm">当前浏览器不支持语音识别，请使用手机 Chrome 等支持语音识别的浏览器</p>
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
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
          sessionActive
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-gray-100 text-gray-500'
        }`}>
          {sessionActive ? '已开启' : '未开启'}
        </span>
      </div>

      <button
        type="button"
        onClick={sessionActive ? stopContinuousListening : startContinuousListening}
        disabled={disabled}
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
            : '点击一次，开始连续监听'}
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
          <p className="text-gray-500">只识别带玩家位置的短口令，避免牌桌聊天误录</p>
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
        <div>“上家七八九十勾” · “对家过”</div>
        <div>“下家四个八” · “我三个尖带一对五”</div>
        <div>说“撤销”可撤回最后一次出牌或过牌</div>
      </div>
    </div>
  );
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export default VoiceControl;
