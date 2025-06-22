# 掼蛋工具函数库

完整实现了掼蛋记牌器所需的所有工具函数，支持自动级牌识别、配牌标识和完整的游戏逻辑。

## 📁 文件结构

```
src/utils/
├── constants.ts       # 游戏常量定义
├── cardData.ts        # 卡牌数据生成工具  
├── rankUtils.ts       # 级数工具函数
├── testUtils.ts       # 测试工具
├── demo.ts           # 功能演示
└── README.md         # 使用文档
```

## 🎯 核心功能

### 1. 卡牌数据生成 (cardData.ts)

#### `generateCards(currentRank: GameRank): Card[]`
生成108张完整双副牌，自动标记级牌和配牌。

```typescript
import { generateCards } from './utils/cardData';

// 生成级数为5的完整双副牌
const cards = generateCards(5);

console.log(cards.length); // 108张牌
console.log(cards.filter(c => c.isRankCard).length); // 8张级牌(所有5)
console.log(cards.filter(c => c.isWildCard).length); // 2张配牌(红心5)
```

**特点：**
- ✅ 自动标记 `isRankCard` 属性（根据当前级数）
- ✅ 自动标记 `isWildCard` 属性（红心级牌）
- ✅ 包含完整的双副牌（104张普通牌 + 4张王牌）
- ✅ 每张牌都有唯一ID和时间戳

#### 其他重要函数

```typescript
// 洗牌
const shuffledCards = shuffleCards(cards);

// 按掼蛋规则排序（配牌 > 级牌 > 王牌 > 普通牌）
const sortedCards = sortCardsByGuandanRule(cards, currentRank);

// 发牌给四个玩家
const [hand1, hand2, hand3, hand4] = dealCardsToPlayers(cards);

// 分析卡牌分布
const analysis = analyzeCardDistribution(cards, currentRank);
```

### 2. 级数工具函数 (rankUtils.ts)

#### `getRankName(rank: GameRank): string`
级数转换为显示名称。

```typescript
import { getRankName } from './utils/rankUtils';

console.log(getRankName(2));  // "2"
console.log(getRankName(11)); // "J"
console.log(getRankName(12)); // "Q"
console.log(getRankName(13)); // "K"
console.log(getRankName(14)); // "A"
```

#### `getCardOrderValue(card: Card, currentRank: GameRank): number`
根据级数计算牌的排序值（掼蛋规则）。

```typescript
import { getCardOrderValue } from './utils/rankUtils';

const card = { suit: 'hearts', rank: 5, ... };
const orderValue = getCardOrderValue(card, 5);

// 排序权重：配牌(1000+) > 级牌(900+) > 大王(800) > 小王(700) > 普通牌(0-100)
```

#### `isValidRank(rank: unknown): rank is GameRank`
验证级数是否合法（2-14范围）。

```typescript
import { isValidRank } from './utils/rankUtils';

console.log(isValidRank(5));   // true
console.log(isValidRank(15));  // false
console.log(isValidRank('A')); // false
```

#### 级数循环函数

```typescript
import { getNextRank, getPreviousRank } from './utils/rankUtils';

console.log(getNextRank(13)); // 14 (K -> A)
console.log(getNextRank(14)); // 2  (A -> 2, 循环)
console.log(getPreviousRank(2)); // 14 (2 -> A, 反向循环)
```

#### 卡牌类型判断

```typescript
import { isRankCard, isWildCard, isJoker } from './utils/rankUtils';

const heartsCard = { suit: 'hearts', rank: 7, ... };
const spadesCard = { suit: 'spades', rank: 7, ... };
const joker = { suit: null, rank: 15, ... };

console.log(isRankCard(heartsCard, 7));  // true (级牌)
console.log(isWildCard(heartsCard, 7));  // true (配牌-红心级牌)
console.log(isWildCard(spadesCard, 7));  // false (级牌但非红心)
console.log(isJoker(joker));             // true (王牌)
```

### 3. 常量定义 (constants.ts)

#### 游戏配置常量

```typescript
import { GAME_CONFIG, RANK_CONFIG } from './utils/constants';

// 游戏基础配置
console.log(GAME_CONFIG.TOTAL_CARDS);        // 108
console.log(GAME_CONFIG.CARDS_PER_PLAYER);   // 27
console.log(GAME_CONFIG.PLAYER_COUNT);       // 4

// 级数配置
console.log(RANK_CONFIG.MIN_RANK);          // 2
console.log(RANK_CONFIG.MAX_RANK);          // 14
console.log(RANK_CONFIG.DEFAULT_RANK);      // 2
```

#### 显示名称映射

```typescript
import { RANK_DISPLAY_NAMES, SUIT_SYMBOLS } from './utils/constants';

// 级数显示名称
console.log(RANK_DISPLAY_NAMES[11]); // "J"
console.log(RANK_DISPLAY_NAMES[14]); // "A"

// 花色符号
console.log(SUIT_SYMBOLS.hearts);    // "♥"
console.log(SUIT_SYMBOLS.spades);    // "♠"
```

#### 其他重要常量

```typescript
import { VALID_RANKS, DEFAULT_PLAYER_NAMES, TEAM_CONFIG } from './utils/constants';

// 有效级数数组
console.log(VALID_RANKS); // [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

// 默认玩家名称
console.log(DEFAULT_PLAYER_NAMES); // ["您", "左方玩家", "上方玩家", "右方玩家"]

// 队伍配置
console.log(TEAM_CONFIG.TEAM_1_POSITIONS); // ["bottom", "top"]
```

## 🚀 快速开始

### 基本使用示例

```typescript
import { generateCards, analyzeCardDistribution } from './utils/cardData';
import { getRankName, getNextRank } from './utils/rankUtils';
import { GAME_CONFIG } from './utils/constants';

// 1. 设置当前级数
const currentRank = 8; // 级数8
console.log(`当前级数: ${getRankName(currentRank)}`);
console.log(`下一级数: ${getRankName(getNextRank(currentRank))}`);

// 2. 生成108张牌
const cards = generateCards(currentRank);
console.log(`生成了 ${cards.length} 张牌`);

// 3. 分析卡牌分布
const analysis = analyzeCardDistribution(cards, currentRank);
console.log(`配牌(红心${getRankName(currentRank)}): ${analysis.byType.wildCards}张`);
console.log(`级牌(其他${getRankName(currentRank)}): ${analysis.byType.rankCards}张`);
console.log(`王牌: ${analysis.byType.jokers}张`);

// 4. 验证总数
console.log(`总计: ${analysis.total}张 (期望: ${GAME_CONFIG.TOTAL_CARDS}张)`);
```

### 级数变更处理

```typescript
import { generateCards, updateCardRankStatus } from './utils/cardData';
import { countRankCards } from './utils/rankUtils';

// 1. 初始级数为5
let cards = generateCards(5);
let stats = countRankCards(cards, 5);
console.log(`级数5时: 配牌${stats.wildCards}张, 级牌${stats.rankCards}张`);

// 2. 级数变更为10
cards = updateCardRankStatus(cards, 10);
stats = countRankCards(cards, 10);
console.log(`级数10时: 配牌${stats.wildCards}张, 级牌${stats.rankCards}张`);
```

### 手牌排序和统计

```typescript
import { generateCards, sortCardsByGuandanRule, dealCardsToPlayers } from './utils/cardData';
import { countRankCards } from './utils/rankUtils';

// 1. 生成并发牌
const allCards = generateCards(12); // 级数Q
const playerHands = dealCardsToPlayers(allCards);

// 2. 排序第一个玩家的手牌
const sortedHand = sortCardsByGuandanRule(playerHands[0], 12);

// 3. 统计手牌
const stats = countRankCards(sortedHand, 12);
console.log(`玩家手牌统计:`);
console.log(`- 配牌: ${stats.wildCards}张`);
console.log(`- 级牌: ${stats.rankCards}张`);
console.log(`- 王牌: ${stats.jokers}张`);
console.log(`- 普通牌: ${stats.normalCards}张`);
```

## 🧪 测试和验证

### 运行演示

```typescript
import { runDemo } from './utils/demo';

// 运行完整功能演示
const result = runDemo();
console.log(result.success ? '✅ 演示成功' : '❌ 演示失败');
```

### 运行测试

```typescript
import { runAllTests } from './utils/testUtils';

// 运行完整测试套件
const testResults = runAllTests();
console.log(`测试结果: ${testResults.summary.passedTests}/${testResults.summary.totalTests} 通过`);
```

## 📊 性能特点

- **高效生成**: 108张牌生成 < 1ms
- **智能标记**: 自动识别级牌和配牌状态
- **内存优化**: 卡牌对象结构紧凑
- **类型安全**: 完整的TypeScript类型支持
- **扩展性**: 支持自定义排序和验证规则

## 🔧 高级用法

### 自定义卡牌验证

```typescript
import { validateCardSet } from './utils/cardData';

const cards = generateCards(6);
const validation = validateCardSet(cards);

if (!validation.isValid) {
  console.error('卡牌验证失败:', validation.errors);
}
```

### 级数建议系统

```typescript
import { suggestBestRank } from './utils/rankUtils';

// 基于手牌建议最佳级数
const handCards = playerHands[0];
const suggestions = suggestBestRank(handCards);
console.log('建议级数:', suggestions.slice(0, 3)); // 前3个建议
```

### 卡牌比较和排序

```typescript
import { compareCards, getCardOrderValue } from './utils/rankUtils';

const card1 = { suit: 'hearts', rank: 5, ... };
const card2 = { suit: 'spades', rank: 5, ... };

// 比较两张牌的大小
const comparison = compareCards(card1, card2, 5);
console.log(comparison > 0 ? 'card1更大' : 'card2更大');

// 获取具体排序值
console.log(`card1排序值: ${getCardOrderValue(card1, 5)}`);
console.log(`card2排序值: ${getCardOrderValue(card2, 5)}`);
```

## 📋 API 参考

### cardData.ts 导出函数
- `generateCards(currentRank)` - 生成108张牌
- `shuffleCards(cards)` - 洗牌
- `sortCardsByGuandanRule(cards, currentRank)` - 掼蛋排序
- `dealCardsToPlayers(cards)` - 发牌
- `analyzeCardDistribution(cards, currentRank)` - 分析分布
- `validateCardSet(cards)` - 验证卡牌组合
- `updateCardRankStatus(cards, newRank)` - 更新级牌状态

### rankUtils.ts 导出函数
- `isValidRank(rank)` - 验证级数
- `getRankName(rank)` - 获取显示名称
- `getNextRank(currentRank)` - 获取下一级数
- `getPreviousRank(currentRank)` - 获取上一级数
- `isRankCard(card, currentRank)` - 判断级牌
- `isWildCard(card, currentRank)` - 判断配牌
- `isJoker(card)` - 判断王牌
- `getCardOrderValue(card, currentRank)` - 计算排序值
- `compareCards(card1, card2, currentRank)` - 比较卡牌
- `countRankCards(cards, currentRank)` - 统计级牌
- `suggestBestRank(cards)` - 建议级数

### constants.ts 导出常量
- `GAME_CONFIG` - 游戏基础配置
- `RANK_CONFIG` - 级数配置
- `VALID_RANKS` - 有效级数数组
- `RANK_DISPLAY_NAMES` - 级数显示名称
- `SUIT_SYMBOLS` - 花色符号
- `DEFAULT_PLAYER_NAMES` - 默认玩家名称
- `TEAM_CONFIG` - 队伍配置

## ✨ 总结

这套工具函数库完全满足了掼蛋记牌器的所有需求：

1. ✅ **动态级牌识别** - 根据 `currentRank` 自动标记 `isRankCard`
2. ✅ **配牌自动标识** - 红心级牌自动标记为 `isWildCard`
3. ✅ **级数范围2-A** - 支持完整的2-14级数循环
4. ✅ **完整108张牌** - 双副牌包含所有牌型
5. ✅ **类型安全** - 完整的TypeScript类型支持
6. ✅ **高性能** - 优化的算法和数据结构
7. ✅ **易于使用** - 清晰的API和完整的文档

可以直接在掼蛋记牌器项目中使用这些工具函数，无需修改即可满足所有功能需求。