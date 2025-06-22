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

// 游戏状态
interface GameState {
  phase: 'setup' | 'input' | 'playing' | 'finished'; // 游戏阶段
  round: number; // 当前回合数
  startTime: number | null; // 游戏开始时间
  totalPlays: number; // 总出牌次数
}

// 手牌输入状态
interface HandInputState {
  isInputMode: boolean;
  selectedPlayerForInput: PlayerPosition | null;
  playerHands: Record<PlayerPosition, Card[]>;
  revealedCards: Record<PlayerPosition, string[]>; // 明牌的cardId数组
  gameStarted: boolean; // 游戏是否已开始
  currentRevealedPlayer: PlayerPosition | null; // 当前可使用明牌的玩家
}

const App: React.FC = () => {
  const [currentRank, setCurrentRank] = useState<GameRank>(7);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerPosition>('bottom');
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);

  // 游戏状态管理
  const [gameState, setGameState] = useState<GameState>({
    phase: 'setup',
    round: 1,
    startTime: null,
    totalPlays: 0
  });
  
  // 手牌输入状态
  const [handInput, setHandInput] = useState<HandInputState>({
    isInputMode: false,
    selectedPlayerForInput: null,
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
    currentRevealedPlayer: null
  });

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
    bottom: '#ef4444', // 红色
    left: '#10b981',   // 绿色
    top: '#000000',    // 黑色
    right: '#3b82f6'   // 蓝色
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

  // 游戏时长定时更新
  React.useEffect(() => {
    let timer: number;
    
    if (gameState.phase === 'playing' && gameState.startTime) {
      timer = window.setInterval(() => {
        // 强制重新渲染来更新时间显示
        setGameState(prev => ({ ...prev }));
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gameState.phase, gameState.startTime]);

  // 计算玩家牌数统计
  const getPlayerCardStats = (player: PlayerPosition) => {
    if (handInput.isInputMode) {
      // 手牌输入模式：显示明牌设置状态
      const inputCount = handInput.playerHands[player].length;
      const revealedCount = handInput.revealedCards[player].length;
      
      if (player === 'bottom') {
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
    } else if (handInput.gameStarted) {
      // 游戏进行中：显示已出牌数和剩余手牌数
      const inputCount = handInput.playerHands[player].length;
      const revealedCount = handInput.revealedCards[player].length;
      
      // 计算实际已出牌数（只计算已标记为已出的牌）
      const playerPlayedCards = Object.entries(playedCards)
        .filter(([, cardPlayer]) => cardPlayer === player)
        .map(([cardId]) => cardId);
      const playedCount = playerPlayedCards.length;
      
      return {
        played: playedCount, // 实际已出牌数
        remaining: inputCount - playedCount, // 剩余手牌数
        revealed: revealedCount
      };
    } else {
      // 正常游戏模式：显示已出牌数量（无手牌设置的情况）
      const playerPlayedCards = Object.entries(playedCards)
        .filter(([, cardPlayer]) => cardPlayer === player)
        .map(([cardId]) => cardId);
      
      const playedCount = playerPlayedCards.length;
      const remainingCount = 27 - playedCount;
      
      return {
        played: playedCount,
        remaining: remainingCount,
        revealed: 0
      };
    }
  };

  // 检查卡牌是否可选择
  const isCardSelectable = (cardId: string): boolean => {
    // 已出牌不可选择
    if (playedCards[cardId]) {
      console.log(`卡牌${cardId}已出牌，不可选择`);
      return false;
    }

    // 手牌输入模式：所有卡牌都可选择
    if (handInput.isInputMode) {
      console.log(`手牌输入模式，卡牌${cardId}可选择`);
      return true;
    }

    // 游戏开始后的明牌权限控制
    if (handInput.gameStarted) {
      // 检查是否为玩家手牌
      let isRevealedCard = false;
      let cardOwner: PlayerPosition | null = null;
      
      for (const [player, hands] of Object.entries(handInput.playerHands)) {
        if (hands.some(card => card.id === cardId)) {
          cardOwner = player as PlayerPosition;
          isRevealedCard = handInput.revealedCards[cardOwner].includes(cardId);
          break;
        }
      }

      console.log(`游戏中卡牌选择检查: cardId=${cardId}, cardOwner=${cardOwner}, isRevealedCard=${isRevealedCard}, selectedPlayer=${selectedPlayer}`);

      // 如果是明牌，只有对应玩家可以选择
      if (isRevealedCard && cardOwner) {
        const canSelect = selectedPlayer === cardOwner;
        console.log(`明牌${cardId}权限检查: 归属${cardOwner}, 当前玩家${selectedPlayer}, 可选择=${canSelect}`);
        return canSelect;
      }

      // 如果是底家的手牌（非明牌），只有底家可以选择
      if (cardOwner === 'bottom' && !isRevealedCard) {
        const canSelect = selectedPlayer === 'bottom';
        console.log(`底家手牌${cardId}权限检查: 当前玩家${selectedPlayer}, 可选择=${canSelect}`);
        return canSelect;
      }

      // 如果是其他玩家的手牌（非明牌），不能选择
      if (cardOwner && cardOwner !== 'bottom' && !isRevealedCard) {
        console.log(`其他玩家${cardOwner}非明牌${cardId}，不可选择`);
        return false;
      }

      // 其他卡牌（非玩家手牌）任何玩家都可以选择
      if (!cardOwner) {
        console.log(`普通卡牌${cardId}，任何玩家可选择`);
        return true;
      }
    }

    // 正常模式：所有卡牌都可选择
    console.log(`正常模式，卡牌${cardId}可选择`);
    return true;
  };

  // 处理卡牌选择
  const handleCardSelect = (cardId: string, forceMultiSelect: boolean = false) => {
    // 检查卡牌是否可选择
    if (!isCardSelectable(cardId)) {
      // 游戏开始后的权限提示
      if (handInput.gameStarted) {
        let cardOwner: PlayerPosition | null = null;
        let isRevealedCard = false;
        
        for (const [player, hands] of Object.entries(handInput.playerHands)) {
          if (hands.some(card => card.id === cardId)) {
            cardOwner = player as PlayerPosition;
            isRevealedCard = handInput.revealedCards[cardOwner].includes(cardId);
            break;
          }
        }

        if (isRevealedCard && cardOwner && selectedPlayer !== cardOwner) {
          const playerNames = {
            bottom: '我',
            left: '对手一', 
            top: '队友',
            right: '对手二'
          };
          alert(`这是${playerNames[cardOwner]}的明牌，只有${playerNames[cardOwner]}可以使用！`);
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
    // 手牌输入模式和游戏模式都使用相同的多选逻辑
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

  // 手牌输入模式控制函数
  const startHandInput = () => {
    setGameState(prev => ({
      ...prev,
      phase: 'input'
    }));

    setHandInput(prev => ({
      ...prev,
      isInputMode: true,
              selectedPlayerForInput: 'bottom' // 默认选择我
    }));
  };

  const exitHandInput = () => {
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
    
    // 检查是否所有玩家都已设置手牌
    const bottomHasCards = handInput.playerHands.bottom.length > 0;
    const otherPlayersReady = ['left', 'top', 'right'].every(pos => {
      const player = pos as PlayerPosition;
      return handInput.playerHands[player].length <= 1; // 可以没有明牌，或有1张明牌
    });

    console.log('bottomHasCards:', bottomHasCards);
    console.log('otherPlayersReady:', otherPlayersReady);

    if (!bottomHasCards) {
              alert('请先为我设置手牌！\n\n操作步骤：\n1. 点击我的玩家头像\n2. 点击卡牌添加到我的手牌中\n3. 重新点击开始游戏');
      return;
    }

    console.log('开始游戏...');

    // 更新游戏状态
    setGameState({
      phase: 'playing',
      round: 1,
      startTime: Date.now(),
      totalPlays: 0
    });

    setHandInput(prev => ({
      ...prev,
      gameStarted: true,
      isInputMode: false,
      selectedPlayerForInput: null
    }));

    console.log('游戏状态已更新');
  };

  // 返回手牌输入
  const backToHandInput = () => {
    // 更新游戏状态
    setGameState({
      phase: 'input',
      round: 1,
      startTime: null,
      totalPlays: 0
    });

    setHandInput(prev => ({
      ...prev,
      gameStarted: false,
      isInputMode: true,
      currentRevealedPlayer: null
    }));
    
    // 清空已出牌记录
    setPlayedCards({});
    setPlayHistory([]);
    setSelectedCards(new Set());
  };

  // 重新开始游戏
  const restartGame = () => {
    setGameState({
      phase: 'setup',
      round: 1,
      startTime: null,
      totalPlays: 0
    });

    setHandInput({
      isInputMode: false,
      selectedPlayerForInput: null,
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
      currentRevealedPlayer: null
    });

    // 清空所有游戏数据
    setPlayedCards({});
    setPlayHistory([]);
    setSelectedCards(new Set());
    setSelectedPlayer('bottom');
  };

  const selectPlayerForInput = (player: PlayerPosition) => {
    setHandInput(prev => ({
      ...prev,
      selectedPlayerForInput: player
    }));
  };

  // 为玩家添加/移除手牌
  const toggleCardForPlayer = (cardId: string) => {
    if (!handInput.selectedPlayerForInput) return;
    
    const player = handInput.selectedPlayerForInput;
    const currentCards = handInput.playerHands[player];
    const hasCard = currentCards.some(card => card.id === cardId);
    
    console.log(`toggleCardForPlayer: ${player}, cardId: ${cardId}, hasCard: ${hasCard}, currentCount: ${currentCards.length}`);
    
    if (hasCard) {
      // 移除卡牌
      setHandInput(prev => ({
        ...prev,
        playerHands: {
          ...prev.playerHands,
          [player]: currentCards.filter(card => card.id !== cardId)
        },
        revealedCards: {
          ...prev.revealedCards,
          [player]: prev.revealedCards[player].filter(id => id !== cardId)
        }
      }));
    } else {
      // 添加卡牌限制检查
      let maxCards = 27;
      if (player !== 'bottom') {
        // 其他玩家最多1张明牌
        maxCards = 1;
      }
      
      console.log(`尝试添加卡牌，当前数量: ${currentCards.length}, 最大数量: ${maxCards}`);
      
      if (currentCards.length < maxCards) {
        const cardToAdd = cards.find(card => card.id === cardId);
        if (cardToAdd) {
          setHandInput(prev => ({
            ...prev,
            playerHands: {
              ...prev.playerHands,
              [player]: [...currentCards, cardToAdd]
            }
          }));
          console.log(`成功添加卡牌，新数量: ${currentCards.length + 1}`);
        }
      } else {
        console.log(`达到最大数量限制: ${maxCards}`);
      }
    }
  };

  // 切换明牌状态
  const toggleRevealedCard = (cardId: string, player: PlayerPosition) => {
    const isRevealed = handInput.revealedCards[player].includes(cardId);
    const hasCard = handInput.playerHands[player].some(card => card.id === cardId);
    
    if (!hasCard) return; // 只能标记已在手牌中的卡牌
    
    setHandInput(prev => {
      const currentRevealed = prev.revealedCards[player];
      
      if (isRevealed) {
        // 移除明牌标记
        return {
          ...prev,
          revealedCards: {
            ...prev.revealedCards,
            [player]: currentRevealed.filter(id => id !== cardId)
          }
        };
      } else {
        // 添加明牌标记
        if (player === 'bottom') {
          // 我可以标记多张明牌
          return {
            ...prev,
            revealedCards: {
              ...prev.revealedCards,
              [player]: [...currentRevealed, cardId]
            }
          };
        } else {
          // 其他玩家最多1张明牌，替换之前的明牌
          return {
            ...prev,
            revealedCards: {
              ...prev.revealedCards,
              [player]: [cardId]
            }
          };
        }
      }
    });
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
    
    // 手牌输入模式：将选中的卡牌添加到当前玩家的手牌
    if (handInput.isInputMode && handInput.selectedPlayerForInput) {
      const selectedCardIds = Array.from(selectedCards);
      const player = handInput.selectedPlayerForInput;
      const currentCards = handInput.playerHands[player];
      
      // 检查数量限制
      let maxCards = 27;
      if (player !== 'bottom') {
        maxCards = 1;
      }
      
      if (currentCards.length + selectedCardIds.length > maxCards) {
        alert(`${player === 'bottom' ? '我' : player === 'left' ? '对手一' : player === 'top' ? '队友' : '对手二'}最多只能设置${maxCards}张明牌！`);
        return;
      }
      
      // 添加选中的卡牌到玩家手牌
      const selectedCardObjects = cards.filter(card => selectedCards.has(card.id));
      setHandInput(prev => ({
        ...prev,
        playerHands: {
          ...prev.playerHands,
          [player]: [...currentCards, ...selectedCardObjects]
        }
      }));
      
      // 清空选择
      setSelectedCards(new Set());
      resetMultiSelectMode();
      
      // 如果完成我的明牌设置，自动切换到下一个玩家
      if (player === 'bottom') {
        // 切换到对手一设置明牌
        setHandInput(prev => ({
          ...prev,
          selectedPlayerForInput: 'left'
        }));
      } else {
        // 其他玩家完成后，不自动切换，让用户手动选择下一个玩家或开始游戏
        setHandInput(prev => ({
          ...prev,
          selectedPlayerForInput: null
        }));
      }
      
      return;
    }
    
    // 游戏模式：正常出牌逻辑
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

    // 只有在游戏进行中才更新游戏统计（不在手牌输入时统计）
    if (handInput.gameStarted) {
      setGameState(prev => ({
        ...prev,
        totalPlays: prev.totalPlays + 1
      }));
      console.log(`实际出牌统计更新: 第${gameState.totalPlays + 1}次出牌`);
    }
    
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

    // 只有在游戏进行中才更新游戏统计
    if (handInput.gameStarted) {
      setGameState(prev => ({
        ...prev,
        totalPlays: Math.max(0, prev.totalPlays - 1)
      }));
      console.log(`撤销出牌统计更新: 减少到${Math.max(0, gameState.totalPlays - 1)}次出牌`);
    }
    
    // 直接完成撤销，不显示提示
  };

  // 计算游戏时长
  const getGameDuration = (): string => {
    if (!gameState.startTime) return '00:00';
    
    const duration = Date.now() - gameState.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 计算剩余卡牌数
  const getRemainingCards = (): number => {
    return cards.length - Object.keys(playedCards).length;
  };

  // 检查游戏是否结束
  const checkGameEnd = (): boolean => {
    if (!handInput.gameStarted) return false;
    
    // 检查我的手牌是否出完
    const bottomPlayedCards = Object.entries(playedCards)
      .filter(([, player]) => player === 'bottom')
      .map(([cardId]) => cardId);
    
    const bottomTotalCards = handInput.playerHands.bottom.length;
    
    return bottomPlayedCards.length >= bottomTotalCards;
  };

  // 游戏结束处理
  React.useEffect(() => {
    if (gameState.phase === 'playing' && checkGameEnd()) {
      setGameState(prev => ({
        ...prev,
        phase: 'finished'
      }));
      
      alert(`🎉 游戏结束！\n游戏时长: ${getGameDuration()}\n总出牌次数: ${gameState.totalPlays}`);
    }
  }, [playedCards, gameState.phase, gameState.totalPlays, checkGameEnd, getGameDuration]);

  // 不需要分组，直接竖向排列

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部栏 */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-800">掼蛋记牌器</h1>
            
            {/* 游戏状态信息 */}
            {(gameState.phase === 'playing' || gameState.phase === 'finished') && (
              <div className="flex items-center space-x-3 text-sm">
                <div className={`px-2 py-1 rounded ${
                  gameState.phase === 'finished' 
                    ? 'bg-yellow-100 text-yellow-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {gameState.phase === 'finished' ? '🏆 游戏结束' : '🎮 第' + gameState.round + '局'}
                </div>
                <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  ⏱️ {getGameDuration()}
                </div>
                <div className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                  📊 {gameState.totalPlays}次出牌
                </div>
                <div className="bg-orange-100 text-orange-700 px-2 py-1 rounded">
                  🃏 {getRemainingCards()}张剩余
                </div>
              </div>
            )}
            
            {/* 级数选择 */}
            <div className="flex items-center space-x-2 bg-white rounded-lg p-2 shadow-sm">
              <span className="text-sm font-medium text-gray-700">级数:</span>
              <select
                value={currentRank}
                onChange={(e) => setCurrentRank(parseInt(e.target.value) as GameRank)}
                className="bg-blue-50 border border-blue-200 rounded px-3 py-1 text-sm font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={gameState.phase === 'playing'}
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
            {handInput.gameStarted ? (
              // 游戏进行中
              <div className="flex items-center space-x-2">
                <button
                  onClick={backToHandInput}
                  className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                >
                  ← 返回输入
                </button>
                <button
                  onClick={restartGame}
                  className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
                  title="重新开始游戏"
                >
                  🔄 重新开始
                </button>
              </div>
            ) : !handInput.isInputMode ? (
              // 正常模式
              <button
                onClick={startHandInput}
                className="px-3 py-2 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors"
              >
                🃏 手牌输入
              </button>
            ) : (
              // 手牌输入模式
              <div className="flex items-center space-x-2">
                <button
                  onClick={startGame}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    handInput.playerHands.bottom.length === 0
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                  disabled={handInput.playerHands.bottom.length === 0}
                  title={handInput.playerHands.bottom.length === 0 ? '请先为我设置明牌' : '开始游戏'}
                >
                  🎮 开始游戏{handInput.playerHands.bottom.length === 0 && '(需要我的手牌)'}
                </button>
                <button
                  onClick={exitHandInput}
                  className="px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                >
                  ← 退出输入
                </button>
              </div>
            )}
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
              const isSelected = handInput.isInputMode ? handInput.selectedPlayerForInput === position : selectedPlayer === position;
              const playerStats = getPlayerCardStats(position);
              const playerNames = {
                bottom: '我',
                left: '对手一',
                top: '队友',
                right: '对手二'
              };

              const playerPositionLabels = {
                bottom: '自己',
                left: '下家',
                top: '对家',
                right: '上家'
              };

              return (
                <div
                  key={position}
                  className={`relative p-3 rounded-lg cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-500 shadow-md' 
                      : 'bg-white border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
                  }`}
                  onClick={() => {
                    if (handInput.isInputMode) {
                      selectPlayerForInput(position);
                    } else {
                      setSelectedPlayer(position);
                    }
                  }}
                  style={{
                    borderColor: isSelected ? '#3b82f6' : playerColors[position],
                    borderWidth: isSelected ? '2px' : '1px'
                  }}
                >
                  {/* 玩家颜色标识和位置标注 */}
                  <div className="absolute top-1 right-1 flex flex-col items-end">
                    <div 
                      className="w-3 h-3 rounded-full mb-1"
                      style={{ backgroundColor: playerColors[position] }}
                    />
                    <div className="text-xs text-gray-500 font-medium">
                      {playerPositionLabels[position]}
                    </div>
                  </div>
                  
                  <div className="font-medium text-gray-800 mb-2">{playerNames[position]}</div>
                  {handInput.isInputMode ? (
                    // 手牌输入模式显示
                    position === 'bottom' ? (
                      // 我显示：已设置的明牌数
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">{playerStats.played}</div>
                          <div className="text-gray-500">明牌</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-orange-600">{playerStats.revealed}</div>
                          <div className="text-gray-500">标记</div>
                        </div>
                      </div>
                    ) : (
                      // 其他玩家显示：明牌数、可设置数
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-center">
                          <div className="text-lg font-bold text-orange-600">{playerStats.played}</div>
                          <div className="text-gray-500">明牌</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{playerStats.remaining}</div>
                          <div className="text-gray-500">可设</div>
                        </div>
                      </div>
                    )
                  ) : (
                    // 正常模式显示
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
            {playHistory.length > 0 && !handInput.isInputMode && (
              <button
                onClick={handleUndo}
                className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors"
              >
                ↶ 撤销出牌 ({playHistory.length}次可撤销)
              </button>
            )}
            
            {/* 手牌输入模式的撤销按钮 */}
            {handInput.isInputMode && handInput.selectedPlayerForInput && 
             handInput.playerHands[handInput.selectedPlayerForInput].length > 0 && (
              <button
                onClick={() => {
                  const currentPlayer = handInput.selectedPlayerForInput!;
                  setHandInput(prev => ({
                    ...prev,
                    playerHands: {
                      ...prev.playerHands,
                      [currentPlayer]: prev.playerHands[currentPlayer].slice(0, -1)
                    }
                  }));
                }}
                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
              >
                ⬅️ 撤销最后一张明牌
              </button>
            )}
          </div>

          {/* 当前玩家提示和切换按钮 */}
          {handInput.gameStarted ? (
            // 游戏进行中：显示当前玩家和明牌权限提示
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={() => setSelectedPlayer(getNextPlayer(selectedPlayer))}
                  className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                  title="切换到下一个玩家"
                >
                  ← 切换
                </button>
                <span className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
                  🎮 游戏进行中 - 当前玩家: {
                    selectedPlayer === 'bottom' ? '我' :
                    selectedPlayer === 'left' ? '对手一' :
                    selectedPlayer === 'top' ? '队友' : '对手二'
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
              <div className="text-xs text-gray-600">
                💡 明牌只能由对应玩家使用，手牌只能由我使用
              </div>
            </div>
          ) : handInput.isInputMode ? (
            // 手牌输入模式：显示玩家选择提示
            <div className="text-center space-y-3">
              {handInput.selectedPlayerForInput ? (
                <div className="space-y-2">
                  <span className="inline-block bg-orange-100 text-orange-800 px-4 py-2 rounded-full text-sm font-medium">
                    正在为 {
                      handInput.selectedPlayerForInput === 'bottom' ? '我' :
                      handInput.selectedPlayerForInput === 'left' ? '对手一' :
                      handInput.selectedPlayerForInput === 'top' ? '队友' : '对手二'
                    } 设置明牌 (已设置{handInput.playerHands[handInput.selectedPlayerForInput].length}张)
                  </span>
                  <div className="flex items-center justify-center space-x-2">
                    <button
                      onClick={() => setHandInput(prev => ({ ...prev, selectedPlayerForInput: null }))}
                      className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                    >
                      重新选择
                    </button>
                    {handInput.selectedPlayerForInput !== 'bottom' && (
                      <button
                        onClick={() => setHandInput(prev => ({ ...prev, selectedPlayerForInput: null }))}
                        className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 transition-colors"
                      >
                        跳过此玩家
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <span className="inline-block bg-orange-100 text-orange-800 px-4 py-2 rounded-full text-sm font-medium">
                    📝 明牌设置模式 - 点击玩家头像选择要设置明牌的玩家
                  </span>
                  {handInput.playerHands.bottom.length === 0 ? (
                    <div className="text-xs text-red-600 font-medium">
                      ⚠️ 请先为我设置明牌（点击我的头像开始）
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-green-600 font-medium">
                        ✅ 我的明牌已设置完成，可以继续为其他玩家设置明牌或开始游戏
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        {['left', 'top', 'right'].filter(player => 
                          handInput.playerHands[player as PlayerPosition].length === 0
                        ).length > 0 && (
                          <>
                            <span className="text-xs text-gray-600">继续设置：</span>
                            {handInput.playerHands.left.length === 0 && (
                              <button
                                onClick={() => setHandInput(prev => ({ ...prev, selectedPlayerForInput: 'left' }))}
                                className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                              >
                                对手一
                              </button>
                            )}
                            {handInput.playerHands.top.length === 0 && (
                              <button
                                onClick={() => setHandInput(prev => ({ ...prev, selectedPlayerForInput: 'top' }))}
                                className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                              >
                                队友
                              </button>
                            )}
                            {handInput.playerHands.right.length === 0 && (
                              <button
                                onClick={() => setHandInput(prev => ({ ...prev, selectedPlayerForInput: 'right' }))}
                                className="px-2 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600 transition-colors"
                              >
                                对手二
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // 正常模式：显示当前玩家
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
                  selectedPlayer === 'bottom' ? '我' :
                  selectedPlayer === 'left' ? '对手一' :
                  selectedPlayer === 'top' ? '队友' : '对手二'
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
          )}

          {/* 牌面选择区域 */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            {/* 手机端按钮组 */}
            {isTouchDevice && (
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {!handInput.isInputMode ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-gray-600">
                        💡 手机端：长按已分配的卡牌可标记为明牌
                      </span>
                    </>
                  )}
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
                    {handInput.isInputMode ? '确认选择' : '确认出牌'}
                  </button>
                </div>
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
                
                // 检查卡牌是否已被分配给某个玩家
                let assignedPlayer = null;
                let isRevealedCard = false;
                // 在手牌输入模式或游戏开始后都需要检查卡牌归属
                if (handInput.isInputMode || handInput.gameStarted) {
                  for (const [player, hands] of Object.entries(handInput.playerHands)) {
                    if (hands.some(handCard => handCard.id === card.id)) {
                      assignedPlayer = player as PlayerPosition;
                      // 检查是否为明牌
                      isRevealedCard = handInput.revealedCards[assignedPlayer].includes(card.id);
                      break;
                    }
                  }
                }
                
                // 检查卡牌是否可选择
                const cardSelectable = isCardSelectable(card.id);
                
                return (
                  <div
                    key={card.id}
                    className={`relative flex-shrink-0 ${
                      isPlayed ? 'cursor-not-allowed' : 
                      !cardSelectable && handInput.gameStarted ? 'cursor-not-allowed opacity-60' : 
                      ''
                    }`}
                    style={{
                      backgroundColor: isPlayed ? playerColor : (assignedPlayer ? (assignedPlayer === 'bottom' ? '#fbbf24' : playerColors[assignedPlayer]) : 'transparent'),
                      borderRadius: (isPlayed || assignedPlayer) ? '8px' : '0px',
                      padding: (isPlayed || assignedPlayer) ? '2px' : '0px',
                      opacity: isPlayed ? 0.7 : (assignedPlayer ? 0.9 : 1)
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
                      onDoubleClick={(e) => {
                        if (e && !isPlayed && handInput.isInputMode && assignedPlayer) {
                          // 双击标记/取消明牌
                          e.preventDefault();
                          e.stopPropagation();
                          toggleRevealedCard(card.id, assignedPlayer);
                        }
                      }}
                      onContextMenu={(e) => {
                        if (!isPlayed && handInput.isInputMode && assignedPlayer) {
                          // 右键标记/取消明牌
                          e.preventDefault();
                          e.stopPropagation();
                          toggleRevealedCard(card.id, assignedPlayer);
                        }
                      }}
                      onTouchStart={(e) => {
                        if (!isPlayed && handInput.isInputMode && assignedPlayer && isTouchDevice) {
                          // 手机端长按开始
                          const touchTimer = setTimeout(() => {
                            toggleRevealedCard(card.id, assignedPlayer);
                          }, 500); // 500ms长按
                          
                          const handleTouchEnd = () => {
                            clearTimeout(touchTimer);
                            e.target?.removeEventListener('touchend', handleTouchEnd);
                            e.target?.removeEventListener('touchmove', handleTouchEnd);
                          };
                          
                          e.target?.addEventListener('touchend', handleTouchEnd);
                          e.target?.addEventListener('touchmove', handleTouchEnd);
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
                        title={`${isPlayed === 'bottom' ? '我' : isPlayed === 'left' ? '对手一' : isPlayed === 'top' ? '队友' : '对手二'}已出`}
                      />
                    )}
                    {/* 手牌输入模式：已分配卡牌的半透明遮罩 */}
                    {!isPlayed && assignedPlayer && (
                      <div 
                        className="absolute inset-0 rounded-lg"
                        style={{ 
                          backgroundColor: assignedPlayer === 'bottom' ? '#fbbf24' : playerColors[assignedPlayer],
                          opacity: 0.2,
                          pointerEvents: 'none'
                        }}
                        title={`${assignedPlayer === 'bottom' ? '我' : assignedPlayer === 'left' ? '对手一' : assignedPlayer === 'top' ? '队友' : '对手二'}手牌`}
                      />
                    )}
                    {/* 明牌标记 */}
                    {!isPlayed && assignedPlayer && isRevealedCard && (
                      <>
                        {/* 明牌边框 */}
                        <div 
                          className="absolute inset-0 rounded-lg border-2"
                          style={{ 
                            borderColor: '#fbbf24',
                            pointerEvents: 'none'
                          }}
                        />
                        {/* 明牌标识 */}
                        <div 
                          className="absolute top-0 right-0 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-xs font-bold text-white transform translate-x-1 -translate-y-1"
                          style={{ pointerEvents: 'none' }}
                          title="明牌"
                        >
                          明
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* 操作提示 */}
            <div className="mt-4 text-xs text-gray-500 space-y-1">
              {gameState.phase === 'finished' ? (
                <>
                  <div>• 🏆 游戏已结束！我的手牌出完</div>
                  <div>• 游戏时长: {getGameDuration()}，总出牌次数: {gameState.totalPlays}次</div>
                  <div>• 点击"重新开始"可以开始新游戏</div>
                  <div>• 点击"返回输入"可以修改手牌设置</div>
                </>
              ) : handInput.gameStarted ? (
                <>
                  <div>• 🎮 游戏进行中：明牌权限控制已启用</div>
                  <div>• 明牌（黄色边框）只能由对应玩家选择和使用</div>
                  <div>• 我的手牌只能由我选择</div>
                  <div>• 其他玩家只能使用自己的明牌，不能选择普通牌库</div>
                  <div>• 出牌时自动验证掼蛋牌型：单、对、三不带、三带二、飞机、连对、顺子、炸弹</div>
                  <div>• 红色卡牌表示配牌，可代替任意牌参与牌型组合</div>
                  <div>• 当我的手牌全部出完时游戏自动结束</div>
                </>
              ) : handInput.isInputMode ? (
                <>
                  <div>• 🃏 手牌输入模式：当前我有{handInput.playerHands.bottom.length}张手牌</div>
                  <div>• 操作流程：点击玩家头像 → 点击卡牌添加手牌 → 点击"开始游戏"</div>
                  <div>• 我：最多27张手牌；其他玩家：最多1张明牌</div>
                  <div>• 点击卡牌添加到玩家手牌，再次点击可移除</div>
                  <div>• 双击或右键点击已分配的卡牌可标记为明牌（黄色边框和"明"标识）</div>
                  <div>• 已分配的卡牌显示对应玩家的颜色标识</div>
                  {handInput.playerHands.bottom.length > 0 ? (
                    <div className="text-green-600">• ✅ 可以点击"开始游戏"按钮启用明牌权限控制</div>
                  ) : (
                    <div className="text-red-600">• ❌ 需要为我设置至少1张手牌才能开始游戏</div>
                  )}
                </>
              ) : (
                <>
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
                </>
              )}
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
                        bottom: '我',
                        left: '对手一',
                        top: '队友',
                        right: '对手二'
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