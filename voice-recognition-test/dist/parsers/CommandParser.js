/**
 * 指令解析器
 * 将语音识别的文本转换为结构化的游戏指令
 */
export class CommandParser {
    constructor(config) {
        this.config = config;
        this.parseRules = this.createParseRules();
    }
    /**
     * 解析语音指令
     */
    parse(text) {
        if (!text || text.trim().length === 0) {
            return null;
        }
        // 预处理文本
        const processedText = this.preprocessText(text);
        console.log('预处理后的文本:', processedText);
        // 解析玩家和动作
        const parseResult = this.parsePlayerAndAction(processedText);
        if (!parseResult) {
            return null;
        }
        const { player, actionText } = parseResult;
        // 处理全局指令（撤销、重置等）
        if (this.isGlobalCommand(processedText)) {
            return this.parseGlobalCommand(processedText);
        }
        // 匹配并解析动作
        for (const rule of this.parseRules) {
            const match = actionText.match(rule.pattern);
            if (match) {
                console.log(`匹配规则: ${rule.name}`, match);
                try {
                    const command = rule.parser(player, match);
                    return {
                        ...command,
                        timestamp: Date.now()
                    };
                }
                catch (error) {
                    console.error(`解析规则 ${rule.name} 时出错:`, error);
                    continue;
                }
            }
        }
        console.log('所有规则都未匹配');
        return null;
    }
    /**
     * 预处理文本
     */
    preprocessText(text) {
        let processed = text.trim();
        // 去除标点符号
        processed = processed.replace(/[，。！？；：""''（）【】]/g, '');
        // 处理同义词替换
        for (const [standard, synonyms] of Object.entries(this.config.synonymMap)) {
            for (const synonym of synonyms) {
                const regex = new RegExp(synonym, 'g');
                processed = processed.replace(regex, standard);
            }
        }
        // 处理数字和牌面映射
        for (const [input, output] of Object.entries(this.config.cardMap)) {
            const regex = new RegExp(input, 'g');
            processed = processed.replace(regex, output);
        }
        return processed;
    }
    /**
     * 解析玩家和动作文本
     */
    parsePlayerAndAction(text) {
        // 尝试匹配玩家前缀
        for (const [playerText, playerId] of Object.entries(this.config.playerMap)) {
            if (text.startsWith(playerText)) {
                return {
                    player: playerId,
                    actionText: text.substring(playerText.length).trim()
                };
            }
        }
        return null;
    }
    /**
     * 检查是否为全局指令
     */
    isGlobalCommand(text) {
        const globalCommands = ['撤销', '重置', '清空'];
        return globalCommands.some(cmd => text.includes(cmd));
    }
    /**
     * 解析全局指令
     */
    parseGlobalCommand(text) {
        let action = 'UNDO';
        if (text.includes('重置') || text.includes('清空')) {
            action = 'RESET';
        }
        return {
            player: 'me',
            action: action,
            timestamp: Date.now()
        };
    }
    /**
     * 创建解析规则
     */
    createParseRules() {
        return [
            // 规则按优先级排序，复杂规则优先
            // 三带二 - 例：三A带5, 三8带对2
            {
                name: 'full_house',
                pattern: /^三([2-9JQKA]|10|大王|小王)带(对?([2-9JQKA]|10|大王|小王))$/,
                parser: (player, match) => ({
                    player,
                    action: 'PLAY',
                    playDetails: {
                        pattern: 'full_house',
                        rawDescription: match[0],
                        mainCard: this.normalizeCard(match[1] || ''),
                        attachCard: this.normalizeCard(match[3] || match[2] || '')
                    }
                }),
                priority: 90
            },
            // 顺子 - 例：顺5五张, 顺10三张
            {
                name: 'straight',
                pattern: /^顺([2-9JQKA]|10)([一二三四五六七八九十]|[1-9])张?$/,
                parser: (player, match) => ({
                    player,
                    action: 'PLAY',
                    playDetails: {
                        pattern: 'straight',
                        rawDescription: match[0],
                        startCard: this.normalizeCard(match[1] || ''),
                        count: this.parseChineseNumber(match[2] || '1')
                    }
                }),
                priority: 80
            },
            // 炸弹 - 例：炸8, 5个J
            {
                name: 'bomb',
                pattern: /^(炸([2-9JQKA]|10|大王|小王)|([四五六七八]|[4-8])个([2-9JQKA]|10|大王|小王))$/,
                parser: (player, match) => ({
                    player,
                    action: 'PLAY',
                    playDetails: {
                        pattern: 'bomb',
                        rawDescription: match[0],
                        mainCard: this.normalizeCard(match[2] || match[4] || ''),
                        count: match[3] ? this.parseChineseNumber(match[3] || '4') : 4
                    }
                }),
                priority: 70
            },
            // 王炸
            {
                name: 'joker_bomb',
                pattern: /^王炸$/,
                parser: (player, match) => ({
                    player,
                    action: 'PLAY',
                    playDetails: {
                        pattern: 'joker_bomb',
                        rawDescription: match[0]
                    }
                }),
                priority: 85
            },
            // 三张 - 例：三8, 三个A
            {
                name: 'triple',
                pattern: /^三(个?([2-9JQKA]|10|大王|小王))$/,
                parser: (player, match) => ({
                    player,
                    action: 'PLAY',
                    playDetails: {
                        pattern: 'triple',
                        rawDescription: match[0],
                        mainCard: this.normalizeCard(match[2] || match[1] || '')
                    }
                }),
                priority: 60
            },
            // 对子 - 例：对K, 对10
            {
                name: 'pair',
                pattern: /^对([2-9JQKA]|10|大王|小王)$/,
                parser: (player, match) => ({
                    player,
                    action: 'PLAY',
                    playDetails: {
                        pattern: 'pair',
                        rawDescription: match[0],
                        mainCard: this.normalizeCard(match[1] || '')
                    }
                }),
                priority: 50
            },
            // 单张 - 例：单K, 单张A
            {
                name: 'single',
                pattern: /^单(张?([2-9JQKA]|10|大王|小王))$/,
                parser: (player, match) => ({
                    player,
                    action: 'PLAY',
                    playDetails: {
                        pattern: 'single',
                        rawDescription: match[0],
                        mainCard: this.normalizeCard(match[2] || match[1] || '')
                    }
                }),
                priority: 40
            },
            // 过牌 - 例：过, 不要
            {
                name: 'pass',
                pattern: /^过$/,
                parser: (player, match) => ({
                    player,
                    action: 'PASS',
                    playDetails: {
                        pattern: 'single', // 占位符
                        rawDescription: match[0]
                    }
                }),
                priority: 30
            }
        ].sort((a, b) => b.priority - a.priority); // 按优先级降序排列
    }
    /**
     * 规范化牌面值
     */
    normalizeCard(card) {
        // 移除可能的修饰词
        let normalized = card.replace(/个|张/g, '');
        // 查找映射
        for (const [input, output] of Object.entries(this.config.cardMap)) {
            if (input === normalized) {
                return output;
            }
        }
        // 直接返回（如果已经是标准格式）
        return normalized;
    }
    /**
     * 解析中文数字
     */
    parseChineseNumber(numStr) {
        const numMap = {
            '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
            '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
            '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
            '6': 6, '7': 7, '8': 8, '9': 9
        };
        return numMap[numStr] || parseInt(numStr) || 1;
    }
    /**
     * 验证解析结果的合理性
     */
    validateCommand(command) {
        // 基本验证
        if (!command.player || !command.action) {
            return { valid: false, reason: '缺少必要信息' };
        }
        // 出牌动作需要有详情
        if (command.action === 'PLAY' && !command.playDetails) {
            return { valid: false, reason: '出牌动作缺少详情' };
        }
        // 验证牌面值的合理性
        if (command.playDetails?.mainCard) {
            const validCards = [
                '2', '3', '4', '5', '6', '7', '8', '9', '10',
                'J', 'Q', 'K', 'A', '小王', '大王'
            ];
            if (!validCards.includes(command.playDetails.mainCard)) {
                return { valid: false, reason: `无效的牌面值: ${command.playDetails.mainCard}` };
            }
        }
        return { valid: true };
    }
    /**
     * 获取所有支持的指令示例
     */
    getCommandExamples() {
        return {
            '单张': ['我单K', '上单A', '对单10', '下单大王'],
            '对子': ['我对8', '上对J', '对对Q', '下对小王'],
            '三张': ['我三7', '上三A', '对三K', '下三10'],
            '三带二': ['我三A带5', '上三8带对2', '对三K带J', '下三10带对7'],
            '顺子': ['我顺5五张', '上顺10三张', '对顺7六张', '下顺J四张'],
            '炸弹': ['我炸8', '上5个J', '对炸K', '下6个10'],
            '王炸': ['我王炸', '上王炸', '对王炸', '下王炸'],
            '过牌': ['我过', '上过', '对过', '下过'],
            '全局': ['撤销', '重置']
        };
    }
    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.parseRules = this.createParseRules();
    }
}
//# sourceMappingURL=CommandParser.js.map