/**
 * 混合语音识别服务
 * 结合本地规则纠错和远程AI增强的最优方案
 */
import { VoiceRecognitionService } from './VoiceRecognitionService';
import { LocalAIService } from './LocalAIService';
export class HybridVoiceService {
    constructor(voiceConfig, hybridConfig) {
        this.state = 'idle';
        this.events = {};
        this.baseService = new VoiceRecognitionService(voiceConfig);
        this.localAI = new LocalAIService();
        this.config = {
            enableLocalCorrection: true,
            localCorrectionThreshold: 0.6,
            enableRemoteAI: false,
            remoteAIThreshold: 0.4,
            strategy: 'local-first',
            confidenceThreshold: 0.7,
            ...hybridConfig
        };
        this.setupBaseServiceHandlers();
    }
    /**
     * 设置基础语音服务的事件处理
     */
    setupBaseServiceHandlers() {
        this.baseService.on('onStateChange', (state) => {
            this.setState(state);
        });
        this.baseService.on('onResult', (result) => {
            this.processResult(result);
        });
        this.baseService.on('onError', (error) => {
            this.emitError(error);
        });
    }
    /**
     * 处理语音识别结果
     */
    async processResult(result) {
        try {
            let enhancedResult;
            switch (this.config.strategy) {
                case 'local-first':
                    enhancedResult = await this.processLocalFirst(result);
                    break;
                case 'ai-first':
                    enhancedResult = await this.processAIFirst(result);
                    break;
                case 'parallel':
                    enhancedResult = await this.processParallel(result);
                    break;
                case 'cascade':
                    enhancedResult = await this.processCascade(result);
                    break;
                default:
                    enhancedResult = result;
            }
            this.emitResult(enhancedResult);
        }
        catch (error) {
            console.error('结果处理失败:', error);
            this.emitResult(result);
        }
    }
    /**
     * 本地优先策略
     */
    async processLocalFirst(result) {
        let enhancedResult = { ...result };
        // 首先使用本地纠错
        if (this.config.enableLocalCorrection &&
            result.confidence < this.config.localCorrectionThreshold) {
            const localResult = this.localAI.correctText(result);
            enhancedResult = {
                ...result,
                text: localResult.correctedText,
                localCorrected: localResult.hasCorrected,
                originalText: result.text,
                correctionMethod: 'local',
                appliedRules: localResult.appliedRules,
                confidence: localResult.confidence
            };
        }
        // 如果本地纠错后置信度仍然不够且启用了远程AI
        if (this.config.enableRemoteAI &&
            enhancedResult.confidence < this.config.remoteAIThreshold) {
            try {
                const aiResult = await this.callRemoteAI(enhancedResult);
                enhancedResult = {
                    ...enhancedResult,
                    ...aiResult,
                    correctionMethod: enhancedResult.localCorrected ? 'local+ai' : 'ai'
                };
            }
            catch (error) {
                console.warn('远程AI调用失败:', error);
            }
        }
        return enhancedResult;
    }
    /**
     * AI优先策略
     */
    async processAIFirst(result) {
        let enhancedResult = { ...result };
        // 首先尝试远程AI
        if (this.config.enableRemoteAI &&
            result.confidence < this.config.remoteAIThreshold) {
            try {
                const aiResult = await this.callRemoteAI(result);
                enhancedResult = {
                    ...result,
                    ...aiResult,
                    correctionMethod: 'ai'
                };
            }
            catch (error) {
                console.warn('远程AI调用失败，回退到本地纠错:', error);
                // AI失败时回退到本地纠错
                if (this.config.enableLocalCorrection) {
                    const localResult = this.localAI.correctText(result);
                    enhancedResult = {
                        ...result,
                        text: localResult.correctedText,
                        localCorrected: localResult.hasCorrected,
                        originalText: result.text,
                        correctionMethod: 'local',
                        appliedRules: localResult.appliedRules,
                        confidence: localResult.confidence
                    };
                }
            }
        }
        return enhancedResult;
    }
    /**
     * 并行处理策略
     */
    async processParallel(result) {
        const promises = [];
        // 并行执行本地纠错和远程AI
        if (this.config.enableLocalCorrection) {
            promises.push(Promise.resolve(this.localAI.correctText(result)));
        }
        if (this.config.enableRemoteAI && result.confidence < this.config.remoteAIThreshold) {
            promises.push(this.callRemoteAI(result).catch(error => {
                console.warn('远程AI调用失败:', error);
                return null;
            }));
        }
        const results = await Promise.all(promises);
        const localResult = results[0];
        const aiResult = results[1];
        // 选择最佳结果
        return this.selectBestResult(result, localResult, aiResult);
    }
    /**
     * 级联处理策略
     */
    async processCascade(result) {
        let currentResult = result;
        let enhancedResult = { ...result };
        // 第一级：本地快速纠错
        if (this.config.enableLocalCorrection) {
            const localResult = this.localAI.correctText(currentResult);
            if (localResult.hasCorrected) {
                enhancedResult = {
                    ...currentResult,
                    text: localResult.correctedText,
                    localCorrected: true,
                    originalText: result.text,
                    appliedRules: localResult.appliedRules,
                    confidence: localResult.confidence
                };
                currentResult = enhancedResult;
            }
        }
        // 第二级：如果仍需改进，使用远程AI
        if (this.config.enableRemoteAI &&
            currentResult.confidence < this.config.confidenceThreshold) {
            try {
                const aiResult = await this.callRemoteAI(currentResult);
                enhancedResult = {
                    ...enhancedResult,
                    ...aiResult,
                    correctionMethod: enhancedResult.localCorrected ? 'cascade' : 'ai'
                };
            }
            catch (error) {
                console.warn('远程AI调用失败:', error);
            }
        }
        return enhancedResult;
    }
    /**
     * 选择最佳结果
     */
    selectBestResult(original, localResult, aiResult) {
        const candidates = [
            { result: original, confidence: original.confidence, method: 'original' },
        ];
        if (localResult && localResult.hasCorrected) {
            candidates.push({
                result: {
                    ...original,
                    text: localResult.correctedText,
                    confidence: localResult.confidence
                },
                confidence: localResult.confidence,
                method: 'local'
            });
        }
        if (aiResult) {
            candidates.push({
                result: aiResult,
                confidence: aiResult.confidence || original.confidence,
                method: 'ai'
            });
        }
        // 选择置信度最高的结果
        const best = candidates.reduce((prev, current) => (prev.confidence > current.confidence) ? prev : current);
        return {
            ...best.result,
            correctionMethod: best.method,
            localCorrected: best.method === 'local' || best.method === 'parallel',
            aiCorrected: best.method === 'ai' || best.method === 'parallel',
            originalText: original.text,
            appliedRules: localResult?.appliedRules
        };
    }
    /**
     * 调用远程AI API
     */
    async callRemoteAI(result) {
        if (!this.config.apiKey) {
            throw new Error('未配置API Key');
        }
        const response = await fetch(this.config.apiUrl || 'https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model: this.config.model || 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: '你是掼蛋游戏语音识别纠错专家。请纠正识别错误并返回JSON格式结果。'
                    },
                    {
                        role: 'user',
                        content: `纠正这个掼蛋指令: "${result.text}"`
                    }
                ],
                temperature: 0.1,
                max_tokens: 150
            })
        });
        if (!response.ok) {
            throw new Error(`AI API调用失败: ${response.status}`);
        }
        const data = await response.json();
        const aiText = data.choices[0]?.message?.content?.trim();
        return {
            text: aiText || result.text,
            aiCorrected: true,
            confidence: 0.9
        };
    }
    /**
     * 获取处理统计
     */
    getStats() {
        return {
            strategy: this.config.strategy,
            localCorrectionEnabled: this.config.enableLocalCorrection,
            remoteAIEnabled: this.config.enableRemoteAI,
            thresholds: {
                local: this.config.localCorrectionThreshold,
                remote: this.config.remoteAIThreshold,
                confidence: this.config.confidenceThreshold
            }
        };
    }
    /**
     * 更新配置
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    // 公共API方法
    startListening() {
        this.baseService.startListening();
    }
    stopListening() {
        this.baseService.stopListening();
    }
    abortListening() {
        this.baseService.abortListening();
    }
    on(event, handler) {
        this.events[event] = handler;
    }
    off(event) {
        delete this.events[event];
    }
    getState() {
        return this.state;
    }
    setState(state) {
        if (this.state !== state) {
            this.state = state;
            this.events.onStateChange?.(state);
        }
    }
    emitResult(result) {
        this.events.onResult?.(result);
    }
    emitError(error) {
        this.events.onError?.(error);
    }
    destroy() {
        this.baseService.destroy();
        this.events = {};
    }
}
//# sourceMappingURL=HybridVoiceService.js.map