/**
 * 掼蛋记牌器类型定义统一导出
 * 
 * 这个文件作为类型系统的统一入口，导出所有游戏相关的类型定义
 */

// ==================== 主要类型导出 ====================

// 从 game.ts 导出所有类型
export type {
  // 基础类型
  GameRank,
  Team,
  
  // 卡牌相关类型
  Card,
  CreateCardParams,
  
  // 玩家相关类型
  Player,
  PlayerStats,
  
  // 游戏状态类型
  GameState,
  GameConfig,
  RankConfig,
  
  // 出牌相关类型
  PlayRecord,
  RoundInfo,
  
  // 触摸交互类型
  TouchSelectState,
  TouchEventType,
  TouchEventData,
  
  // 工具类型
  RankCalculator,
  CardValidator,
  GameAction
} from './game';

// 导出枚举常量和工具函数
export {
  Suit,
  Rank,
  PlayerPosition,
  GameStatus,
  PlayType,
  GAME_CONSTANTS,
  RANK_DISPLAY_NAMES,
  SUIT_SYMBOLS,
  isGameRank,
  isJoker,
  isHearts,
  isRankCard,
  isWildCard
} from './game';

// ==================== Hook 类型导出 ====================

export type {
  UseGameStateReturn
} from '../hooks/useGameState';

// ==================== 组件 Props 类型定义 ====================

import type { Card, Player, GameState, GameRank, PlayerPosition } from './game';

/** 卡牌组件属性 */
export interface CardProps {
  card: Card;
  size?: 'small' | 'medium' | 'large';
  onClick?: (card: Card) => void;
  onTouchStart?: (card: Card, coordinates: { x: number; y: number }) => void;
  onTouchMove?: (card: Card, coordinates: { x: number; y: number }) => void;
  onTouchEnd?: (coordinates: { x: number; y: number }) => void;
  className?: string;
  disabled?: boolean;
}

/** 玩家手牌组件属性 */
export interface PlayerHandProps {
  player: Player;
  onCardClick?: (card: Card) => void;
  onCardTouch?: {
    onTouchStart: (card: Card, coordinates: { x: number; y: number }) => void;
    onTouchMove: (card: Card, coordinates: { x: number; y: number }) => void;
    onTouchEnd: (coordinates: { x: number; y: number }) => void;
  };
  showCards?: boolean;
  className?: string;
}

/** 游戏面板组件属性 */
export interface GameBoardProps {
  gameState: GameState;
  onCardClick?: (card: Card) => void;
  onCardTouch?: {
    onTouchStart: (card: Card, coordinates: { x: number; y: number }) => void;
    onTouchMove: (card: Card, coordinates: { x: number; y: number }) => void;
    onTouchEnd: (coordinates: { x: number; y: number }) => void;
  };
  className?: string;
}

/** 级数选择器组件属性 */
export interface LevelSelectorProps {
  currentRank: GameRank;
  onRankChange: (rank: GameRank) => void;
  disabled?: boolean;
  className?: string;
}

/** 游戏设置组件属性 */
export interface GameSettingsProps {
  currentRank: GameRank;
  playerNames: string[];
  onRankChange: (rank: GameRank) => void;
  onPlayerNamesChange: (names: string[]) => void;
  onStartGame: () => void;
  className?: string;
}

/** 游戏统计组件属性 */
export interface GameStatsProps {
  gameState: GameState;
  className?: string;
}

// ==================== 表单类型定义 ====================

/** 游戏设置表单数据 */
export interface GameSettingsForm {
  playerNames: [string, string, string, string];
  currentRank: GameRank;
  tributeEnabled: boolean;
  maxRounds?: number;
}

/** 玩家输入表单数据 */
export interface PlayerInputForm {
  name: string;
  position: PlayerPosition;
}

// ==================== API 响应类型 ====================

/** 游戏状态 API 响应 */
export interface GameStateResponse {
  success: boolean;
  data?: GameState;
  error?: string;
  timestamp: number;
}

/** 游戏操作 API 响应 */
export interface GameActionResponse {
  success: boolean;
  data?: {
    gameState: GameState;
    updatedCards?: Card[];
    updatedPlayers?: Player[];
  };
  error?: string;
  timestamp: number;
}

// ==================== 存储类型定义 ====================

/** 本地存储游戏数据 */
export interface StoredGameData {
  gameId: string;
  gameState: GameState;
  lastSaved: number;
  version: string;
}

/** 用户偏好设置 */
export interface UserPreferences {
  defaultPlayerNames: string[];
  defaultRank: GameRank;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: 'zh-CN' | 'en-US';
}

// ==================== 事件类型定义 ====================

/** 自定义游戏事件 */
export interface GameEvent<T = any> {
  type: string;
  payload: T;
  timestamp: number;
  source: 'user' | 'system' | 'network';
}

/** 卡牌选择事件 */
export interface CardSelectionEvent extends GameEvent<{
  cardId: string;
  selected: boolean;
  selectionMethod: 'click' | 'touch' | 'keyboard';
}> {
  type: 'card-selection';
}

/** 出牌事件 */
export interface PlayCardsEvent extends GameEvent<{
  playerPosition: PlayerPosition;
  cards: Card[];
  playType: string;
}> {
  type: 'play-cards';
}

/** 级数变更事件 */
export interface RankChangeEvent extends GameEvent<{
  oldRank: GameRank;
  newRank: GameRank;
}> {
  type: 'rank-change';
}

// ==================== 工具类型 ====================

/** 深度只读类型 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/** 部分更新类型 */
export type PartialUpdate<T> = {
  [P in keyof T]?: T[P] extends object ? PartialUpdate<T[P]> : T[P];
};

/** 必需字段类型 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** 可选字段类型 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// ==================== 验证类型 ====================

/** 验证结果 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/** 卡牌验证结果 */
export interface CardValidationResult extends ValidationResult {
  cardId: string;
  validationType: 'rank' | 'suit' | 'selection' | 'play';
}

/** 游戏状态验证结果 */
export interface GameStateValidationResult extends ValidationResult {
  gameId: string;
  checkedAt: number;
}