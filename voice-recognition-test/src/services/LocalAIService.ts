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

export class LocalAIService {
  private correctionRules: CorrectionRule[] = [];

  constructor() {
    this.initializeCorrectionRules();
  }

  /**
   * 初始化纠错规则
   */
  private initializeCorrectionRules(): void {
    this.correctionRules = [
      // 数字纠错
      {
        pattern: /([我上下对][单对三]?)(\d{2,})/g,
        replacement: (match) => {
          const parts = match.match(/([我上下对][单对三]?)(\d+)/);
          if (parts) {
            const prefix = parts[1];
            const number = parts[2];
            // 取最后一位数字作为牌面
            const card = number.slice(-1);
            return prefix + card;
          }
          return match;
        },
        description: '修正连续数字识别错误'
      },

      // 常见同音字纠错
      {
        pattern: /勾/g,
        replacement: 'J',
        description: '修正J的同音字'
      },
      {
        pattern: /圈/g,
        replacement: 'Q',
        description: '修正Q的同音字'
      },
      {
        pattern: /尖/g,
        replacement: 'A',
        description: '修正A的同音字'
      },

      // 玩家标识纠错
      {
        pattern: /俺|咱/g,
        replacement: '我',
        description: '修正玩家标识'
      },
      {
        pattern: /上家|上手/g,
        replacement: '上',
        description: '修正上家标识'
      },
      {
        pattern: /下家|下手/g,
        replacement: '下',
        description: '修正下家标识'
      },
      {
        pattern: /对家|对门/g,
        replacement: '对',
        description: '修正对家标识'
      },

      // 动作纠错
      {
        pattern: /单张|一张/g,
        replacement: '单',
        description: '修正单张指令'
      },
      {
        pattern: /对子|一对/g,
        replacement: '对',
        description: '修正对子指令'
      },
      {
        pattern: /三张|三个/g,
        replacement: '三',
        description: '修正三张指令'
      },
      {
        pattern: /炸弹/g,
        replacement: '炸',
        description: '修正炸弹指令'
      },
      {
        pattern: /不要|要不起|过牌/g,
        replacement: '过',
        description: '修正过牌指令'
      },

      // 重复词纠错
      {
        pattern: /([我上下对])\1+/g,
        replacement: '$1',
        description: '修正重复玩家标识'
      },
      {
        pattern: /([单对三炸过])\1+/g,
        replacement: '$1',
        description: '修正重复动作词'
      },

      // 数字中文纠错
      {
        pattern: /二/g,
        replacement: '2',
        description: '修正数字2'
      },
      {
        pattern: /三(?![带])/g,
        replacement: '3',
        description: '修正数字3'
      },
      {
        pattern: /四/g,
        replacement: '4',
        description: '修正数字4'
      },
      {
        pattern: /五/g,
        replacement: '5',
        description: '修正数字5'
      },
      {
        pattern: /六/g,
        replacement: '6',
        description: '修正数字6'
      },
      {
        pattern: /七/g,
        replacement: '7',
        description: '修正数字7'
      },
      {
        pattern: /八/g,
        replacement: '8',
        description: '修正数字8'
      },
      {
        pattern: /九/g,
        replacement: '9',
        description: '修正数字9'
      },
      {
        pattern: /十/g,
        replacement: '10',
        description: '修正数字10'
      },

      // 王牌纠错
      {
        pattern: /小(?![王])/g,
        replacement: '小王',
        description: '修正小王'
      },
      {
        pattern: /大(?![王])/g,
        replacement: '大王',
        description: '修正大王'
      },

      // 顺子纠错
      {
        pattern: /([我上下对])顺([2-9A-KJ-QjqkKaA]+)([一二三四五六七八九十\d]+)张/g,
        replacement: '$1顺$2$3',
        description: '修正顺子格式'
      },

      // 三带二纠错
      {
        pattern: /([我上下对])三([2-9A-KJ-QjqkKaA]+)代([2-9A-KJ-QjqkKaA]+)/g,
        replacement: '$1三$2带$3',
        description: '修正三带二格式'
      },

      // 去除标点符号
      {
        pattern: /[，。！？、]/g,
        replacement: '',
        description: '去除标点符号'
      },

      // 去除多余空格
      {
        pattern: /\s+/g,
        replacement: '',
        description: '去除多余空格'
      }
    ];
  }

  /**
   * 纠正语音识别结果
   */
  public correctText(result: VoiceRecognitionResult): LocalAIResult {
    let correctedText = result.text;
    const appliedRules: string[] = [];
    let changesMade = false;

    // 应用纠错规则
    for (const rule of this.correctionRules) {
      const originalText = correctedText;
      
      if (typeof rule.replacement === 'string') {
        correctedText = correctedText.replace(rule.pattern, rule.replacement);
      } else {
        correctedText = correctedText.replace(rule.pattern, rule.replacement);
      }

      if (correctedText !== originalText) {
        appliedRules.push(rule.description);
        changesMade = true;
      }
    }

    // 计算纠错置信度
    const confidence = this.calculateCorrectionConfidence(
      result.text,
      correctedText,
      result.confidence,
      appliedRules.length
    );

    return {
      correctedText,
      hasCorrected: changesMade,
      appliedRules,
      confidence
    };
  }

  /**
   * 计算纠错置信度
   */
  private calculateCorrectionConfidence(
    originalText: string,
    correctedText: string,
    originalConfidence: number,
    rulesApplied: number
  ): number {
    // 基础置信度从原识别置信度开始
    let confidence = originalConfidence;

    // 如果有纠错，根据纠错规则数量调整置信度
    if (rulesApplied > 0) {
      // 适度的纠错通常能提高置信度
      if (rulesApplied <= 3) {
        confidence = Math.min(0.95, confidence + 0.1 * rulesApplied);
      } else {
        // 过多纠错可能降低置信度
        confidence = Math.max(0.3, confidence - 0.05 * (rulesApplied - 3));
      }
    }

    // 检查纠错后的文本是否符合掼蛋指令格式
    if (this.isValidCommand(correctedText)) {
      confidence = Math.min(0.98, confidence + 0.1);
    }

    return Math.round(confidence * 100) / 100;
  }

  /**
   * 检查是否为有效的掼蛋指令
   */
  private isValidCommand(text: string): boolean {
    const commandPatterns = [
      /^[我上下对][单对三炸过]/,  // 基本出牌格式
      /^[我上下对]王炸$/,        // 王炸
      /^[我上下对]顺/,          // 顺子
      /^[我上下对]三.+带/,      // 三带二
    ];

    return commandPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 获取纠错统计信息
   */
  public getCorrectionStats(): {
    totalRules: number;
    ruleCategories: string[];
  } {
    const categories = [
      '数字纠错',
      '同音字纠错', 
      '玩家标识纠错',
      '动作纠错',
      '重复词纠错',
      '格式化纠错'
    ];

    return {
      totalRules: this.correctionRules.length,
      ruleCategories: categories
    };
  }

  /**
   * 添加自定义纠错规则
   */
  public addCustomRule(rule: CorrectionRule): void {
    this.correctionRules.push(rule);
  }

  /**
   * 批量纠错多个候选结果
   */
  public correctMultipleResults(results: string[]): LocalAIResult[] {
    return results.map(text => {
      const mockResult: VoiceRecognitionResult = {
        text,
        confidence: 0.8,
        alternatives: []
      };
      return this.correctText(mockResult);
    });
  }
}