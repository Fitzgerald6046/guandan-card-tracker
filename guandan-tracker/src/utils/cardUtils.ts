import type { Card } from '../types';
import { Suit, Rank } from '../types';

// 生成完整的一副牌（不包括大小王）
export const generateDeck = (): Card[] => {
  const suits = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS];
  const ranks = [
    Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
    Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE
  ];
  
  const cards: Card[] = [];
  
  // 生成普通牌
  suits.forEach(suit => {
    ranks.forEach(rank => {
      cards.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        isUsed: false,
        isSelected: false
      });
    });
  });
  
  return cards;
};

// 生成双副牌（掼蛋使用两副牌）
export const generateDoubleDeck = (): Card[] => {
  const firstDeck = generateDeck();
  const secondDeck = generateDeck().map(card => ({
    ...card,
    id: `${card.id}-2`
  }));
  
  // 添加大小王
  const jokers: Card[] = [
    {
      id: 'joker-small-1',
      suit: null,
      rank: Rank.JOKER_SMALL,
      isUsed: false,
      isSelected: false
    },
    {
      id: 'joker-big-1',
      suit: null,
      rank: Rank.JOKER_BIG,
      isUsed: false,
      isSelected: false
    },
    {
      id: 'joker-small-2',
      suit: null,
      rank: Rank.JOKER_SMALL,
      isUsed: false,
      isSelected: false
    },
    {
      id: 'joker-big-2',
      suit: null,
      rank: Rank.JOKER_BIG,
      isUsed: false,
      isSelected: false
    }
  ];
  
  return [...firstDeck, ...secondDeck, ...jokers];
};

// 标记级牌
export const markLevelCards = (cards: Card[], level: Rank): Card[] => {
  return cards.map(card => ({
    ...card,
    isLevel: card.rank === level,
    isRed: card.rank === level && card.suit === Suit.HEARTS
  }));
};

// 洗牌
export const shuffleCards = (cards: Card[]): Card[] => {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// 发牌给玩家
export const dealCards = (cards: Card[], playerCount: number = 4): Card[][] => {
  const hands: Card[][] = Array(playerCount).fill(null).map(() => []);
  const cardsPerPlayer = Math.floor(cards.length / playerCount);
  
  for (let i = 0; i < playerCount; i++) {
    hands[i] = cards.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
  }
  
  return hands;
};

// 按花色和点数排序
export const sortCards = (cards: Card[]): Card[] => {
  const suitOrder = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS];
  const rankOrder = [
    Rank.ACE, Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX,
    Rank.SEVEN, Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN,
    Rank.KING, Rank.JOKER_SMALL, Rank.JOKER_BIG
  ];
  
  return [...cards].sort((a, b) => {
    // 王牌排在最后
    if (a.suit === null && b.suit !== null) return 1;
    if (a.suit !== null && b.suit === null) return -1;
    if (a.suit === null && b.suit === null) {
      return rankOrder.findIndex(r => r === a.rank) - rankOrder.findIndex(r => r === b.rank);
    }
    
    // 先按花色排序
    const suitComparison = suitOrder.findIndex(s => s === a.suit!) - suitOrder.findIndex(s => s === b.suit!);
    if (suitComparison !== 0) return suitComparison;
    
    // 再按点数排序
    return rankOrder.findIndex(r => r === a.rank) - rankOrder.findIndex(r => r === b.rank);
  });
};

// 根据级数排序（级牌优先）
export const sortCardsByLevel = (cards: Card[]): Card[] => {
  return [...cards].sort((a, b) => {
    // 级牌排在前面
    if (a.isLevel && !b.isLevel) return -1;
    if (!a.isLevel && b.isLevel) return 1;
    
    // 红心级牌排在最前面
    if (a.isRed && !b.isRed) return -1;
    if (!a.isRed && b.isRed) return 1;
    
    // 其他按正常顺序排序
    return 0;
  });
};

// 获取牌的显示名称
export const getCardDisplayName = (card: Card): string => {
  if (card.rank === Rank.JOKER_SMALL) return '小王';
  if (card.rank === Rank.JOKER_BIG) return '大王';
  
  const suitName = {
    [Suit.SPADES]: '♠',
    [Suit.HEARTS]: '♥',
    [Suit.DIAMONDS]: '♦',
    [Suit.CLUBS]: '♣'
  }[card.suit!] || '';
  
  return `${suitName}${card.rank}`;
};

// 检查是否为连续的牌
export const isConsecutiveCards = (cards: Card[]): boolean => {
  if (cards.length < 2) return false;
  
  const sortedCards = sortCards(cards);
  const rankOrder = [
    Rank.ACE, Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX,
    Rank.SEVEN, Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING
  ];
  
  for (let i = 1; i < sortedCards.length; i++) {
    const currentIndex = rankOrder.findIndex(r => r === sortedCards[i].rank);
    const prevIndex = rankOrder.findIndex(r => r === sortedCards[i - 1].rank);
    
    if (currentIndex !== prevIndex + 1) {
      return false;
    }
  }
  
  return true;
};