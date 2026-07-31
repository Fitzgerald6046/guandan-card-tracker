import type {
  AIAnalysisResult,
  CardDistributionInference,
  Player,
  PlayerPosition
} from '../types/game';
import type { BeatSolution } from './beatSolver';
import {
  PLAYER_DISPLAY_NAMES,
  isSameTeam
} from './gameProgress';
import {
  THREAT_BOMB_CONFIG,
  THREAT_LEVEL_THRESHOLDS
} from './inferenceConstants';

type ThreatAssessment = AIAnalysisResult['threatLevels'][PlayerPosition];

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

const getRemainingUrgency = (remainingCount: number): number => {
  if (remainingCount <= 0) return 0;
  if (remainingCount <= 3) return 0.95;
  if (remainingCount <= 5) return 0.85;
  if (remainingCount <= 10) return 0.7;
  if (remainingCount <= 15) return 0.45;
  return 0.2;
};

const getThreatLevel = (
  score: number
): ThreatAssessment['level'] => {
  if (score >= THREAT_LEVEL_THRESHOLDS.critical) return 'critical';
  if (score >= THREAT_LEVEL_THRESHOLDS.high) return 'high';
  if (score >= THREAT_LEVEL_THRESHOLDS.medium) return 'medium';
  return 'low';
};

/**
 * 以“我”的队伍为观察视角：左右两家是对手，上方是队友。
 * 牌少表示局势紧迫；炸弹风险读取当前后验，而不是“曾出过炸弹”。
 */
export function buildThreatLevels(
  players: Player[],
  cardDistribution: CardDistributionInference
): AIAnalysisResult['threatLevels'] {
  return players.reduce((levels, player) => {
    const role: ThreatAssessment['role'] =
      player.position === 'bottom'
        ? 'self'
        : isSameTeam(player.position, 'bottom')
          ? 'teammate'
          : 'opponent';
    const remainingUrgency = getRemainingUrgency(player.remainingCount);
    const maximumBombProbability = cardDistribution.bombCandidates.reduce(
      (maximum, candidate) =>
        Math.max(
          maximum,
          candidate.playerEstimates[player.position].bombProbability
        ),
      0
    );
    const bombContribution =
      maximumBombProbability * THREAT_BOMB_CONFIG.posteriorWeight;
    const score = player.remainingCount <= 0
      ? 0
      : clamp(
        1 - (1 - remainingUrgency) * (1 - bombContribution)
      );
    const reasoning: string[] = [];

    if (player.remainingCount <= 0) {
      reasoning.push('已出完，不再参与本轮牌权');
    } else if (role === 'opponent') {
      reasoning.push(
        player.remainingCount <= 5
          ? `仅剩${player.remainingCount}张，应优先封堵`
          : `剩余${player.remainingCount}张`
      );
    } else if (role === 'teammate') {
      reasoning.push(
        player.remainingCount <= 5
          ? `队友仅剩${player.remainingCount}张，可优先送牌`
          : `队友剩余${player.remainingCount}张`
      );
    } else {
      reasoning.push(
        player.remainingCount <= 5
          ? `我仅剩${player.remainingCount}张，应优先保持牌权`
          : `我剩余${player.remainingCount}张`
      );
    }

    if (
      maximumBombProbability >=
      THREAT_BOMB_CONFIG.reasoningDisplayThreshold
    ) {
      reasoning.push(
        `当前炸弹后验峰值约${Math.round(maximumBombProbability * 100)}%`
      );
    }

    levels[player.position] = {
      level: getThreatLevel(score),
      score,
      role,
      reasoning
    };
    return levels;
  }, {} as AIAnalysisResult['threatLevels']);
}

export interface BeatDecisionInput {
  currentPlayerPosition: PlayerPosition;
  currentPlayerRemainingCount: number;
  leadPlayerPosition?: PlayerPosition;
  responseSolution: BeatSolution | null;
  hasCompleteCurrentHand: boolean;
  knownPlayableCount: number;
  leadThreat?: ThreatAssessment;
}

export interface BeatDecision {
  action: AIAnalysisResult['suggestions']['action'];
  summary: string;
  confidence: number;
  resourceWarning?: string;
  reasonCodes: string[];
}

/**
 * 合法解由 beatSolver 负责；这里仅根据队伍、对手紧迫度和资源成本
 * 决定“管、让、观察”，避免把策略判断污染到牌型求解器。
 */
export function decideBeatResponse(input: BeatDecisionInput): BeatDecision {
  const currentName = PLAYER_DISPLAY_NAMES[input.currentPlayerPosition];
  if (input.currentPlayerRemainingCount <= 0) {
    return {
      action: 'wait',
      summary: `${currentName}已出完，本轮无需操作。`,
      confidence: 1,
      reasonCodes: ['player_finished']
    };
  }

  if (!input.leadPlayerPosition) {
    return input.knownPlayableCount > 0
      ? {
        action: 'play',
        summary: `${currentName}当前领牌，优先出完整组合或小牌试探。`,
        confidence: 0.58,
        reasonCodes: ['lead_turn']
      }
      : {
        action: 'wait',
        summary: `${currentName}当前领牌，但已知手牌不足，先观察牌面。`,
        confidence: 0.35,
        reasonCodes: ['lead_turn', 'incomplete_hand']
      };
  }

  const leadName = PLAYER_DISPLAY_NAMES[input.leadPlayerPosition];
  if (isSameTeam(
    input.currentPlayerPosition,
    input.leadPlayerPosition
  )) {
    return {
      action: 'pass',
      summary: `建议让牌：${leadName}掌握牌权，不抢队友牌。`,
      confidence: 0.96,
      reasonCodes: ['teammate_controls']
    };
  }

  if (!input.responseSolution) {
    return input.hasCompleteCurrentHand
      ? {
        action: 'pass',
        summary: `建议过牌：完整手牌中没有合法方案能管${leadName}。`,
        confidence: 1,
        reasonCodes: ['no_legal_beat', 'complete_hand']
      }
      : {
        action: 'wait',
        summary: `暂不能判断：已知牌中没有管牌方案，手牌信息不完整。`,
        confidence: 0.42,
        reasonCodes: ['no_known_beat', 'incomplete_hand']
      };
  }

  const costly =
    input.responseSolution.usesPowerPlay ||
    input.responseSolution.breaksKnownBomb;
  const urgentOpponent =
    input.leadThreat?.level === 'critical' ||
    input.leadThreat?.level === 'high';
  const resourceWarning = input.responseSolution.breaksKnownBomb
    ? '该方案会拆开已知炸弹。'
    : input.responseSolution.usesPowerPlay
      ? '该方案需要动用炸弹或同花顺。'
      : undefined;

  if (costly && !urgentOpponent) {
    return {
      action: 'pass',
      summary:
        `建议让牌：只能用${input.responseSolution.display}管上，` +
        `${leadName}当前威胁未到必须消耗强牌的程度。`,
      confidence: 0.72,
      resourceWarning,
      reasonCodes: ['costly_beat', 'opponent_not_urgent']
    };
  }

  if (costly && urgentOpponent) {
    return {
      action: 'play',
      summary:
        `建议堵牌：${leadName}威胁较高，可用` +
        `${input.responseSolution.display}管上。`,
      confidence: input.leadThreat?.level === 'critical' ? 0.88 : 0.8,
      resourceWarning,
      reasonCodes: ['costly_beat', 'opponent_urgent']
    };
  }

  return {
    action: 'play',
    summary: `建议管牌：出${input.responseSolution.display}，这是最低成本合法方案。`,
    confidence: 0.94,
    reasonCodes: ['lowest_cost_beat']
  };
}
