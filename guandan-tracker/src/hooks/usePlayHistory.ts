/**
 * 实时出牌记录Hook
 * 在游戏进行时实时记录每个玩家的出牌动作
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { 
  Card, 
  PlayerPosition, 
  PlayRecord, 
  PlayType,
  AIAnalysisResult,
  CardConstraint,
  PassAnalysis,
  BreakingPatternAnalysis
} from '../types/game';

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
  
  // ==================== AI功能扩展 ====================
  
  /** AI分析结果 */
  aiAnalysis: AIAnalysisResult | null;
  /** 是否启用AI分析 */
  aiEnabled: boolean;
  /** 设置AI分析状态 */
  setAIEnabled: (enabled: boolean) => void;
  /** 手动触发AI分析 */
  triggerAIAnalysis: () => void;
  /** 获取过牌分析 */
  getPassAnalysis: () => PassAnalysis[];
  /** 获取拆牌分析 */
  getBreakingAnalysis: () => BreakingPatternAnalysis[];
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

// ==================== AI分析工具函数 ====================

/**
 * 分析过牌行为
 */
function analyzePassBehavior(
  playHistory: PlayRecord[],
  roundRecords: RoundState[]
): PassAnalysis[] {
  const passAnalyses: PassAnalysis[] = [];
  
  // 查找所有过牌记录
  const passRecords = playHistory.filter(record => record.type === 'pass');
  
  passRecords.forEach(passRecord => {
    // 找到过牌时的当前回合状态
    const currentRound = roundRecords.find(round => round.roundIndex === passRecord.roundIndex);
    if (!currentRound) return;
    
    // 找到本轮的领出牌
    const leadingPlay = currentRound.playsInRound.find(play => play.isActivePlay);
    if (!leadingPlay) return;
    
    // 推断该玩家无法打过的牌型
    const cannotBeat: PlayType[] = [leadingPlay.type];
    
    // 基于过牌推断缺少的关键牌（简化版）
    const likelyMissingCards = [];
    if (leadingPlay.type === 'bomb_four') {
      // 如果过四炸，说明没有更大的炸弹或王牌
      likelyMissingCards.push(15 as any); // 王牌
    }
    
    passAnalyses.push({
      playerPosition: passRecord.playerPosition,
      leadingCardType: leadingPlay.type,
      cannotBeat,
      likelyMissingCards,
      confidence: 0.8 // 过牌行为的可信度较高
    });
  });
  
  return passAnalyses;
}

/**
 * 分析拆牌行为
 */
function analyzeBreakingPattern(
  playHistory: PlayRecord[]
): BreakingPatternAnalysis[] {
  const breakingAnalyses: BreakingPatternAnalysis[] = [];
  
  // 简化版：检测可能的拆牌行为
  playHistory.forEach((record, index) => {
    if (record.type === 'single' && record.cards.length === 1) {
      // 检查是否为高价值单牌（可能是拆牌）
      const card = record.cards[0];
      if (card.rank >= 12) { // J、Q、K、A
        breakingAnalyses.push({
          playerPosition: record.playerPosition,
          brokenPattern: 'pair', // 假设拆了对子
          reasoning: 'forced', // 简化为被迫拆牌
          revealedInfo: [`可能缺少${card.rank}的对子或三张`]
        });
      }
    }
  });
  
  return breakingAnalyses;
}

/**
 * 生成AI分析结果
 */
function generateAIAnalysis(
  playHistory: PlayRecord[],
  roundRecords: RoundState[]
): AIAnalysisResult {
  const timestamp = Date.now();
  const gameProgress = playHistory.length / 108; // 基于出牌数估算进度
  
  // 确定游戏阶段
  const gamePhase = gameProgress < 0.25 ? 'early' :
                   gameProgress < 0.5 ? 'middle' :
                   gameProgress < 0.8 ? 'late' : 'endgame';
  
  // 估算各玩家剩余牌数（简化版）
  const estimatedCardCounts: Record<PlayerPosition, { count: number; confidence: number }> = {
    bottom: { count: 27, confidence: 0.5 },
    left: { count: 27, confidence: 0.5 },
    top: { count: 27, confidence: 0.5 },
    right: { count: 27, confidence: 0.5 }
  };
  
  // 根据出牌记录更新估算
  playHistory.forEach(record => {
    const player = estimatedCardCounts[record.playerPosition];
    if (record.type !== 'pass') {
      player.count = Math.max(0, player.count - record.cards.length);
      player.confidence = Math.min(1, player.confidence + 0.1);
    }
  });
  
  // 关键牌分布（简化版）
  const keyCardDistribution = {
    wildCards: { bottom: 0, left: 0, top: 0, right: 0 } as Record<PlayerPosition, number>,
    rankCards: { bottom: 0, left: 0, top: 0, right: 0 } as Record<PlayerPosition, number>,
    jokers: { bottom: 0, left: 0, top: 0, right: 0 } as Record<PlayerPosition, number>
  };
  
  // 威胁等级评估（简化版）
  const threatLevels: Record<PlayerPosition, { level: 'low' | 'medium' | 'high' | 'critical'; reasoning: string[] }> = {
    bottom: { level: 'medium', reasoning: ['手牌数量正常'] },
    left: { level: 'medium', reasoning: ['手牌数量正常'] },
    top: { level: 'medium', reasoning: ['手牌数量正常'] },
    right: { level: 'medium', reasoning: ['手牌数量正常'] }
  };
  
  // 更新威胁等级
  Object.entries(estimatedCardCounts).forEach(([pos, data]) => {
    const position = pos as PlayerPosition;
    if (data.count < 10) {
      threatLevels[position] = { level: 'high', reasoning: ['剩余牌数较少'] };
    } else if (data.count < 5) {
      threatLevels[position] = { level: 'critical', reasoning: ['剩余牌数极少'] };
    }
  });
  
  // 推荐策略（简化版）
  const suggestions = {
    action: 'play' as const,
    reasoning: '建议根据当前局势选择合适的出牌策略',
    confidence: 0.6,
    alternativeOptions: ['观察对手动向', '保留关键牌']
  };
  
  return {
    timestamp,
    gamePhase,
    estimatedCardCounts,
    keyCardDistribution,
    threatLevels,
    suggestions,
    structureAnalysis: {
      criticalCardAnalysis: {
        rankCards: { remaining: 0, distribution: "" },
        fives: { remaining: 0 },
        tens: { remaining: 0 }
      }
    },
    warnings: [],
    strategicInsights: [],
    recommendations: { immediate: [] },
    confidence: 0.7
  };
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
  
  // ==================== AI功能状态 ====================
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiEnabled, setAIEnabled] = useState(true); // 默认启用AI
  const [roundRecords, setRoundRecords] = useState<RoundState[]>([]);
  
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
    setPlayHistory(prev => {
      const newHistory = [...prev, playRecord];
      
      // 如果启用AI，触发分析
      if (aiEnabled) {
        // 延迟分析，避免阻塞UI
        setTimeout(() => {
          const analysis = generateAIAnalysis(newHistory, roundRecords);
          setAiAnalysis(analysis);
        }, 100);
      }
      
      return newHistory;
    });
    
    // 更新当前回合
    setCurrentRound(prev => {
      const newRound = {
        ...prev,
        playsInRound: [...prev.playsInRound, playRecord],
        currentPlayer: getNextPlayer(action.playerPosition)
      };
      
      // 更新回合记录
      setRoundRecords(prevRounds => {
        const existingRoundIndex = prevRounds.findIndex(r => r.roundIndex === newRound.roundIndex);
        if (existingRoundIndex >= 0) {
          const updated = [...prevRounds];
          updated[existingRoundIndex] = newRound;
          return updated;
        } else {
          return [...prevRounds, newRound];
        }
      });
      
      return newRound;
    });
    
    return playId;
  }, [isRecording, isPaused, currentRound.roundIndex, aiEnabled, roundRecords]);
  
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
  
  // ==================== AI功能函数 ====================
  
  // 手动触发AI分析
  const triggerAIAnalysis = useCallback(() => {
    if (playHistory.length > 0) {
      const analysis = generateAIAnalysis(playHistory, roundRecords);
      setAiAnalysis(analysis);
    }
  }, [playHistory, roundRecords]);
  
  // 获取过牌分析
  const getPassAnalysis = useCallback((): PassAnalysis[] => {
    return analyzePassBehavior(playHistory, roundRecords);
  }, [playHistory, roundRecords]);
  
  // 获取拆牌分析
  const getBreakingAnalysis = useCallback((): BreakingPatternAnalysis[] => {
    return analyzeBreakingPattern(playHistory);
  }, [playHistory]);
  
  // 自动保存到localStorage（可选）
  useEffect(() => {
    if (isRecording && playHistory.length > 0) {
      const autoSaveData = {
        playHistory,
        currentRound,
        gameStartTime: gameStartTime.current,
        aiAnalysis: aiEnabled ? aiAnalysis : null // 同时保存AI分析结果
      };
      localStorage.setItem('guandan_play_history_autosave', JSON.stringify(autoSaveData));
    }
  }, [playHistory, currentRound, isRecording, aiAnalysis, aiEnabled]);
  
  // AI启用状态变化时重新分析
  useEffect(() => {
    if (aiEnabled && playHistory.length > 0) {
      triggerAIAnalysis();
    } else if (!aiEnabled) {
      setAiAnalysis(null);
    }
  }, [aiEnabled, triggerAIAnalysis]);
  
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
    getRoundStats,
    
    // AI功能
    aiAnalysis,
    aiEnabled,
    setAIEnabled,
    triggerAIAnalysis,
    getPassAnalysis,
    getBreakingAnalysis
  };
}

export default usePlayHistory;
export type { PlayAction, RoundState, UsePlayHistoryReturn };