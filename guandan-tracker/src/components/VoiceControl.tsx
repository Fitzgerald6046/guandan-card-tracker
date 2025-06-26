/**
 * 语音控制组件
 * 集成AI增强语音识别功能
 */

import React, { useState, useEffect, useRef } from 'react';
import { usePlayHistory } from '../hooks/usePlayHistory';

// 语音识别相关类型定义
interface VoiceRecognitionResult {
  text: string;
  confidence: number;
  alternatives?: string[];
}

interface HybridResult extends VoiceRecognitionResult {
  localCorrected?: boolean;
  aiCorrected?: boolean;
  originalText?: string;
  correctionMethod?: string;
  appliedRules?: string[];
}

interface VoiceConfig {
  synonymMap: Record<string, string[]>;
  cardMap: Record<string, string>;
  playerMap: Record<string, string>;
}

interface VoiceControlProps {
  onVoiceCommand?: (command: any) => void;
  className?: string;
  disabled?: boolean;
}

// 本地AI纠错规则
const correctionRules = [
  { pattern: /勾/g, replacement: 'J', description: '修正J的同音字' },
  { pattern: /圈/g, replacement: 'Q', description: '修正Q的同音字' },
  { pattern: /尖/g, replacement: 'A', description: '修正A的同音字' },
  { pattern: /俺|咱/g, replacement: '我', description: '修正玩家标识' },
  { pattern: /上家|上手/g, replacement: '上', description: '修正上家标识' },
  { pattern: /下家|下手/g, replacement: '下', description: '修正下家标识' },
  { pattern: /对家|对门/g, replacement: '对', description: '修正对家标识' },
  { pattern: /单张|一张/g, replacement: '单', description: '修正单张指令' },
  { pattern: /对子|一对/g, replacement: '对', description: '修正对子指令' },
  { pattern: /三张|三个/g, replacement: '三', description: '修正三张指令' },
  { pattern: /炸弹/g, replacement: '炸', description: '修正炸弹指令' },
  { pattern: /不要|要不起|过牌/g, replacement: '过', description: '修正过牌指令' },
  { pattern: /([我上下对])\1+/g, replacement: '$1', description: '修正重复玩家标识' },
  { pattern: /([单对三炸过])\1+/g, replacement: '$1', description: '修正重复动作词' },
  { pattern: /(\d)\1+/g, replacement: '$1', description: '修正重复数字' },
  { pattern: /[，。！？、]/g, replacement: '', description: '去除标点符号' },
  { pattern: /\s+/g, replacement: '', description: '去除多余空格' }
];

export const VoiceControl: React.FC<VoiceControlProps> = ({
  onVoiceCommand,
  className = '',
  disabled = false
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<HybridResult | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const { recordPlay } = usePlayHistory();

  // 检查浏览器支持
  useEffect(() => {
    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setIsSupported(supported);
    
    if (supported) {
      initializeSpeechRecognition();
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // 初始化语音识别
  const initializeSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.lang = 'zh-CN';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      setIsListening(false);
      setIsProcessing(true);
      
      const results: string[] = [];
      const confidence = event.results[0]?.[0]?.confidence || 0;
      
      for (let i = 0; i < (event.results[0]?.length || 0); i++) {
        const transcript = event.results[0][i]?.transcript;
        if (transcript) {
          results.push(transcript.trim());
        }
      }

      const originalResult: VoiceRecognitionResult = {
        text: results[0] || '',
        confidence: confidence,
        alternatives: results.slice(1)
      };

      // 应用本地AI纠错
      const enhancedResult = applyLocalCorrection(originalResult);
      setLastResult(enhancedResult);
      
      // 解析并处理命令
      const command = parseVoiceCommand(enhancedResult.text);
      if (command) {
        handleVoiceCommand(command);
      }
      
      setIsProcessing(false);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      setIsProcessing(false);
      
      let errorMessage = '语音识别失败';
      switch (event.error) {
        case 'no-speech':
          errorMessage = '未检测到语音输入';
          break;
        case 'audio-capture':
          errorMessage = '音频捕获失败，请检查麦克风';
          break;
        case 'not-allowed':
          errorMessage = '没有麦克风权限，请允许访问麦克风';
          break;
        case 'network':
          errorMessage = '网络错误，请检查网络连接';
          break;
      }
      setError(errorMessage);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (isProcessing) {
        setIsProcessing(false);
      }
    };

    recognitionRef.current = recognition;
  };

  // 应用本地纠错
  const applyLocalCorrection = (result: VoiceRecognitionResult): HybridResult => {
    let correctedText = result.text;
    const appliedRules: string[] = [];
    let changesMade = false;

    for (const rule of correctionRules) {
      const originalText = correctedText;
      correctedText = correctedText.replace(rule.pattern, rule.replacement);
      
      if (correctedText !== originalText) {
        appliedRules.push(rule.description);
        changesMade = true;
      }
    }

    // 计算纠错后的置信度
    let confidence = result.confidence;
    if (changesMade) {
      confidence = Math.min(0.95, confidence + 0.1 * Math.min(appliedRules.length, 3));
    }

    return {
      ...result,
      text: correctedText,
      localCorrected: changesMade,
      originalText: result.text,
      correctionMethod: changesMade ? 'local' : 'original',
      appliedRules,
      confidence
    };
  };

  // 解析语音命令
  const parseVoiceCommand = (text: string) => {
    const patterns = [
      {
        pattern: /^([我上下对])单([2-9AJQK]|10|小王|大王)$/,
        type: 'single',
        parse: (match: RegExpMatchArray) => ({
          player: match[1],
          action: 'play',
          cardType: 'single',
          card: match[2]
        })
      },
      {
        pattern: /^([我上下对])对([2-9AJQK]|10)$/,
        type: 'pair',
        parse: (match: RegExpMatchArray) => ({
          player: match[1],
          action: 'play',
          cardType: 'pair',
          card: match[2]
        })
      },
      {
        pattern: /^([我上下对])三([2-9AJQK]|10)$/,
        type: 'triple',
        parse: (match: RegExpMatchArray) => ({
          player: match[1],
          action: 'play',
          cardType: 'triple',
          card: match[2]
        })
      },
      {
        pattern: /^([我上下对])三([2-9AJQK]|10)带([2-9AJQK]|10)$/,
        type: 'triple_with_pair',
        parse: (match: RegExpMatchArray) => ({
          player: match[1],
          action: 'play',
          cardType: 'triple_with_pair',
          mainCard: match[2],
          attachCard: match[3]
        })
      },
      {
        pattern: /^([我上下对])炸([2-9AJQK]|10)$/,
        type: 'bomb',
        parse: (match: RegExpMatchArray) => ({
          player: match[1],
          action: 'play',
          cardType: 'bomb',
          card: match[2]
        })
      },
      {
        pattern: /^([我上下对])王炸$/,
        type: 'joker_bomb',
        parse: (match: RegExpMatchArray) => ({
          player: match[1],
          action: 'play',
          cardType: 'joker_bomb'
        })
      },
      {
        pattern: /^([我上下对])过$/,
        type: 'pass',
        parse: (match: RegExpMatchArray) => ({
          player: match[1],
          action: 'pass'
        })
      }
    ];

    for (const { pattern, parse } of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parse(match);
      }
    }

    return null;
  };

  // 处理语音命令
  const handleVoiceCommand = (command: any) => {
    try {
      if (command.action === 'play') {
        // 转换为游戏记录格式
        const playAction = {
          playerPosition: mapPlayerPosition(command.player),
          cardType: command.cardType,
          cards: command.card ? [command.card] : [],
          mainCard: command.mainCard,
          attachCard: command.attachCard,
          timestamp: Date.now()
        };
        
        recordPlay(playAction);
        onVoiceCommand?.(playAction);
      } else if (command.action === 'pass') {
        // 记录过牌
        const passAction = {
          playerPosition: mapPlayerPosition(command.player),
          action: 'pass',
          timestamp: Date.now()
        };
        
        onVoiceCommand?.(passAction);
      }
    } catch (error) {
      console.error('处理语音命令失败:', error);
      setError('命令处理失败');
    }
  };

  // 映射玩家位置
  const mapPlayerPosition = (player: string) => {
    const mapping: Record<string, string> = {
      '我': 'bottom',
      '上': 'top',
      '下': 'left',
      '对': 'right'
    };
    return mapping[player] || 'bottom';
  };

  // 开始录音
  const startListening = () => {
    if (!recognitionRef.current || disabled) return;
    
    try {
      recognitionRef.current.start();
    } catch (error) {
      setError('启动语音识别失败');
    }
  };

  // 停止录音
  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  // 清除错误
  const clearError = () => {
    setError(null);
  };

  if (!isSupported) {
    return (
      <div className={`p-4 bg-gray-100 rounded-lg ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-2xl mb-2">🎤</div>
          <p className="text-sm">浏览器不支持语音识别</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-white rounded-lg shadow-md ${className}`}>
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 flex items-center">
          <span className="text-xl mr-2">🎤</span>
          语音控制
        </h3>
        <div className="text-xs text-gray-500">
          AI增强识别
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex justify-center mb-4">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={disabled || isProcessing}
          className={`
            w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl
            transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed
            ${isListening 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
              : isProcessing 
                ? 'bg-yellow-500' 
                : 'bg-blue-500 hover:bg-blue-600'
            }
          `}
        >
          {isListening ? '🔴' : isProcessing ? '⏳' : '🎤'}
        </button>
      </div>

      {/* 状态显示 */}
      <div className="text-center mb-4">
        {isListening && (
          <p className="text-blue-600 text-sm animate-pulse">
            正在听取语音指令...
          </p>
        )}
        {isProcessing && (
          <p className="text-yellow-600 text-sm">
            正在处理语音识别结果...
          </p>
        )}
        {!isListening && !isProcessing && !error && (
          <p className="text-gray-500 text-sm">
            点击麦克风开始语音识别
          </p>
        )}
      </div>

      {/* 错误显示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-red-500 mr-2">⚠️</span>
              <span className="text-red-700 text-sm">{error}</span>
            </div>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 最后识别结果 */}
      {lastResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-sm">
            <div className="font-medium text-green-800 mb-1">
              识别结果: {lastResult.text}
            </div>
            <div className="text-green-600 text-xs">
              置信度: {Math.round(lastResult.confidence * 100)}%
              {lastResult.localCorrected && (
                <span className="ml-2 bg-blue-100 text-blue-800 px-1 rounded">
                  已纠错
                </span>
              )}
            </div>
            {lastResult.appliedRules && lastResult.appliedRules.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                应用规则: {lastResult.appliedRules.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 使用说明 */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">语音指令示例:</h4>
        <div className="text-xs text-gray-600 space-y-1">
          <div>• "我单K" - 出单张K</div>
          <div>• "上对10" - 上家出对10</div>
          <div>• "对三A带5" - 对家三A带5</div>
          <div>• "下炸8" - 下家炸8</div>
          <div>• "我王炸" - 王炸</div>
          <div>• "上过" - 上家过牌</div>
        </div>
      </div>
    </div>
  );
};

// 类型声明
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default VoiceControl;