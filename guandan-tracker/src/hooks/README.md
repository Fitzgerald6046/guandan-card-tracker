# useGameState Hook 使用文档

完整的掼蛋游戏状态管理Hook，使用useReducer实现状态管理，支持自动保存和统计功能。

## 🎯 功能特性

### ✅ 核心功能
- **完整状态管理** - 使用useReducer管理所有游戏状态
- **自动级牌识别** - 切换级数时自动重新生成卡牌数据
- **本地存储** - 自动保存状态到localStorage
- **实时统计** - 提供详细的统计信息和缓存优化
- **便捷选择器** - 多种数据查询函数

### ✅ 支持的Actions
- `SET_RANK` - 设置当前级数
- `SELECT_PLAYER` - 选择当前玩家
- `TOGGLE_CARD` - 切换单张卡牌归属
- `BATCH_TOGGLE_CARDS` - 批量切换卡牌归属
- `RESET_GAME` - 重置游戏（可保留级数）
- `UPDATE_PLAYER` - 更新玩家信息

### ✅ 便捷函数
- `getTeamCards(team)` - 获取某队伍的所有卡牌
- `getRankCards()` - 获取所有级牌
- `getWildCards()` - 获取所有配牌

## 🚀 快速开始

### 基础使用

```typescript
import { useGameState } from './hooks/useGameState';

function GameComponent() {
  // 初始化游戏状态（可指定初始级数）
  const gameState = useGameState(5); // 默认级数为5
  
  const {
    // 基础状态
    currentRank,          // 当前级数
    nextRank,             // 下一级数
    selectedPlayer,       // 当前选中玩家
    cards,                // 所有卡牌
    players,              // 玩家信息
    stats,                // 统计信息
    gameInfo,             // 游戏信息
    
    // 操作函数
    setRank,              // 设置级数
    selectPlayer,         // 选择玩家
    toggleCard,           // 切换卡牌归属
    batchToggleCards,     // 批量切换
    resetGame,            // 重置游戏
    updatePlayer,         // 更新玩家
    
    // 选择器函数
    getTeamCards,         // 获取队伍卡牌
    getRankCards,         // 获取级牌
    getWildCards,         // 获取配牌
    getPlayerCards        // 获取玩家卡牌
  } = gameState;

  return (
    <div>
      <h2>当前级数: {gameInfo.currentRankName}</h2>
      <p>总卡牌: {cards.length}张</p>
      <p>配牌: {stats.wildCardStats.total}张</p>
      {/* 其他UI组件 */}
    </div>
  );
}
```

## 📚 详细API文档

### 状态属性

#### 基础状态
```typescript
interface GameState {
  currentRank: GameRank;           // 当前级数 (2-14)
  nextRank: GameRank;              // 下一级数
  selectedPlayer: PlayerPosition;  // 当前选中玩家
  cards: Card[];                   // 所有卡牌数据(108张)
  players: Player[];               // 玩家信息(4人)
  cardOwnership: Record<string, PlayerPosition>; // 卡牌归属映射
  createdAt: number;               // 创建时间
  updatedAt: number;               // 更新时间
}
```

#### 统计信息
```typescript
interface GameStats {
  totalCards: number;                              // 总卡牌数
  playerCardCounts: Record<PlayerPosition, number>; // 各玩家卡牌数
  teamCardCounts: Record<Team, number>;            // 各队伍卡牌数
  rankCardStats: {                                 // 级牌统计
    total: number;
    byPlayer: Record<PlayerPosition, number>;
    byTeam: Record<Team, number>;
  };
  wildCardStats: { /* 配牌统计 */ };
  jokerStats: { /* 王牌统计 */ };
}
```

#### 游戏信息
```typescript
interface GameInfo {
  currentRankName: string;    // 当前级数显示名称
  nextRankName: string;       // 下一级数显示名称
  totalAssignedCards: number; // 已分配卡牌数
  totalUnassignedCards: number; // 未分配卡牌数
  isComplete: boolean;        // 是否分配完成
}
```

### Action函数

#### `setRank(rank: GameRank)`
设置当前级数，自动重新生成卡牌数据。

```typescript
// 设置级数为8
setRank(8);

// 级数会从2循环到14，然后回到2
setRank(14); // A
// nextRank 自动变为 2
```

**特殊逻辑：**
- ✅ 自动重新生成108张牌
- ✅ 保持现有卡牌归属关系
- ✅ 自动更新级牌和配牌标识
- ✅ 清除统计缓存

#### `selectPlayer(position: PlayerPosition)`
选择当前操作的玩家。

```typescript
import { PlayerPosition } from '../types/game';

selectPlayer(PlayerPosition.BOTTOM); // 选择底部玩家
selectPlayer(PlayerPosition.LEFT);   // 选择左侧玩家
selectPlayer(PlayerPosition.TOP);    // 选择顶部玩家
selectPlayer(PlayerPosition.RIGHT);  // 选择右侧玩家
```

#### `toggleCard(cardId: string)`
切换单张卡牌的归属。

```typescript
// 如果卡牌未分配或属于其他玩家，分配给当前选中玩家
// 如果卡牌已属于当前选中玩家，取消分配
toggleCard('hearts_5_abc123');
```

#### `batchToggleCards(cardIds: string[])`
批量切换多张卡牌的归属。

```typescript
// 批量分配配牌给当前玩家
const wildCards = getWildCards();
const wildCardIds = wildCards.map(card => card.id);
batchToggleCards(wildCardIds);

// 智能切换：如果所有卡牌都属于当前玩家，则全部取消分配
// 否则，将所有卡牌分配给当前玩家
```

#### `resetGame(preserveRank?: boolean)`
重置游戏状态。

```typescript
resetGame(true);  // 重置游戏，保留当前级数
resetGame(false); // 重置游戏，级数回到2
resetGame();      // 默认保留级数
```

**重置内容：**
- ✅ 清除所有卡牌归属
- ✅ 重新生成卡牌数据
- ✅ 保留玩家自定义名称
- ✅ 重置选中状态

#### `updatePlayer(position: PlayerPosition, updates: Partial<Player>)`
更新玩家信息。

```typescript
// 更新玩家名称
updatePlayer(PlayerPosition.BOTTOM, { name: '张三' });

// 可以更新的属性：name（其他属性如position、team自动管理）
```

### 选择器函数

#### `getTeamCards(team: Team): Card[]`
获取某队伍的所有卡牌。

```typescript
// 获取队伍1(上下)的所有卡牌
const team1Cards = getTeamCards(1);

// 获取队伍2(左右)的所有卡牌  
const team2Cards = getTeamCards(2);

console.log(`队伍1有${team1Cards.length}张牌`);
```

#### `getRankCards(): Card[]`
获取所有级牌（包含配牌）。

```typescript
const rankCards = getRankCards();

// 过滤出非配牌的级牌
const nonWildRankCards = rankCards.filter(card => !card.isWildCard);

console.log(`总级牌: ${rankCards.length}张`);
console.log(`普通级牌: ${nonWildRankCards.length}张`);
```

#### `getWildCards(): Card[]`
获取所有配牌（红心级牌）。

```typescript
const wildCards = getWildCards();

// 配牌总是红心花色的级牌
wildCards.forEach(card => {
  console.log(`配牌: ♥${card.rank}`);
  console.log(card.isWildCard); // 总是 true
  console.log(card.suit);       // 总是 'hearts'
});
```

#### 其他选择器

```typescript
// 获取特定玩家的卡牌
const bottomPlayerCards = getPlayerCards(PlayerPosition.BOTTOM);

// 获取未分配的卡牌
const unassignedCards = getUnassignedCards();

// 获取当前选中的卡牌
const selectedCards = getSelectedCards();

// 获取当前玩家信息
const currentPlayer = getCurrentPlayer();

// 获取队伍玩家
const team1Players = getTeamPlayers(1);
```

## 🎯 使用场景

### 场景1: 初始化游戏

```typescript
function InitGame() {
  const { setRank, updatePlayer, gameInfo } = useGameState();
  
  const handleStart = () => {
    // 设置级数
    setRank(8);
    
    // 设置玩家名称
    updatePlayer(PlayerPosition.BOTTOM, { name: '我' });
    updatePlayer(PlayerPosition.LEFT, { name: '左方' });
    updatePlayer(PlayerPosition.TOP, { name: '上方' });
    updatePlayer(PlayerPosition.RIGHT, { name: '右方' });
  };
  
  return (
    <div>
      <h2>当前级数: {gameInfo.currentRankName}</h2>
      <button onClick={handleStart}>开始游戏</button>
    </div>
  );
}
```

### 场景2: 卡牌分配界面

```typescript
function CardAssignment() {
  const { 
    cards, 
    selectedPlayer, 
    selectPlayer, 
    toggleCard,
    batchToggleCards,
    getPlayerCards,
    getRankCards,
    getWildCards 
  } = useGameState();
  
  const handleCardClick = (cardId: string) => {
    toggleCard(cardId);
  };
  
  const handleAssignAllRankCards = () => {
    const rankCards = getRankCards();
    batchToggleCards(rankCards.map(card => card.id));
  };
  
  const handleAssignAllWildCards = () => {
    const wildCards = getWildCards();
    batchToggleCards(wildCards.map(card => card.id));
  };
  
  return (
    <div>
      {/* 玩家选择 */}
      <PlayerSelector 
        selectedPlayer={selectedPlayer}
        onSelect={selectPlayer}
      />
      
      {/* 快速分配按钮 */}
      <button onClick={handleAssignAllRankCards}>
        分配所有级牌
      </button>
      <button onClick={handleAssignAllWildCards}>
        分配所有配牌
      </button>
      
      {/* 卡牌网格 */}
      <div className="card-grid">
        {cards.map(card => (
          <CardComponent
            key={card.id}
            card={card}
            onClick={() => handleCardClick(card.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

### 场景3: 统计显示

```typescript
function GameStats() {
  const { stats, players, getTeamCards } = useGameState();
  
  return (
    <div>
      <h3>游戏统计</h3>
      
      {/* 各玩家统计 */}
      {players.map(player => {
        const playerCards = getPlayerCards(player.position);
        const rankCards = stats.rankCardStats.byPlayer[player.position];
        const wildCards = stats.wildCardStats.byPlayer[player.position];
        
        return (
          <div key={player.id}>
            <h4>{player.name}</h4>
            <p>总计: {playerCards.length}张</p>
            <p>级牌: {rankCards}张</p>
            <p>配牌: {wildCards}张</p>
          </div>
        );
      })}
      
      {/* 队伍统计 */}
      <div>
        <h4>队伍统计</h4>
        <p>队伍1: {stats.teamCardCounts[1]}张</p>
        <p>队伍2: {stats.teamCardCounts[2]}张</p>
      </div>
    </div>
  );
}
```

### 场景4: 级数变更

```typescript
function RankSelector() {
  const { currentRank, nextRank, setRank, gameInfo } = useGameState();
  
  const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as GameRank[];
  
  return (
    <div>
      <h3>选择级数</h3>
      <p>当前: {gameInfo.currentRankName}</p>
      <p>下一级: {gameInfo.nextRankName}</p>
      
      <div className="rank-buttons">
        {ranks.map(rank => (
          <button
            key={rank}
            className={rank === currentRank ? 'active' : ''}
            onClick={() => setRank(rank)}
          >
            {getRankName(rank)}
          </button>
        ))}
      </div>
    </div>
  );
}
```

## 🔧 高级特性

### 本地存储

状态会自动保存到localStorage，页面刷新后会自动恢复：

```typescript
// 保存的数据包括：
{
  currentRank: number,        // 当前级数
  selectedPlayer: string,     // 选中玩家
  cardOwnership: object,      // 卡牌归属
  players: array,             // 玩家信息
  updatedAt: number          // 更新时间
}

// 存储键名：'guandan_game_state'
```

### 统计缓存

统计信息会被缓存以提高性能：

```typescript
// 缓存机制：
// 1. 首次计算后缓存结果
// 2. 状态变更时自动清除缓存
// 3. 下次访问时重新计算并缓存
```

### 防抖保存

状态变更后会延迟500ms保存，避免频繁写入：

```typescript
// 防抖逻辑：
useEffect(() => {
  const timeoutId = setTimeout(() => {
    saveToLocalStorage(state);
  }, 500);
  
  return () => clearTimeout(timeoutId);
}, [state.currentRank, state.selectedPlayer, state.cardOwnership]);
```

## 🐛 注意事项

1. **级数变更**：级数变更会重新生成卡牌，但会尽量保持归属关系
2. **内存管理**：统计信息会被缓存，大量操作时建议适当清除缓存
3. **本地存储**：localStorage失败时会在控制台显示警告但不影响功能
4. **类型安全**：所有参数都有严格的TypeScript类型检查

## 📋 类型定义

```typescript
// Hook返回类型
export type UseGameStateReturn = {
  // 状态
  state: GameState;
  stats: GameStats;
  gameInfo: GameInfo;
  
  // Actions
  setRank: (rank: GameRank) => void;
  selectPlayer: (position: PlayerPosition) => void;
  toggleCard: (cardId: string) => void;
  batchToggleCards: (cardIds: string[]) => void;
  resetGame: (preserveRank?: boolean) => void;
  updatePlayer: (position: PlayerPosition, updates: Partial<Player>) => void;
  
  // 选择器
  getTeamCards: (team: Team) => Card[];
  getRankCards: () => Card[];
  getWildCards: () => Card[];
  // ... 更多选择器
  
  // 便捷属性
  currentRank: GameRank;
  nextRank: GameRank;
  selectedPlayer: PlayerPosition;
  players: Player[];
  cards: Card[];
  cardOwnership: Record<string, PlayerPosition>;
};
```

这个Hook提供了完整的掼蛋游戏状态管理功能，支持所有要求的特性，并具有良好的性能和用户体验。