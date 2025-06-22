/**
 * 掼蛋游戏状态管理Hook
 * 使用useReducer管理完整的游戏状态，包含自动保存和统计功能
 */

import { useReducer, useEffect, useCallback, useMemo } from 'react';
import type { GameRank, Card, PlayerPosition, Team } from '../types/game';
import { Suit, Rank, PlayerPosition as Pos } from '../types/game';

// 导入工具函数
import { generateCards, updateCardRankStatus } from '../utils/cardData';
import { isValidRank, getRankName, getNextRank, countRankCards } from '../utils/rankUtils';
import { 
  GAME_CONFIG, 
  DEFAULT_PLAYER_NAMES, 
  TEAM_CONFIG, 
  STORAGE_KEYS,
  isValidGameRank 
} from '../utils/constants';

// ==================== 状态类型定义 ====================

/** 玩家信息 */
interface Player {
  id: string;
  name: string;
  position: PlayerPosition;
  team: Team;
}

/** 游戏状态 */
interface GameState {
  /** 当前级数 */
  currentRank: GameRank;
  
  /** 下一级数 */
  nextRank: GameRank;
  
  /** 当前选中的玩家 */
  selectedPlayer: PlayerPosition;
  
  /** 所有卡牌数据 */
  cards: Card[];
  
  /** 玩家信息 */
  players: Player[];
  
  /** 卡牌归属映射 {cardId: playerPosition} */
  cardOwnership: Record<string, PlayerPosition>;
  
  /** 游戏创建时间 */
  createdAt: number;
  
  /** 最后更新时间 */
  updatedAt: number;
  
  /** 统计信息缓存 */
  statsCache?: GameStats;
}

/** 游戏统计信息 */
interface GameStats {
  /** 总卡牌数 */
  totalCards: number;
  
  /** 各玩家卡牌数量 */
  playerCardCounts: Record<PlayerPosition, number>;
  
  /** 各队伍卡牌数量 */
  teamCardCounts: Record<Team, number>;
  
  /** 级牌统计 */
  rankCardStats: {
    total: number;
    byPlayer: Record<PlayerPosition, number>;
    byTeam: Record<Team, number>;
  };
  
  /** 配牌统计 */
  wildCardStats: {
    total: number;
    byPlayer: Record<PlayerPosition, number>;
    byTeam: Record<Team, number>;
  };
  
  /** 王牌统计 */
  jokerStats: {
    total: number;
    byPlayer: Record<PlayerPosition, number>;
    byTeam: Record<Team, number>;
  };
  
  /** 计算时间 */
  calculatedAt: number;
}

// ==================== Action类型定义 ====================

type GameAction =
  | { type: 'SET_RANK'; payload: { rank: GameRank } }
  | { type: 'SELECT_PLAYER'; payload: { position: PlayerPosition } }
  | { type: 'TOGGLE_CARD'; payload: { cardId: string } }
  | { type: 'BATCH_TOGGLE_CARDS'; payload: { cardIds: string[] } }
  | { type: 'RESET_GAME'; payload?: { preserveRank?: boolean } }
  | { type: 'UPDATE_PLAYER'; payload: { position: PlayerPosition; updates: Partial<Player> } }
  | { type: 'LOAD_STATE'; payload: { state: Partial<GameState> } }
  | { type: 'CLEAR_STATS_CACHE' };

// ==================== 初始状态 ====================

const createInitialPlayers = (): Player[] => {
  const positions = [Pos.BOTTOM, Pos.LEFT, Pos.TOP, Pos.RIGHT];
  
  return positions.map((position, index) => ({
    id: `player-${index}`,
    name: DEFAULT_PLAYER_NAMES[index],
    position,
    team: TEAM_CONFIG.POSITION_TO_TEAM[position]
  }));
};

const createInitialState = (rank: GameRank = 2): GameState => {
  const cards = generateCards(rank);
  const now = Date.now();
  
  return {
    currentRank: rank,
    nextRank: getNextRank(rank),
    selectedPlayer: Pos.BOTTOM,
    cards,
    players: createInitialPlayers(),
    cardOwnership: {},
    createdAt: now,
    updatedAt: now,
    statsCache: undefined
  };
};

// ==================== Reducer函数 ====================

function gameReducer(state: GameState, action: GameAction): GameState {
  const now = Date.now();
  
  switch (action.type) {
    case 'SET_RANK': {
      const { rank } = action.payload;
      
      if (!isValidRank(rank) || rank === state.currentRank) {
        return state;
      }
      
      // 重新生成卡牌数据（保持归属关系）
      const newCards = generateCards(rank);
      
      // 更新现有卡牌的级牌状态
      const updatedCards = newCards.map(card => {
        // 查找对应的旧卡牌来保持归属关系
        const oldCard = state.cards.find(old => 
          old.suit === card.suit && 
          old.rank === card.rank && 
          old.id.includes(card.id.split('_')[2]) // 匹配时间戳部分
        );
        
        return {
          ...card,
          isSelected: oldCard?.isSelected || false
        };
      });
      
      return {
        ...state,
        currentRank: rank,
        nextRank: getNextRank(rank),
        cards: updatedCards,
        updatedAt: now,
        statsCache: undefined // 清除统计缓存
      };
    }

    case 'SELECT_PLAYER': {
      const { position } = action.payload;
      
      if (state.selectedPlayer === position) {
        return state;
      }
      
      return {
        ...state,
        selectedPlayer: position,
        updatedAt: now
      };
    }

    case 'TOGGLE_CARD': {
      const { cardId } = action.payload;
      const selectedPlayer = state.selectedPlayer;
      
      // 更新卡牌归属
      const newOwnership = { ...state.cardOwnership };
      
      if (newOwnership[cardId] === selectedPlayer) {
        // 如果已经属于当前玩家，则移除归属
        delete newOwnership[cardId];
      } else {
        // 否则设置为当前玩家
        newOwnership[cardId] = selectedPlayer;
      }
      
      // 更新卡牌选中状态
      const updatedCards = state.cards.map(card => {
        if (card.id === cardId) {
          return {
            ...card,
            isSelected: newOwnership[cardId] === selectedPlayer
          };
        }
        return card;
      });
      
      return {
        ...state,
        cards: updatedCards,
        cardOwnership: newOwnership,
        updatedAt: now,
        statsCache: undefined
      };
    }

    case 'BATCH_TOGGLE_CARDS': {
      const { cardIds } = action.payload;
      const selectedPlayer = state.selectedPlayer;
      
      // 检查是否所有卡牌都已属于当前玩家
      const allBelongToPlayer = cardIds.every(id => 
        state.cardOwnership[id] === selectedPlayer
      );
      
      // 批量更新归属
      const newOwnership = { ...state.cardOwnership };
      
      cardIds.forEach(cardId => {
        if (allBelongToPlayer) {
          // 如果都属于当前玩家，则移除所有归属
          delete newOwnership[cardId];
        } else {
          // 否则设置所有卡牌为当前玩家
          newOwnership[cardId] = selectedPlayer;
        }
      });
      
      // 更新卡牌状态
      const cardIdSet = new Set(cardIds);
      const updatedCards = state.cards.map(card => {
        if (cardIdSet.has(card.id)) {
          return {
            ...card,
            isSelected: newOwnership[card.id] === selectedPlayer
          };
        }
        return card;
      });
      
      return {
        ...state,
        cards: updatedCards,
        cardOwnership: newOwnership,
        updatedAt: now,
        statsCache: undefined
      };
    }

    case 'RESET_GAME': {
      const { preserveRank = true } = action.payload || {};
      const rankToUse = preserveRank ? state.currentRank : 2;
      
      // 保留玩家名称
      const preservedPlayers = state.players.map(player => ({
        ...player,
        // 保持自定义的玩家名称
      }));
      
      const newState = createInitialState(rankToUse);
      
      return {
        ...newState,
        players: preservedPlayers,
        updatedAt: now
      };
    }

    case 'UPDATE_PLAYER': {
      const { position, updates } = action.payload;
      
      const updatedPlayers = state.players.map(player => 
        player.position === position 
          ? { ...player, ...updates }
          : player
      );
      
      return {
        ...state,
        players: updatedPlayers,
        updatedAt: now
      };
    }

    case 'LOAD_STATE': {
      const { state: loadedState } = action.payload;
      
      return {
        ...state,
        ...loadedState,
        updatedAt: now,
        statsCache: undefined // 重新计算统计
      };
    }

    case 'CLEAR_STATS_CACHE': {
      return {
        ...state,
        statsCache: undefined
      };
    }

    default:
      return state;
  }
}

// ==================== 本地存储函数 ====================

const saveToLocalStorage = (state: GameState): void => {
  try {
    const saveData = {
      currentRank: state.currentRank,
      selectedPlayer: state.selectedPlayer,
      cardOwnership: state.cardOwnership,
      players: state.players,
      updatedAt: state.updatedAt
    };
    
    localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(saveData));
  } catch (error) {
    console.warn('Failed to save game state to localStorage:', error);
  }
};

const loadFromLocalStorage = (): Partial<GameState> | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
    if (!saved) return null;
    
    const data = JSON.parse(saved);
    
    // 验证数据有效性
    if (!isValidGameRank(data.currentRank)) {
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('Failed to load game state from localStorage:', error);
    return null;
  }
};

// ==================== 统计计算函数 ====================

const calculateStats = (state: GameState): GameStats => {
  const { cards, cardOwnership, currentRank } = state;
  const now = Date.now();
  
  // 初始化统计对象
  const stats: GameStats = {
    totalCards: cards.length,
    playerCardCounts: {
      [Pos.BOTTOM]: 0,
      [Pos.LEFT]: 0,
      [Pos.TOP]: 0,
      [Pos.RIGHT]: 0
    },
    teamCardCounts: {
      1: 0,
      2: 0
    },
    rankCardStats: {
      total: 0,
      byPlayer: {
        [Pos.BOTTOM]: 0,
        [Pos.LEFT]: 0,
        [Pos.TOP]: 0,
        [Pos.RIGHT]: 0
      },
      byTeam: { 1: 0, 2: 0 }
    },
    wildCardStats: {
      total: 0,
      byPlayer: {
        [Pos.BOTTOM]: 0,
        [Pos.LEFT]: 0,
        [Pos.TOP]: 0,
        [Pos.RIGHT]: 0
      },
      byTeam: { 1: 0, 2: 0 }
    },
    jokerStats: {
      total: 0,
      byPlayer: {
        [Pos.BOTTOM]: 0,
        [Pos.LEFT]: 0,
        [Pos.TOP]: 0,
        [Pos.RIGHT]: 0
      },
      byTeam: { 1: 0, 2: 0 }
    },
    calculatedAt: now
  };
  
  // 统计每张卡牌
  cards.forEach(card => {
    const owner = cardOwnership[card.id];
    if (!owner) return;
    
    const team = TEAM_CONFIG.POSITION_TO_TEAM[owner];
    
    // 基础计数
    stats.playerCardCounts[owner]++;
    stats.teamCardCounts[team]++;
    
    // 级牌统计
    if (card.isRankCard) {
      stats.rankCardStats.total++;
      stats.rankCardStats.byPlayer[owner]++;
      stats.rankCardStats.byTeam[team]++;
    }
    
    // 配牌统计
    if (card.isWildCard) {
      stats.wildCardStats.total++;
      stats.wildCardStats.byPlayer[owner]++;
      stats.wildCardStats.byTeam[team]++;
    }
    
    // 王牌统计
    if (card.suit === null) {
      stats.jokerStats.total++;
      stats.jokerStats.byPlayer[owner]++;
      stats.jokerStats.byTeam[team]++;
    }
  });
  
  return stats;
};

// ==================== Hook主函数 ====================

export function useGameState(initialRank: GameRank = 2) {
  // 初始化状态
  const [state, dispatch] = useReducer(gameReducer, null, () => {
    // 尝试从localStorage加载状态
    const saved = loadFromLocalStorage();
    if (saved) {
      const baseState = createInitialState(saved.currentRank || initialRank);
      return { ...baseState, ...saved };
    }
    return createInitialState(initialRank);
  });

  // 自动保存到localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveToLocalStorage(state);
    }, 500); // 防抖保存

    return () => clearTimeout(timeoutId);
  }, [state.currentRank, state.selectedPlayer, state.cardOwnership, state.players]);

  // ==================== Action创建器 ====================

  const setRank = useCallback((rank: GameRank) => {
    dispatch({ type: 'SET_RANK', payload: { rank } });
  }, []);

  const selectPlayer = useCallback((position: PlayerPosition) => {
    dispatch({ type: 'SELECT_PLAYER', payload: { position } });
  }, []);

  const toggleCard = useCallback((cardId: string) => {
    dispatch({ type: 'TOGGLE_CARD', payload: { cardId } });
  }, []);

  const batchToggleCards = useCallback((cardIds: string[]) => {
    dispatch({ type: 'BATCH_TOGGLE_CARDS', payload: { cardIds } });
  }, []);

  const resetGame = useCallback((preserveRank: boolean = true) => {
    dispatch({ type: 'RESET_GAME', payload: { preserveRank } });
  }, []);

  const updatePlayer = useCallback((position: PlayerPosition, updates: Partial<Player>) => {
    dispatch({ type: 'UPDATE_PLAYER', payload: { position, updates } });
  }, []);

  const loadState = useCallback((loadedState: Partial<GameState>) => {
    dispatch({ type: 'LOAD_STATE', payload: { state: loadedState } });
  }, []);

  const clearStatsCache = useCallback(() => {
    dispatch({ type: 'CLEAR_STATS_CACHE' });
  }, []);

  // ==================== 计算属性和选择器 ====================

  // 缓存统计信息
  const stats = useMemo(() => {
    if (state.statsCache && state.statsCache.calculatedAt > state.updatedAt - 1000) {
      return state.statsCache;
    }
    const newStats = calculateStats(state);
    // 异步更新缓存
    setTimeout(() => {
      dispatch({ type: 'CLEAR_STATS_CACHE' });
    }, 0);
    return newStats;
  }, [state]);

  // 便捷选择器函数
  const getTeamCards = useCallback((team: Team): Card[] => {
    return state.cards.filter(card => {
      const owner = state.cardOwnership[card.id];
      return owner && TEAM_CONFIG.POSITION_TO_TEAM[owner] === team;
    });
  }, [state.cards, state.cardOwnership]);

  const getRankCards = useCallback((): Card[] => {
    return state.cards.filter(card => card.isRankCard);
  }, [state.cards]);

  const getWildCards = useCallback((): Card[] => {
    return state.cards.filter(card => card.isWildCard);
  }, [state.cards]);

  const getPlayerCards = useCallback((position: PlayerPosition): Card[] => {
    return state.cards.filter(card => state.cardOwnership[card.id] === position);
  }, [state.cards, state.cardOwnership]);

  const getUnassignedCards = useCallback((): Card[] => {
    return state.cards.filter(card => !state.cardOwnership[card.id]);
  }, [state.cards, state.cardOwnership]);

  const getSelectedCards = useCallback((): Card[] => {
    return state.cards.filter(card => card.isSelected);
  }, [state.cards]);

  // 玩家相关选择器
  const getCurrentPlayer = useCallback((): Player => {
    return state.players.find(p => p.position === state.selectedPlayer)!;
  }, [state.players, state.selectedPlayer]);

  const getTeamPlayers = useCallback((team: Team): Player[] => {
    return state.players.filter(p => p.team === team);
  }, [state.players]);

  // 游戏信息
  const gameInfo = useMemo(() => ({
    currentRankName: getRankName(state.currentRank),
    nextRankName: getRankName(state.nextRank),
    totalAssignedCards: Object.keys(state.cardOwnership).length,
    totalUnassignedCards: state.cards.length - Object.keys(state.cardOwnership).length,
    isComplete: Object.keys(state.cardOwnership).length === state.cards.length
  }), [state.currentRank, state.nextRank, state.cardOwnership, state.cards.length]);

  // ==================== 返回值 ====================

  return {
    // 状态
    state,
    stats,
    gameInfo,

    // Actions
    setRank,
    selectPlayer,
    toggleCard,
    batchToggleCards,
    resetGame,
    updatePlayer,
    loadState,
    clearStatsCache,

    // 选择器函数
    getTeamCards,
    getRankCards,
    getWildCards,
    getPlayerCards,
    getUnassignedCards,
    getSelectedCards,
    getCurrentPlayer,
    getTeamPlayers,

    // 便捷属性
    currentRank: state.currentRank,
    nextRank: state.nextRank,
    selectedPlayer: state.selectedPlayer,
    players: state.players,
    cards: state.cards,
    cardOwnership: state.cardOwnership
  };
}

// ==================== 导出类型 ====================

export type UseGameStateReturn = ReturnType<typeof useGameState>;
export type { GameState, GameStats, Player, GameAction };

// ==================== 默认导出 ====================

export default useGameState;