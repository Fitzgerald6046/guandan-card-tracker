/**
 * 掼蛋卡牌数据生成工具
 * 提供完整的108张牌生成功能，自动标记级牌和配牌
 */

import type { Card, GameRank, CreateCardParams } from '../types/game';
import { Suit, Rank } from '../types/game';
import { 
  GAME_CONFIG, 
  STANDARD_RANK_ORDER,
  SUIT_ORDER,
  GUANDAN_SORT_WEIGHTS
} from './constants';
import { 
  isRankCard, 
  isWildCard, 
  getCardOrderValue,
  validateRank 
} from './rankUtils';

// ==================== 卡牌创建函数 ====================

/**
 * 创建单张卡牌
 * @param params 卡牌创建参数
 * @returns 完整的卡牌对象
 */
export function createCard(params: CreateCardParams): Card {
  const { suit, rank, currentRank, position } = params;
  const timestamp = Date.now() + Math.random(); // 添加随机数确保唯一性
  
  // 生成唯一ID
  const suitPrefix = suit ? suit.charAt(0) : 'joker';
  const id = `${suitPrefix}_${rank}_${timestamp.toString(36)}`;
  
  const card: Card = {
    id,
    suit,
    rank,
    isRankCard: false, // 将在下面设置
    isWildCard: false, // 将在下面设置
    isPlayed: false,
    isSelected: false,
    position,
    timestamp: Math.floor(timestamp)
  };
  
  // 设置级牌和配牌属性
  card.isRankCard = isRankCard(card, currentRank);
  card.isWildCard = isWildCard(card, currentRank);
  
  return card;
}

/**
 * 批量创建相同类型的卡牌
 * @param suit 花色
 * @param rank 牌面
 * @param count 数量
 * @param currentRank 当前级数
 * @returns 卡牌数组
 */
export function createCards(
  suit: Suit | null, 
  rank: Rank, 
  count: number, 
  currentRank: GameRank
): Card[] {
  const cards: Card[] = [];
  
  for (let i = 0; i < count; i++) {
    cards.push(createCard({
      suit,
      rank,
      currentRank,
      position: i
    }));
  }
  
  return cards;
}

// ==================== 标准牌组生成 ====================

/**
 * 生成单副52张标准牌（不包含王牌）
 * @param currentRank 当前级数
 * @returns 52张标准牌
 */
export function generateStandardDeck(currentRank: GameRank): Card[] {
  validateRank(currentRank);
  
  const cards: Card[] = [];
  const suits = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS];
  const ranks = [
    Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
    Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE
  ];
  
  let cardIndex = 0;
  
  for (const suit of suits) {
    for (const rank of ranks) {
      cards.push(createCard({
        suit,
        rank,
        currentRank,
        position: cardIndex++
      }));
    }
  }
  
  return cards;
}

/**
 * 生成王牌
 * @param currentRank 当前级数
 * @returns 大小王数组
 */
export function generateJokers(currentRank: GameRank): Card[] {
  validateRank(currentRank);
  
  return [
    createCard({
      suit: null,
      rank: Rank.JOKER_SMALL,
      currentRank,
      position: 0
    }),
    createCard({
      suit: null,
      rank: Rank.JOKER_BIG,
      currentRank,
      position: 1
    })
  ];
}

/**
 * 生成完整单副牌（54张：52张标准牌 + 2张王牌）
 * @param currentRank 当前级数
 * @returns 54张牌的完整单副牌
 */
export function generateSingleDeck(currentRank: GameRank): Card[] {
  const standardCards = generateStandardDeck(currentRank);
  const jokers = generateJokers(currentRank);
  
  return [...standardCards, ...jokers];
}

// ==================== 双副牌生成 ====================

/**
 * 生成108张完整双副牌
 * @param currentRank 当前级数
 * @returns 108张牌的数组，自动标记级牌和配牌
 */
export function generateCards(currentRank: GameRank): Card[] {
  validateRank(currentRank);
  
  // 生成第一副牌
  const firstDeck = generateSingleDeck(currentRank);
  
  // 生成第二副牌（通过复制第一副牌并更新ID和位置）
  const secondDeck = firstDeck.map((card, index) => ({
    ...card,
    id: `${card.id}_deck2`,
    position: GAME_CONFIG.CARDS_PER_DECK + index,
    timestamp: card.timestamp + 1 // 确保时间戳不同
  }));
  
  // 合并两副牌
  const allCards = [...firstDeck, ...secondDeck];
  
  // 验证总数
  if (allCards.length !== GAME_CONFIG.TOTAL_CARDS) {
    throw new Error(`Expected ${GAME_CONFIG.TOTAL_CARDS} cards, but generated ${allCards.length}`);
  }
  
  return allCards;
}

// ==================== 卡牌更新函数 ====================

/**
 * 更新卡牌的级牌和配牌状态
 * @param cards 卡牌数组
 * @param newRank 新的级数
 * @returns 更新后的卡牌数组
 */
export function updateCardRankStatus(cards: Card[], newRank: GameRank): Card[] {
  validateRank(newRank);
  
  return cards.map(card => {
    const updatedCard = { ...card };
    updatedCard.isRankCard = isRankCard(updatedCard, newRank);
    updatedCard.isWildCard = isWildCard(updatedCard, newRank);
    return updatedCard;
  });
}

/**
 * 批量更新卡牌属性
 * @param cards 卡牌数组
 * @param updates 更新映射 {cardId: updates}
 * @returns 更新后的卡牌数组
 */
export function updateCards(
  cards: Card[], 
  updates: Record<string, Partial<Card>>
): Card[] {
  return cards.map(card => {
    const cardUpdates = updates[card.id];
    return cardUpdates ? { ...card, ...cardUpdates } : card;
  });
}

/**
 * 重置所有卡牌到初始状态
 * @param cards 卡牌数组
 * @param currentRank 当前级数
 * @returns 重置后的卡牌数组
 */
export function resetCards(cards: Card[], currentRank: GameRank): Card[] {
  return cards.map(card => ({
    ...card,
    isRankCard: isRankCard(card, currentRank),
    isWildCard: isWildCard(card, currentRank),
    isPlayed: false,
    isSelected: false
  }));
}

// ==================== 卡牌洗牌函数 ====================

/**
 * 使用 Fisher-Yates 算法洗牌
 * @param cards 要洗牌的卡牌数组
 * @returns 洗牌后的新数组
 */
export function shuffleCards<T extends Card>(cards: T[]): T[] {
  const shuffled = [...cards];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

/**
 * 多次洗牌以确保随机性
 * @param cards 要洗牌的卡牌数组
 * @param rounds 洗牌轮数（默认3轮）
 * @returns 洗牌后的新数组
 */
export function thoroughShuffle<T extends Card>(cards: T[], rounds: number = 3): T[] {
  let result = [...cards];
  
  for (let i = 0; i < rounds; i++) {
    result = shuffleCards(result);
  }
  
  return result;
}

// ==================== 卡牌排序函数 ====================

/**
 * 按掼蛋规则排序卡牌
 * 排序优先级：配牌 > 级牌 > 大王 > 小王 > 普通牌（按花色和点数）
 * @param cards 要排序的卡牌数组
 * @param currentRank 当前级数
 * @returns 排序后的新数组
 */
export function sortCardsByGuandanRule(cards: Card[], currentRank: GameRank): Card[] {
  validateRank(currentRank);
  
  return [...cards].sort((a, b) => {
    // 使用已有的排序值计算函数
    const valueA = getCardOrderValue(a, currentRank);
    const valueB = getCardOrderValue(b, currentRank);
    
    // 主要按排序值排序（降序，高价值在前）
    if (valueA !== valueB) {
      return valueB - valueA;
    }
    
    // 如果排序值相同，按花色排序
    if (a.suit && b.suit) {
      const suitCompare = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
      if (suitCompare !== 0) {
        return suitCompare;
      }
    }
    
    // 最后按时间戳排序（保证稳定性）
    return a.timestamp - b.timestamp;
  });
}

/**
 * 按标准规则排序（不考虑级牌）
 * @param cards 要排序的卡牌数组
 * @returns 排序后的新数组
 */
export function sortCardsByStandardRule(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    // 王牌在最后
    if (a.suit === null && b.suit !== null) return 1;
    if (a.suit !== null && b.suit === null) return -1;
    if (a.suit === null && b.suit === null) {
      return STANDARD_RANK_ORDER[a.rank] - STANDARD_RANK_ORDER[b.rank];
    }
    
    // 按花色排序
    const suitCompare = SUIT_ORDER[a.suit!] - SUIT_ORDER[b.suit!];
    if (suitCompare !== 0) return suitCompare;
    
    // 按牌面排序
    return STANDARD_RANK_ORDER[a.rank] - STANDARD_RANK_ORDER[b.rank];
  });
}

// ==================== 发牌函数 ====================

/**
 * 将卡牌发给四个玩家
 * @param cards 要发的卡牌（应该是108张）
 * @returns 四个玩家的手牌数组
 */
export function dealCardsToPlayers(cards: Card[]): [Card[], Card[], Card[], Card[]] {
  if (cards.length !== GAME_CONFIG.TOTAL_CARDS) {
    throw new Error(`Expected ${GAME_CONFIG.TOTAL_CARDS} cards for dealing, got ${cards.length}`);
  }
  
  const hands: [Card[], Card[], Card[], Card[]] = [[], [], [], []];
  
  // 轮流发牌
  cards.forEach((card, index) => {
    const playerIndex = index % GAME_CONFIG.PLAYER_COUNT as 0 | 1 | 2 | 3;
    hands[playerIndex].push({
      ...card,
      position: hands[playerIndex].length
    });
  });
  
  // 验证每个玩家的牌数
  hands.forEach((hand, index) => {
    if (hand.length !== GAME_CONFIG.CARDS_PER_PLAYER) {
      throw new Error(`Player ${index} should have ${GAME_CONFIG.CARDS_PER_PLAYER} cards, got ${hand.length}`);
    }
  });
  
  return hands;
}

/**
 * 生成并发牌的完整流程
 * @param currentRank 当前级数
 * @param shouldShuffle 是否洗牌（默认为true）
 * @returns 包含所有卡牌和四个玩家手牌的对象
 */
export function generateAndDealCards(currentRank: GameRank, shouldShuffle: boolean = true): {
  allCards: Card[];
  playerHands: [Card[], Card[], Card[], Card[]];
} {
  // 生成所有卡牌
  let allCards = generateCards(currentRank);
  
  // 洗牌
  if (shouldShuffle) {
    allCards = thoroughShuffle(allCards);
  }
  
  // 发牌
  const playerHands = dealCardsToPlayers(allCards);
  
  return {
    allCards,
    playerHands
  };
}

// ==================== 卡牌统计函数 ====================

/**
 * 统计卡牌类型分布
 * @param cards 卡牌数组
 * @param currentRank 当前级数
 * @returns 详细的统计信息
 */
export function analyzeCardDistribution(cards: Card[], currentRank: GameRank): {
  total: number;
  byType: {
    wildCards: number;    // 配牌（红心级牌）
    rankCards: number;    // 级牌（非红心）
    jokers: number;       // 王牌
    normalCards: number;  // 普通牌
  };
  bySuit: Record<Suit, number> & { jokers: number };
  byRank: Record<Rank, number>;
  rankCardsBySuit: Record<Suit, number>;
} {
  validateRank(currentRank);
  
  const stats = {
    total: cards.length,
    byType: {
      wildCards: 0,
      rankCards: 0,
      jokers: 0,
      normalCards: 0
    },
    bySuit: {
      [Suit.SPADES]: 0,
      [Suit.HEARTS]: 0,
      [Suit.DIAMONDS]: 0,
      [Suit.CLUBS]: 0,
      jokers: 0
    },
    byRank: {} as Record<Rank, number>,
    rankCardsBySuit: {
      [Suit.SPADES]: 0,
      [Suit.HEARTS]: 0,
      [Suit.DIAMONDS]: 0,
      [Suit.CLUBS]: 0
    }
  };
  
  // 初始化牌面统计
  Object.values(Rank).forEach(rank => {
    stats.byRank[rank] = 0;
  });
  
  // 遍历统计
  for (const card of cards) {
    // 按类型统计
    if (card.isWildCard) {
      stats.byType.wildCards++;
    } else if (card.isRankCard) {
      stats.byType.rankCards++;
    } else if (card.suit === null) {
      stats.byType.jokers++;
    } else {
      stats.byType.normalCards++;
    }
    
    // 按花色统计
    if (card.suit === null) {
      stats.bySuit.jokers++;
    } else {
      stats.bySuit[card.suit]++;
    }
    
    // 按牌面统计
    stats.byRank[card.rank]++;
    
    // 级牌按花色统计
    if (card.isRankCard && card.suit) {
      stats.rankCardsBySuit[card.suit]++;
    }
  }
  
  return stats;
}

/**
 * 验证卡牌组合的完整性
 * @param cards 要验证的卡牌数组
 * @param expectedCount 期望的卡牌总数
 * @returns 验证结果
 */
export function validateCardSet(cards: Card[], expectedCount: number = GAME_CONFIG.TOTAL_CARDS): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 检查总数
  if (cards.length !== expectedCount) {
    errors.push(`Expected ${expectedCount} cards, got ${cards.length}`);
  }
  
  // 检查重复ID
  const idSet = new Set<string>();
  const duplicateIds: string[] = [];
  
  for (const card of cards) {
    if (idSet.has(card.id)) {
      duplicateIds.push(card.id);
    }
    idSet.add(card.id);
  }
  
  if (duplicateIds.length > 0) {
    errors.push(`Duplicate card IDs found: ${duplicateIds.join(', ')}`);
  }
  
  // 检查牌面分布（针对完整双副牌）
  if (expectedCount === GAME_CONFIG.TOTAL_CARDS) {
    const rankCounts: Record<string, number> = {};
    
    for (const card of cards) {
      const key = card.suit ? `${card.suit}_${card.rank}` : `joker_${card.rank}`;
      rankCounts[key] = (rankCounts[key] || 0) + 1;
    }
    
    // 检查每种牌应该有2张
    for (const [key, count] of Object.entries(rankCounts)) {
      if (count !== 2) {
        if (key.includes('joker')) {
          warnings.push(`${key} should appear 2 times, found ${count}`);
        } else {
          errors.push(`${key} should appear 2 times, found ${count}`);
        }
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// ==================== 工具函数导出 ====================

export default {
  // 基础创建函数
  createCard,
  createCards,
  
  // 生成函数
  generateStandardDeck,
  generateJokers,
  generateSingleDeck,
  generateCards,
  
  // 更新函数
  updateCardRankStatus,
  updateCards,
  resetCards,
  
  // 洗牌函数
  shuffleCards,
  thoroughShuffle,
  
  // 排序函数
  sortCardsByGuandanRule,
  sortCardsByStandardRule,
  
  // 发牌函数
  dealCardsToPlayers,
  generateAndDealCards,
  
  // 统计函数
  analyzeCardDistribution,
  validateCardSet
};