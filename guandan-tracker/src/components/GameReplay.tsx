/**
 * 游戏回放组件
 * 支持历史记录查看和回放功能
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { GameRecord, ReplayState } from '../hooks/useGameHistory';
import type { Card, PlayerPosition } from '../types/game';
import { getRankName } from '../utils/rankUtils';
import { PlayerPosition as Pos } from '../types/game';
import { GameReplayTable } from './GameReplayTable';

// ==================== 类型定义 ====================

interface GameReplayProps {
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
  /** 显示模式 */
  displayMode?: 'table' | 'summary';
}

interface ReplayFrame {
  timestamp: number;
  cardOwnership: Record<string, PlayerPosition>;
  description: string;
}

// ==================== 工具函数 ====================

/**
 * 生成回放帧
 */
function generateReplayFrames(gameRecord: GameRecord): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  const { finalCardOwnership, cardsSnapshot, duration } = gameRecord;
  
  // 简化版：基于最终状态生成模拟的回放帧
  const totalFrames = 20; // 20个回放帧
  const frameInterval = duration * 1000 / totalFrames;
  
  // 模拟逐步分配卡牌的过程
  const ownedCards = Object.keys(finalCardOwnership);
  const cardsPerFrame = Math.ceil(ownedCards.length / totalFrames);
  
  for (let i = 0; i <= totalFrames; i++) {
    const currentTimestamp = gameRecord.timestamp + i * frameInterval;
    const cardsToShow = ownedCards.slice(0, i * cardsPerFrame);
    
    const currentOwnership: Record<string, PlayerPosition> = {};
    cardsToShow.forEach(cardId => {
      currentOwnership[cardId] = finalCardOwnership[cardId];
    });
    
    frames.push({
      timestamp: currentTimestamp,
      cardOwnership: currentOwnership,
      description: i === 0 ? '游戏开始' : 
                  i === totalFrames ? '游戏结束' :
                  `第${i}步: 分配了${cardsToShow.length}张牌`
    });
  }
  
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

export const GameReplay: React.FC<GameReplayProps> = ({
  gameRecord,
  replayState,
  onReplayControl,
  displayMode = 'summary'
}) => {
  const [replayFrames] = useState<ReplayFrame[]>(() => 
    generateReplayFrames(gameRecord)
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTimer, setPlaybackTimer] = useState<NodeJS.Timeout | null>(null);
  
  // 当前帧
  const currentFrameIndex = Math.floor(replayState.replayProgress * (replayFrames.length - 1));
  const currentFrame = replayFrames[currentFrameIndex] || replayFrames[0];
  
  // 播放控制
  const startPlayback = useCallback(() => {
    if (playbackTimer) {
      clearInterval(playbackTimer);
    }
    
    setIsPlaying(true);
    
    const timer = setInterval(() => {
      onReplayControl.setProgress(prev => {
        const newProgress = prev + (0.05 * replayState.replaySpeed);
        if (newProgress >= 1) {
          setIsPlaying(false);
          clearInterval(timer);
          return 1;
        }
        return newProgress;
      });
    }, 100);
    
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
  
  // 计算各玩家的卡牌数
  const getPlayerCardCount = (position: PlayerPosition): number => {
    return Object.values(currentFrame.cardOwnership)
      .filter(owner => owner === position).length;
  };
  
  // 计算队伍得分
  const getTeamScore = (team: 1 | 2): number => {
    const positions = team === 1 ? [Pos.BOTTOM, Pos.TOP] : [Pos.LEFT, Pos.RIGHT];
    return positions.reduce((sum, pos) => sum + getPlayerCardCount(pos), 0);
  };
  
  // 如果是牌桌模式，直接返回牌桌组件
  if (displayMode === 'table') {
    return (
      <GameReplayTable 
        gameRecord={gameRecord}
        replayState={replayState}
        onReplayControl={onReplayControl}
      />
    );
  }

  return (
    <div className="game-replay bg-white rounded-lg shadow-lg p-6">
      {/* 游戏信息头部 */}
      <div className="replay-header mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              游戏回放
            </h2>
            <div className="text-sm text-gray-600 space-y-1">
              <p>游戏ID: {gameRecord.id}</p>
              <p>级数: {getRankName(gameRecord.currentRank)}</p>
              <p>时间: {formatDate(gameRecord.timestamp)}</p>
              <p>时长: {formatTime(gameRecord.duration)}</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-800 mb-2">
              {gameRecord.isCompleted ? '已完成' : '未完成'}
            </div>
            {gameRecord.winningTeam && (
              <div className="text-green-600 font-medium">
                获胜: 队伍{gameRecord.winningTeam}
              </div>
            )}
            <div className="text-sm text-gray-500 mt-2">
              最终比分: {gameRecord.gameResult.team1Score} : {gameRecord.gameResult.team2Score}
            </div>
          </div>
        </div>
      </div>
      
      {/* 当前状态显示 */}
      <div className="current-state mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-800">当前状态</h3>
            <div className="text-sm text-gray-600">
              进度: {Math.round(replayState.replayProgress * 100)}%
            </div>
          </div>
          
          <div className="text-center text-gray-700 mb-4">
            {currentFrame.description}
          </div>
          
          {/* 玩家状态 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="team-1 bg-blue-50 rounded p-3">
              <h4 className="font-medium text-blue-800 mb-2">队伍1 ({getTeamScore(1)}张)</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{gameRecord.players.find(p => p.position === Pos.BOTTOM)?.name || '自己'}</span>
                  <span>{getPlayerCardCount(Pos.BOTTOM)}张</span>
                </div>
                <div className="flex justify-between">
                  <span>{gameRecord.players.find(p => p.position === Pos.TOP)?.name || '队友'}</span>
                  <span>{getPlayerCardCount(Pos.TOP)}张</span>
                </div>
              </div>
            </div>
            
            <div className="team-2 bg-red-50 rounded p-3">
              <h4 className="font-medium text-red-800 mb-2">队伍2 ({getTeamScore(2)}张)</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{gameRecord.players.find(p => p.position === Pos.LEFT)?.name || '对手一'}</span>
                  <span>{getPlayerCardCount(Pos.LEFT)}张</span>
                </div>
                <div className="flex justify-between">
                  <span>{gameRecord.players.find(p => p.position === Pos.RIGHT)?.name || '对手二'}</span>
                  <span>{getPlayerCardCount(Pos.RIGHT)}张</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 进度控制 */}
      <div className="playback-controls mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              回放进度
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={replayState.replayProgress}
              onChange={(e) => onReplayControl.setProgress(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0:00</span>
              <span>{formatTime(gameRecord.duration)}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={resetPlayback}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                重置
              </button>
              
              <button
                onClick={isPlaying ? pausePlayback : startPlayback}
                className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                {isPlaying ? '暂停' : '播放'}
              </button>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">速度:</label>
              <select
                value={replayState.replaySpeed}
                onChange={(e) => onReplayControl.setSpeed(parseFloat(e.target.value))}
                className="text-sm border border-gray-300 rounded px-2 py-1"
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
      
      {/* 游戏分析 */}
      <div className="game-analysis">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">游戏分析</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 关键优势 */}
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">关键优势</h4>
            <ul className="text-sm text-green-700 space-y-1">
              {gameRecord.gameResult.advantages.slice(0, 3).map((advantage, index) => (
                <li key={index}>• {advantage}</li>
              ))}
            </ul>
          </div>
          
          {/* 关键时刻 */}
          <div className="bg-yellow-50 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">关键时刻</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              {gameRecord.gameResult.keyMoments.slice(0, 3).map((moment, index) => (
                <li key={index}>• {moment}</li>
              ))}
            </ul>
          </div>
        </div>
        
        {/* 备注 */}
        {gameRecord.notes && (
          <div className="mt-4 bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-2">备注</h4>
            <p className="text-sm text-gray-700">{gameRecord.notes}</p>
          </div>
        )}
        
        {/* 标签 */}
        {gameRecord.tags.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium text-gray-800 mb-2">标签</h4>
            <div className="flex flex-wrap gap-2">
              {gameRecord.tags.map((tag, index) => (
                <span 
                  key={index}
                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameReplay;