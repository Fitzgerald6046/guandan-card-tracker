import type {
  PlayerPosition,
  PlayRecord,
  Team
} from '../types/game';

export const CARDS_PER_PLAYER = 27;

export const PLAYER_DISPLAY_NAMES: Record<PlayerPosition, string> = {
  bottom: '我',
  left: '下家',
  top: '对家',
  right: '上家'
};

export const FINISH_LABELS = ['头游', '二游', '三游'] as const;

const PLAYER_ORDER: PlayerPosition[] = [
  'bottom',
  'left',
  'top',
  'right'
];

const PLAYER_TEAMS: Record<PlayerPosition, Team> = {
  bottom: 1,
  top: 1,
  left: 2,
  right: 2
};

export const getPlayerTeam = (position: PlayerPosition): Team =>
  PLAYER_TEAMS[position];

export const isSameTeam = (
  left: PlayerPosition,
  right: PlayerPosition
): boolean => PLAYER_TEAMS[left] === PLAYER_TEAMS[right];

export interface GameProgress {
  finishOrder: PlayerPosition[];
  isGameEnd: boolean;
  winningTeam: Team | null;
}

export const getPlayerDisplayName = (position: PlayerPosition): string =>
  PLAYER_DISPLAY_NAMES[position];

export const getPlayedCardCount = (
  history: PlayRecord[],
  position: PlayerPosition
): number =>
  history
    .filter(record => record.playerPosition === position)
    .reduce((total, record) => total + record.cards.length, 0);

/**
 * 按真实动作顺序累计出牌数。玩家第一次累计达到27张时确定游次，
 * 因而重载、回放和撤销都能得到相同结果。
 */
export const getFinishOrder = (history: PlayRecord[]): PlayerPosition[] => {
  const playedCounts: Record<PlayerPosition, number> = {
    bottom: 0,
    left: 0,
    top: 0,
    right: 0
  };
  const finishOrder: PlayerPosition[] = [];

  history.forEach(record => {
    if (record.cards.length === 0) return;

    const position = record.playerPosition;
    playedCounts[position] += record.cards.length;

    if (
      playedCounts[position] >= CARDS_PER_PLAYER &&
      !finishOrder.includes(position)
    ) {
      finishOrder.push(position);
    }
  });

  return finishOrder;
};

export const getGameProgress = (history: PlayRecord[]): GameProgress => {
  const finishOrder = getFinishOrder(history);
  const firstTwo = finishOrder.slice(0, 2);
  const teammatesFinishedFirst =
    firstTwo.length === 2 &&
    PLAYER_TEAMS[firstTwo[0]] === PLAYER_TEAMS[firstTwo[1]];

  return {
    finishOrder,
    isGameEnd: teammatesFinishedFirst || finishOrder.length >= 3,
    winningTeam: teammatesFinishedFirst
      ? PLAYER_TEAMS[firstTwo[0]]
      : null
  };
};

export const getNextEligiblePlayer = (
  currentPlayer: PlayerPosition,
  history: PlayRecord[]
): PlayerPosition => {
  const finishedPlayers = new Set(getFinishOrder(history));
  const currentIndex = PLAYER_ORDER.indexOf(currentPlayer);

  for (let offset = 1; offset <= PLAYER_ORDER.length; offset += 1) {
    const position =
      PLAYER_ORDER[(currentIndex + offset) % PLAYER_ORDER.length];
    if (!finishedPlayers.has(position)) return position;
  }

  return currentPlayer;
};
