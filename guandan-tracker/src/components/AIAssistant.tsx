/**
 * 增强版AI助手组件
 * 基于实战算牌技巧的智能推理系统
 */

import React, { useEffect, useRef, useState } from 'react';
import { compareInferenceEvolution } from '../utils/inferenceEvolution';
import type { 
  AIAnalysisResult,
  InferenceEvolution,
  PlayRecord,
  GameRank,
  GameState,
  PlayerPosition,
  RankPatternProbability
} from '../types/game';
import { RANK_DISPLAY_NAMES } from '../types/game';

const PLAYER_DISPLAY_NAMES: Record<PlayerPosition, string> = {
  bottom: '我',
  left: '下家',
  top: '对家',
  right: '上家'
};

const formatPatternRanks = (pattern: RankPatternProbability): string =>
  pattern.ranks.map(rank => RANK_DISPLAY_NAMES[rank]).join('');

const formatTiedPatterns = (
  patterns: RankPatternProbability[]
): string => {
  const strongest = patterns[0];
  if (!strongest) return '';
  const tiedPatterns = patterns.filter(pattern =>
    Math.abs(pattern.probability - strongest.probability) <= 0.005
  );
  const visiblePatterns = tiedPatterns
    .slice(0, 2)
    .map(formatPatternRanks)
    .join('/');
  return tiedPatterns.length > 2 ? `${visiblePatterns}等` : visiblePatterns;
};

// ==================== 类型定义 ====================

interface AIAssistantProps {
  /** 是否启用AI */
  enabled: boolean;
  /** 切换AI状态 */
  onToggle: (enabled: boolean) => void;
  /** 接受AI建议回调 */
  onAcceptSuggestion?: (suggestion: string) => void;
  /** 出牌历史记录 */
  playHistory?: PlayRecord[];
  /** 当前级数 */
  currentRank?: GameRank;
  /** 主游戏状态（AI唯一数据源） */
  gameState: GameState;
  /** 与主牌面共用的唯一分析结果 */
  analysisResult: AIAnalysisResult | null;
  /** 请求父级重新运行分析 */
  onRefresh: () => void;
}

// ==================== 子组件 ====================

/**
 * AI状态指示器
 */
const AIStatusIndicator: React.FC<{ 
  enabled: boolean; 
  hasData: boolean;
}> = ({ enabled, hasData }) => {
  if (!enabled) {
    return (
      <div className="flex items-center text-gray-500">
        <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
        <span className="text-xs">AI已关闭</span>
      </div>
    );
  }
  
  if (!hasData) {
    return (
      <div className="flex items-center text-yellow-600">
        <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse"></div>
        <span className="text-xs">等待数据</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center text-green-600">
      <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
      <span className="text-xs">AI运行中</span>
    </div>
  );
};


/**
 * 增强版智能推理分析组件
 */
const EnhancedSmartAnalysis: React.FC<{
  playHistory: PlayRecord[];
  currentRank: GameRank;
  analysisResult: AIAnalysisResult | null;
  inferenceEvolution: InferenceEvolution | null;
}> = ({ playHistory, currentRank, analysisResult, inferenceEvolution }) => {
  if (!analysisResult) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
        <div className="text-gray-400 mb-1">🤔</div>
        <p className="text-sm text-gray-600">等待出牌数据...</p>
        <p className="text-xs text-gray-500">开始记录出牌后将启动AI分析</p>
      </div>
    );
  }

  const visiblePassInferences = analysisResult.passInferences
    .filter(inference => inference.status !== 'cooperative')
    .slice(0, 3);

  return (
    <div className="space-y-4">
      {/* AI推理置信度 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-medium text-blue-800">AI推理分析</h4>
          <div className="text-xs text-blue-600">
            综合证据: {Math.round(analysisResult.confidence * 100)}%
          </div>
        </div>
        <div className="text-xs text-blue-600">
          {playHistory.length > 0
            ? `基于 ${playHistory.length} 次动作持续更新`
            : '已根据录入手牌建立开局概率'}
        </div>
        <div className="mt-1 text-[11px] leading-4 text-blue-600">
          {analysisResult.evidenceLedger.summary}
        </div>
      </div>

      {inferenceEvolution && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-sky-900">📈 本次推理变化</h4>
            <span className="text-xs font-medium text-sky-700">
              {inferenceEvolution.actionSummary}
            </span>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
            {inferenceEvolution.informationCoverageDelta > 0 && (
              <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-800">
                已知范围 +{Math.round(inferenceEvolution.informationCoverageDelta * 108)}张
              </span>
            )}
            {Math.abs(inferenceEvolution.certaintyDelta) >= 0.001 && (
              <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-800">
                牌形集中度
                {inferenceEvolution.certaintyDelta > 0 ? '+' : ''}
                {(inferenceEvolution.certaintyDelta * 100).toFixed(1)}个百分点
              </span>
            )}
          </div>
          {inferenceEvolution.reasoningSteps.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {inferenceEvolution.reasoningSteps.map(step => {
                const label = step.kind === 'fact'
                  ? '事实'
                  : step.kind === 'correction'
                    ? '校正'
                    : step.kind === 'pattern'
                      ? '牌路'
                      : '概率';
                return (
                  <div
                    key={step.id}
                    className="rounded-md border border-sky-100 bg-white px-2 py-1.5"
                  >
                    <div className="mb-0.5 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-sky-700">
                        {label}
                      </span>
                      <span className="text-[10px] text-sky-600">
                        {Math.round(step.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-xs leading-5 text-sky-950">
                      {step.summary}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          {inferenceEvolution.changes.length > 0 ? (
            <div className="space-y-1.5">
              {inferenceEvolution.changes.slice(0, 5).map(change => {
                const badge = change.direction === 'confirmed'
                  ? '确定'
                  : change.direction === 'eliminated'
                    ? '排除'
                    : change.direction === 'revised'
                      ? '修正'
                      : change.direction === 'added'
                        ? '新增'
                        : change.direction === 'increased'
                          ? '上升'
                          : '下降';
                const badgeStyle = change.direction === 'confirmed'
                  ? 'bg-red-100 text-red-700'
                  : change.direction === 'eliminated' || change.direction === 'decreased'
                    ? 'bg-emerald-100 text-emerald-700'
                    : change.direction === 'revised'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-sky-100 text-sky-700';

                return (
                  <div
                    key={change.id}
                    className="flex items-start gap-2 rounded-md bg-white/70 px-2 py-1.5"
                  >
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${badgeStyle}`}>
                      {badge}
                    </span>
                    <span className="text-xs leading-5 text-sky-900">
                      {change.summary}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs leading-5 text-sky-800">
              本次主要增加了已知牌范围，没有让某条牌形结论跨过明显变化阈值。
            </p>
          )}
        </div>
      )}

      {/* 手机端先展示当前决策，打开AI即可看到能否管牌。 */}
      {analysisResult.recommendations.immediate.length > 0 && (
        <div className={`rounded-lg border p-3 ${
          analysisResult.suggestions.action === 'play'
            ? 'border-emerald-300 bg-emerald-50'
            : analysisResult.suggestions.action === 'pass'
              ? 'border-amber-300 bg-amber-50'
              : 'border-slate-200 bg-slate-50'
        }`}>
          <h4 className="mb-2 text-sm font-bold text-slate-800">
            {analysisResult.suggestions.action === 'play'
              ? '✅ 建议管牌'
              : analysisResult.suggestions.action === 'pass'
                ? '⏭️ 建议过牌'
                : '🧠 当前判断'}
          </h4>
          <div className="space-y-1">
            {analysisResult.recommendations.immediate.map((recommendation: string, index: number) => (
              <div key={index} className="text-sm text-slate-700">
                • {recommendation}
              </div>
            ))}
          </div>
        </div>
      )}

      {analysisResult.cardDistribution.bombCandidates.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-orange-900">💣 动态炸弹概率</h4>
            <span className="text-xs text-orange-700">
              已知 {Math.round(analysisResult.cardDistribution.informationCoverage * 100)}%
            </span>
          </div>
          <div className="space-y-2">
            {analysisResult.cardDistribution.bombCandidates
              .slice(0, 3)
              .map(candidate => {
                const mostLikelyPlayer = candidate.mostLikelyPlayers.length === 1
                  ? candidate.mostLikelyPlayers[0]
                  : null;
                const mostLikelyEstimate = mostLikelyPlayer
                  ? candidate.playerEstimates[mostLikelyPlayer]
                  : null;
                const ownerText = mostLikelyPlayer && mostLikelyEstimate
                  ? `最可疑：${PLAYER_DISPLAY_NAMES[mostLikelyPlayer]} ${Math.round(mostLikelyEstimate.bombProbability * 100)}%`
                  : candidate.mostLikelyPlayers.length > 1
                    ? `${candidate.mostLikelyPlayers.map(position => PLAYER_DISPLAY_NAMES[position]).join('、')}接近`
                    : '暂无明显归属';
                const expectedOwnership = candidate.mostLikelyPlayers.length > 0
                  ? candidate.mostLikelyPlayers
                    .map(position => {
                      const estimate = candidate.playerEstimates[position];
                      return estimate.knownCount > 0
                        ? `${PLAYER_DISPLAY_NAMES[position]}已知${estimate.knownCount}张`
                        : `${PLAYER_DISPLAY_NAMES[position]}约${estimate.expectedCount.toFixed(1)}张`;
                    })
                    .join(' · ')
                  : '剩余牌不足以形成炸弹';

                return (
                  <div
                    key={candidate.rank}
                    className="rounded-md border border-orange-100 bg-white/70 px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-orange-950">
                        {RANK_DISPLAY_NAMES[candidate.rank]}
                        <span className="ml-1 text-xs font-normal text-orange-700">
                          场外{candidate.outsideMyHandCopies}张
                        </span>
                      </span>
                      <span className={`text-sm font-bold ${
                        candidate.anyOpponentBombProbability >= 0.999
                          ? 'text-red-700'
                          : 'text-orange-700'
                      }`}>
                        {candidate.anyOpponentBombProbability >= 0.999
                          ? '已确定'
                          : `${Math.round(candidate.anyOpponentBombProbability * 100)}%`}
                      </span>
                    </div>
                    <div className="mt-0.5 flex justify-between gap-2 text-xs text-orange-800">
                      <span>任一对手成炸</span>
                      <span className="text-right">{ownerText}</span>
                    </div>
                    <div className="mt-1 text-[11px] leading-4 text-orange-700">
                      持牌估计：{expectedOwnership}
                    </div>
                  </div>
                );
              })}
          </div>
          <p className="mt-2 text-[11px] leading-4 text-orange-700">
            按两副牌剩余数量计算；已融合
            {analysisResult.cardDistribution.appliedEvidenceCount}
            条选择似然，每次出牌、明牌或手牌变化都会重算。
          </p>
        </div>
      )}

      {analysisResult.humanReasoning.openingInsights.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <h4 className="mb-2 text-sm font-bold text-amber-900">
            🧠 手牌输入后的第一判断
          </h4>
          <div className="space-y-1.5">
            {analysisResult.humanReasoning.openingInsights.map((insight, index) => (
              <p
                key={`${index}-${insight}`}
                className="text-xs leading-5 text-amber-900"
              >
                • {insight}
              </p>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-4 text-amber-700">
            这是两副牌随机分布基准；后续每次出牌会继续上调、下调或排除。
          </p>
        </div>
      )}

      {analysisResult.cardDistribution.playerShapes.length > 0 && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-violet-900">🧩 各家牌形推断</h4>
            <span className="text-xs text-violet-700">
              分布集中度 {Math.round(analysisResult.cardDistribution.certainty * 100)}%
            </span>
          </div>
          <div className="space-y-2">
            {analysisResult.cardDistribution.playerShapes.map(shape => {
              const shapeRows = [
                {
                  label: '对子',
                  candidates: shape.pairCandidates,
                  threshold: 0.35
                },
                {
                  label: '三张',
                  candidates: shape.tripleCandidates,
                  threshold: 0.12
                },
                {
                  label: '五连',
                  candidates: shape.straightCandidates,
                  threshold: 0.08
                },
                {
                  label: '连对',
                  candidates: shape.pairStraightCandidates,
                  threshold: 0.03
                },
                {
                  label: '钢板',
                  candidates: shape.tripleStraightCandidates,
                  threshold: 0.01
                }
              ].filter(row =>
                row.candidates[0] &&
                row.candidates[0].probability >= row.threshold
              );

              return (
                <div
                  key={shape.playerPosition}
                  className="rounded-md border border-violet-100 bg-white/70 px-2.5 py-2"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-violet-950">
                      {PLAYER_DISPLAY_NAMES[shape.playerPosition]}
                    </span>
                    <span className="text-[11px] text-violet-600">
                      分布集中度 {Math.round(shape.certainty * 100)}%
                    </span>
                  </div>
                  {shapeRows.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {shapeRows.map(row => (
                        <span
                          key={row.label}
                          className="rounded-full bg-violet-100 px-2 py-1 text-[11px] text-violet-800"
                        >
                          {row.candidates[0].approximate ? '约' : ''}
                          {row.label}{formatTiedPatterns(row.candidates)}
                          {' '}
                          {Math.round(row.candidates[0].probability * 100)}%
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-violet-600">
                      当前没有明显集中的组合。
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-4 text-violet-700">
            对子、三张为精确边际概率；连续组合为近似概率，隐藏配牌可能补形。
          </p>
        </div>
      )}

      {analysisResult.humanReasoning.playerStructures.some(
        profile => profile.evidenceCount > 0
      ) && (
        <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-3">
          <h4 className="mb-2 text-sm font-bold text-fuchsia-900">
            🧭 各家累计牌路
          </h4>
          <div className="space-y-2">
            {analysisResult.humanReasoning.playerStructures
              .filter(profile => profile.evidenceCount > 0)
              .map(profile => (
                <div
                  key={profile.playerPosition}
                  className="rounded-md border border-fuchsia-100 bg-white/70 px-2.5 py-2"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-fuchsia-950">
                      {PLAYER_DISPLAY_NAMES[profile.playerPosition]}
                    </span>
                    <span className="text-[10px] text-fuchsia-700">
                      证据强度 {Math.round(profile.confidence * 100)}%
                    </span>
                  </div>
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    <span className="rounded bg-fuchsia-100 px-1.5 py-0.5 text-[10px] text-fuchsia-800">
                      对子路线 {Math.round(profile.pairTendency * 100)}%
                    </span>
                    <span className="rounded bg-fuchsia-100 px-1.5 py-0.5 text-[10px] text-fuchsia-800">
                      对子灵活 {Math.round(profile.pairFlexibility * 100)}%
                    </span>
                    <span className="rounded bg-fuchsia-100 px-1.5 py-0.5 text-[10px] text-fuchsia-800">
                      三张 {Math.round(profile.tripleTendency * 100)}%
                    </span>
                    <span className="rounded bg-fuchsia-100 px-1.5 py-0.5 text-[10px] text-fuchsia-800">
                      顺子 {Math.round(profile.straightTendency * 100)}%
                    </span>
                  </div>
                  {profile.evidence.map(evidence => (
                    <p
                      key={evidence}
                      className="text-[11px] leading-4 text-fuchsia-800"
                    >
                      • {evidence}
                    </p>
                  ))}
                </div>
              ))}
          </div>
          <p className="mt-2 text-[11px] leading-4 text-fuchsia-700">
            牌路采用加权Beta后验；对子灵活度采用限制选择赔率。越接近残局，同一动作权重越高。
          </p>
        </div>
      )}

      {analysisResult.humanReasoning.ownershipClues.length > 0 && (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-3">
          <h4 className="mb-2 text-sm font-bold text-lime-900">
            👁️ 未展示点数归属
          </h4>
          <div className="space-y-1.5">
            {analysisResult.humanReasoning.ownershipClues
              .slice(0, 3)
              .map(clue => (
                <div
                  key={`${clue.rank}-${clue.suspectedOwner}`}
                  className="rounded-md bg-white/70 px-2 py-1.5"
                >
                  <div className="mb-0.5 flex justify-between gap-2 text-[11px] font-bold text-lime-900">
                    <span>
                      {RANK_DISPLAY_NAMES[clue.rank]} → {PLAYER_DISPLAY_NAMES[clue.suspectedOwner]}
                    </span>
                    <span>{Math.round(clue.probability * 100)}%</span>
                  </div>
                  <p className="text-[11px] leading-4 text-lime-800">
                    {clue.summary}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {analysisResult.endgameInference.players.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
          <h4 className="mb-2 text-sm font-bold text-rose-900">
            🎯 残局精确枚举
          </h4>
          <div className="space-y-2">
            {analysisResult.endgameInference.players.map(inference => (
              <div
                key={inference.playerPosition}
                className="rounded-md border border-rose-100 bg-white/70 px-2.5 py-2"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-rose-950">
                    {PLAYER_DISPLAY_NAMES[inference.playerPosition]}剩
                    {inference.remainingCount}张
                  </span>
                  <span className="text-[10px] text-rose-700">
                    {inference.rankCompositionCount}种组合
                  </span>
                </div>
                {inference.lockedCards.length > 0 && (
                  <p className="mb-1 text-[11px] font-semibold text-rose-900">
                    已硬锁：
                    {inference.lockedCards.map(item =>
                      `${RANK_DISPLAY_NAMES[item.rank]}×${item.count}`
                    ).join('、')}
                  </p>
                )}
                <div className="space-y-1">
                  {inference.topCandidates.slice(0, 3).map((candidate, index) => (
                    <div
                      key={`${candidate.ranks.join('-')}-${index}`}
                      className="flex justify-between gap-2 text-[11px] text-rose-800"
                    >
                      <span>
                        {candidate.ranks.map(rank =>
                          RANK_DISPLAY_NAMES[rank]
                        ).join(' ')}
                      </span>
                      <span>{Math.round(candidate.probability * 100)}%</span>
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-[10px] leading-4 text-rose-700">
                  {inference.summary}
                  {inference.usesSoftEvidence ? ' 已按选择似然重排。' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {visiblePassInferences.length > 0 && (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
          <h4 className="mb-2 text-sm font-bold text-cyan-900">🕵️ 过牌反推</h4>
          <div className="space-y-2">
            {visiblePassInferences.map((inference, index) => (
              <div key={`${inference.playerPosition}-${inference.leadType}-${index}`}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={`font-semibold ${
                    inference.status === 'active' ? 'text-cyan-800' : 'text-slate-500'
                  }`}>
                    {inference.status === 'active'
                      ? inference.confidence >= 0.55
                        ? '有效约束'
                        : '初步线索'
                      : '已被后续出牌修正'}
                  </span>
                  <span className="text-slate-500">
                    {Math.round(inference.confidence * 100)}%
                  </span>
                </div>
                <p className={`mt-0.5 text-xs leading-5 ${
                  inference.status === 'active' ? 'text-cyan-800' : 'text-slate-500'
                }`}>
                  {inference.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 关键牌分析 */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <h4 className="text-sm font-medium text-purple-800 mb-2">关键牌态势</h4>
        <div className="space-y-1 text-sm text-purple-700">
          <div>
            🎯 级牌{currentRank}: 剩余{analysisResult.structureAnalysis.criticalCardAnalysis.rankCards.remaining}张 
            ({analysisResult.structureAnalysis.criticalCardAnalysis.rankCards.distribution})
          </div>
          <div>
            🔑 5和10: 剩余{analysisResult.structureAnalysis.criticalCardAnalysis.fives.remaining}+{analysisResult.structureAnalysis.criticalCardAnalysis.tens.remaining}张
          </div>
          <div className="text-xs leading-5">
            🛣️ 自然顺子路线：
            {analysisResult.humanReasoning.straightRoutes.naturalRoutesRemaining}/
            {analysisResult.humanReasoning.straightRoutes.totalNaturalRoutes}
          </div>
          <div className="text-xs leading-5 text-purple-600">
            {analysisResult.humanReasoning.straightRoutes.summary}
          </div>
        </div>
      </div>

      {/* 强否定推理 */}
      {analysisResult.warnings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-red-800 mb-2">🚫 风险警告</h4>
          <div className="space-y-2">
            {analysisResult.warnings.map((warning, index) => (
              <div key={index} className="text-sm text-red-700">
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 正向推理洞察 */}
      {analysisResult.strategicInsights.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-green-800 mb-2">💡 战略洞察</h4>
          <div className="space-y-1">
            {analysisResult.strategicInsights.map((insight: string, index: number) => (
              <div key={index} className="text-sm text-green-700">
                • {insight}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 当没有足够数据时的提示 */}
      {analysisResult.confidence < 0.4 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-gray-400 mb-1">🤔</div>
          <p className="text-sm text-gray-600">数据积累中...</p>
          <p className="text-xs text-gray-500">更多出牌和过牌记录将提升推理精度</p>
        </div>
      )}
    </div>
  );
};


// ==================== 主组件 ====================

export const AIAssistant: React.FC<AIAssistantProps> = ({
  enabled,
  onToggle,
  playHistory = [],
  currentRank = 7 as GameRank,
  gameState,
  analysisResult,
  onRefresh
}) => {
  const [isMinimized, setIsMinimized] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );
  const [inferenceEvolution, setInferenceEvolution] =
    useState<InferenceEvolution | null>(null);
  const hasInferenceData = playHistory.length > 0 ||
    gameState.players.some(player => player.cards.length > 0);
  const previousInferenceRef = useRef<{
    gameId: string;
    historyLength: number;
    latestActionId?: string;
    analysis: AIAnalysisResult;
  } | null>(null);

  // 即使手机端收起AI面板，也持续比较相邻动作，不丢失最近一次推理变化。
  useEffect(() => {
    if (!analysisResult) {
      previousInferenceRef.current = null;
      setInferenceEvolution(null);
      return;
    }

    const previousSnapshot = previousInferenceRef.current;
    const latestAction = playHistory[playHistory.length - 1];
    const isSameGame = previousSnapshot?.gameId === gameState.gameId;
    const isNewAction = Boolean(
      isSameGame &&
      latestAction &&
      playHistory.length > (previousSnapshot?.historyLength ?? 0) &&
      latestAction.id !== previousSnapshot?.latestActionId
    );

    if (isNewAction && previousSnapshot) {
      setInferenceEvolution(
        compareInferenceEvolution(
          previousSnapshot.analysis,
          analysisResult,
          latestAction
        )
      );
    } else if (!isSameGame ||
      playHistory.length < (previousSnapshot?.historyLength ?? 0)) {
      setInferenceEvolution(null);
    }

    previousInferenceRef.current = {
      gameId: gameState.gameId,
      historyLength: playHistory.length,
      latestActionId: latestAction?.id,
      analysis: analysisResult
    };
  }, [analysisResult, gameState.gameId, playHistory]);
  
  return (
    <div className={`fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] right-2 z-50 max-w-[calc(100vw-1rem)] rounded-lg border border-gray-200 bg-white shadow-xl sm:bottom-4 sm:right-4 sm:w-80 ${
      isMinimized ? 'w-auto' : 'w-[calc(100vw-1rem)]'
    }`}>
      {/* 标题栏 */}
      <div className={`flex items-center justify-between gap-3 ${isMinimized ? 'p-1.5' : 'border-b border-gray-200 p-3 sm:p-4'}`}>
        <div className="flex items-center space-x-2">
          <span className="text-lg">🤖</span>
          <span className="font-semibold text-gray-800">{isMinimized ? 'AI' : 'AI助手'}</span>
          {!isMinimized && (
            <AIStatusIndicator enabled={enabled} hasData={hasInferenceData} />
          )}
        </div>
        <div className="flex items-center space-x-1">
          {!isMinimized && (
            <>
              <button
                onClick={onRefresh}
                className="flex min-h-11 min-w-11 items-center justify-center p-1 text-gray-500 transition-colors hover:text-gray-700 sm:min-h-0 sm:min-w-0"
                title="刷新分析"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={() => onToggle(!enabled)}
                className={`flex min-h-11 min-w-11 items-center justify-center p-1 transition-colors sm:min-h-0 sm:min-w-0 ${enabled ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-gray-600'}`}
                title={enabled ? '关闭AI' : '启用AI'}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            </>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="flex min-h-11 min-w-11 items-center justify-center p-1 text-gray-500 transition-colors hover:text-gray-700 sm:min-h-0 sm:min-w-0"
            title={isMinimized ? '展开' : '最小化'}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMinimized ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
            </svg>
          </button>
        </div>
      </div>
      
      {/* 内容区域 */}
      {!isMinimized && (
        <div>
          {/* 内容面板 - 直接显示分析界面 */}
          <div className="p-4 max-h-96 overflow-y-auto">
            {!enabled ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">🤖</div>
                <p className="text-sm text-gray-500">AI助手已关闭</p>
                <button
                  onClick={() => onToggle(true)}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                >
                  启用AI
                </button>
              </div>
            ) : (
              <EnhancedSmartAnalysis 
                playHistory={playHistory}
                currentRank={currentRank}
                analysisResult={analysisResult}
                inferenceEvolution={inferenceEvolution}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
