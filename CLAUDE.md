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