/**
 * 掼蛋记牌器主应用组件
 * 极简界面设计，支持PWA功能
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useGameState } from './hooks/useGameState';
import { useGameHistory } from './hooks/useGameHistory';
import { GameReplay } from './components/GameReplay';
import { PlayHistoryPanel } from './components/PlayHistoryPanel';
import { CardImage } from './components/CardImage';
import Settings from './components/Settings/Settings';
import type { GameRank, PlayerPosition, HandInputState } from './types/game';
import { PlayerPosition as Pos } from './types/game';

// ==================== 类型定义 ====================

interface AppState {
  /** 当前视图 */
  currentView: 'game' | 'settings' | 'replay' | 'play-history' | 'hand-input';
  /** 是否显示设置面板 */
  showSettings: boolean;
  /** 当前选中的玩家 */
  selectedPlayer: PlayerPosition;
  /** 是否显示出牌确认 */
  showPlayConfirm: boolean;
  /** 临时选中的卡牌 */
  tempSelectedCards: string[];
  /** 回放显示模式 */
  replayMode: 'table' | 'summary';
  /** 是否显示出牌记录面板 */
  showPlayHistory: boolean;
  /** 手牌输入状态 */
  handInput: HandInputState;
  /** 游戏是否已开始 */
  gameStarted: boolean;
}

// ==================== 组件定义 ====================

const App: React.FC = () => {
  const gameState = useGameState(2);
  const gameHistory = useGameHistory();
  
  const [appState, setAppState] = useState<AppState>({
    currentView: 'game',
    showSettings: false,
    selectedPlayer: Pos.BOTTOM,
    showPlayConfirm: false,
    tempSelectedCards: [],
    replayMode: 'table',
    showPlayHistory: false,
    handInput: {
      isInputMode: false,
      selectedPlayer: null,
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
      inputStep: 'select_player'
    },
    gameStarted: false
  });

  // ==================== 级数选择组件 ====================
  
  const handleRankChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const rank = parseInt(e.target.value) as GameRank;
    console.log('级数变化:', rank, '当前级数:', gameState.currentRank);
    gameState.setRank(rank);
    console.log('setRank调用后，当前级数:', gameState.currentRank);
  }, [gameState]);

  const RankSelector: React.FC = () => {
    const ranks: GameRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    
    return (
      <div className="flex items-center space-x-2 bg-white rounded-lg p-2 shadow-sm">
        <span className="text-sm font-medium text-gray-700">级数:</span>
        <select
          value={gameState.currentRank}
          onChange={handleRankChange}
          className="bg-blue-50 border border-blue-200 rounded px-3 py-1 text-sm font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ranks.map(rank => (
            <option key={rank} value={rank}>
              {rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : rank === 14 ? 'A' : rank}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // ==================== 玩家信息组件 ====================
  
  const PlayerInfo: React.FC<{ position: PlayerPosition; isSelected: boolean }> = ({ 
    position, 
    isSelected 
  }) => {
    const playerCards = gameState.getPlayerCards(position);
    const cardCount = playerCards.length;
    const wildCards = playerCards.filter(card => card.isWildCard).length;
    const rankCards = playerCards.filter(card => card.isRankCard && !card.isWildCard).length;
    
    const playerNames = {
      [Pos.BOTTOM]: '我',
      [Pos.LEFT]: '对手一', 
      [Pos.TOP]: '队友',
      [Pos.RIGHT]: '对手二'
    };
    
    const positionLabels = {
      [Pos.BOTTOM]: '自己',
      [Pos.LEFT]: '下家', 
      [Pos.TOP]: '对家',
      [Pos.RIGHT]: '上家'
    };
    
    const positionColors = {
      [Pos.BOTTOM]: 'bg-blue-500',
      [Pos.LEFT]: 'bg-green-500',
      [Pos.TOP]: 'bg-yellow-500', 
      [Pos.RIGHT]: 'bg-red-500'
    };
    
    return (
      <div 
        className={`relative p-3 rounded-lg cursor-pointer transition-all ${
          isSelected 
            ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-500 shadow-md' 
            : 'bg-white border border-gray-200 hover:border-gray-300 shadow-sm'
        }`}
        onClick={() => setAppState(prev => ({ ...prev, selectedPlayer: position }))}
      >
        {/* 玩家标识色块和位置标签 */}
        <div className="absolute top-1 right-1 flex flex-col items-end">
          <div className={`w-3 h-3 rounded-full ${positionColors[position]} mb-1`} />
          <div className="text-xs text-gray-500 font-medium">
            {positionLabels[position]}
          </div>
        </div>
        
        {/* 玩家名称 */}
        <div className="font-medium text-gray-800 mb-2">{playerNames[position]}</div>
        
        {/* 牌数统计 */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{cardCount}</div>
            <div className="text-gray-500">总牌</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">{wildCards}</div>
            <div className="text-gray-500">配牌</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{rankCards}</div>
            <div className="text-gray-500">级牌</div>
          </div>
        </div>
        
        {/* 选中指示器 */}
        {isSelected && (
          <div className="absolute -top-1 -left-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
        )}
      </div>
    );
  };

  // ==================== 手牌输入处理函数 ====================
  
  // 开始手牌输入
  const startHandInput = () => {
    setAppState(prev => ({
      ...prev,
      currentView: 'hand-input',
      handInput: {
        ...prev.handInput,
        isInputMode: true,
        inputStep: 'select_player'
      }
    }));
  };

  // 退出手牌输入
  const exitHandInput = () => {
    setAppState(prev => ({
      ...prev,
      currentView: 'game',
      handInput: {
        ...prev.handInput,
        isInputMode: false,
        selectedPlayer: null,
        inputStep: 'select_player'
      }
    }));
  };

  // 选择玩家进行手牌输入
  const selectPlayerForInput = (playerPosition: PlayerPosition) => {
    setAppState(prev => ({
      ...prev,
      handInput: {
        ...prev.handInput,
        selectedPlayer: playerPosition,
        inputStep: 'select_cards'
      }
    }));
  };

  // 为玩家添加/移除卡牌
  const toggleCardForPlayer = (cardId: string) => {
    if (!appState.handInput.selectedPlayer) return;
    
    const player = appState.handInput.selectedPlayer;
    const currentCards = appState.handInput.playerHands[player];
    const hasCard = currentCards.some(card => card.id === cardId);
    
    setAppState(prev => {
      if (hasCard) {
        // 移除卡牌
        return {
          ...prev,
          handInput: {
            ...prev.handInput,
            playerHands: {
              ...prev.handInput.playerHands,
              [player]: currentCards.filter(card => card.id !== cardId)
            }
          }
        };
      } else {
        // 添加卡牌
        // 创建一个简单的卡牌对象，不需要从gameState.cards查找
        let selectedCard;
        if (cardId.startsWith('joker-')) {
          // 大小王
          const index = parseInt(cardId.split('-')[1]);
          selectedCard = {
            id: cardId,
            rank: 15,
            isRankCard: false,
            isWildCard: true,
            displayName: index < 2 ? '小王' : '大王'
          };
        } else {
          // 普通牌
          const [rankStr] = cardId.split('-');
          const rank = parseInt(rankStr);
          selectedCard = {
            id: cardId,
            rank: rank,
            isRankCard: rank === gameState.currentRank,
            isWildCard: rank === gameState.currentRank,
            displayName: rank === 11 ? 'J♥' : rank === 12 ? 'Q♥' : rank === 13 ? 'K♥' : rank === 14 ? 'A♥' : rank === gameState.currentRank ? `${rank}♥` : rank.toString()
          };
        }
        if (selectedCard && currentCards.length < 27) {
          return {
            ...prev,
            handInput: {
              ...prev.handInput,
              playerHands: {
                ...prev.handInput.playerHands,
                [player]: [...currentCards, selectedCard]
              }
            }
          };
        }
      }
      return prev;
    });
  };

  // 设置明牌
  const toggleRevealedCard = (playerPosition: PlayerPosition, cardId: string) => {
    setAppState(prev => {
      const currentRevealed = prev.handInput.revealedCards[playerPosition];
      const isRevealed = currentRevealed.includes(cardId);
      
      return {
        ...prev,
        handInput: {
          ...prev.handInput,
          revealedCards: {
            ...prev.handInput.revealedCards,
            [playerPosition]: isRevealed 
              ? currentRevealed.filter(id => id !== cardId)
              : [...currentRevealed, cardId]
          }
        }
      };
    });
  };

  // 确认手牌输入
  const confirmHandInput = () => {
    setAppState(prev => ({
      ...prev,
      handInput: {
        ...prev.handInput,
        inputStep: 'confirm'
      }
    }));
  };

  // 开始游戏
  const startGame = () => {
    setAppState(prev => ({
      ...prev,
      currentView: 'game',
      gameStarted: true,
      handInput: {
        ...prev.handInput,
        isInputMode: false
      }
    }));
  };

  // 处理卡牌选择（明牌出牌）
  const handleCardSelect = (cardId: string) => {
    if (!appState.gameStarted) return;
    
    // 找到这张牌属于哪个玩家
    let cardOwner: PlayerPosition | null = null;
    [Pos.BOTTOM, Pos.LEFT, Pos.TOP, Pos.RIGHT].forEach(pos => {
      if (appState.handInput.playerHands[pos].some(card => card.id === cardId)) {
        cardOwner = pos;
      }
    });
    
    if (!cardOwner) return;
    
    // 只有轮到该玩家且是明牌才能出牌
    const isPlayerTurn = appState.selectedPlayer === cardOwner;
    const isRevealedCard = cardOwner && appState.handInput.revealedCards[cardOwner as PlayerPosition] 
      ? appState.handInput.revealedCards[cardOwner as PlayerPosition].includes(cardId) 
      : false;
    
    if (isPlayerTurn && isRevealedCard) {
      // 这里可以添加实际的出牌逻辑
      console.log(`${cardOwner} 出牌:`, cardId);
      
      // 移除已出的明牌
      setAppState(prev => ({
        ...prev,
        handInput: {
          ...prev.handInput,
          revealedCards: {
            ...prev.handInput.revealedCards,
            [cardOwner!]: prev.handInput.revealedCards[cardOwner!].filter(id => id !== cardId)
          },
          playerHands: {
            ...prev.handInput.playerHands,
            [cardOwner!]: prev.handInput.playerHands[cardOwner!].filter(card => card.id !== cardId)
          }
        }
      }));
      
      // 自动切换到下一个玩家
      const positions = [Pos.BOTTOM, Pos.LEFT, Pos.TOP, Pos.RIGHT];
      const currentIndex = positions.indexOf(cardOwner);
      const nextPosition = positions[(currentIndex + 1) % 4];
      setAppState(prev => ({ ...prev, selectedPlayer: nextPosition }));
    } else {
      // 显示提示信息
      if (!isPlayerTurn) {
        console.log(`不是 ${cardOwner} 的回合，当前回合: ${appState.selectedPlayer}`);
      } else if (!isRevealedCard) {
        console.log('该牌不是明牌，无法出牌');
      }
    }
  };

  // ==================== 牌面选择组件 ====================
  
  const CardSelector: React.FC = () => {
    const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
    const [isDragging, setIsDragging] = useState(false);
    
    // 根据当前级数生成排序后的牌面
    const cards = useMemo(() => {
      const cards = [];
      const currentRank = gameState.currentRank;
      
      // 1. 先添加2到A的普通牌（不包括当前级数）
      const normalRanks = [];
      for (let rank = 2; rank <= 14; rank++) {
        if (rank !== currentRank) {
          normalRanks.push(rank);
        }
      }
      
      // 生成普通牌，每种8张
      normalRanks.forEach(rank => {
        for (let i = 0; i < 8; i++) {
          const cardId = `${rank}-${i}`;
          
          cards.push({
            id: cardId,
            rank: rank as GameRank,
            isRankCard: false,
            isWildCard: false,
            displayName: rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : rank === 14 ? 'A' : rank.toString()
          });
        }
      });
      
      // 2. 添加级数牌（前6张为普通级数牌，后2张为红心配牌，红色显示）
      for (let i = 0; i < 8; i++) {
        const cardId = `${currentRank}-${i}`;
        const isWildCard = i >= 6; // 最后两张为红心配牌
        
        cards.push({
          id: cardId,
          rank: currentRank as GameRank,
          isRankCard: true,
          isWildCard: isWildCard,
          displayName: isWildCard 
            ? (currentRank === 11 ? 'J♥' : currentRank === 12 ? 'Q♥' : currentRank === 13 ? 'K♥' : currentRank === 14 ? 'A♥' : `${currentRank}♥`)
            : (currentRank === 11 ? 'J' : currentRank === 12 ? 'Q' : currentRank === 13 ? 'K' : currentRank === 14 ? 'A' : currentRank.toString())
        });
      }
      
      // 3. 添加大小王 (4张)
      for (let i = 0; i < 4; i++) {
        cards.push({
          id: `joker-${i}`,
          rank: 15 as GameRank, // 用15表示王
          isRankCard: false,
          isWildCard: true,
          displayName: i < 2 ? '小王' : '大王'
        });
      }
      
      return cards;
    }, [gameState.currentRank]);
    
    // 计算每种牌的剩余数量
    const getCardRemainingCount = (_cardRank: GameRank, index: number) => {
      // 简化：显示静态数量，实际应根据已出牌计算
      return 8 - (index % 3); // 模拟剩余数量
    };
    
    // 处理卡牌选择
    const handleCardSelect = useCallback((cardId: string, isMultiSelect: boolean = false) => {
      // 手牌输入模式下直接调用toggleCardForPlayer
      if (appState.handInput.isInputMode && appState.handInput.inputStep === 'select_cards') {
        toggleCardForPlayer(cardId);
        return;
      }
      
      // 正常游戏模式下的卡牌选择
      setSelectedCards(prev => {
        const newSelected = new Set(prev);
        
        if (isMultiSelect) {
          // 多选模式
          if (newSelected.has(cardId)) {
            newSelected.delete(cardId);
          } else {
            newSelected.add(cardId);
          }
        } else {
          // 单选模式
          if (newSelected.has(cardId)) {
            newSelected.clear();
          } else {
            newSelected.clear();
            newSelected.add(cardId);
          }
        }
        
        return newSelected;
      });
    }, [appState.handInput.isInputMode, appState.handInput.inputStep, toggleCardForPlayer]);
    
    // 处理拖拽选择
    const handleMouseDown = useCallback((cardId: string) => {
      setIsDragging(true);
      handleCardSelect(cardId, true);
    }, [handleCardSelect]);
    
    const handleMouseEnter = useCallback((cardId: string) => {
      if (isDragging) {
        handleCardSelect(cardId, true);
      }
    }, [isDragging, handleCardSelect]);
    
    const handleMouseUp = useCallback(() => {
      setIsDragging(false);
    }, []);
    
    // 确认出牌
    const handlePlayCards = () => {
      if (selectedCards.size === 0) return;
      
      const cardIds = Array.from(selectedCards);
      cardIds.forEach(cardId => {
        gameState.toggleCard(cardId);
      });
      
      setSelectedCards(new Set());
      setAppState(prev => ({ ...prev, showPlayConfirm: false }));
    };
    
    // 取消选择
    const handleCancelSelection = () => {
      setSelectedCards(new Set());
    };
    
    // 按牌面值分组显示
    const cardGroups = useMemo(() => {
      return cards.reduce((groups, card) => {
        const key = card.displayName;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(card);
        return groups;
      }, {} as Record<string, typeof cards>);
    }, [cards]);
    
    return (
      <div className="bg-white rounded-lg p-4 shadow-sm">
        {/* 选择状态提示 */}
        {selectedCards.size > 0 && (
          <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
            <span className="text-blue-700 font-medium">
              已选择 {selectedCards.size} 张牌
            </span>
            <div className="space-x-2">
              <button
                onClick={handleCancelSelection}
                className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handlePlayCards}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
              >
                确认出牌
              </button>
            </div>
          </div>
        )}
        
        {/* 牌面选择区域 */}
        <div 
          className="flex flex-col gap-2 select-none"
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {Object.entries(cardGroups).map(([cardName, cardGroup]) => (
            <div key={cardName} className="flex items-center gap-2">
              {/* 牌面标识 */}
              <div className={`w-16 text-center text-xs font-medium p-2 rounded ${
                cardGroup[0].isWildCard
                  ? 'bg-red-100 text-red-700 border border-red-300' 
                  : cardGroup[0].isRankCard
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-700'
              }`}>
                <span className={cardGroup[0].isWildCard ? 'text-red-600 font-bold' : cardGroup[0].isRankCard ? 'text-blue-600 font-bold' : ''}>
                  {cardName}
                </span>
              </div>
              
              {/* 单张牌 */}
              <div className="flex gap-1">
              {cardGroup.map((card, index) => {
                const isSelected = selectedCards.has(card.id);
                const remainingCount = getCardRemainingCount(card.rank, index);
                
                // 在手牌输入模式下检查卡牌是否已被选择
                const isInPlayerHand = appState.handInput.isInputMode && appState.handInput.selectedPlayer &&
                  appState.handInput.playerHands[appState.handInput.selectedPlayer].some(c => c.id === card.id);
                
                return (
                  <div
                    key={card.id}
                    className={`relative w-8 h-12 border-2 rounded cursor-pointer transition-all transform ${
                      isInPlayerHand
                        ? 'border-orange-500 bg-orange-100 scale-105 shadow-md'
                        : isSelected 
                          ? 'border-blue-500 bg-blue-100 scale-105 shadow-md' 
                          : remainingCount > 0
                            ? card.isWildCard
                              ? 'border-red-300 bg-red-50 hover:border-red-400 hover:scale-102'
                              : 'border-gray-300 bg-white hover:border-gray-400 hover:scale-102'
                            : 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                    }`}
                    onMouseDown={() => remainingCount > 0 && handleMouseDown(card.id)}
                    onMouseEnter={() => handleMouseEnter(card.id)}
                    onClick={(e) => {
                      if (remainingCount > 0) {
                        e.preventDefault();
                        if (appState.handInput.isInputMode && appState.handInput.selectedPlayer) {
                          // 手牌输入模式：添加/移除玩家的卡牌
                          toggleCardForPlayer(card.id);
                        } else if (appState.gameStarted) {
                          // 游戏模式：模拟出牌(记录)
                          console.log('选择出牌:', card.displayName);
                          gameState.toggleCard(card.id);
                        } else {
                          // 正常模式：选择卡牌
                          gameState.toggleCard(card.id);
                        }
                      }
                    }}
                  >
                    
                    {/* 配牌标识 */}
                    {card.isWildCard && (
                      <div className="absolute top-0 left-0 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          ))}
        </div>
        
        {/* 操作提示 */}
        <div className="mt-4 text-xs text-gray-500 space-y-1">
          {appState.gameStarted ? (
            <>
              <div className="text-blue-600 font-medium">出牌模式：</div>
              <div>• 点击明牌区域的明牌直接出牌</div>
              <div>• 在牌面选择区点击卡牌进行记录（非实际出牌）</div>
              <div>• 绿色标记"出"表示可以出牌，黄色"明"表示是明牌但未轮到</div>
            </>
          ) : appState.handInput.isInputMode ? (
            <>
              <div className="text-orange-600 font-medium">手牌输入模式：</div>
              <div>• 点击卡牌选择/取消选择手牌</div>
              <div>• 点击已选手牌设置/取消明牌标记</div>
              <div>• 红色背景标识级数牌(红心♥)</div>
            </>
          ) : (
            <>
              <div>• 点击选择单张牌，Ctrl+点击多选</div>
              <div>• 按住拖拽可连续选择多张牌</div>
              <div>• 红色背景标识级数牌(红心♥)</div>
              <div>• 牌面顺序：2到A → 级数牌(红心) → 大小王</div>
            </>
          )}
        </div>
      </div>
    );
  };


  // ==================== 主界面渲染 ====================
  
  return (
    <div className="min-h-screen bg-gray-50">
        {/* 顶部栏 */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-800">掼蛋记牌器</h1>
              <RankSelector />
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={startHandInput}
                className="px-3 py-2 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors"
              >
                🃏 手牌输入
              </button>
              <button
                onClick={() => setAppState(prev => ({ ...prev, showPlayHistory: !prev.showPlayHistory }))}
                className={`px-3 py-2 text-white rounded text-sm transition-colors ${
                  appState.showPlayHistory ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-500 hover:bg-purple-600'
                }`}
              >
                📝 出牌记录
              </button>
              <button
                onClick={() => setAppState(prev => ({ ...prev, currentView: 'replay' }))}
                className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
              >
                🎬 回放
              </button>
              <button
                onClick={() => setAppState(prev => ({ ...prev, showSettings: true }))}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* 主要内容区域 */}
        <main className="max-w-6xl mx-auto p-4">
          {appState.currentView === 'game' && (
            <div className="flex gap-4">
              {/* 主游戏区域 */}
              <div className={`space-y-6 transition-all duration-300 ${appState.showPlayHistory ? 'w-2/3' : 'w-full'}`}>
                {/* 玩家信息区域 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <PlayerInfo position={Pos.BOTTOM} isSelected={appState.selectedPlayer === Pos.BOTTOM} />
                  <PlayerInfo position={Pos.LEFT} isSelected={appState.selectedPlayer === Pos.LEFT} />
                  <PlayerInfo position={Pos.TOP} isSelected={appState.selectedPlayer === Pos.TOP} />
                  <PlayerInfo position={Pos.RIGHT} isSelected={appState.selectedPlayer === Pos.RIGHT} />
                </div>

                {/* 当前玩家提示 */}
                <div className="text-center">
                  <span className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
                    当前玩家: {
                      appState.selectedPlayer === Pos.BOTTOM ? '我' :
                      appState.selectedPlayer === Pos.LEFT ? '对手一' :
                      appState.selectedPlayer === Pos.TOP ? '队友' : '对手二'
                    }
                    <span className="ml-2 text-blue-600 text-xs">
                      ({
                        appState.selectedPlayer === Pos.BOTTOM ? '自己' :
                        appState.selectedPlayer === Pos.LEFT ? '下家' :
                        appState.selectedPlayer === Pos.TOP ? '对家' : '上家'
                      })
                    </span>
                  </span>
                </div>

                {/* 出牌测试按钮 */}
                {appState.gameStarted && (
                  <div className="text-center mb-4">
                    <button
                      onClick={() => {
                        console.log('测试出牌功能');
                        console.log('当前玩家:', appState.selectedPlayer);
                        console.log('游戏状态:', appState.gameStarted);
                        console.log('明牌:', appState.handInput.revealedCards);
                      }}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      测试出牌功能
                    </button>
                  </div>
                )}

                {/* 明牌显示区域 */}
                {(appState.gameStarted || appState.handInput.isInputMode) && (
                  <div className="revealed-cards-section">
                    {[Pos.BOTTOM, Pos.LEFT, Pos.TOP, Pos.RIGHT].map(position => {
                      const revealedCardIds = appState.handInput.revealedCards[position];
                      const playerHand = appState.handInput.playerHands[position];
                      const revealedCards = revealedCardIds.map(cardId => 
                        playerHand.find(card => card.id === cardId)
                      ).filter(Boolean);
                      
                      if (revealedCards.length === 0) return null;
                      
                      return (
                        <div key={position} className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <h4 className="text-sm font-semibold text-yellow-800 mb-3">
                            {position === Pos.BOTTOM ? '我' : 
                             position === Pos.LEFT ? '对手一' : 
                             position === Pos.TOP ? '队友' : '对手二'} 的明牌:
                            {appState.selectedPlayer === position && (
                              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                轮到此玩家
                              </span>
                            )}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {revealedCards.map((card) => {
                              const canPlay = appState.selectedPlayer === position;
                              const isCurrentPlayerCard = position === Pos.BOTTOM; // 只有自己的牌可以直接点击
                              const isPlayable = canPlay && isCurrentPlayerCard;
                              
                              return (
                                <div 
                                  key={card!.id} 
                                  className={`relative transform transition-all duration-300 ${
                                    isPlayable 
                                      ? 'cursor-pointer hover:scale-110 hover:shadow-lg ring-2 ring-green-400' 
                                      : canPlay
                                        ? 'cursor-not-allowed opacity-60 ring-2 ring-gray-300'
                                        : 'opacity-50 cursor-not-allowed'
                                  }`}
                                  onClick={() => isPlayable && handleCardSelect(card!.id)}
                                  title={
                                    isPlayable 
                                      ? '点击出牌' 
                                      : canPlay 
                                        ? '轮到此玩家，但只能由玩家本人操作'
                                        : '未轮到此玩家'
                                  }
                                >
                                  <CardImage
                                    rank={card!.rank as any}
                                    suit={card!.suit as any}
                                    displayName={card!.rank.toString()}
                                    isWildCard={card!.isWildCard}
                                    isRankCard={card!.isRankCard}
                                    size="small"
                                  />
                                  <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${
                                    isPlayable 
                                      ? 'bg-gradient-to-br from-green-400 to-green-600 animate-pulse'
                                      : canPlay
                                        ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
                                        : 'bg-gradient-to-br from-gray-400 to-gray-600'
                                  }`}>
                                    <span className="text-xs text-white font-bold">
                                      {isPlayable ? '出' : '明'}
                                    </span>
                                  </div>
                                  {canPlay && !isCurrentPlayerCard && (
                                    <div className="absolute top-0 left-0 w-full h-full bg-yellow-400 bg-opacity-30 rounded flex items-center justify-center">
                                      <span className="text-xs font-bold text-yellow-800">轮次</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 牌面选择区域 */}
                <CardSelector />
              </div>

              {/* 出牌记录面板 */}
              {appState.showPlayHistory && (
                <div className="w-1/3">
                  <PlayHistoryPanel
                    isGameActive={true}
                    playerNames={{
                      bottom: '我',
                      left: '对手一', 
                      top: '队友',
                      right: '对手二'
                    }}
                    autoRecord={true}
                    className="h-fit"
                  />
                </div>
              )}
            </div>
          )}

          {appState.currentView === 'replay' && (
            <div>
              {/* 回放模式切换 */}
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">🎬 游戏回放</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAppState(prev => ({ ...prev, replayMode: 'table' }))}
                    className={`px-3 py-2 rounded text-sm transition-colors ${
                      appState.replayMode === 'table' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    🎴 牌桌视图
                  </button>
                  <button
                    onClick={() => setAppState(prev => ({ ...prev, replayMode: 'summary' }))}
                    className={`px-3 py-2 rounded text-sm transition-colors ${
                      appState.replayMode === 'summary' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    📊 统计视图
                  </button>
                  <button
                    onClick={() => setAppState(prev => ({ ...prev, currentView: 'game' }))}
                    className="px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                  >
                    ← 返回游戏
                  </button>
                </div>
              </div>

              {/* 回放内容 */}
              {gameHistory.gameRecords.length > 0 ? (
                <GameReplay
                  gameRecord={gameHistory.gameRecords[0]}
                  replayState={gameHistory.replayState}
                  onReplayControl={{
                    setProgress: gameHistory.setReplayProgress,
                    setSpeed: gameHistory.setReplaySpeed,
                    start: () => gameHistory.startReplay(gameHistory.gameRecords[0].id),
                    stop: gameHistory.stopReplay
                  }}
                  displayMode={appState.replayMode}
                />
              ) : (
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <div className="text-center text-gray-500 py-12">
                    <div className="text-6xl mb-4">🎴</div>
                    <p className="text-lg mb-2">暂无游戏记录可回放</p>
                    <p className="text-sm text-gray-400 mb-6">
                      开始一局游戏并完成后，就可以在这里回放整个牌局过程
                    </p>
                    <button
                      onClick={() => setAppState(prev => ({ ...prev, currentView: 'game' }))}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      🎮 开始游戏
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {appState.currentView === 'hand-input' && (
            <div className="hand-input-view">
              {/* 手牌输入界面 */}
              <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">🃏 手牌输入设置</h2>
                  <button
                    onClick={exitHandInput}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                  >
                    ← 返回游戏
                  </button>
                </div>

                {/* 步骤指示器 */}
                <div className="mb-6">
                  <div className="flex items-center justify-center space-x-4">
                    <div className={`flex items-center ${appState.handInput.inputStep === 'select_player' ? 'text-blue-600' : 'text-gray-400'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${appState.handInput.inputStep === 'select_player' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>1</div>
                      <span className="ml-2">选择玩家</span>
                    </div>
                    <div className="w-12 h-0.5 bg-gray-300"></div>
                    <div className={`flex items-center ${appState.handInput.inputStep === 'select_cards' ? 'text-blue-600' : 'text-gray-400'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${appState.handInput.inputStep === 'select_cards' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>2</div>
                      <span className="ml-2">选择手牌</span>
                    </div>
                    <div className="w-12 h-0.5 bg-gray-300"></div>
                    <div className={`flex items-center ${appState.handInput.inputStep === 'confirm' ? 'text-blue-600' : 'text-gray-400'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${appState.handInput.inputStep === 'confirm' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>3</div>
                      <span className="ml-2">确认开始</span>
                    </div>
                  </div>
                </div>

                {/* 步骤1: 选择玩家 */}
                {appState.handInput.inputStep === 'select_player' && (
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">请选择要设置手牌的玩家</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[Pos.BOTTOM, Pos.LEFT, Pos.TOP, Pos.RIGHT].map(position => (
                        <button
                          key={position}
                          onClick={() => selectPlayerForInput(position)}
                          className="p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                        >
                          <div className="text-center">
                            <div className="text-2xl mb-2">
                              {position === Pos.BOTTOM ? '👤' : position === Pos.LEFT ? '👥' : position === Pos.TOP ? '👫' : '👬'}
                            </div>
                            <div className="font-medium text-gray-800">
                              {position === Pos.BOTTOM ? '我' : position === Pos.LEFT ? '对手一' : position === Pos.TOP ? '队友' : '对手二'}
                            </div>
                            <div className="text-sm text-gray-500">
                              ({position === Pos.BOTTOM ? '自己' : position === Pos.LEFT ? '下家' : position === Pos.TOP ? '对家' : '上家'})
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              已设置: {appState.handInput.playerHands[position].length} 张
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 步骤2: 选择手牌 */}
                {appState.handInput.inputStep === 'select_cards' && appState.handInput.selectedPlayer && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">
                        为 {appState.handInput.selectedPlayer === Pos.BOTTOM ? '我' : 
                             appState.handInput.selectedPlayer === Pos.LEFT ? '对手一' : 
                             appState.handInput.selectedPlayer === Pos.TOP ? '队友' : '对手二'} 选择手牌
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">
                          已选择: {appState.handInput.playerHands[appState.handInput.selectedPlayer].length}/27 张
                        </span>
                        <button
                          onClick={() => setAppState(prev => ({ 
                            ...prev, 
                            handInput: { ...prev.handInput, inputStep: 'select_player', selectedPlayer: null } 
                          }))}
                          className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                        >
                          重新选择玩家
                        </button>
                        <button
                          onClick={confirmHandInput}
                          disabled={appState.handInput.playerHands[appState.handInput.selectedPlayer].length === 0}
                          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:bg-gray-300"
                        >
                          确认手牌
                        </button>
                      </div>
                    </div>

                    {/* 已选择的手牌显示 */}
                    {appState.handInput.playerHands[appState.handInput.selectedPlayer].length > 0 && (
                      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                        <h4 className="text-sm font-semibold text-blue-800 mb-2">已选择的手牌:</h4>
                        <div className="flex flex-wrap gap-2">
                          {appState.handInput.playerHands[appState.handInput.selectedPlayer].map((card) => {
                            const isRevealed = appState.handInput.revealedCards[appState.handInput.selectedPlayer!].includes(card.id);
                            return (
                              <div key={card.id} className="relative">
                                <div
                                  className={`cursor-pointer transform transition-all ${isRevealed ? 'ring-4 ring-yellow-400 shadow-lg scale-105' : 'hover:scale-105'}`}
                                  onClick={() => toggleRevealedCard(appState.handInput.selectedPlayer!, card.id)}
                                  title={isRevealed ? '点击取消明牌' : '点击设为明牌'}
                                >
                                  <CardImage
                                    rank={card.rank as any}
                                    suit={card.suit as any}
                                    displayName={card.rank.toString()}
                                    isWildCard={card.isWildCard}
                                    isRankCard={card.isRankCard}
                                    size="small"
                                  />
                                </div>
                                {isRevealed && (
                                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                                    <span className="text-xs text-white font-bold">明</span>
                                  </div>
                                )}
                                <button
                                  onClick={() => toggleCardForPlayer(card.id)}
                                  className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
                                  title="移除此牌"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 text-xs text-blue-600">
                          💡 点击卡牌可设置为明牌，明牌将在游戏中可见
                        </div>
                      </div>
                    )}

                    {/* 卡牌选择区域 - 使用现有的CardSelector */}
                    <CardSelector />
                  </div>
                )}

                {/* 步骤3: 确认并开始游戏 */}
                {appState.handInput.inputStep === 'confirm' && (
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-800 mb-6">手牌设置完成，确认开始游戏</h3>
                    
                    {/* 显示所有玩家的手牌统计 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {[Pos.BOTTOM, Pos.LEFT, Pos.TOP, Pos.RIGHT].map(position => {
                        const handCount = appState.handInput.playerHands[position].length;
                        const revealedCount = appState.handInput.revealedCards[position].length;
                        return (
                          <div key={position} className="p-4 bg-gray-50 rounded-lg">
                            <div className="text-sm font-medium text-gray-800">
                              {position === Pos.BOTTOM ? '我' : position === Pos.LEFT ? '对手一' : position === Pos.TOP ? '队友' : '对手二'}
                            </div>
                            <div className="text-lg font-bold text-gray-900">{handCount} 张</div>
                            {revealedCount > 0 && (
                              <div className="text-xs text-yellow-600">明牌: {revealedCount} 张</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={() => setAppState(prev => ({ 
                          ...prev, 
                          handInput: { ...prev.handInput, inputStep: 'select_player' } 
                        }))}
                        className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        重新设置
                      </button>
                      <button
                        onClick={startGame}
                        className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        🎮 开始游戏
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* 设置面板 */}
        {appState.showSettings && (
          <Settings
            isOpen={appState.showSettings}
            onClose={() => setAppState(prev => ({ ...prev, showSettings: false }))}
          />
        )}
    </div>
  );
};

export default App;