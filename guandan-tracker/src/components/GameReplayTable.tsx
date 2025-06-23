/**
 * 牌局重现牌桌组件
 * 模拟真实牌桌，四个玩家依次按记录好的出牌顺序进行出牌
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { GameRecord, ReplayState } from '../hooks/useGameHistory';
import type { Card, PlayerPosition, PlayRecord, PlayType } from '../types/game';
import { getRankName } from '../utils/rankUtils';
import { PlayerPosition as Pos } from '../types/game';
import { CardImage } from './CardImage';

// ==================== 类型定义 ====================

interface GameReplayTableProps {
  /** 游戏记录 */
  gameRecord: GameRecord;
  /** 回放状态 */
  replayState: ReplayState;
  /** 回放控制函数 */
  onReplayControl: {
    setProgress: (progress: number) => void;
    setSpeed: (speed: number) => void;
    start: () => void;
    stop: () => void;
  };
}

interface ReplayFrame {
  /** 帧序号 */
  frameIndex: number;
  /** 时间戳 */
  timestamp: number;
  /** 出牌记录 */
  playRecord?: PlayRecord;
  /** 当前牌桌状态 */
  tableState: {
    /** 桌面上的牌 */
    cardsOnTable: Card[];
    /** 当前出牌玩家 */
    currentPlayer: PlayerPosition;
    /** 各玩家剩余牌数 */
    playerCardCounts: Record<PlayerPosition, number>;
    /** 描述文本 */
    description: string;
  };
}

interface PlayerDisplay {
  position: PlayerPosition;
  name: string;
  cardCount: number;
  isCurrentPlayer: boolean;
  team: 1 | 2;
}

// ==================== 工具函数 ====================

/**
 * 生成模拟的出牌记录
 */
function generatePlayHistory(gameRecord: GameRecord): PlayRecord[] {
  const { players, finalCardOwnership, cardsSnapshot } = gameRecord;
  const totalCards = 108; // 两副牌
  const playHistory: PlayRecord[] = [];
  
  console.log('generatePlayHistory: 开始生成出牌记录');
  console.log('generatePlayHistory: finalCardOwnership:', finalCardOwnership);
  console.log('generatePlayHistory: cardsSnapshot长度:', cardsSnapshot?.length || 0);
  
  // 模拟出牌过程：每轮4个玩家各出一些牌
  const positions: PlayerPosition[] = ['bottom', 'left', 'top', 'right'];
  let roundIndex = 0;
  let currentCardCounts: Record<PlayerPosition, number> = {
    bottom: 27,
    left: 27,
    top: 27,
    right: 27
  };
  
  // 根据最终状态反推出牌过程
  const ownedCardsByPlayer: Record<PlayerPosition, Card[]> = {
    bottom: [],
    left: [],
    top: [],
    right: []
  };
  
  // 按最终分配计算每个玩家拥有的牌
  Object.entries(finalCardOwnership).forEach(([cardId, owner]) => {
    const card = cardsSnapshot.find(c => c.id === cardId);
    if (card && owner) {
      ownedCardsByPlayer[owner].push(card);
    }
  });
  
  // 模拟15-20轮出牌
  const totalRounds = Math.floor(Math.random() * 6) + 15; // 15-20轮
  
  for (let round = 0; round < totalRounds; round++) {
    for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
      const position = positions[playerIndex];
      const playerId = `play-${Date.now()}-${round}-${playerIndex}`;
      
      // 模拟出牌数量：1-4张
      const cardsToPlay = Math.min(
        Math.floor(Math.random() * 4) + 1,
        currentCardCounts[position]
      );
      
      if (cardsToPlay > 0 && currentCardCounts[position] > 0) {
        // 从该玩家的牌中随机选择要出的牌
        const playerCards = ownedCardsByPlayer[position].slice(0, cardsToPlay);
        
        // 更新剩余牌数
        currentCardCounts[position] = Math.max(0, currentCardCounts[position] - cardsToPlay);
        
        // 确定出牌类型
        let playType: PlayType = 'single';
        if (cardsToPlay === 2) playType = 'pair';
        else if (cardsToPlay === 3) playType = 'triple';
        else if (cardsToPlay >= 4) playType = 'bomb_four';
        
        const playRecord: PlayRecord = {
          id: playerId,
          playerPosition: position,
          cards: playerCards,
          type: playType,
          timestamp: gameRecord.timestamp + round * 30000 + playerIndex * 5000, // 每轮30秒，每个玩家间隔5秒
          isActivePlay: playerIndex === 0, // 第一个玩家主动出牌
          roundIndex: round,
          description: `${players.find(p => p.position === position)?.name || position} 出了 ${cardsToPlay} 张牌`,
          cardsBeforePlay: currentCardCounts[position] + cardsToPlay
        };
        
        playHistory.push(playRecord);
      }
      
      // 如果所有玩家都没牌了，结束游戏
      if (Object.values(currentCardCounts).every(count => count === 0)) {
        break;
      }
    }
    
    if (Object.values(currentCardCounts).every(count => count === 0)) {
      break;
    }
  }
  
  console.log('generatePlayHistory: 生成的出牌记录数量:', playHistory.length);
  console.log('generatePlayHistory: 出牌记录示例:', playHistory.slice(0, 3));
  
  return playHistory;
}

/**
 * 生成回放帧序列
 */
function generateReplayFrames(gameRecord: GameRecord): ReplayFrame[] {
  const playHistory = generatePlayHistory(gameRecord);
  const frames: ReplayFrame[] = [];
  const positions: PlayerPosition[] = ['bottom', 'left', 'top', 'right'];
  
  console.log('generateReplayFrames: 开始生成回放帧，出牌记录数量:', playHistory.length);
  
  // 初始状态
  const initialCardCounts: Record<PlayerPosition, number> = {
    bottom: 27,
    left: 27,
    top: 27,
    right: 27
  };
  
  // 开始帧
  frames.push({
    frameIndex: 0,
    timestamp: gameRecord.timestamp,
    tableState: {
      cardsOnTable: [],
      currentPlayer: 'bottom',
      playerCardCounts: { ...initialCardCounts },
      description: '游戏开始，玩家准备出牌'
    }
  });
  
  // 如果没有出牌记录，生成一些简单的演示帧
  if (playHistory.length === 0) {
    console.log('generateReplayFrames: 没有出牌记录，生成演示帧');
    
    const demoFrames = 10;
    for (let i = 1; i <= demoFrames; i++) {
      const currentPlayer = positions[(i - 1) % 4];
      const cardsPlayed = Math.floor(i * 2.7); // 模拟逐步出牌
      
      const currentCardCounts = { ...initialCardCounts };
      positions.forEach(pos => {
        currentCardCounts[pos] = Math.max(0, 27 - Math.floor(cardsPlayed / 4));
      });
      
      frames.push({
        frameIndex: i,
        timestamp: gameRecord.timestamp + (i * 1000),
        tableState: {
          cardsOnTable: [], // 简化处理，不显示具体牌
          currentPlayer,
          playerCardCounts: currentCardCounts,
          description: `第${i}轮: ${currentPlayer === 'bottom' ? '我' : 
                       currentPlayer === 'left' ? '下家' : 
                       currentPlayer === 'top' ? '对家' : '上家'} 出牌`
        }
      });
    }
  } else {
    // 为每个出牌记录生成一帧
    let currentCardCounts = { ...initialCardCounts };
    let cardsOnTable: Card[] = [];
    
    playHistory.forEach((playRecord, index) => {
      // 更新牌数
      currentCardCounts[playRecord.playerPosition] = Math.max(
        0, 
        currentCardCounts[playRecord.playerPosition] - playRecord.cards.length
      );
      
      // 更新桌面牌（只保留最新一轮的牌）
      if (index % 4 === 0) {
        cardsOnTable = []; // 新一轮开始，清空桌面
      }
      cardsOnTable = [...cardsOnTable, ...playRecord.cards];
      
      // 下一个玩家
      const nextPlayerIndex = (positions.indexOf(playRecord.playerPosition) + 1) % 4;
      const nextPlayer = positions[nextPlayerIndex];
      
      frames.push({
        frameIndex: index + 1,
        timestamp: playRecord.timestamp,
        playRecord,
        tableState: {
          cardsOnTable: [...cardsOnTable],
          currentPlayer: nextPlayer,
          playerCardCounts: { ...currentCardCounts },
          description: playRecord.description || `${playRecord.playerPosition} 出牌`
        }
      });
    });
  }
  
  // 结束帧
  frames.push({
    frameIndex: frames.length,
    timestamp: gameRecord.timestamp + gameRecord.duration * 1000,
    tableState: {
      cardsOnTable: [],
      currentPlayer: 'bottom',
      playerCardCounts: frames.length > 1 ? frames[frames.length - 1].tableState.playerCardCounts : initialCardCounts,
      description: '游戏结束'
    }
  });
  
  console.log('generateReplayFrames: 生成的回放帧数量:', frames.length);
  console.log('generateReplayFrames: 第一帧示例:', frames[0]);
  
  return frames;
}

/**
 * 格式化时间
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 格式化日期
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

// ==================== 组件定义 ====================

export const GameReplayTable: React.FC<GameReplayTableProps> = ({
  gameRecord,
  replayState,
  onReplayControl
}) => {
  const [replayFrames] = useState<ReplayFrame[]>(() => {
    const frames = generateReplayFrames(gameRecord);
    console.log('GameReplayTable: 生成的回放帧数量:', frames.length);
    console.log('GameReplayTable: 第一帧数据:', frames[0]);
    console.log('GameReplayTable: 游戏记录:', gameRecord);
    return frames;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTimer, setPlaybackTimer] = useState<number | null>(null);
  
  // 当前帧
  const currentFrameIndex = Math.floor(replayState.replayProgress * (replayFrames.length - 1));
  const currentFrame = replayFrames[currentFrameIndex] || replayFrames[0];
  
  // 调试信息
  console.log('GameReplayTable: 当前回放进度:', replayState.replayProgress);
  console.log('GameReplayTable: 当前帧索引:', currentFrameIndex);
  console.log('GameReplayTable: 当前帧数据:', currentFrame);
  
  // 播放控制
  const startPlayback = useCallback(() => {
    if (playbackTimer) {
      clearInterval(playbackTimer);
    }
    
    setIsPlaying(true);
    
    const timer = setInterval(() => {
      onReplayControl.setProgress((prev: number) => {
        const newProgress = prev + (0.02 * replayState.replaySpeed); // 更慢的播放速度
        if (newProgress >= 1) {
          setIsPlaying(false);
          clearInterval(timer);
          return 1;
        }
        return newProgress;
      });
    }, 200); // 每200ms更新一次
    
    setPlaybackTimer(timer);
  }, [replayState.replaySpeed, onReplayControl, playbackTimer]);
  
  const pausePlayback = useCallback(() => {
    setIsPlaying(false);
    if (playbackTimer) {
      clearInterval(playbackTimer);
      setPlaybackTimer(null);
    }
  }, [playbackTimer]);
  
  const resetPlayback = useCallback(() => {
    pausePlayback();
    onReplayControl.setProgress(0);
  }, [pausePlayback, onReplayControl]);
  
  // 清理定时器
  useEffect(() => {
    return () => {
      if (playbackTimer) {
        clearInterval(playbackTimer);
      }
    };
  }, [playbackTimer]);
  
  // 准备玩家显示数据
  const playerDisplayData: PlayerDisplay[] = useMemo(() => {
    if (!currentFrame || !currentFrame.tableState) {
      console.warn('GameReplayTable: currentFrame 或 tableState 为空，使用默认数据');
      return gameRecord.players.map(player => ({
        position: player.position,
        name: player.name,
        cardCount: 27, // 默认值
        isCurrentPlayer: player.position === 'bottom',
        team: player.team
      }));
    }
    
    return gameRecord.players.map(player => ({
      position: player.position,
      name: player.name,
      cardCount: currentFrame.tableState.playerCardCounts[player.position] || 27,
      isCurrentPlayer: player.position === currentFrame.tableState.currentPlayer,
      team: player.team
    }));
  }, [gameRecord.players, currentFrame]);
  
  // 渲染玩家区域
  const renderPlayer = (player: PlayerDisplay, className: string) => {
    const isCurrentPlayer = player.isCurrentPlayer;
    const teamColor = player.team === 1 ? 'blue' : 'red';
    
    return (
      <div 
        className={`player-area ${className} ${isCurrentPlayer ? 'current-player' : ''}`}
        key={player.position}
      >
        <div className={`player-card bg-${teamColor}-50 border-2 ${
          isCurrentPlayer ? `border-${teamColor}-500 shadow-lg` : `border-${teamColor}-200`
        } rounded-lg p-3 transition-all duration-300`}>
          <div className="player-info text-center">
            <div className={`player-name font-semibold ${
              isCurrentPlayer ? `text-${teamColor}-800` : `text-${teamColor}-600`
            } mb-1`}>
              {player.name}
            </div>
            <div className={`card-count text-sm ${
              isCurrentPlayer ? `text-${teamColor}-700` : `text-${teamColor}-500`
            }`}>
              剩余: {player.cardCount} 张
            </div>
            {isCurrentPlayer && (
              <div className={`current-indicator text-xs text-${teamColor}-600 font-medium mt-1`}>
                👆 当前出牌
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // 安全检查
  if (!currentFrame || !currentFrame.tableState) {
    return (
      <div className="game-replay-table bg-gradient-to-b from-green-100 to-green-200 rounded-lg shadow-xl p-6 min-h-[600px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-lg font-semibold mb-2">回放数据异常</div>
          <div className="text-gray-600">无法加载回放帧数据，请检查游戏记录</div>
          <div className="text-sm text-gray-500 mt-2">
            回放帧数量: {replayFrames.length}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-replay-table bg-gradient-to-b from-green-100 to-green-200 rounded-lg shadow-xl p-6 min-h-[600px]">
      {/* 游戏信息头部 */}
      <div className="replay-header mb-6 bg-white rounded-lg p-4 shadow-md">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">
              🎯 牌局重现
            </h2>
            <div className="text-sm text-gray-600 space-y-1">
              <span className="inline-block mr-4">🎮 {gameRecord.id}</span>
              <span className="inline-block mr-4">🎲 {getRankName(gameRecord.currentRank)}</span>
              <span className="inline-block">⏰ {formatDate(gameRecord.timestamp)}</span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-800 mb-1">
              {gameRecord.isCompleted ? '✅ 已完成' : '⏸️ 未完成'}
            </div>
            {gameRecord.winningTeam && (
              <div className="text-green-600 font-medium text-sm">
                🏆 队伍{gameRecord.winningTeam} 获胜
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 牌桌布局 */}
      <div className="table-layout relative bg-green-800 rounded-xl p-8 shadow-inner min-h-[400px]">
        {/* 顶部玩家 */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
          {renderPlayer(
            playerDisplayData.find(p => p.position === Pos.TOP)!,
            'player-top'
          )}
        </div>
        
        {/* 左侧玩家 */}
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          {renderPlayer(
            playerDisplayData.find(p => p.position === Pos.LEFT)!,
            'player-left'
          )}
        </div>
        
        {/* 右侧玩家 */}
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
          {renderPlayer(
            playerDisplayData.find(p => p.position === Pos.RIGHT)!,
            'player-right'
          )}
        </div>
        
        {/* 底部玩家 */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          {renderPlayer(
            playerDisplayData.find(p => p.position === Pos.BOTTOM)!,
            'player-bottom'
          )}
        </div>
        
        {/* 中央牌桌区域 */}
        <div className="table-center absolute inset-1/4 bg-green-700 rounded-lg shadow-inner p-4 flex flex-col items-center justify-center">
          <div className="table-info text-center mb-4">
            <div className="text-white font-semibold mb-2">
              🎴 牌桌中央
            </div>
            <div className="text-green-200 text-sm">
              {currentFrame?.tableState?.description || '等待出牌'}
            </div>
          </div>
          
          {/* 桌面上的牌 */}
          <div className="cards-on-table">
            {currentFrame?.tableState?.cardsOnTable && currentFrame.tableState.cardsOnTable.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-1 max-w-[200px]">
                {currentFrame.tableState.cardsOnTable.slice(-8).map((card, index) => (
                  <div 
                    key={`${card.id}-${index}`} 
                    className="transform scale-75 opacity-90 animate-pulse"
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
                ))}
                {currentFrame.tableState.cardsOnTable.length > 8 && (
                  <div className="text-white text-xs bg-green-600 rounded px-2 py-1">
                    +{currentFrame.tableState.cardsOnTable.length - 8}张
                  </div>
                )}
              </div>
            ) : (
              <div className="text-green-300 text-sm italic">
                暂无出牌
              </div>
            )}
          </div>
        </div>
        
        {/* 当前出牌信息 */}
        {currentFrame.playRecord && (
          <div className="absolute top-2 right-2 bg-yellow-100 border border-yellow-300 rounded-lg p-3 max-w-[200px]">
            <div className="text-sm">
              <div className="font-semibold text-yellow-800 mb-1">
                📋 当前出牌
              </div>
              <div className="text-yellow-700">
                👤 {gameRecord.players.find(p => p.position === currentFrame.playRecord?.playerPosition)?.name}
              </div>
              <div className="text-yellow-600 text-xs">
                🃏 {currentFrame.playRecord.cards.length} 张牌
              </div>
              <div className="text-yellow-600 text-xs">
                🎯 {currentFrame.playRecord.type}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 播放控制面板 */}
      <div className="playback-controls mt-6">
        <div className="bg-white rounded-lg p-4 shadow-md">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📊 回放进度
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={replayState.replayProgress}
              onChange={(e) => onReplayControl.setProgress(parseFloat(e.target.value))}
              className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0:00</span>
              <span className="text-gray-700 font-medium">
                帧 {currentFrameIndex} / {Math.max(0, replayFrames.length - 1)}
              </span>
              <span>{formatTime(gameRecord.duration)}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={resetPlayback}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                🔄 重置
              </button>
              
              <button
                onClick={isPlaying ? pausePlayback : startPlayback}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                {isPlaying ? '⏸️ 暂停' : '▶️ 播放'}
              </button>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">⚡ 速度:</label>
              <select
                value={replayState.replaySpeed}
                onChange={(e) => onReplayControl.setSpeed(parseFloat(e.target.value))}
                className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
              >
                <option value={0.25}>0.25x</option>
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      {/* 统计信息 */}
      <div className="game-stats mt-4 grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-3">
          <h4 className="font-medium text-blue-800 mb-2">🔵 队伍1</h4>
          <div className="text-sm text-blue-700">
            {playerDisplayData.filter(p => p.team === 1).map(player => (
              <div key={player.position} className="flex justify-between">
                <span>{player.name}</span>
                <span>{player.cardCount}张</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-red-50 rounded-lg p-3">
          <h4 className="font-medium text-red-800 mb-2">🔴 队伍2</h4>
          <div className="text-sm text-red-700">
            {playerDisplayData.filter(p => p.team === 2).map(player => (
              <div key={player.position} className="flex justify-between">
                <span>{player.name}</span>
                <span>{player.cardCount}张</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameReplayTable;