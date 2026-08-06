import type {
  CardDistributionInference,
  ChoiceEvidence,
  GameRank,
  GameState,
  HumanReasoningInference,
  PlayRecord,
  PlayerPosition,
  PlayerStructureInference,
  RankOwnershipClue,
  ReasoningStepReminder,
  StraightRouteInference
} from '../types/game';
import { getGameMode, getPlayerInitialCardCount } from './gameMode';
import { RANK_DISPLAY_NAMES, Rank } from '../types/game';
import { analyzeChoiceEvidence } from './choiceInference';
import { PLAYER_DISPLAY_NAMES } from './gameProgress';
import { STRUCTURE_INFERENCE_CONFIG } from './inferenceConstants';

const PLAYER_POSITIONS: PlayerPosition[] = ['bottom', 'left', 'top', 'right'];
const OPPONENT_POSITIONS: PlayerPosition[] = ['left', 'top', 'right'];
const STANDARD_RANKS: GameRank[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14
];
const NATURAL_STRAIGHT_ROUTES: GameRank[][] = [
  [14, 2, 3, 4, 5],
  ...Array.from(
    { length: 9 },
    (_, index) => Array.from(
      { length: 5 },
      (__, offset) => (index + offset + 2) as GameRank
    )
  )
];

const clamp = (value: number): number => Math.min(1, Math.max(0, value));
const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const buildPlayedRankCounts = (
  history: PlayRecord[]
): Record<PlayerPosition, Record<GameRank, number>> =>
  PLAYER_POSITIONS.reduce((byPlayer, position) => {
    byPlayer[position] = STANDARD_RANKS.reduce((byRank, rank) => {
      byRank[rank] = history.reduce(
        (total, record) => record.playerPosition === position
          ? total + record.cards.filter(card => card.rank === rank).length
          : total,
        0
      );
      return byRank;
    }, {} as Record<GameRank, number>);
    return byPlayer;
  }, {} as Record<PlayerPosition, Record<GameRank, number>>);

const buildRemainingRankCounts = (
  gameState: GameState
): Record<GameRank, number> => STANDARD_RANKS.reduce((counts, rank) => {
  const totalCopies = gameState.allCards.filter(card => card.rank === rank).length;
  const playedCopies = gameState.playHistory.reduce(
    (total, record) =>
      total + record.cards.filter(card => card.rank === rank).length,
    0
  );
  counts[rank] = Math.max(0, totalCopies - playedCopies);
  return counts;
}, {} as Record<GameRank, number>);

/** 对子应对灵活度只接受 pair_response，避免三带二附件选择污染。 */
export const calculatePairResponseFlexibility = (
  choiceEvidence: ChoiceEvidence[],
  position: PlayerPosition
): number => {
  const pairResponseEvidence = choiceEvidence.filter(observation =>
    observation.playerPosition === position &&
    observation.scenario === 'pair_response'
  );
  const pairFlexibilityLogOdds = pairResponseEvidence.reduce(
    (logOdds, observation) =>
      logOdds - Math.log(observation.likelihoodRatio),
    0
  );
  return clamp(1 / (1 + Math.exp(-pairFlexibilityLogOdds)));
};

const buildPlayerStructures = (
  history: PlayRecord[],
  choiceEvidence: ChoiceEvidence[]
): PlayerStructureInference[] => {
  const choiceCountByAction = new Map(
    choiceEvidence.map(observation => [
      observation.actionId,
      observation.equivalentChoiceCount
    ])
  );
  const accumulators = OPPONENT_POSITIONS.reduce((byPlayer, position) => {
    byPlayer[position] = {
      pairWeight: 0,
      tripleWeight: 0,
      straightWeight: 0,
      evidence: [] as string[],
      pairPlays: 0,
      triplePlays: 0,
      straightPlays: 0,
      playedCards: 0
    };
    return byPlayer;
  }, {} as Record<PlayerPosition, {
    pairWeight: number;
    tripleWeight: number;
    straightWeight: number;
    evidence: string[];
    pairPlays: number;
    triplePlays: number;
    straightPlays: number;
    playedCards: number;
  }>);

  history.forEach(record => {
    const profile = OPPONENT_POSITIONS.includes(record.playerPosition)
      ? accumulators[record.playerPosition]
      : null;
    if (profile) {
      const remainingBeforePlay = Math.max(
        0,
        27 - profile.playedCards
      );
      const endgameInformationWeight = Math.min(
        1,
        STRUCTURE_INFERENCE_CONFIG.fullInformationRemainingCards /
          Math.max(
            STRUCTURE_INFERENCE_CONFIG.fullInformationRemainingCards,
            remainingBeforePlay
          )
      );
      const equivalentChoiceCount = Math.max(
        1,
        choiceCountByAction.get(record.id) ?? 1
      );
      const choiceSpaceWeight = Math.pow(
        1 / equivalentChoiceCount,
        STRUCTURE_INFERENCE_CONFIG.choiceSpaceExponent
      );
      const informationWeight =
        endgameInformationWeight * choiceSpaceWeight;
      if (record.type === 'pair') {
        profile.pairPlays += 1;
        profile.pairWeight += informationWeight;
      }
      if (record.type === 'triple' || record.type === 'triple_with_pair') {
        profile.triplePlays += 1;
        profile.tripleWeight += informationWeight;
      }
      if (record.type === 'triple_straight' || record.type === 'plane') {
        profile.triplePlays += 1;
        profile.tripleWeight += informationWeight;
      }
      if (record.type === 'straight') {
        profile.straightPlays += 1;
        profile.straightWeight += informationWeight;
      }
      if (record.type === 'pair_straight') {
        profile.pairPlays += 1;
        profile.straightPlays += 1;
        profile.pairWeight += informationWeight;
        profile.straightWeight += informationWeight;
      }
      profile.playedCards += record.cards.length;
    }
  });

  return OPPONENT_POSITIONS.map(position => {
    const profile = accumulators[position];
    const playerName = PLAYER_DISPLAY_NAMES[position];
    const totalRouteWeight =
      profile.pairWeight +
      profile.tripleWeight +
      profile.straightWeight;
    const tripleStraightWeight =
      profile.tripleWeight + profile.straightWeight;
    const pairTendency =
      (STRUCTURE_INFERENCE_CONFIG.routePriorWeight + profile.pairWeight) /
      (STRUCTURE_INFERENCE_CONFIG.routePriorTotalWeight + totalRouteWeight);
    const tripleTendency =
      (STRUCTURE_INFERENCE_CONFIG.routePriorWeight + profile.tripleWeight) /
      (
        STRUCTURE_INFERENCE_CONFIG.routePriorTotalWeight +
        tripleStraightWeight
      );
    const straightTendency =
      (STRUCTURE_INFERENCE_CONFIG.routePriorWeight + profile.straightWeight) /
      (
        STRUCTURE_INFERENCE_CONFIG.routePriorTotalWeight +
        tripleStraightWeight
      );
    const playerChoiceEvidence = choiceEvidence.filter(
      observation => observation.playerPosition === position
    );
    const pairFlexibility = calculatePairResponseFlexibility(
      choiceEvidence,
      position
    );

    if (tripleStraightWeight > 0) {
      profile.evidence.push(
        `${playerName}按残局权重累计：三张${profile.tripleWeight.toFixed(2)}、顺子${profile.straightWeight.toFixed(2)}；后验为${formatPercent(tripleTendency)}/${formatPercent(straightTendency)}`
      );
    }
    playerChoiceEvidence.slice(-2).forEach(observation => {
      profile.evidence.push(observation.summary);
    });

    const evidenceCount =
      profile.pairPlays + profile.triplePlays + profile.straightPlays;
    return {
      playerPosition: position,
      pairTendency: clamp(pairTendency),
      pairFlexibility: clamp(pairFlexibility),
      tripleTendency: clamp(tripleTendency),
      straightTendency: clamp(straightTendency),
      confidence: clamp(
        totalRouteWeight /
          (
            STRUCTURE_INFERENCE_CONFIG.confidencePriorWeight +
            totalRouteWeight
          )
      ),
      evidenceCount,
      effectiveEvidenceWeight: totalRouteWeight,
      evidence: [...new Set(profile.evidence)].slice(-3).reverse()
    };
  });
};

const buildOwnershipClues = (
  gameState: GameState,
  cardDistribution: CardDistributionInference,
  playedRankCounts: Record<PlayerPosition, Record<GameRank, number>>
): RankOwnershipClue[] => {
  const activePositions = gameState.players.map(player => player.position);
  const candidatesByRank = new Map(
    cardDistribution.bombCandidates.map(candidate => [candidate.rank, candidate])
  );
  const playedCardIds = new Set(
    gameState.playHistory.flatMap(record => record.cards.map(card => card.id))
  );
  const knownRankCounts = PLAYER_POSITIONS.reduce((byPlayer, position) => {
    const player = gameState.players.find(candidate =>
      candidate.position === position
    );
    byPlayer[position] = STANDARD_RANKS.reduce((byRank, rank) => {
      byRank[rank] = player?.cards.filter(card =>
        card.rank === rank && !playedCardIds.has(card.id)
      ).length ?? 0;
      return byRank;
    }, {} as Record<GameRank, number>);
    return byPlayer;
  }, {} as Record<PlayerPosition, Record<GameRank, number>>);
  const bottomKnownCards = gameState.players.find(
    player => player.position === 'bottom'
  )?.cards ?? [];
  const bottomHandIsComplete = bottomKnownCards.length === getPlayerInitialCardCount(
    getGameMode(gameState),
    'bottom',
    gameState.config.landlordPosition
  );

  return STANDARD_RANKS.flatMap(rank => {
    const hasShownRank = (position: PlayerPosition): boolean =>
      playedRankCounts[position][rank] > 0 ||
      knownRankCounts[position][rank] > 0;
    const isExcludedByKnownAbsence = (position: PlayerPosition): boolean =>
      position === 'bottom' &&
      bottomHandIsComplete &&
      knownRankCounts.bottom[rank] === 0 &&
      playedRankCounts.bottom[rank] === 0;
    const possibleOwners = activePositions.filter(position =>
      !hasShownRank(position) && !isExcludedByKnownAbsence(position)
    );
    if (possibleOwners.length !== 1) return [];

    const suspectedOwner = possibleOwners[0];
    if (!suspectedOwner || suspectedOwner === 'bottom') return [];

    // 除疑似持有者外，其余对手都必须实际出过该点数；“我没有”只有在
    // 当前模式的完整手牌已录入时才作为排除证据。
    const opponentsWhoPlayed = activePositions.filter(position =>
      position !== 'bottom' && playedRankCounts[position][rank] > 0
    );
    if (opponentsWhoPlayed.length < activePositions.length - 2) return [];

    const candidate = candidatesByRank.get(rank);
    if (!candidate || candidate.remainingCopies === 0) return [];
    const knownElsewhere = activePositions
      .filter(position => position !== suspectedOwner)
      .reduce((total, position) => total + knownRankCounts[position][rank], 0);
    const inferredCount = Math.max(
      0,
      candidate.remainingCopies - knownElsewhere
    );
    if (inferredCount === 0) return [];
    const estimate = candidate.playerEstimates[suspectedOwner];
    const posteriorProbability = estimate.probabilityAtLeastOne;
    const confidence: RankOwnershipClue['confidence'] =
      posteriorProbability >= 0.8
        ? 'strong'
        : posteriorProbability >= 0.6
          ? 'likely'
          : 'clue';
    const rankName = RANK_DISPLAY_NAMES[rank];
    const ownerName = PLAYER_DISPLAY_NAMES[suspectedOwner];

    return [{
      rank,
      suspectedOwner,
      inferredCount,
      probability: posteriorProbability,
      confidence,
      evidenceCount: 3,
      summary: `三方已有${rankName}的确定信息或完整手牌排除证据，只有${ownerName}未被排除；扣除其他玩家已知未出牌后，将剩余${inferredCount}张${rankName}集中标红给${ownerName}。这是归属推理而非具体花色硬事实，${ownerName}持有至少1张的融合后验约${formatPercent(posteriorProbability)}。`
    }];
  }).sort((left, right) =>
    right.probability - left.probability ||
    right.rank - left.rank
  );
};

const buildStraightRoutes = (
  remainingRankCounts: Record<GameRank, number>
): StraightRouteInference => {
  const viableRoutes = NATURAL_STRAIGHT_ROUTES.filter(route =>
    route.every(rank => remainingRankCounts[rank] > 0)
  );
  const totalNaturalRoutes = NATURAL_STRAIGHT_ROUTES.length;
  const naturalRoutesRemaining = viableRoutes.length;
  const blockedRoutes = totalNaturalRoutes - naturalRoutesRemaining;
  const fivesRemaining = remainingRankCounts[Rank.FIVE];
  const tensRemaining = remainingRankCounts[Rank.TEN];
  const status: StraightRouteInference['status'] =
    naturalRoutesRemaining === 0
      ? 'blocked'
      : naturalRoutesRemaining < totalNaturalRoutes
        ? 'half_blocked'
        : 'open';
  const summary = naturalRoutesRemaining === 0
    ? '10条自然顺子路线已全部切断；红心级牌仍可能作为配牌补缺。'
    : blockedRoutes > 0
      ? `10条自然顺子路线已有${blockedRoutes}条被切断，仍有${naturalRoutesRemaining}条；不能仅因5或10单独出完就断定没有顺子。`
      : '10条自然顺子路线目前都未被硬性排除。';

  return {
    fivesRemaining,
    tensRemaining,
    naturalRoutesRemaining,
    totalNaturalRoutes,
    status,
    summary
  };
};

const buildLatestStepReminders = (
  gameState: GameState,
  remainingRankCounts: Record<GameRank, number>,
  ownershipClues: RankOwnershipClue[],
  playerStructures: PlayerStructureInference[],
  straightRoutes: StraightRouteInference,
  choiceEvidence: ChoiceEvidence[]
): ReasoningStepReminder[] => {
  const latestAction = gameState.playHistory.at(-1);
  if (!latestAction) return [];
  const playerName = PLAYER_DISPLAY_NAMES[latestAction.playerPosition];

  if (latestAction.type === 'pass') {
    return [{
      id: `${latestAction.id}-pass`,
      kind: 'probability',
      confidence: 0.45,
      summary: `${playerName}过牌：这是“可能缺少当前可压组合”的软证据；若其后续展示能管的牌，本结论会自动降级。`
    }];
  }

  const reminders: ReasoningStepReminder[] = [];
  const playedRanks = [...new Set(
    latestAction.cards
      .filter(card => card.rank >= 2 && card.rank <= 14)
      .map(card => card.rank as GameRank)
  )];
  if (playedRanks.length > 0) {
    reminders.push({
      id: `${latestAction.id}-remaining`,
      kind: 'fact',
      confidence: 1,
      summary: `${playerName}本次涉及${playedRanks.map(rank =>
        `${RANK_DISPLAY_NAMES[rank]}（全桌未出${remainingRankCounts[rank]}张）`
      ).join('、')}，剩余数量已重新分配到三家概率。`
    });
  }

  const latestChoiceEvidence = choiceEvidence.find(
    observation => observation.actionId === latestAction.id
  );
  if (latestChoiceEvidence) {
    reminders.push({
      id: `${latestAction.id}-restricted-choice`,
      kind: 'pattern',
      confidence:
        latestChoiceEvidence.likelihoodRatio /
        (1 + latestChoiceEvidence.likelihoodRatio),
      summary: latestChoiceEvidence.summary
    });
  }

  if (latestAction.type === 'straight' ||
      latestAction.type === 'triple' ||
      latestAction.type === 'triple_with_pair' ||
      latestAction.type === 'triple_straight' ||
      latestAction.type === 'plane') {
    const profile = playerStructures.find(
      candidate => candidate.playerPosition === latestAction.playerPosition
    );
    if (profile && profile.evidenceCount > 0) {
      const leadingTendency = [
        ['对子', profile.pairTendency],
        ['三张', profile.tripleTendency],
        ['顺子', profile.straightTendency]
      ].sort((left, right) => Number(right[1]) - Number(left[1]))[0];
      reminders.push({
        id: `${latestAction.id}-structure`,
        kind: 'pattern',
        confidence: profile.confidence,
        summary: `${playerName}按“5/当时剩牌数”累计后，当前牌路更偏${leadingTendency[0]}（后验${formatPercent(Number(leadingTendency[1]))}，有效证据权重${profile.effectiveEvidenceWeight.toFixed(2)}）。`
      });
    }
  }

  const relevantOwnershipClue = ownershipClues.find(clue =>
    playedRanks.includes(clue.rank)
  );
  if (relevantOwnershipClue) {
    reminders.push({
      id: `${latestAction.id}-ownership-${relevantOwnershipClue.rank}`,
      kind: relevantOwnershipClue.confidence === 'known'
        ? 'fact'
        : 'probability',
      confidence: relevantOwnershipClue.probability,
      summary: relevantOwnershipClue.summary
    });
  }

  if (playedRanks.includes(Rank.FIVE) || playedRanks.includes(Rank.TEN)) {
    reminders.push({
      id: `${latestAction.id}-straight-route`,
      kind: straightRoutes.status === 'blocked' ? 'correction' : 'pattern',
      confidence: straightRoutes.status === 'blocked' ? 0.95 : 0.75,
      summary: `顺子路线更新：${straightRoutes.summary}`
    });
  }

  return reminders.slice(0, 4);
};

const buildOpeningInsights = (
  gameState: GameState,
  cardDistribution: CardDistributionInference
): string[] => {
  const playedIds = new Set(
    gameState.playHistory.flatMap(record => record.cards.map(card => card.id))
  );
  const myKnownCards = gameState.players
    .find(player => player.position === 'bottom')
    ?.cards.filter(card => !playedIds.has(card.id)) ?? [];

  return cardDistribution.bombCandidates
    .filter(candidate => {
      const myCount = myKnownCards.filter(
        card => card.rank === candidate.rank
      ).length;
      return myCount <= 2 &&
        candidate.outsideMyHandCopies >= 6 &&
        candidate.anyOpponentBombProbability >= 0.08;
    })
    .slice(0, 3)
    .map(candidate => {
      const myCount = myKnownCards.filter(
        card => card.rank === candidate.rank
      ).length;
      const owner = candidate.mostLikelyPlayers.length === 1
        ? `，目前${PLAYER_DISPLAY_NAMES[candidate.mostLikelyPlayers[0]]}最可疑`
        : '';
      return `我当前只有${myCount}张${RANK_DISPLAY_NAMES[candidate.rank]}，场外${candidate.outsideMyHandCopies}张，任一对手形成${RANK_DISPLAY_NAMES[candidate.rank]}炸弹的随机分布基准约${formatPercent(candidate.anyOpponentBombProbability)}${owner}。`;
    });
};

/**
 * 将“看到什么、没看到什么、以什么结构出牌”累计成可修正的人工推理。
 * 硬数量与超几何概率分开，避免把经验规则伪装成确定结论。
 */
export function analyzeHumanReasoning(
  gameState: GameState,
  cardDistribution: CardDistributionInference
): HumanReasoningInference {
  const playedRankCounts = buildPlayedRankCounts(gameState.playHistory);
  const remainingRankCounts = buildRemainingRankCounts(gameState);
  const choiceEvidence = analyzeChoiceEvidence(gameState);
  const playerStructures = buildPlayerStructures(
    gameState.playHistory,
    choiceEvidence
  );
  const ownershipClues = buildOwnershipClues(
    gameState,
    cardDistribution,
    playedRankCounts
  );
  const straightRoutes = buildStraightRoutes(remainingRankCounts);

  return {
    openingInsights: buildOpeningInsights(gameState, cardDistribution),
    ownershipClues,
    playerStructures,
    choiceEvidence,
    straightRoutes,
    latestStepReminders: buildLatestStepReminders(
      gameState,
      remainingRankCounts,
      ownershipClues,
      playerStructures,
      straightRoutes,
      choiceEvidence
    )
  };
}
