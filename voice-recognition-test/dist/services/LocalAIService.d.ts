/**
 * 本地AI语音纠错服务
 * 基于规则和模式匹配的轻量级纠错方案
 */
import { VoiceRecognitionResult } from '../types/voice-types';
interface CorrectionRule {
    pattern: RegExp;
    replacement: string | ((match: string) => string);
    description: string;
}
interface LocalAIResult {
    correctedText: string;
    hasCorrected: boolean;
    appliedRules: string[];
    confidence: number;
}
export declare class LocalAIService {
    private correctionRules;
    constructor();
    /**
     * 初始化纠错规则
     */
    private initializeCorrectionRules;
    /**
     * 纠正语音识别结果
     */
    correctText(result: VoiceRecognitionResult): LocalAIResult;
    /**
     * 计算纠错置信度
     */
    private calculateCorrectionConfidence;
    /**
     * 检查是否为有效的掼蛋指令
     */
    private isValidCommand;
    /**
     * 获取纠错统计信息
     */
    getCorrectionStats(): {
        totalRules: number;
        ruleCategories: string[];
    };
    /**
     * 添加自定义纠错规则
     */
    addCustomRule(rule: CorrectionRule): void;
    /**
     * 批量纠错多个候选结果
     */
    correctMultipleResults(results: string[]): LocalAIResult[];
}
export {};
//# sourceMappingURL=LocalAIService.d.ts.map