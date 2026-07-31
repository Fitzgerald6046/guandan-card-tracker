import type {
  ChoiceEvidence,
  GameRank,
  GameState,
  PlayRecord,
  PlayerPosition
} from '../types/game';
import { RANK_DISPLAY_NAMES, Rank } from '../types/game';
import {
  CARDS_PER_PLAYER,
  PLAYER_DISPLAY_NAMES
} from './gameProgress';
import { STRUCTURE_INFERENCE_CONFIG } from './inferenceConstants';

const STANDARD_RANKS: GameRank[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14
];

const getNaturalRankGroups = (record: PlayRecord): Map<GameRank, number> => {
  const groups = new Map<GameRank, number>();
  record.cards
    .filter(card =>
      !card.isWildCard &&
      card.rank >= Rank.TWO &&
      card.rank <= Rank.ACE
    )
    .forEach(card => {
      const rank = card.rank as GameRank;
      groups.set(rank, (groups.get(rank) ?? 0) + 1);
    });
  return groups;
};

const getPairRank = (record: PlayRecord): GameRank | null => {
  const pair = [...getNaturalRankGroups(record).entries()]
    .find(([, count]) => count >= 2);
  return pair?.[0] ?? null;
};

const getTripleRank = (record: PlayRecord): GameRank | null => {
  const triple = [...getNaturalRankGroups(record).entries()]
    .find(([, count]) => count >= 3);
  return triple?.[0] ?? null;
};

const getKickerPairRank = (record: PlayRecord): GameRank | null => {
  if (record.type !== 'triple_with_pair') return null;
  const pair = [...getNaturalRankGroups(record).entries()]
    .find(([, count]) => count === 2);
  return pair?.[0] ?? null;
};

const getRankStrength = (rank: GameRank, currentRank: GameRank): number => {
  if (rank === currentRank) return 100;
  return rank;
};

const getInformationWeight = (remainingBeforePlay: number): number =>
  Math.min(
    1,
    STRUCTURE_INFERENCE_CONFIG.fullInformationRemainingCards /
      Math.max(
        STRUCTURE_INFERENCE_CONFIG.fullInformationRemainingCards,
        remainingBeforePlay
      )
  );

const buildAlternativeLikelihoodRatios = (
  alternatives: GameRank[],
  informationWeight: number
): Partial<Record<GameRank, number>> => {
  const choiceCount = alternatives.length + 1;
  const singleAlternativeRatio = Math.pow(
    choiceCount / Math.max(1, choiceCount - 1),
    informationWeight
  );
  return alternatives.reduce((ratios, rank) => {
    ratios[rank] = singleAlternativeRatio;
    return ratios;
  }, {} as Partial<Record<GameRank, number>>);
};

const countPlayedCards = (
  counts: Record<PlayerPosition, number>,
  record: PlayRecord
) => {
  counts[record.playerPosition] += record.cards.length;
};

/**
 * 将“当时还有多少近似等价选择”转成限制选择似然。
 *
 * 只有同牌型、同张数且不会动用炸弹的选择才进入模型。早期选择按
 * 5/剩余张数降权；≤5张时使用完整权重。
 */
export function analyzeChoiceEvidence(
  gameState: GameState
): ChoiceEvidence[] {
  const evidence: ChoiceEvidence[] = [];
  const playedByPlayer: Record<PlayerPosition, number> = {
    bottom: 0,
    left: 0,
    top: 0,
    right: 0
  };
  const playedByRank = STANDARD_RANKS.reduce((counts, rank) => {
    counts[rank] = 0;
    return counts;
  }, {} as Record<GameRank, number>);
  const totalByRank = STANDARD_RANKS.reduce((counts, rank) => {
    counts[rank] = gameState.allCards.filter(card => card.rank === rank).length;
    return counts;
  }, {} as Record<GameRank, number>);
  let activeLead: PlayRecord | null = null;
  let consecutivePasses = 0;

  gameState.playHistory.forEach(record => {
    const remainingBeforePlay = Math.max(
      0,
      CARDS_PER_PLAYER - playedByPlayer[record.playerPosition]
    );

    if (record.type === 'pass') {
      consecutivePasses += 1;
      if (consecutivePasses >= 3) activeLead = null;
      return;
    }

    if (record.playerPosition !== 'bottom' &&
        record.type === 'pair' &&
        activeLead?.type === 'pair') {
      const chosenRank = getPairRank(record);
      const leadRank = getPairRank(activeLead);
      if (chosenRank !== null && leadRank !== null) {
        const chosenStrength = getRankStrength(
          chosenRank,
          gameState.currentRank
        );
        const leadStrength = getRankStrength(
          leadRank,
          gameState.currentRank
        );
        const alternatives = STANDARD_RANKS.filter(rank => {
          if (rank === chosenRank) return false;
          const strength = getRankStrength(rank, gameState.currentRank);
          const remainingCopies = totalByRank[rank] - playedByRank[rank];
          return strength > leadStrength &&
            Math.abs(strength - chosenStrength) <= 1 &&
            remainingCopies >= 2;
        });

        if (alternatives.length > 0) {
          const informationWeight = getInformationWeight(remainingBeforePlay);
          const equivalentChoiceCount = alternatives.length + 1;
          const likelihoodRatio = Math.pow(
            equivalentChoiceCount,
            informationWeight
          );
          evidence.push({
            id: `${record.id}-pair-choice`,
            actionId: record.id,
            playerPosition: record.playerPosition,
            scenario: 'pair_response',
            chosenRank,
            alternativeRanks: alternatives,
            equivalentChoiceCount,
            remainingBeforePlay,
            informationWeight,
            likelihoodRatio,
            alternativeLikelihoodRatios:
              buildAlternativeLikelihoodRatios(
                alternatives,
                informationWeight
              ),
            summary: `${PLAYER_DISPLAY_NAMES[record.playerPosition]}用${RANK_DISPLAY_NAMES[chosenRank]}对子应对时，另有${alternatives.map(rank => RANK_DISPLAY_NAMES[rank]).join('/')}等相邻强度选择；按限制选择，未选对子存在性的赔率下调×${likelihoodRatio.toFixed(2)}（当时剩${remainingBeforePlay}张）。`
          });
        }
      }
    }

    if (record.playerPosition !== 'bottom' &&
        record.type === 'triple_with_pair') {
      const chosenRank = getKickerPairRank(record);
      const tripleRank = getTripleRank(record);
      if (chosenRank !== null) {
        const alternatives = STANDARD_RANKS.filter(rank =>
          rank !== chosenRank &&
          rank !== tripleRank &&
          totalByRank[rank] - playedByRank[rank] >= 2
        );
        if (alternatives.length > 0) {
          const informationWeight = getInformationWeight(remainingBeforePlay);
          const equivalentChoiceCount = alternatives.length + 1;
          const likelihoodRatio = Math.pow(
            equivalentChoiceCount,
            informationWeight
          );
          evidence.push({
            id: `${record.id}-kicker-choice`,
            actionId: record.id,
            playerPosition: record.playerPosition,
            scenario: 'triple_pair_kicker',
            chosenRank,
            alternativeRanks: alternatives,
            equivalentChoiceCount,
            remainingBeforePlay,
            informationWeight,
            likelihoodRatio,
            alternativeLikelihoodRatios:
              buildAlternativeLikelihoodRatios(
                alternatives,
                informationWeight
              ),
            summary: `${PLAYER_DISPLAY_NAMES[record.playerPosition]}三带二选择${RANK_DISPLAY_NAMES[chosenRank]}作对子；若同时拥有其它可带对子，本次选择空间为${equivalentChoiceCount}，未选对子存在性的赔率按×${likelihoodRatio.toFixed(2)}下调。`
          });
        }
      }
    }

    countPlayedCards(playedByPlayer, record);
    record.cards.forEach(card => {
      if (card.rank >= Rank.TWO && card.rank <= Rank.ACE) {
        playedByRank[card.rank as GameRank] += 1;
      }
    });
    activeLead = record;
    consecutivePasses = 0;
  });

  return evidence.flatMap(observation => {
    const actionIndex = gameState.playHistory.findIndex(
      record => record.id === observation.actionId
    );
    const stillUnresolvedAlternatives = observation.alternativeRanks.filter(
      rank => {
        const laterShownCount = gameState.playHistory
          .slice(actionIndex + 1)
          .filter(record =>
            record.playerPosition === observation.playerPosition
          )
          .reduce(
            (total, record) =>
              total + record.cards.filter(card => card.rank === rank).length,
            0
          );
        return laterShownCount < 2;
      }
    );
    if (stillUnresolvedAlternatives.length === 0) return [];

    const equivalentChoiceCount = stillUnresolvedAlternatives.length + 1;
    const likelihoodRatio = Math.pow(
      equivalentChoiceCount,
      observation.informationWeight
    );
    const alternativeDisplay = stillUnresolvedAlternatives
      .map(rank => RANK_DISPLAY_NAMES[rank])
      .join('/');
    const scenarioText = observation.scenario === 'pair_response'
      ? '对子应对'
      : '三带二选对子';
    const alternativeRatios = buildAlternativeLikelihoodRatios(
      stillUnresolvedAlternatives,
      observation.informationWeight
    );
    const singleAlternativeRatio =
      alternativeRatios[stillUnresolvedAlternatives[0]] ?? 1;

    return [{
      ...observation,
      alternativeRanks: stillUnresolvedAlternatives,
      equivalentChoiceCount,
      likelihoodRatio,
      alternativeLikelihoodRatios: alternativeRatios,
      summary: `${PLAYER_DISPLAY_NAMES[observation.playerPosition]}${scenarioText}选${RANK_DISPLAY_NAMES[observation.chosenRank]}，仍有${alternativeDisplay}等${equivalentChoiceCount - 1}个未被后续反证的近似等价选择；整组“被迫选择”赔率×${likelihoodRatio.toFixed(2)}，分摊到单个未选对子为×${singleAlternativeRatio.toFixed(2)}（当时剩${observation.remainingBeforePlay}张）。`
    }];
  });
}
