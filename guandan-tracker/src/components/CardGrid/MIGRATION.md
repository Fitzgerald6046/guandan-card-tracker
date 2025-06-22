# Card 组件迁移指南

## 从旧版本迁移到优化版本

### 位置变更

**旧位置**: `src/components/Card.tsx`  
**新位置**: `src/components/CardGrid/Card.tsx`

### 导入语句更新

```tsx
// 旧的导入方式
import Card from './components/Card';

// 新的导入方式
import Card from './components/CardGrid/Card';
// 或者
import { Card } from './components/CardGrid';
```

### 属性兼容性

| 旧属性 | 新属性 | 变更说明 |
|--------|--------|----------|
| `card` | `card` | ✅ 完全兼容 |
| `size` | `size` | ✅ 完全兼容 |
| `onClick` | `onClick` | ✅ 完全兼容 |
| `onTouchStart` | `onTouchStart` | ✅ 完全兼容 |
| `onTouchMove` | `onTouchMove` | ✅ 完全兼容 |
| `onTouchEnd` | `onTouchEnd` | ✅ 完全兼容 |
| - | `ownerTeam` | 🆕 新增：队伍归属 |
| - | `ownerPosition` | 🆕 新增：玩家位置 |
| - | `owners` | 🆕 新增：多拥有者 |
| - | `animated` | 🆕 新增：动画控制 |
| - | `className` | 🆕 新增：自定义样式 |

### 卡牌数据接口变更

```tsx
// 旧的卡牌接口（使用 isLevel, isRed）
interface OldCard {
  id: string;
  suit: Suit | null;
  rank: Rank;
  isLevel: boolean;    // ❌ 旧属性
  isRed: boolean;      // ❌ 旧属性
  isSelected: boolean;
  isUsed: boolean;     // ❌ 旧属性
}

// 新的卡牌接口（使用 isRankCard, isWildCard）
interface NewCard {
  id: string;
  suit: Suit | null;
  rank: Rank;
  isRankCard: boolean;  // ✅ 新属性
  isWildCard: boolean;  // ✅ 新属性
  isSelected: boolean;
  isPlayed: boolean;    // ✅ 新属性
  position?: number;
  timestamp: number;
}
```

### 迁移步骤

#### 1. 更新导入语句

```tsx
// 在所有使用Card组件的文件中更新导入
- import Card from './components/Card';
+ import Card from './components/CardGrid/Card';
```

#### 2. 更新卡牌数据结构

```tsx
// 数据转换函数
function migrateCardData(oldCard: OldCard): NewCard {
  return {
    id: oldCard.id,
    suit: oldCard.suit,
    rank: oldCard.rank,
    isRankCard: oldCard.isLevel,      // 级牌标识
    isWildCard: oldCard.isRed,        // 配牌标识
    isSelected: oldCard.isSelected,
    isPlayed: oldCard.isUsed,         // 已使用 -> 已出牌
    timestamp: Date.now()             // 添加时间戳
  };
}

// 批量转换
const newCards = oldCards.map(migrateCardData);
```

#### 3. 添加新功能（可选）

```tsx
// 添加队伍归属显示
<Card
  card={cardData}
  ownerTeam={playerTeam}          // 新增
  animated={true}                 // 新增
/>

// 添加多拥有者显示
<Card
  card={cardData}
  owners={[                       // 新增
    { team: 1, position: 'bottom', count: 2 },
    { team: 2, position: 'top', count: 1 }
  ]}
/>
```

### 样式变更

#### 自动应用的新样式
- ✅ 级牌现在有黄色渐变背景和"级"字标识
- ✅ 红心配牌有特殊渐变背景和"配"字标识
- ✅ 所有卡牌支持悬停缩放效果
- ✅ 选中状态有更明显的视觉反馈

#### 需要适配的样式
如果你有自定义CSS覆盖了卡牌样式，可能需要调整：

```css
/* 旧的自定义样式可能会覆盖新的特殊效果 */
.card-override {
  background: white !important;  /* 可能会覆盖级牌/配牌背景 */
}

/* 建议改为更具体的选择器 */
.card-override:not(.rank-card):not(.wild-card) {
  background: white !important;
}
```

### 兼容性注意事项

#### 1. 动画性能
```tsx
// 在大量卡牌场景下建议关闭动画
<Card
  card={cardData}
  animated={cardCount < 30}  // 根据卡牌数量动态控制
/>
```

#### 2. 触摸区域
新版本保证了最小44px的触摸区域，如果之前有触摸问题，现在应该已修复。

#### 3. 颜色对比度
新版本的级牌和配牌使用了更鲜明的颜色，如果需要调整，可以通过CSS变量：

```css
:root {
  --rank-card-bg: #fef3c7;     /* 级牌背景色 */
  --wild-card-bg: #fce7f3;     /* 配牌背景色 */
  --team-1-color: #3b82f6;     /* 队伍1颜色 */
  --team-2-color: #10b981;     /* 队伍2颜色 */
}
```

### 渐进式迁移

如果你有大量文件需要迁移，可以采用渐进式方法：

#### 1. 创建兼容层
```tsx
// components/Card.tsx (保留旧文件作为兼容层)
import NewCard from './CardGrid/Card';
import type { Card as OldCardType } from './types/old';
import type { Card as NewCardType } from './types';

interface LegacyCardProps {
  card: OldCardType;
  // ... 其他旧属性
}

export default function LegacyCard({ card, ...props }: LegacyCardProps) {
  const newCard: NewCardType = {
    id: card.id,
    suit: card.suit,
    rank: card.rank,
    isRankCard: card.isLevel,
    isWildCard: card.isRed,
    isSelected: card.isSelected,
    isPlayed: card.isUsed,
    timestamp: Date.now()
  };

  return <NewCard card={newCard} {...props} />;
}
```

#### 2. 逐个文件迁移
1. 先迁移类型定义
2. 再迁移数据生成逻辑
3. 最后迁移组件使用

#### 3. 移除兼容层
迁移完成后删除兼容层文件。

### 测试建议

#### 1. 视觉回归测试
- 截图对比旧版本和新版本的渲染效果
- 确保级牌和配牌正确显示特殊样式

#### 2. 交互测试
- 测试点击、触摸事件是否正常
- 测试动画效果是否影响性能

#### 3. 响应式测试
- 测试不同屏幕尺寸下的显示效果
- 测试三种卡牌尺寸的适配

### 常见问题

#### Q: 升级后级牌样式没有显示？
A: 检查卡牌数据是否正确设置了 `isRankCard: true`，旧版本使用的是 `isLevel`。

#### Q: 红心配牌样式没有显示？
A: 确保同时设置了 `isWildCard: true` 和 `suit: Suit.HEARTS`。

#### Q: 动画影响性能怎么办？
A: 设置 `animated={false}` 或根据卡牌数量动态控制。

#### Q: 如何自定义队伍颜色？
A: 可以通过CSS变量或传入自定义 `className` 覆盖默认样式。

### 获取帮助

如果在迁移过程中遇到问题：
1. 查看 `README.md` 了解详细API
2. 查看 `CardDemo.tsx` 了解使用示例
3. 检查浏览器控制台的错误信息 