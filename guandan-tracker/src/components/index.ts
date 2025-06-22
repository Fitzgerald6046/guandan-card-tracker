/**
 * 组件统一导出文件
 */

// 核心游戏组件
export { default as GameBoard } from './GameBoard';
export { default as GameReplay } from './GameReplay';
export { default as GameReplayTable } from './GameReplayTable';
export { default as GameStats } from './GameStats';

// 卡牌相关组件
export { default as Card } from './Card';
export { default as CardImage } from './CardImage';
export { default as PlayerHand } from './PlayerHand';

// 界面组件
export { default as LevelSelector } from './LevelSelector';
export { default as DataExport } from './DataExport';
export { default as PlayHistoryPanel } from './PlayHistoryPanel';

// PWA组件
export { default as PWAWrapper } from './PWAWrapper';
export { default as PWAInstallPrompt } from './PWAInstallPrompt';
export { default as PWAUpdateBanner } from './PWAUpdateBanner';

// 懒加载组件
export { default as LazyImage } from './LazyImage';

// 新增导出类型
export type { PlayHistoryPanelProps } from './PlayHistoryPanel';
export type { GameReplayTableProps } from './GameReplayTable';