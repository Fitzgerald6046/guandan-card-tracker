/**
 * 推理常量集中登记。
 *
 * 这些数值属于可校准的启发式参数，不代表已经从大样本牌局拟合得到。
 * 修改后必须运行 `npm run test:inference`，并在留出牌局上比较 Brier、
 * LogLoss 与 ECE，不能只观察提示语是否“像人”。
 */
export const PASS_INFERENCE_CONFIDENCE = {
  cooperative: 0.15,
  contradictedBase: 0.12,
  contradictedStep: 0.04,
  contradictedCap: 0.3,
  activeBase: 0.45,
  repeatedStep: 0.12,
  repeatedStepCap: 3,
  endgameRemainingThreshold: 10,
  endgameBonus: 0.1,
  powerTypeDiscount: 0.08,
  activeCap: 0.85,
  displayLikelyThreshold: 0.55
} as const;

/**
 * 过牌对点数分布只作保守的负似然修正。
 *
 * 一次过牌可能对应多个可压点数，这些候选高度相关。为了避免把一次动作
 * 重复乘权，整组候选共享一个总惩罚，再按候选数量均分到对数似然空间。
 */
export const PASS_EVIDENCE_CONFIG = {
  enabled: true,
  minimumConfidence: 0.55,
  likelihoodAtMinimumConfidence: 0.9,
  likelihoodAtMaximumConfidence: 0.78
} as const;

export const STRUCTURE_INFERENCE_CONFIG = {
  fullInformationRemainingCards: 5,
  choiceSpaceExponent: 0.5,
  routePriorWeight: 1,
  routePriorTotalWeight: 2,
  confidencePriorWeight: 2
} as const;

/**
 * 整体模型置信度只反映已知信息覆盖和分布收敛程度。
 * 过牌置信度在校准完成前不再直接抬高整体置信度。
 */
export const MODEL_CONFIDENCE_CONFIG = {
  base: 0.35,
  informationCoverageWeight: 0.35,
  distributionCertaintyWeight: 0.3,
  cap: 0.95
} as const;

export const THREAT_LEVEL_THRESHOLDS = {
  critical: 0.8,
  high: 0.6,
  medium: 0.35
} as const;

/**
 * 威胁分数中的炸弹后验参数。
 *
 * 使用连续贡献避免 49%/50% 的硬跳变；数值仍需用更多完整牌局校准。
 */
export const THREAT_BOMB_CONFIG = {
  posteriorWeight: 0.22,
  reasoningDisplayThreshold: 0.2
} as const;
