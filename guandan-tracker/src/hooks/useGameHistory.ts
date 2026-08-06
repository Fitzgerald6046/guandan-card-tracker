/**
 * 掼蛋游戏历史记录Hook
 * 管理最近10局游戏记录，支持回放查看和数据导出
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { 
  Card, 
  GameMode,
  GameRank, 
  Player,
  PlayerPosition, 
  PlayRecord,
  Team 
} from '../types/game';
import { STORAGE_KEYS } from '../utils/constants';
import { generateGameReport } from '../utils/gameAnalytics';
import type { GameReport } from '../utils/gameAnalytics';

// ==================== 类型定义 ====================

/** 游戏记录 */
interface GameRecord {
  /** 记录ID */
  id: string;
  /** 对应的真实牌局ID；同一局的实时快照共用此值 */
  sourceGameId?: string;
  /** 重要牌局不会被普通历史条数上限淘汰 */
  isImportant: boolean;
  /** 最近一次同步快照的时间 */
  lastUpdatedAt: number;
  /** 游戏时间 */
  timestamp: number;
  /** 游戏时长(秒) */
  duration: number;
  /** 当前级数 */
  currentRank: GameRank;

  /** 牌局模式；旧记录缺少时按掼蛋回放 */
  gameMode?: GameMode;
  /** 斗地主地主位置 */
  landlordPosition?: PlayerPosition;
  
  /** 玩家信息快照 */
  players: Array<{
    id: string;
    name: string;
    position: PlayerPosition;
    team: Team;
  }>;
  
  /** 最终卡牌分配 */
  finalCardOwnership: Record<string, PlayerPosition>;
  /** 卡牌数据快照 */
  cardsSnapshot: Card[];
  /** 按实际发生顺序保存的全部出牌与过牌记录 */
  playHistory: PlayRecord[];
  /** 本局首位出牌玩家 */
  startingPlayerPosition: PlayerPosition;
  
  /** 游戏分析报告 */
  analysisReport: GameReport;
  
  /** 获胜队伍 */
  winningTeam: Team | null;
  /** 游戏结果 */
  gameResult: {
    team1Score: number;
    team2Score: number;
    advantages: string[];
    keyMoments: string[];
  };
  
  /** 是否已完成 */
  isCompleted: boolean;
  /** 游戏标签 */
  tags: string[];
  /** 备注 */
  notes?: string;
}

/** 历史统计 */
interface HistoryStatistics {
  /** 总游戏数 */
  totalGames: number;
  /** 完成游戏数 */
  completedGames: number;
  /** 各级数游戏次数 */
  gamesByRank: Record<GameRank, number>;
  
  /** 胜率统计 */
  winRates: {
    overall: number;
    byTeam: Record<Team, number>;
    byRank: Record<GameRank, number>;
  };
  
  /** 平均游戏时长 */
  averageGameDuration: number;
  /** 最常用级数 */
  mostPlayedRank: GameRank;
  
  /** 趋势分析 */
  trends: {
    recentWinRate: number;
    improvementRate: number;
    consistencyScore: number;
  };
}

/** 回放状态 */
interface ReplayState {
  /** 当前回放的游戏ID */
  currentGameId: string | null;
  /** 回放模式 */
  isReplayMode: boolean;
  /** 回放进度 (0-1) */
  replayProgress: number;
  /** 回放速度 */
  replaySpeed: number;
}

/** 导出选项 */
interface ExportOptions {
  /** 导出格式 */
  format: 'json' | 'csv' | 'txt';
  /** 包含的数据 */
  includeData: {
    gameRecords: boolean;
    analysisReports: boolean;
    statistics: boolean;
    cardData: boolean;
  };
  /** 时间范围 */
  dateRange?: {
    start: number;
    end: number;
  };
  /** 级数过滤 */
  rankFilter?: GameRank[];
}

interface SaveGameOptions {
  isCompleted?: boolean;
  winningTeam?: Team;
  notes?: string;
  tags?: string[];
  /** 指定后对同一条记录执行更新，而不是重复新增。 */
  recordId?: string;
  sourceGameId?: string;
  isImportant?: boolean;
}

interface GameStateSnapshot {
  playHistory?: PlayRecord[];
  currentRound?: { startTime?: number };
  createdAt?: number;
  currentPlayerPosition?: PlayerPosition;
  config?: {
    gameMode?: GameMode;
    landlordPosition?: PlayerPosition;
  };
}

interface GameHistoryExport {
  version: string;
  exportTimestamp: number;
  totalRecords: number;
  gameRecords?: GameRecord[];
  statistics?: HistoryStatistics;
  analysisReports?: GameReport[];
  cardData?: Array<{
    gameId: string;
    cards: Card[];
    ownership: Record<string, PlayerPosition>;
  }>;
}

/** Hook返回类型 */
interface UseGameHistoryReturn {
  /** 游戏记录列表 */
  gameRecords: GameRecord[];
  /** 历史统计 */
  statistics: HistoryStatistics;
  /** 回放状态 */
  replayState: ReplayState;
  
  /** 保存当前游戏 */
  saveCurrentGame: (
    cards: Card[],
    cardOwnership: Record<string, PlayerPosition>,
    currentRank: GameRank,
    players: Player[],
    gameStats: GameStateSnapshot,
    options?: SaveGameOptions
  ) => string;
  /** 设置或取消重要牌局。 */
  setGameImportant: (gameId: string, important: boolean) => void;
  
  /** 加载游戏记录 */
  loadGameRecord: (gameId: string) => GameRecord | null;
  /** 删除游戏记录 */
  deleteGameRecord: (gameId: string) => void;
  /** 清空所有记录 */
  clearAllRecords: () => void;
  
  /** 开始回放 */
  startReplay: (gameId: string) => void;
  /** 停止回放 */
  stopReplay: () => void;
  /** 设置回放进度 */
  setReplayProgress: (progress: number) => void;
  /** 设置回放速度 */
  setReplaySpeed: (speed: number) => void;
  
  /** 导出数据 */
  exportData: (options: ExportOptions) => string;
  /** 导入数据 */
  importData: (data: string) => boolean;
  
  /** 获取最近游戏 */
  getRecentGames: (count?: number) => GameRecord[];
  /** 按级数筛选 */
  getGamesByRank: (rank: GameRank) => GameRecord[];
  /** 搜索游戏 */
  searchGames: (query: string) => GameRecord[];
}

// ==================== 存储管理 ====================

const HISTORY_STORAGE_KEY = STORAGE_KEYS.GAME_STATE + '_history';
const MAX_RECORDS = 10;

const normalizeGameRecord = (record: GameRecord): GameRecord => ({
  ...record,
  isImportant: Boolean(record.isImportant),
  lastUpdatedAt: record.lastUpdatedAt ?? record.timestamp
});

/**
 * 重要牌局全部保留；普通牌局只保留最近MAX_RECORDS局。
 * 复制后排序，避免原实现直接sort导致React状态被原地修改。
 */
export const retainGameRecords = (records: GameRecord[]): GameRecord[] => {
  const sorted = records
    .map(normalizeGameRecord)
    .sort((left, right) =>
      (right.lastUpdatedAt ?? right.timestamp) -
      (left.lastUpdatedAt ?? left.timestamp)
    );
  const importantRecords = sorted.filter(record => record.isImportant);
  const regularRecords = sorted
    .filter(record => !record.isImportant)
    .slice(0, MAX_RECORDS);

  return [...importantRecords, ...regularRecords].sort((left, right) =>
    Number(right.isImportant) - Number(left.isImportant) ||
    right.lastUpdatedAt - left.lastUpdatedAt
  );
};

/**
 * 保存游戏记录到localStorage
 */
function saveRecordsToStorage(records: GameRecord[]): void {
  try {
    const limitedRecords = retainGameRecords(records);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(limitedRecords));
  } catch (error) {
    console.warn('Failed to save game records to localStorage:', error);
  }
}

/**
 * 从localStorage加载游戏记录
 */
function loadRecordsFromStorage(): GameRecord[] {
  try {
    const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!saved) return [];
    
    const records = JSON.parse(saved) as GameRecord[];
    return Array.isArray(records) ? retainGameRecords(records) : [];
  } catch (error) {
    console.warn('Failed to load game records from localStorage:', error);
    return [];
  }
}

// ==================== 分析函数 ====================

/**
 * 计算历史统计
 */
function calculateHistoryStatistics(records: GameRecord[]): HistoryStatistics {
  const totalGames = records.length;
  const completedGames = records.filter(r => r.isCompleted).length;
  
  // 按级数统计
  const gamesByRank = Object.fromEntries(
    Array.from({ length: 13 }, (_, index) => {
      const rank = (index + 2) as GameRank;
      return [rank, records.filter(record => record.currentRank === rank).length];
    })
  ) as Record<GameRank, number>;
  
  // 胜率统计
  const completedRecords = records.filter(r => r.isCompleted && r.winningTeam);
  const team1Wins = completedRecords.filter(r => r.winningTeam === 1).length;
  const team2Wins = completedRecords.filter(r => r.winningTeam === 2).length;
  
  const overallWinRate = completedRecords.length > 0 ? 
    Math.max(team1Wins, team2Wins) / completedRecords.length : 0;
  
  const winRatesByTeam = {
    1: completedRecords.length > 0 ? team1Wins / completedRecords.length : 0,
    2: completedRecords.length > 0 ? team2Wins / completedRecords.length : 0
  };
  
  const winRatesByRank = Object.fromEntries(
    Array.from({ length: 13 }, (_, index) => {
      const rank = (index + 2) as GameRank;
      const rankGames = completedRecords.filter(record => record.currentRank === rank);
      const rankWins = rankGames.filter(record => record.winningTeam === 1);
      return [rank, rankGames.length > 0 ? rankWins.length / rankGames.length : 0];
    })
  ) as Record<GameRank, number>;
  
  // 平均游戏时长
  const averageGameDuration = completedRecords.length > 0 ?
    completedRecords.reduce((sum, r) => sum + r.duration, 0) / completedRecords.length : 0;
  
  // 最常用级数
  const mostPlayedRank = Object.entries(gamesByRank)
    .sort(([,a], [,b]) => b - a)[0]?.[0] as GameRank || 2;
  
  // 趋势分析
  const recentGames = records.slice(0, Math.min(5, records.length));
  const recentCompletedGames = recentGames.filter(r => r.isCompleted);
  const recentWins = recentCompletedGames.filter(r => r.winningTeam === 1);
  const recentWinRate = recentCompletedGames.length > 0 ? 
    recentWins.length / recentCompletedGames.length : 0;
  
  // 改进率 (最近5局vs之前5局的胜率对比)
  const olderGames = records.slice(5, 10).filter(r => r.isCompleted);
  const olderWins = olderGames.filter(r => r.winningTeam === 1);
  const olderWinRate = olderGames.length > 0 ? olderWins.length / olderGames.length : 0;
  const improvementRate = recentWinRate - olderWinRate;
  
  // 一致性评分 (胜率方差的倒数)
  const winRates = Object.values(winRatesByRank).filter(rate => !isNaN(rate));
  const meanWinRate = winRates.length > 0 ? 
    winRates.reduce((sum, rate) => sum + rate, 0) / winRates.length : 0;
  const variance = winRates.length > 0 ?
    winRates.reduce((sum, rate) => sum + Math.pow(rate - meanWinRate, 2), 0) / winRates.length : 0;
  const consistencyScore = variance > 0 ? Math.max(0, 1 - variance) : 1;
  
  return {
    totalGames,
    completedGames,
    gamesByRank,
    winRates: {
      overall: overallWinRate,
      byTeam: winRatesByTeam,
      byRank: winRatesByRank
    },
    averageGameDuration,
    mostPlayedRank,
    trends: {
      recentWinRate,
      improvementRate,
      consistencyScore
    }
  };
}

/**
 * 生成游戏ID
 */
function generateGameId(): string {
  return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== Hook主函数 ====================

export function useGameHistory(): UseGameHistoryReturn {
  const [gameRecords, setGameRecords] = useState<GameRecord[]>(() => 
    loadRecordsFromStorage()
  );
  
  const [replayState, setReplayState] = useState<ReplayState>({
    currentGameId: null,
    isReplayMode: false,
    replayProgress: 0,
    replaySpeed: 1
  });
  
  // 计算统计信息
  const statistics = useMemo(() => 
    calculateHistoryStatistics(gameRecords),
    [gameRecords]
  );
  
  // 自动保存到localStorage
  useEffect(() => {
    saveRecordsToStorage(gameRecords);
  }, [gameRecords]);
  
  // 保存当前游戏
  const saveCurrentGame = useCallback((
    cards: Card[],
    cardOwnership: Record<string, PlayerPosition>,
    currentRank: GameRank,
    players: Player[],
    gameStats: GameStateSnapshot,
    options: SaveGameOptions = {}
  ) => {
    const gameId = options.recordId || generateGameId();
    const savedAt = Date.now();
    const playHistory: PlayRecord[] = Array.isArray(gameStats?.playHistory)
      ? gameStats.playHistory.map((record: PlayRecord) => ({
          ...record,
          cards: record.cards.map(card => ({ ...card }))
        }))
      : [];
    const timestamp =
      gameStats?.currentRound?.startTime ||
      gameStats?.createdAt ||
      savedAt;
    
    // 生成分析报告
    const analysisReport = generateGameReport(cards, cardOwnership, currentRank);
    
    const duration = Math.max(0, Math.floor((savedAt - timestamp) / 1000));
    
    const team1Score = analysisReport.teamStatus[1].strength;
    const team2Score = analysisReport.teamStatus[2].strength;
    
    const newRecord: GameRecord = {
      id: gameId,
      sourceGameId: options.sourceGameId,
      isImportant: options.isImportant ?? false,
      lastUpdatedAt: savedAt,
      timestamp,
      duration,
      currentRank,
      gameMode: gameStats?.config?.gameMode ?? 'guandan',
      landlordPosition: gameStats?.config?.landlordPosition,
      players: players.map(p => ({ ...p })),
      finalCardOwnership: { ...cardOwnership },
      cardsSnapshot: cards.map(c => ({ ...c })),
      playHistory,
      startingPlayerPosition:
        playHistory[0]?.playerPosition ||
        gameStats?.currentPlayerPosition ||
        'bottom',
      analysisReport,
      winningTeam: options.winningTeam || null,
      gameResult: {
        team1Score,
        team2Score,
        advantages: analysisReport.teamStatus[1].keyAdvantages,
        keyMoments: analysisReport.keyDecisionPoints.map(kd => kd.description)
      },
      isCompleted: options.isCompleted || false,
      tags: options.tags || [],
      notes: options.notes
    };
    
    setGameRecords(prev => {
      const existing = prev.find(record => record.id === gameId);
      const mergedRecord: GameRecord = existing
        ? {
            ...newRecord,
            timestamp: existing.timestamp,
            sourceGameId:
              options.sourceGameId ?? existing.sourceGameId,
            isImportant:
              options.isImportant ?? existing.isImportant
          }
        : newRecord;
      return retainGameRecords([
        mergedRecord,
        ...prev.filter(record => record.id !== gameId)
      ]);
    });
    
    return gameId;
  }, []);

  const setGameImportant = useCallback((
    gameId: string,
    important: boolean
  ) => {
    setGameRecords(previous =>
      retainGameRecords(previous.map(record =>
        record.id === gameId
          ? {
              ...record,
              isImportant: important,
              lastUpdatedAt: Date.now(),
              tags: important
                ? [...new Set([...record.tags, '重要牌局'])]
                : record.tags.filter(tag => tag !== '重要牌局')
            }
          : record
      ))
    );
  }, []);
  
  // 加载游戏记录
  const loadGameRecord = useCallback((gameId: string): GameRecord | null => {
    return gameRecords.find(record => record.id === gameId) || null;
  }, [gameRecords]);
  
  // 删除游戏记录
  const deleteGameRecord = useCallback((gameId: string) => {
    setGameRecords(prev => prev.filter(record => record.id !== gameId));
  }, []);
  
  // 清空所有记录
  const clearAllRecords = useCallback(() => {
    setGameRecords([]);
    setReplayState({
      currentGameId: null,
      isReplayMode: false,
      replayProgress: 0,
      replaySpeed: 1
    });
  }, []);
  
  // 开始回放
  const startReplay = useCallback((gameId: string) => {
    setReplayState({
      currentGameId: gameId,
      isReplayMode: true,
      replayProgress: 0,
      replaySpeed: 1
    });
  }, []);
  
  // 停止回放
  const stopReplay = useCallback(() => {
    setReplayState({
      currentGameId: null,
      isReplayMode: false,
      replayProgress: 0,
      replaySpeed: 1
    });
  }, []);
  
  // 设置回放进度
  const setReplayProgress = useCallback((progress: number) => {
    setReplayState(prev => ({
      ...prev,
      replayProgress: Math.max(0, Math.min(1, progress))
    }));
  }, []);
  
  // 设置回放速度
  const setReplaySpeed = useCallback((speed: number) => {
    setReplayState(prev => ({
      ...prev,
      replaySpeed: Math.max(0.25, Math.min(4, speed))
    }));
  }, []);
  
  // 导出数据
  const exportData = useCallback((options: ExportOptions): string => {
    let filteredRecords = gameRecords;
    
    // 应用日期过滤
    if (options.dateRange) {
      filteredRecords = filteredRecords.filter(record => 
        record.timestamp >= options.dateRange!.start && 
        record.timestamp <= options.dateRange!.end
      );
    }
    
    // 应用级数过滤
    if (options.rankFilter && options.rankFilter.length > 0) {
      filteredRecords = filteredRecords.filter(record => 
        options.rankFilter!.includes(record.currentRank)
      );
    }
    
    const exportObj: GameHistoryExport = {
      version: '1.0',
      exportTimestamp: Date.now(),
      totalRecords: filteredRecords.length
    };
    
    if (options.includeData.gameRecords) {
      exportObj.gameRecords = filteredRecords;
    }
    
    if (options.includeData.statistics) {
      exportObj.statistics = calculateHistoryStatistics(filteredRecords);
    }
    
    if (options.includeData.analysisReports) {
      exportObj.analysisReports = filteredRecords.map(r => r.analysisReport);
    }
    
    if (options.includeData.cardData) {
      exportObj.cardData = filteredRecords.map(r => ({
        gameId: r.id,
        cards: r.cardsSnapshot,
        ownership: r.finalCardOwnership
      }));
    }
    
    if (options.format === 'json') {
      return JSON.stringify(exportObj, null, 2);
    } else if (options.format === 'csv') {
      // 简化CSV导出
      const headers = ['ID', 'Timestamp', 'Rank', 'Duration', 'Team1Score', 'Team2Score', 'Winner'];
      const rows = filteredRecords.map(r => [
        r.id,
        new Date(r.timestamp).toISOString(),
        r.currentRank,
        r.duration,
        r.gameResult.team1Score,
        r.gameResult.team2Score,
        r.winningTeam || 'N/A'
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    } else {
      // 文本格式
      return filteredRecords.map(r => 
        `Game ${r.id}: Rank ${r.currentRank}, Duration ${Math.floor(r.duration/60)}min, Winner: Team ${r.winningTeam || 'N/A'}`
      ).join('\n');
    }
  }, [gameRecords]);
  
  // 导入数据
  const importData = useCallback((data: string): boolean => {
    try {
      const importObj = JSON.parse(data);
      
      if (importObj.gameRecords && Array.isArray(importObj.gameRecords)) {
        // 合并导入的记录，避免重复
        const existingIds = new Set(gameRecords.map(r => r.id));
        const newRecords = importObj.gameRecords
          .filter((r: GameRecord) => !existingIds.has(r.id))
          .map(normalizeGameRecord);
        
        setGameRecords(prev => {
          const combined = [...newRecords, ...prev];
          return retainGameRecords(combined);
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }, [gameRecords]);
  
  // 获取最近游戏
  const getRecentGames = useCallback((count: number = 5): GameRecord[] => {
    return gameRecords.slice(0, count);
  }, [gameRecords]);
  
  // 按级数筛选
  const getGamesByRank = useCallback((rank: GameRank): GameRecord[] => {
    return gameRecords.filter(record => record.currentRank === rank);
  }, [gameRecords]);
  
  // 搜索游戏
  const searchGames = useCallback((query: string): GameRecord[] => {
    const lowerQuery = query.toLowerCase();
    return gameRecords.filter(record => 
      record.id.toLowerCase().includes(lowerQuery) ||
      record.players.some(p => p.name.toLowerCase().includes(lowerQuery)) ||
      record.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      (record.notes && record.notes.toLowerCase().includes(lowerQuery))
    );
  }, [gameRecords]);
  
  return {
    gameRecords,
    statistics,
    replayState,
    saveCurrentGame,
    setGameImportant,
    loadGameRecord,
    deleteGameRecord,
    clearAllRecords,
    startReplay,
    stopReplay,
    setReplayProgress,
    setReplaySpeed,
    exportData,
    importData,
    getRecentGames,
    getGamesByRank,
    searchGames
  };
}

export default useGameHistory;
export type { 
  GameRecord, 
  HistoryStatistics, 
  ReplayState, 
  ExportOptions,
  SaveGameOptions,
  UseGameHistoryReturn 
};
