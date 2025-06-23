/**
 * AI助手组件
 * 集成智能推理、概率分析、出牌建议等功能
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { 
  AIAnalysisResult, 
  PlayerPosition,
  PassAnalysis,
  BreakingPatternAnalysis,
  Card
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
 * 玩家威胁等级显示
 */
const ThreatLevelDisplay: React.FC<{
  threatLevels: AIAnalysisResult['threatLevels'];
}> = ({ threatLevels }) => {
  const positions: { pos: PlayerPosition; name: string }[] = [
    { pos: 'top', name: '对家' },
    { pos: 'left', name: '上家' },
    { pos: 'right', name: '下家' },
    { pos: 'bottom', name: '我' }
  ];
  
  const getThreatColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };
  
  const getThreatIcon = (level: string) => {
    switch (level) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };
  
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">威胁评估</h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {positions.map(({ pos, name }) => {
          const threat = threatLevels[pos];
          return (
            <div 
              key={pos}
              className={`p-2 rounded-lg border ${getThreatColor(threat.level)}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{name}</span>
                <span>{getThreatIcon(threat.level)}</span>
              </div>
              <div className="text-xs opacity-75 mt-1">
                {threat.reasoning[0] || '正常'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 剩余牌数预测
 */
const CardCountPrediction: React.FC<{
  estimatedCardCounts: AIAnalysisResult['estimatedCardCounts'];
}> = ({ estimatedCardCounts }) => {
  const positions: { pos: PlayerPosition; name: string }[] = [
    { pos: 'top', name: '对家' },
    { pos: 'left', name: '上家' },
    { pos: 'right', name: '下家' },
    { pos: 'bottom', name: '我' }
  ];
  
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">剩余牌数</h4>
      <div className="space-y-1">
        {positions.map(({ pos, name }) => {
          const estimate = estimatedCardCounts[pos];
          const confidence = Math.round(estimate.confidence * 100);
          
          return (
            <div key={pos} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{name}</span>
              <div className="flex items-center space-x-2">
                <span className="font-medium">{estimate.count}张</span>
                <span className="text-gray-500">({confidence}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * AI建议显示
 */
const SuggestionDisplay: React.FC<{
  suggestions: AIAnalysisResult['suggestions'];
  onAccept?: (suggestion: string) => void;
}> = ({ suggestions, onAccept }) => {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">AI建议</h4>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-800">
            {suggestions.action === 'play' ? '🎯 建议出牌' : 
             suggestions.action === 'pass' ? '🚫 建议过牌' : '⏳ 建议等待'}
          </span>
          <span className="text-xs text-blue-600">
            置信度: {Math.round(suggestions.confidence * 100)}%
          </span>
        </div>
        <p className="text-sm text-blue-700 mb-3">
          {suggestions.reasoning}
        </p>
        {onAccept && (
          <button
            onClick={() => onAccept(suggestions.reasoning)}
            className="w-full px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
          >
            采用建议
          </button>
        )}
        {suggestions.alternativeOptions && suggestions.alternativeOptions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-blue-200">
            <div className="text-xs text-blue-600 mb-1">其他选项:</div>
            {suggestions.alternativeOptions.map((option, index) => (
              <div key={index} className="text-xs text-blue-600">
                • {option}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== 主组件 ====================

export const AIAssistant: React.FC<AIAssistantProps> = ({
  aiAnalysis,
  passAnalysis,
  breakingAnalysis,
  enabled,
  onToggle,
  onRefresh,
  onAcceptSuggestion
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'analysis' | 'suggestions'>('overview');
  
  // 游戏阶段显示
  const getPhaseDisplay = (phase: string) => {
    const phaseNames = {
      early: '🌅 早期',
      middle: '🌞 中期', 
      late: '🌆 后期',
      endgame: '🌙 残局'
    };
    return phaseNames[phase as keyof typeof phaseNames] || phase;
  };
  
  // 过牌分析汇总
  const passAnalysisSummary = useMemo(() => {
    const summary = new Map<PlayerPosition, number>();
    passAnalysis.forEach(analysis => {
      const count = summary.get(analysis.playerPosition) || 0;
      summary.set(analysis.playerPosition, count + 1);
    });
    return summary;
  }, [passAnalysis]);
  
  // 拆牌分析汇总
  const breakingAnalysisSummary = useMemo(() => {
    return breakingAnalysis.length;
  }, [breakingAnalysis]);
  
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
          {/* 标签栏 */}
          <div className="flex border-b border-gray-200">
            {[
              { key: 'overview', label: '总览' },
              { key: 'analysis', label: '分析' },
              { key: 'suggestions', label: '建议' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab.key 
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* 内容面板 */}
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
            ) : !aiAnalysis ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">⏳</div>
                <p className="text-sm text-gray-500">等待游戏数据...</p>
              </div>
            ) : (
              <>
                {/* 总览标签 */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">游戏阶段</span>
                      <span className="text-sm text-gray-600">
                        {getPhaseDisplay(aiAnalysis.gamePhase)}
                      </span>
                    </div>
                    
                    <ThreatLevelDisplay threatLevels={aiAnalysis.threatLevels} />
                    <CardCountPrediction estimatedCardCounts={aiAnalysis.estimatedCardCounts} />
                  </div>
                )}
                
                {/* 分析标签 */}
                {activeTab === 'analysis' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">过牌分析</h4>
                      {passAnalysisSummary.size > 0 ? (
                        <div className="space-y-1">
                          {Array.from(passAnalysisSummary.entries()).map(([pos, count]) => (
                            <div key={pos} className="flex justify-between text-xs">
                              <span className="text-gray-600">{pos}</span>
                              <span className="text-gray-500">{count}次过牌</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">暂无过牌记录</p>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">拆牌分析</h4>
                      {breakingAnalysisSummary > 0 ? (
                        <p className="text-xs text-gray-600">
                          检测到 {breakingAnalysisSummary} 次可能的拆牌行为
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">暂无拆牌记录</p>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">关键牌分布</h4>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>配牌: {Object.values(aiAnalysis.keyCardDistribution.wildCards).reduce((a, b) => a + b, 0)}张</div>
                        <div>级牌: {Object.values(aiAnalysis.keyCardDistribution.rankCards).reduce((a, b) => a + b, 0)}张</div>
                        <div>王牌: {Object.values(aiAnalysis.keyCardDistribution.jokers).reduce((a, b) => a + b, 0)}张</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 建议标签 */}
                {activeTab === 'suggestions' && (
                  <SuggestionDisplay 
                    suggestions={aiAnalysis.suggestions}
                    onAccept={onAcceptSuggestion}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;