import type {
  AIAnalysisResult,
  GameRank,
  InferenceChange,
  InferenceEvolution,
  PlayRecord,
  PlayerPosition,
  PlayerRankProbability
} from '../types/game';
import { RANK_DISPLAY_NAMES } from '../types/game';

const PLAYER_NAMES: Record<PlayerPosition, string> = {
  bottom: '我',
  left: '下家',
  top: '对家',
  right: '上家'
};

const METRICS: Array<{
  category: 'pair' | 'triple' | 'bomb';
  label: string;
  getProbability: (estimate: PlayerRankProbability) => number;
}> = [
  {
    category: 'pair',
    label: '对子',
    getProbability: estimate => estimate.pairProbability
  },
  {
    category: 'triple',
    label: '三张',
    getProbability: estimate => estimate.tripleProbability
  },
  {
    category: 'bomb',
    label: '炸弹',
    getProbability: estimate => estimate.bombProbability
  }
];

const OPPONENTS: PlayerPosition[] = ['left', 'top', 'right'];
const MIN_VISIBLE_DELTA = 0.05;

const formatPercent = (probability: number): string =>
  `${Math.round(probability * 100)}%`;

const getActionSummary = (record: PlayRecord): string => {
  if (record.type === 'pass') {
    return `${PLAYER_NAMES[record.playerPosition]}过牌`;
  }
  const cards = record.cards
    .map(card => RANK_DISPLAY_NAMES[card.rank])
    .join('');
  return `${PLAYER_NAMES[record.playerPosition]}出${cards}`;
};

const getDirection = (
  previousProbability: number,
  currentProbability: number
): InferenceChange['direction'] => {
  if (currentProbability >= 0.995 && previousProbability < 0.995) {
    return 'confirmed';
  }
  if (currentProbability <= 0.005 && previousProbability > 0.005) {
    return 'eliminated';
  }
  return currentProbability > previousProbability ? 'increased' : 'decreased';
};

const buildRankChanges = (
  previous: AIAnalysisResult,
  current: AIAnalysisResult
): InferenceChange[] => {
  const previousByRank = new Map(
    previous.cardDistribution.bombCandidates.map(candidate => [
      candidate.rank,
      candidate
    ])
  );

  return current.cardDistribution.bombCandidates.flatMap(candidate => {
    const previousCandidate = previousByRank.get(candidate.rank);
    if (!previousCandidate) return [];

    return OPPONENTS.flatMap(position => METRICS.flatMap(metric => {
      const previousProbability = metric.getProbability(
        previousCandidate.playerEstimates[position]
      );
      const currentProbability = metric.getProbability(
        candidate.playerEstimates[position]
      );
      const delta = currentProbability - previousProbability;
      const direction = getDirection(previousProbability, currentProbability);
      const isDecisive = direction === 'confirmed' || direction === 'eliminated';
      if (!isDecisive && Math.abs(delta) < MIN_VISIBLE_DELTA) return [];

      const rankName = RANK_DISPLAY_NAMES[candidate.rank as GameRank];
      const directionText = direction === 'confirmed'
        ? '已确定'
        : direction === 'eliminated'
          ? '已排除'
          : `${formatPercent(previousProbability)}→${formatPercent(currentProbability)}`;

      return [{
        id: `${position}-${candidate.rank}-${metric.category}`,
        category: metric.category,
        playerPosition: position,
        rank: candidate.rank,
        direction,
        previousProbability,
        currentProbability,
        delta,
        summary: `${PLAYER_NAMES[position]}持有${rankName}${metric.label}：${directionText}`
      }];
    }));
  });
};

const buildPassChange = (
  previous: AIAnalysisResult,
  current: AIAnalysisResult,
  action: PlayRecord
): InferenceChange[] => {
  if (action.type !== 'pass') return [];
  const inference = current.passInferences.find(candidate =>
    candidate.playerPosition === action.playerPosition &&
    candidate.lastTimestamp === action.timestamp
  );
  if (!inference || inference.status === 'cooperative') return [];

  const previousInference = previous.passInferences.find(candidate =>
    candidate.playerPosition === inference.playerPosition &&
    candidate.leadType === inference.leadType &&
    candidate.status !== 'cooperative'
  );
  const previousProbability = previousInference?.confidence ?? 0;
  const direction: InferenceChange['direction'] =
    inference.status === 'contradicted'
      ? 'revised'
      : previousInference
        ? inference.confidence >= previousProbability
          ? 'increased'
          : 'decreased'
        : 'added';

  return [{
    id: `${action.id}-pass`,
    category: 'pass_constraint',
    playerPosition: action.playerPosition,
    direction,
    previousProbability,
    currentProbability: inference.confidence,
    delta: inference.confidence - previousProbability,
    summary: inference.summary
  }];
};

const buildOwnershipChanges = (
  previous: AIAnalysisResult,
  current: AIAnalysisResult
): InferenceChange[] => {
  const previousByKey = new Map(
    previous.humanReasoning.ownershipClues.map(clue => [
      `${clue.rank}-${clue.suspectedOwner}`,
      clue
    ])
  );

  return current.humanReasoning.ownershipClues.flatMap(clue => {
    const previousClue = previousByKey.get(
      `${clue.rank}-${clue.suspectedOwner}`
    );
    const previousProbability = previousClue?.probability ?? 0;
    const delta = clue.probability - previousProbability;
    if (previousClue && Math.abs(delta) < MIN_VISIBLE_DELTA) return [];

    return [{
      id: `ownership-${clue.rank}-${clue.suspectedOwner}`,
      category: 'ownership',
      playerPosition: clue.suspectedOwner,
      rank: clue.rank,
      direction: clue.confidence === 'known'
        ? 'confirmed'
        : previousClue
          ? delta >= 0 ? 'increased' : 'decreased'
          : 'added',
      previousProbability,
      currentProbability: clue.probability,
      delta,
      summary: clue.summary
    }];
  });
};

const buildBehaviorChanges = (
  previous: AIAnalysisResult,
  current: AIAnalysisResult,
  action: PlayRecord
): InferenceChange[] => {
  if (action.type === 'pass' || action.playerPosition === 'bottom') return [];
  const previousProfile = previous.humanReasoning.playerStructures.find(
    profile => profile.playerPosition === action.playerPosition
  );
  const currentProfile = current.humanReasoning.playerStructures.find(
    profile => profile.playerPosition === action.playerPosition
  );
  if (!previousProfile || !currentProfile) return [];

  const metrics = [
    {
      label: '对子储备倾向',
      previous: previousProfile.pairTendency,
      current: currentProfile.pairTendency
    },
    {
      label: '三张路线倾向',
      previous: previousProfile.tripleTendency,
      current: currentProfile.tripleTendency
    },
    {
      label: '顺子路线倾向',
      previous: previousProfile.straightTendency,
      current: currentProfile.straightTendency
    }
  ];

  return metrics.flatMap(metric => {
    const delta = metric.current - metric.previous;
    if (Math.abs(delta) < MIN_VISIBLE_DELTA) return [];
    return [{
      id: `${action.id}-behavior-${metric.label}`,
      category: 'behavior',
      playerPosition: action.playerPosition,
      direction: delta > 0 ? 'increased' : 'decreased',
      previousProbability: metric.previous,
      currentProbability: metric.current,
      delta,
      summary: `${PLAYER_NAMES[action.playerPosition]}${metric.label}：${formatPercent(metric.previous)}→${formatPercent(metric.current)}（行为倾向，非硬概率）`
    }];
  });
};

const CHANGE_PRIORITY: Record<InferenceChange['direction'], number> = {
  confirmed: 0,
  eliminated: 1,
  revised: 2,
  added: 3,
  increased: 4,
  decreased: 4
};

/**
 * 比较相邻两次分析，输出结论级变化。
 * 单条推断允许上升、下降或被推翻，不用动作次数伪造单调置信度。
 */
export function compareInferenceEvolution(
  previous: AIAnalysisResult | null,
  current: AIAnalysisResult | null,
  latestAction: PlayRecord | undefined
): InferenceEvolution | null {
  if (!previous || !current || !latestAction) return null;

  const changes = [
    ...buildPassChange(previous, current, latestAction),
    ...buildOwnershipChanges(previous, current),
    ...buildBehaviorChanges(previous, current, latestAction),
    ...buildRankChanges(previous, current)
  ].sort((left, right) =>
    CHANGE_PRIORITY[left.direction] - CHANGE_PRIORITY[right.direction] ||
    Math.abs(right.delta) - Math.abs(left.delta)
  );

  return {
    actionId: latestAction.id,
    actionSummary: getActionSummary(latestAction),
    informationCoverageDelta:
      current.cardDistribution.informationCoverage -
      previous.cardDistribution.informationCoverage,
    certaintyDelta:
      current.cardDistribution.certainty -
      previous.cardDistribution.certainty,
    changes: changes.slice(0, 8),
    reasoningSteps: current.humanReasoning.latestStepReminders
  };
}
