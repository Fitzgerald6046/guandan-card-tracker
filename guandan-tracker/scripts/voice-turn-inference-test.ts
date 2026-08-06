import type {
  Card,
  GameState,
  PlayRecord,
  PlayerPosition
} from '../src/types/game';
import {
  getSkippedPlayersBeforeTarget,
  undoLastGameOperation
} from '../src/utils/gameProgress';

const assertPositions = (
  actual: PlayerPosition[] | null,
  expected: PlayerPosition[],
  label: string
) => {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  if (actualText !== expectedText) {
    throw new Error(`${label}: expected ${expectedText}, received ${actualText}`);
  }
};

const noHistory: PlayRecord[] = [];
assertPositions(
  getSkippedPlayersBeforeTarget('left', 'right', noHistory),
  ['left', 'top'],
  '两家跳过'
);
assertPositions(
  getSkippedPlayersBeforeTarget('left', 'bottom', noHistory),
  ['left', 'top', 'right'],
  '三家过牌后原出牌者重新领牌'
);
assertPositions(
  getSkippedPlayersBeforeTarget('top', 'top', noHistory),
  [],
  '当前玩家直接出牌'
);

const finishedCards = Array.from(
  { length: 27 },
  (_, index) => ({ id: `finished-${index}` } as Card)
);
const historyWithFinishedTop: PlayRecord[] = [{
  id: 'finish-top',
  playerPosition: 'top',
  cards: finishedCards,
  type: 'single',
  timestamp: 1,
  isActivePlay: true
}];
assertPositions(
  getSkippedPlayersBeforeTarget('left', 'right', historyWithFinishedTop),
  ['left'],
  '跳过已出完玩家'
);
if (
  getSkippedPlayersBeforeTarget('left', 'top', historyWithFinishedTop) !== null
) {
  throw new Error('已出完玩家不应成为下一位实际出牌者');
}

const makeCard = (id: string, rank: 4 | 5): Card => ({
  id,
  suit: 'spades',
  rank,
  isRankCard: false,
  isWildCard: false,
  isPlayed: true,
  isSelected: false,
  timestamp: 1
});
const leadCard = makeCard('lead-card', 4);
const voicePlayedCard = makeCard('voice-card', 5);
const operationId = 'voice-operation';
const leadRecord: PlayRecord = {
  id: 'lead',
  playerPosition: 'bottom',
  cards: [leadCard],
  type: 'single',
  timestamp: 10,
  isActivePlay: true
};
const voiceOperation: PlayRecord[] = [{
  id: 'implicit-left',
  playerPosition: 'left',
  cards: [],
  type: 'pass',
  timestamp: 11,
  isActivePlay: false,
  operationId
}, {
  id: 'implicit-top',
  playerPosition: 'top',
  cards: [],
  type: 'pass',
  timestamp: 12,
  isActivePlay: false,
  operationId
}, {
  id: 'voice-right-play',
  playerPosition: 'right',
  cards: [voicePlayedCard],
  type: 'single',
  timestamp: 13,
  isActivePlay: true,
  operationId
}];
const undoState: GameState = {
  gameId: 'voice-undo-test',
  status: 'playing',
  config: {
    rank: { current: 8, next: 8, history: [] },
    tributeEnabled: false
  },
  players: (['bottom', 'left', 'top', 'right'] as PlayerPosition[])
    .map(position => ({
      id: position,
      name: position,
      position,
      team: position === 'bottom' || position === 'top' ? 1 : 2,
      cards: [],
      remainingCount: position === 'bottom' || position === 'right' ? 26 : 27,
      isCurrentPlayer: position === 'bottom',
      stats: {
        playedCards: position === 'bottom' || position === 'right' ? 1 : 0,
        rankCardCount: 0,
        wildCardCount: 0,
        roundWins: 0
      }
    })),
  currentPlayerPosition: 'bottom',
  currentRank: 8,
  allCards: [leadCard, voicePlayedCard],
  playHistory: [leadRecord, ...voiceOperation],
  currentRound: {
    roundNumber: 1,
    startTime: 1,
    currentMaxPlay: voiceOperation[2],
    passCount: 0,
    isFinished: false
  },
  createdAt: 1,
  updatedAt: 13
};
const undone = undoLastGameOperation(undoState);
if (
  undone.playHistory.length !== 1 ||
  undone.playHistory[0].id !== leadRecord.id ||
  undone.currentPlayerPosition !== 'left' ||
  undone.currentRound.currentMaxPlay?.id !== leadRecord.id ||
  undone.currentRound.passCount !== 0 ||
  undone.allCards.find(card => card.id === voicePlayedCard.id)?.isPlayed ||
  undone.players.find(player => player.position === 'right')?.remainingCount !== 27
) {
  throw new Error('语音隐式过牌与实际出牌没有被完整原子撤销');
}

console.log(JSON.stringify({
  status: 'ok',
  checked: 6,
  atomicUndo: true,
  rule: '只播报实际出牌者，中间玩家自动过牌，并可整组撤销'
}, null, 2));
