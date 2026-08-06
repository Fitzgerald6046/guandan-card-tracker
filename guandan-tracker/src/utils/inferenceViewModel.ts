import type {
  AIAnalysisResult,
  GameRank,
  GameState,
  InferredCardOwnership,
  KnownCardOwnership,
  PlayerInferenceChip,
  PlayerPosition,
  TableInferenceViewModel
} from '../types/game';
import { RANK_DISPLAY_NAMES } from '../types/game';

const OPPONENT_POSITIONS: PlayerPosition[] = ['left', 'top', 'right'];
const MAX_CHIPS_PER_PLAYER = 3;

const CHIP_THRESHOLDS = {
  rankCount: { enter: 0.72, exit: 0.58 },
  bomb: { enter: 0.45, exit: 0.32 },
  structure: { enter: 0.58, exit: 0.5 },
  responseLimit: { enter: 0.62, exit: 0.52 }
} as const;

const SIGNAL_THRESHOLDS = {
  rankPosteriorLift: 0.08,
  rankOpponentLead: 0.15,
  bombPosteriorLift: 0.06,
  bombOpponentLead: 0.12,
  endgameConcentration: 0.78
} as const;

const getContextKey = (gameState: GameState): string =>
  `${gameState.gameId}:${gameState.config.gameMode ?? 'guandan'}:` +
  `${gameState.config.landlordPosition ?? ''}:${gameState.currentRank}`;

const emptyChips = (): Record<PlayerPosition, PlayerInferenceChip[]> => ({
  bottom: [],
  left: [],
  top: [],
  right: []
});

const wasVisible = (
  previous: TableInferenceViewModel | null | undefined,
  position: PlayerPosition,
  id: string
): boolean => previous?.playerChips[position].some(chip => chip.id === id) ?? false;

const passesThreshold = (
  confidence: number,
  thresholds: { enter: number; exit: number },
  alreadyVisible: boolean
): boolean => confidence >= (alreadyVisible ? thresholds.exit : thresholds.enter);

const buildKnownOwnership = (
  gameState: GameState
): Record<string, KnownCardOwnership> => {
  const ownership: Record<string, KnownCardOwnership> = {};

  gameState.players.forEach(player => {
    player.cards.forEach(card => {
      ownership[card.id] = {
        cardId: card.id,
        owner: player.position,
        source: player.position === 'bottom' ? 'self_hand' : 'revealed'
      };
    });
  });

  // 实际出牌优先于初始手牌/明牌来源，且始终是可核验硬事实。
  gameState.playHistory.forEach(record => {
    record.cards.forEach(card => {
      ownership[card.id] = {
        cardId: card.id,
        owner: record.playerPosition,
        source: 'played'
      };
    });
  });

  return ownership;
};

const rankCountProbability = (probabilityByCount: number[], count: number) =>
  probabilityByCount
    .slice(count)
    .reduce((total, probability) => total + probability, 0);

const buildRankChips = (
  analysis: AIAnalysisResult,
  previous: TableInferenceViewModel | null | undefined
): PlayerInferenceChip[] => {
  const baselineByRank = new Map(
    analysis.baselineCardDistribution.bombCandidates.map(candidate => [
      candidate.rank,
      candidate
    ])
  );

  return analysis.cardDistribution.bombCandidates.flatMap(candidate =>
    OPPONENT_POSITIONS.flatMap(position => {
    const estimate = candidate.playerEstimates[position];
    if (!estimate || estimate.minCount === estimate.maxCount) return [];

    const rankName = RANK_DISPLAY_NAMES[candidate.rank];
    const behaviorEvidence = analysis.evidenceLedger.rankCountEvidence
      .filter(evidence =>
        evidence.rank === candidate.rank &&
        evidence.playerPosition === position &&
        (evidence.source === 'pass' || evidence.source === 'restricted_choice')
      );
    const actionIds = behaviorEvidence.map(
      evidence => evidence.groupId ?? evidence.id
    );
    const baselineEstimate = baselineByRank
      .get(candidate.rank)?.playerEstimates[position];
    const ownershipClue = analysis.humanReasoning.ownershipClues.find(clue =>
      clue.rank === candidate.rank && clue.suspectedOwner === position
    );
    const endgameRank = analysis.endgameInference.players
      .find(player => player.playerPosition === position)
      ?.rankProbabilities[candidate.rank];

    const getOpponentLead = (
      selector: (opponent: PlayerPosition) => number
    ): number => {
      const otherMaximum = Math.max(
        ...OPPONENT_POSITIONS
          .filter(opponent => opponent !== position)
          .map(selector)
      );
      return selector(position) - otherMaximum;
    };
    if (ownershipClue && ownershipClue.inferredCount > 0) {
      const confidence = ownershipClue.probability;
      const id = `rank-${position}-${candidate.rank}-${ownershipClue.inferredCount}`;
      if (passesThreshold(
        confidence,
        { enter: 0.6, exit: CHIP_THRESHOLDS.rankCount.exit },
        wasVisible(previous, position, id)
      )) {
        return [{
          id,
          playerPosition: position,
          category: 'rank_count' as const,
          label: `${rankName}×${ownershipClue.inferredCount}?`,
          confidence,
          priority: 100 + confidence * 10,
          sourceActionIds: actionIds,
          inferredRank: candidate.rank,
          inferredCount: ownershipClue.inferredCount
        }];
      }
    }
    const bombId = `bomb-${position}-${candidate.rank}`;
    const bombProbability = estimate.bombProbability;
    const baselineBombProbability = baselineEstimate?.bombProbability ??
      bombProbability;
    const bombLift = bombProbability - baselineBombProbability;
    const bombLead = getOpponentLead(opponent =>
      candidate.playerEstimates[opponent].bombProbability
    );
    const endgameBombConcentrated =
      (endgameRank?.probabilityAtLeastOne ?? 0) >=
        SIGNAL_THRESHOLDS.endgameConcentration &&
      estimate.minCount >= 4;
    const hasBombSignal = (
      behaviorEvidence.length > 0 &&
      bombLift >= SIGNAL_THRESHOLDS.bombPosteriorLift &&
      bombLead >= SIGNAL_THRESHOLDS.bombOpponentLead
    ) || endgameBombConcentrated;
    if (hasBombSignal && passesThreshold(
      bombProbability,
      CHIP_THRESHOLDS.bomb,
      wasVisible(previous, position, bombId)
    )) {
      return [{
        id: bombId,
        playerPosition: position,
        category: 'bomb_risk' as const,
        label: `${rankName}炸?`,
        confidence: bombProbability,
        priority: 90 + bombProbability * 10,
        sourceActionIds: actionIds,
        inferredRank: candidate.rank,
        inferredCount: 4
      }];
    }

    for (const count of [3, 2, 1] as const) {
      const confidence = rankCountProbability(estimate.probabilityByCount, count);
      const baselineConfidence = baselineEstimate
        ? rankCountProbability(baselineEstimate.probabilityByCount, count)
        : confidence;
      const posteriorLift = confidence - baselineConfidence;
      const opponentLead = getOpponentLead(opponent =>
        rankCountProbability(
          candidate.playerEstimates[opponent].probabilityByCount,
          count
        )
      );
      const ownershipPattern = count === 1 && Boolean(
        ownershipClue && ownershipClue.probability >= confidence
      );
      const endgameConcentrated = Boolean(
        endgameRank &&
        count === 1 &&
        endgameRank.probabilityAtLeastOne >=
          SIGNAL_THRESHOLDS.endgameConcentration &&
        opponentLead >= SIGNAL_THRESHOLDS.rankOpponentLead
      );
      const behaviorConcentrated =
        behaviorEvidence.length > 0 &&
        posteriorLift >= SIGNAL_THRESHOLDS.rankPosteriorLift &&
        opponentLead >= SIGNAL_THRESHOLDS.rankOpponentLead;
      if (!ownershipPattern && !endgameConcentrated && !behaviorConcentrated) {
        continue;
      }
      const id = `rank-${position}-${candidate.rank}-${count}`;
      if (passesThreshold(
        confidence,
        CHIP_THRESHOLDS.rankCount,
        wasVisible(previous, position, id)
      )) {
        return [{
          id,
          playerPosition: position,
          category: 'rank_count' as const,
          label: `${rankName}×${count}?`,
          confidence,
          priority: 60 + count * 5 + confidence * 10,
          sourceActionIds: actionIds,
          inferredRank: candidate.rank,
          inferredCount: count
        }];
      }
    }
    return [];
  }));
};

const buildStructureChips = (
  analysis: AIAnalysisResult,
  previous: TableInferenceViewModel | null | undefined
): PlayerInferenceChip[] => analysis.humanReasoning.playerStructures.flatMap(
  profile => {
    if (profile.playerPosition === 'bottom') return [];
    const chips: PlayerInferenceChip[] = [];
    // 历史累计的顺/三/对倾向尚未按“当前剩余结构”重算，不能直接投到
    // 实战牌面。这里只采用具备替代选择与后续反证链路的小对子证据。
    const playerChoiceEvidence = analysis.humanReasoning.choiceEvidence
      .filter(evidence =>
        evidence.playerPosition === profile.playerPosition &&
        evidence.scenario === 'pair_response'
      );
    const smallPairConfidence = 1 - profile.pairFlexibility;
    const smallPairId = `structure-${profile.playerPosition}-small-pair`;
    if (playerChoiceEvidence.length > 0 && passesThreshold(
      smallPairConfidence,
      CHIP_THRESHOLDS.structure,
      wasVisible(previous, profile.playerPosition, smallPairId)
    )) {
      chips.push({
        id: smallPairId,
        playerPosition: profile.playerPosition,
        category: 'pair_structure',
        label: '对选择窄',
        confidence: smallPairConfidence,
        priority: 48 + smallPairConfidence * 10,
        sourceActionIds: playerChoiceEvidence.map(evidence => evidence.actionId)
      });
    }
    return chips;
  }
);

const buildPassChips = (
  gameState: GameState,
  analysis: AIAnalysisResult,
  previous: TableInferenceViewModel | null | undefined
): PlayerInferenceChip[] => analysis.passInferences.flatMap(inference => {
  if (inference.status !== 'active' || inference.playerPosition === 'bottom') return [];
  const currentLead = gameState.currentRound.currentMaxPlay;
  if (
    !currentLead ||
    inference.leadPlayerPosition !== currentLead.playerPosition ||
    inference.leadType !== currentLead.type ||
    inference.lastTimestamp < currentLead.timestamp
  ) return [];
  const label = inference.leadType === 'pair'
    ? '对受限'
    : inference.leadType === 'triple' || inference.leadType === 'triple_with_pair'
      ? '三受限'
      : inference.leadType === 'single'
        ? '单受限'
        : null;
  if (!label) return [];
  const id = `pass-${inference.playerPosition}-${inference.leadType}`;
  if (!passesThreshold(
    inference.confidence,
    CHIP_THRESHOLDS.responseLimit,
    wasVisible(previous, inference.playerPosition, id)
  )) return [];

  return [{
    id,
    playerPosition: inference.playerPosition,
    category: 'response_limit' as const,
    label,
    confidence: inference.confidence,
    priority: 72 + inference.confidence * 10,
    sourceActionIds: [inference.id],
    expiresWhenRoundChanges: true
  }];
});

const getCurrentLeadRank = (gameState: GameState): GameRank | null => {
  const ranks = gameState.currentRound.currentMaxPlay?.cards
    .map(card => card.rank)
    .filter((rank): rank is GameRank => rank >= 2 && rank <= 14) ?? [];
  return ranks.length > 0 ? ranks[0] : null;
};

const buildInferredOwnership = (
  gameState: GameState,
  knownOwnership: Record<string, KnownCardOwnership>,
  playerChips: Record<PlayerPosition, PlayerInferenceChip[]>
): Record<string, InferredCardOwnership> => {
  const inferred: Record<string, InferredCardOwnership> = {};
  const claimed = new Set<string>();

  OPPONENT_POSITIONS.forEach(position => {
    playerChips[position]
      .filter(chip => chip.inferredRank !== undefined && chip.inferredCount)
      .forEach(chip => {
        const candidates = gameState.allCards
          .filter(card =>
            card.rank === chip.inferredRank &&
            !card.isPlayed &&
            !knownOwnership[card.id] &&
            !claimed.has(card.id)
          )
          .sort((left, right) => left.id.localeCompare(right.id));

        candidates.slice(0, chip.inferredCount).forEach(card => {
          claimed.add(card.id);
          inferred[card.id] = {
            cardId: card.id,
            suspectedOwner: position,
            confidence: chip.confidence,
            rank: chip.inferredRank!
          };
        });
      });
  });

  return inferred;
};

export function buildInferenceViewModel(
  gameState: GameState,
  analysis: AIAnalysisResult | null,
  previous?: TableInferenceViewModel | null
): TableInferenceViewModel {
  const contextKey = getContextKey(gameState);
  const reusablePrevious = previous?.contextKey === contextKey
    ? previous
    : null;
  const playerChips = emptyChips();
  const knownOwnership = buildKnownOwnership(gameState);
  if (!analysis) {
    return {
      contextKey,
      knownOwnership,
      inferredOwnership: {},
      playerChips
    };
  }

  const currentLeadRank = getCurrentLeadRank(gameState);
  const activePositions = new Set(
    gameState.players.map(player => player.position)
  );
  const candidates = [
    ...buildRankChips(analysis, reusablePrevious),
    ...buildPassChips(gameState, analysis, reusablePrevious),
    ...buildStructureChips(analysis, reusablePrevious)
  ].filter(chip => activePositions.has(chip.playerPosition));

  OPPONENT_POSITIONS.forEach(position => {
    playerChips[position] = candidates
      .filter(chip => chip.playerPosition === position)
      .map(chip => ({
        ...chip,
        priority: chip.priority + (
          currentLeadRank !== null && chip.label.startsWith(
            RANK_DISPLAY_NAMES[currentLeadRank]
          ) ? 20 : 0
        )
      }))
      .sort((left, right) =>
        right.priority - left.priority ||
        right.confidence - left.confidence ||
        left.label.localeCompare(right.label, 'zh-CN')
      )
      .filter((chip, index, all) =>
        all.findIndex(candidate =>
          candidate.category === chip.category &&
          candidate.label === chip.label
        ) === index
      )
      .slice(0, MAX_CHIPS_PER_PLAYER);
  });

  return {
    contextKey,
    knownOwnership,
    inferredOwnership: buildInferredOwnership(
      gameState,
      knownOwnership,
      playerChips
    ),
    playerChips
  };
}

export const INFERENCE_VIEW_LIMITS = {
  maxChipsPerPlayer: MAX_CHIPS_PER_PLAYER,
  thresholds: CHIP_THRESHOLDS,
  signalThresholds: SIGNAL_THRESHOLDS
};
