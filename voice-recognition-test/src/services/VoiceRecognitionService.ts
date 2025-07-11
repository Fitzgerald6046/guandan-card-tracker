/**
 * 语音识别服务
 * 使用Web Speech API实现语音到文本的转换
 */

import { 
  VoiceRecognitionResult, 
  VoiceError, 
  VoiceRecognitionState, 
  VoiceEvents,
  VoiceConfig
} from '../types/voice-types';

export class VoiceRecognitionService {
  private recognition: any | null = null;
  private state: VoiceRecognitionState = 'idle';
  private events: Partial<VoiceEvents> = {};
  private config: VoiceConfig;

  constructor(config?: Partial<VoiceConfig>) {
    this.config = this.mergeConfig(config);
    this.initializeSpeechRecognition();
  }

  /**
   * 初始化语音识别
   */
  private initializeSpeechRecognition(): void {
    // 检查浏览器支持
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      this.emitError({
        code: 'NOT_SUPPORTED',
        message: '浏览器不支持语音识别功能',
        type: 'recognition'
      });
      return;
    }

    // 创建识别实例
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // 配置识别参数
    this.recognition.continuous = false;        // 单次识别
    this.recognition.interimResults = false;    // 不要中间结果
    this.recognition.maxAlternatives = 3;       // 最多3个候选结果
    this.recognition.lang = 'zh-CN';           // 中文识别

    // 绑定事件处理器
    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.recognition) return;

    // 开始识别
    this.recognition.onstart = () => {
      this.setState('listening');
      console.log('语音识别已开始');
    };

    // 识别结果
    this.recognition.onresult = (event: any) => {
      this.setState('processing');
      
      const results: string[] = [];
      const confidence = event.results[0]?.[0]?.confidence || 0;
      
      // 收集所有候选结果
      for (let i = 0; i < (event.results[0]?.length || 0); i++) {
        const transcript = event.results[0][i]?.transcript;
        if (transcript) {
          results.push(transcript.trim());
        }
      }

      const result: VoiceRecognitionResult = {
        text: results[0] || '',
        confidence: confidence,
        alternatives: results.slice(1)
      };

      console.log('识别结果:', result);
      this.emitResult(result);
      this.setState('success');
    };

    // 识别错误
    this.recognition.onerror = (event: any) => {
      console.error('语音识别错误:', event.error);
      
      let errorType: VoiceError['type'] = 'recognition';
      let message = '语音识别失败';

      switch (event.error) {
        case 'no-speech':
          message = '未检测到语音输入';
          break;
        case 'audio-capture':
          message = '音频捕获失败，请检查麦克风';
          errorType = 'permission';
          break;
        case 'not-allowed':
          message = '没有麦克风权限，请允许访问麦克风';
          errorType = 'permission';
          break;
        case 'network':
          message = '网络错误，请检查网络连接';
          errorType = 'network';
          break;
        case 'service-not-allowed':
          message = '语音识别服务不可用';
          errorType = 'network';
          break;
      }

      this.emitError({
        code: event.error,
        message: message,
        type: errorType
      });
      this.setState('error');
    };

    // 识别结束
    this.recognition.onend = () => {
      console.log('语音识别已结束');
      if (this.state === 'listening') {
        this.setState('idle');
      }
    };
  }

  /**
   * 合并配置
   */
  private mergeConfig(config?: Partial<VoiceConfig>): VoiceConfig {
    const defaultConfig: VoiceConfig = {
      synonymMap: {
        '我': ['我', '俺', '咱'],
        '上': ['上', '上家', '上手'],
        '对家': ['对', '对家', '对门'],
        '下': ['下', '下家', '下手'],
        '单': ['单', '单张', '一张'],
        '对子': ['对', '对子', '一对'],
        '三': ['三', '三张', '三个'],
        '炸': ['炸', '炸弹'],
        '过': ['过', '不要', '要不起', '过牌']
      },
      cardMap: {
        '2': '2', '二': '2', '两': '2',
        '3': '3', '三': '3',
        '4': '4', '四': '4',
        '5': '5', '五': '5',
        '6': '6', '六': '6',
        '7': '7', '七': '7',
        '8': '8', '八': '8',
        '9': '9', '九': '9',
        '10': '10', '十': '10',
        'J': 'J', '勾': 'J', '钩': 'J', '11': 'J',
        'Q': 'Q', '圈': 'Q', '12': 'Q',
        'K': 'K', '老K': 'K', '13': 'K',
        'A': 'A', '尖': 'A', '1': 'A',
        '小王': '小王', '小': '小王',
        '大王': '大王', '大': '大王', '王': '大王'
      },
      playerMap: {
        '我': 'me',
        '上': 'up', '上家': 'up', '上手': 'up',
        '对': 'partner', '对家': 'partner', '对门': 'partner',
        '下': 'down', '下家': 'down', '下手': 'down'
      }
    };

    return { ...defaultConfig, ...config };
  }

  /**
   * 开始语音识别
   */
  public startListening(): void {
    if (!this.recognition) {
      this.emitError({
        code: 'NOT_INITIALIZED',
        message: '语音识别未初始化',
        type: 'recognition'
      });
      return;
    }

    if (this.state === 'listening') {
      console.log('语音识别已在进行中');
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      this.emitError({
        code: 'START_FAILED',
        message: '启动语音识别失败: ' + (error as Error).message,
        type: 'recognition'
      });
    }
  }

  /**
   * 停止语音识别
   */
  public stopListening(): void {
    if (this.recognition && this.state === 'listening') {
      this.recognition.stop();
      this.setState('idle');
    }
  }

  /**
   * 中止语音识别
   */
  public abortListening(): void {
    if (this.recognition) {
      this.recognition.abort();
      this.setState('idle');
    }
  }

  /**
   * 注册事件监听器
   */
  public on<K extends keyof VoiceEvents>(event: K, handler: VoiceEvents[K]): void {
    this.events[event] = handler;
  }

  /**
   * 移除事件监听器
   */
  public off<K extends keyof VoiceEvents>(event: K): void {
    delete this.events[event];
  }

  /**
   * 获取当前状态
   */
  public getState(): VoiceRecognitionState {
    return this.state;
  }

  /**
   * 获取配置信息
   */
  public getConfig(): VoiceConfig {
    return this.config;
  }

  /**
   * 检查浏览器支持
   */
  public static isSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /**
   * 设置状态
   */
  private setState(state: VoiceRecognitionState): void {
    if (this.state !== state) {
      this.state = state;
      this.events.onStateChange?.(state);
    }
  }

  /**
   * 发送结果事件
   */
  private emitResult(result: VoiceRecognitionResult): void {
    this.events.onResult?.(result);
  }

  /**
   * 发送错误事件
   */
  private emitError(error: VoiceError): void {
    this.events.onError?.(error);
  }

  /**
   * 销毁实例
   */
  public destroy(): void {
    this.stopListening();
    this.events = {};
    this.recognition = null;
  }
}

// 类型声明扩展
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}