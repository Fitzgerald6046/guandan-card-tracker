/**
 * 掼蛋游戏常量定义
 * 包含所有游戏相关的常量配置
 */

import type { GameRank, PlayerPosition, Team } from '../types/game';
import { Suit, Rank, PlayerPosition as Pos } from '../types/game';

// ==================== 基础游戏常量 ====================

/** 掼蛋游戏基础常量 */
export const GAME_CONFIG = {
  /** 每副牌的张数（包含大小王） */
  CARDS_PER_DECK: 54,
  
  /** 使用的牌副数 */
  DECK_COUNT: 2,
  
  /** 总牌数 */
  TOTAL_CARDS: 108,
  
  /** 玩家数量 */
  PLAYER_COUNT: 4,
  
  /** 每个玩家的牌数 */
  CARDS_PER_PLAYER: 27,
  
  /** 每副牌中的普通牌数（不包含王牌） */
  NORMAL_CARDS_PER_DECK: 52,
  
  /** 每副牌中的王牌数 */
  JOKERS_PER_DECK: 2,
  
  /** 花色数量 */
  SUIT_COUNT: 4,
  
  /** 每种花色的牌数 */
  CARDS_PER_SUIT: 13
} as const;

// ==================== 级数相关常量 ====================

/** 级数范围定义 */
export const RANK_CONFIG = {
  /** 最小级数 */
  MIN_RANK: 2 as GameRank,
  
  /** 最大级数 */
  MAX_RANK: 14 as GameRank,
  
  /** 默认起始级数 */
  DEFAULT_RANK: 2 as GameRank,
  
  /** 级数总数 */
  RANK_COUNT: 13
} as const;

/** 有效级数数组 */
export const VALID_RANKS: readonly GameRank[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14
] as const;

/** 级数循环映射 - 用于快速获取下一个级数 */
export const RANK_CYCLE_MAP: Record<GameRank, GameRank> = {
  2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11, 11: 12, 12: 13, 13: 14, 14: 2
} as const;

/** 级数反向循环映射 - 用于快速获取上一个级数 */
export const RANK_REVERSE_CYCLE_MAP: Record<GameRank, GameRank> = {
  2: 14, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9, 11: 10, 12: 11, 13: 12, 14: 13
} as const;

// ==================== 牌面显示常量 ====================

/** 级数显示名称映射 */
export const RANK_DISPLAY_NAMES: Record<GameRank, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A'
} as const;

/** 完整牌面显示名称映射（包含王牌） */
export const FULL_RANK_DISPLAY_NAMES: Record<Rank, string> = {
  [Rank.TWO]: '2',
  [Rank.THREE]: '3',
  [Rank.FOUR]: '4',
  [Rank.FIVE]: '5',
  [Rank.SIX]: '6',
  [Rank.SEVEN]: '7',
  [Rank.EIGHT]: '8',
  [Rank.NINE]: '9',
  [Rank.TEN]: '10',
  [Rank.JACK]: 'J',
  [Rank.QUEEN]: 'Q',
  [Rank.KING]: 'K',
  [Rank.ACE]: 'A',
  [Rank.JOKER_SMALL]: '小王',
  [Rank.JOKER_BIG]: '大王'
} as const;

/** 花色符号映射 */
export const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.SPADES]: '♠',
  [Suit.HEARTS]: '♥',
  [Suit.DIAMONDS]: '♦',
  [Suit.CLUBS]: '♣'
} as const;

/** 花色中文名称 */
export const SUIT_CHINESE_NAMES: Record<Suit, string> = {
  [Suit.SPADES]: '黑桃',
  [Suit.HEARTS]: '红心',
  [Suit.DIAMONDS]: '方块',
  [Suit.CLUBS]: '梅花'
} as const;

/** 花色颜色类别 */
export const SUIT_COLORS = {
  RED_SUITS: [Suit.HEARTS, Suit.DIAMONDS] as const,
  BLACK_SUITS: [Suit.SPADES, Suit.CLUBS] as const
} as const;

// ==================== 玩家配置常量 ====================

/** 默认玩家名称 */
export const DEFAULT_PLAYER_NAMES: readonly string[] = [
  '您', '左方玩家', '上方玩家', '右方玩家'
] as const;

/** 玩家位置配置 */
export const PLAYER_POSITIONS: readonly PlayerPosition[] = [
  Pos.BOTTOM, Pos.LEFT, Pos.TOP, Pos.RIGHT
] as const;

/** 队伍配置 */
export const TEAM_CONFIG = {
  /** 队伍1：上下玩家 */
  TEAM_1_POSITIONS: [Pos.BOTTOM, Pos.TOP] as const,
  
  /** 队伍2：左右玩家 */
  TEAM_2_POSITIONS: [Pos.LEFT, Pos.RIGHT] as const,
  
  /** 位置到队伍的映射 */
  POSITION_TO_TEAM: {
    [Pos.BOTTOM]: 1 as Team,
    [Pos.TOP]: 1 as Team,
    [Pos.LEFT]: 2 as Team,
    [Pos.RIGHT]: 2 as Team
  }
} as const;

/** 玩家位置循环顺序 */
export const POSITION_CYCLE_MAP: Record<PlayerPosition, PlayerPosition> = {
  [Pos.BOTTOM]: Pos.LEFT,
  [Pos.LEFT]: Pos.TOP,
  [Pos.TOP]: Pos.RIGHT,
  [Pos.RIGHT]: Pos.BOTTOM
} as const;

// ==================== 卡牌排序常量 ====================

/** 标准牌面排序权重（不考虑级牌） */
export const STANDARD_RANK_ORDER: Record<Rank, number> = {
  [Rank.TWO]: 2,
  [Rank.THREE]: 3,
  [Rank.FOUR]: 4,
  [Rank.FIVE]: 5,
  [Rank.SIX]: 6,
  [Rank.SEVEN]: 7,
  [Rank.EIGHT]: 8,
  [Rank.NINE]: 9,
  [Rank.TEN]: 10,
  [Rank.JACK]: 11,
  [Rank.QUEEN]: 12,
  [Rank.KING]: 13,
  [Rank.ACE]: 14,
  [Rank.JOKER_SMALL]: 15,
  [Rank.JOKER_BIG]: 16
} as const;

/** 花色排序权重 */
export const SUIT_ORDER: Record<Suit, number> = {
  [Suit.SPADES]: 1,
  [Suit.HEARTS]: 2,
  [Suit.DIAMONDS]: 3,
  [Suit.CLUBS]: 4
} as const;

/** 掼蛋特殊排序权重 */
export const GUANDAN_SORT_WEIGHTS = {
  /** 配牌（红心级牌）权重 */
  WILD_CARD: 1000,
  
  /** 级牌权重 */
  RANK_CARD: 900,
  
  /** 大王权重 */
  BIG_JOKER: 800,
  
  /** 小王权重 */
  SMALL_JOKER: 700,
  
  /** 普通牌基础权重 */
  NORMAL_CARD_BASE: 0
} as const;

// ==================== 游戏规则常量 ====================

/** 出牌类型配置 */
export const PLAY_TYPE_CONFIG = {
  /** 最小顺子长度 */
  MIN_STRAIGHT_LENGTH: 5,
  
  /** 最大顺子长度 */
  MAX_STRAIGHT_LENGTH: 12,
  
  /** 最小连对长度 */
  MIN_PAIR_STRAIGHT_LENGTH: 3,
  
  /** 最小三连长度 */
  MIN_TRIPLE_STRAIGHT_LENGTH: 2,
  
  /** 炸弹最小张数 */
  MIN_BOMB_SIZE: 4,
  
  /** 炸弹最大张数 */
  MAX_BOMB_SIZE: 8
} as const;

/** 特殊牌型权重 */
export const PLAY_TYPE_WEIGHTS = {
  'single': 1,
  'pair': 2,
  'triple': 3,
  'triple_with_pair': 4,
  'straight': 5,
  'pair_straight': 6,
  'triple_straight': 7,
  'plane': 8,
  'bomb_four': 100,
  'bomb_five': 101,
  'bomb_six': 102,
  'bomb_seven': 103,
  'bomb_eight': 104,
  'straight_flush': 200
} as const;

// ==================== UI 相关常量 ====================

/** 卡牌尺寸配置 */
export const CARD_SIZE_CONFIG = {
  SMALL: {
    width: 32,
    height: 48,
    fontSize: 12
  },
  MEDIUM: {
    width: 48,
    height: 72,
    fontSize: 14
  },
  LARGE: {
    width: 64,
    height: 96,
    fontSize: 18
  }
} as const;

/** 触摸交互配置 */
export const TOUCH_CONFIG = {
  /** 长按触发时间（毫秒） */
  LONG_PRESS_DURATION: 500,
  
  /** 最小移动距离（像素） */
  MIN_MOVE_DISTANCE: 10,
  
  /** 选择反馈延迟（毫秒） */
  SELECTION_FEEDBACK_DELAY: 50,
  
  /** 双击间隔时间（毫秒） */
  DOUBLE_CLICK_INTERVAL: 300
} as const;

/** 动画配置 */
export const ANIMATION_CONFIG = {
  /** 卡牌选择动画时长 */
  CARD_SELECT_DURATION: 200,
  
  /** 卡牌出牌动画时长 */
  CARD_PLAY_DURATION: 300,
  
  /** 发牌动画时长 */
  DEAL_ANIMATION_DURATION: 100,
  
  /** 洗牌动画时长 */
  SHUFFLE_ANIMATION_DURATION: 500
} as const;

// ==================== 游戏统计常量 ====================

/** 统计配置 */
export const STATS_CONFIG = {
  /** 历史记录最大保存数量 */
  MAX_HISTORY_RECORDS: 100,
  
  /** 最近游戏显示数量 */
  RECENT_GAMES_COUNT: 10,
  
  /** 胜率计算小数位数 */
  WIN_RATE_PRECISION: 2
} as const;

// ==================== 存储相关常量 ====================

/** 本地存储键名 */
export const STORAGE_KEYS = {
  /** 游戏状态 */
  GAME_STATE: 'guandan_game_state',
  
  /** 用户偏好 */
  USER_PREFERENCES: 'guandan_user_preferences',
  
  /** 游戏统计 */
  GAME_STATS: 'guandan_game_stats',
  
  /** 历史记录 */
  GAME_HISTORY: 'guandan_game_history'
} as const;

/** 版本信息 */
export const VERSION_INFO = {
  /** 当前版本 */
  CURRENT_VERSION: '1.0.0',
  
  /** 数据格式版本 */
  DATA_FORMAT_VERSION: '1.0',
  
  /** 最小兼容版本 */
  MIN_COMPATIBLE_VERSION: '1.0.0'
} as const;

// ==================== 错误码常量 ====================

/** 错误码定义 */
export const ERROR_CODES = {
  /** 无效级数 */
  INVALID_RANK: 'E001',
  
  /** 无效卡牌 */
  INVALID_CARD: 'E002',
  
  /** 无效出牌 */
  INVALID_PLAY: 'E003',
  
  /** 游戏状态错误 */
  INVALID_GAME_STATE: 'E004',
  
  /** 玩家操作错误 */
  INVALID_PLAYER_ACTION: 'E005',
  
  /** 数据存储错误 */
  STORAGE_ERROR: 'E006'
} as const;

// ==================== 开发环境常量 ====================

/** 调试配置 */
export const DEBUG_CONFIG = {
  /** 是否启用调试模式 */
  ENABLE_DEBUG: process.env.NODE_ENV === 'development',
  
  /** 是否启用详细日志 */
  ENABLE_VERBOSE_LOGGING: false,
  
  /** 是否启用性能监控 */
  ENABLE_PERFORMANCE_MONITORING: false
} as const;

// ==================== 导出的工具常量 ====================

/** 空卡牌ID - 用于占位 */
export const EMPTY_CARD_ID = '__EMPTY_CARD__';

/** 无效玩家ID */
export const INVALID_PLAYER_ID = '__INVALID_PLAYER__';

/** 默认游戏ID前缀 */
export const GAME_ID_PREFIX = 'guandan_game_';

/** 时间戳工具 */
export const TIME_UTILS = {
  /** 一秒的毫秒数 */
  SECOND: 1000,
  
  /** 一分钟的毫秒数 */
  MINUTE: 60 * 1000,
  
  /** 一小时的毫秒数 */
  HOUR: 60 * 60 * 1000,
  
  /** 一天的毫秒数 */
  DAY: 24 * 60 * 60 * 1000
} as const;

// ==================== 类型断言工具 ====================

/** 检查是否为有效级数 */
export function isValidGameRank(value: unknown): value is GameRank {
  return typeof value === 'number' && VALID_RANKS.includes(value as GameRank);
}

/** 检查是否为有效玩家位置 */
export function isValidPlayerPosition(value: unknown): value is PlayerPosition {
  return typeof value === 'string' && PLAYER_POSITIONS.includes(value as PlayerPosition);
}

/** 检查是否为有效队伍 */
export function isValidTeam(value: unknown): value is Team {
  return value === 1 || value === 2;
}

// ==================== 默认导出 ====================

export default {
  GAME_CONFIG,
  RANK_CONFIG,
  VALID_RANKS,
  RANK_CYCLE_MAP,
  RANK_REVERSE_CYCLE_MAP,
  RANK_DISPLAY_NAMES,
  FULL_RANK_DISPLAY_NAMES,
  SUIT_SYMBOLS,
  SUIT_CHINESE_NAMES,
  DEFAULT_PLAYER_NAMES,
  PLAYER_POSITIONS,
  TEAM_CONFIG,
  POSITION_CYCLE_MAP,
  STANDARD_RANK_ORDER,
  SUIT_ORDER,
  GUANDAN_SORT_WEIGHTS,
  PLAY_TYPE_CONFIG,
  CARD_SIZE_CONFIG,
  TOUCH_CONFIG,
  ANIMATION_CONFIG,
  STORAGE_KEYS,
  VERSION_INFO,
  ERROR_CODES,
  DEBUG_CONFIG,
  isValidGameRank,
  isValidPlayerPosition,
  isValidTeam
};