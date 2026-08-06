import React from 'react';
import type {
  InferredCardOwnership,
  KnownCardOwnership,
  PlayerPosition
} from '../types/game';

interface KnownOwnerOverlayProps {
  ownership: KnownCardOwnership | undefined;
  inference?: InferredCardOwnership;
}

const OWNER_VIEW: Record<PlayerPosition, { label: string; color: string }> = {
  bottom: { label: '我', color: '#b45309' },
  left: { label: '下家', color: '#2563eb' },
  top: { label: '对家', color: '#7c3aed' },
  right: { label: '上家', color: '#16a34a' }
};

export const KnownOwnerOverlay: React.FC<KnownOwnerOverlayProps> = ({
  ownership,
  inference
}) => {
  if (!ownership && !inference) return null;
  if (!ownership && inference) {
    const owner = OWNER_VIEW[inference.suspectedOwner];
    return (
      <div
        data-testid={`inferred-owner-${inference.cardId}`}
        className="pointer-events-none absolute inset-0 z-20 rounded-lg border-[3px] border-red-600 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.9)]"
        title={`${owner.label}可能持有（软推理，仅代表数量，不代表花色）`}
        aria-label={`${owner.label}可能持有，软推理`}
      >
        <span className="absolute right-0 top-0 rounded-bl-md rounded-tr-md bg-red-600 px-1 py-0.5 text-[11px] font-black leading-none text-white">
          {owner.label}?
        </span>
      </div>
    );
  }

  if (!ownership) return null;
  const owner = OWNER_VIEW[ownership.owner];
  const isPlayed = ownership.source === 'played';
  const label = ownership.owner === 'bottom'
    ? isPlayed ? '我✓' : ''
    : owner.label;

  // 自己未出的手牌用原有黄色底色表示，不再增加文字；只有已出后出现对勾。
  if (!label) return null;

  return (
    <div
      data-testid={`known-owner-${ownership.cardId}`}
      className={`pointer-events-none absolute left-0 z-20 max-w-full truncate px-1.5 py-1 text-[11px] font-black leading-none text-white ${
        isPlayed
          ? 'top-0 rounded-br-md rounded-tl-md'
          : 'bottom-0 right-0 rounded-b-md text-center'
      }`}
      style={{ backgroundColor: owner.color }}
      title={`${label}（确定信息）`}
      aria-label={`${label}，确定信息`}
    >
      {label}
    </div>
  );
};

export default KnownOwnerOverlay;
