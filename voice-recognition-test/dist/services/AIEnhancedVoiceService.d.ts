/**
 * AI增强语音识别服务
 * 结合原生语音识别与大模型API，提升识别准确性
 */
import { VoiceRecognitionState, VoiceEvents, VoiceConfig } from '../types/voice-types';
interface AIConfig {
    apiKey: string;
    apiUrl: string;
    model: string;
    temperature: number;
    maxTokens: number;
}
export declare class AIEnhancedVoiceService {
    private baseService;
    private aiConfig;
    private state;
    private events;
    constructor(voiceConfig?: Partial<VoiceConfig>, aiConfig?: Partial<AIConfig>);
    /**
     * 设置基础语音服务的事件处理
     */
    private setupBaseServiceHandlers;
    /**
     * 判断是否需要AI纠错
     */
    private needsCorrection;
    /**
     * 使用AI增强识别结果
     */
    private enhanceWithAI;
    /**
     * 构建纠错提示词
     */
    private buildCorrectionPrompt;
    /**
     * 解析AI纠错结果
     */
    private parseAICorrection;
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
     * 检查浏览器支持
     */
    static isSupported(): boolean;
    /**
     * 设置AI配置
     */
    setAIConfig(config: Partial<AIConfig>): void;
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
export {};
//# sourceMappingURL=AIEnhancedVoiceService.d.ts.map