/**
 * 实时出牌记录面板
 * 显示当前游戏的出牌历史，支持实时记录和回放
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { PlayRecord, PlayerPosition, Card } from '../types/game';
import type { PlayAction } from '../hooks/usePlayHistory';
import { usePlayHistory } from '../hooks/usePlayHistory';
import { CardImage } from './CardImage';

// ==================== 类型定义 ====================

interface PlayHistoryPanelProps {
  /** 当前游戏是否进行中 */
  isGameActive: boolean;
  /** 当前玩家手牌数据 */
  playerCards?: Record<PlayerPosition, Card[]>;
  /** 玩家名称映射 */
  playerNames?: Record<PlayerPosition, string>;
  /** 自动记录模式 */
  autoRecord?: boolean;
  /** 外部回调 */
  onPlayRecorded?: (playRecord: PlayRecord) => void;
  /** 样式类名 */
  className?: string;
}

interface PlayRecordItemProps {
  playRecord: PlayRecord;
  playerName?: string;
  isLatest?: boolean;
  onUndo?: () => void;
}

// ==================== 子组件 ====================

/**
 * 出牌记录项组件
 */
const PlayRecordItem: React.FC<PlayRecordItemProps> = ({
  playRecord,
  playerName,
  isLatest = false,
  onUndo
}) => {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'pass': 'gray',
      'single': 'blue',
      'pair': 'green',
      'triple': 'purple',
      'bomb_four': 'red',
      'bomb_five': 'red',
      'bomb_six': 'red',
      'straight': 'yellow',
      'straight_flush': 'pink',
      'four_kings': 'red'
    };
    return colors[type] || 'gray';
  };

  const color = getTypeColor(playRecord.type);
  
  return (
    <div className={`play-record-item p-3 border-l-4 border-${color}-400 bg-${color}-50 rounded-r-lg mb-2 transition-all duration-300 ${
      isLatest ? 'ring-2 ring-blue-300 shadow-md' : ''
    }`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-semibold text-${color}-800`}>
              {playerName || playRecord.playerPosition}
            </span>
            <span className="text-xs text-gray-500">
              {formatTime(playRecord.timestamp)}
            </span>
            {playRecord.roundIndex && (
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                回合 {playRecord.roundIndex}
              </span>
            )}
          </div>
          
          <div className={`text-sm text-${color}-700 mb-2`}>
            {playRecord.description}
          </div>
          
          {playRecord.cardsBeforePlay !== undefined && (
            <div className="text-xs text-gray-500">
              出牌前剩余: {playRecord.cardsBeforePlay} 张
            </div>
          )}
        </div>
        
        {isLatest && onUndo && (
          <button
            onClick={onUndo}
            className="text-red-500 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-100"
            title="撤销此出牌"
          >
            ↶ 撤销
          </button>
        )}
      </div>
      
      {/* 显示出的牌 */}
      {playRecord.cards.length > 0 && (
        <div className="cards-display">
          <div className="text-xs text-gray-600 mb-1">出牌:</div>
          <div className="flex flex-wrap gap-1">
            {playRecord.cards.slice(0, 6).map((card, index) => (
              <div key={`${card.id}-${index}`} className="transform scale-75">
                <CardImage 
                  rank={card.rank}
                  suit={card.suit ?? undefined}
                  displayName={card.rank.toString()}
                  isWildCard={card.isWildCard}
                  isRankCard={card.isRankCard}
                  size="tiny"
                />
              </div>
            ))}
            {playRecord.cards.length > 6 && (
              <div className="text-xs text-gray-500 bg-gray-200 rounded px-2 py-1 flex items-center">
                +{playRecord.cards.length - 6}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 快速出牌按钮组
 */
const QuickPlayButtons: React.FC<{
  currentPlayer: PlayerPosition;
  onQuickPlay: (action: PlayAction) => void;
  playerCards: Card[];
}> = ({ currentPlayer, onQuickPlay, playerCards }) => {
  const quickActions = [
    { type: 'pass' as const, label: '过牌', cards: [] },
    { type: 'single' as const, label: '单张', cards: playerCards.slice(0, 1) },
    { type: 'pair' as const, label: '对子', cards: playerCards.slice(0, 2) },
    { type: 'triple' as const, label: '三张', cards: playerCards.slice(0, 3) }
  ];

  return (
    <div className="quick-play-buttons grid grid-cols-2 gap-2 mb-4">
      {quickActions.map(action => (
        <button
          key={action.type}
          onClick={() => onQuickPlay({
            playerPosition: currentPlayer,
            cards: action.cards,
            type: action.type,
            cardsBeforePlay: playerCards.length
          })}
          className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors text-sm"
          disabled={action.type !== 'pass' && playerCards.length < action.cards.length}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};

// ==================== 主组件 ====================

export const PlayHistoryPanel: React.FC<PlayHistoryPanelProps> = ({
  isGameActive = false,
  playerCards = {},
  playerNames = {},
  autoRecord = false,
  onPlayRecorded,
  className = ''
}) => {
  const {
    playHistory,
    currentRound,
    isRecording,
    startRecording,
    stopRecording,
    pauseRecording,
    recordPlay,
    undoLastPlay,
    startNewRound,
    clearHistory,
    exportPlayHistory,
    importPlayHistory,
    getRoundStats
  } = usePlayHistory();

  const [showStats, setShowStats] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportData, setExportData] = useState('');

  // 自动开始/停止记录
  useEffect(() => {
    if (autoRecord && isGameActive && !isRecording) {
      startRecording();
    } else if (!isGameActive && isRecording) {
      stopRecording();
    }
  }, [autoRecord, isGameActive, isRecording, startRecording, stopRecording]);

  // 处理快速出牌
  const handleQuickPlay = useCallback((action: PlayAction) => {
    const playId = recordPlay(action);
    if (playId && onPlayRecorded) {
      const playRecord = playHistory.find(p => p.id === playId);
      if (playRecord) {
        onPlayRecorded(playRecord);
      }
    }
  }, [recordPlay, onPlayRecorded, playHistory]);

  // 处理撤销
  const handleUndo = useCallback(() => {
    undoLastPlay();
  }, [undoLastPlay]);

  // 导出数据
  const handleExport = useCallback(() => {
    const data = exportPlayHistory();
    setExportData(data);
    setShowExport(true);
  }, [exportPlayHistory]);

  // 导入数据
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result as string;
        const success = importPlayHistory(data);
        if (success) {
          alert('导入成功！');
        } else {
          alert('导入失败，请检查文件格式！');
        }
      };
      reader.readAsText(file);
    }
  }, [importPlayHistory]);

  const roundStats = getRoundStats();
  const currentPlayerCards = playerCards[currentRound.currentPlayer] || [];

  return (
    <div className={`play-history-panel bg-white rounded-lg shadow-lg p-4 ${className}`}>
      {/* 头部控制区 */}
      <div className="panel-header mb-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-800">
            📝 出牌记录
          </h3>
          
          <div className="flex items-center gap-2">
            {/* 记录状态指示器 */}
            <div className={`status-indicator w-3 h-3 rounded-full ${
              isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
            }`} />
            
            <span className="text-sm text-gray-600">
              {isRecording ? '🔴 记录中' : '⚫ 已停止'}
            </span>
          </div>
        </div>
        
        {/* 控制按钮 */}
        <div className="control-buttons flex flex-wrap gap-2 mb-3">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
            >
              ▶️ 开始记录
            </button>
          ) : (
            <>
              <button
                onClick={pauseRecording}
                className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
              >
                ⏸️ 暂停
              </button>
              <button
                onClick={stopRecording}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
              >
                ⏹️ 停止
              </button>
            </>
          )}
          
          <button
            onClick={startNewRound}
            disabled={!isRecording}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 text-sm"
          >
            🔄 新回合
          </button>
          
          <button
            onClick={clearHistory}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
          >
            🗑️ 清空
          </button>
        </div>

        {/* 当前回合信息 */}
        <div className="round-info bg-gray-50 rounded p-3 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm text-gray-600">
                回合 {currentRound.roundIndex} | 当前玩家: 
              </span>
              <span className="font-medium text-blue-600 ml-1">
                {playerNames[currentRound.currentPlayer] || currentRound.currentPlayer}
              </span>
            </div>
            
            <div className="text-sm text-gray-500">
              总出牌: {playHistory.length} 次
            </div>
          </div>
        </div>
      </div>

      {/* 快速出牌区 */}
      {isRecording && currentPlayerCards.length > 0 && (
        <div className="quick-play-section mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            ⚡ 快速出牌 ({playerNames[currentRound.currentPlayer] || currentRound.currentPlayer})
          </h4>
          <QuickPlayButtons
            currentPlayer={currentRound.currentPlayer}
            onQuickPlay={handleQuickPlay}
            playerCards={currentPlayerCards}
          />
        </div>
      )}

      {/* 出牌历史列表 */}
      <div className="history-list">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-medium text-gray-700">
            📋 出牌历史 ({playHistory.length})
          </h4>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowStats(!showStats)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              📊 统计
            </button>
            <button
              onClick={handleExport}
              className="text-xs text-green-600 hover:text-green-800"
            >
              📤 导出
            </button>
            <label className="text-xs text-purple-600 hover:text-purple-800 cursor-pointer">
              📥 导入
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* 统计信息 */}
        {showStats && (
          <div className="stats-panel bg-blue-50 rounded p-3 mb-3">
            <h5 className="text-sm font-medium text-blue-800 mb-2">📈 统计信息</h5>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>总回合数: {roundStats.totalRounds}</div>
              <div>每回合平均出牌: {roundStats.playsPerRound.toFixed(1)}</div>
              <div>平均回合时长: {(roundStats.averageRoundDuration / 1000 / 60).toFixed(1)}分钟</div>
              <div>本回合出牌: {currentRound.playsInRound.length}</div>
            </div>
          </div>
        )}

        {/* 历史记录列表 */}
        <div className="history-items max-h-[400px] overflow-y-auto">
          {playHistory.length === 0 ? (
            <div className="empty-state text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">🎴</div>
              <div>暂无出牌记录</div>
              <div className="text-sm mt-1">开始游戏后会自动记录出牌</div>
            </div>
          ) : (
            <>
              {playHistory.slice().reverse().map((playRecord, index) => (
                <PlayRecordItem
                  key={playRecord.id}
                  playRecord={playRecord}
                  playerName={playerNames[playRecord.playerPosition]}
                  isLatest={index === 0}
                  onUndo={index === 0 ? handleUndo : undefined}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* 导出对话框 */}
      {showExport && (
        <div className="export-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">导出出牌记录</h3>
            <textarea
              value={exportData}
              readOnly
              className="w-full h-40 p-2 border border-gray-300 rounded text-xs font-mono"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowExport(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportData);
                  alert('已复制到剪贴板！');
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                复制
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayHistoryPanel;
