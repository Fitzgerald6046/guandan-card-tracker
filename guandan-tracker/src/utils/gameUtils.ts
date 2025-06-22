/**
 * 掼蛋游戏工具函数
 * 支持完整的类型系统和游戏逻辑
 */

import type { 
  Card, 
  CreateCardParams, 
  GameRank, 
  Player, 
  PlayerPosition, 
  Team,
  PlayType,
  TouchSelectState,
  GameState
} from '../types/game';

import { 
  Suit, 
  Rank, 
  PlayerPosition as Pos,
  GAME_CONSTANTS,
  isGameRank,
  isJoker,
  isRankCard,
  isWildCard
} from '../types/game';

// ==================== 卡牌工具函数 ====================

/**
 * 创建单张卡牌
 */
export function createCard(params: CreateCardParams): Card {
  const { suit, rank, currentRank, position } = params;
  const timestamp = Date.now();
  
  const card: Card = {
    id: `${suit || 'joker'}-${rank}-${timestamp}`,
    suit,
    rank,
    isRankCard: isRankCard({ suit, rank } as Card, currentRank),
    isWildCard: isWildCard({ suit, rank } as Card, currentRank),
    isPlayed: false,
    isSelected: false,
    position,
    timestamp
  };

  return card;
}

/**
 * 生成标准52张牌（不包括大小王）
 */
export function generateStandardDeck(currentRank: GameRank): Card[] {
  const suits = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS];
  const ranks = [
    Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
    Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE
  ];
  
  const cards: Card[] = [];
  
  suits.forEach(suit => {
    ranks.forEach(rank => {
      cards.push(createCard({ suit, rank, currentRank }));
    });
  });
  
  return cards;
}

/**
 * 生成完整双副牌（108张）
 */
export function generateDoubleDeck(currentRank: GameRank): Card[] {
  // 生成两副标准牌
  const firstDeck = generateStandardDeck(currentRank);
  const secondDeck = generateStandardDeck(currentRank).map(card => ({
    ...card,
    id: `${card.id}-deck2`
  }));
  
  // 添加大小王（每副2张，共4张）
  const jokers: Card[] = [
    createCard({ suit: null, rank: Rank.JOKER_SMALL, currentRank }),
    createCard({ suit: null, rank: Rank.JOKER_BIG, currentRank }),
    createCard({ suit: null, rank: Rank.JOKER_SMALL, currentRank }),
    createCard({ suit: null, rank: Rank.JOKER_BIG, currentRank })
  ].map((card, index) => ({
    ...card,
    id: `${card.id}-${index}`
  }));
  
  return [...firstDeck, ...secondDeck, ...jokers];
}

/**
 * 更新卡牌的级牌和配牌状态
 */
export function updateCardRankStatus(cards: Card[], currentRank: GameRank): Card[] {
  return cards.map(card => ({
    ...card,
    isRankCard: isRankCard(card, currentRank),
    isWildCard: isWildCard(card, currentRank)
  }));
}

/**
 * 洗牌算法（Fisher-Yates）
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
 * 按掼蛋规则排序卡牌
 * 排序优先级：配牌 > 级牌 > 王牌 > 普通牌（按花色和点数）
 */
export function sortCardsByGuandanRule(cards: Card[], currentRank: GameRank): Card[] {
  return [...cards].sort((a, b) => {
    // 1. 配牌最优先
    if (a.isWildCard && !b.isWildCard) return -1;
    if (!a.isWildCard && b.isWildCard) return 1;
    
    // 2. 级牌次优先
    if (a.isRankCard && !b.isRankCard) return -1;
    if (!a.isRankCard && b.isRankCard) return 1;
    
    // 3. 王牌排在后面
    const aIsJoker = isJoker(a);
    const bIsJoker = isJoker(b);
    if (aIsJoker && !bIsJoker) return 1;
    if (!aIsJoker && bIsJoker) return -1;
    if (aIsJoker && bIsJoker) return a.rank - b.rank; // 小王在前
    
    // 4. 普通牌按花色和点数排序
    if (a.suit !== b.suit) {
      const suitOrder = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS];
      return suitOrder.indexOf(a.suit!) - suitOrder.indexOf(b.suit!);
    }
    
    return a.rank - b.rank;
  });
}

/**
 * 发牌给四个玩家
 */
export function dealCardsToPlayers(cards: Card[]): Card[][] {
  if (cards.length !== GAME_CONSTANTS.TOTAL_CARDS) {
    throw new Error(`Expected ${GAME_CONSTANTS.TOTAL_CARDS} cards, got ${cards.length}`);
  }
  
  const hands: Card[][] = [[], [], [], []];
  
  // 轮流发牌
  cards.forEach((card, index) => {
    const playerIndex = index % GAME_CONSTANTS.PLAYER_COUNT;
    hands[playerIndex].push({
      ...card,
      position: hands[playerIndex].length
    });
  });
  
  return hands;
}

// ==================== 级数工具函数 ====================

/**
 * 获取下一级数
 */
export function getNextRank(current: GameRank): GameRank {
  if (current === GAME_CONSTANTS.RANK_RANGE.MAX) {
    return GAME_CONSTANTS.RANK_RANGE.MIN;
  }
  return (current + 1) as GameRank;
}

/**
 * 获取上一级数
 */
export function getPreviousRank(current: GameRank): GameRank {
  if (current === GAME_CONSTANTS.RANK_RANGE.MIN) {
    return GAME_CONSTANTS.RANK_RANGE.MAX;
  }
  return (current - 1) as GameRank;
}

/**
 * 验证级数范围
 */
export function validateRank(rank: number): GameRank {
  if (!isGameRank(rank)) {
    throw new Error(`Invalid rank: ${rank}. Must be between ${GAME_CONSTANTS.RANK_RANGE.MIN} and ${GAME_CONSTANTS.RANK_RANGE.MAX}`);
  }
  return rank;
}

// ==================== 玩家工具函数 ====================

/**
 * 根据位置确定队伍
 */
export function getTeamByPosition(position: PlayerPosition): Team {
  if (position === Pos.BOTTOM || position === Pos.TOP) {
    return 1; // 队伍1：上下
  }
  return 2; // 队伍2：左右
}

/**
 * 获取下一个玩家位置
 */
export function getNextPlayerPosition(current: PlayerPosition): PlayerPosition {
  const positions = [Pos.BOTTOM, Pos.LEFT, Pos.TOP, Pos.RIGHT];
  const currentIndex = positions.indexOf(current);
  const nextIndex = (currentIndex + 1) % positions.length;
  return positions[nextIndex];
}

/**
 * 创建玩家对象
 */
export function createPlayer(
  id: string,
  name: string,
  position: PlayerPosition,
  cards: Card[] = []
): Player {
  return {
    id,
    name,
    position,
    team: getTeamByPosition(position),
    cards,
    remainingCount: cards.length,
    isCurrentPlayer: false,
    stats: {
      playedCards: 0,
      rankCardCount: cards.filter(card => card.isRankCard).length,
      wildCardCount: cards.filter(card => card.isWildCard).length,
      roundWins: 0
    }
  };
}

/**
 * 更新玩家统计信息
 */
export function updatePlayerStats(player: Player): Player {
  const rankCardCount = player.cards.filter(card => card.isRankCard).length;
  const wildCardCount = player.cards.filter(card => card.isWildCard).length;
  
  return {
    ...player,
    remainingCount: player.cards.filter(card => !card.isPlayed).length,
    stats: {
      ...player.stats,
      rankCardCount,
      wildCardCount
    }
  };
}

// ==================== 出牌类型判断 ====================

/**
 * 判断出牌类型
 */
export function determinePlayType(cards: Card[]): PlayType | null {
  if (cards.length === 0) return null;
  
  const sortedCards = [...cards].sort((a, b) => a.rank - b.rank);
  const rankCounts = new Map<number, number>();
  
  // 统计每个点数的数量
  sortedCards.forEach(card => {
    const count = rankCounts.get(card.rank) || 0;
    rankCounts.set(card.rank, count + 1);
  });
  
  const counts = Array.from(rankCounts.values()).sort((a, b) => b - a);
  const uniqueRanks = Array.from(rankCounts.keys()).sort((a, b) => a - b);
  
  // 判断出牌类型
  switch (cards.length) {
    case 1:
      return 'single';
      
    case 2:
      if (counts[0] === 2) return 'pair';
      break;
      
    case 3:
      if (counts[0] === 3) return 'triple';
      break;
      
    case 4:
      if (counts[0] === 4) return 'bomb_four';
      break;
      
    case 5:
      if (counts[0] === 5) return 'bomb_five';
      if (counts[0] === 3 && counts[1] === 2) return 'triple_with_pair';
      if (isConsecutive(uniqueRanks) && allSameSuit(sortedCards)) return 'straight_flush';
      if (isConsecutive(uniqueRanks)) return 'straight';
      break;
      
    case 6:
      if (counts[0] === 6) return 'bomb_six';
      if (isConsecutivePairs(rankCounts, 3)) return 'pair_straight';
      if (isConsecutiveTriples(rankCounts, 2)) return 'triple_straight';
      if (isConsecutive(uniqueRanks) && allSameSuit(sortedCards)) return 'straight_flush';
      if (isConsecutive(uniqueRanks)) return 'straight';
      break;
      
    default:
      // 处理更长的牌型
      if (counts[0] >= 7) {
        switch (counts[0]) {
          case 7: return 'bomb_seven';
          case 8: return 'bomb_eight';
        }
      }
      
      if (isConsecutive(uniqueRanks) && allSameSuit(sortedCards)) return 'straight_flush';
      if (isConsecutive(uniqueRanks)) return 'straight';
      if (isConsecutivePairs(rankCounts, cards.length / 2)) return 'pair_straight';
      if (isConsecutiveTriples(rankCounts, cards.length / 3)) return 'triple_straight';
      break;
  }
  
  return null;
}

/**
 * 检查是否为连续的点数
 */
function isConsecutive(ranks: number[]): boolean {
  if (ranks.length < 2) return false;
  
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) {
      return false;
    }
  }
  
  return true;
}

/**
 * 检查是否都是同一花色
 */
function allSameSuit(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  const firstSuit = cards[0].suit;
  return cards.every(card => card.suit === firstSuit);
}

/**
 * 检查是否为连续对子
 */
function isConsecutivePairs(rankCounts: Map<number, number>, expectedPairs: number): boolean {
  if (rankCounts.size !== expectedPairs) return false;
  
  const ranks = Array.from(rankCounts.keys()).sort((a, b) => a - b);
  
  // 检查每个点数都是对子
  for (const rank of ranks) {
    if (rankCounts.get(rank) !== 2) return false;
  }
  
  // 检查是否连续
  return isConsecutive(ranks);
}

/**
 * 检查是否为连续三张
 */
function isConsecutiveTriples(rankCounts: Map<number, number>, expectedTriples: number): boolean {
  if (rankCounts.size !== expectedTriples) return false;
  
  const ranks = Array.from(rankCounts.keys()).sort((a, b) => a - b);
  
  // 检查每个点数都是三张
  for (const rank of ranks) {
    if (rankCounts.get(rank) !== 3) return false;
  }
  
  // 检查是否连续
  return isConsecutive(ranks);
}

// ==================== 触摸选择工具 ====================

/**
 * 处理触摸选择范围
 */
export function getCardsInRange(
  startCard: Card,
  endCard: Card,
  allCards: Card[]
): Card[] {
  const startIndex = allCards.findIndex(card => card.id === startCard.id);
  const endIndex = allCards.findIndex(card => card.id === endCard.id);
  
  if (startIndex === -1 || endIndex === -1) return [];
  
  const minIndex = Math.min(startIndex, endIndex);
  const maxIndex = Math.max(startIndex, endIndex);
  
  return allCards.slice(minIndex, maxIndex + 1);
}

/**
 * 切换卡牌选中状态
 */
export function toggleCardSelection(cards: Card[], cardId: string): Card[] {
  return cards.map(card => 
    card.id === cardId 
      ? { ...card, isSelected: !card.isSelected }
      : card
  );
}

/**
 * 批量设置卡牌选中状态
 */
export function setCardsSelection(cards: Card[], cardIds: string[], selected: boolean): Card[] {
  const cardIdSet = new Set(cardIds);
  return cards.map(card => 
    cardIdSet.has(card.id)
      ? { ...card, isSelected: selected }
      : card
  );
}

// ==================== 游戏状态工具 ====================

/**
 * 获取玩家的级牌数量
 */
export function getPlayerRankCardCount(player: Player): number {
  return player.cards.filter(card => card.isRankCard && !card.isPlayed).length;
}

/**
 * 获取玩家的配牌数量
 */
export function getPlayerWildCardCount(player: Player): number {
  return player.cards.filter(card => card.isWildCard && !card.isPlayed).length;
}

/**
 * 检查游戏是否结束
 */
export function isGameFinished(players: Player[]): boolean {
  return players.some(player => player.remainingCount === 0);
}

/**
 * 获取获胜队伍
 */
export function getWinningTeam(players: Player[]): Team | null {
  const finishedPlayer = players.find(player => player.remainingCount === 0);
  return finishedPlayer ? finishedPlayer.team : null;
}

/**
 * 验证出牌是否有效
 */
export function isValidPlay(
  cards: Card[],
  lastPlay?: { cards: Card[]; type: PlayType }
): boolean {
  if (cards.length === 0) return false;
  
  const playType = determinePlayType(cards);
  if (!playType) return false;
  
  // 如果没有上家出牌，任何有效牌型都可以
  if (!lastPlay) return true;
  
  // 必须是相同类型的牌型
  if (playType !== lastPlay.type) {
    // 炸弹可以压任何牌型
    return playType.startsWith('bomb_');
  }
  
  // TODO: 实现具体的大小比较逻辑
  return true;
}

export default {
  createCard,
  generateStandardDeck,
  generateDoubleDeck,
  updateCardRankStatus,
  shuffleCards,
  sortCardsByGuandanRule,
  dealCardsToPlayers,
  getNextRank,
  getPreviousRank,
  validateRank,
  getTeamByPosition,
  getNextPlayerPosition,
  createPlayer,
  updatePlayerStats,
  determinePlayType,
  getCardsInRange,
  toggleCardSelection,
  setCardsSelection,
  getPlayerRankCardCount,
  getPlayerWildCardCount,
  isGameFinished,
  getWinningTeam,
  isValidPlay
};