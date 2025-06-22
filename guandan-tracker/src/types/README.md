# 掼蛋记牌器类型系统文档

## 概述

这是掼蛋记牌器的完整TypeScript类型系统，设计用于提供类型安全的游戏开发体验。

## 🎯 核心特性

### 1. Card接口 - 支持级牌标识

```typescript
interface Card {
  id: string;
  suit: Suit | null;        // 花色（王牌为null）
  rank: Rank;               // 牌面数值（2-16）
  isRankCard: boolean;      // 是否为级牌（动态识别）
  isWildCard: boolean;      // 是否为配牌（红心级牌）
  isPlayed: boolean;        // 是否已出牌
  isSelected: boolean;      // 是否被选中
  position?: number;        // 位置索引
  timestamp: number;        // 创建时间戳
}
```

**特点：**
- `isRankCard`: 根据`currentRank`动态判断是否为级牌
- `isWildCard`: 红心级牌自动标记为配牌
- 数值化的`Rank`(2-16)便于比较和计算

### 2. Player接口 - 包含队伍信息

```typescript
interface Player {
  id: string;
  name: string;
  position: PlayerPosition;  // 玩家位置
  team: Team;               // 队伍（1 | 2）
  cards: Card[];
  remainingCount: number;
  isCurrentPlayer: boolean;
  stats: PlayerStats;       // 统计信息
}

type Team = 1 | 2;  // 简化队伍表示：1队（上下），2队（左右）
```

### 3. GameState接口 - 完整游戏状态

```typescript
interface GameState {
  gameId: string;
  status: GameStatus;
  config: GameConfig;
  players: Player[];
  currentPlayerPosition: PlayerPosition;
  currentRank: GameRank;    // 当前级数（2-14）
  allCards: Card[];
  playHistory: PlayRecord[];
  currentRound: RoundInfo;
  createdAt: number;
  updatedAt: number;
}

type GameRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
```

## 🔧 工具函数

### 卡牌创建和管理

```typescript
// 创建卡牌
createCard(params: CreateCardParams): Card

// 生成双副牌
generateDoubleDeck(currentRank: GameRank): Card[]

// 更新级牌状态
updateCardRankStatus(cards: Card[], currentRank: GameRank): Card[]

// 掼蛋规则排序
sortCardsByGuandanRule(cards: Card[], currentRank: GameRank): Card[]
```

### 级数管理

```typescript
// 获取下一级数
getNextRank(current: GameRank): GameRank

// 级数验证
validateRank(rank: number): GameRank

// 类型守卫
isGameRank(value: number): value is GameRank
```

### 类型守卫函数

```typescript
// 检查级牌
isRankCard(card: Card, currentRank: GameRank): boolean

// 检查配牌
isWildCard(card: Card, currentRank: GameRank): boolean

// 检查王牌
isJoker(card: Card): boolean

// 检查红心
isHearts(card: Card): boolean
```

## 🎮 Hook系统

### useGameState - 游戏状态管理

```typescript
const {
  state,              // 完整游戏状态
  currentPlayer,      // 当前玩家
  bottomPlayer,       // 底部玩家（自己）
  selectedCards,      // 选中的卡牌
  canPlayCards,       // 是否可以出牌
  gameStats,          // 游戏统计
  
  // 动作方法
  setRank,
  startGame,
  playCards,
  selectCard,
  // ... 更多动作
} = useGameState();
```

### useTouchSelect - 触摸选择

```typescript
const {
  touchState,         // 触摸状态
  selectedCards,      // 选中卡牌
  
  // 事件处理
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  
  // 便捷选择器
  selectAllRankCards,
  selectAllWildCards,
  selectSameSuit,
  selectSameRank
} = useTouchSelect();
```

## 📊 常量定义

```typescript
const GAME_CONSTANTS = {
  CARDS_PER_DECK: 54,        // 每副牌数量
  DECK_COUNT: 2,             // 使用牌副数
  TOTAL_CARDS: 108,          // 总牌数
  CARDS_PER_PLAYER: 27,      // 每人牌数
  PLAYER_COUNT: 4,           // 玩家数量
  RANK_RANGE: {
    MIN: 2 as GameRank,
    MAX: 14 as GameRank
  }
};

// 显示名称映射
const RANK_DISPLAY_NAMES: Record<Rank, string> = {
  [Rank.TWO]: '2',
  [Rank.THREE]: '3',
  // ...
  [Rank.ACE]: 'A',
  [Rank.JOKER_SMALL]: '小王',
  [Rank.JOKER_BIG]: '大王'
};

// 花色符号
const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.SPADES]: '♠',
  [Suit.HEARTS]: '♥',
  [Suit.DIAMONDS]: '♦',
  [Suit.CLUBS]: '♣'
};
```

## 🎯 使用示例

### 1. 动态识别级牌

```typescript
const currentRank: GameRank = 5; // 当前级数为5
const cards = generateDoubleDeck(currentRank);

// 所有5都会被标记为级牌
const fiveCards = cards.filter(card => card.isRankCard);

// 红心5会被标记为配牌
const wildCards = cards.filter(card => card.isWildCard);
```

### 2. 红心级牌自动标记

```typescript
const heartsFive = createCard({
  suit: Suit.HEARTS,
  rank: Rank.FIVE,  // 数值5
  currentRank: 5    // 当前级数为5
});

console.log(heartsFive.isRankCard); // true（级牌）
console.log(heartsFive.isWildCard); // true（配牌）
```

### 3. 级数范围验证

```typescript
// 级数范围：2-14（A）
const ranks: GameRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

// 类型安全的级数操作
function setGameRank(rank: GameRank) {
  // 只接受有效的级数
}

setGameRank(5);  // ✅ 有效
setGameRank(15); // ❌ TypeScript错误
```

### 4. 队伍信息

```typescript
const player: Player = {
  id: 'player-1',
  name: '张三',
  position: PlayerPosition.BOTTOM,
  team: 1,  // 队伍1（上下）
  cards: [],
  remainingCount: 27,
  isCurrentPlayer: true,
  stats: {
    playedCards: 0,
    rankCardCount: 8,
    wildCardCount: 2,
    roundWins: 0
  }
};
```

## 🔄 迁移指南

如果你正在从旧的类型系统迁移，请注意以下变更：

### 卡牌属性变更
- `isLevel` → `isRankCard`
- `isRed` → `isWildCard` (仅限红心级牌)
- 新增 `isPlayed` 替代 `isUsed`
- 新增 `timestamp` 和 `position`

### 游戏状态变更
- `GameConfig` → `GameState`
- `level` → `currentRank`
- 队伍从字符串改为数字 `Team = 1 | 2`

### 枚举值变更
- `Rank` 使用数字值（2-16）而非字符串
- 级数范围限制为 `GameRank = 2-14`

## 🛠️ 开发建议

1. **总是使用类型守卫**：
   ```typescript
   if (isRankCard(card, currentRank)) {
     // TypeScript 知道这是级牌
   }
   ```

2. **利用工具函数**：
   ```typescript
   // 好的做法
   const nextRank = getNextRank(currentRank);
   
   // 避免手动计算
   const nextRank = currentRank === 14 ? 2 : currentRank + 1;
   ```

3. **使用 Hook 管理状态**：
   ```typescript
   // 推荐
   const { state, setRank, startGame } = useGameState();
   
   // 避免直接状态操作
   const [gameState, setGameState] = useState(initialState);
   ```

4. **类型安全的事件处理**：
   ```typescript
   const handleCardClick = (card: Card) => {
     if (card.isRankCard) {
       // 级牌特殊处理
     }
   };
   ```

## 📚 进一步阅读

- [游戏规则文档](../docs/game-rules.md)
- [组件开发指南](../docs/component-guide.md)
- [Hook 使用指南](../docs/hooks-guide.md)
- [API 参考文档](../docs/api-reference.md)