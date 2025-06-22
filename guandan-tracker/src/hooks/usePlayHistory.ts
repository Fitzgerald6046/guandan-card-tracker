/**
 * 实时出牌记录Hook
 * 在游戏进行时实时记录每个玩家的出牌动作
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Card, PlayerPosition, PlayRecord, PlayType } from '../types/game';

// ==================== 类型定义 ====================

/** 出牌动作 */
interface PlayAction {
  /** 玩家位置 */
  playerPosition: PlayerPosition;
  /** 出牌列表 */
  cards: Card[];
  /** 出牌类型 */
  type: PlayType;
  /** 出牌前手牌数 */
  cardsBeforePlay: number;
  /** 是否为主动出牌 */
  isActivePlay?: boolean;
  /** 描述信息 */
  description?: string;
}

/** 回合状态 */
interface RoundState {
  /** 回合序号 */
  roundIndex: number;
  /** 回合开始时间 */
  startTime: number;
  /** 本轮已出牌记录 */
  playsInRound: PlayRecord[];
  /** 当前出牌玩家 */
  currentPlayer: PlayerPosition;
}

/** Hook 返回类型 */
interface UsePlayHistoryReturn {
  /** 所有出牌记录 */
  playHistory: PlayRecord[];
  /** 当前回合状态 */
  currentRound: RoundState;
  /** 是否正在记录 */
  isRecording: boolean;
  
  /** 开始记录 */
  startRecording: () => void;
  /** 停止记录 */
  stopRecording: () => void;
  /** 暂停记录 */
  pauseRecording: () => void;
  /** 恢复记录 */
  resumeRecording: () => void;
  
  /** 记录出牌动作 */
  recordPlay: (action: PlayAction) => string;
  /** 记录过牌 */
  recordPass: (playerPosition: PlayerPosition) => string;
  /** 撤销最后一次出牌 */
  undoLastPlay: () => boolean;
  
  /** 开始新回合 */
  startNewRound: (firstPlayer?: PlayerPosition) => void;
  /** 结束当前回合 */
  endCurrentRound: () => void;
  
  /** 清空历史记录 */
  clearHistory: () => void;
  /** 导出出牌记录 */
  exportPlayHistory: () => string;
  /** 导入出牌记录 */
  importPlayHistory: (data: string) => boolean;
  
  /** 获取指定玩家的出牌统计 */
  getPlayerStats: (playerPosition: PlayerPosition) => {
    totalPlays: number;
    totalCards: number;
    passCount: number;
    activePlays: number;
  };
  
  /** 获取回合统计 */
  getRoundStats: () => {
    totalRounds: number;
    averageRoundDuration: number;
    playsPerRound: number;
  };
}

// ==================== 工具函数 ====================

/**
 * 生成出牌记录ID
 */
function generatePlayId(): string {
  return `play_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 判断出牌类型
 */
function determinePlayType(cards: Card[]): PlayType {
  if (cards.length === 0) return 'pass';
  if (cards.length === 1) return 'single';
  if (cards.length === 2) return 'pair';
  if (cards.length === 3) return 'triple';
  if (cards.length === 4) return 'bomb_four';
  if (cards.length === 5) return 'bomb_five';
  if (cards.length >= 6) return 'bomb_six';
  return 'single';
}

/**
 * 获取下一个玩家位置
 */
function getNextPlayer(currentPlayer: PlayerPosition): PlayerPosition {
  const positions: PlayerPosition[] = ['bottom', 'left', 'top', 'right'];
  const currentIndex = positions.indexOf(currentPlayer);
  return positions[(currentIndex + 1) % 4];
}

/**
 * 生成出牌描述
 */
function generatePlayDescription(
  playerPosition: PlayerPosition, 
  cards: Card[], 
  type: PlayType,
  playerName?: string
): string {
  const playerDisplayName = playerName || `${playerPosition}玩家`;
  
  if (type === 'pass') {
    return `${playerDisplayName} 过牌`;
  }
  
  const cardCount = cards.length;
  const typeNames: Record<PlayType, string> = {
    single: '单张',
    pair: '对子',
    triple: '三张',
    triple_with_pair: '三带二',
    straight: '顺子',
    pair_straight: '连对',
    triple_straight: '三连',
    plane: '飞机',
    bomb_four: '四炸',
    bomb_five: '五炸',
    bomb_six: '六炸',
    bomb_seven: '七炸',
    bomb_eight: '八炸',
    straight_flush: '同花顺',
    pass: '过牌'
  };
  
  const typeName = typeNames[type] || '出牌';
  return `${playerDisplayName} 出了${cardCount}张牌 (${typeName})`;
}

// ==================== Hook主函数 ====================

export function usePlayHistory(): UsePlayHistoryReturn {
  const [playHistory, setPlayHistory] = useState<PlayRecord[]>([]);
  const [currentRound, setCurrentRound] = useState<RoundState>({
    roundIndex: 0,
    startTime: Date.now(),
    playsInRound: [],
    currentPlayer: 'bottom'
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const gameStartTime = useRef<number>(Date.now());
  
  // 开始记录
  const startRecording = useCallback(() => {
    setIsRecording(true);
    setIsPaused(false);
    gameStartTime.current = Date.now();
    setCurrentRound({
      roundIndex: 1,
      startTime: Date.now(),
      playsInRound: [],
      currentPlayer: 'bottom'
    });
  }, []);
  
  // 停止记录
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setIsPaused(false);
  }, []);
  
  // 暂停记录
  const pauseRecording = useCallback(() => {
    setIsPaused(true);
  }, []);
  
  // 恢复记录
  const resumeRecording = useCallback(() => {
    setIsPaused(false);
  }, []);
  
  // 记录出牌动作
  const recordPlay = useCallback((action: PlayAction): string => {
    if (!isRecording || isPaused) {
      console.warn('记录器未启动或已暂停');
      return '';
    }
    
    const playId = generatePlayId();
    const timestamp = Date.now();
    const type = action.type || determinePlayType(action.cards);
    
    const playRecord: PlayRecord = {
      id: playId,
      playerPosition: action.playerPosition,
      cards: [...action.cards],
      type,
      timestamp,
      isActivePlay: action.isActivePlay || false,
      roundIndex: currentRound.roundIndex,
      description: action.description || generatePlayDescription(
        action.playerPosition, 
        action.cards, 
        type
      ),
      cardsBeforePlay: action.cardsBeforePlay
    };
    
    // 更新历史记录
    setPlayHistory(prev => [...prev, playRecord]);
    
    // 更新当前回合
    setCurrentRound(prev => ({
      ...prev,
      playsInRound: [...prev.playsInRound, playRecord],
      currentPlayer: getNextPlayer(action.playerPosition)
    }));
    
    return playId;
  }, [isRecording, isPaused, currentRound.roundIndex]);
  
  // 记录过牌
  const recordPass = useCallback((playerPosition: PlayerPosition): string => {
    return recordPlay({
      playerPosition,
      cards: [],
      type: 'pass',
      cardsBeforePlay: 0,
      isActivePlay: false,
      description: `${playerPosition} 过牌`
    });
  }, [recordPlay]);
  
  // 撤销最后一次出牌
  const undoLastPlay = useCallback((): boolean => {
    if (!isRecording) {
      return false;
    }
    
    if (playHistory.length === 0) {
      return false;
    }
    
    const lastPlay = playHistory[playHistory.length - 1];
    
    // 从历史记录中移除
    setPlayHistory(prev => prev.slice(0, -1));
    
    // 从当前回合中移除
    setCurrentRound(prev => ({
      ...prev,
      playsInRound: prev.playsInRound.filter(play => play.id !== lastPlay.id),
      currentPlayer: lastPlay.playerPosition // 回到上一个玩家
    }));
    
    return true;
  }, [isRecording, playHistory]);
  
  // 开始新回合
  const startNewRound = useCallback((firstPlayer: PlayerPosition = 'bottom') => {
    if (!isRecording) {
      return;
    }
    
    setCurrentRound(prev => ({
      roundIndex: prev.roundIndex + 1,
      startTime: Date.now(),
      playsInRound: [],
      currentPlayer: firstPlayer
    }));
  }, [isRecording]);
  
  // 结束当前回合
  const endCurrentRound = useCallback(() => {
    // 可以在这里添加回合结束的逻辑
    console.log(`回合 ${currentRound.roundIndex} 结束`);
  }, [currentRound.roundIndex]);
  
  // 清空历史记录
  const clearHistory = useCallback(() => {
    setPlayHistory([]);
    setCurrentRound({
      roundIndex: 0,
      startTime: Date.now(),
      playsInRound: [],
      currentPlayer: 'bottom'
    });
  }, []);
  
  // 导出出牌记录
  const exportPlayHistory = useCallback((): string => {
    const exportData = {
      version: '1.0',
      gameStartTime: gameStartTime.current,
      exportTime: Date.now(),
      totalPlays: playHistory.length,
      totalRounds: currentRound.roundIndex,
      playHistory,
      currentRound
    };
    
    return JSON.stringify(exportData, null, 2);
  }, [playHistory, currentRound]);
  
  // 导入出牌记录
  const importPlayHistory = useCallback((data: string): boolean => {
    try {
      const importData = JSON.parse(data);
      
      if (importData.playHistory && Array.isArray(importData.playHistory)) {
        setPlayHistory(importData.playHistory);
        
        if (importData.currentRound) {
          setCurrentRound(importData.currentRound);
        }
        
        if (importData.gameStartTime) {
          gameStartTime.current = importData.gameStartTime;
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('导入出牌记录失败:', error);
      return false;
    }
  }, []);
  
  // 获取指定玩家的出牌统计
  const getPlayerStats = useCallback((playerPosition: PlayerPosition) => {
    const playerPlays = playHistory.filter(play => play.playerPosition === playerPosition);
    
    return {
      totalPlays: playerPlays.length,
      totalCards: playerPlays.reduce((sum, play) => sum + play.cards.length, 0),
      passCount: playerPlays.filter(play => play.type === 'pass').length,
      activePlays: playerPlays.filter(play => play.isActivePlay).length
    };
  }, [playHistory]);
  
  // 获取回合统计
  const getRoundStats = useCallback(() => {
    const totalRounds = currentRound.roundIndex;
    const totalDuration = Date.now() - gameStartTime.current;
    const averageRoundDuration = totalRounds > 0 ? totalDuration / totalRounds : 0;
    const playsPerRound = totalRounds > 0 ? playHistory.length / totalRounds : 0;
    
    return {
      totalRounds,
      averageRoundDuration,
      playsPerRound
    };
  }, [currentRound.roundIndex, playHistory.length]);
  
  // 自动保存到localStorage（可选）
  useEffect(() => {
    if (isRecording && playHistory.length > 0) {
      const autoSaveData = {
        playHistory,
        currentRound,
        gameStartTime: gameStartTime.current
      };
      localStorage.setItem('guandan_play_history_autosave', JSON.stringify(autoSaveData));
    }
  }, [playHistory, currentRound, isRecording]);
  
  return {
    playHistory,
    currentRound,
    isRecording: isRecording && !isPaused,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    recordPlay,
    recordPass,
    undoLastPlay,
    startNewRound,
    endCurrentRound,
    clearHistory,
    exportPlayHistory,
    importPlayHistory,
    getPlayerStats,
    getRoundStats
  };
}

export default usePlayHistory;
export type { PlayAction, RoundState, UsePlayHistoryReturn };