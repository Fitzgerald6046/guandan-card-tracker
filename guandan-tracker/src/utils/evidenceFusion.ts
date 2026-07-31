import type {
  GameState,
  HumanReasoningInference,
  InferenceEvidenceLedger,
  PlayerPassInference,
  RankCountLikelihoodEvidence
} from '../types/game';
import {
  PASS_EVIDENCE_CONFIG,
  PASS_INFERENCE_CONFIDENCE
} from './inferenceConstants';

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const getPassGroupLikelihood = (confidence: number): number => {
  const span =
    PASS_INFERENCE_CONFIDENCE.activeCap -
    PASS_EVIDENCE_CONFIG.minimumConfidence;
  const normalized = span > 0
    ? clamp(
      (confidence - PASS_EVIDENCE_CONFIG.minimumConfidence) / span,
      0,
      1
    )
    : 0;
  return PASS_EVIDENCE_CONFIG.likelihoodAtMinimumConfidence -
    normalized * (
      PASS_EVIDENCE_CONFIG.likelihoodAtMinimumConfidence -
      PASS_EVIDENCE_CONFIG.likelihoodAtMaximumConfidence
    );
};

/**
 * 将各推理层转成统一账本。
 *
 * 显式手牌/明牌已经由 cardDistributionInference 直接扣出未知池，
 * 此处只登记数量用于审计，绝不重复作为似然证据。达到最低置信度的
 * 非配合性过牌会作为保守负似然进入后验；矛盾、低置信度和配合过牌
 * 仍只保留为文字线索。
 */
export function buildInferenceEvidenceLedger(
  gameState: GameState,
  humanReasoning: HumanReasoningInference,
  passInferences: PlayerPassInference[]
): InferenceEvidenceLedger {
  const playedIds = new Set(
    gameState.playHistory.flatMap(record => record.cards.map(card => card.id))
  );
  const knownCardFactCount = new Set(
    gameState.players.flatMap(player =>
      player.cards
        .filter(card => !playedIds.has(card.id))
        .map(card => card.id)
    )
  ).size;

  const restrictedChoiceEvidence: RankCountLikelihoodEvidence[] =
    humanReasoning.choiceEvidence.flatMap(choice =>
      choice.alternativeRanks.map(rank => ({
        id: `${choice.id}-${rank}`,
        playerPosition: choice.playerPosition,
        rank,
        atLeastCount: 2 as const,
        likelihoodIfPresent:
          1 / (choice.alternativeLikelihoodRatios[rank] ?? 1),
        likelihoodIfAbsent: 1,
        source: 'restricted_choice' as const,
        groupId: choice.id,
        summary: choice.summary
      }))
    );
  const playedCountByRank = gameState.playHistory.reduce((counts, record) => {
    record.cards.forEach(card => {
      if (card.rank >= 2 && card.rank <= 14) {
        counts[card.rank] = (counts[card.rank] ?? 0) + 1;
      }
    });
    return counts;
  }, {} as Partial<Record<number, number>>);
  const totalCountByRank = gameState.allCards.reduce((counts, card) => {
    if (card.rank >= 2 && card.rank <= 14) {
      counts[card.rank] = (counts[card.rank] ?? 0) + 1;
    }
    return counts;
  }, {} as Partial<Record<number, number>>);
  const activePassGroups = PASS_EVIDENCE_CONFIG.enabled
    ? passInferences.filter(inference =>
      inference.status === 'active' &&
      inference.confidence >= PASS_EVIDENCE_CONFIG.minimumConfidence &&
      inference.candidateRankCounts.length > 0
    )
    : [];
  const passEvidence: RankCountLikelihoodEvidence[] =
    activePassGroups.flatMap(inference => {
      const viableCandidates = inference.candidateRankCounts.filter(candidate =>
        (totalCountByRank[candidate.rank] ?? 0) -
          (playedCountByRank[candidate.rank] ?? 0) >= candidate.atLeastCount
      );
      if (viableCandidates.length === 0) return [];

      const groupLikelihood = getPassGroupLikelihood(inference.confidence);
      const perCandidateLikelihood = Math.pow(
        groupLikelihood,
        1 / viableCandidates.length
      );
      return viableCandidates.map(candidate => ({
        id: `${inference.id}-${candidate.rank}-${candidate.atLeastCount}`,
        playerPosition: inference.playerPosition,
        rank: candidate.rank,
        atLeastCount: candidate.atLeastCount,
        likelihoodIfPresent: perCandidateLikelihood,
        likelihoodIfAbsent: 1,
        source: 'pass' as const,
        groupId: inference.id,
        summary:
          `${inference.summary} 同一次过牌的${viableCandidates.length}个候选` +
          `共享总似然×${groupLikelihood.toFixed(2)}，避免重复乘权。`
      }));
    });
  const rankCountEvidence = [
    ...restrictedChoiceEvidence,
    ...passEvidence
  ];
  const activePassCount = passInferences.filter(
    inference => inference.status === 'active'
  ).length;
  const knownOwnershipClues = humanReasoning.ownershipClues.filter(
    clue => clue.confidence === 'known'
  ).length;

  return {
    knownCardFactCount,
    rankCountEvidence,
    choiceEvidence: humanReasoning.choiceEvidence,
    summary:
      `硬事实${knownCardFactCount}张已直接扣出未知池；` +
      `限制选择${restrictedChoiceEvidence.length}条、` +
      `过牌${activePassGroups.length}组/${passEvidence.length}条进入后验；` +
      `${knownOwnershipClues}条已知归属不重复计数；` +
      `${Math.max(0, activePassCount - activePassGroups.length)}条过牌线索` +
      `因置信度或牌型不足只作文字提示。`
  };
}
