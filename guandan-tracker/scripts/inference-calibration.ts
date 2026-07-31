import type {
  Card,
  GameRank,
  GameState,
  PlayRecord,
  Player,
  PlayerPosition,
  PlayType,
  Rank,
  Suit
} from '../src/types/game';
import { GameStatus, Rank as RankValue } from '../src/types/game';
import { GuandanAIReasoningEngine } from '../src/utils/aiReasoningEngine';
import { inferCardDistribution } from '../src/utils/cardDistributionInference';
import { inferEndgameHands } from '../src/utils/endgameCsp';
import {
  buildThreatLevels,
  decideBeatResponse
} from '../src/utils/decisionPolicy';
import { PASS_EVIDENCE_CONFIG } from '../src/utils/inferenceConstants';
import {
  evaluateCalibration,
  type CalibrationSample
} from '../src/utils/inferenceCalibration';

interface CardGroupSpec {
  rank: Rank;
  count: number;
  preferWild?: boolean;
}

interface ActionSpec {
  player: PlayerPosition;
  type: PlayType;
  cards: CardGroupSpec[];
}

interface RecordedFixture {
  name: string;
  currentRank: GameRank;
  allCards: Card[];
  actions: PlayRecord[];
  completePositions: PlayerPosition[];
  revealedCards: Partial<Record<PlayerPosition, Card[]>>;
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const STANDARD_RANKS: GameRank[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14
];

const createDeck = (currentRank: GameRank): Card[] => {
  const cards: Card[] = [];
  for (let deck = 0; deck < 2; deck++) {
    STANDARD_RANKS.forEach(rank => {
      SUITS.forEach(suit => {
        cards.push({
          id: `${deck}-${suit}-${rank}`,
          suit,
          rank,
          isRankCard: rank === currentRank,
          isWildCard: rank === currentRank && suit === 'hearts',
          isPlayed: false,
          isSelected: false,
          timestamp: 0
        });
      });
    });
    [RankValue.JOKER_SMALL, RankValue.JOKER_BIG].forEach(rank => {
      cards.push({
        id: `${deck}-joker-${rank}`,
        suit: null,
        rank,
        isRankCard: false,
        isWildCard: false,
        isPlayed: false,
        isSelected: false,
        timestamp: 0
      });
    });
  }
  return cards;
};

const buildFixture = (
  name: string,
  currentRank: GameRank,
  specs: ActionSpec[],
  completePositions: PlayerPosition[],
  revealedSelectors: Array<{
    position: PlayerPosition;
    actionIndex: number;
    cardIndex: number;
  }> = []
): RecordedFixture => {
  const allCards = createDeck(currentRank);
  const availableIds = new Set(allCards.map(card => card.id));
  const takeCards = (group: CardGroupSpec): Card[] => {
    const candidates = allCards
      .filter(card =>
        card.rank === group.rank && availableIds.has(card.id)
      )
      .sort((left, right) => {
        if (group.preferWild) {
          return Number(right.isWildCard) - Number(left.isWildCard);
        }
        return Number(left.isWildCard) - Number(right.isWildCard);
      })
      .slice(0, group.count);
    if (candidates.length !== group.count) {
      throw new Error(
        `${name}: ${group.rank}需要${group.count}张，只剩${candidates.length}张`
      );
    }
    candidates.forEach(card => availableIds.delete(card.id));
    return candidates;
  };
  const rawActions = specs.map((spec, index): PlayRecord => ({
    id: `${name}-play-${index}`,
    playerPosition: spec.player,
    cards: spec.cards.flatMap(takeCards),
    type: spec.type,
    timestamp: index * 10 + 1,
    isActivePlay: true
  }));
  const actions: PlayRecord[] = [];
  let activeLead: PlayRecord | null = null;
  let syntheticPassIndex = 0;
  rawActions.forEach(record => {
    const comparablePairResponse =
      activeLead?.type === 'pair' &&
      record.type === 'pair' &&
      record.cards[0].rank > activeLead.cards[0].rank;
    const comparableSingleResponse =
      activeLead?.type === 'single' &&
      record.type === 'single' &&
      record.cards[0].rank > activeLead.cards[0].rank;
    if (activeLead && !comparablePairResponse && !comparableSingleResponse) {
      (['left', 'top', 'right'] as PlayerPosition[]).forEach(position => {
        actions.push({
          id: `${name}-synthetic-pass-${syntheticPassIndex++}`,
          playerPosition: position,
          cards: [],
          type: 'pass',
          timestamp: actions.length * 10,
          isActivePlay: false,
          description: '校准夹具：原记录省略过牌，按不构成合法连续压牌重置牌墩'
        });
      });
      activeLead = null;
    }
    actions.push(record);
    activeLead = record;
  });
  const revealedCards = revealedSelectors.reduce((byPlayer, selector) => {
    const selected = rawActions[selector.actionIndex]?.cards[selector.cardIndex];
    if (!selected) throw new Error(`${name}: 明牌选择器无效`);
    byPlayer[selector.position] = [
      ...(byPlayer[selector.position] ?? []),
      selected
    ];
    return byPlayer;
  }, {} as Partial<Record<PlayerPosition, Card[]>>);

  completePositions.forEach(position => {
    const count = rawActions
      .filter(record => record.playerPosition === position)
      .reduce((total, record) => total + record.cards.length, 0);
    if (count !== 27) {
      throw new Error(`${name}: ${position}完整手牌应为27张，实际${count}张`);
    }
  });

  return {
    name,
    currentRank,
    allCards,
    actions,
    completePositions,
    revealedCards
  };
};

const groups = (
  ...items: Array<[Rank, number, boolean?]>
): CardGroupSpec[] => items.map(([rank, count, preferWild]) => ({
  rank,
  count,
  preferWild
}));

const firstGame = buildFixture(
  '第一局-打8',
  8,
  [
    { player: 'right', type: 'pair', cards: groups([2, 2]) },
    { player: 'bottom', type: 'pair', cards: groups([7, 2]) },
    { player: 'right', type: 'pair', cards: groups([10, 2]) },
    { player: 'bottom', type: 'pair', cards: groups([11, 2]) },
    { player: 'right', type: 'pair', cards: groups([13, 2]) },
    { player: 'top', type: 'pair', cards: groups([8, 2]) },
    { player: 'top', type: 'single', cards: groups([9, 1]) },
    { player: 'right', type: 'single', cards: groups([11, 1]) },
    { player: 'bottom', type: 'single', cards: groups([13, 1]) },
    { player: 'right', type: 'single', cards: groups([14, 1]) },
    { player: 'bottom', type: 'single', cards: groups([8, 1]) },
    { player: 'right', type: 'bomb_four', cards: groups([4, 4]) },
    { player: 'bottom', type: 'bomb_four', cards: groups([5, 4]) },
    { player: 'left', type: 'bomb_four', cards: groups([9, 4]) },
    { player: 'left', type: 'triple_straight', cards: groups([2, 3], [3, 3]) },
    { player: 'top', type: 'triple_straight', cards: groups([10, 3], [11, 3]) },
    { player: 'top', type: 'single', cards: groups([12, 1]) },
    { player: 'bottom', type: 'single', cards: groups([15, 1]) },
    { player: 'bottom', type: 'triple_with_pair', cards: groups([6, 2], [4, 3]) },
    { player: 'top', type: 'triple_with_pair', cards: groups([7, 3], [6, 2]) },
    { player: 'right', type: 'bomb_four', cards: groups([6, 4]) },
    { player: 'right', type: 'pair', cards: groups([7, 2]) },
    { player: 'top', type: 'pair', cards: groups([13, 2]) },
    { player: 'right', type: 'pair', cards: groups([8, 2]) },
    { player: 'top', type: 'pair', cards: groups([16, 2]) },
    { player: 'top', type: 'single', cards: groups([14, 1]) },
    { player: 'bottom', type: 'single', cards: groups([15, 1]) },
    { player: 'right', type: 'straight_flush', cards: groups([8, 1, true], [9, 1], [10, 1], [11, 1], [12, 1]) },
    { player: 'bottom', type: 'straight', cards: groups([10, 1], [11, 1], [12, 1], [13, 1], [8, 1, true]) },
    { player: 'left', type: 'bomb_six', cards: groups([14, 6]) },
    { player: 'left', type: 'pair', cards: groups([5, 2]) },
    { player: 'top', type: 'bomb_four', cards: groups([3, 4]) },
    { player: 'top', type: 'triple', cards: groups([2, 3]) },
    { player: 'bottom', type: 'triple', cards: groups([12, 3]) },
    { player: 'bottom', type: 'pair', cards: groups([9, 2]) }
  ],
  ['bottom', 'top']
);

const secondGame = buildFixture(
  '第二局-打J',
  11,
  [
    { player: 'top', type: 'triple_straight', cards: groups([3, 3], [4, 3]) },
    { player: 'top', type: 'single', cards: groups([2, 1]) },
    { player: 'right', type: 'single', cards: groups([10, 1]) },
    { player: 'top', type: 'single', cards: groups([13, 1]) },
    { player: 'right', type: 'single', cards: groups([11, 1]) },
    { player: 'bottom', type: 'single', cards: groups([15, 1]) },
    { player: 'right', type: 'single', cards: groups([16, 1]) },
    { player: 'right', type: 'pair_straight', cards: groups([7, 2], [8, 2], [9, 2]) },
    { player: 'right', type: 'single', cards: groups([3, 1]) },
    { player: 'bottom', type: 'single', cards: groups([8, 1]) },
    { player: 'left', type: 'single', cards: groups([10, 1]) },
    { player: 'top', type: 'single', cards: groups([14, 1]) },
    { player: 'right', type: 'single', cards: groups([15, 1]) },
    { player: 'bottom', type: 'bomb_four', cards: groups([13, 4]) },
    { player: 'right', type: 'bomb_four', cards: groups([14, 4]) },
    { player: 'right', type: 'straight', cards: groups([4, 1], [5, 1], [6, 1], [7, 1], [8, 1]) },
    { player: 'top', type: 'bomb_four', cards: groups([5, 4]) },
    { player: 'top', type: 'pair', cards: groups([8, 2]) },
    { player: 'bottom', type: 'pair', cards: groups([12, 2]) },
    { player: 'left', type: 'pair', cards: groups([13, 2]) },
    { player: 'bottom', type: 'pair', cards: groups([11, 2]) },
    { player: 'left', type: 'bomb_four', cards: groups([6, 4]) },
    { player: 'top', type: 'bomb_four', cards: groups([9, 4]) },
    { player: 'top', type: 'pair', cards: groups([12, 2]) },
    { player: 'top', type: 'single', cards: groups([7, 1]) },
    { player: 'right', type: 'single', cards: groups([13, 1]) },
    { player: 'left', type: 'single', cards: groups([11, 1]) },
    { player: 'left', type: 'straight', cards: groups([8, 1], [9, 1], [10, 1], [11, 1], [12, 1]) },
    { player: 'top', type: 'bomb_four', cards: groups([10, 4]) },
    { player: 'right', type: 'bomb_four', cards: groups([12, 3], [11, 1, true]) },
    { player: 'bottom', type: 'bomb_six', cards: groups([2, 6]) },
    { player: 'bottom', type: 'triple_with_pair', cards: groups([7, 3], [4, 2]) },
    // 原记录的9总数达到9张；按一张红心J配作9还原实体牌。
    { player: 'left', type: 'straight_flush', cards: groups([6, 1], [7, 1], [8, 1], [11, 1, true], [10, 1]) },
    { player: 'left', type: 'pair', cards: groups([3, 2]) },
    { player: 'bottom', type: 'pair', cards: groups([6, 2]) },
    { player: 'bottom', type: 'triple', cards: groups([14, 3]) },
    { player: 'bottom', type: 'single', cards: groups([9, 1]) },
    { player: 'left', type: 'single', cards: groups([16, 1]) },
    { player: 'left', type: 'triple_with_pair', cards: groups([5, 3], [4, 2]) },
    { player: 'left', type: 'single', cards: groups([2, 1]) },
    { player: 'top', type: 'single', cards: groups([11, 1]) }
  ],
  ['bottom', 'left', 'top'],
  [
    { position: 'right', actionIndex: 6, cardIndex: 0 },
    { position: 'left', actionIndex: 37, cardIndex: 0 }
  ]
);

const buildState = (
  fixture: RecordedFixture,
  history: PlayRecord[]
): GameState => {
  const playedCount = (position: PlayerPosition): number =>
    history
      .filter(record => record.playerPosition === position)
      .reduce((total, record) => total + record.cards.length, 0);
  const fullOwnHand = fixture.actions
    .filter(record => record.playerPosition === 'bottom')
    .flatMap(record => record.cards);
  const playerDefinitions: Array<{
    position: PlayerPosition;
    name: string;
    team: 1 | 2;
  }> = [
    { position: 'bottom', name: '我', team: 1 },
    { position: 'left', name: '下家', team: 2 },
    { position: 'top', name: '对家', team: 1 },
    { position: 'right', name: '上家', team: 2 }
  ];
  const players: Player[] = playerDefinitions.map(definition => {
    const cards = definition.position === 'bottom'
      ? fullOwnHand
      : fixture.revealedCards[definition.position] ?? [];
    return {
      id: definition.position,
      name: definition.name,
      position: definition.position,
      team: definition.team,
      cards,
      remainingCount: Math.max(0, 27 - playedCount(definition.position)),
      isCurrentPlayer: false,
      stats: {
        playedCards: playedCount(definition.position),
        rankCardCount: cards.filter(card =>
          card.rank === fixture.currentRank
        ).length,
        wildCardCount: cards.filter(card => card.isWildCard).length,
        roundWins: 0
      }
    };
  });

  return {
    gameId: fixture.name,
    status: GameStatus.PLAYING,
    config: {
      rank: {
        current: fixture.currentRank,
        next: fixture.currentRank,
        history: []
      },
      tributeEnabled: false
    },
    players,
    currentPlayerPosition: 'bottom',
    currentRank: fixture.currentRank,
    allCards: fixture.allCards,
    playHistory: history,
    currentRound: {
      roundNumber: 1,
      startTime: 1,
      currentMaxPlay: [...history].reverse().find(record =>
        record.type !== 'pass'
      ),
      passCount: 0,
      isFinished: false
    },
    createdAt: 1,
    updatedAt: history.length + 1
  };
};

const getCheckpoints = (fixture: RecordedFixture): number[] => [
  0,
  ...fixture.actions.flatMap((record, index) =>
    record.type === 'pass' ? [] : [index + 1]
  )
];

const collectSamples = (
  fixture: RecordedFixture
): {
  base: CalibrationSample[];
  choiceOnly: CalibrationSample[];
  passOnly: CalibrationSample[];
  fused: CalibrationSample[];
  evidenceCount: number;
  endgameChecks: number;
  evidenceSummaries: string[];
} => {
  const base: CalibrationSample[] = [];
  const choiceOnly: CalibrationSample[] = [];
  const passOnly: CalibrationSample[] = [];
  const fused: CalibrationSample[] = [];
  let evidenceCount = 0;
  let endgameChecks = 0;
  const evidenceSummaries = new Set<string>();

  getCheckpoints(fixture).forEach(prefixLength => {
    const history = fixture.actions.slice(0, prefixLength);
    const state = buildState(fixture, history);
    const baseDistribution = inferCardDistribution(state);
    const engine = new GuandanAIReasoningEngine(fixture.currentRank);
    engine.updateGameData(history, fixture.currentRank, state);
    const analysis = engine.performFullAnalysis();
    const choiceOnlyDistribution = inferCardDistribution(
      state,
      analysis.evidenceLedger.rankCountEvidence.filter(
        evidence => evidence.source === 'restricted_choice'
      )
    );
    const passOnlyDistribution = inferCardDistribution(
      state,
      analysis.evidenceLedger.rankCountEvidence.filter(
        evidence => evidence.source === 'pass'
      )
    );
    evidenceCount = Math.max(
      evidenceCount,
      analysis.cardDistribution.appliedEvidenceCount
    );
    analysis.evidenceLedger.choiceEvidence.forEach(observation => {
      evidenceSummaries.add(observation.summary);
    });
    endgameChecks += analysis.endgameInference.players.length;

    fixture.completePositions
      .filter(position => position !== 'bottom')
      .forEach(position => {
        const actualRemaining = fixture.actions
          .slice(prefixLength)
          .filter(record => record.playerPosition === position)
          .flatMap(record => record.cards);
        if (actualRemaining.length === 0) return;
        STANDARD_RANKS.forEach(rank => {
          const actualCount = actualRemaining.filter(
            card => card.rank === rank
          ).length;
          const baseEstimate = baseDistribution.bombCandidates
            .find(candidate => candidate.rank === rank)!
            .playerEstimates[position];
          const fusedEstimate = analysis.cardDistribution.bombCandidates
            .find(candidate => candidate.rank === rank)!
            .playerEstimates[position];
          const choiceOnlyEstimate =
            choiceOnlyDistribution.bombCandidates
              .find(candidate => candidate.rank === rank)!
              .playerEstimates[position];
          const passOnlyEstimate =
            passOnlyDistribution.bombCandidates
              .find(candidate => candidate.rank === rank)!
              .playerEstimates[position];
          const thresholds: Array<{
            count: 1 | 2 | 3 | 4;
            baseProbability: number;
            choiceOnlyProbability: number;
            passOnlyProbability: number;
            fusedProbability: number;
          }> = [
            {
              count: 1,
              baseProbability: baseEstimate.probabilityAtLeastOne,
              choiceOnlyProbability:
                choiceOnlyEstimate.probabilityAtLeastOne,
              passOnlyProbability:
                passOnlyEstimate.probabilityAtLeastOne,
              fusedProbability: fusedEstimate.probabilityAtLeastOne
            },
            {
              count: 2,
              baseProbability: baseEstimate.pairProbability,
              choiceOnlyProbability: choiceOnlyEstimate.pairProbability,
              passOnlyProbability: passOnlyEstimate.pairProbability,
              fusedProbability: fusedEstimate.pairProbability
            },
            {
              count: 3,
              baseProbability: baseEstimate.tripleProbability,
              choiceOnlyProbability: choiceOnlyEstimate.tripleProbability,
              passOnlyProbability: passOnlyEstimate.tripleProbability,
              fusedProbability: fusedEstimate.tripleProbability
            },
            {
              count: 4,
              baseProbability: baseEstimate.bombProbability,
              choiceOnlyProbability: choiceOnlyEstimate.bombProbability,
              passOnlyProbability: passOnlyEstimate.bombProbability,
              fusedProbability: fusedEstimate.bombProbability
            }
          ];
          thresholds.forEach(item => {
            const outcome: 0 | 1 = actualCount >= item.count ? 1 : 0;
            const label = `${fixture.name}:${prefixLength}:${position}:${rank}>=${item.count}`;
            base.push({
              probability: item.baseProbability,
              outcome,
              label
            });
            choiceOnly.push({
              probability: item.choiceOnlyProbability,
              outcome,
              label
            });
            passOnly.push({
              probability: item.passOnlyProbability,
              outcome,
              label
            });
            fused.push({
              probability: item.fusedProbability,
              outcome,
              label
            });
          });
        });
      });
  });

  return {
    base,
    choiceOnly,
    passOnly,
    fused,
    evidenceCount,
    endgameChecks,
    evidenceSummaries: [...evidenceSummaries]
  };
};

const fixtures = [firstGame, secondGame];
const results = fixtures.map(fixture => ({
  fixture: fixture.name,
  ...collectSamples(fixture)
}));
const hardFactBaseState = buildState(firstGame, []);
const hardFactCard = firstGame.actions.find(record =>
  record.playerPosition === 'top' &&
  record.type !== 'pass' &&
  record.cards.length > 0
)!.cards[0];
const hardFactRevealedState: GameState = {
  ...hardFactBaseState,
  players: hardFactBaseState.players.map(player =>
    player.position === 'top'
      ? { ...player, cards: [...player.cards, hardFactCard] }
      : player
  )
};
const hardFactBaseDistribution = inferCardDistribution(hardFactBaseState);
const hardFactRevealedDistribution = inferCardDistribution(
  hardFactRevealedState
);
const hardFactTargetRank: GameRank = 14;
const hardFactBaseProbability = hardFactBaseDistribution.bombCandidates
  .find(candidate => candidate.rank === hardFactTargetRank)!
  .playerEstimates.right.probabilityAtLeastOne;
const hardFactRevealedProbability = hardFactRevealedDistribution.bombCandidates
  .find(candidate => candidate.rank === hardFactTargetRank)!
  .playerEstimates.right.probabilityAtLeastOne;
const hardFactCrossRankDelta =
  hardFactRevealedProbability - hardFactBaseProbability;
const cspKnownCards = firstGame.allCards
  .filter(card => card.rank === 14)
  .slice(0, 2);
const cspState: GameState = {
  ...hardFactBaseState,
  players: hardFactBaseState.players.map(player =>
    player.position === 'top'
      ? {
        ...player,
        remainingCount: 3,
        cards: cspKnownCards
      }
      : player
  )
};
const cspCheck = inferEndgameHands(cspState, {
  knownCardFactCount: cspKnownCards.length,
  rankCountEvidence: [],
  choiceEvidence: [],
  summary: '校准夹具'
}).players.find(player => player.playerPosition === 'top');

const passLeadCards = firstGame.allCards
  .filter(card => card.rank === 7 && !card.isWildCard)
  .slice(0, 2);
const laterBeatCards = firstGame.allCards
  .filter(card => card.rank === 9 && !card.isWildCard)
  .slice(0, 2);
const passLead: PlayRecord = {
  id: 'pass-pipeline-lead',
  playerPosition: 'bottom',
  cards: passLeadCards,
  type: 'pair',
  timestamp: 1,
  isActivePlay: true
};
const makePass = (
  id: string,
  playerPosition: PlayerPosition,
  timestamp: number
): PlayRecord => ({
  id,
  playerPosition,
  cards: [],
  type: 'pass',
  timestamp,
  isActivePlay: false
});
const analyzeHistory = (history: PlayRecord[]) => {
  const state = buildState(firstGame, history);
  const engine = new GuandanAIReasoningEngine(firstGame.currentRank);
  engine.updateGameData(history, firstGame.currentRank, state);
  return engine.performFullAnalysis();
};
const activePassAnalysis = analyzeHistory([
  passLead,
  makePass('pass-pipeline-left-1', 'left', 2),
  makePass('pass-pipeline-left-2', 'left', 3)
]);
const activePassEvidence =
  activePassAnalysis.evidenceLedger.rankCountEvidence.filter(
    evidence => evidence.source === 'pass'
  );
const contradictedPassAnalysis = analyzeHistory([
  passLead,
  makePass('pass-pipeline-left-1', 'left', 2),
  makePass('pass-pipeline-left-2', 'left', 3),
  {
    id: 'pass-pipeline-later-beat',
    playerPosition: 'left',
    cards: laterBeatCards,
    type: 'pair',
    timestamp: 4,
    isActivePlay: true
  }
]);
const teammatePassAnalysis = analyzeHistory([
  passLead,
  makePass('pass-pipeline-top-1', 'top', 2),
  makePass('pass-pipeline-top-2', 'top', 3)
]);
const passGroupLikelihood = activePassEvidence.reduce(
  (likelihood, evidence) =>
    likelihood * evidence.likelihoodIfPresent,
  1
);
if (activePassEvidence.length === 0) {
  throw new Error('重复对手过牌没有产生保守点数证据');
}
if (activePassEvidence.some(evidence =>
  evidence.likelihoodIfPresent >= evidence.likelihoodIfAbsent
)) {
  throw new Error('过牌证据方向错误：应降低可直接管牌点数的后验');
}
if (
  passGroupLikelihood <
    PASS_EVIDENCE_CONFIG.likelihoodAtMaximumConfidence - 1e-12 ||
  passGroupLikelihood >
    PASS_EVIDENCE_CONFIG.likelihoodAtMinimumConfidence + 1e-12
) {
  throw new Error(`过牌组似然未受限：${passGroupLikelihood}`);
}
if (contradictedPassAnalysis.evidenceLedger.rankCountEvidence.some(
  evidence => evidence.source === 'pass'
)) {
  throw new Error('后续展示可管牌后，旧过牌证据没有撤销');
}
if (teammatePassAnalysis.evidenceLedger.rankCountEvidence.some(
  evidence => evidence.source === 'pass'
)) {
  throw new Error('队友配合过牌不应进入点数后验');
}
if (
  activePassAnalysis.threatLevels.top.role !== 'teammate' ||
  activePassAnalysis.threatLevels.left.role !== 'opponent'
) {
  throw new Error('威胁等级没有区分队友和对手');
}

const buildBombPosteriorFixture = (leftBombProbability: number) => ({
  ...hardFactBaseDistribution,
  bombCandidates: hardFactBaseDistribution.bombCandidates.map(
    (candidate, index) => ({
      ...candidate,
      playerEstimates: {
        bottom: {
          ...candidate.playerEstimates.bottom,
          bombProbability: 0
        },
        left: {
          ...candidate.playerEstimates.left,
          bombProbability: index === 0 ? leftBombProbability : 0
        },
        top: {
          ...candidate.playerEstimates.top,
          bombProbability: 0
        },
        right: {
          ...candidate.playerEstimates.right,
          bombProbability: 0
        }
      }
    })
  )
});
const lowBombThreats = buildThreatLevels(
  hardFactBaseState.players,
  buildBombPosteriorFixture(0)
);
const highBombThreats = buildThreatLevels(
  hardFactBaseState.players,
  buildBombPosteriorFixture(0.9)
);
if (
  highBombThreats.left.score <= lowBombThreats.left.score ||
  highBombThreats.top.score !== lowBombThreats.top.score ||
  !highBombThreats.left.reasoning.some(reason =>
    reason.includes('当前炸弹后验峰值约90%')
  )
) {
  throw new Error('威胁等级未严格使用对应玩家的当前炸弹后验');
}

const powerSolution = {
  cards: passLeadCards,
  cardType: {
    type: 'bomb' as const,
    description: '四张炸弹',
    isValid: true
  },
  display: '7777',
  usesPowerPlay: true,
  breaksKnownBomb: false
};
const lowThreatDecision = decideBeatResponse({
  currentPlayerPosition: 'bottom',
  currentPlayerRemainingCount: 20,
  leadPlayerPosition: 'left',
  responseSolution: powerSolution,
  hasCompleteCurrentHand: true,
  knownPlayableCount: 20,
  leadThreat: {
    level: 'low',
    score: 0.2,
    role: 'opponent',
    reasoning: []
  }
});
const criticalThreatDecision = decideBeatResponse({
  currentPlayerPosition: 'bottom',
  currentPlayerRemainingCount: 20,
  leadPlayerPosition: 'left',
  responseSolution: powerSolution,
  hasCompleteCurrentHand: true,
  knownPlayableCount: 20,
  leadThreat: {
    level: 'critical',
    score: 0.9,
    role: 'opponent',
    reasoning: []
  }
});
if (
  lowThreatDecision.action !== 'pass' ||
  criticalThreatDecision.action !== 'play'
) {
  throw new Error('强牌资源决策未随对手威胁从“让”切换为“堵”');
}

const allBase = results.flatMap(result => result.base);
const allChoiceOnly = results.flatMap(result => result.choiceOnly);
const allPassOnly = results.flatMap(result => result.passOnly);
const allFused = results.flatMap(result => result.fused);
const baseReport = evaluateCalibration(allBase);
const choiceOnlyReport = evaluateCalibration(allChoiceOnly);
const passOnlyReport = evaluateCalibration(allPassOnly);
const fusedReport = evaluateCalibration(allFused);
const maximumEvidenceCount = Math.max(
  ...results.map(result => result.evidenceCount)
);
const endgameChecks = results.reduce(
  (total, result) => total + result.endgameChecks,
  0
);

if (baseReport.sampleCount === 0 || fusedReport.sampleCount === 0) {
  throw new Error('校准样本为空');
}
if (!Number.isFinite(baseReport.brierScore) ||
    !Number.isFinite(choiceOnlyReport.brierScore) ||
    !Number.isFinite(passOnlyReport.brierScore) ||
    !Number.isFinite(fusedReport.brierScore)) {
  throw new Error('校准分数无效');
}
if (endgameChecks === 0) {
  throw new Error('残局枚举分支没有触发');
}
if (fusedReport.brierScore > baseReport.brierScore + 1e-12) {
  throw new Error(
    `融合后Brier退化：${baseReport.brierScore} -> ${fusedReport.brierScore}`
  );
}
if (Math.abs(hardFactCrossRankDelta) <= 1e-12) {
  throw new Error('新增明牌没有改变其它点数的后验，硬事实未反哺未知池');
}
if (!cspCheck ||
    !cspCheck.lockedCards.some(item =>
      item.rank === 14 && item.count === 2
    ) ||
    cspCheck.topCandidates.length === 0) {
  throw new Error('残局CSP没有保留已知AA并枚举最后一张');
}

console.log(JSON.stringify({
  fixtures: results.map(result => ({
    name: result.fixture,
    baseSamples: result.base.length,
    fusedSamples: result.fused.length,
    baseBrierScore: evaluateCalibration(result.base).brierScore,
    fusedBrierScore: evaluateCalibration(result.fused).brierScore,
    maximumEvidenceCount: result.evidenceCount,
    endgameChecks: result.endgameChecks,
    evidenceSummaries: result.evidenceSummaries
  })),
  base: {
    sampleCount: baseReport.sampleCount,
    brierScore: baseReport.brierScore,
    logLoss: baseReport.logLoss,
    expectedCalibrationError: baseReport.expectedCalibrationError
  },
  choiceOnly: {
    sampleCount: choiceOnlyReport.sampleCount,
    brierScore: choiceOnlyReport.brierScore,
    logLoss: choiceOnlyReport.logLoss,
    expectedCalibrationError: choiceOnlyReport.expectedCalibrationError
  },
  passOnly: {
    sampleCount: passOnlyReport.sampleCount,
    brierScore: passOnlyReport.brierScore,
    logLoss: passOnlyReport.logLoss,
    expectedCalibrationError: passOnlyReport.expectedCalibrationError
  },
  fused: {
    sampleCount: fusedReport.sampleCount,
    brierScore: fusedReport.brierScore,
    logLoss: fusedReport.logLoss,
    expectedCalibrationError: fusedReport.expectedCalibrationError
  },
  delta: {
    brierScore: fusedReport.brierScore - baseReport.brierScore,
    logLoss: fusedReport.logLoss - baseReport.logLoss,
    expectedCalibrationError:
      fusedReport.expectedCalibrationError -
      baseReport.expectedCalibrationError
  },
  maximumEvidenceCount,
  endgameChecks,
  hardFactCrossRankCheck: {
    revealedRank: hardFactCard.rank,
    affectedRank: hardFactTargetRank,
    before: hardFactBaseProbability,
    after: hardFactRevealedProbability,
    delta: hardFactCrossRankDelta
  },
  cspCheck: {
    remainingCount: cspCheck.remainingCount,
    unknownSlotCount: cspCheck.unknownSlotCount,
    rankCompositionCount: cspCheck.rankCompositionCount,
    lockedCards: cspCheck.lockedCards,
    topCandidateCount: cspCheck.topCandidates.length
  },
  note: '两局仅作回归基线；第二局678910按红心J配作9还原实体牌。样本在同一牌局内相关，不能据此宣称总体概率已校准。'
}, null, 2));
