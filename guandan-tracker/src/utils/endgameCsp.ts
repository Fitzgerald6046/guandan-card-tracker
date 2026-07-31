import type {
  EndgameHandCandidate,
  EndgameInference,
  EndgamePlayerInference,
  GameState,
  InferenceEvidenceLedger,
  PlayerPosition,
  Rank
} from '../types/game';
import {
  PLAYER_DISPLAY_NAMES
} from './gameProgress';

const ENDGAME_THRESHOLD = 5;
const ENUMERATED_RANKS: Rank[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
];
const OPPONENT_POSITIONS: PlayerPosition[] = ['left', 'top', 'right'];

const choose = (total: number, selected: number): number => {
  if (selected < 0 || selected > total) return 0;
  const count = Math.min(selected, total - selected);
  let result = 1;
  for (let index = 1; index <= count; index++) {
    result *= (total - count + index) / index;
  }
  return result;
};

const expandRanks = (
  knownCounts: Record<Rank, number>,
  unknownCounts: number[]
): Rank[] => ENUMERATED_RANKS.flatMap((rank, index) =>
  Array.from(
    { length: knownCounts[rank] + unknownCounts[index] },
    () => rank
  )
);

interface EnumeratedComposition {
  counts: number[];
  physicalWeight: number;
  posteriorWeight: number;
}

const enumeratePlayer = (
  gameState: GameState,
  ledger: InferenceEvidenceLedger,
  position: PlayerPosition,
  threshold: number
): EndgamePlayerInference | null => {
  const player = gameState.players.find(
    candidate => candidate.position === position
  );
  if (!player ||
      player.remainingCount <= 0 ||
      player.remainingCount > threshold) {
    return null;
  }

  const playedIds = new Set(
    gameState.playHistory.flatMap(record => record.cards.map(card => card.id))
  );
  const knownOwner = new Map<string, PlayerPosition>();
  gameState.players.forEach(candidate => {
    candidate.cards.forEach(card => {
      if (!playedIds.has(card.id) && !knownOwner.has(card.id)) {
        knownOwner.set(card.id, candidate.position);
      }
    });
  });
  const knownCards = player.cards.filter(card => !playedIds.has(card.id));
  const unknownSlotCount = player.remainingCount - knownCards.length;
  if (unknownSlotCount < 0 || unknownSlotCount > threshold) return null;

  const availableCounts = ENUMERATED_RANKS.reduce((counts, rank) => {
    counts[rank] = gameState.allCards.filter(card =>
      card.rank === rank &&
      !playedIds.has(card.id) &&
      !knownOwner.has(card.id)
    ).length;
    return counts;
  }, {} as Record<Rank, number>);
  const knownCounts = ENUMERATED_RANKS.reduce((counts, rank) => {
    counts[rank] = knownCards.filter(card => card.rank === rank).length;
    return counts;
  }, {} as Record<Rank, number>);
  const playerEvidence = ledger.rankCountEvidence.filter(
    observation => observation.playerPosition === position
  );
  const compositions: EnumeratedComposition[] = [];
  const workingCounts = Array.from(
    { length: ENUMERATED_RANKS.length },
    () => 0
  );

  const visit = (
    rankIndex: number,
    remainingSlots: number,
    physicalWeight: number
  ) => {
    if (rankIndex === ENUMERATED_RANKS.length) {
      if (remainingSlots !== 0) return;
      const evidenceLikelihood = playerEvidence.reduce(
        (likelihood, observation) => {
          const index = ENUMERATED_RANKS.indexOf(observation.rank);
          const totalCount = knownCounts[observation.rank] +
            (index >= 0 ? workingCounts[index] : 0);
          return likelihood * (
            totalCount >= observation.atLeastCount
              ? observation.likelihoodIfPresent
              : observation.likelihoodIfAbsent
          );
        },
        1
      );
      compositions.push({
        counts: [...workingCounts],
        physicalWeight,
        posteriorWeight: physicalWeight * evidenceLikelihood
      });
      return;
    }

    const rank = ENUMERATED_RANKS[rankIndex];
    const maximum = Math.min(availableCounts[rank], remainingSlots);
    for (let count = 0; count <= maximum; count++) {
      workingCounts[rankIndex] = count;
      visit(
        rankIndex + 1,
        remainingSlots - count,
        physicalWeight * choose(availableCounts[rank], count)
      );
    }
    workingCounts[rankIndex] = 0;
  };

  visit(0, unknownSlotCount, 1);
  const physicalCombinationCount = compositions.reduce(
    (total, composition) => total + composition.physicalWeight,
    0
  );
  const totalPosteriorWeight = compositions.reduce(
    (total, composition) => total + composition.posteriorWeight,
    0
  );
  if (compositions.length === 0 || totalPosteriorWeight <= 0) return null;

  const normalized = compositions.map(composition => ({
    ...composition,
    probability: composition.posteriorWeight / totalPosteriorWeight
  }));
  const rankProbabilities = ENUMERATED_RANKS.reduce((probabilities, rank) => {
    const rankIndex = ENUMERATED_RANKS.indexOf(rank);
    const counts = normalized.map(composition =>
      knownCounts[rank] + composition.counts[rankIndex]
    );
    probabilities[rank] = {
      probabilityAtLeastOne: normalized.reduce(
        (total, composition, index) =>
          total + (counts[index] > 0 ? composition.probability : 0),
        0
      ),
      expectedCount: normalized.reduce(
        (total, composition, index) =>
          total + counts[index] * composition.probability,
        0
      ),
      minCount: Math.min(...counts),
      maxCount: Math.max(...counts)
    };
    return probabilities;
  }, {} as EndgamePlayerInference['rankProbabilities']);
  const lockedCards = ENUMERATED_RANKS.flatMap(rank => {
    const probability = rankProbabilities[rank]!;
    return probability.minCount > 0
      ? [{ rank, count: probability.minCount }]
      : [];
  });
  const entropy = normalized.reduce(
    (total, composition) =>
      composition.probability > 0
        ? total - composition.probability * Math.log(composition.probability)
        : total,
    0
  );
  const maximumEntropy = normalized.length > 1
    ? Math.log(normalized.length)
    : 0;
  const certainty = maximumEntropy > 0
    ? Math.max(0, Math.min(1, 1 - entropy / maximumEntropy))
    : 1;
  const topCandidates: EndgameHandCandidate[] = normalized
    .sort((left, right) => right.probability - left.probability)
    .slice(0, 5)
    .map(composition => ({
      ranks: expandRanks(knownCounts, composition.counts),
      probability: composition.probability
    }));
  const lockedSummary = lockedCards.length > 0
    ? `，硬锁定${lockedCards.reduce((total, item) => total + item.count, 0)}张`
    : '';

  return {
    playerPosition: position,
    remainingCount: player.remainingCount,
    unknownSlotCount,
    rankCompositionCount: compositions.length,
    physicalCombinationCount,
    certainty,
    usesSoftEvidence: playerEvidence.length > 0,
    lockedCards,
    rankProbabilities,
    topCandidates,
    summary: `${PLAYER_DISPLAY_NAMES[position]}剩${player.remainingCount}张：枚举${compositions.length}种点数组合（对应${Math.round(physicalCombinationCount)}种实体牌组合）${lockedSummary}。`
  };
};

/**
 * 对≤5张的对手切换到具体点数组合枚举。
 * 组合计数严格满足剩余牌池、已出牌、手牌/明牌和剩余槽位；限制选择
 * 仅作为似然权重，不会被误当成硬排除。
 */
export function inferEndgameHands(
  gameState: GameState,
  ledger: InferenceEvidenceLedger,
  threshold = ENDGAME_THRESHOLD
): EndgameInference {
  return {
    threshold,
    players: OPPONENT_POSITIONS.flatMap(position => {
      const inference = enumeratePlayer(
        gameState,
        ledger,
        position,
        threshold
      );
      return inference ? [inference] : [];
    })
  };
}
