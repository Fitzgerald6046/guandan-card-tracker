import type { Card, GameRank, Rank } from '../types/game';
import { RANK_DISPLAY_NAMES } from '../types/game';
import {
  canBeatCardType,
  validateCardType
} from './guandanRules';
import type { CardType } from './guandanRules';

export interface BeatSolution {
  cards: Card[];
  cardType: CardType;
  display: string;
  usesPowerPlay: boolean;
  breaksKnownBomb: boolean;
}

interface CardBucket {
  cards: Card[];
}

const POWER_TYPES = new Set<CardType['type']>([
  'bomb',
  'flush_straight',
  'four_kings'
]);

const getRankWeight = (rank: Rank, currentRank: GameRank): number => {
  if (rank === 16) return 1010;
  if (rank === 15) return 1000;
  if (rank === currentRank) return 900;
  return 660 + rank * 10;
};

const getRankSequences = (length: number): Rank[][] => {
  const sequences: Rank[][] = [];
  for (let start = 2; start + length - 1 <= 14; start++) {
    sequences.push(
      Array.from({ length }, (_, index) => (start + index) as Rank)
    );
  }
  return sequences;
};

const getRankCombinations = (ranks: Rank[], count: number): Rank[][] => {
  const combinations: Rank[][] = [];
  const chosen: Rank[] = [];

  const visit = (start: number) => {
    if (chosen.length === count) {
      combinations.push([...chosen]);
      return;
    }
    for (let index = start; index < ranks.length; index++) {
      chosen.push(ranks[index]);
      visit(index + 1);
      chosen.pop();
    }
  };

  visit(0);
  return combinations;
};

/** 按点数需求组牌，优先使用普通牌，配牌只补缺口。 */
const buildPattern = (
  handCards: Card[],
  requirements: Array<[Rank, number]>
): Card[] | null => {
  const wildCards = handCards.filter(card => card.isWildCard);
  const selected: Card[] = [];
  let usedWildCards = 0;

  for (const [rank, count] of requirements) {
    const naturalCards = handCards
      .filter(card => !card.isWildCard && card.rank === rank)
      .slice(0, count);
    selected.push(...naturalCards);

    const shortage = count - naturalCards.length;
    if (shortage > wildCards.length - usedWildCards) return null;
    selected.push(...wildCards.slice(usedWildCards, usedWildCards + shortage));
    usedWildCards += shortage;
  }

  return selected;
};

/**
 * 枚举不超过5张的等张数组合。按“点数+是否配牌”分桶，
 * 避免对两副牌中完全等价的实体牌重复求解。
 */
const enumerateSmallCandidates = (
  handCards: Card[],
  cardCount: number,
  visitCandidate: (cards: Card[]) => void
) => {
  const bucketMap = new Map<string, CardBucket>();
  handCards.forEach(card => {
    const key = `${card.rank}:${Number(card.isWildCard)}`;
    const bucket = bucketMap.get(key) ?? { cards: [] };
    bucket.cards.push(card);
    bucketMap.set(key, bucket);
  });
  const buckets = [...bucketMap.values()];
  const selected: Card[] = [];

  const visitBucket = (bucketIndex: number, remaining: number) => {
    if (remaining === 0) {
      visitCandidate([...selected]);
      return;
    }
    if (bucketIndex >= buckets.length) return;

    const remainingCapacity = buckets
      .slice(bucketIndex)
      .reduce((total, bucket) => total + bucket.cards.length, 0);
    if (remainingCapacity < remaining) return;

    const bucket = buckets[bucketIndex];
    const maxTake = Math.min(bucket.cards.length, remaining);
    for (let take = 0; take <= maxTake; take++) {
      selected.push(...bucket.cards.slice(0, take));
      visitBucket(bucketIndex + 1, remaining - take);
      selected.splice(selected.length - take, take);
    }
  };

  visitBucket(0, cardCount);
};

/**
 * 从完整已知手牌中寻找能压过当前牌面的最低成本方案。
 * 优先级：较低牌力 > 不拆已知炸弹 > 少用配牌/王/级牌 > 较低点数。
 */
export function findLowestCostBeat(
  handCards: Card[],
  leadCards: Card[],
  currentRank: GameRank
): BeatSolution | null {
  const playableCards = handCards.filter(card => !card.isPlayed);
  const leadType = validateCardType(leadCards, currentRank);
  if (!leadType.isValid || playableCards.length === 0) return null;

  const candidates = new Map<string, BeatSolution>();
  const fullRankCounts = playableCards.reduce((counts, card) => {
    if (!card.isWildCard) {
      counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
    }
    return counts;
  }, new Map<Rank, number>());

  const addCandidate = (cards: Card[] | null) => {
    if (!cards || cards.length === 0) return;
    const uniqueCards = new Set(cards.map(card => card.id));
    if (uniqueCards.size !== cards.length) return;

    const cardType = validateCardType(cards, currentRank);
    if (!cardType.isValid || !canBeatCardType(cardType, leadType, currentRank)) return;

    const signature = [...uniqueCards].sort().join('|');
    if (candidates.has(signature)) return;

    const candidateRankCounts = cards.reduce((counts, card) => {
      if (!card.isWildCard) {
        counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
      }
      return counts;
    }, new Map<Rank, number>());
    const breaksKnownBomb = !POWER_TYPES.has(cardType.type) &&
      [...candidateRankCounts].some(([rank, usedCount]) =>
        (fullRankCounts.get(rank) ?? 0) >= 4 && usedCount < (fullRankCounts.get(rank) ?? 0)
      );

    candidates.set(signature, {
      cards,
      cardType,
      display: cards.map(card => RANK_DISPLAY_NAMES[card.rank]).join(' '),
      usesPowerPlay: POWER_TYPES.has(cardType.type) &&
        !POWER_TYPES.has(leadType.type),
      breaksKnownBomb
    });
  };

  if ((leadType.cardCount ?? leadCards.length) <= 5) {
    enumerateSmallCandidates(
      playableCards,
      leadType.cardCount ?? leadCards.length,
      addCandidate
    );
  }

  // 连对：按连续点数各取两张。
  if (leadType.type === 'wooden_board' || leadType.type === 'consecutive_pairs') {
    const pairCount = (leadType.cardCount ?? leadCards.length) / 2;
    getRankSequences(pairCount).forEach(sequence => {
      addCandidate(buildPattern(
        playableCards,
        sequence.map(rank => [rank, 2])
      ));
    });
  }

  // 钢板：三个连续点数各取三张。
  if (leadType.type === 'steel_board') {
    getRankSequences(3).forEach(sequence => {
      addCandidate(buildPattern(
        playableCards,
        sequence.map(rank => [rank, 3])
      ));
    });
  }

  // 飞机：支持连续三张不带，或每组三张带一对。
  if (leadType.type === 'airplane') {
    const cardCount = leadType.cardCount ?? leadCards.length;
    const tripleCounts = new Set<number>();
    if (cardCount % 3 === 0) tripleCounts.add(cardCount / 3);
    if (cardCount % 5 === 0) tripleCounts.add(cardCount / 5);

    tripleCounts.forEach(tripleCount => {
      if (tripleCount < 2) return;
      getRankSequences(tripleCount).forEach(sequence => {
        if (cardCount === tripleCount * 3) {
          addCandidate(buildPattern(
            playableCards,
            sequence.map(rank => [rank, 3])
          ));
          return;
        }

        const pairRanks = ([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as Rank[])
          .filter(rank => !sequence.includes(rank));
        getRankCombinations(pairRanks, tripleCount).forEach(attachments => {
          addCandidate(buildPattern(playableCards, [
            ...sequence.map(rank => [rank, 3] as [Rank, number]),
            ...attachments.map(rank => [rank, 2] as [Rank, number])
          ]));
        });
      });
    });
  }

  // 任意普通牌型都可被足够大的炸弹或同花顺压制。
  for (let rank = 2; rank <= 14; rank++) {
    for (let count = 4; count <= 8; count++) {
      addCandidate(buildPattern(playableCards, [[rank as Rank, count]]));
    }
  }

  const jokers = playableCards.filter(card => card.rank >= 15);
  if (jokers.length === 4) addCandidate(jokers);

  const getSolutionScore = (solution: BeatSolution): number[] => {
    const typePower = solution.cardType.power ?? 0;
    const wildCards = solution.cards.filter(card => card.isWildCard).length;
    const jokersUsed = solution.cards.filter(card => card.rank >= 15).length;
    const levelCards = solution.cards.filter(card => card.rank === currentRank).length;
    const mainRankWeight = solution.cardType.mainRank
      ? getRankWeight(solution.cardType.mainRank as Rank, currentRank)
      : 0;
    const totalRankWeight = solution.cards.reduce(
      (total, card) => total + getRankWeight(card.rank, currentRank),
      0
    );

    return [
      typePower,
      Number(solution.breaksKnownBomb) * 10_000,
      wildCards * 1_000,
      jokersUsed * 500,
      levelCards * 200,
      mainRankWeight,
      totalRankWeight
    ];
  };

  const compareScores = (left: BeatSolution, right: BeatSolution): number => {
    const leftScore = getSolutionScore(left);
    const rightScore = getSolutionScore(right);
    for (let index = 0; index < leftScore.length; index++) {
      if (leftScore[index] !== rightScore[index]) {
        return leftScore[index] - rightScore[index];
      }
    }
    return 0;
  };

  return [...candidates.values()].sort(compareScores)[0] ?? null;
}
