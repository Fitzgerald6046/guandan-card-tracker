import type {
  GameRank,
  PlayRecord,
  PlayerPassInference,
  PlayerPosition,
  PlayType
} from '../types/game';
import { RANK_DISPLAY_NAMES } from '../types/game';
import {
  canBeatCardType,
  validateCardType
} from './guandanRules';
import type { CardType } from './guandanRules';
import { normalizePlayType } from './playTypeMapping';
import { isSameTeam } from './gameProgress';
import { PASS_INFERENCE_CONFIDENCE } from './inferenceConstants';

interface PassObservation {
  passIndex: number;
  passRecord: PlayRecord;
  leadRecord: PlayRecord;
  leadRuleType: CardType;
  leadType: PlayType;
  contradicted: boolean;
}

const POSITION_NAMES: Record<PlayerPosition, string> = {
  bottom: '我',
  left: '下家',
  top: '对家',
  right: '上家'
};

const TYPE_NAMES: Record<PlayType, string> = {
  single: '单张',
  pair: '对子',
  triple: '三张',
  triple_with_pair: '三带二',
  straight: '顺子',
  pair_straight: '连对',
  triple_straight: '钢板',
  plane: '飞机',
  bomb_four: '四炸',
  bomb_five: '五炸',
  bomb_six: '六炸',
  bomb_seven: '七炸',
  bomb_eight: '八炸',
  straight_flush: '同花顺',
  four_kings: '四王炸',
  pass: '过牌'
};

const isPowerType = (type: CardType['type']): boolean =>
  type === 'bomb' || type === 'flush_straight' || type === 'four_kings';

const getLeadDisplay = (record: PlayRecord): string =>
  record.cards.map(card => RANK_DISPLAY_NAMES[card.rank]).join(' ');

const STANDARD_RANKS: GameRank[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14
];

const getRankStrength = (rank: GameRank, currentRank: GameRank): number =>
  rank === currentRank ? 100 : rank;

/**
 * 首版只把单张、对子、三张映射为点数证据。顺子、三带二和炸弹涉及
 * 多点数组合与保留策略，继续只作为文字线索，避免伪装成独立点数事实。
 */
const getCandidateRankCounts = (
  observation: PassObservation,
  currentRank: GameRank
): PlayerPassInference['candidateRankCounts'] => {
  const atLeastCount =
    observation.leadRuleType.type === 'single'
      ? 1
      : observation.leadRuleType.type === 'pair'
        ? 2
        : observation.leadRuleType.type === 'triple'
          ? 3
          : null;
  const mainRank = observation.leadRuleType.mainRank;
  if (
    atLeastCount === null ||
    typeof mainRank !== 'number' ||
    mainRank < 2 ||
    mainRank > 14
  ) {
    return [];
  }

  const leadStrength = getRankStrength(mainRank as GameRank, currentRank);
  return STANDARD_RANKS
    .filter(rank => getRankStrength(rank, currentRank) > leadStrength)
    .map(rank => ({ rank, atLeastCount }));
};

/** 从历史动作重建每次过牌时仍然有效的待压牌面。 */
const collectPassObservations = (
  history: PlayRecord[],
  currentRank: GameRank
): PassObservation[] => {
  const observations: PassObservation[] = [];
  let activeLead: PlayRecord | null = null;
  let consecutivePasses = 0;

  history.forEach((record, index) => {
    if (record.type !== 'pass' && record.cards.length > 0) {
      activeLead = record;
      consecutivePasses = 0;
      return;
    }

    if (record.type !== 'pass' || !activeLead) return;
    const leadRuleType = validateCardType(activeLead.cards, currentRank);
    if (leadRuleType.isValid) {
      observations.push({
        passIndex: index,
        passRecord: record,
        leadRecord: activeLead,
        leadRuleType,
        leadType: normalizePlayType(
          leadRuleType.type,
          leadRuleType.cardCount ?? activeLead.cards.length
        ),
        contradicted: false
      });
    }

    consecutivePasses += 1;
    if (consecutivePasses >= 3) {
      activeLead = null;
      consecutivePasses = 0;
    }
  });

  // 后续若该玩家展示过一手本可压住旧牌面的牌，则旧“缺牌”推断被反证。
  observations.forEach(observation => {
    observation.contradicted = history
      .slice(observation.passIndex + 1)
      .some(record => {
        if (record.playerPosition !== observation.passRecord.playerPosition ||
            record.type === 'pass' ||
            record.cards.length === 0) {
          return false;
        }
        const laterType = validateCardType(record.cards, currentRank);
        return laterType.isValid &&
          canBeatCardType(laterType, observation.leadRuleType, currentRank);
      });
  });

  return observations;
};

const chooseStrongerObservation = (
  observations: PassObservation[],
  currentRank: GameRank
): PassObservation => observations.reduce((stronger, candidate) => {
  if (canBeatCardType(
    candidate.leadRuleType,
    stronger.leadRuleType,
    currentRank
  )) {
    return candidate;
  }
  return stronger;
});

/**
 * 将过牌转成软约束。约束不会宣称“确定没有”，且会被后续矛盾出牌降级。
 */
export function analyzePassInferences(
  history: PlayRecord[],
  currentRank: GameRank,
  remainingCounts: Partial<Record<PlayerPosition, number>> = {}
): PlayerPassInference[] {
  const observations = collectPassObservations(history, currentRank);
  const grouped = new Map<string, PassObservation[]>();

  observations.forEach(observation => {
    const relation = isSameTeam(
      observation.passRecord.playerPosition,
      observation.leadRecord.playerPosition
    ) ? 'teammate' : 'opponent';
    const key = `${observation.passRecord.playerPosition}:${observation.leadType}:${relation}`;
    const group = grouped.get(key) ?? [];
    group.push(observation);
    grouped.set(key, group);
  });

  const results: PlayerPassInference[] = [];
  grouped.forEach(group => {
    const latest = group[group.length - 1];
    const cooperative = isSameTeam(
      latest.passRecord.playerPosition,
      latest.leadRecord.playerPosition
    );
    const activeEvidence = group.filter(observation => !observation.contradicted);
    const reference = chooseStrongerObservation(
      activeEvidence.length > 0 ? activeEvidence : group,
      currentRank
    );
    const playerName = POSITION_NAMES[latest.passRecord.playerPosition];
    const leadName = POSITION_NAMES[reference.leadRecord.playerPosition];
    const leadDisplay = getLeadDisplay(reference.leadRecord);
    const typeName = TYPE_NAMES[reference.leadType];
    const evidenceCount = group.length;
    const latestTimestamp = latest.passRecord.timestamp;

    if (cooperative) {
      results.push({
        id: `pass-${latest.passRecord.id}`,
        playerPosition: latest.passRecord.playerPosition,
        leadPlayerPosition: reference.leadRecord.playerPosition,
        leadType: reference.leadType,
        leadDisplay,
        leadMainRank:
          reference.leadRuleType.mainRank &&
          reference.leadRuleType.mainRank >= 2 &&
          reference.leadRuleType.mainRank <= 14
            ? reference.leadRuleType.mainRank as GameRank
            : undefined,
        candidateRankCounts: [],
        evidenceCount,
        confidence: PASS_INFERENCE_CONFIDENCE.cooperative,
        status: 'cooperative',
        summary: `${playerName}面对${leadName}牌权选择过牌，属于正常配合，不据此判断缺少${typeName}。`,
        lastTimestamp: latestTimestamp
      });
      return;
    }

    if (activeEvidence.length === 0) {
      results.push({
        id: `pass-${latest.passRecord.id}`,
        playerPosition: latest.passRecord.playerPosition,
        leadPlayerPosition: reference.leadRecord.playerPosition,
        leadType: reference.leadType,
        leadDisplay,
        leadMainRank:
          reference.leadRuleType.mainRank &&
          reference.leadRuleType.mainRank >= 2 &&
          reference.leadRuleType.mainRank <= 14
            ? reference.leadRuleType.mainRank as GameRank
            : undefined,
        candidateRankCounts: [],
        evidenceCount,
        confidence: Math.min(
          PASS_INFERENCE_CONFIDENCE.contradictedCap,
          PASS_INFERENCE_CONFIDENCE.contradictedBase +
            evidenceCount * PASS_INFERENCE_CONFIDENCE.contradictedStep
        ),
        status: 'contradicted',
        summary: `${playerName}后续展示过能管旧牌面的牌，之前在${typeName}上过牌更像策略选择，缺牌推断已降级。`,
        lastTimestamp: latestTimestamp
      });
      return;
    }

    const remainingCount = remainingCounts[latest.passRecord.playerPosition];
    const endgameBonus =
      typeof remainingCount === 'number' &&
      remainingCount <= PASS_INFERENCE_CONFIDENCE.endgameRemainingThreshold
      ? PASS_INFERENCE_CONFIDENCE.endgameBonus
      : 0;
    const powerTypeDiscount = isPowerType(reference.leadRuleType.type)
      ? PASS_INFERENCE_CONFIDENCE.powerTypeDiscount
      : 0;
    const confidence = Math.min(
      PASS_INFERENCE_CONFIDENCE.activeCap,
      PASS_INFERENCE_CONFIDENCE.activeBase +
        Math.min(
          activeEvidence.length - 1,
          PASS_INFERENCE_CONFIDENCE.repeatedStepCap
        ) * PASS_INFERENCE_CONFIDENCE.repeatedStep +
        endgameBonus - powerTypeDiscount
    );
    const likelihood =
      confidence >= PASS_INFERENCE_CONFIDENCE.displayLikelyThreshold
        ? '较可能'
        : '可能';
    const caveat = isPowerType(reference.leadRuleType.type)
      ? '强牌也可能被战略保留。'
      : '炸弹和同花顺等强牌仍不能排除。';

    results.push({
      id: `pass-${latest.passRecord.id}`,
      playerPosition: latest.passRecord.playerPosition,
      leadPlayerPosition: reference.leadRecord.playerPosition,
      leadType: reference.leadType,
      leadDisplay,
      leadMainRank:
        reference.leadRuleType.mainRank &&
        reference.leadRuleType.mainRank >= 2 &&
        reference.leadRuleType.mainRank <= 14
          ? reference.leadRuleType.mainRank as GameRank
          : undefined,
      candidateRankCounts: getCandidateRankCounts(reference, currentRank),
      evidenceCount,
      confidence,
      status: 'active',
      summary: `${playerName}在对手的${leadDisplay}（${typeName}）上已过牌${activeEvidence.length}次，${likelihood}缺少能直接管上的组合；${caveat}`,
      lastTimestamp: latestTimestamp
    });
  });

  const statusPriority: Record<PlayerPassInference['status'], number> = {
    active: 0,
    contradicted: 1,
    cooperative: 2
  };
  return results.sort((left, right) =>
    statusPriority[left.status] - statusPriority[right.status] ||
    right.confidence - left.confidence ||
    right.lastTimestamp - left.lastTimestamp
  );
}
