# RankSelector 组件

## 概述

`RankSelector` 是一个功能丰富的级数选择器组件，专为掼蛋记牌器设计。提供了直观的UI界面来选择和切换游戏级数，支持多种交互方式。

## 功能特性

### 核心功能
- ✅ 显示当前级数（2-A）
- ✅ 下拉菜单选择级数
- ✅ 级数变更确认对话框
- ✅ 高亮显示当前级数
- ✅ 实时统计级牌和配牌数量

### 交互支持
- ✅ 键盘操作（上下箭头键切换）
- ✅ 触摸滑动切换（左右滑动）
- ✅ 点击选择
- ✅ 动画过渡效果

### 移动端友好
- ✅ 响应式设计
- ✅ 触摸友好的界面
- ✅ 适配不同屏幕尺寸

## 使用方法

### 基本用法

```tsx
import React, { useState } from 'react';
import { RankSelector } from './components/RankSelector';
import type { GameRank, Card } from './types';

const MyComponent = () => {
  const [currentRank, setCurrentRank] = useState<GameRank>(2);
  const [allCards, setAllCards] = useState<Card[]>([]);

  const handleRankChange = (newRank: GameRank) => {
    setCurrentRank(newRank);
    // 重新标记级牌等相关逻辑
  };

  return (
    <RankSelector
      currentRank={currentRank}
      onRankChange={handleRankChange}
      allCards={allCards}
    />
  );
};
```

### 带禁用状态

```tsx
<RankSelector
  currentRank={currentRank}
  onRankChange={handleRankChange}
  allCards={allCards}
  disabled={gameInProgress}
/>
```

### 自定义样式

```tsx
<RankSelector
  currentRank={currentRank}
  onRankChange={handleRankChange}
  allCards={allCards}
  className="my-custom-styles"
/>
```

## API 参考

### Props

| 属性名 | 类型 | 必需 | 默认值 | 描述 |
|--------|------|------|--------|------|
| `currentRank` | `GameRank` | ✅ | - | 当前选中的级数 |
| `onRankChange` | `(rank: GameRank) => void` | ✅ | - | 级数变更回调函数 |
| `allCards` | `Card[]` | ❌ | `[]` | 所有卡牌数据，用于统计级牌数量 |
| `disabled` | `boolean` | ❌ | `false` | 是否禁用组件 |
| `className` | `string` | ❌ | `''` | 自定义CSS类名 |

### 类型定义

```typescript
// 级数类型（2-14，对应2到A）
type GameRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

// 卡牌接口
interface Card {
  id: string;
  suit: Suit | null;
  rank: Rank;
  isRankCard: boolean;
  isWildCard: boolean;
  isPlayed: boolean;
  isSelected: boolean;
  position?: number;
  timestamp: number;
}
```

## 交互说明

### 键盘操作
- `↑` / `↓` - 切换级数
- `Enter` / `Space` - 打开/关闭下拉菜单
- `Escape` - 关闭下拉菜单

### 触摸操作
- **点击** - 打开下拉菜单
- **左滑** - 切换到下一级数
- **右滑** - 切换到上一级数
- **长按** - 无特殊操作

### 确认对话框
当用户尝试变更级数时，会显示确认对话框：
- 显示当前级数和目标级数
- 提醒级数变更会影响卡牌标记
- 提供"确认"和"取消"选项

## 样式定制

### CSS 类名
组件使用 Tailwind CSS 构建，主要类名结构：

```css
.rank-selector {
  /* 主容器 */
}

.rank-selector__main {
  /* 主要选择器区域 */
}

.rank-selector__dropdown {
  /* 下拉菜单 */
}

.rank-selector__dialog {
  /* 确认对话框 */
}
```

### 自定义主题
可以通过传入 `className` 或修改 Tailwind 配置来自定义外观。

## 注意事项

1. **级数范围**: 只支持 2-A（2-14）范围内的级数
2. **确认机制**: 所有级数变更都需要用户确认
3. **统计准确性**: 需要传入正确的 `allCards` 数据以获得准确的统计信息
4. **性能**: 大量卡牌数据时统计计算可能略有延迟

## 依赖项

- React 18+
- TypeScript
- Tailwind CSS
- 项目内的类型定义和工具函数

## 兼容性

- 现代浏览器
- 移动端浏览器
- 触摸设备
- 键盘导航支持

## 更新日志

### v1.0.0
- 初始版本
- 支持基本的级数选择功能
- 键盘和触摸交互
- 确认对话框
- 统计信息显示 