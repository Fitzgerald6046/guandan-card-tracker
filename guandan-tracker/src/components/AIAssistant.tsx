/**
 * 增强版AI助手组件
 * 基于实战算牌技巧的智能推理系统
 */

import React, { useState, useMemo } from 'react';
import { getAIAdvice, GuandanAIReasoningEngine } from '../utils/aiReasoningEngine';
import type { 
  AIAnalysisResult, 
  PlayerPosition,
  PassAnalysis,
  BreakingPatternAnalysis,
  PlayRecord,
  GameRank
} from '../types/game';

// ==================== 类型定义 ====================

interface AIAssistantProps {
  /** AI分析结果 */
  aiAnalysis: AIAnalysisResult | null;
  /** 过牌分析 */
  passAnalysis: PassAnalysis[];
  /** 拆牌分析 */
  breakingAnalysis: BreakingPatternAnalysis[];
  /** 是否启用AI */
  enabled: boolean;
  /** 切换AI状态 */
  onToggle: (enabled: boolean) => void;
  /** 手动触发分析 */
  onRefresh: () => void;
  /** 接受AI建议回调 */
  onAcceptSuggestion?: (suggestion: string) => void;
  /** 出牌历史记录 */
  playHistory?: PlayRecord[];
  /** 当前级数 */
  currentRank?: GameRank;
  /** 当前玩家位置 */
  currentPlayer?: PlayerPosition;
}

// ==================== 子组件 ====================

/**
 * AI状态指示器
 */
const AIStatusIndicator: React.FC<{ 
  enabled: boolean; 
  hasData: boolean;
}> = ({ enabled, hasData }) => {
  if (!enabled) {
    return (
      <div className="flex items-center text-gray-500">
        <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
        <span className="text-xs">AI已关闭</span>
      </div>
    );
  }
  
  if (!hasData) {
    return (
      <div className="flex items-center text-yellow-600">
        <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse"></div>
        <span className="text-xs">等待数据</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center text-green-600">
      <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
      <span className="text-xs">AI运行中</span>
    </div>
  );
};


/**
 * 增强版智能推理分析组件
 */
const EnhancedSmartAnalysis: React.FC<{
  playHistory: PlayRecord[];
  currentRank: GameRank;
  currentPlayer: PlayerPosition;
  reasoningEngine: GuandanAIReasoningEngine;
}> = ({ playHistory, currentRank, reasoningEngine }) => {
  
  // 使用增强推理引擎进行分析
  const analysisResult = useMemo(() => {
    if (playHistory.length === 0) return null;
    
    reasoningEngine.updateGameData(playHistory, currentRank);
    return reasoningEngine.performFullAnalysis();
  }, [playHistory, currentRank, reasoningEngine]);

  if (!analysisResult) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
        <div className="text-gray-400 mb-1">🤔</div>
        <p className="text-sm text-gray-600">等待出牌数据...</p>
        <p className="text-xs text-gray-500">开始记录出牌后将启动AI分析</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI推理置信度 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-medium text-blue-800">AI推理分析</h4>
          <div className="text-xs text-blue-600">
            置信度: {Math.round(analysisResult.confidence * 100)}%
          </div>
        </div>
        <div className="text-xs text-blue-600">
          基于 {playHistory.length} 次出牌进行概率推理
        </div>
      </div>

      {/* 关键牌分析 */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <h4 className="text-sm font-medium text-purple-800 mb-2">关键牌态势</h4>
        <div className="space-y-1 text-sm text-purple-700">
          <div>
            🎯 级牌{currentRank}: 剩余{analysisResult.structureAnalysis.criticalCardAnalysis.rankCards.remaining}张 
            ({analysisResult.structureAnalysis.criticalCardAnalysis.rankCards.distribution})
          </div>
          <div>
            🔑 5和10: 剩余{analysisResult.structureAnalysis.criticalCardAnalysis.fives.remaining}+{analysisResult.structureAnalysis.criticalCardAnalysis.tens.remaining}张
          </div>
        </div>
      </div>

      {/* 强否定推理 */}
      {analysisResult.warnings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-red-800 mb-2">🚫 风险警告</h4>
          <div className="space-y-2">
            {analysisResult.warnings.map((warning, index) => (
              <div key={index} className="text-sm text-red-700">
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 正向推理洞察 */}
      {analysisResult.strategicInsights.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-green-800 mb-2">💡 战略洞察</h4>
          <div className="space-y-1">
            {analysisResult.strategicInsights.map((insight: string, index: number) => (
              <div key={index} className="text-sm text-green-700">
                • {insight}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 结构逻辑推理 */}
      {analysisResult.recommendations.immediate.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-orange-800 mb-2">🧠 即时建议</h4>
          <div className="space-y-1">
            {analysisResult.recommendations.immediate.map((recommendation: string, index: number) => (
              <div key={index} className="text-sm text-orange-700">
                • {recommendation}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 当没有足够数据时的提示 */}
      {analysisResult.confidence < 0.4 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-gray-400 mb-1">🤔</div>
          <p className="text-sm text-gray-600">数据积累中...</p>
          <p className="text-xs text-gray-500">更多出牌和过牌记录将提升推理精度</p>
        </div>
      )}
    </div>
  );
};


// ==================== 主组件 ====================

export const AIAssistant: React.FC<AIAssistantProps> = ({
  aiAnalysis,
  enabled,
  onToggle,
  onRefresh,
  playHistory = [],
  currentRank = 7 as GameRank,
  currentPlayer = 'bottom'
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  
  // 创建推理引擎实例
  const reasoningEngine = useMemo(() => {
    return new GuandanAIReasoningEngine(currentRank);
  }, [currentRank]);
  
  
  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
      {/* 标题栏 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🤖</span>
          <span className="font-semibold text-gray-800">AI助手</span>
          <AIStatusIndicator enabled={enabled} hasData={!!aiAnalysis} />
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={onRefresh}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            title="刷新分析"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => onToggle(!enabled)}
            className={`p-1 transition-colors ${enabled ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-gray-600'}`}
            title={enabled ? '关闭AI' : '启用AI'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            title={isMinimized ? '展开' : '最小化'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMinimized ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
            </svg>
          </button>
        </div>
      </div>
      
      {/* 内容区域 */}
      {!isMinimized && (
        <div>
          {/* 内容面板 - 直接显示分析界面 */}
          <div className="p-4 max-h-96 overflow-y-auto">
            {!enabled ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">🤖</div>
                <p className="text-sm text-gray-500">AI助手已关闭</p>
                <button
                  onClick={() => onToggle(true)}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                >
                  启用AI
                </button>
              </div>
            ) : (
              <EnhancedSmartAnalysis 
                playHistory={playHistory}
                currentRank={currentRank}
                currentPlayer={currentPlayer}
                reasoningEngine={reasoningEngine}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;