import React from 'react';
import type {
  AIAnalysisResult,
  GameRank,
  PlayerPosition
} from '../types/game';
import { RANK_DISPLAY_NAMES } from '../types/game';

interface RankInferenceBadgeProps {
  rank: GameRank;
  analysisResult: AIAnalysisResult | null;
}

const PLAYER_MARKERS: Record<
  PlayerPosition,
  { shortName: string; color: string }
> = {
  bottom: { shortName: '我', color: '#f59e0b' },
  left: { shortName: '下', color: '#2563eb' },
  top: { shortName: '对', color: '#7c3aed' },
  right: { shortName: '上', color: '#16a34a' }
};

const formatPercent = (probability: number): string =>
  `${Math.round(probability * 100)}%`;

/**
 * 把已有推理投影到实体牌面。徽标是绝对定位且不接收指针事件，
 * 因而不会改变八列牌格，也不会阻断手机滑动录入。
 */
export const RankInferenceBadge: React.FC<RankInferenceBadgeProps> = ({
  rank,
  analysisResult
}) => {
  if (!analysisResult) return null;

  const ownershipClue = analysisResult.humanReasoning.ownershipClues.find(
    clue => clue.rank === rank
  );
  const bombCandidate = analysisResult.cardDistribution.bombCandidates.find(
    candidate => candidate.rank === rank
  );
  const hasVisibleOwnership =
    ownershipClue?.confidence === 'known' ||
    (ownershipClue?.probability ?? 0) >= 0.6;
  const likelyBombOwners = bombCandidate?.mostLikelyPlayers.filter(
    position => position !== 'bottom'
  ) ?? [];
  const strongestBombOwner = likelyBombOwners.length === 1
    ? likelyBombOwners[0]
    : null;
  const hasOpeningBombRisk = Boolean(
    bombCandidate &&
    strongestBombOwner &&
    bombCandidate.playerEstimates.bottom.knownCount <= 2 &&
    bombCandidate.outsideMyHandCopies >= 6 &&
    bombCandidate.anyOpponentBombProbability >= 0.25 &&
    bombCandidate.playerEstimates[strongestBombOwner].bombProbability >= 0.2
  );

  if (hasVisibleOwnership && ownershipClue) {
    const marker = PLAYER_MARKERS[ownershipClue.suspectedOwner];
    const isKnown = ownershipClue.confidence === 'known';
    const title = hasOpeningBombRisk && bombCandidate
      ? `${ownershipClue.summary} 同时存在炸弹风险约${formatPercent(
        bombCandidate.anyOpponentBombProbability
      )}。`
      : ownershipClue.summary;

    return (
      <div
        data-testid={`rank-inference-badge-${rank}`}
        className={`pointer-events-none absolute right-0 top-0 z-20 flex h-4 items-center gap-0.5 whitespace-nowrap rounded-bl-md rounded-tr-md border px-1 text-[9px] font-black leading-none shadow-sm ${
          isKnown
            ? 'border-emerald-700 bg-emerald-600 text-white'
            : 'border-amber-400 bg-amber-50/95 text-amber-950'
        }`}
        title={title}
        aria-label={`${RANK_DISPLAY_NAMES[rank]}：${title}`}
      >
        {hasOpeningBombRisk && <span aria-hidden="true">⚠</span>}
        <span
          className="h-2 w-2 rounded-full ring-1 ring-white"
          style={{ backgroundColor: marker.color }}
          aria-hidden="true"
        />
        <span>
          {isKnown
            ? `✓${marker.shortName}`
            : `${marker.shortName}${formatPercent(ownershipClue.probability)}`}
        </span>
      </div>
    );
  }

  if (!bombCandidate) return null;

  // 实体牌面已经完整显示每个点数的8张牌；没有归属或炸弹线索时不重复显示余量。
  if (!hasOpeningBombRisk) return null;

  const likelyPlayers = likelyBombOwners.map(
    position => PLAYER_MARKERS[position]
  );
  const playerText = likelyPlayers
    .map(marker => marker.shortName)
    .join('/');
  const title =
    `任一对手形成${RANK_DISPLAY_NAMES[rank]}炸弹的概率约${formatPercent(
      bombCandidate.anyOpponentBombProbability
    )}` +
    (playerText ? `，目前最可能是${playerText}` : '');

  return (
    <div
      data-testid={`rank-inference-badge-${rank}`}
      className={`pointer-events-none absolute right-0 top-0 z-20 flex h-4 items-center gap-0.5 whitespace-nowrap rounded-bl-md rounded-tr-md border px-1 text-[9px] font-black leading-none shadow-sm ${
        bombCandidate.anyOpponentBombProbability >= 0.5
          ? 'border-red-600 bg-red-600 text-white'
          : 'border-rose-400 bg-rose-50/95 text-rose-800'
      }`}
      title={title}
      aria-label={`${RANK_DISPLAY_NAMES[rank]}：${title}`}
    >
      <span aria-hidden="true">⚠</span>
      {likelyPlayers.slice(0, 2).map(marker => (
        <span
          key={`${rank}-${marker.shortName}`}
          className="h-2 w-2 rounded-full ring-1 ring-white"
          style={{ backgroundColor: marker.color }}
          aria-hidden="true"
        />
      ))}
      <span>
        {playerText}
        {formatPercent(bombCandidate.anyOpponentBombProbability)}
      </span>
    </div>
  );
};

export default RankInferenceBadge;
