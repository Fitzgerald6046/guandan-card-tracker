import React from 'react';
import type { PlayerInferenceChip } from '../types/game';

interface PlayerInferenceStripProps {
  chips: PlayerInferenceChip[];
}

const chipClassName = (confidence: number): string => {
  if (confidence >= 0.8) return 'border-red-700 bg-red-600 text-white shadow-sm';
  if (confidence >= 0.68) return 'border-red-400 bg-red-50 text-red-800';
  return 'border-rose-300 bg-white text-rose-700';
};

export const PlayerInferenceStrip: React.FC<PlayerInferenceStripProps> = ({
  chips
}) => (
  <div
    data-testid="player-inference-strip"
    className="mt-1 flex min-h-5 flex-wrap items-center justify-center gap-0.5"
    aria-label={chips.length > 0
      ? `推断：${chips.map(chip => chip.label).join('，')}`
      : '暂无高可信推断'}
  >
    {chips.map(chip => (
      <span
        key={chip.id}
        className={`max-w-full truncate rounded border px-1.5 py-1 text-[11px] font-black leading-none ${chipClassName(chip.confidence)}`}
        title={`${chip.label}（软推断，可能随出牌改变）`}
      >
        {chip.label}
      </span>
    ))}
  </div>
);

export default PlayerInferenceStrip;
