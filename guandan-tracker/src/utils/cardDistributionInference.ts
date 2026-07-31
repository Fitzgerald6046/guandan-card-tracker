import type {
  CardDistributionInference,
  GameRank,
  GameState,
  PlayerHandShapeInference,
  PlayerPosition,
  PlayerRankProbability,
  RankCountLikelihoodEvidence,
  RankPatternProbability
} from '../types/game';

const PLAYER_POSITIONS: PlayerPosition[] = ['bottom', 'left', 'top', 'right'];
const OPPONENT_POSITIONS: PlayerPosition[] = ['left', 'top', 'right'];
const STANDARD_RANKS: GameRank[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14
];
const STRAIGHT_SEQUENCES: GameRank[][] = [
  [14, 2, 3, 4, 5],
  ...Array.from(
    { length: 9 },
    (_, index) => Array.from(
      { length: 5 },
      (__, offset) => (index + 2 + offset) as GameRank
    )
  )
];
const THREE_RANK_SEQUENCES: GameRank[][] = Array.from(
  { length: 11 },
  (_, index) => Array.from(
    { length: 3 },
    (__, offset) => (index + 2 + offset) as GameRank
  )
);

const clampProbability = (value: number): number =>
  Math.min(1, Math.max(0, value));

const logChoose = (total: number, chosen: number): number => {
  if (chosen < 0 || chosen > total) return Number.NEGATIVE_INFINITY;
  const symmetricChosen = Math.min(chosen, total - chosen);
  let result = 0;
  for (let index = 1; index <= symmetricChosen; index++) {
    result += Math.log(total - symmetricChosen + index) - Math.log(index);
  }
  return result;
};

const choose = (total: number, chosen: number): number => {
  const logarithm = logChoose(total, chosen);
  return Number.isFinite(logarithm) ? Math.exp(logarithm) : 0;
};

const getUnknownRankDistribution = (
  populationSize: number,
  rankCopies: number,
  playerSlots: number
): Array<{ count: number; probability: number }> => {
  if (populationSize === 0 || playerSlots === 0 || rankCopies === 0) {
    return [{ count: 0, probability: 1 }];
  }

  const minimum = Math.max(0, playerSlots - (populationSize - rankCopies));
  const maximum = Math.min(playerSlots, rankCopies);
  const denominatorLog = logChoose(populationSize, playerSlots);
  const distribution: Array<{ count: number; probability: number }> = [];
  let totalProbability = 0;

  for (let count = minimum; count <= maximum; count++) {
    const probability = Math.exp(
      logChoose(rankCopies, count) +
      logChoose(populationSize - rankCopies, playerSlots - count) -
      denominatorLog
    );
    distribution.push({ count, probability });
    totalProbability += probability;
  }

  // 归一化可消除浮点误差，确保所有概率之和严格接近1。
  return distribution.map(item => ({
    ...item,
    probability: totalProbability > 0
      ? item.probability / totalProbability
      : 0
  }));
};

const getPlayerRankEstimate = (
  populationSize: number,
  rankCopies: number,
  playerSlots: number,
  knownCount: number,
  evidence: RankCountLikelihoodEvidence[] = []
): PlayerRankProbability => {
  const priorDistribution = getUnknownRankDistribution(
    populationSize,
    rankCopies,
    playerSlots
  );
  const weightedDistribution = priorDistribution.map(item => {
    const totalCount = knownCount + item.count;
    const likelihood = evidence.reduce((weight, observation) =>
      weight * (
        totalCount >= observation.atLeastCount
          ? observation.likelihoodIfPresent
          : observation.likelihoodIfAbsent
      ), 1);
    return {
      ...item,
      probability: item.probability * likelihood
    };
  });
  const totalWeight = weightedDistribution.reduce(
    (total, item) => total + item.probability,
    0
  );
  const distribution = totalWeight > 0
    ? weightedDistribution.map(item => ({
      ...item,
      probability: item.probability / totalWeight
    }))
    : priorDistribution;
  const expectedUnknownCount = distribution.reduce(
    (total, item) => total + item.count * item.probability,
    0
  );
  const probabilityAtLeast = (totalCount: number): number => {
    const unknownThreshold = Math.max(0, totalCount - knownCount);
    if (unknownThreshold === 0) return 1;
    return distribution
      .filter(item => item.count >= unknownThreshold)
      .reduce((total, item) => total + item.probability, 0);
  };
  const entropy = distribution.reduce(
    (total, item) => item.probability > 0
      ? total - item.probability * Math.log(item.probability)
      : total,
    0
  );
  const maximumEntropy = distribution.length > 1
    ? Math.log(distribution.length)
    : 0;
  const possibleCounts = distribution
    .filter(item => item.probability > 1e-12)
    .map(item => item.count + knownCount);

  return {
    knownCount,
    expectedCount: knownCount + expectedUnknownCount,
    probabilityAtLeastOne: clampProbability(probabilityAtLeast(1)),
    pairProbability: clampProbability(probabilityAtLeast(2)),
    tripleProbability: clampProbability(probabilityAtLeast(3)),
    bombProbability: clampProbability(probabilityAtLeast(4)),
    countCertainty: maximumEntropy > 0
      ? clampProbability(1 - entropy / maximumEntropy)
      : 1,
    minCount: possibleCounts.length > 0 ? Math.min(...possibleCounts) : knownCount,
    maxCount: possibleCounts.length > 0 ? Math.max(...possibleCounts) : knownCount
  };
};

const sortPatterns = (
  patterns: RankPatternProbability[]
): RankPatternProbability[] => patterns.sort((left, right) =>
  right.probability - left.probability ||
  left.ranks[0] - right.ranks[0]
);

const getSequenceProbability = (
  ranks: GameRank[],
  estimates: Record<GameRank, PlayerRankProbability>,
  probabilitySelector: (estimate: PlayerRankProbability) => number
): number => ranks.reduce(
  (probability, rank) => probability * probabilitySelector(estimates[rank]),
  1
);

const buildPlayerShapeInference = (
  position: PlayerPosition,
  estimates: Record<GameRank, PlayerRankProbability>
): PlayerHandShapeInference => {
  const singleRankPatterns = (
    probabilitySelector: (estimate: PlayerRankProbability) => number
  ): RankPatternProbability[] => sortPatterns(
    STANDARD_RANKS.map(rank => ({
      ranks: [rank],
      probability: probabilitySelector(estimates[rank]),
      approximate: false
    }))
  );
  const sequencePatterns = (
    sequences: GameRank[][],
    probabilitySelector: (estimate: PlayerRankProbability) => number
  ): RankPatternProbability[] => sortPatterns(
    sequences.map(ranks => ({
      ranks,
      probability: clampProbability(
        getSequenceProbability(ranks, estimates, probabilitySelector)
      ),
      approximate: true
    }))
  );
  const averageCertainty = STANDARD_RANKS.reduce(
    (total, rank) => total + estimates[rank].countCertainty,
    0
  ) / STANDARD_RANKS.length;

  return {
    playerPosition: position,
    pairCandidates: singleRankPatterns(estimate => estimate.pairProbability),
    tripleCandidates: singleRankPatterns(estimate => estimate.tripleProbability),
    bombCandidates: singleRankPatterns(estimate => estimate.bombProbability),
    straightCandidates: sequencePatterns(
      STRAIGHT_SEQUENCES,
      estimate => estimate.probabilityAtLeastOne
    ),
    pairStraightCandidates: sequencePatterns(
      THREE_RANK_SEQUENCES,
      estimate => estimate.pairProbability
    ),
    tripleStraightCandidates: sequencePatterns(
      THREE_RANK_SEQUENCES,
      estimate => estimate.tripleProbability
    ),
    certainty: clampProbability(averageCertainty)
  };
};

/**
 * 多元超几何分布：计算至少一名对手拥有4张同点数牌的联合概率。
 * 当未知槽位和未知牌池不一致时，调用方会退回边际概率近似。
 */
const getAnyOpponentBombProbability = (
  populationSize: number,
  rankCopies: number,
  playerSlots: Record<PlayerPosition, number>,
  knownCounts: Record<PlayerPosition, number>,
  evidence: RankCountLikelihoodEvidence[] = []
): number | null => {
  const assignedSlots = PLAYER_POSITIONS.reduce(
    (total, position) => total + playerSlots[position],
    0
  );
  if (assignedSlots > populationSize) return null;

  const groups = PLAYER_POSITIONS.map(position => ({
    position: position as PlayerPosition | null,
    slots: playerSlots[position]
  }));
  if (assignedSlots < populationSize) {
    groups.push({ position: null, slots: populationSize - assignedSlots });
  }

  const denominator = choose(populationSize, rankCopies);
  if (denominator === 0) return rankCopies === 0 ? 0 : null;

  let bombWeight = 0;
  let totalWeight = 0;
  const allocations = new Map<PlayerPosition, number>();
  const visitGroup = (
    groupIndex: number,
    remainingRankCopies: number,
    weight: number
  ) => {
    if (groupIndex === groups.length) {
      if (remainingRankCopies !== 0) return;
      const evidenceLikelihood = evidence.reduce((likelihood, observation) => {
        const totalCount = knownCounts[observation.playerPosition] +
          (allocations.get(observation.playerPosition) ?? 0);
        return likelihood * (
          totalCount >= observation.atLeastCount
            ? observation.likelihoodIfPresent
            : observation.likelihoodIfAbsent
        );
      }, 1);
      const posteriorWeight = weight * evidenceLikelihood;
      totalWeight += posteriorWeight;
      const opponentHasBomb = OPPONENT_POSITIONS.some(position =>
        knownCounts[position] + (allocations.get(position) ?? 0) >= 4
      );
      if (opponentHasBomb) bombWeight += posteriorWeight;
      return;
    }

    const group = groups[groupIndex];
    const remainingSlots = groups
      .slice(groupIndex + 1)
      .reduce((total, item) => total + item.slots, 0);
    const minimum = Math.max(0, remainingRankCopies - remainingSlots);
    const maximum = Math.min(group.slots, remainingRankCopies);
    for (let count = minimum; count <= maximum; count++) {
      if (group.position) allocations.set(group.position, count);
      visitGroup(
        groupIndex + 1,
        remainingRankCopies - count,
        weight * choose(group.slots, count)
      );
    }
  };

  visitGroup(0, rankCopies, 1);
  return totalWeight > 0
    ? clampProbability(bombWeight / totalWeight)
    : null;
};

/**
 * 依据已知手牌、明牌、已出牌和各家剩余槽位，动态估算点数归属与炸弹概率。
 * 概率是条件于当前信息的随机发牌后验，不把策略性过牌伪装成确定事实。
 */
export function inferCardDistribution(
  gameState: GameState,
  evidence: RankCountLikelihoodEvidence[] = []
): CardDistributionInference {
  const playedCardIds = new Set(
    gameState.playHistory.flatMap(record => record.cards.map(card => card.id))
  );
  const knownUnplayedOwner = new Map<string, PlayerPosition>();
  gameState.players.forEach(player => {
    player.cards.forEach(card => {
      if (!playedCardIds.has(card.id) && !knownUnplayedOwner.has(card.id)) {
        knownUnplayedOwner.set(card.id, player.position);
      }
    });
  });

  const knownUnplayedCounts = PLAYER_POSITIONS.reduce((counts, position) => {
    counts[position] = STANDARD_RANKS.reduce((rankCounts, rank) => {
      rankCounts[rank] = 0;
      return rankCounts;
    }, {} as Record<GameRank, number>);
    return counts;
  }, {} as Record<PlayerPosition, Record<GameRank, number>>);
  const knownUnplayedCardTotals = PLAYER_POSITIONS.reduce((counts, position) => {
    counts[position] = 0;
    return counts;
  }, {} as Record<PlayerPosition, number>);

  knownUnplayedOwner.forEach((position, cardId) => {
    const card = gameState.allCards.find(candidate => candidate.id === cardId);
    if (!card) return;
    knownUnplayedCardTotals[position] += 1;
    if (card.rank >= 2 && card.rank <= 14) {
      knownUnplayedCounts[position][card.rank as GameRank] += 1;
    }
  });

  const playerSlots = PLAYER_POSITIONS.reduce((slots, position) => {
    const player = gameState.players.find(candidate => candidate.position === position);
    slots[position] = Math.max(
      0,
      (player?.remainingCount ?? 0) - knownUnplayedCardTotals[position]
    );
    return slots;
  }, {} as Record<PlayerPosition, number>);

  const playedCountByRank = STANDARD_RANKS.reduce((counts, rank) => {
    counts[rank] = gameState.playHistory.reduce(
      (total, record) => total +
        record.cards.filter(card => card.rank === rank).length,
      0
    );
    return counts;
  }, {} as Record<GameRank, number>);
  const totalCountByRank = STANDARD_RANKS.reduce((counts, rank) => {
    counts[rank] = gameState.allCards.filter(card => card.rank === rank).length;
    return counts;
  }, {} as Record<GameRank, number>);

  const knownUnplayedTotal = knownUnplayedOwner.size;
  const informationCoverage = gameState.allCards.length > 0
    ? clampProbability(
      (playedCardIds.size + knownUnplayedTotal) / gameState.allCards.length
    )
    : 0;

  const bombCandidates = STANDARD_RANKS.map(rank => {
    const rankEvidence = evidence.filter(observation =>
      observation.rank === rank
    );
    const knownCounts = PLAYER_POSITIONS.reduce((counts, position) => {
      counts[position] = knownUnplayedCounts[position][rank];
      return counts;
    }, {} as Record<PlayerPosition, number>);
    const totalKnownForRank = PLAYER_POSITIONS.reduce(
      (total, position) => total + knownCounts[position],
      0
    );
    const remainingCopies = Math.max(
      0,
      totalCountByRank[rank] - playedCountByRank[rank]
    );
    const unknownCopies = Math.max(0, remainingCopies - totalKnownForRank);
    const populationSize = Math.max(
      0,
      gameState.allCards.length - playedCardIds.size - knownUnplayedTotal
    );
    const playerEstimates = PLAYER_POSITIONS.reduce((estimates, position) => {
      estimates[position] = getPlayerRankEstimate(
        populationSize,
        unknownCopies,
        playerSlots[position],
        knownCounts[position],
        rankEvidence.filter(observation =>
          observation.playerPosition === position
        )
      );
      return estimates;
    }, {} as Record<PlayerPosition, PlayerRankProbability>);
    const exactJointProbability = getAnyOpponentBombProbability(
      populationSize,
      unknownCopies,
      playerSlots,
      knownCounts,
      rankEvidence
    );
    const approximateJointProbability = 1 - OPPONENT_POSITIONS.reduce(
      (noneProbability, position) =>
        noneProbability * (1 - playerEstimates[position].bombProbability),
      1
    );
    const mostLikelyProbability = Math.max(
      ...OPPONENT_POSITIONS.map(position =>
        playerEstimates[position].bombProbability
      )
    );
    const mostLikelyPlayers = mostLikelyProbability <= 1e-9
      ? []
      : OPPONENT_POSITIONS.filter(position =>
        Math.abs(
          playerEstimates[position].bombProbability - mostLikelyProbability
        ) <= 1e-6
      );
    const knownRankEvidence = playedCountByRank[rank] + totalKnownForRank;

    return {
      rank,
      remainingCopies,
      outsideMyHandCopies: Math.max(
        0,
        remainingCopies - knownCounts.bottom
      ),
      anyOpponentBombProbability:
        exactJointProbability ?? clampProbability(approximateJointProbability),
      mostLikelyPlayers,
      playerEstimates,
      rankInformationCoverage: totalCountByRank[rank] > 0
        ? clampProbability(knownRankEvidence / totalCountByRank[rank])
        : 0,
      exactJointProbability: exactJointProbability !== null
    };
  }).sort((left, right) =>
    right.anyOpponentBombProbability - left.anyOpponentBombProbability ||
    right.outsideMyHandCopies - left.outsideMyHandCopies ||
    left.rank - right.rank
  );
  const inferenceByRank = new Map(
    bombCandidates.map(candidate => [candidate.rank, candidate])
  );
  const playerShapes = OPPONENT_POSITIONS.map(position => {
    const estimates = STANDARD_RANKS.reduce((byRank, rank) => {
      byRank[rank] = inferenceByRank.get(rank)!.playerEstimates[position];
      return byRank;
    }, {} as Record<GameRank, PlayerRankProbability>);
    return buildPlayerShapeInference(position, estimates);
  });
  const certainty = playerShapes.length > 0
    ? playerShapes.reduce(
      (total, inference) => total + inference.certainty,
      0
    ) / playerShapes.length
    : 0;

  return {
    informationCoverage,
    certainty: clampProbability(certainty),
    bombCandidates,
    playerShapes,
    appliedEvidenceCount: evidence.length
  };
}
