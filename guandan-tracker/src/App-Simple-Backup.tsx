/**
 * 掼蛋记牌器 - 图像化卡牌版本
 * 使用 SVG 生成的卡牌图像进行选择操作
 */

import React, { useState } from 'react';
import CardImage from './components/CardImage';
import { validateCardType } from './utils/guandanRules';

// 简化的类型定义
type GameRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
type PlayerPosition = 'bottom' | 'left' | 'top' | 'right';

interface Card {
  id: string;
  rank: GameRank | 15; // 15表示王
  isRankCard: boolean;
  isWildCard: boolean;
  displayName: string;
}

const App: React.FC = () => {
  const [currentRank, setCurrentRank] = useState<GameRank>(7);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerPosition>('bottom');
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);

  // 生成竖向排列的牌面
  const generateSortedCards = (): Card[] => {
    const cards: Card[] = [];
    
    // 排列顺序：2-A (不包括当前级数牌) -> 当前级数牌 -> 大小王
    const baseRanks = [];
    for (let rank = 2; rank <= 14; rank++) {
      if (rank !== currentRank) {
        baseRanks.push(rank);
      }
    }
    
    // 先添加普通牌 (2-A，不包括当前级数)
    baseRanks.forEach(rank => {
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
    
    // 添加当前级数牌 (8张，前6张黑色，后2张红色配牌)
    for (let i = 0; i < 8; i++) {
      const cardId = `${currentRank}-${i}`;
      const isWildCard = i >= 6; // 后两张是红心配牌
      
      cards.push({
        id: cardId,
        rank: currentRank,
        isRankCard: true,
        isWildCard,
        displayName: currentRank === 11 ? 'J' : currentRank === 12 ? 'Q' : currentRank === 13 ? 'K' : currentRank === 14 ? 'A' : currentRank.toString()
      });
    }
    
    // 添加大小王 (4张配牌)
    for (let i = 0; i < 4; i++) {
      cards.push({
        id: `joker-${i}`,
        rank: 15,
        isRankCard: false,
        isWildCard: true,
        displayName: i < 2 ? '小王' : '大王'
      });
    }
    
    return cards;
  };

  const cards = generateSortedCards();

  // 选择模式和拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // 玩家颜色设置
  const [playerColors, setPlayerColors] = useState({
    bottom: '#3b82f6', // 蓝色
    left: '#10b981',   // 绿色
    top: '#f59e0b',    // 黄色
    right: '#ef4444'   // 红色
  });

  // 已出牌记录 - 每个卡牌ID对应出牌的玩家
  const [playedCards, setPlayedCards] = useState<Record<string, PlayerPosition>>({});
  
  // 出牌历史记录 - 用于撤销
  const [playHistory, setPlayHistory] = useState<Array<{
    player: PlayerPosition;
    cardIds: string[];
    timestamp: number;
  }>>([]);

  // 检测触摸设备
  React.useEffect(() => {
    setIsTouchDevice('ontouchstart' in window);
  }, []);

  // 计算玩家牌数统计
  const getPlayerCardStats = (player: PlayerPosition) => {
    const playerPlayedCards = Object.entries(playedCards)
      .filter(([, cardPlayer]) => cardPlayer === player)
      .map(([cardId]) => cardId);
    
    const playedCount = playerPlayedCards.length;
    const remainingCount = 27 - playedCount; // 每个玩家初始27张牌
    
    return {
      played: playedCount,
      remaining: remainingCount
    };
  };

  // 处理卡牌选择
  const handleCardSelect = (cardId: string, forceMultiSelect: boolean = false) => {
    // 检查卡牌是否已出
    if (playedCards[cardId]) {
      return; // 静默返回，不显示提示
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
    const isCtrlClick = e?.ctrlKey || e?.metaKey;
    handleCardSelect(cardId, isCtrlClick);
  };

  // 处理触摸事件（手机端）
  const handleCardTouch = (cardId: string) => {
    // 如果已经有选中的卡牌，或者已经在多选模式，则使用多选
    if (selectedCards.size > 0 || isMultiSelectMode) {
      setIsMultiSelectMode(true);
      setSelectedCards(prev => {
        const newSelected = new Set(prev);
        if (newSelected.has(cardId)) {
          newSelected.delete(cardId);
        } else {
          newSelected.add(cardId);
        }
        return newSelected;
      });
    } else {
      // 第一张卡牌，单选
      setSelectedCards(new Set([cardId]));
    }
  };

  // 拖拽选择处理
  const handleMouseDown = (cardId: string, e?: React.MouseEvent) => {
    // 如果按住了Ctrl键，不启动拖拽，让点击事件处理
    if (e?.ctrlKey || e?.metaKey) {
      return;
    }
    
    e?.preventDefault();
    e?.stopPropagation();
    setIsDragging(true);
    
    // 开始拖拽时，直接添加当前卡牌到选择中（不清空之前的选择）
    setSelectedCards(prev => {
      const newSelected = new Set(prev);
      newSelected.add(cardId);
      return newSelected;
    });
  };

  const handleMouseEnter = (cardId: string) => {
    if (isDragging) {
      // 拖拽过程中只添加，不移除
      setSelectedCards(prev => {
        const newSelected = new Set(prev);
        newSelected.add(cardId);
        return newSelected;
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 重置多选模式
  const resetMultiSelectMode = () => {
    setIsMultiSelectMode(false);
  };

  // 获取下一个玩家
  const getNextPlayer = (currentPlayer: PlayerPosition): PlayerPosition => {
    const playerOrder: PlayerPosition[] = ['bottom', 'left', 'top', 'right'];
    const currentIndex = playerOrder.indexOf(currentPlayer);
    const nextIndex = (currentIndex + 1) % playerOrder.length;
    return playerOrder[nextIndex];
  };

  // 确认出牌
  const handlePlayCards = () => {
    if (selectedCards.size === 0) return;
    
    // 获取选中的卡牌对象
    const selectedCardObjects = cards.filter(card => selectedCards.has(card.id));
    
    // 验证牌型
    const validation = validateCardType(selectedCardObjects, currentRank);
    
    if (!validation.isValid) {
      alert(`出牌错误：${validation.description}`);
      return;
    }
    
    // 记录出牌历史
    const playRecord = {
      player: selectedPlayer,
      cardIds: Array.from(selectedCards),
      timestamp: Date.now()
    };
    
    setPlayHistory(prev => [...prev, playRecord]);
    
    // 将卡牌标记为已出
    const newPlayedCards = { ...playedCards };
    selectedCards.forEach(cardId => {
      newPlayedCards[cardId] = selectedPlayer;
    });
    setPlayedCards(newPlayedCards);
    
    // 直接完成出牌，不显示成功提示
    setSelectedCards(new Set());
    resetMultiSelectMode();
    
    // 自动切换到下一个玩家
    setSelectedPlayer(getNextPlayer(selectedPlayer));
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
    
    const lastPlay = playHistory[playHistory.length - 1];
    
    // 移除已出牌记录
    const newPlayedCards = { ...playedCards };
    lastPlay.cardIds.forEach(cardId => {
      delete newPlayedCards[cardId];
    });
    setPlayedCards(newPlayedCards);
    
    // 移除历史记录
    setPlayHistory(prev => prev.slice(0, -1));
    
    // 直接完成撤销，不显示提示
  };

  // 不需要分组，直接竖向排列

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部栏 */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-800">掼蛋记牌器</h1>
            {/* 级数选择 */}
            <div className="flex items-center space-x-2 bg-white rounded-lg p-2 shadow-sm">
              <span className="text-sm font-medium text-gray-700">级数:</span>
              <select
                value={currentRank}
                onChange={(e) => setCurrentRank(parseInt(e.target.value) as GameRank)}
                className="bg-blue-50 border border-blue-200 rounded px-3 py-1 text-sm font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as GameRank[]).map(rank => (
                  <option key={rank} value={rank}>
                    {rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : rank === 14 ? 'A' : rank}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(true)}
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
        <div className="space-y-6">
          {/* 玩家信息区域 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['bottom', 'left', 'top', 'right'] as PlayerPosition[]).map(position => {
              const isSelected = selectedPlayer === position;
              const playerStats = getPlayerCardStats(position);
              const playerNames = {
                bottom: '下家',
                left: '左家',
                top: '上家',
                right: '右家'
              };

              return (
                <div
                  key={position}
                  className={`relative p-3 rounded-lg cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-500 shadow-md' 
                      : 'bg-white border border-gray-200 hover:border-gray-300 shadow-sm'
                  }`}
                  onClick={() => setSelectedPlayer(position)}
                  style={{
                    borderColor: isSelected ? '#3b82f6' : playerColors[position],
                    borderWidth: isSelected ? '2px' : '1px'
                  }}
                >
                  {/* 玩家颜色标识 */}
                  <div 
                    className="absolute top-1 right-1 w-3 h-3 rounded-full"
                    style={{ backgroundColor: playerColors[position] }}
                  />
                  
                  <div className="font-medium text-gray-800 mb-2">{playerNames[position]}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">{playerStats.played}</div>
                      <div className="text-gray-500">已出</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">{playerStats.remaining}</div>
                      <div className="text-gray-500">剩余</div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="absolute -top-1 -left-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 当前玩家提示和切换按钮 */}
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={() => setSelectedPlayer(getNextPlayer(selectedPlayer))}
              className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
              title="切换到下一个玩家"
            >
              ← 切换
            </button>
            <span className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
              当前玩家: {
                selectedPlayer === 'bottom' ? '下家' :
                selectedPlayer === 'left' ? '左家' :
                selectedPlayer === 'top' ? '上家' : '右家'
              }
            </span>
            <button
              onClick={() => setSelectedPlayer(getNextPlayer(selectedPlayer))}
              className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
              title="切换到下一个玩家"
            >
              切换 →
            </button>
          </div>

          {/* 牌面选择区域 */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            {/* 多选模式切换按钮 - 仅手机端显示 */}
            {isTouchDevice && (
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      isMultiSelectMode 
                        ? 'bg-green-500 text-white hover:bg-green-600' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {isMultiSelectMode ? '✓ 多选模式' : '多选模式'}
                  </button>
                  <span className="text-xs text-gray-500">
                    开启后点击卡牌即可多选
                  </span>
                </div>
              </div>
            )}

            {/* 选择状态提示 */}
            {selectedCards.size > 0 && (
              <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-700 font-medium">
                    已选择 {selectedCards.size} 张牌
                  </span>
                  {isMultiSelectMode && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      多选模式
                    </span>
                  )}
                </div>
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

            {/* 撤销按钮 */}
            {playHistory.length > 0 && (
              <div className="mb-4">
                <button
                  onClick={handleUndo}
                  className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors"
                >
                  撤销上次出牌 ({playHistory.length})
                </button>
              </div>
            )}
            
            {/* 牌面选择区域 - 自适应排列 */}
            <div 
              className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 lg:grid-cols-20 xl:grid-cols-24 2xl:grid-cols-27 gap-1 justify-items-center select-none p-2"
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {cards.map((card) => {
                const isSelected = selectedCards.has(card.id);
                const isPlayed = playedCards[card.id];
                const playerColor = isPlayed ? playerColors[isPlayed] : undefined;
                
                return (
                  <div
                    key={card.id}
                    className={`relative flex-shrink-0 ${isPlayed ? 'cursor-not-allowed' : ''}`}
                    style={{
                      backgroundColor: isPlayed ? playerColor : 'transparent',
                      borderRadius: isPlayed ? '8px' : '0px',
                      padding: isPlayed ? '2px' : '0px',
                      opacity: isPlayed ? 0.8 : 1
                    }}
                  >
                    <CardImage
                      rank={card.rank}
                      suit={card.isWildCard ? 'hearts' : 'spades'}
                      displayName={card.displayName}
                      isWildCard={card.isWildCard}
                      isRankCard={card.isRankCard}
                      isSelected={isSelected}
                      remainingCount={1} // 不显示数量
                      onClick={(e) => {
                        if (e && !isPlayed) {
                          if (isTouchDevice) {
                            handleCardTouch(card.id);
                          } else {
                            // 确保事件对象正确传递
                            handleCardClick(card.id, e as React.MouseEvent);
                          }
                        }
                      }}
                      onMouseDown={(e) => {
                        // 只在非触摸设备上启用拖拽，且不是Ctrl点击
                        if (!isTouchDevice && !isPlayed && !(e?.ctrlKey || e?.metaKey)) {
                          handleMouseDown(card.id, e as React.MouseEvent);
                        }
                      }}
                      onMouseEnter={() => !isPlayed && handleMouseEnter(card.id)}
                      className={`flex-shrink-0 ${isPlayed ? 'pointer-events-none' : ''}`}
                    />
                    {/* 已出牌的半透明遮罩 */}
                    {isPlayed && (
                      <div 
                        className="absolute inset-0 rounded-lg"
                        style={{ 
                          backgroundColor: playerColor,
                          opacity: 0.3,
                          pointerEvents: 'none'
                        }}
                        title={`${isPlayed}玩家已出`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* 操作提示 */}
            <div className="mt-4 text-xs text-gray-500 space-y-1">
              {isTouchDevice ? (
                <>
                  <div>• 点击"多选模式"按钮开启多选功能</div>
                  <div>• 多选模式下，点击卡牌可添加/移除选择</div>
                </>
              ) : (
                <>
                  <div>• Ctrl+点击：多选添加/移除卡牌</div>
                  <div>• 拖拽：连续选择多张卡牌</div>
                </>
              )}
              <div>• 出牌时自动验证掼蛋牌型：单、对、三不带、三带二、飞机、连对、顺子、炸弹</div>
              <div>• 5张顺子默认为同花顺，可以管上5张以下的炸弹</div>
              <div>• 炸弹可以使用红心配牌，5张以上炸弹可以管上5张顺子</div>
              <div>• 已出牌显示对应玩家颜色标识，可在设置中自定义颜色</div>
              <div>• 红色卡牌表示配牌，可代替任意牌参与牌型组合</div>
              <div>• 支持撤销功能，可连续撤销错误出牌</div>
            </div>
          </div>
        </div>
      </main>

      {/* 设置面板 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-full overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">游戏设置</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-6">
                {/* 玩家颜色设置 */}
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-3">玩家颜色设置</h3>
                  <div className="space-y-3">
                    {(['bottom', 'left', 'top', 'right'] as PlayerPosition[]).map(position => {
                      const playerNames = {
                        bottom: '下家',
                        left: '左家',
                        top: '上家',
                        right: '右家'
                      };
                      
                      return (
                        <div key={position} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{playerNames[position]}</span>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={playerColors[position]}
                              onChange={(e) => setPlayerColors(prev => ({
                                ...prev,
                                [position]: e.target.value
                              }))}
                              className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                            />
                            <button
                              onClick={() => setPlayerColors(prev => ({
                                ...prev,
                                [position]: {
                                  bottom: '#3b82f6',
                                  left: '#10b981',
                                  top: '#f59e0b',
                                  right: '#ef4444'
                                }[position]
                              }))}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              重置
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-3">游戏规则</h3>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="ml-2 text-sm text-gray-700">启用牌型验证</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="ml-2 text-sm text-gray-700">红心级数牌作为配牌</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="ml-2 text-sm text-gray-700">启用自动保存</span>
                    </label>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <button 
                    onClick={() => {
                      setPlayedCards({});
                      setPlayHistory([]);
                      setSelectedCards(new Set());
                      resetMultiSelectMode();
                      // 直接重置，不显示提示
                    }}
                    className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition-colors"
                  >
                    重置游戏
                  </button>
                  <button className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 transition-colors">
                    导出游戏数据
                  </button>
                  <button className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors">
                    保存当前游戏
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
