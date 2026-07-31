import React from 'react';
import type { GameRecord, ReplayState } from '../hooks/useGameHistory';
import { GameReplayTable } from './GameReplayTable';

export interface GameReplayProps {
  gameRecord: GameRecord;
  replayState: ReplayState;
  onReplayControl: {
    setProgress: (progress: number) => void;
    setSpeed: (speed: number) => void;
    start: () => void;
    stop: () => void;
  };
  displayMode?: 'table' | 'summary';
}

/**
 * 回放只使用真实的出牌历史。
 * 保留 displayMode 参数以兼容旧调用，但统一呈现为四家牌桌视图。
 */
export const GameReplay: React.FC<GameReplayProps> = ({
  gameRecord,
  replayState,
  onReplayControl
}) => (
  <GameReplayTable
    gameRecord={gameRecord}
    replayState={replayState}
    onReplayControl={onReplayControl}
  />
);

export default GameReplay;
