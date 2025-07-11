/**
 * 语音识别服务
 * 使用Web Speech API实现语音到文本的转换
 */
import { VoiceRecognitionState, VoiceEvents, VoiceConfig } from '../types/voice-types';
export declare class VoiceRecognitionService {
    private recognition;
    private state;
    private events;
    private config;
    constructor(config?: Partial<VoiceConfig>);
    /**
     * 初始化语音识别
     */
    private initializeSpeechRecognition;
    /**
     * 设置事件处理器
     */
    private setupEventHandlers;
    /**
     * 合并配置
     */
    private mergeConfig;
    /**
     * 开始语音识别
     */
    startListening(): void;
    /**
     * 停止语音识别
     */
    stopListening(): void;
    /**
     * 中止语音识别
     */
    abortListening(): void;
    /**
     * 注册事件监听器
     */
    on<K extends keyof VoiceEvents>(event: K, handler: VoiceEvents[K]): void;
    /**
     * 移除事件监听器
     */
    off<K extends keyof VoiceEvents>(event: K): void;
    /**
     * 获取当前状态
     */
    getState(): VoiceRecognitionState;
    /**
     * 获取配置信息
     */
    getConfig(): VoiceConfig;
    /**
     * 检查浏览器支持
     */
    static isSupported(): boolean;
    /**
     * 设置状态
     */
    private setState;
    /**
     * 发送结果事件
     */
    private emitResult;
    /**
     * 发送错误事件
     */
    private emitError;
    /**
     * 销毁实例
     */
    destroy(): void;
}
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}
//# sourceMappingURL=VoiceRecognitionService.d.ts.map