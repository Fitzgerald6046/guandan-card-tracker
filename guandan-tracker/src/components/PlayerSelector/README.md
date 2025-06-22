# PlayerSelector 组件

增强的玩家选择器组件，专为掼蛋游戏设计，支持队伍显示、统计信息和快速切换功能。

## 功能特性

### 👥 队伍显示
- **明确分组**: 1队（上下）vs 2队（左右）清晰划分
- **颜色主题**: 蓝色主题（1队）和绿色主题（2队）区分
- **队伍总分**: 显示每队的累计胜利次数
- **队伍成员**: 显示每队的玩家数量

### 📊 统计信息
- **牌数统计**: 每个玩家的总牌数和剩余牌数
- **级牌统计**: 级牌和配牌数量实时显示
- **大小王**: 大小王拥有情况统计
- **普通牌**: 普通牌数量统计
- **胜利记录**: 显示每个玩家的胜利次数

### ⚡ 快速切换
- **点击选择**: 直接点击玩家卡片选择
- **键盘快捷键**: 数字键1-4快速选择对应玩家
- **队友切换**: 左右箭头键在队友间快速切换
- **滑动切换**: 支持滑动手势切换队友

## 基础用法

```tsx
import { PlayerSelector } from './components/PlayerSelector';

function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player>();

  return (
    <PlayerSelector
      players={players}
      currentPlayer={currentPlayer}
      currentRank={7}
      onPlayerSelect={setCurrentPlayer}
    />
  );
}
```

## Props API

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `players` | `Player[]` | **必需** | 玩家数据数组 |
| `currentPlayer` | `Player \| undefined` | - | 当前选中的玩家 |
| `currentRank` | `GameRank` | **必需** | 当前级数 (2-14) |
| `showDetailedStats` | `boolean` | `true` | 是否显示详细统计信息 |
| `showTeamScores` | `boolean` | `true` | 是否显示队伍总分 |
| `enableKeyboardShortcuts` | `boolean` | `true` | 是否启用键盘快捷键 |
| `className` | `string` | `''` | 自定义样式类名 |
| `onPlayerSelect` | `(player: Player) => void` | - | 玩家选择事件 |
| `onTeamSwitch` | `(team: Team) => void` | - | 队伍切换事件 |
| `onKeyboardShortcut` | `(key: string, player?: Player) => void` | - | 键盘快捷键事件 |

### Player 类型定义

```tsx
interface Player {
  id: string;                    // 玩家唯一标识
  name: string;                  // 玩家姓名
  position: PlayerPosition;      // 玩家位置 ('bottom'|'left'|'top'|'right')
  team: Team;                    // 所属队伍 (1|2)
  cards: Card[];                 // 手牌列表
  remainingCount: number;        // 剩余牌数
  isCurrentPlayer: boolean;      // 是否为当前出牌玩家
  stats: PlayerStats;            // 玩家统计信息
}

interface PlayerStats {
  playedCards: number;           // 本局已出牌数
  rankCardCount: number;         // 级牌数量
  wildCardCount: number;         // 配牌数量
  roundWins: number;             // 本局获胜次数
}
```

## 队伍配置

### 队伍分组规则
```
1队（上下队）:
- 下方玩家 (bottom) - 自己
- 上方玩家 (top)   - 对家

2队（左右队）:
- 左方玩家 (left)  - 左邻居
- 右方玩家 (right) - 右邻居
```

### 队伍主题色彩
```css
/* 1队（蓝色主题） */
.team-1 {
  color: text-blue-600;
  background: bg-blue-50;
  border: border-blue-200;
}

/* 2队（绿色主题） */
.team-2 {
  color: text-green-600;
  background: bg-green-50;
  border: border-green-200;
}
```

## 统计信息详解

### 牌数统计
- **总牌数**: 玩家当前持有的所有卡牌数量
- **剩余牌数**: 未出的牌数（等于总牌数）
- **已出牌数**: 本局已经出掉的牌数

### 特殊牌统计
- **配牌**: 红心级牌数量（权重最高）
- **级牌**: 当前级数的其他花色牌数量
- **大小王**: 大王和小王的数量
- **普通牌**: 除了级牌、配牌、大小王之外的普通牌

### 胜利统计
- **胜利次数**: 该玩家在本局游戏中的胜利次数
- **胜利图标**: 使用🏆图标直观显示

## 交互操作

### 鼠标操作
```tsx
// 点击选择玩家
<PlayerCard onClick={() => onPlayerSelect(player)} />

// 悬停高亮效果
<PlayerCard onMouseEnter={() => setHovered(true)} />

// 队伍切换
<TeamButton onClick={() => onTeamSwitch(team)} />
```

### 键盘快捷键
```tsx
// 数字键1-4选择玩家
window.addEventListener('keydown', (e) => {
  if (['1', '2', '3', '4'].includes(e.key)) {
    const playerIndex = parseInt(e.key) - 1;
    selectPlayer(players[playerIndex]);
  }
});

// 左右箭头切换队友
if (e.key === 'ArrowLeft') switchToTeammate('prev');
if (e.key === 'ArrowRight') switchToTeammate('next');
```

### 防冲突机制
- 在输入框（input/textarea）中不会触发快捷键
- 快捷键事件会调用 `preventDefault()` 防止默认行为

## 高级用法

### 完整功能示例
```tsx
function GameInterface() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player>();
  const [currentRank, setCurrentRank] = useState<GameRank>(7);

  const handlePlayerSelect = (player: Player) => {
    setCurrentPlayer(player);
    // 切换到该玩家的视角
    switchPlayerView(player);
  };

  const handleTeamSwitch = (team: Team) => {
    // 队伍视图切换逻辑
    console.log(`切换到队伍 ${team}`);
  };

  const handleKeyboardShortcut = (key: string, player?: Player) => {
    // 记录快捷键操作
    logUserAction(`键盘快捷键: ${key}`, player);
  };

  return (
    <div className="game-interface">
      <PlayerSelector
        players={players}
        currentPlayer={currentPlayer}
        currentRank={currentRank}
        showDetailedStats={true}
        showTeamScores={true}
        enableKeyboardShortcuts={true}
        onPlayerSelect={handlePlayerSelect}
        onTeamSwitch={handleTeamSwitch}
        onKeyboardShortcut={handleKeyboardShortcut}
        className="mb-6"
      />
    </div>
  );
}
```

### 自定义统计显示
```tsx
function CustomPlayerSelector() {
  const [showStats, setShowStats] = useState(true);

  return (
    <div>
      <div className="controls mb-4">
        <label>
          <input
            type="checkbox"
            checked={showStats}
            onChange={(e) => setShowStats(e.target.checked)}
          />
          显示详细统计
        </label>
      </div>
      
      <PlayerSelector
        players={players}
        currentPlayer={currentPlayer}
        currentRank={currentRank}
        showDetailedStats={showStats}
      />
    </div>
  );
}
```

### 队伍比分集成
```tsx
function TeamScoreBoard() {
  const [teamScores, setTeamScores] = useState({ team1: 0, team2: 0 });

  const handleTeamSwitch = (team: Team) => {
    // 显示该队伍的详细信息
    showTeamDetails(team);
  };

  return (
    <PlayerSelector
      players={players}
      currentPlayer={currentPlayer}
      currentRank={currentRank}
      showTeamScores={true}
      onTeamSwitch={handleTeamSwitch}
    />
  );
}
```

## 样式定制

### CSS 变量
```css
.player-selector {
  --team1-color: #2563eb;      /* 1队主色 */
  --team1-bg: #eff6ff;         /* 1队背景 */
  --team1-border: #bfdbfe;     /* 1队边框 */
  
  --team2-color: #059669;      /* 2队主色 */
  --team2-bg: #ecfdf5;         /* 2队背景 */
  --team2-border: #a7f3d0;     /* 2队边框 */
  
  --selected-ring: #3b82f6;    /* 选中环圈颜色 */
  --hover-scale: 1.05;         /* 悬停缩放比例 */
}
```

### 自定义主题
```tsx
<PlayerSelector
  className="dark:bg-gray-800 dark:border-gray-600"
  players={players}
  currentPlayer={currentPlayer}
  currentRank={currentRank}
/>
```

## 响应式设计

### 断点规则
```css
/* 小屏设备 */
@media (max-width: 768px) {
  .player-grid {
    grid-template-columns: 1fr;  /* 单列显示 */
  }
}

/* 中等屏幕 */
@media (min-width: 768px) {
  .player-grid {
    grid-template-columns: 1fr 1fr;  /* 双列显示 */
  }
}

/* 大屏幕 */
@media (min-width: 1024px) {
  .player-grid {
    grid-template-columns: 1fr 1fr;  /* 保持双列 */
  }
}
```

### 移动端优化
- 触摸友好的点击区域（最小44px）
- 悬停效果在移动端自动禁用
- 滑动手势支持队友切换

## 性能优化

### 渲染优化
```tsx
// 使用 useMemo 缓存计算结果
const teamInfo = useMemo(() => {
  return calculateTeamInfo(players);
}, [players]);

// 使用 useCallback 优化事件处理
const handlePlayerSelect = useCallback((player: Player) => {
  onPlayerSelect?.(player);
}, [onPlayerSelect]);
```

### 大量玩家处理
- 虚拟滚动（如超过20个玩家）
- 按需渲染详细统计信息
- 防抖处理频繁的状态更新

## 可访问性

### 键盘导航
- Tab键在可交互元素间导航
- Enter/Space激活按钮
- 箭头键切换队友

### 屏幕阅读器
```tsx
<div
  role="button"
  aria-label={`选择玩家 ${player.name}`}
  tabIndex={0}
>
  {player.name}
</div>
```

### 视觉反馈
- 高对比度的颜色搭配
- 清晰的焦点指示器
- 动画效果可关闭选项

## 注意事项

1. **数据完整性**: 确保 Player 对象包含所有必需字段
2. **键盘冲突**: 在有输入框的页面中注意快捷键冲突
3. **性能影响**: 大量玩家时考虑使用虚拟滚动
4. **移动端**: 确保触摸区域足够大
5. **状态同步**: 及时更新玩家状态和统计信息

## 常见问题

**Q: 如何自定义队伍分组规则？**
A: 修改 `teamInfo` 的计算逻辑，或在外部预处理玩家数据。

**Q: 键盘快捷键与其他组件冲突怎么办？**
A: 设置 `enableKeyboardShortcuts={false}` 或添加更精细的冲突检测。

**Q: 如何添加更多统计信息？**
A: 扩展 `PlayerStats` 接口和 `getPlayerStats` 函数。

**Q: 支持超过4个玩家吗？**
A: 支持，组件会自动适应任意数量的玩家，但建议不超过8个以保证良好体验。 