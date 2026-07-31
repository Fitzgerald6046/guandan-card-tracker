import React from 'react';
import type { AIAnalysisResult } from '../types/game';

interface DecisionBannerProps {
  analysisResult: AIAnalysisResult | null;
}

const ACTION_VIEW = {
  play: {
    label: '管',
    icon: '✓',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    badgeClassName: 'bg-emerald-600 text-white'
  },
  pass: {
    label: '让',
    icon: '→',
    className: 'border-amber-300 bg-amber-50 text-amber-950',
    badgeClassName: 'bg-amber-500 text-white'
  },
  wait: {
    label: '看',
    icon: '·',
    className: 'border-slate-300 bg-slate-50 text-slate-800',
    badgeClassName: 'bg-slate-500 text-white'
  }
} as const;

/** 手机牌面只投影已经计算好的结论，不在组件内重新运行推理。 */
export const DecisionBanner: React.FC<DecisionBannerProps> = ({
  analysisResult
}) => {
  if (!analysisResult) return null;

  const action = ACTION_VIEW[analysisResult.suggestions.action];
  const routes = analysisResult.humanReasoning.straightRoutes;
  const title = [
    analysisResult.suggestions.summary,
    analysisResult.suggestions.resourceWarning,
    `决策置信度${Math.round(analysisResult.suggestions.confidence * 100)}%`,
    routes.summary
  ].filter(Boolean).join(' ');

  return (
    <div
      data-testid="decision-banner"
      className={`flex min-h-9 items-center gap-2 overflow-hidden rounded-lg border px-2 py-1.5 shadow-sm ${action.className}`}
      title={title}
      aria-label={title}
    >
      <span
        className={`flex h-6 w-8 shrink-0 items-center justify-center rounded-md text-xs font-black ${action.badgeClassName}`}
      >
        {action.icon}{action.label}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-bold">
        {analysisResult.suggestions.summary}
      </span>
      <span className="shrink-0 rounded bg-white/75 px-1.5 py-0.5 text-[10px] font-black">
        顺路{routes.naturalRoutesRemaining}/{routes.totalNaturalRoutes}
      </span>
    </div>
  );
};

export default DecisionBanner;

