/**
 * Hooks统一导出文件
 */

// 核心游戏Hooks
export { default as useGameState } from './useGameState';
export { default as useGameHistory } from './useGameHistory';
export { default as usePlayHistory } from './usePlayHistory';

// 工具Hooks
export { default as useRankLogic } from './useRankLogic';
export { default as useTouchSelect } from './useTouchSelect';
export { default as usePWA } from './usePWA';

// 导出相关类型
export type { 
  GameRecord, 
  HistoryStatistics, 
  ReplayState, 
  ExportOptions,
  UseGameHistoryReturn 
} from './useGameHistory';

export type { 
  PlayAction, 
  RoundState, 
  UsePlayHistoryReturn 
} from './usePlayHistory';