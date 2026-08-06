/**
 * 混合语音识别服务
 * 结合本地规则纠错和远程AI增强的最优方案
 */
import { VoiceRecognitionState, VoiceEvents, VoiceConfig } from '../types/voice-types';
interface HybridConfig {
    enableLocalCorrection: boolean;
    localCorrectionThreshold: number;
    enableRemoteAI: boolean;
    remoteAIThreshold: number;
    apiKey?: string;
    apiUrl?: string;
    model?: string;
    strategy: 'local-first' | 'ai-first' | 'parallel' | 'cascade';
    confidenceThreshold: number;
}
export declare class HybridVoiceService {
    private baseService;
    private localAI;
    private config;
    private state;
    private events;
    constructor(voiceConfig?: Partial<VoiceConfig>, hybridConfig?: Partial<HybridConfig>);
    /**
     * 设置基础语音服务的事件处理
     */
    private setupBaseServiceHandlers;
    /**
     * 处理语音识别结果
     */
    private processResult;
    /**
     * 本地优先策略
     */
    private processLocalFirst;
    /**
     * AI优先策略
     */
    private processAIFirst;
    /**
     * 并行处理策略
     */
    private processParallel;
    /**
     * 级联处理策略
     */
    private processCascade;
    /**
     * 选择最佳结果
     */
    private selectBestResult;
    /**
     * 调用远程AI API
     */
    private callRemoteAI;
    /**
     * 获取处理统计
     */
    getStats(): {
        strategy: string;
        localCorrectionEnabled: boolean;
        remoteAIEnabled: boolean;
        thresholds: {
            local: number;
            remote: number;
            confidence: number;
        };
    };
    /**
     * 更新配置
     */
    updateConfig(config: Partial<HybridConfig>): void;
    startListening(): void;
    stopListening(): void;
    abortListening(): void;
    on<K extends keyof VoiceEvents>(event: K, handler: VoiceEvents[K]): void;
    off<K extends keyof VoiceEvents>(event: K): void;
    getState(): VoiceRecognitionState;
    private setState;
    private emitResult;
    private emitError;
    destroy(): void;
}
export {};
//# sourceMappingURL=HybridVoiceService.d.ts.map