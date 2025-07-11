# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **掼蛋记牌器** (Guandan Card Tracker) - a card tracking application for the Chinese card game "Guandan" (掼蛋). The project features:

- **Minimalist card tracking interface** optimized for real-time gameplay
- **AI-enhanced gameplay analysis** with intelligent card prediction
- **Voice recognition integration** for hands-free card recording
- **PWA support** for mobile deployment
- **Comprehensive replay system** with statistical analysis

## Architecture

### Core Structure
- **Main Application**: `guandan-tracker/` - React + TypeScript PWA
- **Voice Recognition**: `voice-recognition-test/` - Standalone voice control module
- **AI Integration**: Currently on `feature/ai-integration` branch with enhanced AI analysis

### Key Architectural Components

1. **State Management**: Context-based with `GameContext.tsx` providing centralized game state
2. **Game Logic**: Separated into utility modules (`utils/gameUtils.ts`, `utils/guandanRules.ts`)
3. **Type System**: Comprehensive type definitions in `types/game.ts` covering all game entities
4. **Component Architecture**: Modular components with dedicated folders and documentation
5. **Hook-based Logic**: Custom hooks (`useGameState.ts`, `usePlayHistory.ts`) for game state management

### Application Modes
- **Game Mode**: Standard card tracking interface
- **Hand Input Mode**: Initial hand setup with revealed card management
- **Replay Mode**: Game history analysis with table/summary views
- **AI Integration**: Enhanced analysis with behavior prediction (feature branch)

## Common Development Commands

### Basic Commands
```bash
# Navigate to main app directory
cd guandan-tracker

# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Voice Recognition Module
```bash
# Navigate to voice module
cd voice-recognition-test

# Install dependencies
npm install

# Development (serves test files)
npm run dev
```

## Key Technical Details

### Card System
- **108 cards total**: Double deck (2×54) without joker duplicates
- **Dynamic rank calculation**: Cards marked as rank/wild based on current game level
- **Position-based tracking**: 4 players (bottom/left/top/right) with team assignments

### Game State Structure
```typescript
interface GameState {
  currentRank: GameRank;          // Current level (2-14, J/Q/K/A)
  players: Player[];              // 4 players with position/team
  allCards: Card[];              // Complete card pool
  playHistory: PlayRecord[];     // Move history with AI analysis
  currentRound: RoundInfo;       // Round state management
}
```

### AI Integration Features
- **Play pattern analysis**: Detects unusual plays and strategic patterns
- **Card constraint inference**: Deduces probable hand compositions
- **Behavior analysis**: Evaluates player motivations and strategies
- **Threat assessment**: Calculates danger levels for each player

### Component Organization
- **Atomic Design**: Components organized by complexity level
- **Feature-based Modules**: Each major feature has dedicated component folder
- **Shared Utilities**: Common logic extracted to `utils/` and `hooks/`

## Important Files

### Core Game Files
- `src/App.tsx` - Main application with comprehensive game logic
- `src/App-Simple.tsx` - Simplified version for basic card tracking
- `src/contexts/GameContext.tsx` - Central state management
- `src/types/game.ts` - Complete type definitions
- `src/utils/gameUtils.ts` - Core game mechanics
- `src/utils/guandanRules.ts` - Official game rules implementation

### Key Components
- `src/components/AIAssistant.tsx` - AI integration interface
- `src/components/PlayHistoryPanel.tsx` - Move history with analysis
- `src/components/GameReplay.tsx` - Replay functionality
- `src/components/VoiceControl.tsx` - Voice recognition integration

### Configuration
- `vite.config.ts` - Build configuration with PWA plugin
- `tailwind.config.js` - UI styling configuration
- `tsconfig.json` - TypeScript compiler settings

## Development Guidelines

### Code Organization
- Follow existing component structure with dedicated README files
- Use TypeScript interfaces from `types/game.ts` for consistency
- Implement new features as hooks when possible for reusability
- Maintain separation between UI components and game logic

### Game Logic Integration
- Always use `GameRank` type for level values (2-14)
- Card IDs follow pattern: `{rank}-{index}` or `joker-{index}`
- Player positions use enum: `bottom|left|top|right`
- Team assignments: Team 1 (bottom/top), Team 2 (left/right)

### AI Analysis Integration
- New AI features should extend `PlayRecord.aiAnalysis` interface
- Use confidence levels (0-1) for all AI predictions
- Maintain backward compatibility with non-AI game modes
- Document reasoning for all AI analysis results

### Testing Strategy
- The project currently lacks formal test infrastructure
- Manual testing focuses on game state consistency
- Voice recognition has dedicated test files in `voice-recognition-test/`
- PWA functionality tested through build preview mode

## Branch Strategy

- **main**: Stable release version
- **feature/ai-integration**: Current development branch with AI enhancements
- Voice and AI features are being integrated from separate development modules

## PWA Configuration

The application includes comprehensive PWA support:
- Service worker for offline functionality
- Manifest configuration for mobile installation  
- Cache strategies for card images and game assets
- Update notification system for new versions
以下是对掼蛋记牌器项目的中文翻译：
项目概览

这是一个掼蛋记牌器——专为中国扑克牌游戏“掼蛋”设计的记牌应用。该项目特点包括：
简洁的记牌界面，优化了实时游戏体验
AI增强的游戏分析，提供智能的出牌预测
语音识别集成，支持免提录牌
PWA支持，便于移动端部署
全面的回放系统，包含统计分析

架构

核心结构

主应用：guandan-tracker/ - React + TypeScript PWA
语音识别模块：voice-recognition-test/ - 独立的语音控制模块
AI集成：当前在feature/ai-integration分支上，包含增强的AI分析

关键架构组件

状态管理：基于Context的GameContext.tsx，提供集中式游戏状态
游戏逻辑：分离为多个实用模块（utils/gameUtils.ts，utils/guandanRules.ts）
类型系统：在types/game.ts中有详细的类型定义，涵盖所有游戏实体
组件架构：模块化组件，有专门的文件夹和文档
基于Hook的逻辑：自定义Hooks（如useGameState.ts，usePlayHistory.ts）用于游戏状态管理

应用模式

游戏模式：标准的记牌界面
手牌输入模式：初始化手牌设置，显示已知的牌
回放模式：游戏历史分析，提供桌面/汇总视图
AI集成：增强的分析与行为预测（功能分支）

常用开发命令

基本命令

bash
# 进入主应用目

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产环境构建
npm run build

# 代码检查
npm run lint

# 预览生产构建
npm run preview
bash

语音识别模块

bash
# 进入语音模块目录
cd voice-recognition-test

# 安装依赖
npm install

# 启动开发（提供测试文件）
npm run dev

关键技术细节

卡牌系统

总共108张卡牌：双副牌（2×54），不包含重复的鬼牌
动态等级计算：根据当前游戏等级标记牌的等级/通配符
基于位置的追踪：四个玩家（底/左/上/右），并且有队伍分配

游戏状态结构

typescript
interface GameState {
  currentRank: GameRank;          // 当前等级（2-14，J/Q/K/A）
  players: Player[];              // 4个玩家，包含位置和队伍信息
  allCards: Card[];               // 完整的卡牌池
  playHistory: PlayRecord[];      // 游戏历史，包含AI分析
  currentRound: RoundInfo;       // 当前回合状态管理
}

AI集成功能

出牌模式分析：检测不寻常的出牌行为和策略模式
卡牌约束推断：推测可能的手牌组成
行为分析：评估玩家的动机和策略
威胁评估：计算每个玩家的威胁等级

组件组织

原子设计：组件按复杂性级别组织
基于功能的模块：每个主要功能有独立的组件文件夹
共享实用工具：常用逻辑提取到utils/和hooks/

重要文件

核心游戏文件

src/App.tsx - 主应用，包含全面的游戏逻辑
src/App-Simple.tsx - 简化版，用于基本的记牌
src/contexts/GameContext.tsx - 中央状态管理
src/types/game.ts - 完整的类型定义
src/utils/gameUtils.ts - 核心游戏机制
src/utils/guandanRules.ts - 官方规则实现

关键组件

src/components/AIAssistant.tsx - AI集成界面
src/components/PlayHistoryPanel.tsx - 移动历史与分析
src/components/GameReplay.tsx - 游戏回放功能
src/components/VoiceControl.tsx - 语音识别集成

配置

vite.config.ts - 构建配置，带PWA插件
tailwind.config.js - UI样式配置
tsconfig.json - TypeScript编译设置

开发指南

代码组织

按照现有的组件结构组织代码，并附带专门的README文件
使用types/game.ts中的TypeScript接口来保持一致性
尽可能将新功能实现为Hooks，以提高复用性
确保UI组件与游戏逻辑分离

游戏逻辑集成

始终使用GameRank类型来表示等级值（2-14）
卡牌ID遵循模式：{rank}-{index} 或 joker-{index}
玩家位置使用枚举：bottom|left|top|right
队伍分配：队伍1（bottom/top），队伍2（left/right）

AI分析集成

新的AI功能应扩展PlayRecord.aiAnalysis接口
所有AI预测都使用置信度（0-1）表示
保持与非AI游戏模式的兼容性
为所有AI分析结果提供清晰的推理说明

测试策略

项目目前缺乏正式的测试框架
手动测试主要关注游戏状态的一致性
语音识别功能有独立的测试文件，在voice-recognition-test/中
PWA功能通过构建预览模式进行测试

分支策略

main：稳定的发布版本
feature/ai-integration：当前的开发分支，包含AI增强功能
语音识别和AI功能来自独立的开发模块

PWA配置

应用包括全面的PWA支持：
离线功能的服务工作线程
移动端安装的Manifest配置
卡牌图像和游戏资源的缓存策略
新版本更新通知系统
