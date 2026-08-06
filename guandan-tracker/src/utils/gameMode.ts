import type {
  GameMode,
  GameState,
  PlayerPosition,
  Team
} from '../types/game';

export const GUANDAN_POSITIONS: PlayerPosition[] = [
  'bottom',
  'left',
  'top',
  'right'
];

export const DOUDIZHU_POSITIONS: PlayerPosition[] = [
  'bottom',
  'left',
  'right'
];

export const getGameMode = (
  gameState: Pick<GameState, 'config'>
): GameMode => gameState.config.gameMode ?? 'guandan';

export const getActivePlayerPositions = (
  mode: GameMode
): PlayerPosition[] => mode === 'doudizhu'
  ? DOUDIZHU_POSITIONS
  : GUANDAN_POSITIONS;

export const getModePlayerDisplayName = (
  position: PlayerPosition,
  mode: GameMode
): string => {
  if (position === 'bottom') return '我';
  if (position === 'left') return '下家';
  if (position === 'right') return '上家';
  return mode === 'doudizhu' ? '' : '对家';
};

export const getPlayerInitialCardCount = (
  mode: GameMode,
  position: PlayerPosition,
  landlordPosition?: PlayerPosition
): number => {
  if (mode === 'guandan') return 27;
  return position === landlordPosition ? 20 : 17;
};

export const getModePlayerTeam = (
  mode: GameMode,
  position: PlayerPosition,
  landlordPosition?: PlayerPosition
): Team => {
  if (mode === 'guandan') {
    return position === 'bottom' || position === 'top' ? 1 : 2;
  }
  return position === landlordPosition ? 1 : 2;
};

export const getExpectedDeckSize = (mode: GameMode): number =>
  mode === 'doudizhu' ? 54 : 108;

