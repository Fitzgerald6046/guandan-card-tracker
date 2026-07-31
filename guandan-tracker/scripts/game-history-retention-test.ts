import {
  retainGameRecords,
  type GameRecord
} from '../src/hooks/useGameHistory';

const makeRecord = (
  id: string,
  lastUpdatedAt: number,
  isImportant = false
): GameRecord => ({
  id,
  sourceGameId: `source-${id}`,
  isImportant,
  lastUpdatedAt,
  timestamp: lastUpdatedAt,
  duration: 0,
  currentRank: 7,
  players: [],
  finalCardOwnership: {},
  cardsSnapshot: [],
  playHistory: [],
  startingPlayerPosition: 'bottom',
  analysisReport: {} as GameRecord['analysisReport'],
  winningTeam: null,
  gameResult: {
    team1Score: 0,
    team2Score: 0,
    advantages: [],
    keyMoments: []
  },
  isCompleted: false,
  tags: []
});

const regularRecords = Array.from({ length: 12 }, (_, index) =>
  makeRecord(`regular-${index}`, index + 1)
);
const importantRecords = [
  makeRecord('important-old', -100, true),
  makeRecord('important-new', 100, true)
];
const source = [...regularRecords, ...importantRecords];
const originalOrder = source.map(record => record.id);
const retained = retainGameRecords(source);

if (retained.length !== 12) {
  throw new Error(`应保留2局重要牌局和10局普通牌局，实际${retained.length}局`);
}
if (!retained.slice(0, 2).every(record => record.isImportant)) {
  throw new Error('重要牌局没有排在历史记录顶部');
}
if (!retained.some(record => record.id === 'important-old')) {
  throw new Error('较早的重要牌局被普通10局上限错误淘汰');
}
if (retained.some(record => record.id === 'regular-0') ||
    retained.some(record => record.id === 'regular-1')) {
  throw new Error('最旧的普通牌局没有被正确淘汰');
}
if (source.map(record => record.id).join('|') !== originalOrder.join('|')) {
  throw new Error('历史记录筛选不应原地修改React状态数组');
}

const legacyRecord = {
  ...makeRecord('legacy', 1),
  isImportant: undefined,
  lastUpdatedAt: undefined
} as unknown as GameRecord;
const [normalizedLegacy] = retainGameRecords([legacyRecord]);
if (normalizedLegacy.isImportant ||
    normalizedLegacy.lastUpdatedAt !== normalizedLegacy.timestamp) {
  throw new Error('旧版历史记录没有正确迁移默认字段');
}

console.log(JSON.stringify({
  retainedCount: retained.length,
  importantCount: retained.filter(record => record.isImportant).length,
  regularCount: retained.filter(record => !record.isImportant).length,
  oldestImportantRetained: true,
  legacyNormalized: true
}, null, 2));
