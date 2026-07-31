import React from 'react';
import type {
  AIAnalysisResult,
  PlayerPosition
} from '../types/game';

interface PlayerThreatDotProps {
  assessment: AIAnalysisResult['threatLevels'][PlayerPosition] | undefined;
}

const OPPONENT_COLORS = {
  low: '#94a3b8',
  medium: '#eab308',
  high: '#f97316',
  critical: '#dc2626'
} as const;

export const PlayerThreatDot: React.FC<PlayerThreatDotProps> = ({
  assessment
}) => {
  if (!assessment) return null;

  const color = assessment.role === 'opponent'
    ? OPPONENT_COLORS[assessment.level]
    : assessment.role === 'teammate'
      ? '#2563eb'
      : '#16a34a';
  const roleName = assessment.role === 'opponent'
    ? '威胁'
    : assessment.role === 'teammate'
      ? '队友紧迫度'
      : '自身紧迫度';
  const title =
    `${roleName}${Math.round(assessment.score * 100)}%：` +
    assessment.reasoning.join('；');

  return (
    <span
      data-testid={`player-pressure-${assessment.role}`}
      className="h-2.5 w-2.5 rounded-full border border-white shadow ring-1 ring-black/10"
      style={{ backgroundColor: color }}
      title={title}
      aria-label={title}
    />
  );
};

export default PlayerThreatDot;

