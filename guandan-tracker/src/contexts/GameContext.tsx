import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { GameConfig, Player, Card, GameRank, Team, PlayerPosition, GameState as GameStateType, Rank, Suit, GameStatus } from '../types';
import { generateDoubleDeck, markLevelCards, shuffleCards, dealCards, sortCardsByLevel } from '../utils/cardUtils';
import { countRankCards } from '../utils/rankUtils';

// 应用状态接口
interface AppState {
  gameState: GameStateType;
  ui: {
    selectedPlayer: Player | null;
    showRankSelector: boolean;
    showSettings: boolean;
    isLoading: boolean;
    error: string | null;
    orientation: 'portrait' | 'landscape';
    deviceType: 'mobile' | 'tablet' | 'desktop';
  };
  preferences: {
    enableKeyboardShortcuts: boolean;
    showDetailedStats: boolean;
    showTeamScores: boolean;
    autoSaveEnabled: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
}

// Action类型定义
type AppAction =
  | { type: 'SET_RANK'; payload: { rank: GameRank } }
  | { type: 'START_GAME'; payload: { playerNames: string[] } }
  | { type: 'UPDATE_CARD'; payload: { cardId: string; updates: Partial<Card> } }
  | { type: 'UPDATE_MULTIPLE_CARDS'; payload: { updates: { cardId: string; updates: Partial<Card> }[] } }
  | { type: 'SELECT_PLAYER'; payload: { player: Player | null } }
  | { type: 'SET_CURRENT_PLAYER'; payload: { position: PlayerPosition } }
  | { type: 'TOGGLE_RANK_SELECTOR'; payload?: { show?: boolean } }
  | { type: 'TOGGLE_SETTINGS'; payload?: { show?: boolean } }
  | { type: 'SET_LOADING'; payload: { loading: boolean } }
  | { type: 'SET_ERROR'; payload: { error: string | null } }
  | { type: 'SET_ORIENTATION'; payload: { orientation: 'portrait' | 'landscape' } }
  | { type: 'SET_DEVICE_TYPE'; payload: { deviceType: 'mobile' | 'tablet' | 'desktop' } }
  | { type: 'UPDATE_PREFERENCES'; payload: { preferences: Partial<AppState['preferences']> } }
  | { type: 'RESET_GAME'; payload?: {} };

// 初始状态
const initialGameState: GameStateType = {
  gameId: '',
  status: 'waiting' as const,
  config: {
    rank: {
      current: 7 as GameRank,
      next: 8 as GameRank,
      history: []
    },
    tributeEnabled: false
  },
  players: [],
  currentPlayerPosition: 'bottom',
  currentRank: 7 as GameRank,
  allCards: [],
  playHistory: [],
  currentRound: {
    roundNumber: 1,
    startTime: Date.now(),
    passCount: 0,
    isFinished: false
  },
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const initialAppState: AppState = {
  gameState: initialGameState,
  ui: {
    selectedPlayer: null,
    showRankSelector: false,
    showSettings: false,
    isLoading: false,
    error: null,
    orientation: 'portrait',
    deviceType: 'mobile'
  },
  preferences: {
    enableKeyboardShortcuts: true,
    showDetailedStats: true,
    showTeamScores: true,
    autoSaveEnabled: true,
    theme: 'auto'
  }
};

// Reducer函数
const appReducer = (state: AppState, action: AppAction): AppState => {
  try {
    switch (action.type) {
      case 'SET_RANK': {
        const { rank } = action.payload;
        const nextRank = (rank === 14 ? 2 : rank + 1) as GameRank;
        
        return {
          ...state,
          gameState: {
            ...state.gameState,
            currentRank: rank,
            config: {
              ...state.gameState.config,
              rank: {
                current: rank,
                next: nextRank,
                history: [...state.gameState.config.rank.history, state.gameState.config.rank.current]
              }
            },
            updatedAt: Date.now()
          }
        };
      }

      case 'START_GAME': {
        const { playerNames } = action.payload;
        
        // 生成卡牌
        let deck = generateDoubleDeck();
        deck = markLevelCards(deck, state.gameState.currentRank);
        deck = shuffleCards(deck);

        // 发牌
        const hands = dealCards(deck, 4);
        const positions: PlayerPosition[] = ['bottom', 'left', 'top', 'right'];
        const teams: Team[] = [1, 2, 1, 2];

        // 创建玩家
        const players: Player[] = positions.map((position, index) => {
          const cards = sortCardsByLevel(hands[index]);
          const stats = countRankCards(cards, state.gameState.currentRank);
          
          return {
            id: `player-${index + 1}`,
            name: playerNames[index] || `玩家${index + 1}`,
            position,
            team: teams[index],
            cards,
            remainingCount: cards.length,
            isCurrentPlayer: index === 0,
            stats: {
              playedCards: 0,
              rankCardCount: stats.rankCards,
              wildCardCount: stats.wildCards,
              roundWins: 0
            }
          };
        });

                 return {
           ...state,
           gameState: {
             ...state.gameState,
             gameId: `game-${Date.now()}`,
             status: 'playing' as const,
             players,
             allCards: deck,
             currentPlayerPosition: 'bottom',
             updatedAt: Date.now()
           },
           ui: {
             ...state.ui,
             selectedPlayer: players[0],
             isLoading: false,
             error: null
           }
         };
      }

      case 'UPDATE_CARD': {
        const { cardId, updates } = action.payload;
        
        // 更新所有卡牌
        const updatedAllCards = state.gameState.allCards.map(card =>
          card.id === cardId ? { ...card, ...updates } : card
        );

        // 更新玩家手牌
        const updatedPlayers = state.gameState.players.map(player => {
          const updatedCards = player.cards.map(card =>
            card.id === cardId ? { ...card, ...updates } : card
          );
          
          const newStats = countRankCards(updatedCards, state.gameState.currentRank);
          
          return {
            ...player,
            cards: updatedCards,
            remainingCount: updatedCards.filter(card => !card.isPlayed).length,
            stats: {
              ...player.stats,
              rankCardCount: newStats.rankCards,
              wildCardCount: newStats.wildCards
            }
          };
        });

        return {
          ...state,
          gameState: {
            ...state.gameState,
            allCards: updatedAllCards,
            players: updatedPlayers,
            updatedAt: Date.now()
          }
        };
      }

      case 'UPDATE_MULTIPLE_CARDS': {
        const { updates } = action.payload;
        
        let updatedAllCards = [...state.gameState.allCards];
        let updatedPlayers = [...state.gameState.players];

        updates.forEach(({ cardId, updates: cardUpdates }) => {
          updatedAllCards = updatedAllCards.map(card =>
            card.id === cardId ? { ...card, ...cardUpdates } : card
          );

          updatedPlayers = updatedPlayers.map(player => {
            const updatedCards = player.cards.map(card =>
              card.id === cardId ? { ...card, ...cardUpdates } : card
            );
            
            const newStats = countRankCards(updatedCards, state.gameState.currentRank);
            
            return {
              ...player,
              cards: updatedCards,
              remainingCount: updatedCards.filter(card => !card.isPlayed).length,
              stats: {
                ...player.stats,
                rankCardCount: newStats.rankCards,
                wildCardCount: newStats.wildCards
              }
            };
          });
        });

        return {
          ...state,
          gameState: {
            ...state.gameState,
            allCards: updatedAllCards,
            players: updatedPlayers,
            updatedAt: Date.now()
          }
        };
      }

      case 'SELECT_PLAYER': {
        return {
          ...state,
          ui: {
            ...state.ui,
            selectedPlayer: action.payload.player
          }
        };
      }

      case 'SET_CURRENT_PLAYER': {
        const { position } = action.payload;
        
        const updatedPlayers = state.gameState.players.map(player => ({
          ...player,
          isCurrentPlayer: player.position === position
        }));

        return {
          ...state,
          gameState: {
            ...state.gameState,
            currentPlayerPosition: position,
            players: updatedPlayers,
            updatedAt: Date.now()
          }
        };
      }

      case 'TOGGLE_RANK_SELECTOR': {
        return {
          ...state,
          ui: {
            ...state.ui,
            showRankSelector: action.payload?.show ?? !state.ui.showRankSelector
          }
        };
      }

      case 'TOGGLE_SETTINGS': {
        return {
          ...state,
          ui: {
            ...state.ui,
            showSettings: action.payload?.show ?? !state.ui.showSettings
          }
        };
      }

      case 'SET_LOADING': {
        return {
          ...state,
          ui: {
            ...state.ui,
            isLoading: action.payload.loading
          }
        };
      }

      case 'SET_ERROR': {
        return {
          ...state,
          ui: {
            ...state.ui,
            error: action.payload.error,
            isLoading: false
          }
        };
      }

      case 'SET_ORIENTATION': {
        return {
          ...state,
          ui: {
            ...state.ui,
            orientation: action.payload.orientation
          }
        };
      }

      case 'SET_DEVICE_TYPE': {
        return {
          ...state,
          ui: {
            ...state.ui,
            deviceType: action.payload.deviceType
          }
        };
      }

      case 'UPDATE_PREFERENCES': {
        return {
          ...state,
          preferences: {
            ...state.preferences,
            ...action.payload.preferences
          }
        };
      }

      case 'RESET_GAME': {
        return {
          ...initialAppState,
          ui: {
            ...initialAppState.ui,
            orientation: state.ui.orientation,
            deviceType: state.ui.deviceType
          },
          preferences: state.preferences
        };
      }

      default:
        return state;
    }
  } catch (error) {
    console.error('Reducer error:', error);
    return {
      ...state,
      ui: {
        ...state.ui,
        error: error instanceof Error ? error.message : '未知错误',
        isLoading: false
      }
    };
  }
};

// Context接口
interface GameContextType {
  state: AppState;
  actions: {
    setRank: (rank: GameRank) => void;
    startGame: (playerNames: string[]) => void;
    updateCard: (cardId: string, updates: Partial<Card>) => void;
    updateMultipleCards: (updates: { cardId: string; updates: Partial<Card> }[]) => void;
    selectPlayer: (player: Player | null) => void;
    setCurrentPlayer: (position: PlayerPosition) => void;
    toggleRankSelector: (show?: boolean) => void;
    toggleSettings: (show?: boolean) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setOrientation: (orientation: 'portrait' | 'landscape') => void;
    setDeviceType: (deviceType: 'mobile' | 'tablet' | 'desktop') => void;
    updatePreferences: (preferences: Partial<AppState['preferences']>) => void;
    resetGame: () => void;
  };
  selectors: {
    currentPlayer: Player | null;
    selectedCards: Card[];
    teamStats: { team1: number; team2: number };
  };
}

// Context创建
const GameContext = createContext<GameContextType | undefined>(undefined);

// Provider组件
export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  // Actions
  const actions = useMemo(() => ({
    setRank: (rank: GameRank) => {
      dispatch({ type: 'SET_RANK', payload: { rank } });
    },
    
    startGame: (playerNames: string[]) => {
      dispatch({ type: 'SET_LOADING', payload: { loading: true } });
      setTimeout(() => {
        dispatch({ type: 'START_GAME', payload: { playerNames } });
      }, 100);
    },
    
    updateCard: (cardId: string, updates: Partial<Card>) => {
      dispatch({ type: 'UPDATE_CARD', payload: { cardId, updates } });
    },
    
    updateMultipleCards: (updates: { cardId: string; updates: Partial<Card> }[]) => {
      dispatch({ type: 'UPDATE_MULTIPLE_CARDS', payload: { updates } });
    },
    
    selectPlayer: (player: Player | null) => {
      dispatch({ type: 'SELECT_PLAYER', payload: { player } });
    },
    
    setCurrentPlayer: (position: PlayerPosition) => {
      dispatch({ type: 'SET_CURRENT_PLAYER', payload: { position } });
    },
    
    toggleRankSelector: (show?: boolean) => {
      dispatch({ type: 'TOGGLE_RANK_SELECTOR', payload: { show } });
    },
    
    toggleSettings: (show?: boolean) => {
      dispatch({ type: 'TOGGLE_SETTINGS', payload: { show } });
    },
    
    setLoading: (loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: { loading } });
    },
    
    setError: (error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: { error } });
    },
    
    setOrientation: (orientation: 'portrait' | 'landscape') => {
      dispatch({ type: 'SET_ORIENTATION', payload: { orientation } });
    },
    
    setDeviceType: (deviceType: 'mobile' | 'tablet' | 'desktop') => {
      dispatch({ type: 'SET_DEVICE_TYPE', payload: { deviceType } });
    },
    
    updatePreferences: (preferences: Partial<AppState['preferences']>) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: { preferences } });
    },
    
    resetGame: () => {
      dispatch({ type: 'RESET_GAME' });
    }
  }), []);

  // Selectors
  const selectors = useMemo(() => ({
    currentPlayer: state.gameState.players.find(p => p.isCurrentPlayer) || null,
    
    selectedCards: state.gameState.allCards.filter(card => card.isSelected),
    
    teamStats: state.gameState.players.reduce(
      (stats, player) => {
        const key = player.team === 1 ? 'team1' : 'team2';
        return {
          ...stats,
          [key]: stats[key] + player.stats.roundWins
        };
      },
      { team1: 0, team2: 0 }
    )
  }), [state.gameState.allCards, state.gameState.players]);

  const contextValue: GameContextType = {
    state,
    actions,
    selectors
  };

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
};

// Hook
export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

// 导出类型
export type { AppState, GameContextType };