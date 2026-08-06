import React, { useEffect, useMemo, useState } from 'react';
import type { GameRecord, ReplayState } from '../hooks/useGameHistory';
import type {
  Card,
  PlayerPosition,
  PlayRecord,
  Team
} from '../types/game';
import { RANK_DISPLAY_NAMES } from '../types/game';
import {
  FINISH_LABELS,
  PLAYER_DISPLAY_NAMES,
  getGameProgress
} from '../utils/gameProgress';
import {
  getActivePlayerPositions,
  getPlayerInitialCardCount
} from '../utils/gameMode';
import CardImage from './CardImage';

export interface GameReplayTableProps {
  gameRecord: GameRecord;
  replayState: ReplayState;
  onReplayControl: {
    setProgress: (progress: number) => void;
    setSpeed: (speed: number) => void;
    start: () => void;
    stop: () => void;
  };
}

interface ReplayFrame {
  frameIndex: number;
  activePlayer: PlayerPosition;
  currentAction: PlayRecord | null;
  playerCardCounts: Record<PlayerPosition, number>;
  finishOrder: PlayerPosition[];
  isGameEnd: boolean;
  winningTeam: Team | null;
  visibleActions: Array<{
    step: number;
    record: PlayRecord;
  }>;
}

const createInitialCardCounts = (
  gameRecord: GameRecord
): Record<PlayerPosition, number> => {
  const mode = gameRecord.gameMode ?? 'guandan';
  return (['bottom', 'left', 'top', 'right'] as PlayerPosition[]).reduce(
    (counts, position) => {
      counts[position] = getActivePlayerPositions(mode).includes(position)
        ? getPlayerInitialCardCount(
          mode,
          position,
          gameRecord.landlordPosition
        )
        : 0;
      return counts;
    },
    {} as Record<PlayerPosition, number>
  );
};

const isPassAction = (record: PlayRecord | null): boolean =>
  Boolean(record && (record.type === 'pass' || record.cards.length === 0));

const getActionLabel = (record: PlayRecord | null): string => {
  if (!record) return '等待出牌';
  if (isPassAction(record)) return '过牌';
  return `出 ${record.cards
    .map(card => card.displayName || RANK_DISPLAY_NAMES[card.rank])
    .join(' ')}`;
};

const buildReplayFrames = (gameRecord: GameRecord): ReplayFrame[] => {
  const history = Array.isArray(gameRecord.playHistory)
    ? gameRecord.playHistory
    : [];
  const firstPlayer =
    gameRecord.startingPlayerPosition ||
    history[0]?.playerPosition ||
    'bottom';
  const gameMode = gameRecord.gameMode ?? 'guandan';
  const progressRules = {
    mode: gameMode,
    landlordPosition: gameRecord.landlordPosition,
    playerOrder: getActivePlayerPositions(gameMode)
  };
  const cardCounts = createInitialCardCounts(gameRecord);
  let visibleActions: ReplayFrame['visibleActions'] = [];

  const frames: ReplayFrame[] = [
    {
      frameIndex: 0,
      activePlayer: firstPlayer,
      currentAction: null,
      playerCardCounts: { ...cardCounts },
      finishOrder: [],
      isGameEnd: false,
      winningTeam: null,
      visibleActions: []
    }
  ];

  history.forEach((record, index) => {
    if (!isPassAction(record)) {
      cardCounts[record.playerPosition] = Math.max(
        0,
        cardCounts[record.playerPosition] - record.cards.length
      );
    }

    visibleActions = [
      ...visibleActions,
      {
        step: index + 1,
        record: {
          ...record,
          cards: record.cards.map(card => ({ ...card }))
        }
      }
    ];
    const progress = getGameProgress(
      visibleActions.map(action => action.record),
      progressRules
    );

    frames.push({
      frameIndex: index + 1,
      activePlayer: record.playerPosition,
      currentAction: record,
      playerCardCounts: { ...cardCounts },
      finishOrder: progress.finishOrder,
      isGameEnd: progress.isGameEnd,
      winningTeam: progress.winningTeam,
      visibleActions
    });
  });

  return frames;
};

const formatElapsed = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
};

const ReplayCards: React.FC<{ cards: Card[] }> = ({ cards }) => (
  <div className="flex flex-wrap justify-center gap-0.5">
    {cards.map(card => (
      <CardImage
        key={card.id}
        rank={card.rank}
        suit={card.suit ?? 'joker'}
        displayName={card.displayName || RANK_DISPLAY_NAMES[card.rank]}
        isWildCard={card.isWildCard}
        isRankCard={card.isRankCard}
        size="tiny"
      />
    ))}
  </div>
);

export const GameReplayTable: React.FC<GameReplayTableProps> = ({
  gameRecord,
  replayState,
  onReplayControl
}) => {
  const gameMode = gameRecord.gameMode ?? 'guandan';
  const frames = useMemo(() => buildReplayFrames(gameRecord), [gameRecord]);
  const [isPlaying, setIsPlaying] = useState(false);
  const finalFrameIndex = Math.max(0, frames.length - 1);
  const currentFrameIndex = Math.min(
    finalFrameIndex,
    Math.round(replayState.replayProgress * finalFrameIndex)
  );
  const currentFrame = frames[currentFrameIndex] || frames[0];
  const history = gameRecord.playHistory ?? [];
  const firstTimestamp = history[0]?.timestamp ?? gameRecord.timestamp;
  const currentTimestamp =
    currentFrame.currentAction?.timestamp ?? firstTimestamp;
  const setProgress = onReplayControl.setProgress;

  useEffect(() => {
    if (!isPlaying) return;
    if (currentFrameIndex >= finalFrameIndex) {
      setIsPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setProgress((currentFrameIndex + 1) / finalFrameIndex);
    }, Math.max(250, 1200 / replayState.replaySpeed));

    return () => window.clearTimeout(timer);
  }, [
    currentFrameIndex,
    finalFrameIndex,
    isPlaying,
    replayState.replaySpeed,
    setProgress
  ]);

  const moveToFrame = (frameIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(finalFrameIndex, frameIndex));
    setProgress(finalFrameIndex === 0 ? 0 : boundedIndex / finalFrameIndex);
  };

  const togglePlayback = () => {
    if (finalFrameIndex === 0) return;
    if (currentFrameIndex >= finalFrameIndex) {
      moveToFrame(0);
    }
    setIsPlaying(previous => !previous);
  };

  const renderPlayer = (position: PlayerPosition) => {
    const actions = currentFrame.visibleActions.filter(
      action => action.record.playerPosition === position
    );
    const isActive =
      currentFrame.currentAction?.playerPosition === position ||
      (currentFrameIndex === 0 && currentFrame.activePlayer === position);
    const finishIndex = currentFrame.finishOrder.indexOf(position);
    const finishLabel = finishIndex >= 0
      ? (gameMode === 'doudizhu' ? '胜出' : FINISH_LABELS[finishIndex])
      : null;

    return (
      <div
        data-testid={`replay-player-${position}`}
        className={`min-w-0 overflow-hidden rounded-2xl border p-1.5 text-center shadow-lg backdrop-blur-sm transition-all duration-300 sm:p-2 ${
          isActive
            ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-300/80'
            : finishLabel
              ? 'border-amber-200 bg-gradient-to-b from-amber-50 to-orange-50'
              : 'border-emerald-200/80 bg-white/95'
        }`}
      >
        <div className="flex items-center justify-center gap-1">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isActive ? 'animate-pulse bg-amber-500' : 'bg-emerald-500'
            }`}
          />
          <span className="truncate text-xs font-black tracking-wide text-slate-900">
            {PLAYER_DISPLAY_NAMES[position]}
          </span>
          {gameMode === 'doudizhu' && gameRecord.landlordPosition === position && (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-black text-white">
              地主
            </span>
          )}
          {finishLabel && (
            <span
              data-testid={`replay-finish-${position}`}
              className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-black text-white shadow-sm"
            >
              {finishLabel}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[10px] font-medium text-slate-500">
          剩余
          <span className="mx-0.5 font-black tabular-nums text-emerald-800">
            {currentFrame.playerCardCounts[position]}
          </span>
          张
        </div>
        <div
          data-testid={`replay-played-${position}`}
          className="mt-1 space-y-1 rounded-xl border border-emerald-100 bg-emerald-50/80 p-1"
        >
          <div className="text-[8px] font-bold tracking-wider text-emerald-800/70">
            出牌轨迹 · {actions.length}手
          </div>
          {actions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-emerald-200 py-1 text-[9px] text-emerald-700/50">
              尚未行动
            </div>
          ) : (
            actions.map(action => {
              const isCurrentStep =
                action.step === currentFrame.frameIndex;
              return (
                <div
                  key={`${action.step}-${action.record.id}`}
                  data-replay-step={action.step}
                  className={`rounded-lg border px-1 py-1 transition-colors ${
                    isCurrentStep
                      ? 'border-amber-300 bg-amber-50 shadow-sm'
                      : 'border-white bg-white/90'
                  }`}
                >
                  <div className="mb-0.5 text-[8px] font-black tabular-nums text-slate-400">
                    第 {action.step} 手
                  </div>
                  {isPassAction(action.record) ? (
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
                      过
                    </span>
                  ) : (
                    <ReplayCards cards={action.record.cards} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid="exact-replay-table"
      className="relative overflow-hidden rounded-[28px] border border-emerald-700/70 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 p-2 text-slate-900 shadow-2xl sm:p-4"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-emerald-400/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl" />

      <div className="relative mb-2 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white shadow-inner backdrop-blur-sm">
        <div className="min-w-0 text-left">
          <div className="truncate text-sm font-black tracking-wide">
            真实牌局回放
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-emerald-100/70">
            {gameMode === 'doudizhu'
              ? `三人牌桌 · 地主${PLAYER_DISPLAY_NAMES[gameRecord.landlordPosition ?? 'bottom']}`
              : `四方牌桌 · 打${RANK_DISPLAY_NAMES[gameRecord.currentRank]}`}
          </div>
        </div>
        <div
          data-testid="replay-current-step"
          className="flex-shrink-0 rounded-full border border-emerald-300/20 bg-emerald-950/50 px-3 py-1 text-right text-[10px] font-bold tabular-nums text-emerald-50"
        >
          <div>第 {currentFrameIndex} / {finalFrameIndex} 手</div>
          <div className="text-emerald-200/70">
            {formatElapsed(currentTimestamp - firstTimestamp)}
          </div>
        </div>
      </div>

      <div className="relative grid min-h-[380px] grid-cols-[minmax(0,1fr)_minmax(112px,1.25fr)_minmax(0,1fr)] grid-rows-[auto_1fr_auto] items-center gap-2 overflow-hidden rounded-[42px] border-4 border-emerald-700/70 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700 p-2 shadow-[inset_0_0_50px_rgba(2,44,34,0.65)] sm:min-h-[480px] sm:gap-4 sm:p-4">
        <div className="pointer-events-none absolute inset-4 rounded-[34px] border border-emerald-300/15" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/10 bg-emerald-950/10 shadow-[0_0_50px_rgba(6,78,59,0.35)]" />

        {gameMode === 'guandan' && (
          <div className="col-start-2 row-start-1">
            {renderPlayer('top')}
          </div>
        )}
        <div className="col-start-1 row-start-2">
          {renderPlayer('right')}
        </div>

        <div
          data-testid="replay-current-action"
          className="relative col-start-2 row-start-2 overflow-hidden rounded-[24px] border border-white/50 bg-white/95 p-2 text-center shadow-[0_16px_35px_rgba(6,78,59,0.35)] backdrop-blur sm:p-3"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />
          {currentFrame.currentAction ? (
            <>
              <div
                data-testid="replay-current-player"
                className="mt-1 text-[10px] font-black tracking-[0.18em] text-emerald-800"
              >
                {PLAYER_DISPLAY_NAMES[currentFrame.currentAction.playerPosition]}
              </div>
              <div className="mt-1 text-xs font-black leading-tight text-slate-800">
                {getActionLabel(currentFrame.currentAction)}
              </div>
              {!isPassAction(currentFrame.currentAction) && (
                <div className="mt-2">
                  <ReplayCards cards={currentFrame.currentAction.cards} />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mt-1 text-sm font-black text-emerald-950">
                牌局开始
              </div>
              <div className="mt-1 text-[10px] font-bold text-emerald-700">
                等待 {PLAYER_DISPLAY_NAMES[currentFrame.activePlayer]} 首出
              </div>
            </>
          )}
        </div>

        <div className="col-start-3 row-start-2">
          {renderPlayer('left')}
        </div>
        <div className="col-start-2 row-start-3">
          {renderPlayer('bottom')}
        </div>
      </div>

      {currentFrame.isGameEnd && (
        <div
          data-testid="replay-game-result"
          className="relative mt-2 rounded-2xl border border-amber-300/50 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 px-3 py-2 text-center shadow-lg"
        >
          <div className="text-xs font-black tracking-wide text-amber-950">
            本局结束
            {gameMode === 'doudizhu'
              ? currentFrame.finishOrder[0] === gameRecord.landlordPosition
                ? ' · 地主胜利'
                : ' · 农民胜利'
              : currentFrame.winningTeam
                ? ' · 同队包揽头游、二游'
                : ' · 三游产生'}
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            {currentFrame.finishOrder.slice(0, 3).map((position, index) => (
              <span
                key={position}
                className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-black text-amber-900"
              >
                {gameMode === 'doudizhu' ? '胜出' : FINISH_LABELS[index]} · {PLAYER_DISPLAY_NAMES[position]}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="relative mt-2 rounded-2xl border border-white/10 bg-white/95 p-3 shadow-xl backdrop-blur">
        <input
          data-testid="replay-progress"
          type="range"
          min={0}
          max={finalFrameIndex}
          step={1}
          value={currentFrameIndex}
          onChange={event => {
            setIsPlaying(false);
            moveToFrame(Number(event.target.value));
          }}
          aria-label="回放进度"
          className="h-3 w-full cursor-pointer accent-amber-500"
        />

        <div className="mt-2 grid grid-cols-4 gap-1">
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              moveToFrame(0);
            }}
            className="min-h-10 rounded-xl border border-slate-200 bg-slate-100 px-2 text-xs font-black text-slate-700 transition-colors hover:bg-slate-200"
          >
            重置
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              moveToFrame(currentFrameIndex - 1);
            }}
            disabled={currentFrameIndex === 0}
            className="min-h-10 rounded-xl border border-slate-200 bg-slate-100 px-2 text-xs font-black text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-40"
          >
            上一步
          </button>
          <button
            type="button"
            data-testid="replay-play-button"
            onClick={togglePlayback}
            disabled={finalFrameIndex === 0}
            className="min-h-10 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-2 text-xs font-black text-white shadow-md transition-transform active:scale-95 disabled:opacity-40"
          >
            {isPlaying ? 'Ⅱ 暂停' : '▶ 播放'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              moveToFrame(currentFrameIndex + 1);
            }}
            disabled={currentFrameIndex === finalFrameIndex}
            className="min-h-10 rounded-xl border border-slate-200 bg-slate-100 px-2 text-xs font-black text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-40"
          >
            下一步
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-slate-500">
            {history.length}手真实轨迹（含过牌）
          </span>
          <label className="flex items-center gap-1 font-medium text-slate-600">
            速度
            <select
              value={replayState.replaySpeed}
              onChange={event =>
                onReplayControl.setSpeed(Number(event.target.value))
              }
              className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 font-bold text-emerald-900"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
};

export default GameReplayTable;
