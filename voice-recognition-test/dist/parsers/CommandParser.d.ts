/**
 * 指令解析器
 * 将语音识别的文本转换为结构化的游戏指令
 */
import { ParsedCommand, VoiceConfig } from '../types/voice-types';
export declare class CommandParser {
    private config;
    private parseRules;
    constructor(config: VoiceConfig);
    /**
     * 解析语音指令
     */
    parse(text: string): ParsedCommand | null;
    /**
     * 预处理文本
     */
    private preprocessText;
    /**
     * 解析玩家和动作文本
     */
    private parsePlayerAndAction;
    /**
     * 检查是否为全局指令
     */
    private isGlobalCommand;
    /**
     * 解析全局指令
     */
    private parseGlobalCommand;
    /**
     * 创建解析规则
     */
    private createParseRules;
    /**
     * 规范化牌面值
     */
    private normalizeCard;
    /**
     * 解析中文数字
     */
    private parseChineseNumber;
    /**
     * 验证解析结果的合理性
     */
    validateCommand(command: ParsedCommand): {
        valid: boolean;
        reason?: string;
    };
    /**
     * 获取所有支持的指令示例
     */
    getCommandExamples(): {
        [key: string]: string[];
    };
    /**
     * 更新配置
     */
    updateConfig(newConfig: Partial<VoiceConfig>): void;
}
//# sourceMappingURL=CommandParser.d.ts.map