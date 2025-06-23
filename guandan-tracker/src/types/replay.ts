/**
 * 回放系统类型定义
 */

export type PlayerPosition = 'bottom' | 'left' | 'top' | 'right';

export interface Card {
  id: string;
  rank: number;
  isRankCard: boolean;
  isWildCard: boolean;
  isHearts: boolean;
  suit: string;
  displayName: string;
}

export interface PlayRecord {
  player: PlayerPosition;
  cardIds: string[];
  cards: Card[];
  cardType: string;
  description: string;
  timestamp: number;
  round: number;
}

export interface GameReplay {
  gameId: string;
  startTime: number;
  endTime: number;
  currentRank: number;
  players: {
    [key in PlayerPosition]: {
      name: string;
      color: string;
      totalCards: number;
      ranking?: number; // 头游、二游、三游
    }
  };
  playHistory: PlayRecord[];
  winner: PlayerPosition[];
  gameStats: {
    totalRounds: number;
    gameDuration: number;
    totalPlays: number;
  };
}

export interface ReplayState {
  isPlaying: boolean;
  currentPlayIndex: number;
  speed: number; // 播放速度倍数
  showAllCards: boolean; // 是否显示所有出过的牌
}

export interface TablePosition {
  x: number;
  y: number;
  rotation: number;
}