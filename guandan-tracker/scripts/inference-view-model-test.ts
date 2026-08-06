import type {
  Card,
  GameRank,
  GameState,
  Player,
  PlayerRankProbability,
  Suit
} from '../src/types/game';
import { Rank } from '../src/types/game';
import { GuandanAIReasoningEngine } from '../src/utils/aiReasoningEngine';
import { inferCardDistribution } from '../src/utils/cardDistributionInference';
import { analyzeChoiceEvidence } from '../src/utils/choiceInference';
import { calculatePairResponseFlexibility } from '../src/utils/humanReasoning';
import {
  buildInferenceViewModel,
  INFERENCE_VIEW_LIMITS
} from '../src/utils/inferenceViewModel';

const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const currentRank: GameRank = 8;
const cards: Card[] = [];

for (let deck = 0; deck < 2; deck++) {
  for (let rank = 2; rank <= 14; rank++) {
    suits.forEach(suit => cards.push({
      id: `${deck}-${rank}-${suit}`,
      suit,
      rank: rank as GameRank,
      isRankCard: rank === currentRank,
      isWildCard: rank === currentRank && suit === 'hearts',
      isPlayed: false,
      isSelected: false,
      timestamp: 1
    }));
  }
  [Rank.JOKER_SMALL, Rank.JOKER_BIG].forEach(rank => cards.push({
    id: `${deck}-${rank}-joker`,
    suit: null,
    rank,
    isRankCard: false,
    isWildCard: false,
    isPlayed: false,
    isSelected: false,
    timestamp: 1
  }));
}

const positions = ['bottom', 'left', 'top', 'right'] as const;
const players: Player[] = positions.map((position, index) => ({
  id: `player-${position}`,
  name: position,
  position,
  team: index % 2 === 0 ? 1 : 2,
  cards: position === 'bottom' ? cards.slice(0, 27) : [],
  remainingCount: 27,
  isCurrentPlayer: position === 'bottom',
  stats: {
    playedCards: 0,
    rankCardCount: 0,
    wildCardCount: 0,
    roundWins: 0
  }
}));

const gameState: GameState = {
  gameId: 'inference-view-test',
  status: 'playing',
  config: {
    rank: { current: currentRank, next: currentRank, history: [] },
    tributeEnabled: false
  },
  players,
  currentPlayerPosition: 'bottom',
  currentRank,
  allCards: cards,
  playHistory: [],
  currentRound: {
    roundNumber: 1,
    startTime: 1,
    passCount: 0,
    isFinished: false
  },
  createdAt: 1,
  updatedAt: 1
};

const distribution = inferCardDistribution(gameState);
distribution.bombCandidates.forEach(candidate => {
  if (!candidate.exactJointProbability) {
    throw new Error(`点数${candidate.rank}未使用联合分配`);
  }
  const expectedTotal = positions.reduce(
    (total, position) =>
      total + candidate.playerEstimates[position].expectedCount,
    0
  );
  if (Math.abs(expectedTotal - candidate.remainingCopies) > 1e-8) {
    throw new Error(
      `点数${candidate.rank}期望总数冲突：${expectedTotal} != ${candidate.remainingCopies}`
    );
  }
  positions.forEach(position => {
    const probabilityTotal = candidate.playerEstimates[position]
      .probabilityByCount
      .reduce((total, probability) => total + probability, 0);
    if (Math.abs(probabilityTotal - 1) > 1e-8) {
      throw new Error(`点数${candidate.rank}/${position}分布未归一化`);
    }
  });
});

const engine = new GuandanAIReasoningEngine(currentRank);
engine.updateGameData([], currentRank, gameState);
const analysis = engine.performFullAnalysis();
const viewModel = buildInferenceViewModel(
  gameState,
  analysis
);
if (Object.keys(viewModel.knownOwnership).length !== 27) {
  throw new Error('牌面硬事实只能包含当前27张已知手牌');
}
positions.forEach(position => {
  if (
    viewModel.playerChips[position].length >
    INFERENCE_VIEW_LIMITS.maxChipsPerPlayer
  ) {
    throw new Error(`${position}软标签超过界面上限`);
  }
  if (viewModel.playerChips[position].some(chip => chip.label.includes('%'))) {
    throw new Error(`${position}软标签不应显示百分比`);
  }
});
if (positions.some(position => viewModel.playerChips[position].length > 0)) {
  throw new Error('开局无行为证据时不应显示随机先验点数标签');
}

const candidate = analysis.cardDistribution.bombCandidates.find(item =>
  item.playerEstimates.left.minCount !== item.playerEstimates.left.maxCount
);
if (!candidate) throw new Error('缺少可用于证据门槛测试的点数');

const singleCountEstimate = (
  source: PlayerRankProbability,
  probability: number
): PlayerRankProbability => ({
  ...source,
  probabilityByCount: [1 - probability, probability],
  expectedCount: probability,
  mostLikelyCount: probability >= 0.5 ? 1 : 0,
  probabilityAtLeastOne: probability,
  pairProbability: 0,
  tripleProbability: 0,
  bombProbability: 0,
  minCount: 0,
  maxCount: 1
});

const withLeftProbability = (probability: number) => ({
  ...analysis,
  passInferences: [],
  baselineCardDistribution: {
    ...analysis.baselineCardDistribution,
    bombCandidates: [{
      ...candidate,
      playerEstimates: {
        ...candidate.playerEstimates,
        left: singleCountEstimate(candidate.playerEstimates.left, 0.4),
        top: singleCountEstimate(candidate.playerEstimates.top, 0.2),
        right: singleCountEstimate(candidate.playerEstimates.right, 0.2)
      }
    }],
    playerShapes: []
  },
  cardDistribution: {
    ...analysis.cardDistribution,
    bombCandidates: [{
      ...candidate,
      playerEstimates: {
        ...candidate.playerEstimates,
        left: singleCountEstimate(candidate.playerEstimates.left, probability),
        top: singleCountEstimate(candidate.playerEstimates.top, 0.2),
        right: singleCountEstimate(candidate.playerEstimates.right, 0.2)
      }
    }],
    playerShapes: []
  },
  humanReasoning: {
    ...analysis.humanReasoning,
    playerStructures: []
  },
  evidenceLedger: {
    ...analysis.evidenceLedger,
    rankCountEvidence: [{
      id: 'behavior-rank-evidence',
      playerPosition: 'left' as const,
      rank: candidate.rank,
      atLeastCount: 1 as const,
      likelihoodIfPresent: 1.5,
      likelihoodIfAbsent: 0.8,
      source: 'restricted_choice' as const,
      summary: '测试行为证据'
    }]
  }
});

const belowEntry = buildInferenceViewModel(
  gameState,
  withLeftProbability(0.7)
);
if (belowEntry.playerChips.left.length !== 0) {
  throw new Error('低于进入阈值的标签不应出现');
}
const entered = buildInferenceViewModel(
  gameState,
  withLeftProbability(0.73),
  belowEntry
);
if (entered.playerChips.left.length !== 1) {
  throw new Error('超过进入阈值的标签应出现');
}
const retained = buildInferenceViewModel(
  gameState,
  withLeftProbability(0.6),
  entered
);
if (retained.playerChips.left.length !== 1) {
  throw new Error('标签在退出阈值以上应保持，避免临界闪烁');
}
const exited = buildInferenceViewModel(
  gameState,
  withLeftProbability(0.5),
  retained
);
if (exited.playerChips.left.length !== 0) {
  throw new Error('标签跌破退出阈值后应消失');
}

const nextGameState = {
  ...gameState,
  gameId: 'another-game'
};
const crossGame = buildInferenceViewModel(
  nextGameState,
  withLeftProbability(0.6),
  entered
);
if (crossGame.playerChips.left.length !== 0) {
  throw new Error('新牌局不能沿用上一局的较低退出阈值');
}

const pairChoice = {
  id: 'pair-choice',
  actionId: 'pair-response',
  playerPosition: 'left' as const,
  scenario: 'pair_response' as const,
  chosenRank: 12 as GameRank,
  alternativeRanks: [5, 6, 7] as GameRank[],
  equivalentChoiceCount: 4,
  remainingBeforePlay: 20,
  informationWeight: 0.25,
  likelihoodRatio: 1.4,
  alternativeLikelihoodRatios: {},
  summary: '对子选择空间测试'
};
const structureProfile = {
  ...analysis.humanReasoning.playerStructures.find(
    profile => profile.playerPosition === 'left'
  )!,
  pairFlexibility: 0.2
};
const pairChoiceView = buildInferenceViewModel(gameState, {
  ...analysis,
  humanReasoning: {
    ...analysis.humanReasoning,
    playerStructures: [structureProfile],
    choiceEvidence: [pairChoice]
  }
});
if (!pairChoiceView.playerChips.left.some(chip => chip.label === '对选择窄')) {
  throw new Error('对子应对证据应生成保守的“对选择窄”标签');
}
const kickerChoiceView = buildInferenceViewModel(gameState, {
  ...analysis,
  humanReasoning: {
    ...analysis.humanReasoning,
    playerStructures: [structureProfile],
    choiceEvidence: [{
      ...pairChoice,
      id: 'kicker-choice',
      scenario: 'triple_pair_kicker'
    }]
  }
});
if (kickerChoiceView.playerChips.left.some(chip => chip.label === '对选择窄')) {
  throw new Error('三带二附件证据不能生成对子选择标签');
}
const pairOnlyFlexibility = calculatePairResponseFlexibility(
  [pairChoice],
  'left'
);
const mixedFlexibility = calculatePairResponseFlexibility([
  pairChoice,
  ...Array.from({ length: 4 }, (_, index) => ({
    ...pairChoice,
    id: `kicker-${index}`,
    scenario: 'triple_pair_kicker' as const,
    likelihoodRatio: 10
  }))
], 'left');
if (Math.abs(pairOnlyFlexibility - mixedFlexibility) > 1e-12) {
  throw new Error('三带二附件证据污染了对子应对灵活度');
}

const eightCards = cards.filter(card => card.rank === 8);
const bottomKnownEight = eightCards[0];
const leftPlayedEight = { ...eightCards[1], isPlayed: true };
const topPlayedEight = { ...eightCards[2], isPlayed: true };
const ownershipHistory = [{
  id: 'left-played-eight',
  playerPosition: 'left' as const,
  cards: [leftPlayedEight],
  type: 'single' as const,
  timestamp: 20,
  isActivePlay: true
}, {
  id: 'top-played-eight',
  playerPosition: 'top' as const,
  cards: [topPlayedEight],
  type: 'single' as const,
  timestamp: 21,
  isActivePlay: true
}];
const ownershipState: GameState = {
  ...gameState,
  gameId: 'known-hand-ownership-test',
  players: gameState.players.map(player => ({
    ...player,
    cards: player.position === 'bottom' ? [bottomKnownEight] : [],
    remainingCount:
      player.position === 'left' || player.position === 'top' ? 26 : 27
  })),
  allCards: cards.map(card =>
    card.id === leftPlayedEight.id || card.id === topPlayedEight.id
      ? { ...card, isPlayed: true }
      : card
  ),
  playHistory: ownershipHistory,
  currentPlayerPosition: 'right',
  currentRound: {
    ...gameState.currentRound,
    currentMaxPlay: ownershipHistory[1],
    passCount: 0
  }
};
const ownershipEngine = new GuandanAIReasoningEngine(currentRank);
ownershipEngine.updateGameData(
  ownershipHistory,
  currentRank,
  ownershipState
);
const ownershipAnalysis = ownershipEngine.performFullAnalysis();
const ownershipClue = ownershipAnalysis.humanReasoning.ownershipClues.find(
  clue => clue.rank === 8 && clue.suspectedOwner === 'right'
);
if (!ownershipClue) {
  throw new Error('我的已知8与下家/对家已出8应形成上家归属线索');
}
const ownershipView = buildInferenceViewModel(
  ownershipState,
  ownershipAnalysis
);
if (!ownershipView.playerChips.right.some(chip => chip.label === '8×5?')) {
  throw new Error('我有1张未出8且两家出过8后，上家名下应显示剩余8×5?');
}
const inferredEightCards = Object.values(ownershipView.inferredOwnership)
  .filter(inference =>
    inference.rank === 8 && inference.suspectedOwner === 'right'
  );
if (inferredEightCards.length !== 5) {
  throw new Error('上家的8×5?应同步生成5个红色实体牌面推理标记');
}

const nineCards = cards.filter(card => card.rank === 9);
const noSelfNineHistory = [{
  id: 'left-played-nine',
  playerPosition: 'left' as const,
  cards: [{ ...nineCards[0], isPlayed: true }],
  type: 'single' as const,
  timestamp: 30,
  isActivePlay: true
}, {
  id: 'top-played-nine',
  playerPosition: 'top' as const,
  cards: [{ ...nineCards[1], isPlayed: true }],
  type: 'single' as const,
  timestamp: 31,
  isActivePlay: true
}];
const completeHandWithoutNine = cards
  .filter(card => card.rank !== 9)
  .slice(0, 27);
const noSelfNineState: GameState = {
  ...gameState,
  gameId: 'complete-hand-without-nine-test',
  players: gameState.players.map(player => ({
    ...player,
    cards: player.position === 'bottom' ? completeHandWithoutNine : [],
    remainingCount:
      player.position === 'left' || player.position === 'top' ? 26 : 27
  })),
  allCards: cards.map(card =>
    card.id === nineCards[0].id || card.id === nineCards[1].id
      ? { ...card, isPlayed: true }
      : card
  ),
  playHistory: noSelfNineHistory,
  currentPlayerPosition: 'right',
  currentRound: {
    ...gameState.currentRound,
    currentMaxPlay: noSelfNineHistory[1],
    passCount: 0
  }
};
const noSelfNineEngine = new GuandanAIReasoningEngine(currentRank);
noSelfNineEngine.updateGameData(
  noSelfNineHistory,
  currentRank,
  noSelfNineState
);
const noSelfNineAnalysis = noSelfNineEngine.performFullAnalysis();
const noSelfNineClue = noSelfNineAnalysis.humanReasoning.ownershipClues.find(
  clue => clue.rank === 9 && clue.suspectedOwner === 'right'
);
if (!noSelfNineClue || noSelfNineClue.inferredCount !== 6) {
  throw new Error('完整手牌确认我没有9且两家出过9后，应把剩余6张推给上家');
}
const noSelfNineView = buildInferenceViewModel(
  noSelfNineState,
  noSelfNineAnalysis
);
if (!noSelfNineView.playerChips.right.some(chip => chip.label === '9×6?')) {
  throw new Error('我没有9且两家出过9后，上家名下应显示9×6?');
}
if (Object.values(noSelfNineView.inferredOwnership).filter(inference =>
  inference.rank === 9 && inference.suspectedOwner === 'right'
).length !== 6) {
  throw new Error('9×6?应同步生成6个红色实体牌面推理标记');
}

const incompleteNoNineState: GameState = {
  ...noSelfNineState,
  gameId: 'incomplete-hand-without-nine-test',
  players: noSelfNineState.players.map(player => ({
    ...player,
    cards: player.position === 'bottom'
      ? completeHandWithoutNine.slice(0, 26)
      : player.cards
  }))
};
const incompleteNoNineEngine = new GuandanAIReasoningEngine(currentRank);
incompleteNoNineEngine.updateGameData(
  noSelfNineHistory,
  currentRank,
  incompleteNoNineState
);
if (incompleteNoNineEngine.performFullAnalysis().humanReasoning.ownershipClues
  .some(clue => clue.rank === 9 && clue.suspectedOwner === 'right')) {
  throw new Error('手牌未完整录入27张时，不能把“没有9”作为排除证据');
}

const threePlayersNineHistory = [
  {
    id: 'bottom-played-nine',
    playerPosition: 'bottom' as const,
    cards: [{ ...nineCards[2], isPlayed: true }],
    type: 'single' as const,
    timestamp: 29,
    isActivePlay: true
  },
  ...noSelfNineHistory
];
const threePlayersNineState: GameState = {
  ...noSelfNineState,
  gameId: 'three-players-played-nine-test',
  players: noSelfNineState.players.map(player => ({
    ...player,
    cards: player.position === 'bottom'
      ? [nineCards[2], ...completeHandWithoutNine.slice(0, 26)]
      : player.cards,
    remainingCount: player.position === 'bottom'
      ? 26
      : player.remainingCount
  })),
  allCards: noSelfNineState.allCards.map(card =>
    card.id === nineCards[2].id ? { ...card, isPlayed: true } : card
  ),
  playHistory: threePlayersNineHistory
};
const threePlayersNineEngine = new GuandanAIReasoningEngine(currentRank);
threePlayersNineEngine.updateGameData(
  threePlayersNineHistory,
  currentRank,
  threePlayersNineState
);
const threePlayersNineAnalysis = threePlayersNineEngine.performFullAnalysis();
const threePlayersNineClue = threePlayersNineAnalysis.humanReasoning
  .ownershipClues.find(clue => clue.rank === 9 && clue.suspectedOwner === 'right');
if (!threePlayersNineClue || threePlayersNineClue.inferredCount !== 5) {
  throw new Error('三家都出过9后，应将未出的5张9全部推给上家');
}

const pairCards = (rank: GameRank) => cards
  .filter(card => card.rank === rank)
  .slice(0, 2);
const pairChoiceState: GameState = {
  ...gameState,
  currentRank: 2,
  config: {
    ...gameState.config,
    rank: { current: 2, next: 2, history: [] }
  },
  playHistory: [{
    id: 'lead-44',
    playerPosition: 'bottom',
    cards: pairCards(4),
    type: 'pair',
    timestamp: 10,
    isActivePlay: true
  }, {
    id: 'response-qq',
    playerPosition: 'left',
    cards: pairCards(12),
    type: 'pair',
    timestamp: 11,
    isActivePlay: true
  }]
};
const widePairEvidence = analyzeChoiceEvidence(pairChoiceState)
  .find(evidence => evidence.actionId === 'response-qq');
if (
  !widePairEvidence ||
  widePairEvidence.scenario !== 'pair_response' ||
  widePairEvidence.summary.includes('小对子少')
) {
  throw new Error('44→QQ 在完整成本枚举前只能形成保守的对子选择证据');
}

const currentLead = pairChoiceState.playHistory[0];
const currentPassAnalysis = {
  ...analysis,
  passInferences: [{
    id: 'pass-current',
    playerPosition: 'left' as const,
    leadPlayerPosition: 'bottom' as const,
    leadType: 'pair' as const,
    leadDisplay: '4 4',
    candidateRankCounts: [],
    evidenceCount: 1,
    confidence: 0.7,
    status: 'active' as const,
    summary: '本轮对子受限',
    lastTimestamp: 12
  }],
  humanReasoning: {
    ...analysis.humanReasoning,
    playerStructures: [],
    choiceEvidence: []
  }
};
const activePassView = buildInferenceViewModel({
  ...gameState,
  currentRound: {
    ...gameState.currentRound,
    currentMaxPlay: currentLead,
    passCount: 1
  }
}, currentPassAnalysis);
if (!activePassView.playerChips.left.some(chip => chip.label === '对受限')) {
  throw new Error('当前轮过牌证据应显示“对受限”');
}
const expiredPassView = buildInferenceViewModel({
  ...gameState,
  currentRound: {
    ...gameState.currentRound,
    currentMaxPlay: undefined,
    passCount: 0
  }
}, currentPassAnalysis, activePassView);
if (expiredPassView.playerChips.left.some(chip => chip.label === '对受限')) {
  throw new Error('本轮结束后“对受限”必须消失');
}

console.log(JSON.stringify({
  status: 'ok',
  ranksChecked: distribution.bombCandidates.length,
  knownFacts: Object.keys(viewModel.knownOwnership).length,
  maxChipsPerPlayer: INFERENCE_VIEW_LIMITS.maxChipsPerPlayer,
  hysteresis: '0.72进入/0.58退出',
  openingPriorChips: 0,
  crossGameReset: true,
  passExpiry: true,
  pairChoiceLabel: '对选择窄',
  knownHandOwnershipClue: ownershipClue.summary,
  inferredCardOverlay: '上家8×5? / 我无9时上家9×6?',
  threePlayersPlayed: '三家出9后上家9×5?',
  incompleteHandGuard: true,
  kickerIsolation: true,
  rule: '硬事实上牌面，软推断挂人名下且联合分配守恒'
}, null, 2));
