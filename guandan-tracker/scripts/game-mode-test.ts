import type { Card, PlayRecord, PlayerPosition } from '../src/types/game';
import { Rank, Suit } from '../src/types/game';
import { validateDoudizhuCardType } from '../src/utils/doudizhuRules';
import {
  getGameProgress,
  getNextEligiblePlayer,
  getSkippedPlayersBeforeTarget
} from '../src/utils/gameProgress';
import {
  getActivePlayerPositions,
  getPlayerInitialCardCount
} from '../src/utils/gameMode';

const makeCards = (rank: number, count: number): Card[] => Array.from(
  { length: count },
  (_, index) => ({
    id: `${rank}-${index}-${Math.random()}`,
    rank: rank as Card['rank'],
    suit: rank >= Rank.JOKER_SMALL ? null : Suit.SPADES,
    isRankCard: false,
    isWildCard: false,
    isPlayed: false,
    isSelected: false,
    timestamp: index
  })
);

const play = (
  position: PlayerPosition,
  cards: Card[],
  index: number
): PlayRecord => ({
  id: `play-${index}`,
  playerPosition: position,
  cards,
  type: 'single',
  timestamp: index,
  isActivePlay: true
});

const rules = {
  mode: 'doudizhu' as const,
  landlordPosition: 'bottom' as const,
  playerOrder: getActivePlayerPositions('doudizhu')
};

if (rules.playerOrder.join(',') !== 'bottom,left,right') {
  throw new Error('斗地主玩家顺序应为我、下家、上家');
}
if (
  getPlayerInitialCardCount('doudizhu', 'bottom', 'bottom') !== 20 ||
  getPlayerInitialCardCount('doudizhu', 'left', 'bottom') !== 17
) {
  throw new Error('斗地主地主/农民初始牌数错误');
}

const landlordHistory = [play('bottom', makeCards(3, 20), 1)];
const landlordProgress = getGameProgress(landlordHistory, rules);
if (!landlordProgress.isGameEnd || landlordProgress.winningTeam !== 1) {
  throw new Error('地主出完20张后应立即获胜');
}

const farmerHistory = [play('left', makeCards(4, 17), 1)];
const farmerProgress = getGameProgress(farmerHistory, rules);
if (!farmerProgress.isGameEnd || farmerProgress.winningTeam !== 2) {
  throw new Error('任一农民出完17张后农民方应立即获胜');
}

if (getNextEligiblePlayer('left', [], rules) !== 'right') {
  throw new Error('斗地主轮转不应经过对家位置');
}
const skipped = getSkippedPlayersBeforeTarget('bottom', 'right', [], rules);
if (skipped?.join(',') !== 'bottom,left') {
  throw new Error('斗地主自动补过牌顺序错误');
}

const rocket = validateDoudizhuCardType([
  ...makeCards(Rank.JOKER_SMALL, 1),
  ...makeCards(Rank.JOKER_BIG, 1)
]);
if (!rocket.isValid || rocket.description !== '王炸') {
  throw new Error('斗地主王炸未识别');
}
const straight = validateDoudizhuCardType(
  [3, 4, 5, 6, 7, 8].flatMap(rank => makeCards(rank, 1))
);
if (!straight.isValid || straight.type !== 'straight') {
  throw new Error('斗地主六张顺子未识别');
}
const invalidStraight = validateDoudizhuCardType(
  [10, 11, 12, 13, 14, 2].flatMap(rank => makeCards(rank, 1))
);
if (invalidStraight.isValid) {
  throw new Error('斗地主顺子不应包含2');
}

console.log('斗地主模式测试通过');

