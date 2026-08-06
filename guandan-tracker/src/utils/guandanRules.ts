/**
 * 掼蛋牌型判断规则
 * 根据标准掼蛋规则实现完整的牌型识别和大小比较
 */

export type CardRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
export type PlayerPosition = 'bottom' | 'left' | 'top' | 'right';

export interface Card {
  id: string;
  rank: CardRank;
  isRankCard: boolean;
  isWildCard: boolean;
  isHearts?: boolean;
  suit?: string | null;
  displayName?: string;
}

export interface CardType {
  type: 'single' | 'pair' | 'triple' | 'triple_with_pair' | 'airplane' | 'consecutive_pairs' | 'wooden_board' | 'steel_board' | 'straight' | 'flush_straight' | 'bomb' | 'four_kings' | 'invalid';
  description: string;
  isValid: boolean;
  cardCount?: number;
  power?: number; // 牌型威力等级，用于比较
  mainRank?: CardRank; // 主要牌点，用于同牌型比较
}

/**
 * 获取牌点在当前级数下的权重值
 * 按照掼蛋规则：大王 > 小王 > 级牌 > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 非级牌中最小的
 */
function getCardWeight(rank: CardRank, currentRank: CardRank): number {
  if (rank === 16) {
    return 1010; // 大王
  }

  if (rank === 15) {
    return 1000; // 小王
  }
  
  if (rank === currentRank) {
    return 900; // 级牌仅次于王牌
  }
  
  // 其他牌按标准顺序
  const standardOrder = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  const index = standardOrder.indexOf(rank);
  if (index >= 0) {
    return 800 - index * 10; // A=800, K=790, ..., 2=680
  }
  
  return 0;
}

/**
 * 获取牌在顺子中的序列值（级牌归位为普通牌）
 */
function getSequenceValue(rank: CardRank, currentRank: CardRank): number {
  void currentRank;
  if (rank >= 15) return -1; // 王牌不参与顺子
  // 级牌归位为普通牌，可以参与顺子
  // 例如：如果当前级数是7，那么7可以在56789顺子中当作7使用
  return rank;
}

/**
 * 检查是否可以使用配牌替换
 */
function canUseWildCard(card: Card): boolean {
  return card.isWildCard; // 红心配牌和王牌
}

/**
 * 统计牌型分布（考虑配牌替换）
 */
function analyzeCards(cards: Card[], currentRank: CardRank): {
  ranks: Map<CardRank, number>;
  wildCards: number;
  hasKings: boolean;
} {
  void currentRank;
  const ranks = new Map<CardRank, number>();
  let wildCards = 0;
  let hasKings = false;

  cards.forEach(card => {
    if (card.rank === 15) {
      hasKings = true;
      ranks.set(15, (ranks.get(15) || 0) + 1);
    } else if (canUseWildCard(card)) {
      // 所有红心配牌（包括级牌）都可以作为wildCard使用
      // 但当它们参与炸弹或其他牌型时，也可以按照实际牌点使用
      wildCards++;
      // 同时也记录它们的实际牌点，以便在炸弹等牌型中使用
      ranks.set(card.rank, (ranks.get(card.rank) || 0) + 1);
    } else {
      // 普通牌按正常牌处理
      ranks.set(card.rank, (ranks.get(card.rank) || 0) + 1);
    }
  });

  return { ranks, wildCards, hasKings };
}

/**
 * 检查四大天王（最大的炸弹）
 */
function isFourKings(cards: Card[]): CardType {
  if (cards.length !== 4) {
    return { type: 'invalid', description: '不是四大天王', isValid: false };
  }

  const smallJokers = cards.filter(card => card.rank === 15).length;
  const bigJokers = cards.filter(card => card.rank === 16).length;
  if (smallJokers === 2 && bigJokers === 2) {
    return {
      type: 'four_kings',
      description: '四王炸 - 最大的牌',
      isValid: true,
      cardCount: 4,
      power: 1000,
      mainRank: 16
    };
  }

  return { type: 'invalid', description: '不是四大天王', isValid: false };
}

/**
 * 检查是否为单牌
 */
function isSingle(cards: Card[], currentRank: CardRank): CardType {
  void currentRank;
  if (cards.length === 1) {
    return {
      type: 'single',
      description: `单张: ${cards[0].displayName}`,
      isValid: true,
      cardCount: 1,
      power: 10,
      mainRank: cards[0].rank
    };
  }
  return { type: 'invalid', description: '不是单张', isValid: false };
}

/**
 * 检查是否为对子
 */
function isPair(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length !== 2) {
    return { type: 'invalid', description: '不是对子', isValid: false };
  }

  const { ranks, wildCards } = analyzeCards(cards, currentRank);
  
  // 一张大王一张小王不能构成对子
  if (ranks.get(15) === 2) {
    // 需要检查是否为同样的王（在实际实现中应该区分大小王）
    return {
      type: 'pair',
      description: `对王`,
      isValid: true,
      cardCount: 2,
      power: 20,
      mainRank: 15
    };
  }

  // 检查是否为普通对子或使用配牌的对子
  for (const [rank, count] of ranks.entries()) {
    if (count === 2 || (count === 1 && wildCards === 1)) {
      return {
        type: 'pair',
        description: `对子: ${cards[0].displayName}${cards[1].displayName}`,
        isValid: true,
        cardCount: 2,
        power: 20,
        mainRank: rank
      };
    }
  }

  return { type: 'invalid', description: '不是对子', isValid: false };
}

/**
 * 检查是否为三同张
 */
function isTriple(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length !== 3) {
    return { type: 'invalid', description: '不是三同张', isValid: false };
  }

  // 3个王不允许出牌
  if (cards.every(card => card.rank === 15)) {
    return { type: 'invalid', description: '3个王不允许出牌', isValid: false };
  }

  const { ranks, wildCards } = analyzeCards(cards, currentRank);
  
  // 检查是否可以组成三同张
  for (const [rank, count] of ranks.entries()) {
    if (rank === 15) continue; // 跳过王牌
    
    if (count === 3 || (count === 2 && wildCards >= 1) || (count === 1 && wildCards >= 2)) {
      return {
        type: 'triple',
        description: `三同张: ${cards[0].displayName}${cards[1].displayName}${cards[2].displayName}`,
        isValid: true,
        cardCount: 3,
        power: 30,
        mainRank: rank
      };
    }
  }

  return { type: 'invalid', description: '不是三同张', isValid: false };
}

/**
 * 检查是否为三带二
 */
function isTripleWithPair(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length !== 5) {
    return { type: 'invalid', description: '不是三带二', isValid: false };
  }

  const { ranks, wildCards } = analyzeCards(cards, currentRank);
  
  // 寻找三张和一对的组合
  let tripleRank: CardRank | null = null;
  let pairRank: CardRank | null = null;
  let remainingWildCards = wildCards;

  // 先找确定的三张
  for (const [rank, count] of ranks.entries()) {
    if (rank === 15) continue;
    if (count === 3) {
      tripleRank = rank;
      break;
    }
  }

  // 用配牌补足三张
  if (!tripleRank) {
    for (const [rank, count] of ranks.entries()) {
      if (rank === 15) continue;
      if (count === 2 && remainingWildCards >= 1) {
        tripleRank = rank;
        remainingWildCards -= 1;
        break;
      } else if (count === 1 && remainingWildCards >= 2) {
        tripleRank = rank;
        remainingWildCards -= 2;
        break;
      }
    }
  }

  // 找对子
  if (tripleRank) {
    for (const [rank, count] of ranks.entries()) {
      if (rank === tripleRank) continue;
      if (count === 2 || (count === 1 && remainingWildCards >= 1)) {
        pairRank = rank;
        break;
      }
    }
  }

  if (tripleRank && pairRank) {
    return {
      type: 'triple_with_pair',
      description: '三带二',
      isValid: true,
      cardCount: 5,
      power: 40,
      mainRank: tripleRank
    };
  }

  return { type: 'invalid', description: '不是三带二', isValid: false };
}

/**
 * 检查是否为连对（包括木板）
 */
function isConsecutivePairs(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length < 6 || cards.length % 2 !== 0) {
    return { type: 'invalid', description: '连对至少需要6张牌且为偶数', isValid: false };
  }

  const { ranks, wildCards } = analyzeCards(cards, currentRank);
  const pairs: CardRank[] = [];
  let remainingWildCards = wildCards;

  // 收集所有可能的对子
  for (const [rank, count] of ranks.entries()) {
    if (rank === 15) continue; // 王牌不参与连对
    
    if (count >= 2) {
      pairs.push(rank);
      if (count === 4) pairs.push(rank); // 四张可以组成两对
      if (count === 6) { // 六张可以组成三对
        pairs.push(rank);
        pairs.push(rank);
      }
    } else if (count === 1 && remainingWildCards >= 1) {
      pairs.push(rank);
      remainingWildCards -= 1;
    }
  }

  const expectedPairs = cards.length / 2;
  if (pairs.length === expectedPairs) {
    // 级牌在连对中归位为普通牌
    const sequenceValues = pairs.map(rank => getSequenceValue(rank, currentRank)).sort((a, b) => a - b);
    
    // 检查是否连续（允许A下位：A-2-3 或 Q-K-A）
    let isConsecutive = true;
    for (let i = 1; i < sequenceValues.length; i++) {
      const diff = sequenceValues[i] - sequenceValues[i-1];
      if (diff !== 1) {
        // 检查A下位的特殊情况
        if (!(sequenceValues[i-1] === 2 && sequenceValues[i] === 14 && i === sequenceValues.length - 1)) {
          isConsecutive = false;
          break;
        }
      }
    }

    if (isConsecutive) {
      const maxRank = Math.max(...pairs);
      const isWoodenBoard = cards.length === 6;
      
      return {
        type: isWoodenBoard ? 'wooden_board' : 'consecutive_pairs',
        description: isWoodenBoard ? '木板（三连对）' : `连对（${expectedPairs}对）`,
        isValid: true,
        cardCount: cards.length,
        power: 50,
        mainRank: maxRank as CardRank
      };
    }
  }

  return { type: 'invalid', description: '不是连对', isValid: false };
}

/**
 * 检查是否为钢板（两个连续三同张，例如333444）。
 */
function isSteelBoard(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length !== 6) {
    return { type: 'invalid', description: '不是钢板', isValid: false };
  }

  const { ranks, wildCards } = analyzeCards(cards, currentRank);
  const triples: CardRank[] = [];
  let remainingWildCards = wildCards;

  // 收集所有可能的三张
  for (const [rank, count] of ranks.entries()) {
    if (rank === 15) continue; // 王牌不参与钢板
    
    if (count === 3) {
      triples.push(rank);
    } else if (count === 2 && remainingWildCards >= 1) {
      triples.push(rank);
      remainingWildCards -= 1;
    } else if (count === 1 && remainingWildCards >= 2) {
      triples.push(rank);
      remainingWildCards -= 2;
    }
  }

  if (triples.length === 2) {
    // 级牌在钢板中归位为普通牌
    const sequenceValues = triples.map(rank => getSequenceValue(rank, currentRank)).sort((a, b) => a - b);
    
    // 检查是否连续
    let isConsecutive = true;
    for (let i = 1; i < sequenceValues.length; i++) {
      if (sequenceValues[i] - sequenceValues[i-1] !== 1) {
        isConsecutive = false;
        break;
      }
    }

    if (isConsecutive) {
      const maxRank = Math.max(...triples);
      return {
        type: 'steel_board',
        description: '钢板（两连三）',
        isValid: true,
        cardCount: 9,
        power: 60,
        mainRank: maxRank as CardRank
      };
    }
  }

  return { type: 'invalid', description: '不是钢板', isValid: false };
}

/**
 * 检查是否为飞机（两个或以上连续三带）
 */
function isAirplane(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length < 6) {
    return { type: 'invalid', description: '飞机至少需要6张牌', isValid: false };
  }

  const { ranks, wildCards } = analyzeCards(cards, currentRank);
  const triples: CardRank[] = [];
  const pairs: CardRank[] = [];
  let remainingWildCards = wildCards;

  // 先找所有可能的三张
  for (const [rank, count] of ranks.entries()) {
    if (rank === 15) continue; // 王牌不参与飞机
    
    if (count === 3) {
      triples.push(rank);
    } else if (count === 2 && remainingWildCards >= 1) {
      triples.push(rank);
      remainingWildCards -= 1;
    } else if (count === 1 && remainingWildCards >= 2) {
      triples.push(rank);
      remainingWildCards -= 2;
    } else if (count >= 4) {
      // 多于3张的可以拆分
      const fullTriples = Math.floor(count / 3);
      const remainder = count % 3;
      
      for (let i = 0; i < fullTriples; i++) {
        triples.push(rank);
      }
      
      if (remainder === 2 && remainingWildCards >= 1) {
        triples.push(rank);
        remainingWildCards -= 1;
      } else if (remainder === 1 && remainingWildCards >= 2) {
        triples.push(rank);
        remainingWildCards -= 2;
      }
    }
  }

  // 找剩余的对子
  for (const [rank, count] of ranks.entries()) {
    if (rank === 15) continue;
    if (triples.includes(rank)) continue; // 已经用作三张的不能再用作对子
    
    if (count >= 2) {
      pairs.push(rank);
    } else if (count === 1 && remainingWildCards >= 1) {
      pairs.push(rank);
      remainingWildCards -= 1;
    }
  }

  // 飞机规则检查
  if (triples.length >= 2) {
    // 检查三张是否连续
    const tripleValues = triples.map(rank => getSequenceValue(rank, currentRank)).sort((a, b) => a - b);
    let isConsecutive = true;
    
    for (let i = 1; i < tripleValues.length; i++) {
      if (tripleValues[i] - tripleValues[i-1] !== 1) {
        isConsecutive = false;
        break;
      }
    }

    if (isConsecutive) {
      const tripleCount = triples.length;
      const pairCount = pairs.length;
      
      // 检查是否符合飞机规则
      if (cards.length === tripleCount * 3) {
        // 三三不带
        return {
          type: 'airplane',
          description: `飞机（${tripleCount}连三不带）`,
          isValid: true,
          cardCount: cards.length,
          power: 45,
          mainRank: Math.max(...triples) as CardRank
        };
      } else if (cards.length === tripleCount * 3 + pairCount * 2 && pairCount === tripleCount) {
        // 三三带二二
        return {
          type: 'airplane',
          description: `飞机（${tripleCount}连三带${pairCount}对）`,
          isValid: true,
          cardCount: cards.length,
          power: 45,
          mainRank: Math.max(...triples) as CardRank
        };
      }
    }
  }

  return { type: 'invalid', description: '不是飞机', isValid: false };
}

/**
 * 检查是否为顺子
 */
function isStraight(cards: Card[], currentRank: CardRank): CardType {
  // currentRank 保留在签名中以兼容统一判型接口；顺子里级牌按原点数参与。
  void currentRank;

  if (cards.length !== 5) {
    return { type: 'invalid', description: '顺子需要5张牌', isValid: false };
  }

  // 快速记牌模式只记录点数，不记录花色。红心级牌仍可补任意缺口，
  // 大小王不参与顺子；固定点数重复时也不能误判为顺子。
  const fixedRanks = cards
    .filter(card => !card.isWildCard)
    .map(card => card.rank);
  const wildCardCount = cards.length - fixedRanks.length;

  if (fixedRanks.some(rank => rank >= 15) || new Set(fixedRanks).size !== fixedRanks.length) {
    return { type: 'invalid', description: '不是顺子', isValid: false };
  }

  const candidateSequences: Array<{ ranks: CardRank[]; highRank: CardRank }> = [
    { ranks: [14, 2, 3, 4, 5], highRank: 5 }
  ];

  for (let start = 2; start <= 10; start++) {
    candidateSequences.push({
      ranks: [start, start + 1, start + 2, start + 3, start + 4] as CardRank[],
      highRank: (start + 4) as CardRank
    });
  }

  const matchedSequence = candidateSequences
    .filter(sequence => {
      const fixedCardsFit = fixedRanks.every(rank => sequence.ranks.includes(rank));
      const missingRanks = sequence.ranks.filter(rank => !fixedRanks.includes(rank)).length;
      return fixedCardsFit && missingRanks === wildCardCount;
    })
    .sort((left, right) => right.highRank - left.highRank)[0];

  if (matchedSequence) {
    return {
      type: 'flush_straight',
      description: '同花顺（按点数自动判定，不区分花色）- 可管5张及以下炸弹',
      isValid: true,
      cardCount: cards.length,
      // 四/五张炸弹分别为90/95，六张炸弹为100。
      power: 97,
      mainRank: matchedSequence.highRank
    };
  }

  return { type: 'invalid', description: '不是顺子', isValid: false };
}

/**
 * 检查是否为炸弹
 */
function isBomb(cards: Card[], currentRank: CardRank): CardType {
  if (cards.length < 4) {
    return { type: 'invalid', description: '炸弹至少需要4张牌', isValid: false };
  }

  const { ranks, wildCards } = analyzeCards(cards, currentRank);
  
  // 寻找可以组成炸弹的牌点
  for (const [rank] of ranks.entries()) {
    if (rank === 15) continue; // 王牌单独处理
    
    // 检查能否用该牌点加上配牌组成炸弹
    // 这里需要特别处理：红心配既可以作为配牌使用，也可以作为本身牌点使用
    const pureCount = cards.filter(card => card.rank === rank && !canUseWildCard(card)).length;
    const wildOfThisRank = cards.filter(card => card.rank === rank && canUseWildCard(card)).length;
    const otherWildCards = wildCards - wildOfThisRank;
    
    // 情况1：红心配作为本身牌点使用
    const totalSameRank = pureCount + wildOfThisRank;
    if (totalSameRank >= 4 && totalSameRank === cards.length) {
      let power = 90; // 基础炸弹威力
      
      // 根据张数调整威力
      if (cards.length >= 8) power = 110; // 八头炸及以上
      else if (cards.length === 7) power = 105;
      else if (cards.length === 6) power = 100;
      else if (cards.length === 5) power = 95;
      
      return {
        type: 'bomb',
        description: `${cards.length}张炸弹 (${rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : rank === 14 ? 'A' : rank})`,
        isValid: true,
        cardCount: cards.length,
        power,
        mainRank: rank
      };
    }
    
    // 情况2：红心配作为配牌使用
    if (pureCount + otherWildCards >= 4 && pureCount + otherWildCards === cards.length) {
      let power = 90; // 基础炸弹威力
      
      // 根据张数调整威力
      if (cards.length >= 8) power = 110; // 八头炸及以上
      else if (cards.length === 7) power = 105;
      else if (cards.length === 6) power = 100;
      else if (cards.length === 5) power = 95;
      
      return {
        type: 'bomb',
        description: `${cards.length}张炸弹 (${rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : rank === 14 ? 'A' : rank})`,
        isValid: true,
        cardCount: cards.length,
        power,
        mainRank: rank
      };
    }
  }

  return { type: 'invalid', description: '不是炸弹', isValid: false };
}

/**
 * 比较两个牌型的大小
 */
export function canBeatCardType(myCards: CardType, opponentCards: CardType, currentRank: CardRank = 7): boolean {
  if (!myCards.isValid || !opponentCards.isValid) return false;

  // 四大天王最大
  if (opponentCards.type === 'four_kings') return false;
  if (myCards.type === 'four_kings') return true;

  const myIsPowerType = myCards.type === 'bomb' || myCards.type === 'flush_straight';
  const opponentIsPowerType = opponentCards.type === 'bomb' ||
    opponentCards.type === 'flush_straight';

  // 炸弹/同花顺可以跨牌型比较；普通牌只能用相同牌型和张数跟牌。
  if (myIsPowerType || opponentIsPowerType) {
    if (!myIsPowerType) return false;
    if (!opponentIsPowerType) return true;

    const myPower = myCards.power || 0;
    const opponentPower = opponentCards.power || 0;
    if (myPower > opponentPower) return true;
    if (myPower < opponentPower) return false;
  } else {
    if (myCards.type !== opponentCards.type) return false;
    if ((myCards.cardCount || 0) !== (opponentCards.cardCount || 0)) return false;
  }

  // 同等级、同牌型比较
  const myPower = myCards.power || 0;
  const opponentPower = opponentCards.power || 0;
  if (myPower !== opponentPower) return myPower > opponentPower;

  if (myCards.type === opponentCards.type) {
    // 顺子/同花顺按序列最高点比较，级牌在顺子中仍回归原点数。
    if (myCards.type === 'straight' || myCards.type === 'flush_straight') {
      return (myCards.mainRank || 0) > (opponentCards.mainRank || 0);
    }

    // 炸弹比较张数，张数多的大
    if (myCards.type === 'bomb') {
      if ((myCards.cardCount || 0) !== (opponentCards.cardCount || 0)) {
        return (myCards.cardCount || 0) > (opponentCards.cardCount || 0);
      }
      
      // 张数相同的炸弹比较牌点（级牌炸弹最大）
      if (myCards.mainRank && opponentCards.mainRank) {
        if (myCards.mainRank === currentRank && opponentCards.mainRank !== currentRank) {
          return true; // 级牌炸弹大于非级牌炸弹
        }
        if (myCards.mainRank !== currentRank && opponentCards.mainRank === currentRank) {
          return false; // 非级牌炸弹小于级牌炸弹
        }
        
        // 都是级牌或都不是级牌，按牌点比较
        return getCardWeight(myCards.mainRank, currentRank) > getCardWeight(opponentCards.mainRank, currentRank);
      }
    }
    
    // 其他牌型比较主要牌点
    if (myCards.mainRank && opponentCards.mainRank) {
      return getCardWeight(myCards.mainRank, currentRank) > getCardWeight(opponentCards.mainRank, currentRank);
    }
  }

  return false;
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
  
  // 四大天王（最高优先级）
  const fourKingsResult = isFourKings(cards);
  if (fourKingsResult.isValid) return fourKingsResult;

  // 炸弹
  const bombResult = isBomb(cards, currentRank);
  if (bombResult.isValid) return bombResult;

  // 同花顺/顺子
  const straightResult = isStraight(cards, currentRank);
  if (straightResult.isValid) return straightResult;

  // 钢板
  const steelBoardResult = isSteelBoard(cards, currentRank);
  if (steelBoardResult.isValid) return steelBoardResult;

  // 连对（包括木板）
  const consecutivePairsResult = isConsecutivePairs(cards, currentRank);
  if (consecutivePairsResult.isValid) return consecutivePairsResult;

  // 飞机
  const airplaneResult = isAirplane(cards, currentRank);
  if (airplaneResult.isValid) return airplaneResult;

  // 三带二
  const tripleWithPairResult = isTripleWithPair(cards, currentRank);
  if (tripleWithPairResult.isValid) return tripleWithPairResult;

  // 三同张
  const tripleResult = isTriple(cards, currentRank);
  if (tripleResult.isValid) return tripleResult;

  // 对子
  const pairResult = isPair(cards, currentRank);
  if (pairResult.isValid) return pairResult;

  // 单张
  const singleResult = isSingle(cards, currentRank);
  if (singleResult.isValid) return singleResult;

  // 如果都不匹配，返回无效
  return {
    type: 'invalid',
    description: '不符合掼蛋牌型规则',
    isValid: false
  };
}
