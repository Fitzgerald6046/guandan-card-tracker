/**
 * 掼蛋记牌器 - 图像化卡牌版本
 * 使用 SVG 生成的卡牌图像进行选择操作
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback
} from 'react';
import { validateCardType } from './utils/guandanRules';
import { validateDoudizhuCardType } from './utils/doudizhuRules';
import { pickCardsByVoiceRanks } from './utils/quickCardInput';
import {
  FINISH_LABELS,
  getGameProgress,
  getNextEligiblePlayer,
  getSkippedPlayersBeforeTarget,
  getPlayedCardCount,
  getPlayerDisplayName,
  undoLastGameOperation
} from './utils/gameProgress';
import { normalizePlayType } from './utils/playTypeMapping';
import { GameReplay } from './components/GameReplay';
import {
  useGameHistory,
  type GameRecord
} from './hooks/useGameHistory';
import { useInferenceViewModel } from './hooks/useInferenceViewModel';
import { AIAssistant } from './components/AIAssistant';
import { PlayerInferenceStrip } from './components/PlayerInferenceStrip';
import { KnownOwnerOverlay } from './components/KnownOwnerOverlay';
import { VoiceControl } from './components/VoiceControl';
import CardImage from './components/CardImage';
import { GuandanAIReasoningEngine } from './utils/aiReasoningEngine';
import type {
  VoiceCommandAction,
  VoiceCommandOutcome
} from './utils/voiceCommand';
import type {
  GameState,
  Card,
  GameRank,
  PlayerPosition,
  PlayRecord,
  Player,
  AIAnalysisResult
} from './types/game';
import {
  Suit,
  Rank,
  GameStatus,
  RANK_DISPLAY_NAMES
} from './types/game';
import type { GameMode } from './types/game';
import {
  getActivePlayerPositions,
  getGameMode,
  getModePlayerTeam,
  getPlayerInitialCardCount
} from './utils/gameMode';

type InputPurpose = 'hand' | 'revealed';

interface RevealedCardRecord {
  id: string;
  playerPosition: PlayerPosition;
  card: Card;
  timestamp: number;
}

interface ActiveSessionSnapshot {
  version: 1;
  savedAt: number;
  gameState: GameState;
  handInput: {
    isInputMode: boolean;
    selectedPlayerForInput: PlayerPosition | null;
    startingPlayerSelected: boolean;
    playerHands: Record<PlayerPosition, Card[]>;
    revealedCards: Record<PlayerPosition, string[]>;
    gameStarted: boolean;
    currentRevealedPlayer: PlayerPosition | null;
    inputPurpose: InputPurpose;
    revealedTarget: PlayerPosition;
    revealedEntries: RevealedCardRecord[];
  };
  selectedCardIds: string[];
}

const ACTIVE_SESSION_STORAGE_KEY = 'guandan-card-tracker-active-session-v1';

const loadActiveSession = (): ActiveSessionSnapshot | null => {
  try {
    const stored = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!stored) return null;

    const snapshot = JSON.parse(stored) as ActiveSessionSnapshot;
    if (
      snapshot.version !== 1 ||
      !snapshot.gameState ||
      !snapshot.handInput ||
      !Array.isArray(snapshot.selectedCardIds)
    ) {
      return null;
    }

    snapshot.handInput.startingPlayerSelected =
      typeof snapshot.handInput.startingPlayerSelected === 'boolean'
        ? snapshot.handInput.startingPlayerSelected
        : snapshot.gameState.status === GameStatus.PLAYING ||
          snapshot.gameState.status === GameStatus.FINISHED;
    snapshot.gameState.players = snapshot.gameState.players.map(player => ({
      ...player,
      name: getPlayerDisplayName(player.position)
    }));

    return snapshot;
  } catch (error) {
    console.warn('恢复上次牌局失败，将使用新牌局：', error);
    return null;
  }
};

const updateCardsForCurrentRank = (
  cards: Card[],
  currentRank: GameRank
): Card[] =>
  cards.map(card => {
    const isRankCard =
      card.rank < Rank.JOKER_SMALL && card.rank === currentRank;
    const isWildCard = isRankCard && card.suit === Suit.HEARTS;

    return {
      ...card,
      isRankCard,
      isWildCard
    };
  });

/** 生成当前模式的完整实体牌面。 */
function generateSortedCards(
  currentRank: GameRank,
  gameMode: GameMode = 'guandan'
): Card[] {
  const cards: Card[] = [];
  const copiesPerRank = gameMode === 'doudizhu' ? 4 : 8;
  const copiesPerSuit = gameMode === 'doudizhu' ? 1 : 2;
  const suits = [Suit.SPADES, Suit.HEARTS, Suit.CLUBS, Suit.DIAMONDS];
  const baseRanks = [];

  for (let rank = 2; rank <= 14; rank++) {
    if (rank !== currentRank) baseRanks.push(rank);
  }

  baseRanks.forEach(rank => {
    for (let index = 0; index < copiesPerRank; index += 1) {
      const suit = suits[Math.floor(index / copiesPerSuit)];
      cards.push({
        id: `${rank}-${index}`,
        rank: rank as Rank,
        isRankCard: false,
        isWildCard: false,
        isHearts: suit === Suit.HEARTS,
        suit,
        displayName: RANK_DISPLAY_NAMES[rank as Rank],
        isPlayed: false,
        isSelected: false,
        timestamp: Date.now()
      });
    }
  });

  for (let index = 0; index < copiesPerRank; index += 1) {
    const suit = suits[Math.floor(index / copiesPerSuit)];
    const isHearts = suit === Suit.HEARTS;
    cards.push({
      id: `${currentRank}-${index}`,
      rank: currentRank,
      isRankCard: gameMode === 'guandan',
      isWildCard: gameMode === 'guandan' && isHearts,
      isHearts,
      suit,
      displayName: RANK_DISPLAY_NAMES[currentRank],
      isPlayed: false,
      isSelected: false,
      timestamp: Date.now()
    });
  }

  const jokerCount = gameMode === 'doudizhu' ? 2 : 4;
  for (let index = 0; index < jokerCount; index += 1) {
    const isSmall = gameMode === 'doudizhu' ? index === 0 : index < 2;
    cards.push({
      id: `joker-${index}`,
      rank: isSmall ? Rank.JOKER_SMALL : Rank.JOKER_BIG,
      isRankCard: false,
      isWildCard: false,
      isHearts: false,
      suit: null,
      displayName: isSmall ? '小王' : '大王',
      isPlayed: false,
      isSelected: false,
      timestamp: Date.now()
    });
  }

  return cards;
}

const createInitialPlayers = (
  gameMode: GameMode,
  landlordPosition?: PlayerPosition
): Player[] => getActivePlayerPositions(gameMode).map((position, index) => ({
  id: `p${index + 1}`,
  name: position === 'bottom'
    ? '我'
    : position === 'left'
      ? '下家'
      : position === 'right'
        ? '上家'
        : '对家',
  position,
  team: getModePlayerTeam(gameMode, position, landlordPosition),
  cards: [],
  remainingCount: getPlayerInitialCardCount(
    gameMode,
    position,
    landlordPosition
  ),
  isCurrentPlayer: position === 'bottom',
  stats: {
    playedCards: 0,
    rankCardCount: 0,
    wildCardCount: 0,
    roundWins: 0
  }
}));

const createInitialGameState = (
  gameMode: GameMode = 'guandan',
  landlordPosition?: PlayerPosition
): GameState => {
  // 斗地主把2作为最高普通点数，复用既有强度模型但不生成级牌/配牌。
  const initialRank: GameRank = gameMode === 'doudizhu' ? 2 : 7;
  const initialCards = generateSortedCards(initialRank, gameMode);

  return {
    gameId: `game-${Date.now()}`,
    status: GameStatus.WAITING,
    config: {
      gameMode,
      landlordPosition,
      rank: { current: initialRank, next: initialRank, history: [] },
      tributeEnabled: false
    },
    players: createInitialPlayers(gameMode, landlordPosition),
    currentPlayerPosition: 'bottom',
    currentRank: initialRank,
    allCards: initialCards.map(card => ({
      ...card,
      isPlayed: false,
      isSelected: false,
      timestamp: Date.now()
    })),
    playHistory: [],
    currentRound: {
      roundNumber: 1,
      startTime: null,
      passCount: 0,
      isFinished: false
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
};

const createInitialHandInput = (): ActiveSessionSnapshot['handInput'] => ({
  isInputMode: false,
  selectedPlayerForInput: null,
  startingPlayerSelected: false,
  playerHands: {
    bottom: [],
    left: [],
    top: [],
    right: []
  },
  revealedCards: {
    bottom: [],
    left: [],
    top: [],
    right: []
  },
  gameStarted: false,
  currentRevealedPlayer: null,
  inputPurpose: 'hand',
  revealedTarget: 'left',
  revealedEntries: []
});

const App: React.FC = () => {
  // 游戏状态管理
  const [gameState, setGameState] = useState<GameState>(() => {
    const restoredSession = loadActiveSession();
    if (restoredSession) {
      return restoredSession.gameState;
    }

    return createInitialGameState();
  });

  // 从gameState中解构常用变量
  const {
    config: { rank: { current: currentRank } },
    currentPlayerPosition: selectedPlayer,
    allCards,
    playHistory,
    players
  } = gameState;
  const gameMode = getGameMode(gameState);
  const landlordPosition = gameState.config.landlordPosition;
  const activePlayerPositions = useMemo(
    () => getActivePlayerPositions(gameMode),
    [gameMode]
  );
  const progressRules = useMemo(() => ({
    mode: gameMode,
    landlordPosition,
    playerOrder: activePlayerPositions
  }), [activePlayerPositions, gameMode, landlordPosition]);
  const getInitialCardCount = useCallback(
    (position: PlayerPosition) => getPlayerInitialCardCount(
      gameMode,
      position,
      landlordPosition
    ),
    [gameMode, landlordPosition]
  );
  const gameProgress = getGameProgress(playHistory, progressRules);
  const finishOrder = gameProgress.finishOrder;

  const [selectedCards, setSelectedCards] = useState<Set<string>>(
    () => new Set(loadActiveSession()?.selectedCardIds ?? [])
  );
  const [showInstructions, setShowInstructions] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [showGameHistory, setShowGameHistory] = useState(false);
  const [pendingDeleteRecordId, setPendingDeleteRecordId] =
    useState<string | null>(null);
  const [currentReplayGameId, setCurrentReplayGameId] = useState<string | null>(null);
  // 实战默认只看牌面硬事实和玩家短标签；完整证据面板按需展开。
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiEnabled, setAIEnabled] = useState(true);
  const [analysisRefreshVersion, setAnalysisRefreshVersion] = useState(0);
  const reasoningEngine = useMemo(
    () => new GuandanAIReasoningEngine(currentRank),
    [currentRank]
  );
  // 只在牌局事实变化时生成新的推理快照；页面上的计时刷新不会重复跑完整推理。
  const inferenceGameState = useMemo<GameState>(() => ({
    gameId: gameState.gameId,
    status: gameState.status,
    config: gameState.config,
    players: gameState.players,
    currentPlayerPosition: gameState.currentPlayerPosition,
    currentRank: gameState.currentRank,
    allCards: gameState.allCards,
    playHistory: gameState.playHistory,
    currentRound: gameState.currentRound,
    createdAt: gameState.createdAt,
    updatedAt: gameState.updatedAt
  }), [
    gameState.allCards,
    gameState.config,
    gameState.createdAt,
    gameState.currentPlayerPosition,
    gameState.currentRank,
    gameState.currentRound,
    gameState.gameId,
    gameState.playHistory,
    gameState.players,
    gameState.status,
    gameState.updatedAt
  ]);
  const hasInferenceData =
    playHistory.length > 0 ||
    players.some(player => player.cards.length > 0);
  const analysisResult = useMemo<AIAnalysisResult | null>(() => {
    void analysisRefreshVersion;
    if (!aiEnabled || !hasInferenceData) return null;

    reasoningEngine.updateGameData(
      playHistory,
      currentRank,
      inferenceGameState
    );
    return reasoningEngine.performFullAnalysis();
  }, [
    aiEnabled,
    analysisRefreshVersion,
    currentRank,
    hasInferenceData,
    inferenceGameState,
    playHistory,
    reasoningEngine
  ]);
  const inferenceViewModel = useInferenceViewModel(
    inferenceGameState,
    analysisResult
  );

  // 回放功能
  const {
    replayState,
    setReplayProgress,
    setReplaySpeed,
    startReplay,
    stopReplay,
    saveCurrentGame,
    setGameImportant,
    deleteGameRecord,
    gameRecords
  } = useGameHistory();
  const currentSnapshotRecord = gameRecords.find(record =>
    record.id === `live-${gameState.gameId}` ||
    record.sourceGameId === gameState.gameId
  );
  const currentSnapshotRecordId =
    currentSnapshotRecord?.id ?? `live-${gameState.gameId}`;
  const isCurrentGameImportant = Boolean(
    currentSnapshotRecord?.isImportant
  );

  // 回放控制接口
  const replayControl = {
    setProgress: setReplayProgress,
    setSpeed: setReplaySpeed,
    start: () => {
      if (currentReplayGameId) {
        startReplay(currentReplayGameId);
      }
    },
    stop: stopReplay
  };

  const saveCurrentReplaySnapshot = useCallback((
    important: boolean
  ): string => {
    const ownership = inferenceGameState.players.reduce((owners, player) => {
      player.cards.forEach(card => {
        owners[card.id] = player.position;
      });
      return owners;
    }, {} as Record<string, PlayerPosition>);
    inferenceGameState.playHistory.forEach(record => {
      record.cards.forEach(card => {
        ownership[card.id] = record.playerPosition;
      });
    });

    return saveCurrentGame(
      inferenceGameState.allCards.map(card => ({
        ...card,
        suit:
          card.rank === Rank.JOKER_SMALL || card.rank === Rank.JOKER_BIG
            ? null
            : card.suit,
        isSelected: false,
        timestamp: Date.now()
      })),
      ownership,
      currentRank,
      inferenceGameState.players,
      inferenceGameState,
      {
        recordId: currentSnapshotRecordId,
        sourceGameId: gameState.gameId,
        isImportant: important,
        isCompleted: gameState.status === GameStatus.FINISHED,
        winningTeam: gameProgress.winningTeam ?? undefined,
        notes: important
          ? `重要牌局，已同步${playHistory.length}次操作`
          : `实时回放快照，共${playHistory.length}次操作`,
        tags: important
          ? ['重要牌局', '实时快照', '真实出牌']
          : ['实时快照', '真实出牌']
      }
    );
  }, [
    currentRank,
    currentSnapshotRecordId,
    gameProgress.winningTeam,
    gameState.gameId,
    gameState.status,
    inferenceGameState,
    playHistory.length,
    saveCurrentGame
  ]);

  const openCurrentReplay = () => {
    if (playHistory.length === 0) {
      alert('还没有出牌或过牌记录，暂时无法回放');
      return;
    }

    try {
      const replayGameId = saveCurrentReplaySnapshot(
        isCurrentGameImportant
      );
      setCurrentReplayGameId(replayGameId);
      startReplay(replayGameId);
      setShowReplay(true);
    } catch (error) {
      console.error('启动回放失败:', error);
      alert('启动回放失败，请稍后重试');
    }
  };

  const openSavedReplay = (record: GameRecord) => {
    if (record.playHistory.length === 0) {
      alert('这条记录还没有出牌或过牌，暂时无法复盘');
      return;
    }
    setCurrentReplayGameId(record.id);
    startReplay(record.id);
    setShowGameHistory(false);
    setShowReplay(true);
  };

  const removeSavedGame = (record: GameRecord) => {
    if (currentReplayGameId === record.id) {
      stopReplay();
      setShowReplay(false);
      setCurrentReplayGameId(null);
    }
    deleteGameRecord(record.id);
    setPendingDeleteRecordId(null);
  };

  const toggleCurrentGameImportant = () => {
    if (currentSnapshotRecord?.isImportant) {
      setGameImportant(currentSnapshotRecord.id, false);
      return;
    }
    saveCurrentReplaySnapshot(true);
  };

  // 重要牌局才自动同步；700ms合并连续录入，避免进入点击热路径。
  useEffect(() => {
    if (!isCurrentGameImportant) return;

    const syncTimer = window.setTimeout(() => {
      saveCurrentReplaySnapshot(true);
    }, 700);
    const syncWhenHidden = () => {
      if (document.visibilityState === 'hidden') {
        window.clearTimeout(syncTimer);
        saveCurrentReplaySnapshot(true);
      }
    };
    document.addEventListener('visibilitychange', syncWhenHidden);

    return () => {
      window.clearTimeout(syncTimer);
      document.removeEventListener('visibilitychange', syncWhenHidden);
    };
  }, [isCurrentGameImportant, saveCurrentReplaySnapshot]);

  // 手牌输入状态
  const [handInput, setHandInput] = useState<
    ActiveSessionSnapshot['handInput']
  >(() => loadActiveSession()?.handInput ?? createInitialHandInput());

  useEffect(() => {
    const persistActiveSession = () => {
      try {
        const snapshot: ActiveSessionSnapshot = {
          version: 1,
          savedAt: Date.now(),
          gameState,
          handInput,
          selectedCardIds: Array.from(selectedCards)
        };
        localStorage.setItem(
          ACTIVE_SESSION_STORAGE_KEY,
          JSON.stringify(snapshot)
        );
      } catch (error) {
        console.warn('自动保存当前牌局失败：', error);
      }
    };

    persistActiveSession();

    const persistWhenHidden = () => {
      if (document.visibilityState === 'hidden') {
        persistActiveSession();
      }
    };

    document.addEventListener('visibilitychange', persistWhenHidden);
    window.addEventListener('pagehide', persistActiveSession);

    return () => {
      document.removeEventListener('visibilitychange', persistWhenHidden);
      window.removeEventListener('pagehide', persistActiveSession);
    };
  }, [gameState, handInput, selectedCards]);

  const handleCurrentRankChange = (nextRank: GameRank) => {
    setGameState(previous => ({
      ...previous,
      config: {
        ...previous.config,
        rank: {
          ...previous.config.rank,
          current: nextRank
        }
      },
      currentRank: nextRank,
      allCards: updateCardsForCurrentRank(previous.allCards, nextRank),
      players: previous.players.map(player => {
        const cards = updateCardsForCurrentRank(player.cards, nextRank);
        return {
          ...player,
          cards,
          stats: {
            ...player.stats,
            rankCardCount: cards.filter(card => card.isRankCard).length,
            wildCardCount: cards.filter(card => card.isWildCard).length
          }
        };
      }),
      playHistory: previous.playHistory.map(record => ({
        ...record,
        cards: updateCardsForCurrentRank(record.cards, nextRank)
      })),
      updatedAt: Date.now()
    }));

    setHandInput(previous => ({
      ...previous,
      playerHands: {
        bottom: updateCardsForCurrentRank(
          previous.playerHands.bottom,
          nextRank
        ),
        left: updateCardsForCurrentRank(previous.playerHands.left, nextRank),
        top: updateCardsForCurrentRank(previous.playerHands.top, nextRank),
        right: updateCardsForCurrentRank(previous.playerHands.right, nextRank)
      },
      revealedEntries: (previous.revealedEntries as RevealedCardRecord[]).map(
        entry => ({
          ...entry,
          card: updateCardsForCurrentRank([entry.card], nextRank)[0]
        })
      ),
      selectedPlayerForInput: previous.isInputMode ? 'bottom' : null
    }));
  };

  // 选择模式和拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const suppressNextTouchClickRef = useRef(false);
  const touchSelectionRef = useRef<{
    tracking: boolean;
    swiping: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startCardId: string | null;
    visitedCardIds: Set<string>;
  }>({
    tracking: false,
    swiping: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startCardId: null,
    visitedCardIds: new Set()
  });


  // 玩家颜色设置
  const [playerColors] = useState({
    bottom: '#f59e0b', // 我：黄色
    left: '#2563eb',   // 下家：蓝色
    top: '#7c3aed',    // 对家：紫色
    right: '#16a34a'   // 上家：绿色
  });

  // 检测触摸设备
  useEffect(() => {
    setIsTouchDevice(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    );
  }, []);


  // 游戏时长定时更新
  useEffect(() => {
    let timer: number;

    if (gameState.status === GameStatus.PLAYING && gameState.currentRound.startTime) {
      timer = window.setInterval(() => {
        // 强制重新渲染来更新时间显示
        setGameState(prev => ({ ...prev }));
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gameState.status, gameState.currentRound.startTime]);

  // 计算玩家牌数统计
  const getPlayerCardStats = (playerPos: PlayerPosition) => {
    const player = players.find(p => p.position === playerPos);
    if (!player) return { played: 0, remaining: 0, revealed: 0 };

    if (handInput.isInputMode) {
      // 手牌输入模式：显示明牌设置状态
      const inputCount = handInput.playerHands[playerPos].length;
      const revealedCount = handInput.revealedCards[playerPos].length;

      if (playerPos === 'bottom') {
        // 我：显示已设置的明牌数和标记数
        return {
          played: inputCount, // 显示为"明牌"数量
          remaining: 0, // 不显示剩余
          revealed: revealedCount // 标记为明牌的数量
        };
      } else {
        // 其他玩家：显示明牌数和可设置数
        return {
          played: inputCount, // 明牌数
          remaining: inputCount === 0 ? 1 : 0, // 可设置的明牌数
          revealed: revealedCount
        };
      }
    } else if (gameState.status === GameStatus.PLAYING || gameState.status === GameStatus.FINISHED) {
      // 游戏进行中：显示已出牌数和剩余手牌数
      const revealedCount = handInput.revealedCards[playerPos].length;

      // 主出牌历史同时覆盖已录入手牌和公共牌库，不能只统计预先分配的手牌。
      const playedCount = playHistory
        .filter(record => record.playerPosition === playerPos)
        .reduce((total, record) => total + record.cards.length, 0);

      return {
        played: playedCount,
        remaining: Math.max(0, getInitialCardCount(playerPos) - playedCount),
        revealed: revealedCount
      };
    } else {
      // 正常游戏模式：显示已出牌数量（无手牌设置的情况）
      const playedCount = playHistory
        .filter(record => record.playerPosition === playerPos)
        .reduce((total, record) => total + record.cards.length, 0);

      const remainingCount = Math.max(
        0,
        getInitialCardCount(playerPos) - playedCount
      );

      return {
        played: playedCount,
        remaining: remainingCount,
        revealed: 0
      };
    }
  };

  // 检查卡牌对指定玩家是否可选择，快捷指令切换玩家时无需等待 React 状态更新。
  const isCardSelectableForPlayer = (
    cardId: string,
    playerPosition: PlayerPosition
  ): boolean => {
    const card = allCards.find(c => c.id === cardId);
    if (!card || card.isPlayed) {
      return false;
    }

    // 手牌输入模式：所有卡牌都可选择
    if (handInput.isInputMode) {
      return true;
    }

    if (gameState.status === GameStatus.FINISHED) {
      return false;
    }

    // 游戏开始后的严格明牌权限控制
    if (gameState.status === GameStatus.PLAYING) {
      // 检查卡牌归属
      let cardOwner: PlayerPosition | null = null;
      let isRevealedCard = false;

      for (const [player, hands] of Object.entries(handInput.playerHands) as Array<[PlayerPosition, Card[]]>) {
        if (hands.some(card => card.id === cardId)) {
          cardOwner = player as PlayerPosition;
          isRevealedCard = handInput.revealedCards[cardOwner].includes(cardId);
          break;
        }
      }

      // 如果卡牌属于某个玩家（明牌或手牌）
      if (cardOwner) {
        // 如果是我(bottom)，可以选择自己的所有手牌（明牌+暗牌）
        if (playerPosition === 'bottom' && cardOwner === 'bottom') {
          return true;
        }

        // 其他玩家：只能选择自己的明牌
        if (playerPosition === cardOwner && isRevealedCard) {
          return true;
        }

        // 不是自己的牌，或者是别人的非明牌，都不能选择
        return false;
      }

      // 不属于任何玩家的卡牌（公共牌库）
      // 我(bottom)不能选择公共牌库（因为我有实际手牌）
      // 其他玩家可以选择公共牌库的牌来模拟出牌
      if (playerPosition === 'bottom') {
        return false;
      } else {
        return true;
      }
    }

    // 正常模式：所有卡牌都可选择
    return true;
  };

  const selectActivePlayer = (playerPosition: PlayerPosition) => {
    if (
      gameMode === 'doudizhu' &&
      gameState.status === GameStatus.INPUT &&
      playerPosition !== landlordPosition
    ) {
      return;
    }
    const playerHasFinished =
      finishOrder.includes(playerPosition) &&
      (gameState.status === GameStatus.PLAYING ||
        gameState.status === GameStatus.FINISHED);
    if (playerHasFinished) return;

    setGameState(previous => ({
      ...previous,
      currentPlayerPosition: playerPosition,
      updatedAt: Date.now()
    }));
    setHandInput(previous => ({
      ...previous,
      startingPlayerSelected: true
    }));
  };

  const isCardSelectable = (cardId: string): boolean =>
    isCardSelectableForPlayer(cardId, selectedPlayer);

  const getAssignedCardIds = (): Set<string> => new Set(
    (Object.values(handInput.playerHands) as Card[][])
      .flat()
      .map(card => card.id)
  );

  // 处理卡牌选择
  const handleCardSelect = (cardId: string, forceMultiSelect: boolean = false) => {
    if (gameState.status === GameStatus.FINISHED) {
      return;
    }

    if (
      (gameState.status === GameStatus.PLAYING ||
        gameState.status === GameStatus.FINISHED) &&
      !handInput.startingPlayerSelected
    ) {
      alert(`请先点击上方${gameMode === 'doudizhu' ? '三家' : '四家'}牌面，选择实际出牌方`);
      return;
    }

    // 检查卡牌是否可选择
    if (!isCardSelectable(cardId)) {
      // 游戏开始后的权限提示
      if (gameState.status === GameStatus.PLAYING || gameState.status === GameStatus.FINISHED) {
        let cardOwner: PlayerPosition | null = null;
        let isRevealedCard = false;

        for (const [player, hands] of Object.entries(handInput.playerHands) as Array<[PlayerPosition, Card[]]>) {
          if (hands.some(card => card.id === cardId)) {
            cardOwner = player as PlayerPosition;
            isRevealedCard = handInput.revealedCards[cardOwner].includes(cardId);
            break;
          }
        }

        // 权限提示
        if (cardOwner) {
          const playerNames = {
            bottom: '我',
            left: '下家',
            top: '对家',
            right: '上家'
          };

          if (cardOwner === 'bottom' && selectedPlayer !== 'bottom') {
            alert(`这是我的手牌，只有我可以选择！请切换到"我"来出牌。`);
          } else if (cardOwner !== 'bottom' && selectedPlayer === cardOwner && !isRevealedCard) {
            alert(`这是${playerNames[cardOwner]}的暗牌，无法选择。只能选择明牌。`);
          } else if (cardOwner !== 'bottom' && selectedPlayer !== cardOwner) {
            if (isRevealedCard) {
              alert(`这是${playerNames[cardOwner]}的明牌，只有${playerNames[cardOwner]}可以选择！请切换到"${playerNames[cardOwner]}"来出牌。`);
            } else {
              alert(`这是${playerNames[cardOwner]}的暗牌，任何人都不能选择。`);
            }
          }
        } else if (!cardOwner && selectedPlayer === 'bottom') {
          alert(`我只能选择自己的手牌，不能选择公共牌库的牌。`);
        }
      }
      return;
    }

    setSelectedCards(prev => {
      const newSelected = new Set(prev);
      const shouldMultiSelect = forceMultiSelect || isMultiSelectMode;

      if (shouldMultiSelect) {
        // 多选模式：切换选中状态
        if (newSelected.has(cardId)) {
          newSelected.delete(cardId);
        } else {
          newSelected.add(cardId);
        }
      } else {
        // 单选模式：如果点击已选中的唯一卡牌则取消，否则替换选择
        if (newSelected.has(cardId) && newSelected.size === 1) {
          newSelected.clear();
        } else {
          newSelected.clear();
          newSelected.add(cardId);
        }
      }

      return newSelected;
    });
  };

  // 处理点击事件
  const handleCardClick = (cardId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    // 手牌输入模式：使用正常的选择逻辑，通过确认按钮来添加
    // 游戏模式：正常的卡牌选择
    const isCtrlClick = e?.ctrlKey || e?.metaKey;
    handleCardSelect(cardId, isCtrlClick);
  };

  // 处理触摸事件（手机端）
  const handleCardTouch = (cardId: string) => {
    if (gameState.status === GameStatus.FINISHED) {
      return;
    }

    if (
      (gameState.status === GameStatus.PLAYING ||
        gameState.status === GameStatus.FINISHED) &&
      !handInput.startingPlayerSelected
    ) {
      alert(`请先点击上方${gameMode === 'doudizhu' ? '三家' : '四家'}牌面，选择实际出牌方`);
      return;
    }

    // 先检查卡牌是否可选择
    if (!isCardSelectable(cardId)) {
      // 游戏开始后的权限提示
      if (gameState.status === GameStatus.PLAYING || gameState.status === GameStatus.FINISHED) {
        let cardOwner: PlayerPosition | null = null;
        let isRevealedCard = false;

        for (const [player, hands] of Object.entries(handInput.playerHands) as Array<[PlayerPosition, Card[]]>) {
          if (hands.some(card => card.id === cardId)) {
            cardOwner = player as PlayerPosition;
            isRevealedCard = handInput.revealedCards[cardOwner].includes(cardId);
            break;
          }
        }

        // 权限提示
        if (cardOwner) {
          const playerNames = {
            bottom: '我',
            left: '下家',
            top: '对家',
            right: '上家'
          };

          if (cardOwner === 'bottom' && selectedPlayer !== 'bottom') {
            alert(`这是我的手牌，只有我可以选择！请切换到"我"来出牌。`);
          } else if (cardOwner !== 'bottom' && selectedPlayer === cardOwner && !isRevealedCard) {
            alert(`这是${playerNames[cardOwner]}的暗牌，无法选择。只能选择明牌。`);
          } else if (cardOwner !== 'bottom' && selectedPlayer !== cardOwner) {
            if (isRevealedCard) {
              alert(`这是${playerNames[cardOwner]}的明牌，只有${playerNames[cardOwner]}可以选择！请切换到"${playerNames[cardOwner]}"来出牌。`);
            } else {
              alert(`这是${playerNames[cardOwner]}的暗牌，任何人都不能选择。`);
            }
          }
        } else if (!cardOwner && selectedPlayer === 'bottom') {
          alert(`我只能选择自己的手牌，不能选择公共牌库的牌。`);
        }
      }
      return;
    }

    // 始终使用函数式更新，连续快速点击不会因读取到旧状态而覆盖前一张牌。
    setIsMultiSelectMode(true);
    setSelectedCards(previous => {
      const next = new Set(previous);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const getCardIdAtPoint = (x: number, y: number): string | null => {
    const element = document.elementFromPoint(x, y) as HTMLElement | null;
    return element?.closest<HTMLElement>('[data-card-id]')?.dataset.cardId ?? null;
  };

  const canSwipeSelectCards = (): boolean => {
    if (gameState.status === GameStatus.FINISHED) return false;

    return handInput.startingPlayerSelected ||
      gameState.status === GameStatus.INPUT
      ? !(
          handInput.isInputMode &&
          handInput.inputPurpose === 'revealed' &&
          handInput.revealedTarget !== 'bottom'
        )
      : gameState.status === GameStatus.WAITING;
  };

  const addCardsFromTouchPath = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ) => {
    const touchState = touchSelectionRef.current;
    const distance = Math.hypot(toX - fromX, toY - fromY);
    const sampleCount = Math.max(1, Math.ceil(distance / 8));
    const newlyVisited: string[] = [];

    for (let index = 0; index <= sampleCount; index++) {
      const ratio = index / sampleCount;
      const cardId = getCardIdAtPoint(
        fromX + (toX - fromX) * ratio,
        fromY + (toY - fromY) * ratio
      );
      if (
        cardId &&
        !touchState.visitedCardIds.has(cardId) &&
        isCardSelectable(cardId)
      ) {
        touchState.visitedCardIds.add(cardId);
        newlyVisited.push(cardId);
      }
    }

    if (newlyVisited.length > 0) {
      setSelectedCards(previous => {
        const next = new Set(previous);
        newlyVisited.forEach(cardId => next.add(cardId));
        return next;
      });
    }
  };

  const handleCardGridTouchStart = (
    event: React.TouchEvent<HTMLDivElement>
  ) => {
    if (!canSwipeSelectCards() || event.touches.length !== 1) return;

    const touch = event.touches[0];
    touchSelectionRef.current = {
      tracking: true,
      swiping: false,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      startCardId: getCardIdAtPoint(touch.clientX, touch.clientY),
      visitedCardIds: new Set()
    };
  };

  const handleCardGridTouchMove = (
    event: React.TouchEvent<HTMLDivElement>
  ) => {
    const touchState = touchSelectionRef.current;
    if (!touchState.tracking || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const horizontalDistance = Math.abs(touch.clientX - touchState.startX);
    const verticalDistance = Math.abs(touch.clientY - touchState.startY);

    if (!touchState.swiping) {
      if (horizontalDistance < 8 && verticalDistance < 8) return;

      // 垂直手势仍用于滚动页面；横向手势才进入连续划选。
      if (verticalDistance > horizontalDistance * 1.15) {
        touchState.tracking = false;
        return;
      }

      touchState.swiping = true;
      setIsMultiSelectMode(true);
      if (
        touchState.startCardId &&
        isCardSelectable(touchState.startCardId)
      ) {
        touchState.visitedCardIds.add(touchState.startCardId);
        setSelectedCards(previous => {
          const next = new Set(previous);
          next.add(touchState.startCardId!);
          return next;
        });
      }
    }

    event.preventDefault();
    addCardsFromTouchPath(
      touchState.lastX,
      touchState.lastY,
      touch.clientX,
      touch.clientY
    );
    touchState.lastX = touch.clientX;
    touchState.lastY = touch.clientY;
  };

  const finishCardGridTouch = () => {
    const wasSwiping = touchSelectionRef.current.swiping;
    touchSelectionRef.current.tracking = false;
    touchSelectionRef.current.swiping = false;

    if (wasSwiping) {
      suppressNextTouchClickRef.current = true;
      window.setTimeout(() => {
        suppressNextTouchClickRef.current = false;
      }, 350);
    }
  };

  // 拖拽选择处理
  const handleMouseDown = (cardId: string, e?: React.MouseEvent) => {
    // 普通点击由 onClick 处理；只有按住 Shift 才启用电脑端拖拽多选，
    // 避免选择提示出现造成牌面位移时误选经过的卡牌。
    if (!e?.shiftKey || e?.ctrlKey || e?.metaKey) {
      return;
    }

    // 检查卡牌是否可选择
    if (!isCardSelectable(cardId)) {
      return;
    }

    e?.preventDefault();
    e?.stopPropagation();
    isDraggingRef.current = true;
    setIsDragging(true);

    // 开始拖拽时，直接添加当前卡牌到选择中（不清空之前的选择）
    setSelectedCards(prev => {
      const newSelected = new Set(prev);
      newSelected.add(cardId);
      return newSelected;
    });
  };

  const handleMouseEnter = (cardId: string) => {
    if (isDraggingRef.current && isDragging && isCardSelectable(cardId)) {
      // 拖拽过程中只添加，不移除
      setSelectedCards(prev => {
        const newSelected = new Set(prev);
        newSelected.add(cardId);
        return newSelected;
      });
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  // 重置多选模式
  const resetMultiSelectMode = () => {
    isDraggingRef.current = false;
    setIsMultiSelectMode(false);
    setIsDragging(false);
  };

  // 手牌输入模式控制函数
  const switchGameMode = (nextMode: GameMode) => {
    if (nextMode === gameMode) return;
    if (gameState.status !== GameStatus.WAITING) return;

    setGameState(createInitialGameState(nextMode));
    setHandInput(createInitialHandInput());
    setSelectedCards(new Set());
    setShowAIAssistant(false);
  };

  const selectLandlord = (position: PlayerPosition) => {
    if (gameMode !== 'doudizhu' || gameState.status !== GameStatus.WAITING) {
      return;
    }
    if (!activePlayerPositions.includes(position)) return;

    setGameState(previous => ({
      ...previous,
      config: {
        ...previous.config,
        landlordPosition: position
      },
      players: previous.players.map(player => ({
        ...player,
        team: getModePlayerTeam('doudizhu', player.position, position),
        remainingCount: getPlayerInitialCardCount(
          'doudizhu',
          player.position,
          position
        ),
        isCurrentPlayer: player.position === position
      })),
      currentPlayerPosition: position,
      updatedAt: Date.now()
    }));
    setHandInput(previous => ({
      ...previous,
      revealedTarget: position,
      startingPlayerSelected: true
    }));
  };

  const startHandInput = () => {
    if (gameMode === 'doudizhu' && !landlordPosition) {
      alert('请先选择地主是谁');
      return;
    }
    setGameState(prev => ({
      ...prev,
      status: GameStatus.INPUT,
    }));

    setHandInput(prev => ({
      ...prev,
      isInputMode: true,
      selectedPlayerForInput: 'bottom',
      startingPlayerSelected: gameMode === 'doudizhu',
      playerHands: {
        ...prev.playerHands,
        left: [],
        top: [],
        right: []
      },
      revealedCards: {
        ...prev.revealedCards,
        left: [],
        top: [],
        right: []
      },
      inputPurpose: 'hand',
      revealedTarget: gameMode === 'doudizhu'
        ? (landlordPosition ?? 'bottom')
        : 'left',
      revealedEntries: []
    }));
  };

  const exitHandInput = () => {
    setGameState(prev => ({
      ...prev,
      status: GameStatus.WAITING, // 返回等待状态
    }));

    setHandInput(prev => ({
      ...prev,
      isInputMode: false,
      selectedPlayerForInput: null
    }));
  };

  // 开始游戏
  const startGame = () => {
    console.log('startGame called');
    console.log('底家手牌数量:', handInput.playerHands.bottom.length);
    console.log('底家手牌:', handInput.playerHands.bottom);

    const bottomHasCards = handInput.playerHands.bottom.length > 0;

    console.log('bottomHasCards:', bottomHasCards);

    if (!bottomHasCards) {
      alert('请先录入我的手牌！\n\n操作步骤：\n1. 点击下方实体牌\n2. 点击“确认手牌”\n3. 点击“确认开始”');
      return;
    }
    if (gameMode === 'doudizhu' && !landlordPosition) {
      alert('请先选择地主是谁');
      return;
    }

    console.log('开始游戏...');

    // 更新游戏状态
    setGameState(prev => ({
      ...prev,
      status: GameStatus.PLAYING,
      players: prev.players.map(player => {
        const knownCards = handInput.playerHands[player.position] as Card[];
        return {
          ...player,
          cards: [...knownCards],
          remainingCount: getInitialCardCount(player.position),
          stats: {
            ...player.stats,
            rankCardCount: knownCards.filter(card => card.rank === currentRank).length,
            wildCardCount: knownCards.filter(card => card.isWildCard).length
          }
        };
      }),
      currentRound: { ...prev.currentRound, startTime: Date.now() },
      updatedAt: Date.now(),
    }));

    setHandInput(prev => ({
      ...prev,
      gameStarted: true,
      isInputMode: false,
      selectedPlayerForInput: null
    }));

    console.log('游戏状态已更新');
  };

  // 重新开始游戏
  const restartGame = () => {
    if (isCurrentGameImportant) {
      saveCurrentReplaySnapshot(true);
    }
    setGameState(createInitialGameState(gameMode));

    setHandInput(createInitialHandInput());

    setSelectedCards(new Set());
  };

  // 玩家切换时记录过牌
  const switchToNextPlayer = (
    currentPlayer: PlayerPosition,
    isManualSwitch: boolean = false
  ): boolean => {
    if (
      gameState.status === GameStatus.FINISHED ||
      (isManualSwitch && finishOrder.includes(currentPlayer))
    ) {
      return false;
    }

    // 获取下一个玩家
    const nextPlayer = getNextPlayer(currentPlayer);
    const shouldRecordPass = isManualSwitch &&
      gameState.status === GameStatus.PLAYING;

    if (shouldRecordPass) {
      setHandInput(previous => ({
        ...previous,
        startingPlayerSelected: true
      }));
    }

    setGameState(prev => {
      const timestamp = Date.now();
      const passRecord: PlayRecord | null = shouldRecordPass ? {
        id: `pass-${timestamp}`,
        playerPosition: currentPlayer,
        cards: [],
        type: 'pass',
        timestamp,
        isActivePlay: false,
        description: `${currentPlayer} 过牌`
      } : null;
      const nextPassCount = passRecord ? prev.currentRound.passCount + 1 : 0;
      const shouldResetTrick = nextPassCount >= activePlayerPositions.length - 1;

      return {
        ...prev,
        currentPlayerPosition: nextPlayer,
        playHistory: passRecord ? [...prev.playHistory, passRecord] : prev.playHistory,
        currentRound: passRecord
          ? {
              ...prev.currentRound,
              passCount: shouldResetTrick ? 0 : nextPassCount,
              currentMaxPlay: shouldResetTrick ? undefined : prev.currentRound.currentMaxPlay
            }
          : prev.currentRound,
        updatedAt: timestamp,
      };
    });
    return true;
  };

  // 按当前游戏座位顺序获取下一位未出完玩家。
  const getNextPlayer = (
    currentPlayer: PlayerPosition,
    history: PlayRecord[] = playHistory
  ): PlayerPosition =>
    getNextEligiblePlayer(currentPlayer, history, progressRules);

  // 原子记录一次有效出牌，供确认按钮、文本快捷指令共同调用。
  const recordPlayedCards = (
    cardIds: ReadonlySet<string>,
    playerPosition: PlayerPosition,
    implicitPassPlayers: PlayerPosition[] = []
  ): string | null => {
    if (gameState.status === GameStatus.FINISHED) {
      return '本局已经结束，如需修正请先撤销最后一次操作';
    }

    const selectedCardObjects = allCards.filter(card => cardIds.has(card.id));
    if (selectedCardObjects.length === 0) {
      return '没有可记录的牌';
    }
    const remainingCards =
      getInitialCardCount(playerPosition) -
      getPlayedCardCount(playHistory, playerPosition);
    if (remainingCards <= 0) {
      return `${getPlayerDisplayName(playerPosition)}已经出完牌`;
    }
    if (selectedCardObjects.length > remainingCards) {
      return `${getPlayerDisplayName(playerPosition)}只剩${remainingCards}张，不能记录${selectedCardObjects.length}张`;
    }

    const validation = gameMode === 'doudizhu'
      ? validateDoudizhuCardType(selectedCardObjects)
      : validateCardType(selectedCardObjects, currentRank);
    if (!validation.isValid) {
      return `出牌错误：${validation.description}`;
    }

    const timestamp = Date.now();
    const operationId = implicitPassPlayers.length > 0
      ? `voice-${timestamp}-${playerPosition}`
      : undefined;
    const implicitPassRecords: PlayRecord[] = implicitPassPlayers.map(
      (position, index) => ({
        id: `pass-${timestamp}-${index}-${position}`,
        playerPosition: position,
        cards: [],
        type: 'pass',
        timestamp: timestamp + index,
        isActivePlay: false,
        operationId,
        description: `${position} 过牌（语音自动补记）`
      })
    );
    const newPlayRecord: PlayRecord = {
      id: `play-${timestamp}-${playerPosition}`,
      playerPosition,
      cards: selectedCardObjects,
      type: normalizePlayType(validation.type, selectedCardObjects.length),
      timestamp: timestamp + implicitPassRecords.length,
      isActivePlay: true,
      operationId,
      description: `${playerPosition} 出了${selectedCardObjects.length}张牌 (${validation.description})`
    };
    const nextHistory = [
      ...playHistory,
      ...implicitPassRecords,
      newPlayRecord
    ];
    const nextPlayer = getNextPlayer(playerPosition, nextHistory);

    setHandInput(previous => ({
      ...previous,
      startingPlayerSelected: true
    }));

    setGameState(previous => ({
      ...previous,
      currentPlayerPosition: nextPlayer,
      playHistory: [
        ...previous.playHistory,
        ...implicitPassRecords,
        newPlayRecord
      ],
      allCards: previous.allCards.map(card =>
        cardIds.has(card.id) ? { ...card, isPlayed: true } : card
      ),
      players: previous.players.map(player => {
        if (player.position !== playerPosition) return player;
        const playedCardCount = getPlayedCardCount(
          nextHistory,
          playerPosition
        );
        return {
          ...player,
          remainingCount: Math.max(
            0,
            getInitialCardCount(playerPosition) - playedCardCount
          ),
          stats: {
            ...player.stats,
            playedCards: playedCardCount
          }
        };
      }),
      currentRound: {
        ...previous.currentRound,
        currentMaxPlay: newPlayRecord,
        passCount: 0
      },
      updatedAt: timestamp
    }));

    setSelectedCards(new Set());
    resetMultiSelectMode();
    return null;
  };

  // 连续语音输入使用点数选牌和牌型校验，成功后直接记牌。
  const handleVoiceCommand = (
    command: VoiceCommandAction
  ): VoiceCommandOutcome => {
    const fail = (message: string): VoiceCommandOutcome => ({
      success: false,
      message
    });
    const succeed = (message: string): VoiceCommandOutcome => ({
      success: true,
      message
    });

    if (command.action === 'undo') {
      if (playHistory.length === 0) {
        return fail('没有可以撤销的出牌或过牌');
      }
      handleUndo();
      setSelectedCards(new Set());
      return succeed('已撤销最后一次操作');
    }

    if (gameState.status !== GameStatus.PLAYING) {
      return fail('请先完成手牌录入并开始游戏');
    }

    if (!command.playerPosition) {
      return fail('语音口令缺少玩家位置，本次未记录');
    }
    if (!activePlayerPositions.includes(command.playerPosition)) {
      return fail(
        gameMode === 'doudizhu'
          ? '斗地主只支持我、下家、上家，本次未记录'
          : '该玩家不在当前牌局中，本次未记录'
      );
    }

    if (command.action === 'pass') {
      if (!switchToNextPlayer(command.playerPosition, true)) {
        return fail(
          `${getPlayerDisplayName(command.playerPosition)}已经出完牌或本局已经结束`
        );
      }
      setSelectedCards(new Set());
      return succeed(`已记录${getPlayerDisplayName(command.playerPosition)}过牌`);
    }

    if (!command.ranks?.length) {
      return fail('没有识别到有效牌面，本次未记录');
    }

    const implicitPassPlayers =
      handInput.startingPlayerSelected &&
      gameState.currentRound.currentMaxPlay
          ? getSkippedPlayersBeforeTarget(
            selectedPlayer,
            command.playerPosition,
            playHistory,
            progressRules
          )
        : [];
    if (implicitPassPlayers === null) {
      return fail(
        `${getPlayerDisplayName(command.playerPosition)}当前不能出牌，本次未记录`
      );
    }

    const explicitWildCardRanks = command.wildCardRanks ?? [];
    if (explicitWildCardRanks.length > 0) {
      if (gameMode !== 'guandan') {
        return fail('斗地主模式不支持红心配牌口令，本次未记录');
      }
      const mismatchedWildRank = explicitWildCardRanks.find(
        rank => rank !== currentRank
      );
      if (mismatchedWildRank !== undefined) {
        return fail(
          `当前打${RANK_DISPLAY_NAMES[currentRank]}，` +
          `红心${RANK_DISPLAY_NAMES[mismatchedWildRank]}不是配牌，本次未记录`
        );
      }
    }

    const selectionResult = pickCardsByVoiceRanks(
      allCards,
      command.ranks,
      explicitWildCardRanks,
      cardId => isCardSelectableForPlayer(cardId, command.playerPosition!),
      new Set<string>()
    );

    if (!selectionResult.success) {
      if (selectionResult.missingExplicitWildCard) {
        return fail(
          `${getPlayerDisplayName(command.playerPosition)}可用的红心` +
          `${RANK_DISPLAY_NAMES[selectionResult.missingRank!]}配牌不足，本次未记录`
        );
      }
      return fail(
        `${getPlayerDisplayName(command.playerPosition)}可用的` +
        `${RANK_DISPLAY_NAMES[selectionResult.missingRank!]}不足，本次未记录`
      );
    }

    const playError = recordPlayedCards(
      selectionResult.selectedIds,
      command.playerPosition,
      implicitPassPlayers
    );
    if (playError) {
      return fail(playError);
    }

    const cardLabel = command.ranks
      .map(rank => RANK_DISPLAY_NAMES[rank])
      .join(' ');
    const passNotice = implicitPassPlayers.length > 0
      ? `；已自动补记${implicitPassPlayers
          .map(getPlayerDisplayName)
          .join('、')}过牌`
      : '';
    return succeed(
      `语音记录：${getPlayerDisplayName(command.playerPosition)}出${cardLabel}${passNotice}`
    );
  };

  const setInputPurpose = (purpose: InputPurpose) => {
    setSelectedCards(new Set());
    resetMultiSelectMode();
    setHandInput(previous => ({
      ...previous,
      inputPurpose: purpose,
      selectedPlayerForInput: 'bottom'
    }));
  };

  const undoLastRevealedCard = () => {
    const entries = handInput.revealedEntries as RevealedCardRecord[];
    const lastEntry = entries[entries.length - 1];
    if (!lastEntry) return;

    setHandInput(previous => {
      const playerHands = { ...previous.playerHands };
      const revealedCards = { ...previous.revealedCards };
      playerHands[lastEntry.playerPosition] = playerHands[
        lastEntry.playerPosition
      ].filter((card: Card) => card.id !== lastEntry.card.id);
      revealedCards[lastEntry.playerPosition] = revealedCards[
        lastEntry.playerPosition
      ].filter((cardId: string) => cardId !== lastEntry.card.id);

      return {
        ...previous,
        playerHands,
        revealedCards,
        revealedEntries: entries.slice(0, -1)
      };
    });

    setGameState(previous => ({
      ...previous,
      config: {
        ...previous.config,
        tributeEnabled: entries.length > 1
      },
      updatedAt: Date.now()
    }));
    setSelectedCards(new Set());
  };

  // 确认出牌
  const handlePlayCards = () => {
    if (selectedCards.size === 0) return;

    // 开局准备：录入自己的完整手牌，或直接给任意玩家登记公开明牌。
    if (handInput.isInputMode) {
      const inputPurpose = handInput.inputPurpose as InputPurpose;

      if (
        inputPurpose === 'revealed' &&
        (handInput.revealedTarget !== 'bottom' || gameMode === 'doudizhu')
      ) {
        const entries = handInput.revealedEntries as RevealedCardRecord[];
        const target = handInput.revealedTarget as PlayerPosition;
        const revealedLimit = gameMode === 'doudizhu' ? 3 : 4;

        if (entries.length >= revealedLimit) {
          alert(
            gameMode === 'doudizhu'
              ? '斗地主最多设置3张底牌'
              : '全桌最多设置4张明牌'
          );
          setSelectedCards(new Set());
          resetMultiSelectMode();
          return;
        }
        if (gameMode === 'doudizhu' && target !== landlordPosition) {
          alert('斗地主底牌必须归属地主');
          return;
        }
        if (selectedCards.size !== 1) {
          alert('每次只能为一位玩家设置1张明牌');
          return;
        }

        const revealedCard = allCards.find(card => selectedCards.has(card.id));
        if (!revealedCard) return;
        if (getAssignedCardIds().has(revealedCard.id)) {
          alert('这张牌已经录入手牌或设置为明牌，不能重复添加');
          return;
        }

        const targetCount = entries.filter(
          entry => entry.playerPosition === target
        ).length;
        if (targetCount >= (gameMode === 'doudizhu' ? 3 : 2)) {
          alert(
            gameMode === 'doudizhu'
              ? '地主最多设置3张底牌'
              : `${getPlayerDisplayName(target)}最多只能设置2张明牌`
          );
          return;
        }

        const doubleHolder = gameMode === 'guandan' ? (
          ['left', 'top', 'right'] as PlayerPosition[]
        ).find(position =>
          entries.filter(entry => entry.playerPosition === position).length >= 2
        ) : undefined;
        if (targetCount === 1 && doubleHolder && doubleHolder !== target) {
          alert(
            `${getPlayerDisplayName(doubleHolder)}已经设置2张明牌，` +
            '不能再让另一家设置第2张'
          );
          return;
        }

        const revealedEntry: RevealedCardRecord = {
          id: `revealed-${Date.now()}-${revealedCard.id}`,
          playerPosition: target,
          card: revealedCard,
          timestamp: Date.now()
        };

        setHandInput(previous => {
          const playerHands = { ...previous.playerHands };
          const revealedCards = { ...previous.revealedCards };
          playerHands[target] = [...playerHands[target], revealedCard];
          revealedCards[target] = [...revealedCards[target], revealedCard.id];

          return {
            ...previous,
            playerHands,
            revealedCards,
            revealedEntries: [...previous.revealedEntries, revealedEntry]
          };
        });
        setGameState(previous => ({
          ...previous,
          config: {
            ...previous.config,
            tributeEnabled: true
          },
          updatedAt: Date.now()
        }));
        setSelectedCards(new Set());
        resetMultiSelectMode();
        return;
      }

      const selectedCardIds = Array.from(selectedCards);
      const playerPos: PlayerPosition = 'bottom';
      const currentCards = handInput.playerHands[playerPos];

      const maxCards = getInitialCardCount('bottom');

      if (currentCards.length + selectedCardIds.length > maxCards) {
        alert(`我的手牌最多只能录入${maxCards}张！`);
        return;
      }

      // 添加选中的卡牌到玩家手牌和明牌列表
      const assignedCardIds = getAssignedCardIds();
      const duplicateCard = selectedCardIds.find(cardId =>
        assignedCardIds.has(cardId)
      );
      if (duplicateCard) {
        alert('这张牌已经录入或登记为公开牌，不能重复添加');
        return;
      }

      const selectedCardObjects = allCards.filter(card => selectedCards.has(card.id));
      const newSelectedCardIds = selectedCardObjects.map(card => card.id);
      setHandInput(prev => ({
        ...prev,
        playerHands: {
          ...prev.playerHands,
          [playerPos]: [...currentCards, ...selectedCardObjects]
        },
        revealedCards: {
          ...prev.revealedCards,
          [playerPos]: [...prev.revealedCards[playerPos], ...newSelectedCardIds]
        }
      }));

      // 清空选择
      setSelectedCards(new Set());
      resetMultiSelectMode();

      // 手牌输入始终保持在“我”，其他三家只能通过出牌过程推理。
      setHandInput(prev => ({
        ...prev,
        selectedPlayerForInput: 'bottom'
      }));

      return;
    }

    const playError = recordPlayedCards(selectedCards, selectedPlayer);
    if (playError) {
      alert(playError);
    }
  };

  // 取消选择
  const handleCancelSelection = () => {
    setSelectedCards(new Set());
    resetMultiSelectMode();
  };

  // 撤销出牌
  const handleUndo = () => {
    if (playHistory.length === 0) {
      return; // 没有可撤销的出牌时静默返回
    }

    // 同一语音操作产生的隐式过牌和实际出牌作为一个原子操作撤销。
    setGameState(previous => undoLastGameOperation(previous));

    // 直接完成撤销，不显示提示
  };

  // 计算游戏时长
  const getGameDuration = (): string => {
    if (!gameState.currentRound.startTime) return '00:00';

    const duration = Date.now() - gameState.currentRound.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 计算剩余卡牌数
  const getRemainingCards = (): number => {
    return allCards.filter(card => !card.isPlayed).length;
  };

  // 检查游戏是否结束以及获胜玩家
  const checkGameEnd = (): {
    isGameEnd: boolean;
    winners: PlayerPosition[];
    winningTeam?: 1 | 2;
  } => ({
    isGameEnd: gameProgress.isGameEnd,
    winners: gameProgress.finishOrder,
    winningTeam: gameProgress.winningTeam ?? undefined
  });

  // 游戏结束处理
  useEffect(() => {
    if (gameState.status === GameStatus.PLAYING) {
      const {
        isGameEnd,
        finishOrder: winners,
        winningTeam
      } = getGameProgress(playHistory, progressRules);
      if (isGameEnd) {
        setGameState(prev => ({
          ...prev,
          status: GameStatus.FINISHED,
          updatedAt: Date.now(),
        }));

        let gameEndMessage = '🎉 游戏结束！\n';

        if (gameMode === 'doudizhu') {
          const landlordWon = winners[0] === landlordPosition;
          gameEndMessage += landlordWon
            ? `🏆 地主${getPlayerDisplayName(landlordPosition!)}胜利！\n`
            : '🏆 农民胜利！\n';
        } else if (winningTeam) {
          // 团队胜利
          if (winningTeam === 1) {
            gameEndMessage += '🏆 我和对家包揽头游、二游！\n';
            gameEndMessage += '获胜组合：我 + 对家\n';
          } else {
            gameEndMessage += '😔 下家和上家包揽头游、二游！\n';
            gameEndMessage += '获胜组合：下家 + 上家\n';
          }
        } else {
          // 传统胜利（三家出完）
          const rankingText = winners
            .slice(0, 3)
            .map(
              (position, index) =>
                `${FINISH_LABELS[index]}：${getPlayerDisplayName(position)}`
            )
            .join('；');
          gameEndMessage += `${rankingText}\n`;
        }

        const elapsed = gameState.currentRound.startTime
          ? Date.now() - gameState.currentRound.startTime
          : 0;
        const elapsedMinutes = Math.floor(elapsed / 60000);
        const elapsedSeconds = Math.floor((elapsed % 60000) / 1000);
        const durationLabel = `${elapsedMinutes
          .toString()
          .padStart(2, '0')}:${elapsedSeconds
          .toString()
          .padStart(2, '0')}`;
        gameEndMessage += `游戏时长: ${durationLabel}\n总动作记录: ${playHistory.length}`;

        alert(gameEndMessage);
      }
    }
  }, [
    gameMode,
    gameState.status,
    gameState.currentRound.startTime,
    landlordPosition,
    progressRules,
    playHistory
  ]);

  // 不需要分组，直接竖向排列

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部栏 */}
      <header className="border-b border-gray-200 bg-white px-2 py-2 shadow-sm sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <h1 className="whitespace-nowrap text-lg font-bold text-gray-800 sm:text-xl">
              {gameMode === 'doudizhu' ? '斗地主记牌器' : '掼蛋记牌器'}
            </h1>

            <div className="flex rounded-lg bg-slate-100 p-1">
              {([['guandan', '掼蛋'], ['doudizhu', '斗地主']] as Array<[GameMode, string]>).map(
                ([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => switchGameMode(mode)}
                    disabled={gameState.status !== GameStatus.WAITING}
                    className={`min-h-9 rounded-md px-3 text-sm font-bold transition-colors ${
                      gameMode === mode
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            {gameMode === 'doudizhu' && (
              gameState.status === GameStatus.WAITING ? (
                <div className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 p-1">
                  <span className="px-1 text-xs font-bold text-amber-900">地主：</span>
                  {activePlayerPositions.map(position => (
                    <button
                      key={`landlord-${position}`}
                      type="button"
                      onClick={() => selectLandlord(position)}
                      className={`min-h-8 rounded px-2 text-xs font-black ${
                        landlordPosition === position
                          ? 'bg-amber-500 text-white'
                          : 'bg-white text-amber-900'
                      }`}
                    >
                      {getPlayerDisplayName(position)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-amber-100 px-2 py-1 text-sm font-bold text-amber-900">
                  地主：{landlordPosition ? getPlayerDisplayName(landlordPosition) : '未选择'}
                </div>
              )
            )}

            {/* 游戏状态信息 */}
            {(gameState.status === GameStatus.PLAYING || gameState.status === GameStatus.FINISHED) && (
              <div className="flex flex-wrap items-center gap-2 text-sm sm:gap-3">
                <div className={`px-2 py-1 rounded ${
                  gameState.status === GameStatus.FINISHED
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {gameState.status === GameStatus.FINISHED ?
                    (() => {
                      const { winningTeam } = checkGameEnd();
                      if (gameMode === 'doudizhu') {
                        return finishOrder[0] === landlordPosition
                          ? `🏆 地主${getPlayerDisplayName(landlordPosition!)}胜利`
                          : '🏆 农民胜利';
                      }
                      if (winningTeam === 1) return '🏆 我和对家胜利';
                      if (winningTeam === 2) return '😔 下家和上家胜利';
                      return '🏆 游戏结束';
                    })() :
                    '🎮 第' + gameState.currentRound.roundNumber + '局'
                  }
                </div>
                <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  ⏱️ {getGameDuration()}
                </div>
                <div className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                  📊 {playHistory.length}次记录
                </div>
                <div className="bg-orange-100 text-orange-700 px-2 py-1 rounded">
                  🃏 {getRemainingCards()}张剩余
                </div>
              </div>
            )}

            {/* 级数选择 */}
            {gameMode === 'guandan' && (
            <div className="flex items-center gap-2 rounded-lg bg-white p-1.5 shadow-sm sm:p-2">
              <span className="text-sm font-medium text-gray-700">打几:</span>
              <select
                value={currentRank}
                onChange={event =>
                  handleCurrentRankChange(
                    parseInt(event.target.value, 10) as GameRank
                  )
                }
                className="bg-blue-50 border border-blue-200 rounded px-3 py-1 text-sm font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={
                  gameState.status === GameStatus.PLAYING ||
                  gameState.status === GameStatus.FINISHED
                }
              >
                {([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as GameRank[]).map(rank => (
                  <option key={rank} value={rank}>
                    {rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : rank === 14 ? 'A' : rank}
                  </option>
                ))}
              </select>
            </div>
            )}
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            {gameState.status === GameStatus.PLAYING || gameState.status === GameStatus.FINISHED ? (
              // 游戏进行中或已结束
              <div className="flex items-center gap-2">
                <button
                  onClick={restartGame}
                  className="min-h-11 rounded bg-red-500 px-2 py-2 text-sm text-white transition-colors hover:bg-red-600 sm:min-h-0 sm:px-3"
                  title="重新开始游戏"
                >
                  🔄 重新开始
                </button>
              </div>
            ) : gameState.status === GameStatus.INPUT ? (
              // 手牌输入模式
              <div className="flex flex-wrap items-center gap-2">
                {gameMode === 'doudizhu' && (
                  <div
                    data-testid="doudizhu-opening-input-switch"
                    className="flex rounded-lg border border-amber-200 bg-amber-50 p-1"
                  >
                    <button
                      type="button"
                      onClick={() => setInputPurpose('hand')}
                      className={`min-h-9 rounded-md px-3 text-sm font-bold transition-colors ${
                        handInput.inputPurpose === 'hand'
                          ? 'bg-orange-600 text-white shadow-sm'
                          : 'bg-white text-orange-800'
                      }`}
                    >
                      录我的手牌
                    </button>
                    <button
                      type="button"
                      data-testid="doudizhu-bottom-cards-button"
                      onClick={() => setInputPurpose('revealed')}
                      className={`min-h-9 rounded-md px-3 text-sm font-bold transition-colors ${
                        handInput.inputPurpose === 'revealed'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-white text-red-700'
                      }`}
                    >
                      录地主底牌
                    </button>
                  </div>
                )}
                <button
                  onClick={startGame}
                  className={`min-h-11 rounded px-2 py-2 text-sm transition-colors sm:min-h-0 sm:px-3 ${
                    handInput.playerHands.bottom.length === 0
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                  disabled={handInput.playerHands.bottom.length === 0}
                  title={handInput.playerHands.bottom.length === 0 ? '请先录入我的手牌' : '开始游戏'}
                >
                  🎮 确认开始
                  {handInput.playerHands.bottom.length === 0
                    ? '(需要我的手牌)'
                    : ''}
                </button>
                <button
                  onClick={exitHandInput}
                  className="min-h-11 rounded bg-gray-500 px-2 py-2 text-sm text-white transition-colors hover:bg-gray-600 sm:min-h-0 sm:px-3"
                >
                  取消
                </button>
              </div>
            ) : (
              // 初始等待模式
              <div className="flex items-center gap-2">
                <button
                  onClick={startHandInput}
                  disabled={gameMode === 'doudizhu' && !landlordPosition}
                  className="min-h-11 rounded bg-green-500 px-2 py-2 text-sm text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-400 sm:min-h-0 sm:px-3"
                >
                  🎮 {gameMode === 'doudizhu' && !landlordPosition
                    ? '请先选择地主'
                    : '开始游戏'}
                </button>
              </div>
            )}

            {/* 历史游戏按钮 */}
            <button
              onClick={() => setShowGameHistory(true)}
              className="min-h-11 rounded bg-indigo-500 px-2 py-2 text-sm text-white transition-colors hover:bg-indigo-600 sm:min-h-0 sm:px-3"
              title="查看历史游戏记录"
            >
              📂 历史
            </button>

            {/* 回放按钮 */}
            <button
              onClick={openCurrentReplay}
              disabled={playHistory.length === 0}
              className="min-h-11 rounded bg-purple-500 px-2 py-2 text-sm text-white transition-colors hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:px-3"
              title={
                playHistory.length === 0
                  ? '产生出牌或过牌记录后可回放'
                  : `按顺序回放${playHistory.length}次操作`
              }
            >
              🎬 回放{playHistory.length > 0 ? `(${playHistory.length})` : ''}
            </button>

            {(gameState.status === GameStatus.PLAYING ||
              gameState.status === GameStatus.FINISHED) && (
              <button
                onClick={toggleCurrentGameImportant}
                className={`min-h-11 rounded border px-2 py-2 text-sm font-bold transition-colors sm:min-h-0 sm:px-3 ${
                  isCurrentGameImportant
                    ? 'border-amber-500 bg-amber-400 text-amber-950 hover:bg-amber-300'
                    : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
                title={
                  isCurrentGameImportant
                    ? '本局正在持续保存；点击取消重要标记'
                    : '固定保存本局并持续同步，随时可以复盘'
                }
              >
                {isCurrentGameImportant ? '★ 已重要' : '☆ 重要'}
              </button>
            )}

            {/* AI助手切换按钮 */}
            <button
              onClick={() => setShowAIAssistant(!showAIAssistant)}
              className={`min-h-11 rounded px-2 py-2 text-sm transition-colors sm:min-h-0 sm:px-3 ${
                showAIAssistant
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
              title="AI智能助手"
            >
              🤖 AI助手
            </button>

            <a
              href="/clear-cache.html"
              className="inline-flex min-h-11 items-center rounded border border-amber-200 bg-amber-50 px-2 py-2 text-sm font-bold text-amber-800 transition-colors hover:bg-amber-100 sm:min-h-0 sm:px-3"
              title="更新程序缓存并保留牌局数据"
            >
              ↻ 更新
            </a>

            <button
              type="button"
              onClick={() => setShowInstructions(true)}
              className="min-h-11 rounded border border-sky-200 bg-sky-50 px-2 py-2 text-sm font-bold text-sky-800 transition-colors hover:bg-sky-100 sm:min-h-0 sm:px-3"
              title="查看程序使用方法和语音输入规则"
            >
              ？使用说明
            </button>
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <main className="max-w-6xl mx-auto p-4">
        <div className="space-y-4">
          {/* 玩家信息区域 */}
          <div className={`grid gap-2 ${gameMode === 'doudizhu' ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {players.map(player => {
              const shouldShowPlayerSelection =
                gameState.status === GameStatus.WAITING ||
                handInput.startingPlayerSelected;
              const isSelected =
                shouldShowPlayerSelection &&
                selectedPlayer === player.position;
              const playerStats = getPlayerCardStats(player.position);
              const finishIndex = finishOrder.indexOf(player.position);
              const isWinner = finishIndex >= 0;
              const finishLabel = gameMode === 'doudizhu'
                ? '胜出'
                : (FINISH_LABELS[finishIndex] ?? '已出完');

              return (
                <div
                  key={player.id}
                  data-testid={`player-panel-${player.position}`}
                  title={
                    isWinner
                      ? `${getPlayerDisplayName(player.position)}已获${
                          finishLabel
                        }`
                      : handInput.isInputMode
                      ? `选择${getPlayerDisplayName(player.position)}首出`
                      : `选择${getPlayerDisplayName(player.position)}`
                  }
                  className={`relative p-2 rounded-lg transition-all ${
                    isWinner && gameState.status !== GameStatus.INPUT
                      ? 'cursor-default'
                      : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-500 shadow-md'
                      : 'bg-white border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
                  }`}
                  onClick={() => selectActivePlayer(player.position)}
                  style={{
                    borderColor: isSelected ? '#3b82f6' : playerColors[player.position],
                    borderWidth: isSelected ? '2px' : '1px'
                  }}
                >
                  {/* 游次标志 */}
                  {isWinner && (
                    <div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2">
                      <div className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800 shadow">
                        {finishLabel}
                      </div>
                    </div>
                  )}

                  {/* 玩家颜色标识 */}
                  <div className="absolute right-1 top-1 flex items-center gap-1">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: playerColors[player.position] }}
                    />
                  </div>

                  <div className={`mb-1 text-base font-black leading-tight ${isWinner ? 'text-yellow-600' : 'text-gray-800'}`}>
                    {getPlayerDisplayName(player.position)}
                    {gameMode === 'doudizhu' && landlordPosition === player.position && (
                      <span className="ml-1 rounded bg-amber-500 px-1 py-0.5 text-[10px] font-black text-white">
                        地主
                      </span>
                    )}
                    {handInput.isInputMode &&
                      handInput.startingPlayerSelected &&
                      isSelected && (
                      <span className="ml-1 rounded bg-blue-600 px-1 py-0.5 text-[10px] font-bold text-white">
                        首出
                      </span>
                    )}
                  </div>
                  {handInput.isInputMode ? (
                    player.position === 'bottom' ? (
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <div className="text-center">
                          <div className="text-xl font-bold text-blue-600">{playerStats.played}</div>
                          <div className="text-gray-500 text-xs">已录</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-green-600">
                            {Math.max(
                              0,
                              getInitialCardCount(player.position) - playerStats.played
                            )}
                          </div>
                          <div className="text-gray-500 text-xs">未录</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-10 items-center justify-center text-center text-xs font-medium text-gray-500">
                        {playerStats.played > 0
                          ? `${playerStats.played}张明牌`
                          : '出牌后推理'}
                      </div>
                    )
                  ) : (
                    // 正常模式显示
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className="text-center">
                        <div className="text-xl font-bold text-red-600">{playerStats.played}</div>
                        <div className="text-gray-500 text-xs">已出</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-600">{playerStats.remaining}</div>
                        <div className="text-gray-500 text-xs">剩余</div>
                      </div>
                    </div>
                  )}
                  {(gameState.status === GameStatus.PLAYING ||
                    gameState.status === GameStatus.FINISHED) &&
                    player.position !== 'bottom' && (
                    <PlayerInferenceStrip
                      chips={inferenceViewModel.playerChips[player.position]}
                    />
                  )}
                  {isSelected && (
                    <div className="absolute -top-1 -left-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 撤销操作区域 */}
          <div className="flex justify-center space-x-4">
            {/* 撤销选牌按钮 */}
            {selectedCards.size > 0 && (
              <button
                onClick={handleCancelSelection}
                className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 transition-colors"
              >
                🔄 撤销选牌 ({selectedCards.size}张)
              </button>
            )}

            {/* 撤销出牌按钮 */}
            {playHistory.length > 0 && gameState.status !== GameStatus.INPUT && (
              <button
                onClick={handleUndo}
                className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors"
              >
                ↶ 撤销操作 ({playHistory.length}次可撤销)
              </button>
            )}

            {/* 手牌输入模式的撤销按钮 */}
            {handInput.isInputMode &&
             (handInput.inputPurpose === 'hand' ||
               (gameMode === 'guandan' && handInput.revealedTarget === 'bottom')) &&
             handInput.playerHands.bottom.length > 0 && (
              <button
                onClick={() => {
                  const currentPlayer: PlayerPosition = 'bottom';
                  const lastCard = handInput.playerHands[currentPlayer].slice(-1)[0];
                  if (lastCard) {
                    setHandInput(prev => ({
                      ...prev,
                      playerHands: {
                        ...prev.playerHands,
                        [currentPlayer]: prev.playerHands[currentPlayer].filter((card: Card) => card.id !== lastCard.id)
                      },
                      revealedCards: {
                        ...prev.revealedCards,
                        [currentPlayer]: prev.revealedCards[currentPlayer].filter(id => id !== lastCard.id)
                      }
                    }));
                  }
                }}
                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
              >
                ⬅️ 撤销最后一张手牌
              </button>
            )}
          </div>

          {/* 当前玩家提示和切换按钮 */}
          {gameState.status === GameStatus.FINISHED ? (
            <div
              data-testid="game-finish-summary"
              className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 px-3 py-3 text-center shadow-sm"
            >
              <div className="text-sm font-black text-amber-900">
                本局结束
                {gameMode === 'doudizhu'
                  ? finishOrder[0] === landlordPosition
                    ? ' · 地主胜利'
                    : ' · 农民胜利'
                  : gameProgress.winningTeam
                    ? ' · 头游、二游为同队'
                    : ' · 三游已产生'}
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {finishOrder.slice(0, 3).map((position, index) => (
                  <span
                    key={position}
                    data-testid={`finish-rank-${index + 1}`}
                    className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-bold text-amber-900 shadow-sm"
                  >
                    {gameMode === 'doudizhu' ? '胜出' : FINISH_LABELS[index]} · {getPlayerDisplayName(position)}
                  </span>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-amber-700">
                如记录有误，可点击上方“撤销操作”继续修正
              </div>
            </div>
          ) : gameState.status === GameStatus.PLAYING ? (
            !handInput.startingPlayerSelected ? (
              <div
                data-testid="choose-first-player-prompt"
                className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-center text-sm font-bold text-orange-800"
              >
                请点击上方{gameMode === 'doudizhu' ? '三家' : '四家'}牌面，选择实际出牌方
              </div>
            ) : null
          ) : gameState.status === GameStatus.INPUT ? (
            <div
              data-testid="opening-input-controls"
              className="space-y-2 rounded-xl border border-orange-200 bg-orange-50 p-3"
            >
              <div className="text-center text-xs font-medium text-orange-900">
                首家出牌：
                <span
                  data-testid="starting-player-label"
                  className={`mx-1 rounded-full px-2 py-1 font-bold text-white ${
                    handInput.startingPlayerSelected
                      ? 'bg-blue-600'
                      : 'bg-gray-500'
                  }`}
                >
                  {handInput.startingPlayerSelected
                    ? getPlayerDisplayName(selectedPlayer)
                    : '尚未选择'}
                </span>
                可在开始前选择，也可开始后再选
              </div>

              <div className="grid grid-cols-2 gap-2">
                {([
                  ['hand', '我的手牌'],
                  ['revealed', gameMode === 'doudizhu' ? '地主底牌' : '明牌']
                ] as Array<[InputPurpose, string]>).map(([purpose, label]) => (
                  <button
                    key={purpose}
                    type="button"
                    data-testid={`input-purpose-${purpose}`}
                    onClick={() => setInputPurpose(purpose)}
                    className={`min-h-10 rounded-lg px-2 py-2 text-sm font-bold ${
                      handInput.inputPurpose === purpose
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'border border-orange-200 bg-white text-orange-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {handInput.inputPurpose === 'hand' ? (
                <div className="text-center text-xs text-gray-600">
                  正在录入我的手牌（{handInput.playerHands.bottom.length}/
                  {getInitialCardCount('bottom')}张）；
                  其他{gameMode === 'doudizhu' ? '两家' : '三家'}仅通过公开牌和出牌过程推理
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="mx-auto block w-fit text-left text-xs text-gray-600">
                    明牌属于
                    <select
                      data-testid="revealed-target-player"
                      aria-label="明牌所属玩家"
                      value={handInput.revealedTarget}
                      onChange={event => {
                        setSelectedCards(new Set());
                        resetMultiSelectMode();
                        setHandInput(previous => ({
                          ...previous,
                          revealedTarget: event.target.value as PlayerPosition
                        }));
                      }}
                      className="mt-1 block min-h-10 rounded-lg border border-orange-200 bg-white px-3 text-sm font-medium text-gray-800"
                    >
                      {activePlayerPositions
                        .filter(position =>
                          gameMode === 'guandan' || position === landlordPosition
                        )
                        .map(
                        position => (
                          <option key={position} value={position}>
                            {getPlayerDisplayName(position)}
                            {gameMode === 'doudizhu'
                              ? '（地主底牌）'
                              : position === 'bottom'
                                ? '（直接计入手牌）'
                                : ''}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                  <div className="text-center text-xs text-orange-800">
                    {gameMode === 'doudizhu'
                      ? `点击下方1张实体牌，为地主${getPlayerDisplayName(
                          landlordPosition!
                        )}登记底牌`
                      : handInput.revealedTarget === 'bottom'
                      ? '我的牌直接计入手牌，不占明牌名额'
                      : `点击下方1张实体牌，为${getPlayerDisplayName(
                          handInput.revealedTarget
                        )}确认明牌`}
                    （公开牌
                    {(handInput.revealedEntries as RevealedCardRecord[]).length}
                    /{gameMode === 'doudizhu' ? 3 : 4}张）
                  </div>
                  <div className="text-center text-[11px] text-gray-600">
                    {gameMode === 'doudizhu'
                      ? '三张底牌全部归属地主，可逐张录入'
                      : '每家通常1张；允许其中一家设置2张，其余各家仍最多1张'}
                  </div>
                </div>
              )}

              {(handInput.revealedEntries as RevealedCardRecord[]).length > 0 && (
                <div
                  data-testid="revealed-card-list"
                  className="rounded-lg border border-orange-200 bg-white p-2"
                >
                  <div className="flex flex-wrap justify-center gap-1">
                    {(handInput.revealedEntries as RevealedCardRecord[]).map(
                      entry => (
                        <span
                          key={entry.id}
                          className="rounded-full bg-orange-100 px-2 py-1 text-xs text-orange-900"
                        >
                          {getPlayerDisplayName(entry.playerPosition)}：
                          {entry.card.displayName}
                        </span>
                      )
                    )}
                  </div>
                  <button
                    type="button"
                    data-testid="undo-revealed-card"
                    onClick={undoLastRevealedCard}
                    className="mt-2 min-h-10 w-full rounded-lg bg-gray-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    撤销上一张明牌
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {/* 牌面选择区域 */}
          <div className={`bg-white rounded-lg shadow-sm ${isTouchDevice ? 'p-2' : 'p-4'}`}>
            {/* 手机端快速输入提示 */}
            {isTouchDevice && (
              <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {handInput.isInputMode
                  ? handInput.inputPurpose === 'hand'
                    ? '可连续快速点击，也可横向划过多张牌录入手牌'
                    : gameMode === 'doudizhu'
                      ? '每次点1张牌，确认后登记为地主底牌'
                    : handInput.revealedTarget === 'bottom'
                      ? '选择“我”时可横向划选，卡牌直接计入手牌'
                      : '选择一家后每次点1张牌，确认后直接登记为明牌'
                  : '先点上方或下方玩家，再横向划过多张牌，最后确认出牌'}
              </div>
            )}

            {/* 选择状态提示 */}
            {selectedCards.size > 0 && (
              <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-700 font-medium">
                    {getPlayerDisplayName(selectedPlayer)}已选择{selectedCards.size}张牌
                  </span>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={handleCancelSelection}
                    className="min-h-11 rounded bg-gray-500 px-3 py-1 text-sm text-white transition-colors hover:bg-gray-600 sm:min-h-0"
                  >
                    取消
                  </button>
                  <button
                    onClick={handlePlayCards}
                    className="min-h-11 rounded bg-blue-500 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-600 sm:min-h-0"
                  >
                    {handInput.isInputMode
                      ? handInput.inputPurpose === 'revealed' &&
                        (handInput.revealedTarget !== 'bottom' || gameMode === 'doudizhu')
                        ? (gameMode === 'doudizhu' ? '确认底牌' : '确认明牌')
                        : '确认手牌'
                      : '确认出牌'}
                  </button>
                </div>
              </div>
            )}



            {/* 牌面选择区域：恢复四家同屏时使用的完整实体牌面 */}
            <div
              data-testid="physical-card-grid"
              className="select-none p-1"
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleCardGridTouchStart}
              onTouchMove={handleCardGridTouchMove}
              onTouchEnd={finishCardGridTouch}
              onTouchCancel={finishCardGridTouch}
              style={{ touchAction: 'pan-y' }}
            >
              {(() => {
                const cardGroups: Record<string, Card[]> = {};

                allCards.forEach(card => {
                  const groupKey =
                    card.rank === Rank.JOKER_SMALL || card.rank === Rank.JOKER_BIG
                      ? 'joker'
                      : card.rank.toString();
                  if (!cardGroups[groupKey]) {
                    cardGroups[groupKey] = [];
                  }
                  cardGroups[groupKey].push(card);
                });

                const groupOrder: string[] = [];
                for (let rank = 2; rank <= 14; rank++) {
                  if (
                    (gameMode === 'doudizhu' || rank !== currentRank) &&
                    cardGroups[rank.toString()]
                  ) {
                    groupOrder.push(rank.toString());
                  }
                }
                if (gameMode === 'guandan' && cardGroups[currentRank.toString()]) {
                  groupOrder.push(currentRank.toString());
                }
                if (cardGroups.joker) {
                  groupOrder.push('joker');
                }

                return groupOrder.map(groupKey => {
                  const groupCards = cardGroups[groupKey];
                  return (
                    <div
                      key={groupKey}
                      data-testid={`physical-card-row-${groupKey}`}
                      className="relative mb-0.5"
                    >
                      <div className="grid grid-cols-8 gap-0.5">
                        {groupCards.map(card => {
                          const isSelected = selectedCards.has(card.id);
                          const isPlayed = card.isPlayed;
                          const playRecord = isPlayed
                            ? playHistory.find(record =>
                                record.cards.some(playedCard => playedCard.id === card.id)
                              )
                            : undefined;
                          const playerColor = playRecord
                            ? playerColors[playRecord.playerPosition]
                            : undefined;
                          const knownOwnership =
                            inferenceViewModel.knownOwnership[card.id];
                          const inferredOwnership =
                            inferenceViewModel.inferredOwnership[card.id];

                          let assignedPlayer: PlayerPosition | null = null;
                          if (
                            handInput.isInputMode ||
                            gameState.status === GameStatus.PLAYING ||
                            gameState.status === GameStatus.FINISHED
                          ) {
                            for (
                              const [player, hands] of Object.entries(
                                handInput.playerHands
                              ) as Array<[PlayerPosition, Card[]]>
                            ) {
                              if (hands.some(handCard => handCard.id === card.id)) {
                                assignedPlayer = player;
                                break;
                              }
                            }
                          }

                          const cardSelectable = isCardSelectable(card.id);

                          return (
                            <div
                              key={card.id}
                              data-testid={`physical-card-${card.id}`}
                              data-card-id={card.id}
                              data-rank-card={card.isRankCard ? 'true' : 'false'}
                              data-wild-card={card.isWildCard ? 'true' : 'false'}
                              className={`relative flex-shrink-0 ${
                                isPlayed
                                  ? 'cursor-not-allowed'
                                  : !cardSelectable &&
                                      (gameState.status === GameStatus.PLAYING ||
                                        gameState.status === GameStatus.FINISHED)
                                    ? 'cursor-not-allowed opacity-60'
                                    : ''
                              }`}
                              style={{
                                backgroundColor: isPlayed
                                  ? playerColor
                                  : assignedPlayer
                                    ? assignedPlayer === 'bottom'
                                      ? '#fbbf24'
                                      : playerColors[assignedPlayer]
                                    : 'transparent',
                                borderRadius: isPlayed || assignedPlayer ? '8px' : '0px',
                                padding: isPlayed || assignedPlayer ? '2px' : '0px',
                                opacity: isPlayed ? 0.7 : assignedPlayer ? 0.9 : 1
                              }}
                            >
                              <CardImage
                                rank={card.rank}
                                suit={card.suit ?? 'joker'}
                                displayName={card.displayName}
                                isWildCard={card.isWildCard}
                                isRankCard={card.isRankCard}
                                isSelected={isSelected}
                                remainingCount={1}
                                size={isTouchDevice ? 'small' : 'medium'}
                                onClick={event => {
                                  if (event && !isPlayed) {
                                    if (isTouchDevice) {
                                      if (suppressNextTouchClickRef.current) {
                                        return;
                                      }
                                      handleCardTouch(card.id);
                                    } else {
                                      handleCardClick(card.id, event);
                                    }
                                  }
                                }}
                                onMouseDown={event => {
                                  if (
                                    !isTouchDevice &&
                                    !isPlayed &&
                                    !(event?.ctrlKey || event?.metaKey)
                                  ) {
                                    handleMouseDown(card.id, event);
                                  }
                                }}
                                onMouseEnter={() =>
                                  !isPlayed && handleMouseEnter(card.id)
                                }
                                className={`flex-shrink-0 ${
                                  isPlayed ? 'pointer-events-none' : ''
                                }`}
                              />

                              {isPlayed && playRecord && (
                                <>
                                  <div
                                    className="absolute inset-0 rounded-lg"
                                    style={{
                                      backgroundColor: playerColor,
                                      opacity: 0.3,
                                      pointerEvents: 'none'
                                    }}
                                  />
                                </>
                              )}

                              {!isPlayed && assignedPlayer && (
                                <>
                                  <div
                                    className="absolute inset-0 rounded-lg"
                                    style={{
                                      backgroundColor:
                                        assignedPlayer === 'bottom'
                                          ? '#fbbf24'
                                          : playerColors[assignedPlayer],
                                      opacity: 0.2,
                                      pointerEvents: 'none'
                                    }}
                                    title={`${getPlayerDisplayName(assignedPlayer)}手牌`}
                                  />
                                </>
                              )}
                              <KnownOwnerOverlay
                                ownership={knownOwnership}
                                inference={inferredOwnership}
                              />
                              {!knownOwnership && assignedPlayer && (
                                <div
                                  className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 truncate rounded-b-md px-0.5 py-0.5 text-center text-[9px] font-bold leading-none text-white"
                                  style={{
                                    backgroundColor:
                                      assignedPlayer === 'bottom'
                                        ? '#b45309'
                                        : playerColors[assignedPlayer]
                                  }}
                                  title={`${getPlayerDisplayName(assignedPlayer)}的牌`}
                                >
                                  {getPlayerDisplayName(assignedPlayer)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* 牌面底部快捷选择：手机无需再滑回顶部切换出牌方。 */}
            {gameState.status !== GameStatus.FINISHED && (
              <div
                data-testid="bottom-player-selector"
                className={`sticky z-40 mt-3 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-[0_-4px_16px_rgba(15,23,42,0.10)] backdrop-blur ${
                  showAIAssistant ? 'bottom-20' : 'bottom-2'
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
                  <span className="text-[11px] font-bold text-slate-600">
                    {gameState.status === GameStatus.INPUT
                      ? '选择首家出牌'
                      : '选择出牌方'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    上下两处均可选择
                  </span>
                </div>
                <div className={`grid gap-1.5 ${gameMode === 'doudizhu' ? 'grid-cols-3' : 'grid-cols-4'}`}>
                  {players.map(player => {
                    const isSelected =
                      handInput.startingPlayerSelected &&
                      selectedPlayer === player.position;
                    const playerHasFinished =
                      finishOrder.includes(player.position) &&
                      gameState.status === GameStatus.PLAYING;

                    return (
                      <button
                        key={`bottom-selector-${player.position}`}
                        type="button"
                        data-testid={`bottom-player-${player.position}`}
                        disabled={playerHasFinished}
                        onClick={() => selectActivePlayer(player.position)}
                        className={`min-h-11 rounded-lg border px-1 py-2 text-sm font-black transition-colors ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                            : 'border-slate-200 bg-slate-50 text-slate-700 active:bg-slate-200'
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                        style={
                          isSelected
                            ? undefined
                            : { borderColor: playerColors[player.position] }
                        }
                        aria-pressed={isSelected}
                      >
                        {getPlayerDisplayName(player.position)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 使用说明：原牌面下方的常驻说明集中到这里。 */}
      {showInstructions && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="instructions-title"
          onClick={() => setShowInstructions(false)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2
                  id="instructions-title"
                  className="text-lg font-black text-slate-900"
                >
                  {gameMode === 'doudizhu' ? '斗地主使用说明' : '掼蛋使用说明'}
                </h2>
                <p className="text-xs text-slate-500">
                  {gameMode === 'doudizhu'
                    ? '三人一副牌：先选地主，再录入手牌和三张底牌'
                    : '四人两副牌：录入手牌后持续记牌、推理并复盘'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="min-h-11 min-w-11 rounded-full bg-slate-100 text-xl font-bold text-slate-600"
                aria-label="关闭使用说明"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-4 py-4 text-sm text-slate-700">
              <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm">
                <h3 className="mb-2 font-black text-amber-950">程序更新与清缓存</h3>
                <div className="space-y-2 text-xs leading-5 text-amber-950">
                  <p>如果新语音规则、按钮或牌面没有出现，说明手机仍在使用旧 Service Worker 或旧静态资源。</p>
                  <a
                    href="/clear-cache.html"
                    className="inline-flex min-h-11 items-center rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-700"
                  >
                    更新程序（保留牌局）
                  </a>
                  <p>该操作只注销旧 Service Worker 并清除程序缓存，不删除当前牌局和历史记录。</p>
                </div>
              </section>

              {gameMode === 'doudizhu' ? (
                <>
                  <section>
                    <h3 className="mb-2 font-black text-slate-900">斗地主：按这5步使用</h3>
                    <ol className="space-y-2">
                      <li><strong>第一步：</strong>切换到“斗地主”，选择地主（我、下家或上家）。</li>
                      <li><strong>第二步：</strong>点击“开始游戏”，先用“录我的手牌”录入地主或农民的17张手牌。</li>
                      <li><strong>第三步：</strong>点击“录地主底牌”，逐张选择并确认3张底牌；底牌自动归属地主。地主共20张，农民各17张。</li>
                      <li><strong>第四步：</strong>每轮先选择实际出牌方，再点或横向滑过牌面，确认出牌；未出牌的玩家会自动记为过牌。</li>
                      <li><strong>第五步：</strong>录错可撤销；重要牌局点“重要”保存，之后从“历史”回放。</li>
                    </ol>
                  </section>
                  <section className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                    <h3 className="mb-2 font-black text-violet-950">斗地主语音规则</h3>
                    <div className="space-y-2 text-xs leading-5 text-violet-950">
                      <p><strong>出牌方：</strong>只说“我/自己、下家、上家”，斗地主没有对家。</p>
                      <p><strong>标准格式：</strong>“下家出四个六”“上家一对九”“我三个八带一对五”。</p>
                      <p><strong>顺子：</strong>说“上家七八九十勾”；不需要说花色，2和王不能组成普通顺子。</p>
                      <p><strong>炸弹和王炸：</strong>说“我四个A”或“上家王炸”。过牌说“过”“不要”或“要不起”。</p>
                      <p><strong>避免歧义：</strong>对子必须说“一对七”或“两个七”，不要只说“对7”。</p>
                    </div>
                  </section>
                  <section className="rounded-xl bg-sky-50 p-3">
                    <h3 className="mb-2 font-black text-sky-950">斗地主牌面与规则</h3>
                    <div className="space-y-1 text-xs text-sky-900">
                      <p>每个普通点数显示4张牌，大小王共2张；已出牌会标出玩家。</p>
                      <p>绿色“✓上/下”表示归属基本确认，橙色标签表示较高概率，红色“⚠”表示炸弹风险。</p>
                      <p>地主先出；地主先出完为地主胜利，任一农民先出完为农民胜利。</p>
                      <p>切换其他应用后，当前斗地主牌局会自动保存到本机，返回可继续。</p>
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <section>
                    <h3 className="mb-2 font-black text-slate-900">掼蛋：按这5步使用</h3>
                    <ol className="space-y-2">
                      <li><strong>第一步：</strong>选择“打几”，再点“开始游戏”。</li>
                      <li><strong>第二步：</strong>录入自己的27张手牌；进贡或还贡到自己手中的牌直接算入手牌。需要时切换到“明牌”，先选所属玩家，再点公开牌。</li>
                      <li><strong>第三步：</strong>选择首家出牌并点“确认开始”。不默认由“我”先出；顶部四家牌面和牌面底部四个按钮都可选择。</li>
                      <li><strong>第四步：</strong>每次先点实际出牌方，再点击或横向滑过实体牌，最后确认出牌；跳过的玩家会自动记为过牌。</li>
                      <li><strong>第五步：</strong>发现录错可连续撤销；重要牌局点“重要”实时保存，之后从“历史”打开回放。</li>
                    </ol>
                  </section>
                  <section className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                    <h3 className="mb-2 font-black text-violet-950">掼蛋语音规则与实战建议</h3>
                    <div className="space-y-2 text-xs leading-5 text-violet-950">
                      <p><strong>最稳的玩家称呼：</strong>推荐使用“我、下、队友、上”。手机语音有时会把“下家”拆成两段或识别成“夏家”，所以说“下”通常比“下家”稳定；“队友”也比“对家”更不容易和“对子”混淆。</p>
                      <p><strong>兼容称呼：</strong>“下家、上家、对家”和单字“对”仍然可以使用。单字“对7”表示对家出一张7；“我对7”才表示我出一对7。</p>
                      <p><strong>数量说法：</strong>“两个7”和“两张7”含义相同；手机识别不稳定时优先说“两个”。例如：“下两个7两个8两个9”“队友四个10”。</p>
                      <p><strong>标准格式：</strong>“下四个六”“上一对九”“队友三个八带一对五”。J可以说“勾”，Q可以说“圈”，A可以说“A、尖、EI、S或艾斯”。</p>
                      <p><strong>顺子和同花顺：</strong>可说“上七八九十勾”；不需要说普通花色，五张连续点数按快速规则记录。</p>
                      <p><strong>红心配推荐说法：</strong>直接说“红心配”或“配牌”，程序会按当前“打几”自动选择真正的红心级牌。例如打8时，“下一张6红心配”等同于“下一张6红心8”，可配成对6。</p>
                      <p><strong>红心配组合示例：</strong>“下三个5红心配”组成四个5炸弹；“下2356红心配”补成23456；“下两张6红心配带对4”组成66644三带二。</p>
                      <p><strong>红心配失败时：</strong>如果提示“可用的红心级牌不足”，请检查该红心级牌是否已经出过、是否录入了我方手牌、是否登记为其他玩家明牌，或者当前“打几”是否和红心牌点一致。程序必须选择真实红心级牌，不会用普通级牌代替。</p>
                      <p><strong>王炸和过牌：</strong>说“上王炸”；过牌说“过”“不要”“要不起”或“过牌”。</p>
                    </div>
                  </section>
                  <section className="rounded-xl bg-sky-50 p-3">
                    <h3 className="mb-2 font-black text-sky-950">掼蛋牌面与规则</h3>
                    <div className="space-y-1 text-xs text-sky-900">
                      <p>每个普通点数显示8张，大小王共4张；已出牌会标出玩家。</p>
                      <p>绿色“✓上/下/对”表示归属基本确认，橙色标签表示较高概率，红色“⚠”表示炸弹风险。</p>
                      <p>全桌最多设置4张明牌；允许一家2张，其余各家最多1张。程序支持掼蛋牌型校验和回放。</p>
                      <p>切换其他应用后，当前掼蛋牌局会自动保存到本机，返回可继续。</p>
                    </div>
                  </section>
                </>
              )}

              <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <h3 className="mb-2 font-black text-amber-950">版本更新、缓存与 Service Worker</h3>
                <div className="space-y-2 text-xs leading-5 text-amber-950">
                  <p>正常部署新版本后，应用会自动更新。如果刷新后仍显示旧程序，优先使用下面的站内工具，不需要寻找地址栏锁头图标。</p>
                  <ol className="list-decimal space-y-1 pl-5">
                    <li>点击“打开清缓存页面”。</li>
                    <li>点击“更新程序（保留牌局）”，工具会注销旧 Service Worker、删除程序缓存并自动返回最新版。</li>
                    <li>如果仍是旧版，请关闭该网站全部标签页和桌面图标窗口，再重新打开。</li>
                  </ol>
                  <a
                    href="/clear-cache.html"
                    className="inline-flex min-h-11 items-center rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-700"
                  >
                    打开清缓存页面
                  </a>
                  <div className="rounded-lg bg-white/70 p-2">
                    <p><strong>iPhone/iPad 的 Chrome：</strong>地址栏通常没有锁头或网站信息按钮，这是正常的。点击右上角“…” → “删除浏览数据” → 时间范围选“所有时间” → 只勾选“Cookie、网站数据”和“缓存的图片和文件” → 删除。Chrome iOS 会同时清理其他网站数据，可能需要重新登录。</p>
                    <p className="mt-1"><strong>iPhone/iPad 的 Safari：</strong>打开系统“设置” → “App” → “Safari 浏览器” → “高级” → “网站数据”，搜索 <code>pixelforgeai.com.cn</code>，向左滑动删除该网站即可。</p>
                    <p className="mt-1"><strong>已经添加到主屏幕：</strong>先删除旧桌面图标，清理完成并确认网页已更新后，再重新添加到主屏幕。</p>
                  </div>
                  <p className="font-bold text-red-700">“更新程序（保留牌局）”不会删除历史牌局；只有主动点击“清除本地牌局数据”才会删除本机记录，操作前请先导出重要数据。</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* 历史游戏记录弹窗 */}
      {showGameHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-3xl max-h-[90vh] flex flex-col">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">历史游戏记录</h2>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                重要 {gameRecords.filter(record => record.isImportant).length} 局
              </span>
            </div>
            <div className="flex-grow overflow-y-auto mb-4">
              {gameRecords.length === 0 ? (
                <p className="text-gray-600">暂无历史游戏记录。</p>
              ) : (
                <ul className="space-y-3">
                  {gameRecords.map(record => (
                    <li
                      key={record.id}
                      className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
                        record.isImportant
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          {record.isImportant && (
                            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-amber-950">
                              ★ 重要牌局
                            </span>
                          )}
                          {!record.isCompleted && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                              实时快照
                            </span>
                          )}
                        </div>
                        <p className="truncate font-medium text-gray-800">
                          游戏ID: {record.sourceGameId || record.id}
                        </p>
                        <p className="text-sm text-gray-600">
                          {record.gameMode === 'doudizhu'
                            ? `斗地主 · 地主${getPlayerDisplayName(record.landlordPosition ?? 'bottom')}`
                            : `掼蛋 · 打${RANK_DISPLAY_NAMES[record.currentRank]}`} ·
                          {record.isCompleted ? ' 已完成' : ' 进行中'} ·
                          {' '}{record.playHistory.length}次操作
                        </p>
                        <p className="text-sm text-gray-600">
                          最后同步: {new Date(record.lastUpdatedAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          已确认归属: {Object.keys(record.finalCardOwnership).length}张
                        </p>
                        {record.winningTeam && (
                          <p className="text-sm text-green-700 font-semibold">获胜队伍: 团队{record.winningTeam}</p>
                        )}
                        {record.notes && (
                          <p className="text-sm text-gray-500 italic">备注: {record.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 flex-wrap gap-2">
                        <button
                          onClick={() =>
                            setGameImportant(record.id, !record.isImportant)
                          }
                          className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                            record.isImportant
                              ? 'border-amber-300 bg-white text-amber-800 hover:bg-amber-100'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {record.isImportant ? '取消重要' : '设为重要'}
                        </button>
                        <button
                          onClick={() => openSavedReplay(record)}
                          disabled={record.playHistory.length === 0}
                          className="min-h-11 rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          🎬 复盘
                        </button>
                        {pendingDeleteRecordId === record.id ? (
                          <>
                            <button
                              onClick={() => removeSavedGame(record)}
                              className="min-h-11 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
                            >
                              确认删除
                            </button>
                            <button
                              onClick={() => setPendingDeleteRecordId(null)}
                              className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100"
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setPendingDeleteRecordId(record.id)}
                            className="min-h-11 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={() => {
                setPendingDeleteRecordId(null);
                setShowGameHistory(false);
              }}
              className="mt-4 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 牌桌回放弹窗 */}
      {showReplay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-1 backdrop-blur-sm sm:p-4">
          <div className="flex max-h-[98vh] w-full max-w-4xl flex-col overflow-hidden rounded-[26px] border border-emerald-700/50 bg-gradient-to-b from-emerald-950 to-slate-950 p-1.5 shadow-2xl sm:max-h-[94vh] sm:w-11/12 sm:p-3">
            <div className="mb-1 flex items-center justify-between px-2 py-1 text-white sm:mb-2">
              <div>
                <h2 className="text-base font-black tracking-wide sm:text-lg">
                  牌桌回放
                </h2>
                <p className="text-[10px] font-medium text-emerald-200/70">
                  按真实出牌顺序逐手还原
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭回放弹窗"
                onClick={() => {
                  stopReplay();
                  setShowReplay(false);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-xl font-light text-white transition-colors hover:bg-white/20"
              >
                ×
              </button>
            </div>
            <div className="mb-1 flex-grow overflow-y-auto rounded-[24px] sm:mb-2">
              {currentReplayGameId && gameRecords.find(record => record.id === currentReplayGameId) ? (
                <GameReplay
                  gameRecord={gameRecords.find(record => record.id === currentReplayGameId)!}
                  replayState={replayState}
                  onReplayControl={replayControl}
                  displayMode="table"
                />
              ) : (
                <p className="text-gray-600">请先开始游戏并保存记录，或从历史记录中加载游戏以进行回放。</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                stopReplay();
                setShowReplay(false);
              }}
              className="mt-1 min-h-11 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/20 sm:mt-2"
            >
              关闭回放
            </button>
          </div>
        </div>
      )}

      {/* AI助手组件 */}
      {showAIAssistant && !showReplay && (
        <AIAssistant
          enabled={aiEnabled}
          onToggle={setAIEnabled}
          playHistory={playHistory}
          currentRank={currentRank}
          gameState={gameState}
          analysisResult={analysisResult}
          onRefresh={() =>
            setAnalysisRefreshVersion(version => version + 1)
          }
        />
      )}

      {/* 语音控制同样独立放在页面底部，不改变原牌面布局。 */}
      <VoiceControl
        onVoiceCommand={handleVoiceCommand}
        disabled={gameState.status !== GameStatus.PLAYING}
        currentRank={currentRank}
      />

    </div>
  );
};

export default App;
