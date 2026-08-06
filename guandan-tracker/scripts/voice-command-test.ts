import {
  isIncompleteVoiceTranscript,
  parseVoiceTranscript,
  splitVoiceTranscript
} from '../src/utils/voiceCommand';
import { pickCardsByVoiceRanks } from '../src/utils/quickCardInput';
import { validateCardType } from '../src/utils/guandanRules';
import {
  Suit,
  type Card,
  type Rank
} from '../src/types/game';

const cases: Array<[string, number[], number[]?]> = [
  ['下家两个8', [8, 8]],
  ['下家两个吧', [8, 8]],
  ['上家一对捌', [8, 8]],
  ['我俩个八', [8, 8]],
  ['我对2', [2, 2]],
  ['上两个2', [2, 2]],
  ['上对7', [7, 7]],
  ['上两张7', [7, 7]],
  ['上两个7', [7, 7]],
  ['我对勾', [11, 11]],
  ['我两张勾', [11, 11]],
  ['我两个勾', [11, 11]],
  ['上对10', [10, 10]],
  ['上两张10', [10, 10]],
  ['上两个10', [10, 10]],
  ['对一张尖', [14]],
  ['对一张A', [14]],
  ['对一张ei', [14]],
  ['我一张9', [9]],
  ['我单张9', [9]],
  ['上四张尖', [14, 14, 14, 14]],
  ['下六张尖', [14, 14, 14, 14, 14, 14]],
  ['对四个3', [3, 3, 3, 3]],
  ['对三张2', [2, 2, 2]],
  ['我三张4带对6', [4, 4, 4, 6, 6]],
  ['我三个4带两个6', [4, 4, 4, 6, 6]],
  ['我三个七带对4', [7, 7, 7, 4, 4]],
  ['下三张5带两个4', [5, 5, 5, 4, 4]],
  ['上对7对8对9', [7, 7, 8, 8, 9, 9]],
  ['对三张3三张4', [3, 3, 3, 4, 4, 4]],
  ['对三张10三张勾', [10, 10, 10, 11, 11, 11]],
  ['对三个10三个勾', [10, 10, 10, 11, 11, 11]],
  ['上三张圈红心勾', [12, 12, 12, 11], [11]],
  ['下67810红心勾', [6, 7, 8, 10, 11], [11]],
  ['上10JQK红心8', [10, 11, 12, 13, 8], [8]],
  ['我三个5红心8', [5, 5, 5, 8], [8]],
  ['我2356红心8', [2, 3, 5, 6, 8], [8]],
  ['我90JQ红心8', [9, 10, 11, 12, 8], [8]],
  ['我三个4两个5红心8', [4, 4, 4, 5, 5, 8], [8]],
  ['我两张6红心8带对4', [6, 6, 8, 4, 4], [8]],
  ['上8910JQ有红心', [8, 9, 10, 11, 12]],
  ['上8 9 10 J Q 有红心', [8, 9, 10, 11, 12]],
  ['队友一张7', [7]],
  ['队有两个8', [8, 8]],
  ['对友四张10', [10, 10, 10, 10]],
  ['队油三张5带对4', [5, 5, 5, 4, 4]],
  ['对大王对', [16, 16]],
  ['我QqqJ', [12, 12, 12, 11]],
  ['我222222', [2, 2, 2, 2, 2, 2]],
  // 2026-08-05 手机浏览器实测失败口令回归。
  ['上家两张7两张8两张9', [7, 7, 8, 8, 9, 9]],
  ['下家一张10', [10]],
  ['夏家一张10', [10]],
  ['对家一张尖', [14]],
  ['对家一张ei', [14]],
  ['对家一张s', [14]],
  ['对家四张5', [5, 5, 5, 5]],
  ['对四个5', [5, 5, 5, 5]],
  ['对家两张8', [8, 8]],
  ['对两个8', [8, 8]],
  ['下家两张k', [13, 13]],
  ['下家一张j', [11]],
  ['对家四张10', [10, 10, 10, 10]],
  ['对四张10', [10, 10, 10, 10]],
  ['上家三个圈一张红心勾', [12, 12, 12, 11], [11]],
  ['夏家六80红星勾', [6, 7, 8, 10, 11], [11]],
  ['我六张2', [2, 2, 2, 2, 2, 2]],
  ['下家两张3', [3, 3]],
  ['下家大王', [16]],
  ['下家三张五带对四', [5, 5, 5, 4, 4]],
  ['下家一张2', [2]],
  ['夏一个二', [2]],
  ['夏家一个2', [2]]
];

for (const [input, expected, expectedWildCards = []] of cases) {
  const parsed = parseVoiceTranscript(input);
  const actual = parsed.command?.ranks ?? [];
  const actualWildCards = parsed.command?.wildCardRanks ?? [];
  if (
    parsed.command?.action !== 'play' ||
    actual.join(',') !== expected.join(',') ||
    actualWildCards.join(',') !== expectedWildCards.join(',')
  ) {
    throw new Error(`${input} 解析失败：${JSON.stringify(parsed)}`);
  }
}

const unsplitPairSequence = splitVoiceTranscript('上对7对8对9');
if (unsplitPairSequence.length !== 1 || unsplitPairSequence[0] !== '上对7对8对9') {
  throw new Error(`连续对子被错误拆分：${JSON.stringify(unsplitPairSequence)}`);
}

const unsplitTripleWithPair = splitVoiceTranscript('我三张4带对6');
if (unsplitTripleWithPair.length !== 1 || unsplitTripleWithPair[0] !== '我三张4带对6') {
  throw new Error(`三带二被错误拆分：${JSON.stringify(unsplitTripleWithPair)}`);
}

const safeBatch = splitVoiceTranscript('我7上家8下家9');
if (safeBatch.join('|') !== '我7|上家8|下家9') {
  throw new Error(`明确玩家批量命令拆分失败：${JSON.stringify(safeBatch)}`);
}

if (!isIncompleteVoiceTranscript('夏家一张')) {
  throw new Error('“夏家一张”应被保留为可续接的未完整口令');
}
const stitchedTranscript = parseVoiceTranscript('夏家一张10');
if (stitchedTranscript.command?.ranks?.join(',') !== '10') {
  throw new Error(`分段口令续接失败：${JSON.stringify(stitchedTranscript)}`);
}

let cardSequence = 0;
const createCard = (rank: Rank, isWildCard = false): Card => ({
  id: `voice-test-${cardSequence++}`,
  rank,
  suit: isWildCard ? Suit.HEARTS : Suit.SPADES,
  isRankCard: rank === 8,
  isWildCard,
  isPlayed: false,
  isSelected: false,
  timestamp: cardSequence,
  displayName: isWildCard ? `红心${rank}` : String(rank)
});

const wildCombinationCases: Array<[string, string]> = [
  ['我一张6红心8', 'pair'],
  ['我一张6红心配', 'pair'],
  ['我一张6配牌', 'pair'],
  ['我三个5红心8', 'bomb'],
  ['我三个5红心配', 'bomb'],
  ['我2356红心8', 'flush_straight'],
  ['我2356红心配', 'flush_straight'],
  ['我90JQ红心8', 'flush_straight'],
  ['我三个4两个5红心8', 'steel_board'],
  ['我两张6红心8带对4', 'triple_with_pair'],
  ['我两张6红心配带对4', 'triple_with_pair']
];

for (const [input, expectedType] of wildCombinationCases) {
  const parsed = parseVoiceTranscript(input, 8);
  const ranks = parsed.command?.ranks ?? [];
  const wildCardRanks = parsed.command?.wildCardRanks ?? [];
  const normalRanks = [...ranks];
  wildCardRanks.forEach(rank => {
    const index = normalRanks.indexOf(rank);
    if (index >= 0) normalRanks.splice(index, 1);
  });
  const cards = [
    ...normalRanks.map(rank => createCard(rank)),
    ...wildCardRanks.map(rank => createCard(rank, true))
  ];
  const selection = pickCardsByVoiceRanks(
    cards,
    ranks,
    wildCardRanks,
    () => true
  );
  if (!selection.success) {
    throw new Error(`${input} 未能锁定红心配牌：${JSON.stringify(selection)}`);
  }

  const selectedCards = cards.filter(card => selection.selectedIds.has(card.id));
  if (
    selectedCards.length !== ranks.length ||
    selectedCards.filter(card => card.isWildCard).length !== wildCardRanks.length
  ) {
    throw new Error(`${input} 选牌错误：${JSON.stringify(selectedCards)}`);
  }

  const validation = validateCardType(selectedCards, 8);
  if (!validation.isValid || validation.type !== expectedType) {
    throw new Error(`${input} 牌型校验失败：${JSON.stringify(validation)}`);
  }
}

console.log(
  `语音口令回归测试通过：${cases.length} 条牌面 + ` +
  `3 条拆分规则 + ${wildCombinationCases.length} 条红心配组合`
);
