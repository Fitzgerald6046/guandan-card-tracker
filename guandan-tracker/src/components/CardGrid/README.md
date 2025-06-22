# CardGrid 组件

智能的卡牌网格显示组件，专为掼蛋游戏设计，支持智能排序、分组显示、快速定位和批量操作。

## 功能特性

### 🧠 智能排序
- 使用 `getCardOrderValue` 按掼蛋规则排序
- 配牌（红心级牌）权重最高，优先显示
- 级牌权重次高
- 大小王单独显示
- 支持降序排列，高牌在前

### 📊 分组显示
- **按数值分组** (`rank`): 相同数值的卡牌分为一组，显示级牌标识
- **按花色分组** (`suit`): 红心、方块、梅花、黑桃分别分组
- **按级牌分组** (`level`): 配牌、级牌、大小王、普通牌分别分组

### 🎯 快速定位
- "跳转到级牌"按钮，快速定位到重要卡牌
- 滚动时显示当前区域提示
- 平滑滚动动画

### ✋ 批量操作
- 长按500ms进入多选模式
- 支持全选/反选操作
- 显示选中数量统计
- 选中卡牌高亮显示

## 基础用法

```tsx
import { CardGrid } from './components/CardGrid';

function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);

  return (
    <CardGrid
      cards={cards}
      currentRank={7}
      onSelectionChange={setSelectedCards}
    />
  );
}
```

## Props API

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `cards` | `Card[]` | **必需** | 卡牌数据数组 |
| `currentRank` | `GameRank` | **必需** | 当前级数 (2-14) |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 卡牌显示尺寸 |
| `groupBy` | `'rank' \| 'suit' \| 'level'` | `'rank'` | 分组显示方式 |
| `allowMultiSelect` | `boolean` | `false` | 是否允许多选模式 |
| `showControls` | `boolean` | `true` | 是否显示控制栏 |
| `showStats` | `boolean` | `true` | 是否显示统计信息 |
| `className` | `string` | `''` | 自定义样式类名 |
| `onCardClick` | `(card: Card) => void` | - | 卡牌点击事件 |
| `onCardLongPress` | `(card: Card) => void` | - | 卡牌长按事件 |
| `onSelectionChange` | `(cards: Card[]) => void` | - | 选择变更事件 |
| `getCardOwnerTeam` | `(card: Card) => Team \| undefined` | - | 获取卡牌归属队伍 |
| `getCardOwners` | `(card: Card) => OwnerInfo[] \| undefined` | - | 获取多拥有者信息 |

### 类型定义

```tsx
type GroupByOption = 'rank' | 'suit' | 'level';

interface OwnerInfo {
  team: Team;              // 队伍编号 (1|2)
  position: PlayerPosition; // 玩家位置
  count: number;           // 拥有数量
}
```

## 卡牌尺寸规格

| 尺寸 | 像素大小 | 网格列数 | 适用场景 |
|------|----------|----------|----------|
| `small` | 32×48px | 8-16列 | 小屏设备，大量卡牌 |
| `medium` | 48×72px | 6-12列 | 常规桌面显示 |
| `large` | 80×112px | 4-8列 | 大屏幕，详细查看 |

## 分组模式详解

### 按数值分组 (rank)
```
配牌 (2)    - 红心级牌
级牌 (4)    - 当前级数的其他花色
A (6)       - A的所有花色
K (8)       - K的所有花色
...
大小王 (4)  - 两张大王，两张小王
```

### 按花色分组 (suit)
```
♥ 红心 (13) - 所有红心牌
♦ 方块 (13) - 所有方块牌
♣ 梅花 (13) - 所有梅花牌
♠ 黑桃 (13) - 所有黑桃牌
大小王 (4)  - 大小王
```

### 按级牌分组 (level)
```
配牌 (2)    - 红心级牌（权重最高）
级牌 (6)    - 其他花色级牌
大小王 (4)  - 大小王
普通牌 (96) - 其他所有牌
```

## 统计信息显示

组件顶部显示五个统计卡片：

- **配牌**: 红心级牌数量（红色）
- **级牌**: 非红心级牌数量（黄色）
- **大小王**: 王牌数量（紫色）
- **普通牌**: 其他卡牌数量（灰色）
- **已选择**: 当前选中数量（蓝色）

## 交互操作

### 单选模式
- **点击**: 触发 `onCardClick` 事件
- **长按**: 如果启用多选，进入多选模式

### 多选模式
- **点击**: 切换卡牌选中状态
- **全选/反选**: 批量操作所有卡牌
- **退出**: 清空选择并退出多选模式

### 键盘操作
- **Tab**: 在分组按钮间切换焦点
- **Space/Enter**: 激活当前按钮
- **Escape**: 退出多选模式

## 高级用法

### 自定义分组切换
```tsx
const [groupBy, setGroupBy] = useState<GroupByOption>('rank');

// 监听分组变更事件
useEffect(() => {
  const handleGroupChange = (event: CustomEvent) => {
    setGroupBy(event.detail);
  };

  window.addEventListener('groupByChange', handleGroupChange);
  return () => window.removeEventListener('groupByChange', handleGroupChange);
}, []);

<CardGrid
  cards={cards}
  currentRank={currentRank}
  groupBy={groupBy}
/>
```

### 队伍归属显示
```tsx
const getCardOwnerTeam = (card: Card): Team | undefined => {
  // 根据游戏状态返回卡牌归属队伍
  return gameState.getCardOwner(card.id);
};

const getCardOwners = (card: Card) => {
  // 处理多玩家共有卡牌的情况
  return gameState.getCardOwners(card.id);
};

<CardGrid
  cards={cards}
  currentRank={currentRank}
  getCardOwnerTeam={getCardOwnerTeam}
  getCardOwners={getCardOwners}
/>
```

### 完整功能示例
```tsx
function GameBoard() {
  const [cards, setCards] = useState<Card[]>([]);
  const [currentRank, setCurrentRank] = useState<GameRank>(7);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);

  const handleCardClick = (card: Card) => {
    if (!card.isPlayed) {
      // 处理卡牌出牌逻辑
      playCard(card);
    }
  };

  const handleSelectionChange = (selected: Card[]) => {
    setSelectedCards(selected);
    // 可以实现批量操作，如批量出牌
  };

  return (
    <div className="h-screen">
      <CardGrid
        cards={cards}
        currentRank={currentRank}
        size="medium"
        groupBy="level"
        allowMultiSelect={true}
        showControls={true}
        showStats={true}
        onCardClick={handleCardClick}
        onSelectionChange={handleSelectionChange}
        getCardOwnerTeam={getCardOwnerTeam}
        className="h-full"
      />
    </div>
  );
}
```

## 性能优化

### 大量卡牌处理
- 使用 `React.memo` 优化卡牌组件重渲染
- `useMemo` 缓存分组和排序结果
- 虚拟滚动（如需要）

### 内存管理
- 及时清理长按定时器
- 使用 `useCallback` 优化事件处理函数
- 合理使用 `useEffect` 依赖项

## 样式定制

### CSS 变量
```css
.card-grid {
  --card-gap: 12px;
  --section-spacing: 24px;
  --border-radius: 8px;
  --shadow-color: rgba(0, 0, 0, 0.1);
}
```

### 自定义主题
```tsx
<CardGrid
  className="custom-grid dark:bg-gray-800"
  cards={cards}
  currentRank={currentRank}
/>
```

## 注意事项

1. **性能**: 大量卡牌时建议使用 `small` 尺寸
2. **触摸**: 长按时间设为500ms，确保良好的移动端体验
3. **可访问性**: 支持键盘导航和屏幕阅读器
4. **内存**: 及时清理事件监听器和定时器
5. **数据**: 确保卡牌数据包含必需的 `id`、`rank`、`suit` 字段

## 常见问题

**Q: 如何自定义排序规则？**
A: 修改 `rankUtils.ts` 中的 `getCardOrderValue` 函数，或在组件外部预排序。

**Q: 多选模式下如何实现批量操作？**
A: 监听 `onSelectionChange` 事件，根据选中的卡牌数组实现相应逻辑。

**Q: 如何处理卡牌数据更新？**
A: 组件会自动响应 `cards` prop 的变化，重新计算分组和排序。

**Q: 支持自定义分组吗？**
A: 可以扩展 `GroupByOption` 类型和 `groupCards` 函数来支持更多分组方式。 