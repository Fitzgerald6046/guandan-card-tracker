import type {
  GameMode,
  GameState,
  PlayerPosition,
  PlayRecord,
  Team
} from '../types/game';
import { GameStatus } from '../types/game';
import {
  getActivePlayerPositions,
  getGameMode,
  getPlayerInitialCardCount
} from './gameMode';

export const CARDS_PER_PLAYER = 27;

export const PLAYER_DISPLAY_NAMES: Record<PlayerPosition, string> = {
  bottom: '我',
  left: '下家',
  top: '对家',
  right: '上家'
};

export const FINISH_LABELS = ['头游', '二游', '三游'] as const;

export interface GameProgressRules {
  mode?: GameMode;
  landlordPosition?: PlayerPosition;
  playerOrder?: PlayerPosition[];
}

const resolveMode = (rules?: GameProgressRules): GameMode =>
  rules?.mode ?? 'guandan';

const resolvePlayerOrder = (rules?: GameProgressRules): PlayerPosition[] =>
  rules?.playerOrder ?? getActivePlayerPositions(resolveMode(rules));

const getInitialCount = (
  position: PlayerPosition,
  rules?: GameProgressRules
): number => getPlayerInitialCardCount(
  resolveMode(rules),
  position,
  rules?.landlordPosition
);

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
 * 按真实动作顺序累计出牌数。达到当前模式的初始手牌数时记为出完，
 * 因而重载、回放和撤销都能得到相同结果。
 */
export const getFinishOrder = (
  history: PlayRecord[],
  rules?: GameProgressRules
): PlayerPosition[] => {
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
      playedCounts[position] >= getInitialCount(position, rules) &&
      !finishOrder.includes(position)
    ) {
      finishOrder.push(position);
    }
  });

  return finishOrder;
};

export const getGameProgress = (
  history: PlayRecord[],
  rules?: GameProgressRules
): GameProgress => {
  const mode = resolveMode(rules);
  const finishOrder = getFinishOrder(history, rules);
  if (mode === 'doudizhu') {
    const firstFinisher = finishOrder[0];
    const landlordWon = firstFinisher === rules?.landlordPosition;
    return {
      finishOrder,
      isGameEnd: Boolean(firstFinisher),
      winningTeam: firstFinisher ? (landlordWon ? 1 : 2) : null
    };
  }
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
  history: PlayRecord[],
  rules?: GameProgressRules
): PlayerPosition => {
  const playerOrder = resolvePlayerOrder(rules);
  const finishedPlayers = new Set(getFinishOrder(history, rules));
  const currentIndex = playerOrder.indexOf(currentPlayer);

  for (let offset = 1; offset <= playerOrder.length; offset += 1) {
    const position =
      playerOrder[(currentIndex + offset) % playerOrder.length];
    if (!finishedPlayers.has(position)) return position;
  }

  return currentPlayer;
};

/**
 * 已知下一位实际出牌者时，按座位顺序找出中间未出牌的玩家。
 * 这些玩家可以由语音录入自动补记为过牌；已出完的玩家会被跳过。
 * 返回 null 表示目标玩家当前不在可到达的出牌序列中。
 */
export const getSkippedPlayersBeforeTarget = (
  currentPlayer: PlayerPosition,
  targetPlayer: PlayerPosition,
  history: PlayRecord[],
  rules?: GameProgressRules
): PlayerPosition[] | null => {
  const playerOrder = resolvePlayerOrder(rules);
  const finishedPlayers = new Set(getFinishOrder(history, rules));
  if (!playerOrder.includes(currentPlayer) || !playerOrder.includes(targetPlayer)) {
    return null;
  }
  if (finishedPlayers.has(targetPlayer)) return null;

  const skippedPlayers: PlayerPosition[] = [];
  let cursor = currentPlayer;

  for (let step = 0; step < playerOrder.length; step += 1) {
    if (cursor === targetPlayer) return skippedPlayers;
    if (!finishedPlayers.has(cursor)) skippedPlayers.push(cursor);
    cursor = getNextEligiblePlayer(cursor, history, rules);
  }

  return null;
};

/**
 * 撤销最后一次用户操作。语音自动补记的过牌和最终实际出牌共享
 * operationId，因此会作为一个原子操作整体移除并恢复牌权、牌面和张数。
 */
export const undoLastGameOperation = (gameState: GameState): GameState => {
  if (gameState.playHistory.length === 0) return gameState;

  const lastRecord = gameState.playHistory.at(-1)!;
  let operationStartIndex = gameState.playHistory.length - 1;
  if (lastRecord.operationId) {
    while (
      operationStartIndex > 0 &&
      gameState.playHistory[operationStartIndex - 1].operationId ===
        lastRecord.operationId
    ) {
      operationStartIndex -= 1;
    }
  }

  const removedRecords = gameState.playHistory.slice(operationStartIndex);
  const remainingHistory = gameState.playHistory.slice(0, operationStartIndex);
  const removedCardIds = new Set(
    removedRecords.flatMap(record => record.cards.map(card => card.id))
  );
  const affectedPlayers = new Set(
    removedRecords
      .filter(record => record.cards.length > 0)
      .map(record => record.playerPosition)
  );
  let trailingPassCount = 0;
  for (let index = remainingHistory.length - 1; index >= 0; index -= 1) {
    if (remainingHistory[index].type !== 'pass') break;
    trailingPassCount += 1;
  }
  const mode = getGameMode(gameState);
  const landlordPosition = gameState.config.landlordPosition;
  const playerOrder = getActivePlayerPositions(mode);
  const rules: GameProgressRules = { mode, landlordPosition, playerOrder };
  const trickWasReset = trailingPassCount >= playerOrder.length - 1;
  const currentMaxPlay = trickWasReset
    ? undefined
    : [...remainingHistory]
      .reverse()
      .find(record => record.cards.length > 0);

  return {
    ...gameState,
    status: gameState.status === GameStatus.FINISHED
      ? GameStatus.PLAYING
      : gameState.status,
    allCards: gameState.allCards.map(card =>
      removedCardIds.has(card.id) ? { ...card, isPlayed: false } : card
    ),
    players: gameState.players.map(player => {
      if (!affectedPlayers.has(player.position)) return player;
      const playedCardCount = getPlayedCardCount(
        remainingHistory,
        player.position
      );
      return {
        ...player,
        remainingCount: Math.max(
          0,
          getInitialCount(player.position, rules) - playedCardCount
        ),
        stats: { ...player.stats, playedCards: playedCardCount }
      };
    }),
    currentPlayerPosition:
      removedRecords[0]?.playerPosition ?? lastRecord.playerPosition,
    playHistory: remainingHistory,
    currentRound: {
      ...gameState.currentRound,
      currentMaxPlay,
      passCount: trickWasReset ? 0 : trailingPassCount
    },
    updatedAt: Date.now()
  };
};
