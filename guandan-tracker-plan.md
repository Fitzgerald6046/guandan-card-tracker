# 掼蛋记牌器完整开发方案（优化版）

## 技术栈选择
**推荐方案：React + TypeScript + Tailwind CSS + PWA**
- 现代化开发体验，类型安全
- 响应式设计，适配各种屏幕
- PWA支持，可安装到手机桌面
- 易于部署到Vercel/Netlify

## 项目结构设计
```
guandan-card-tracker/
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
├── src/
│   ├── components/
│   │   ├── CardGrid/
│   │   │   ├── CardGrid.tsx
│   │   │   └── Card.tsx
│   │   ├── PlayerSelector/
│   │   │   └── PlayerSelector.tsx
│   │   ├── ActionBar/
│   │   │   └── ActionBar.tsx
│   │   ├── RankSelector/           # 新增：级数选择器
│   │   │   └── RankSelector.tsx
│   │   └── Settings/
│   │       └── Settings.tsx
│   ├── hooks/
│   │   ├── useGameState.ts
│   │   ├── useLocalStorage.ts
│   │   └── useRankLogic.ts        # 新增：级数相关逻辑
│   ├── types/
│   │   └── game.ts
│   ├── utils/
│   │   ├── cardData.ts
│   │   ├── rankUtils.ts           # 新增：级数工具函数
│   │   └── constants.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── README.md
```

## 数据结构完善（增强版）
```typescript
// types/game.ts
export interface Card {
  id: string;
  name: string;
  suit: 'spade' | 'heart' | 'club' | 'diamond' | 'joker';
  value: number;
  owners: number[];
  isJoker?: boolean;
  isRankCard?: boolean;      // 新增：是否为级牌
  isWildCard?: boolean;      // 新增：是否为配牌（红心级牌）
}

export interface Player {
  id: number;
  name: string;
  color: string;
  active: boolean;
  team: 1 | 2;              // 新增：所属队伍
}

export interface GameState {
  cards: Card[];
  players: Player[];
  activePlayerId: number | null;
  currentRank: number;       // 新增：当前级数（2-14）
  gameHistory: GameRecord[];
}

export interface GameRecord {
  id: string;
  timestamp: number;
  cards: Card[];
  players: Player[];
  rank: number;              // 新增：记录当时的级数
}
```

## 核心功能实现方案

### 1. 卡牌数据生成（支持级数）
```typescript
// utils/cardData.ts
export const generateCards = (currentRank: number): Card[] => {
  const suits = ['spade', 'heart', 'club', 'diamond'] as const;
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const cards: Card[] = [];

  suits.forEach(suit => {
    values.forEach(value => {
      const isRankCard = value === currentRank;
      const isWildCard = isRankCard && suit === 'heart';
      
      cards.push({
        id: `${value}${suit[0]}`,
        name: `${getCardName(value)}${getSuitSymbol(suit)}`,
        suit,
        value,
        owners: [],
        isRankCard,
        isWildCard
      });
    });
  });

  // 添加大小王
  cards.push(
    {
      id: 'joker_small',
      name: '小王',
      suit: 'joker',
      value: 15,
      owners: [],
      isJoker: true
    },
    {
      id: 'joker_big',
      name: '大王',
      suit: 'joker',
      value: 16,
      owners: [],
      isJoker: true
    }
  );

  return cards;
};
```

### 2. 级数相关工具函数
```typescript
// utils/rankUtils.ts
export const getRankName = (rank: number): string => {
  const rankNames: Record<number, string> = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 
    9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
  };
  return rankNames[rank] || '';
};

export const getCardOrderValue = (card: Card, currentRank: number): number => {
  // 大小王最大
  if (card.isJoker) return card.value;
  
  // 红心配牌次之
  if (card.isWildCard) return 14.5;
  
  // 其他级牌
  if (card.isRankCard) return 14;
  
  // 普通牌按原值排序
  return card.value;
};
```

## 开发协作方案

### Claude Code 负责部分（核心逻辑与数据层）
Claude Code擅长快速生成完整的代码结构和复杂逻辑，负责：
1. 项目初始化和基础配置
2. 类型定义和数据结构
3. 核心Hook和状态管理
4. 工具函数和算法实现

### Cursor 负责部分（UI组件与交互优化）
Cursor擅长迭代优化和实时预览，负责：
1. UI组件的实现和样式调整
2. 交互动画和用户体验优化
3. 响应式布局调整
4. 性能优化和测试

## 详细开发步骤与提示词

### 阶段一：Claude Code 基础搭建（1小时）

#### 步骤 1: 项目初始化
**Claude Code 提示词：**
```
请创建一个掼蛋记牌器的React TypeScript项目，包含以下功能：
1. 使用create-react-app初始化项目，配置TypeScript和Tailwind CSS
2. 设置项目基础结构，包含components、hooks、types、utils等目录
3. 配置PWA相关文件（manifest.json和service worker）
4. 添加必要的依赖包配置

项目特殊要求：
- 支持2-A的级数设置
- 红心级牌作为配牌需要特殊标识
- 四个玩家分为两个队伍
- 支持触摸滑动批量选择卡牌
```

#### 步骤 2: 类型系统和数据结构
**Claude Code 提示词：**
```
请实现完整的TypeScript类型系统（src/types/game.ts），包括：
1. Card接口：支持级牌标识（isRankCard）和配牌标识（isWildCard）
2. Player接口：包含队伍信息（team: 1 | 2）
3. GameState接口：包含当前级数（currentRank）
4. 所有必要的枚举和联合类型

确保类型定义支持：
- 动态识别级牌（根据currentRank）
- 红心级牌自动标记为配牌
- 级数范围2-14（A）
```

#### 步骤 3: 核心工具函数
**Claude Code 提示词：**
```
请实现以下工具函数：

1. src/utils/cardData.ts:
   - generateCards(currentRank): 生成108张牌，自动标记级牌和配牌
   - 根据当前级数动态设置isRankCard和isWildCard属性

2. src/utils/rankUtils.ts:
   - getRankName(): 级数转换为显示名称
   - getCardOrderValue(): 根据级数计算牌的排序值
   - isValidRank(): 验证级数是否合法

3. src/utils/constants.ts:
   - 定义所有常量，包括级数范围、默认玩家配置等
```

#### 步骤 4: 状态管理Hook
**Claude Code 提示词：**
```
请创建src/hooks/useGameState.ts，实现完整的游戏状态管理：

1. 使用useReducer管理状态，包含以下actions：
   - SET_RANK: 设置当前级数
   - SELECT_PLAYER: 选择当前玩家
   - TOGGLE_CARD: 切换卡牌归属
   - BATCH_TOGGLE_CARDS: 批量切换卡牌
   - RESET_GAME: 重置游戏（保留级数）
   - UPDATE_PLAYER: 更新玩家信息

2. 特殊逻辑：
   - 切换级数时重新生成卡牌数据
   - 自动保存状态到localStorage
   - 提供计算统计信息的selector函数

3. 导出便捷函数：
   - getTeamCards(): 获取某队伍的所有卡牌
   - getRankCards(): 获取所有级牌
   - getWildCards(): 获取所有配牌
```

### 阶段二：Cursor UI组件开发（1.5小时）

#### 步骤 5: 级数选择器组件
**Cursor 提示词：**
```
请创建src/components/RankSelector/RankSelector.tsx：

功能要求：
1. 显示当前级数（2-A）
2. 下拉菜单或滑动选择器切换级数
3. 切换时显示确认对话框（提醒会重置卡牌）
4. 高亮显示当前级数
5. 显示级牌和配牌的数量统计

样式要求：
- 使用Tailwind CSS
- 移动端友好的交互
- 明显的视觉反馈
- 与整体UI风格一致

交互细节：
- 支持键盘操作（上下键切换）
- 触摸滑动切换
- 动画过渡效果
```

#### 步骤 6: 增强版卡牌组件
**Cursor 提示词：**
```
请优化src/components/CardGrid/Card.tsx，添加以下功能：

1. 级牌特殊样式：
   - 级牌添加特殊边框或背景
   - 动画效果（如发光、脉冲）
   
2. 红心配牌突出显示：
   - 红心级牌使用独特的样式（如金色边框）
   - 添加"配"字标记或特殊图标
   - 更醒目的视觉效果

3. 队伍归属显示：
   - 使用不同的颜色系区分两个队伍
   - 支持同时显示多个玩家拥有（分区显示）

4. 响应式优化：
   - 根据屏幕大小调整卡牌尺寸
   - 保持良好的点击区域
```

#### 步骤 7: 卡牌网格布局优化
**Cursor 提示词：**
```
请优化src/components/CardGrid/CardGrid.tsx：

1. 智能排序：
   - 按照getCardOrderValue排序
   - 级牌和配牌优先显示
   - 大小王单独一行

2. 分组显示选项：
   - 按花色分组
   - 按数值分组（默认）
   - 按级牌/非级牌分组

3. 快速定位：
   - 添加"跳转到级牌"按钮
   - 滚动时显示当前区域提示

4. 批量操作优化：
   - 长按进入多选模式
   - 显示选中数量
   - 支持全选/反选
```

#### 步骤 8: 玩家选择器增强
**Cursor 提示词：**
```
请增强src/components/PlayerSelector/PlayerSelector.tsx：

1. 队伍显示：
   - 明确显示队伍分组（1队 vs 2队）
   - 队伍颜色主题区分
   - 显示队伍总分

2. 统计信息：
   - 每个玩家的牌数
   - 级牌和配牌数量
   - 大小王拥有情况

3. 快速切换：
   - 点击切换当前玩家
   - 滑动切换队友
   - 键盘快捷键（1-4）
```

### 阶段三：Claude Code 高级功能（45分钟）

#### 步骤 9: 游戏逻辑增强
**Claude Code 提示词：**
```
请添加以下高级功能：

1. src/hooks/useRankLogic.ts:
   - 计算每个队伍的级牌控制力
   - 分析配牌分布情况
   - 提供战术建议（可选功能）

2. src/utils/gameAnalytics.ts:
   - 计算关键牌的分布
   - 统计出牌可能性
   - 生成游戏报告

3. 历史记录功能：
   - 保存最近10局游戏
   - 支持回放查看
   - 导出游戏数据
```

#### 步骤 10: PWA和离线功能
**Claude Code 提示词：**
```
请完善PWA功能：

1. Service Worker配置：
   - 缓存所有静态资源
   - 实现离线访问
   - 后台数据同步

2. 安装提示：
   - iOS和Android的安装引导
   - 自定义安装横幅
   - 更新提醒功能

3. 性能优化：
   - 图片懒加载
   - 代码分割
   - 预加载关键资源
```

### 阶段四：Cursor 最终整合（45分钟）

#### 步骤 11: 主应用整合
**Cursor 提示词：**
```
请优化src/App.tsx，整合所有功能：

1. 布局结构：
   - 顶部：级数选择器 + 设置按钮
   - 中部上：玩家选择器（显示队伍）
   - 中部下：卡牌网格
   - 底部：操作栏

2. 状态管理优化：
   - 使用Context减少props传递
   - 性能优化（memo、callback）
   - 错误边界处理

3. 响应式适配：
   - 横屏/竖屏布局切换
   - 平板适配
   - 桌面端支持
```

#### 步骤 12: 设置页面完善
**Cursor 提示词：**
```
请完善src/components/Settings/Settings.tsx：

1. 游戏设置：
   - 初始级数设置
   - 队伍分配调整
   - 游戏规则选项

2. 显示设置：
   - 主题切换
   - 卡牌大小调节
   - 动画开关

3. 数据管理：
   - 导出游戏记录
   - 清除历史数据
   - 备份/恢复配置
```

## 开发时间估算

### Claude Code 部分（2小时）
- 项目初始化和配置：20分钟
- 类型系统和数据结构：30分钟
- 核心工具函数：30分钟
- 状态管理Hook：40分钟

### Cursor 部分（2.5小时）
- 级数选择器：30分钟
- 卡牌组件优化：30分钟
- 网格布局增强：30分钟
- 玩家选择器：30分钟
- 主应用整合：30分钟
- 设置页面：20分钟

### 总计：4.5小时

## 额外功能建议
1. **AI助手**：根据已出牌分析剩余牌概率
2. **团队协作**：WebSocket实现多人实时同步
3. **语音控制**：语音标记卡牌归属
4. **数据分析**：生成牌局分析报告
5. **教学模式**：新手引导和规则说明

## 部署建议
1. 使用Vercel或Netlify自动部署
2. 配置自定义域名
3. 启用HTTPS和HTTP/2
4. 添加Google Analytics
5. 设置错误监控（Sentry）
