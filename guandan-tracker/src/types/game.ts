/**
 * 掼蛋游戏完整类型定义
 */

// ==================== 基础枚举定义 ====================

/** 花色枚举 */
export const Suit = {
  SPADES: 'spades',     // 黑桃 ♠
  HEARTS: 'hearts',     // 红心 ♥ (特殊花色，级牌为配牌)
  DIAMONDS: 'diamonds', // 方块 ♦
  CLUBS: 'clubs'        // 梅花 ♣
} as const;

export type Suit = typeof Suit[keyof typeof Suit];

/** 牌面数值（使用数字便于比较和计算） */
export const Rank = {
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  SIX: 6,
  SEVEN: 7,
  EIGHT: 8,
  NINE: 9,
  TEN: 10,
  JACK: 11,
  QUEEN: 12,
  KING: 13,
  ACE: 14,              // A为14，便于级数循环计算
  JOKER_SMALL: 15,      // 小王
  JOKER_BIG: 16         // 大王
} as const;

export type Rank = typeof Rank[keyof typeof Rank];

/** 有效级数范围（2-14，即2到A） */
export type GameRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

/** 玩家位置 */
export const PlayerPosition = {
  BOTTOM: 'bottom',     // 下方（自己）
  LEFT: 'left',         // 左方
  TOP: 'top',           // 上方
  RIGHT: 'right'        // 右方
} as const;

export type PlayerPosition = typeof PlayerPosition[keyof typeof PlayerPosition];

/** 队伍编号 */
export type Team = 1 | 2;  // 简化为数字：1队（上下），2队（左右）

/** 游戏状态 */
export const GameStatus = {
  WAITING: 'waiting',           // 等待开始
  INPUT: 'input',               // 手牌输入
  DEALING: 'dealing',           // 发牌中
  PLAYING: 'playing',           // 游戏进行中
  ROUND_END: 'round_end',       // 回合结束
  GAME_END: 'game_end',         // 游戏结束
  FINISHED: 'finished'          // 游戏完成
} as const;

export type GameStatus = typeof GameStatus[keyof typeof GameStatus];

// ==================== 卡牌相关类型 ====================

/** 
 * 卡牌接口
 * 包含完整的卡牌信息和状态
 */
export interface Card {
  /** 卡牌唯一标识符 */
  id: string;
  
  /** 花色（王牌为null） */
  suit: Suit | null;
  
  /** 牌面数值 */
  rank: Rank;
  
  /** 是否为级牌（根据当前级数动态判断） */
  isRankCard: boolean;
  
  /** 是否为配牌（红心级牌自动标记） */
  isWildCard: boolean;
  
  /** 是否已出牌 */
  isPlayed: boolean;
  
  /** 是否被选中 */
  isSelected: boolean;
  
  /** 卡牌在手牌中的位置索引 */
  position?: number;
  
  /** 卡牌创建时间戳（用于排序） */
  timestamp: number;
  
  /** 是否被使用（兼容性属性） */
  isUsed?: boolean;
  
  /** 是否为级牌（兼容性属性） */
  isLevel?: boolean;
  
  /** 是否为红色牌（兼容性属性） */
  isRed?: boolean;
}

/** 卡牌创建参数 */
export interface CreateCardParams {
  suit: Suit | null;
  rank: Rank;
  currentRank: GameRank;
  position?: number;
}

// ==================== 玩家相关类型 ====================

/** 玩家信息接口 */
export interface Player {
  /** 玩家唯一标识符 */
  id: string;
  
  /** 玩家姓名 */
  name: string;
  
  /** 玩家位置 */
  position: PlayerPosition;
  
  /** 所属队伍（1或2） */
  team: Team;
  
  /** 手牌列表 */
  cards: Card[];
  
  /** 剩余牌数 */
  remainingCount: number;
  
  /** 是否为当前出牌玩家 */
  isCurrentPlayer: boolean;
  
  /** 玩家统计信息 */
  stats: PlayerStats;
}

/** 玩家统计信息 */
export interface PlayerStats {
  /** 本局已出牌数 */
  playedCards: number;
  
  /** 级牌数量 */
  rankCardCount: number;
  
  /** 配牌数量 */
  wildCardCount: number;
  
  /** 本局获胜次数 */
  roundWins: number;
}

// ==================== 游戏状态相关类型 ====================

/** 级数配置 */
export interface RankConfig {
  /** 当前级数 */
  current: GameRank;
  
  /** 下一级数 */
  next: GameRank;
  
  /** 历史级数记录 */
  history: GameRank[];
}

/** 游戏配置 */
export interface GameConfig {
  /** 级数配置 */
  rank: RankConfig;
  
  /** 主花色（如果有） */
  trumpSuit?: Suit;
  
  /** 是否启用贡牌规则 */
  tributeEnabled: boolean;
  
  /** 游戏回合数限制 */
  maxRounds?: number;
}

/** 完整游戏状态接口 */
export interface GameState {
  /** 游戏唯一标识符 */
  gameId: string;
  
  /** 游戏状态 */
  status: GameStatus;
  
  /** 游戏配置 */
  config: GameConfig;
  
  /** 玩家列表 */
  players: Player[];
  
  /** 当前出牌玩家位置 */
  currentPlayerPosition: PlayerPosition;
  
  /** 当前级数 */
  currentRank: GameRank;
  
  /** 所有卡牌池 */
  allCards: Card[];
  
  /** 已出牌记录 */
  playHistory: PlayRecord[];
  
  /** 当前回合信息 */
  currentRound: RoundInfo;
  
  /** 游戏创建时间 */
  createdAt: number;
  
  /** 最后更新时间 */
  updatedAt: number;
}

// ==================== 出牌相关类型 ====================

/** 出牌类型 */
export const PlayType = {
  SINGLE: 'single',                    // 单张
  PAIR: 'pair',                       // 对子
  TRIPLE: 'triple',                   // 三张
  TRIPLE_WITH_PAIR: 'triple_with_pair', // 三带二
  STRAIGHT: 'straight',               // 顺子
  PAIR_STRAIGHT: 'pair_straight',     // 连对
  TRIPLE_STRAIGHT: 'triple_straight', // 三连
  PLANE: 'plane',                     // 飞机
  BOMB_FOUR: 'bomb_four',            // 四炸
  BOMB_FIVE: 'bomb_five',            // 五炸
  BOMB_SIX: 'bomb_six',              // 六炸
  BOMB_SEVEN: 'bomb_seven',          // 七炸
  BOMB_EIGHT: 'bomb_eight',          // 八炸
  STRAIGHT_FLUSH: 'straight_flush',   // 同花顺
  PASS: 'pass'                       // 过牌
} as const;

export type PlayType = typeof PlayType[keyof typeof PlayType];

/** 出牌记录 */
export interface PlayRecord {
  /** 记录唯一标识符 */
  id: string;
  
  /** 出牌玩家位置 */
  playerPosition: PlayerPosition;
  
  /** 出牌列表 */
  cards: Card[];
  
  /** 出牌类型 */
  type: PlayType;
  
  /** 出牌时间戳 */
  timestamp: number;
  
  /** 是否为主动出牌 */
  isActivePlay: boolean;
  
  /** 回合序号 */
  roundIndex?: number;
  
  /** 出牌描述 */
  description?: string;
  
  /** 出牌前手牌数 */
  cardsBeforePlay?: number;
  
  /** AI推理分析数据 (新增) */
  aiAnalysis?: {
    /** 该轮过牌的玩家列表 */
    passedPlayers?: PlayerPosition[];
    /** 推断的手牌约束信息 */
    impliedConstraints?: CardConstraint[];
    /** AI推理置信度 (0-1) */
    confidenceLevel?: number;
    /** 推测的关键牌信息 */
    suspectedCards?: SuspectedCard[];
    /** 行为模式分析 */
    behaviorAnalysis?: {
      /** 是否为异常出牌(如拆牌) */
      isUnusualPlay: boolean;
      /** 出牌动机推测 */
      playMotivation: 'aggressive' | 'defensive' | 'forced' | 'strategic';
      /** 预期后续行动 */
      expectedFollowUp: string[];
    };
  };
}

/** 回合信息 */
export interface RoundInfo {
  /** 回合编号 */
  roundNumber: number;
  
  /** 回合开始时间 */
  startTime: number;
  
  /** 当前最大出牌 */
  currentMaxPlay?: PlayRecord;
  
  /** 连续过牌次数 */
  passCount: number;
  
  /** 回合是否结束 */
  isFinished: boolean;
}

// ==================== 触摸交互类型 ====================

/** 触摸选择状态 */
export interface TouchSelectState {
  /** 是否正在选择 */
  isSelecting: boolean;
  
  /** 开始选择的卡牌 */
  startCard: Card | null;
  
  /** 当前选中的卡牌列表 */
  selectedCards: Card[];
  
  /** 选择开始时间 */
  startTime?: number;
}

/** 触摸事件类型 */
export type TouchEventType = 'start' | 'move' | 'end' | 'cancel';

/** 触摸事件数据 */
export interface TouchEventData {
  /** 事件类型 */
  type: TouchEventType;
  
  /** 触摸的卡牌 */
  card: Card;
  
  /** 触摸坐标 */
  coordinates: {
    x: number;
    y: number;
  };
  
  /** 事件时间戳 */
  timestamp: number;
}

// ==================== 工具类型 ====================

/** 级数计算工具类型 */
export type RankCalculator = {
  /** 获取下一级数 */
  getNextRank: (current: GameRank) => GameRank;
  
  /** 获取上一级数 */
  getPreviousRank: (current: GameRank) => GameRank;
  
  /** 判断是否为有效级数 */
  isValidRank: (rank: number) => rank is GameRank;
};

/** 卡牌验证工具类型 */
export type CardValidator = {
  /** 验证是否为级牌 */
  isRankCard: (card: Card, currentRank: GameRank) => boolean;
  
  /** 验证是否为配牌 */
  isWildCard: (card: Card, currentRank: GameRank) => boolean;
  
  /** 验证出牌类型 */
  validatePlayType: (cards: Card[]) => PlayType | null;
};

/** 手牌输入状态 */
export interface HandInputState {
  /** 是否处于手牌输入模式 */
  isInputMode: boolean;
  /** 当前选中的玩家 */
  selectedPlayer: PlayerPosition | null;
  /** 玩家手牌映射 */
  playerHands: Record<PlayerPosition, Card[]>;
  /** 明牌映射 */
  revealedCards: Record<PlayerPosition, string[]>; // cardId数组
  /** 输入步骤 */
  inputStep: 'select_player' | 'select_cards' | 'confirm';
}

/** 游戏动作类型 */
export type GameAction = 
  | { type: 'SET_RANK'; payload: { rank: GameRank } }
  | { type: 'START_GAME'; payload: { playerNames: string[] } }
  | { type: 'DEAL_CARDS'; payload: { cards: Card[] } }
  | { type: 'PLAY_CARDS'; payload: { playerPosition: PlayerPosition; cards: Card[] } }
  | { type: 'PASS_TURN'; payload: { playerPosition: PlayerPosition } }
  | { type: 'SELECT_CARD'; payload: { cardId: string; selected: boolean } }
  | { type: 'SELECT_MULTIPLE_CARDS'; payload: { cardIds: string[]; selected: boolean } }
  | { type: 'UPDATE_CARD'; payload: { cardId: string; updates: Partial<Card> } }
  | { type: 'SET_CURRENT_PLAYER'; payload: { position: PlayerPosition } }
  | { type: 'END_ROUND'; payload: { winnerPosition: PlayerPosition } }
  | { type: 'RESET_GAME'; payload?: {} }
  | { type: 'ENTER_HAND_INPUT'; payload?: {} }
  | { type: 'EXIT_HAND_INPUT'; payload?: {} }
  | { type: 'SELECT_PLAYER_FOR_INPUT'; payload: { playerPosition: PlayerPosition } }
  | { type: 'ADD_CARD_TO_PLAYER'; payload: { playerPosition: PlayerPosition; cardId: string } }
  | { type: 'REMOVE_CARD_FROM_PLAYER'; payload: { playerPosition: PlayerPosition; cardId: string } }
  | { type: 'SET_REVEALED_CARD'; payload: { playerPosition: PlayerPosition; cardId: string; revealed: boolean } }
  | { type: 'CONFIRM_HAND_INPUT'; payload?: {} };

// ==================== 常量定义 ====================

/** 掼蛋常量 */
export const GAME_CONSTANTS = {
  /** 每副牌的张数 */
  CARDS_PER_DECK: 54,
  
  /** 使用的牌副数 */
  DECK_COUNT: 2,
  
  /** 总牌数 */
  TOTAL_CARDS: 108,
  
  /** 每个玩家的牌数 */
  CARDS_PER_PLAYER: 27,
  
  /** 玩家数量 */
  PLAYER_COUNT: 4,
  
  /** 级数范围 */
  RANK_RANGE: {
    MIN: 2 as GameRank,
    MAX: 14 as GameRank
  },
  
  /** 队伍配置 */
  TEAMS: {
    TEAM_1: [PlayerPosition.BOTTOM, PlayerPosition.TOP],
    TEAM_2: [PlayerPosition.LEFT, PlayerPosition.RIGHT]
  }
} as const;

/** 牌面显示名称映射 */
export const RANK_DISPLAY_NAMES: Record<Rank, string> = {
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
};

/** 花色显示符号映射 */
export const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.SPADES]: '♠',
  [Suit.HEARTS]: '♥',
  [Suit.DIAMONDS]: '♦',
  [Suit.CLUBS]: '♣'
};

// ==================== 类型守卫 ====================

/** 检查是否为有效的游戏级数 */
export function isGameRank(value: number): value is GameRank {
  return value >= GAME_CONSTANTS.RANK_RANGE.MIN && value <= GAME_CONSTANTS.RANK_RANGE.MAX;
}

/** 检查是否为王牌 */
export function isJoker(card: Card): boolean {
  return card.rank === Rank.JOKER_SMALL || card.rank === Rank.JOKER_BIG;
}

/** 检查是否为红心花色 */
export function isHearts(card: Card): boolean {
  return card.suit === Suit.HEARTS;
}

/** 检查卡牌是否为级牌 */
export function isRankCard(card: Card, currentRank: GameRank): boolean {
  return !isJoker(card) && card.rank === currentRank;
}

/** 检查卡牌是否为配牌（红心级牌） */
export function isWildCard(card: Card, currentRank: GameRank): boolean {
  return isRankCard(card, currentRank) && isHearts(card);
}

// ==================== AI推理相关类型 ====================

/** 手牌约束信息 */
export interface CardConstraint {
  /** 约束对象玩家 */
  playerPosition: PlayerPosition;
  /** 确定不可能拥有的牌 */
  cannotHave: GameRank[];
  /** 很可能拥有的牌 */
  mustHave: GameRank[];
  /** 约束的置信度 (0-1) */
  probability: number;
  /** 约束来源（出牌/过牌行为） */
  source: 'play_action' | 'pass_action' | 'break_pattern' | 'deduction';
  /** 约束产生时间 */
  timestamp: number;
}

/** 推测的关键牌信息 */
export interface SuspectedCard {
  /** 推测的牌面 */
  rank: GameRank;
  /** 推测的花色 */
  suit?: Suit;
  /** 推测的持有者 */
  suspectedOwner: PlayerPosition;
  /** 推测置信度 (0-1) */
  confidence: number;
  /** 推测依据 */
  reasoning: string;
}

/** AI分析结果 */
export interface AIAnalysisResult {
  /** 分析时间戳 */
  timestamp: number;
  /** 游戏阶段 */
  gamePhase: 'early' | 'middle' | 'late' | 'endgame';
  /** 各玩家剩余牌数推测 */
  estimatedCardCounts: Record<PlayerPosition, {
    count: number;
    confidence: number;
  }>;
  /** 关键牌分布推测 */
  keyCardDistribution: {
    wildCards: Record<PlayerPosition, number>;
    rankCards: Record<PlayerPosition, number>;
    jokers: Record<PlayerPosition, number>;
  };
  /** 威胁等级评估 */
  threatLevels: Record<PlayerPosition, {
    level: 'low' | 'medium' | 'high' | 'critical';
    reasoning: string[];
  }>;
  /** 推荐策略 */
  suggestions: {
    action: 'play' | 'pass' | 'wait';
    reasoning: string;
    confidence: number;
    alternativeOptions?: string[];
  };
  /** 结构分析 */
  structureAnalysis: {
    criticalCardAnalysis: {
      rankCards: {
        remaining: number;
        distribution: string;
      };
      fives: {
        remaining: number;
      };
      tens: {
        remaining: number;
      };
    };
  };
  /** 警告信息 */
  warnings: string[];
  /** 战略洞察 */
  strategicInsights: string[];
  /** 推荐 */
  recommendations: {
    immediate: string[];
  };
  /** 置信度 */
  confidence: number;
}

/** 过牌行为分析 */
export interface PassAnalysis {
  /** 过牌玩家 */
  playerPosition: PlayerPosition;
  /** 当时场上的牌型 */
  leadingCardType: PlayType;
  /** 推断该玩家无法打过的牌型 */
  cannotBeat: PlayType[];
  /** 推断该玩家缺少的关键牌 */
  likelyMissingCards: GameRank[];
  /** 分析置信度 */
  confidence: number;
}

/** 拆牌行为分析 */
export interface BreakingPatternAnalysis {
  /** 出牌玩家 */
  playerPosition: PlayerPosition;
  /** 被拆掉的可能牌型 */
  brokenPattern: PlayType;
  /** 拆牌原因推测 */
  reasoning: 'forced' | 'strategic' | 'defensive' | 'unknown';
  /** 暴露的手牌信息 */
  revealedInfo: string[];
}

export default {
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
};