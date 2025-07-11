/**
 * AI增强语音识别服务
 * 结合原生语音识别与大模型API，提升识别准确性
 */

import { VoiceRecognitionService } from './VoiceRecognitionService';
import { 
  VoiceRecognitionResult, 
  VoiceError, 
  VoiceRecognitionState, 
  VoiceEvents,
  VoiceConfig
} from '../types/voice-types';

interface AIConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

interface AIEnhancedResult extends VoiceRecognitionResult {
  aiCorrected?: boolean;
  originalText?: string;
  correctionConfidence?: number;
}

export class AIEnhancedVoiceService {
  private baseService: VoiceRecognitionService;
  private aiConfig: AIConfig;
  private state: VoiceRecognitionState = 'idle';
  private events: Partial<VoiceEvents> = {};

  constructor(voiceConfig?: Partial<VoiceConfig>, aiConfig?: Partial<AIConfig>) {
    this.baseService = new VoiceRecognitionService(voiceConfig);
    
    this.aiConfig = {
      apiKey: process.env.OPENAI_API_KEY || '',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-3.5-turbo',
      temperature: 0.1,
      maxTokens: 150,
      ...aiConfig
    };

    this.setupBaseServiceHandlers();
  }

  /**
   * 设置基础语音服务的事件处理
   */
  private setupBaseServiceHandlers(): void {
    this.baseService.on('onStateChange', (state) => {
      this.setState(state);
    });

    this.baseService.on('onResult', async (result) => {
      if (result.confidence < 0.7 || this.needsCorrection(result.text)) {
        // 置信度低或识别结果可能有误，使用AI增强
        try {
          const enhancedResult = await this.enhanceWithAI(result);
          this.emitResult(enhancedResult);
        } catch (error) {
          console.warn('AI增强失败，使用原始结果:', error);
          this.emitResult(result);
        }
      } else {
        // 置信度高且看起来正确，直接使用
        this.emitResult(result);
      }
    });

    this.baseService.on('onError', (error) => {
      this.emitError(error);
    });
  }

  /**
   * 判断是否需要AI纠错
   */
  private needsCorrection(text: string): boolean {
    // 检查是否包含常见的语音识别错误
    const errorPatterns = [
      /[0-9]{2,}/,  // 连续数字可能识别错误
      /[a-zA-Z]{3,}/, // 连续英文可能识别错误
      /[\u4e00-\u9fff]{10,}/, // 过长中文可能有问题
      /单单|对对|三三/, // 重复词汇
      /我我|上上|下下/, // 重复玩家标识
    ];

    return errorPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 使用AI增强识别结果
   */
  private async enhanceWithAI(result: VoiceRecognitionResult): Promise<AIEnhancedResult> {
    const prompt = this.buildCorrectionPrompt(result);
    
    const response = await fetch(this.aiConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.aiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: this.aiConfig.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专门纠正掼蛋游戏语音识别错误的AI助手。你需要根据掼蛋游戏规则和常见语音指令，纠正可能的识别错误。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.aiConfig.temperature,
        max_tokens: this.aiConfig.maxTokens
      })
    });

    if (!response.ok) {
      throw new Error(`AI API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const aiText = data.choices[0]?.message?.content?.trim();
    
    if (!aiText) {
      throw new Error('AI返回空结果');
    }

    // 解析AI返回的结果
    const correctionResult = this.parseAICorrection(aiText);
    
    return {
      ...result,
      text: correctionResult.correctedText || result.text,
      aiCorrected: correctionResult.hasCorrected,
      originalText: result.text,
      correctionConfidence: correctionResult.confidence
    };
  }

  /**
   * 构建纠错提示词
   */
  private buildCorrectionPrompt(result: VoiceRecognitionResult): string {
    return `
请纠正以下掼蛋游戏语音识别结果中可能的错误：

原始识别文本: "${result.text}"
识别置信度: ${result.confidence}
候选结果: ${result.alternatives?.join(', ') || '无'}

掼蛋游戏常见指令格式：
- 出牌: "[玩家]单[牌]" (如: 我单K)
- 对子: "[玩家]对[牌]" (如: 上对10) 
- 三张: "[玩家]三[牌]" (如: 下三8)
- 三带二: "[玩家]三[牌]带[牌]" (如: 对三A带5)
- 顺子: "[玩家]顺[起始][数量]" (如: 我顺5五张)
- 炸弹: "[玩家]炸[牌]" (如: 上炸8)
- 王炸: "[玩家]王炸"
- 过牌: "[玩家]过"

玩家标识: 我、上、对、下
牌面: 2-10、J、Q、K、A、小王、大王

请分析并返回JSON格式：
{
  "corrected_text": "纠正后的文本",
  "has_corrected": true/false,
  "confidence": 0.0-1.0,
  "explanation": "纠正说明"
}

如果原文本正确无需纠正，请保持原文本不变，has_corrected设为false。
`;
  }

  /**
   * 解析AI纠错结果
   */
  private parseAICorrection(aiResponse: string): {
    correctedText?: string;
    hasCorrected: boolean;
    confidence: number;
  } {
    try {
      const parsed = JSON.parse(aiResponse);
      return {
        correctedText: parsed.corrected_text,
        hasCorrected: parsed.has_corrected || false,
        confidence: parsed.confidence || 0.5
      };
    } catch (error) {
      console.warn('解析AI响应失败:', error);
      return {
        hasCorrected: false,
        confidence: 0.5
      };
    }
  }

  /**
   * 开始语音识别
   */
  public startListening(): void {
    this.baseService.startListening();
  }

  /**
   * 停止语音识别
   */
  public stopListening(): void {
    this.baseService.stopListening();
  }

  /**
   * 中止语音识别
   */
  public abortListening(): void {
    this.baseService.abortListening();
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
   * 检查浏览器支持
   */
  public static isSupported(): boolean {
    return VoiceRecognitionService.isSupported();
  }

  /**
   * 设置AI配置
   */
  public setAIConfig(config: Partial<AIConfig>): void {
    this.aiConfig = { ...this.aiConfig, ...config };
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
  private emitResult(result: VoiceRecognitionResult | AIEnhancedResult): void {
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
    this.baseService.destroy();
    this.events = {};
  }
}