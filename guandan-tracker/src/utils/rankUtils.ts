/**
 * 掼蛋级数工具函数
 * 提供级数相关的转换、验证和计算功能
 */

import type { GameRank, Rank, Card } from '../types/game';
import { Rank as RankEnum, Suit } from '../types/game';
import { 
  RANK_CONFIG, 
  VALID_RANKS, 
  RANK_CYCLE_MAP, 
  RANK_REVERSE_CYCLE_MAP,
  RANK_DISPLAY_NAMES,
  FULL_RANK_DISPLAY_NAMES,
  STANDARD_RANK_ORDER,
  GUANDAN_SORT_WEIGHTS,
  isValidGameRank
} from './constants';

// ==================== 级数验证函数 ====================

/**
 * 验证级数是否合法
 * @param rank 要验证的级数
 * @returns 是否为合法级数
 */
export function isValidRank(rank: unknown): rank is GameRank {
  return isValidGameRank(rank);
}

/**
 * 验证级数范围
 * @param rank 级数值
 * @throws 如果级数不合法则抛出错误
 */
export function validateRank(rank: unknown): asserts rank is GameRank {
  if (!isValidRank(rank)) {
    throw new Error(`Invalid rank: ${rank}. Valid ranks are: ${VALID_RANKS.join(', ')}`);
  }
}

/**
 * 安全地转换为有效级数
 * @param rank 输入值
 * @param defaultRank 默认值
 * @returns 有效的级数
 */
export function toValidRank(rank: unknown, defaultRank: GameRank = RANK_CONFIG.DEFAULT_RANK): GameRank {
  if (isValidRank(rank)) {
    return rank;
  }
  
  // 尝试转换数字
  if (typeof rank === 'string') {
    const numericRank = parseInt(rank, 10);
    if (isValidRank(numericRank)) {
      return numericRank;
    }
  }
  
  return defaultRank;
}

// ==================== 级数转换函数 ====================

/**
 * 获取级数的显示名称
 * @param rank 级数值
 * @returns 显示名称（如 "2", "J", "Q", "K", "A"）
 */
export function getRankName(rank: GameRank): string {
  return RANK_DISPLAY_NAMES[rank];
}

/**
 * 获取完整牌面的显示名称（包含王牌）
 * @param rank 牌面值
 * @returns 显示名称
 */
export function getFullRankName(rank: Rank): string {
  return FULL_RANK_DISPLAY_NAMES[rank];
}

/**
 * 从显示名称获取级数值
 * @param displayName 显示名称
 * @returns 级数值，如果无效则返回 null
 */
export function getRankFromDisplayName(displayName: string): GameRank | null {
  for (const [rank, name] of Object.entries(RANK_DISPLAY_NAMES)) {
    if (name === displayName) {
      return parseInt(rank, 10) as GameRank;
    }
  }
  return null;
}

/**
 * Rank 枚举值转换为 GameRank
 * @param rank Rank 枚举值
 * @returns GameRank 或 null（如果是王牌）
 */
export function rankToGameRank(rank: Rank): GameRank | null {
  if (rank === RankEnum.JOKER_SMALL || rank === RankEnum.JOKER_BIG) {
    return null; // 王牌不属于级数范围
  }
  
  if (isValidRank(rank)) {
    return rank;
  }
  
  return null;
}

/**
 * GameRank 转换为 Rank 枚举值
 * @param gameRank 游戏级数
 * @returns Rank 枚举值
 */
export function gameRankToRank(gameRank: GameRank): Rank {
  return gameRank as Rank;
}

// ==================== 级数循环函数 ====================

/**
 * 获取下一个级数
 * @param currentRank 当前级数
 * @returns 下一个级数
 */
export function getNextRank(currentRank: GameRank): GameRank {
  validateRank(currentRank);
  return RANK_CYCLE_MAP[currentRank];
}

/**
 * 获取上一个级数
 * @param currentRank 当前级数
 * @returns 上一个级数
 */
export function getPreviousRank(currentRank: GameRank): GameRank {
  validateRank(currentRank);
  return RANK_REVERSE_CYCLE_MAP[currentRank];
}

/**
 * 获取指定步数后的级数
 * @param currentRank 当前级数
 * @param steps 步数（正数向前，负数向后）
 * @returns 目标级数
 */
export function getRankAfterSteps(currentRank: GameRank, steps: number): GameRank {
  validateRank(currentRank);
  
  let result = currentRank;
  const absSteps = Math.abs(steps);
  
  for (let i = 0; i < absSteps; i++) {
    if (steps > 0) {
      result = getNextRank(result);
    } else {
      result = getPreviousRank(result);
    }
  }
  
  return result;
}

/**
 * 计算两个级数之间的距离
 * @param fromRank 起始级数
 * @param toRank 目标级数
 * @returns 距离（最短路径）
 */
export function getRankDistance(fromRank: GameRank, toRank: GameRank): number {
  validateRank(fromRank);
  validateRank(toRank);
  
  if (fromRank === toRank) return 0;
  
  // 计算正向距离
  let forwardSteps = 0;
  let current = fromRank;
  while (current !== toRank && forwardSteps < RANK_CONFIG.RANK_COUNT) {
    current = getNextRank(current);
    forwardSteps++;
  }
  
  // 返回最短距离
  return Math.min(forwardSteps, RANK_CONFIG.RANK_COUNT - forwardSteps);
}

// ==================== 级数判断函数 ====================

/**
 * 判断卡牌是否为指定级数的级牌
 * @param card 卡牌
 * @param currentRank 当前级数
 * @returns 是否为级牌
 */
export function isRankCard(card: Card, currentRank: GameRank): boolean {
  validateRank(currentRank);
  
  // 王牌不是级牌
  if (card.suit === null) {
    return false;
  }
  
  return card.rank === currentRank;
}

/**
 * 判断卡牌是否为配牌（红心级牌）
 * @param card 卡牌
 * @param currentRank 当前级数
 * @returns 是否为配牌
 */
export function isWildCard(card: Card, currentRank: GameRank): boolean {
  return isRankCard(card, currentRank) && card.suit === Suit.HEARTS;
}

/**
 * 判断卡牌是否为王牌
 * @param card 卡牌
 * @returns 是否为王牌
 */
export function isJoker(card: Card): boolean {
  return card.rank === RankEnum.JOKER_SMALL || card.rank === RankEnum.JOKER_BIG;
}

/**
 * 判断卡牌是否为普通牌（非级牌、非王牌）
 * @param card 卡牌
 * @param currentRank 当前级数
 * @returns 是否为普通牌
 */
export function isNormalCard(card: Card, currentRank: GameRank): boolean {
  return !isRankCard(card, currentRank) && !isJoker(card);
}

// ==================== 排序值计算函数 ====================

/**
 * 计算卡牌的标准排序值（不考虑级牌）
 * @param card 卡牌
 * @returns 排序值
 */
export function getStandardCardOrderValue(card: Card): number {
  return STANDARD_RANK_ORDER[card.rank];
}

/**
 * 根据级数计算卡牌的排序值（掼蛋规则）
 * @param card 卡牌
 * @param currentRank 当前级数
 * @returns 排序值（越大越优先）
 */
export function getCardOrderValue(card: Card, currentRank: GameRank): number {
  validateRank(currentRank);
  
  // 配牌（红心级牌）权重最高
  if (isWildCard(card, currentRank)) {
    return GUANDAN_SORT_WEIGHTS.WILD_CARD + card.rank;
  }
  
  // 级牌权重次高
  if (isRankCard(card, currentRank)) {
    return GUANDAN_SORT_WEIGHTS.RANK_CARD + card.rank;
  }
  
  // 大王
  if (card.rank === RankEnum.JOKER_BIG) {
    return GUANDAN_SORT_WEIGHTS.BIG_JOKER;
  }
  
  // 小王
  if (card.rank === RankEnum.JOKER_SMALL) {
    return GUANDAN_SORT_WEIGHTS.SMALL_JOKER;
  }
  
  // 普通牌按标准顺序
  return GUANDAN_SORT_WEIGHTS.NORMAL_CARD_BASE + getStandardCardOrderValue(card);
}

/**
 * 比较两张卡牌的大小（掼蛋规则）
 * @param card1 卡牌1
 * @param card2 卡牌2
 * @param currentRank 当前级数
 * @returns 比较结果（正数表示card1大，负数表示card2大，0表示相等）
 */
export function compareCards(card1: Card, card2: Card, currentRank: GameRank): number {
  const value1 = getCardOrderValue(card1, currentRank);
  const value2 = getCardOrderValue(card2, currentRank);
  return value1 - value2;
}

// ==================== 级数统计函数 ====================

/**
 * 统计指定级数的卡牌数量
 * @param cards 卡牌数组
 * @param currentRank 当前级数
 * @returns 统计结果
 */
export function countRankCards(cards: Card[], currentRank: GameRank): {
  rankCards: number;
  wildCards: number;
  normalCards: number;
  jokers: number;
  total: number;
} {
  validateRank(currentRank);
  
  let rankCards = 0;
  let wildCards = 0;
  let normalCards = 0;
  let jokers = 0;
  
  for (const card of cards) {
    if (isWildCard(card, currentRank)) {
      wildCards++;
    } else if (isRankCard(card, currentRank)) {
      rankCards++;
    } else if (isJoker(card)) {
      jokers++;
    } else {
      normalCards++;
    }
  }
  
  return {
    rankCards,
    wildCards,
    normalCards,
    jokers,
    total: cards.length
  };
}

/**
 * 获取级数分布统计
 * @param cards 卡牌数组
 * @returns 每个级数的卡牌数量
 */
export function getRankDistribution(cards: Card[]): Record<GameRank, number> {
  const distribution: Record<GameRank, number> = {} as Record<GameRank, number>;
  
  // 初始化所有级数计数为0
  for (const rank of VALID_RANKS) {
    distribution[rank] = 0;
  }
  
  // 统计每个级数的卡牌数量
  for (const card of cards) {
    if (!isJoker(card)) {
      const gameRank = rankToGameRank(card.rank);
      if (gameRank !== null) {
        distribution[gameRank]++;
      }
    }
  }
  
  return distribution;
}

// ==================== 级数建议函数 ====================

/**
 * 基于手牌建议最佳级数
 * @param cards 手牌
 * @returns 建议的级数列表（按优先级排序）
 */
export function suggestBestRank(cards: Card[]): GameRank[] {
  const distribution = getRankDistribution(cards);
  
  // 计算每个级数的得分
  const scores: Array<{ rank: GameRank; score: number }> = [];
  
  for (const rank of VALID_RANKS) {
    let score = 0;
    
    // 基础得分：该级数的卡牌数量
    score += distribution[rank] * 10;
    
    // 红心加分（配牌优势）
    const heartsCount = cards.filter(card => 
      card.suit === Suit.HEARTS && card.rank === rank
    ).length;
    score += heartsCount * 20;
    
    // 考虑相邻级数的卡牌数量（连续性优势）
    const nextRank = getNextRank(rank);
    const prevRank = getPreviousRank(rank);
    score += (distribution[nextRank] + distribution[prevRank]) * 2;
    
    scores.push({ rank, score });
  }
  
  // 按得分排序返回
  return scores
    .sort((a, b) => b.score - a.score)
    .map(item => item.rank);
}

/**
 * 检查级数变更是否合理
 * @param fromRank 当前级数
 * @param toRank 目标级数
 * @param playerCards 玩家手牌（可选）
 * @returns 变更建议
 */
export function validateRankChange(
  fromRank: GameRank, 
  toRank: GameRank, 
  playerCards?: Card[]
): {
  isValid: boolean;
  reason?: string;
  suggestion?: GameRank;
} {
  validateRank(fromRank);
  validateRank(toRank);
  
  if (fromRank === toRank) {
    return { isValid: false, reason: '级数没有变化' };
  }
  
  // 如果提供了手牌，分析变更的合理性
  if (playerCards) {
    const currentStats = countRankCards(playerCards, fromRank);
    const newStats = countRankCards(playerCards, toRank);
    
    // 如果新级数的总体优势更小，给出警告
    if (newStats.rankCards + newStats.wildCards * 2 < currentStats.rankCards + currentStats.wildCards * 2) {
      const suggestions = suggestBestRank(playerCards);
      return {
        isValid: true,
        reason: '新级数可能不如当前级数有利',
        suggestion: suggestions[0]
      };
    }
  }
  
  return { isValid: true };
}

// ==================== 工具函数导出 ====================

export default {
  // 验证函数
  isValidRank,
  validateRank,
  toValidRank,
  
  // 转换函数
  getRankName,
  getFullRankName,
  getRankFromDisplayName,
  rankToGameRank,
  gameRankToRank,
  
  // 循环函数
  getNextRank,
  getPreviousRank,
  getRankAfterSteps,
  getRankDistance,
  
  // 判断函数
  isRankCard,
  isWildCard,
  isJoker,
  isNormalCard,
  
  // 排序函数
  getStandardCardOrderValue,
  getCardOrderValue,
  compareCards,
  
  // 统计函数
  countRankCards,
  getRankDistribution,
  
  // 建议函数
  suggestBestRank,
  validateRankChange
};