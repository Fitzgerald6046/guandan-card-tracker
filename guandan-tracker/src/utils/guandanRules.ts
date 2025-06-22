/**
 * 掼蛋牌型判断规则
 */

export type CardRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
export type PlayerPosition = 'bottom' | 'left' | 'top' | 'right';

export interface Card {
  id: string;
  rank: CardRank;
  isRankCard: boolean;
  isWildCard: boolean;
  displayName: string;
}

export interface CardType {
  type: 'single' | 'pair' | 'triple' | 'triple_with_pair' | 'airplane' | 'consecutive_pairs' | 'straight' | 'bomb' | 'flush_straight' | 'invalid';
  description: string;
  isValid: boolean;
  cardCount?: number; // 用于比较牌型大小
}

/**
 * 获取卡牌的有效排序值
 * 考虑级数牌和配牌的特殊规则
 */
function getCardSortValue(card: Card, currentRank: CardRank): number {
  if (card.rank === 15) return 100; // 王牌
  if (card.isWildCard) return 50 + card.rank; // 配牌
  if (card.rank === currentRank) return 50 + card.rank; // 级数牌
  return card.rank; // 普通牌
}

/**
 * 获取连续性检查的标准值
 * 用于顺子检查，配牌可以代替任意牌
 */
function getCardSequenceValue(card: Card, currentRank: CardRank): number | null {
  if (card.isWildCard) return null; // 配牌可以代替任意牌
  if (card.rank === 15) return null; // 王牌不参与顺子
  return card.rank;
}

/**
 * 统计牌型分布
 */
function getCardCounts(cards: Card[], currentRank: CardRank): Map<number, number> {
  const counts = new Map<number, number>();
  
  cards.forEach(card => {
    const value = getCardSortValue(card, currentRank);
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  
  return counts;
}

/**
 * 检查是否为单张
 */
function isSingle(cards: Card[]): CardType {
  if (cards.length === 1) {
    return {
      type: 'single',
      description: `单张: ${cards[0].displayName}`,
      isValid: true,
      cardCount: 1
    };
  }
  return {
    type: 'invalid',
    description: '不是单张',
    isValid: false
  };
}

/**
 * 检查是否为对子
 */
function isPair(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length !== 2) {
    return {
      type: 'invalid',
      description: '不是对子',
      isValid: false
    };
  }
  
  const counts = getCardCounts(cards, currentRank);
  const countValues = Array.from(counts.values());
  
  if (countValues.length === 1 && countValues[0] === 2) {
    return {
      type: 'pair',
      description: `对子: ${cards[0].displayName}${cards[1].displayName}`,
      isValid: true,
      cardCount: 2
    };
  }
  
  return {
    type: 'invalid',
    description: '不是对子',
    isValid: false
  };
}

/**
 * 检查是否为三不带
 */
function isTriple(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length !== 3) {
    return {
      type: 'invalid',
      description: '不是三不带',
      isValid: false
    };
  }
  
  const counts = getCardCounts(cards, currentRank);
  const countValues = Array.from(counts.values());
  
  if (countValues.length === 1 && countValues[0] === 3) {
    return {
      type: 'triple',
      description: `三不带: ${cards[0].displayName}${cards[1].displayName}${cards[2].displayName}`,
      isValid: true,
      cardCount: 3
    };
  }
  
  return {
    type: 'invalid',
    description: '不是三不带',
    isValid: false
  };
}

/**
 * 检查是否为三带二
 */
function isTripleWithPair(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length !== 5) {
    return {
      type: 'invalid',
      description: '不是三带二',
      isValid: false
    };
  }
  
  const counts = getCardCounts(cards, currentRank);
  const countValues = Array.from(counts.values()).sort((a, b) => b - a);
  
  if (countValues.length === 2 && countValues[0] === 3 && countValues[1] === 2) {
    return {
      type: 'triple_with_pair',
      description: '三带二',
      isValid: true,
      cardCount: 5
    };
  }
  
  return {
    type: 'invalid',
    description: '不是三带二',
    isValid: false
  };
}

/**
 * 检查是否为飞机（两个连续三带）
 */
function isAirplane(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length !== 6 && cards.length !== 8 && cards.length !== 10) {
    return {
      type: 'invalid',
      description: '不是飞机',
      isValid: false
    };
  }
  
  const counts = getCardCounts(cards, currentRank);
  const triples: number[] = [];
  const pairs: number[] = [];
  
  counts.forEach((count, value) => {
    if (count === 3) {
      triples.push(value);
    } else if (count === 2) {
      pairs.push(value);
    } else if (count === 1) {
      // 单张不符合飞机规则
      return {
        type: 'invalid',
        description: '不是飞机',
        isValid: false
      };
    }
  });
  
  if (triples.length === 2) {
    triples.sort((a, b) => a - b);
    // 检查三张是否连续（考虑配牌的特殊情况）
    if (Math.abs(triples[1] - triples[0]) <= 1 || 
        cards.some(card => card.isWildCard)) {
      
      if (cards.length === 6) {
        return {
          type: 'airplane',
          description: '飞机（三三不带）',
          isValid: true,
          cardCount: 6
        };
      } else if (cards.length === 10 && pairs.length === 2) {
        return {
          type: 'airplane',
          description: '飞机（三三带二二）',
          isValid: true,
          cardCount: 10
        };
      }
    }
  }
  
  return {
    type: 'invalid',
    description: '不是飞机',
    isValid: false
  };
}

/**
 * 检查是否为连续对子
 */
function isConsecutivePairs(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length < 6 || cards.length % 2 !== 0) {
    return {
      type: 'invalid',
      description: '不是连续对子',
      isValid: false
    };
  }
  
  const counts = getCardCounts(cards, currentRank);
  const pairs: number[] = [];
  
  counts.forEach((count, value) => {
    if (count === 2) {
      pairs.push(value);
    } else {
      return {
        type: 'invalid',
        description: '不是连续对子',
        isValid: false
      };
    }
  });
  
  if (pairs.length === cards.length / 2) {
    pairs.sort((a, b) => a - b);
    
    // 检查是否连续（考虑配牌）
    let isConsecutive = true;
    for (let i = 1; i < pairs.length; i++) {
      if (pairs[i] - pairs[i-1] > 1 && !cards.some(card => card.isWildCard)) {
        isConsecutive = false;
        break;
      }
    }
    
    if (isConsecutive) {
      return {
        type: 'consecutive_pairs',
        description: `连续对子（${pairs.length}对）`,
        isValid: true,
        cardCount: cards.length
      };
    }
  }
  
  return {
    type: 'invalid',
    description: '不是连续对子',
    isValid: false
  };
}

/**
 * 检查是否为顺子（5张默认为同花顺）
 */
function isStraight(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length < 5) {
    return {
      type: 'invalid',
      description: '不是顺子',
      isValid: false
    };
  }
  
  // 获取非配牌的值
  const values: number[] = [];
  let wildCardCount = 0;
  
  cards.forEach(card => {
    const seqValue = getCardSequenceValue(card, currentRank);
    if (seqValue === null) {
      wildCardCount++;
    } else {
      values.push(seqValue);
    }
  });
  
  values.sort((a, b) => a - b);
  
  // 检查普通顺子（不包含A在开头的情况）
  let gaps = 0;
  for (let i = 1; i < values.length; i++) {
    gaps += values[i] - values[i-1] - 1;
  }
  
  // 配牌数量应该能填补所有空隙
  let isValidStraight = gaps <= wildCardCount;
  
  // 检查A2345特殊顺子（A在开头的情况）
  if (!isValidStraight && values.includes(14)) { // 14 是 A
    // 将A看作1，重新排序检查
    const valuesWithLowAce = values.map(v => v === 14 ? 1 : v).sort((a, b) => a - b);
    let gapsWithLowAce = 0;
    for (let i = 1; i < valuesWithLowAce.length; i++) {
      gapsWithLowAce += valuesWithLowAce[i] - valuesWithLowAce[i-1] - 1;
    }
    
    // 检查A2345这样的低位顺子
    if (gapsWithLowAce <= wildCardCount) {
      // 确保这是一个有效的低位顺子（A应该在最前面）
      const minValue = Math.min(...valuesWithLowAce);
      const maxValue = Math.max(...valuesWithLowAce);
      
      // A2345的范围检查：最小值应该是1（A），最大值不应该超过5+配牌数
      if (minValue === 1 && maxValue <= 5 + wildCardCount) {
        isValidStraight = true;
      }
    }
  }
  
  if (isValidStraight) {
    // 5张顺子默认为同花顺，可以管上5张以下的炸弹
    if (cards.length === 5) {
      return {
        type: 'flush_straight',
        description: `同花顺（${cards.length}张）- 可管5张以下炸弹`,
        isValid: true,
        cardCount: cards.length
      };
    } else {
      return {
        type: 'straight',
        description: `顺子（${cards.length}张）`,
        isValid: true,
        cardCount: cards.length
      };
    }
  }
  
  return {
    type: 'invalid',
    description: '不是顺子',
    isValid: false
  };
}

/**
 * 检查是否为炸弹（可以使用红心配牌，可以管上5张顺子）
 */
function isBomb(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length < 4) {
    return {
      type: 'invalid',
      description: '不是炸弹',
      isValid: false
    };
  }
  
  const counts = getCardCounts(cards, currentRank);
  const countValues = Array.from(counts.values());
  
  // 四张或以上相同的牌（包括配牌）
  if (countValues.length === 1 && countValues[0] >= 4) {
    let description = `炸弹（${cards.length}张）`;
    
    // 检查是否使用了配牌
    const hasWildCard = cards.some(card => card.isWildCard);
    if (hasWildCard) {
      description += ' - 含配牌';
    }
    
    // 5张及以上炸弹可以管上5张顺子
    if (cards.length >= 5) {
      description += ' - 可管5张顺子';
    }
    
    return {
      type: 'bomb',
      description,
      isValid: true,
      cardCount: cards.length
    };
  }
  
  return {
    type: 'invalid',
    description: '不是炸弹',
    isValid: false
  };
}

/**
 * 检查牌型大小关系和管牌规则
 */
export function canBeatCardType(myCards: CardType, opponentCards: CardType): boolean {
  // 同花顺（5张顺子）可以管5张以下的炸弹
  if (myCards.type === 'flush_straight' && opponentCards.type === 'bomb') {
    return (opponentCards.cardCount || 0) < 5;
  }
  
  // 炸弹可以管上5张顺子
  if (myCards.type === 'bomb' && opponentCards.type === 'flush_straight') {
    return (myCards.cardCount || 0) >= 5;
  }
  
  // 炸弹之间比较张数
  if (myCards.type === 'bomb' && opponentCards.type === 'bomb') {
    return (myCards.cardCount || 0) > (opponentCards.cardCount || 0);
  }
  
  // 炸弹可以管其他所有牌型
  if (myCards.type === 'bomb' && opponentCards.type !== 'bomb' && opponentCards.type !== 'flush_straight') {
    return true;
  }
  
  // 其他情况需要同牌型比较
  return myCards.type === opponentCards.type;
}

/**
 * 主要的牌型检查函数
 */
export function validateCardType(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length === 0) {
    return {
      type: 'invalid',
      description: '请选择卡牌',
      isValid: false
    };
  }
  
  // 按优先级检查牌型
  
  // 单张
  const singleResult = isSingle(cards);
  if (singleResult.isValid) return singleResult;
  
  // 对子
  const pairResult = isPair(cards, currentRank);
  if (pairResult.isValid) return pairResult;
  
  // 三不带
  const tripleResult = isTriple(cards, currentRank);
  if (tripleResult.isValid) return tripleResult;
  
  // 炸弹（需要在其他牌型之前检查，因为优先级高）
  const bombResult = isBomb(cards, currentRank);
  if (bombResult.isValid) return bombResult;
  
  // 三带二
  const tripleWithPairResult = isTripleWithPair(cards, currentRank);
  if (tripleWithPairResult.isValid) return tripleWithPairResult;
  
  // 飞机
  const airplaneResult = isAirplane(cards, currentRank);
  if (airplaneResult.isValid) return airplaneResult;
  
  // 连续对子
  const consecutivePairsResult = isConsecutivePairs(cards, currentRank);
  if (consecutivePairsResult.isValid) return consecutivePairsResult;
  
  // 顺子
  const straightResult = isStraight(cards, currentRank);
  if (straightResult.isValid) return straightResult;
  
  // 如果都不匹配，返回无效
  return {
    type: 'invalid',
    description: '不符合掼蛋牌型规则',
    isValid: false
  };
}