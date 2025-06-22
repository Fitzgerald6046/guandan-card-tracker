# 掼蛋AI助手模块设计方案

## 模块架构概述

AI助手模块主要包含以下几个核心部分：
1. **出牌记录系统**：追踪所有已出的牌
2. **概率计算引擎**：分析剩余牌的分布概率
3. **牌型分析器**：识别可能的牌型组合
4. **战术建议系统**：基于概率给出打牌建议
5. **可视化展示**：直观显示分析结果

## 数据结构设计

### 1. 出牌记录
```typescript
// types/ai.ts
export interface PlayedCard {
  cardId: string;
  playerId: number;
  round: number;
  timestamp: number;
  cardType: CardType;  // 单张、对子、三张等
}

export interface CardType {
  type: 'single' | 'pair' | 'triple' | 'straight' | 'bomb' | 'flush' | 'fullhouse';
  cards: string[];
  value: number;  // 牌型大小值
}

export interface RoundRecord {
  roundNumber: number;
  plays: PlayedCard[];
  winner: number;
  isPass: boolean[];  // 各玩家是否pass
}

export interface GameAnalysisState {
  playedCards: Map<string, PlayedCard>;  // 已出的牌
  roundRecords: RoundRecord[];           // 每轮记录
  playerHands: Map<number, Set<string>>; // 各玩家手牌（推测）
  currentRank: number;                   // 当前级数
}
```

### 2. 概率分析结果
```typescript
export interface CardProbability {
  cardId: string;
  probabilities: {
    [playerId: number]: number;  // 每个玩家持有该牌的概率
  };
  location: 'played' | 'hand' | 'unknown';
}

export interface PlayerAnalysis {
  playerId: number;
  estimatedCards: number;        // 估计剩余牌数
  probableCardTypes: {           // 可能的牌型
    singles: number;
    pairs: number;
    triples: number;
    straights: PossibleStraight[];
    bombs: PossibleBomb[];
  };
  keyCardProbabilities: {        // 关键牌概率
    rankCards: number;           // 拥有级牌概率
    wildCards: number;           // 拥有配牌概率
    jokers: number;              // 拥有王牌概率
  };
}

export interface TacticalSuggestion {
  action: 'play' | 'pass' | 'wait';
  suggestedCards?: string[];
  reason: string;
  confidence: number;  // 0-1 建议置信度
  alternativeOptions: TacticalSuggestion[];
}
```

## 核心功能实现

### 1. 出牌记录Hook
```typescript
// hooks/useCardTracking.ts
export const useCardTracking = (gameState: GameState) => {
  const [analysisState, setAnalysisState] = useState<GameAnalysisState>({
    playedCards: new Map(),
    roundRecords: [],
    playerHands: new Map(),
    currentRank: gameState.currentRank
  });

  // 记录出牌
  const recordPlay = useCallback((
    cards: string[], 
    playerId: number, 
    cardType: CardType
  ) => {
    setAnalysisState(prev => {
      const newState = { ...prev };
      const round = prev.roundRecords.length;
      
      cards.forEach(cardId => {
        newState.playedCards.set(cardId, {
          cardId,
          playerId,
          round,
          timestamp: Date.now(),
          cardType
        });
      });

      return newState;
    });
  }, []);

  // 重置记录
  const resetTracking = useCallback(() => {
    setAnalysisState({
      playedCards: new Map(),
      roundRecords: [],
      playerHands: new Map(),
      currentRank: gameState.currentRank
    });
  }, [gameState.currentRank]);

  return { analysisState, recordPlay, resetTracking };
};
```

### 2. 概率计算引擎
```typescript
// utils/probabilityEngine.ts
export class ProbabilityEngine {
  private totalCards = 108;
  private playersCount = 4;
  private cardsPerPlayer = 27;

  // 计算单张牌的持有概率
  calculateCardProbability(
    cardId: string,
    analysisState: GameAnalysisState,
    knownCards: Map<string, number>  // 已知的牌归属
  ): CardProbability {
    // 如果牌已经打出
    if (analysisState.playedCards.has(cardId)) {
      const played = analysisState.playedCards.get(cardId)!;
      return {
        cardId,
        probabilities: { [played.playerId]: 1 },
        location: 'played'
      };
    }

    // 如果牌的归属已知（通过记牌器）
    if (knownCards.has(cardId)) {
      const owner = knownCards.get(cardId)!;
      return {
        cardId,
        probabilities: { [owner]: 1 },
        location: 'hand'
      };
    }

    // 计算未知牌的概率分布
    const probabilities = this.calculateUnknownCardDistribution(
      cardId,
      analysisState
    );

    return {
      cardId,
      probabilities,
      location: 'unknown'
    };
  }

  // 计算未知牌的分布概率
  private calculateUnknownCardDistribution(
    cardId: string,
    analysisState: GameAnalysisState
  ): { [playerId: number]: number } {
    const remainingCards = this.getRemainingCardsCount(analysisState);
    const probabilities: { [playerId: number]: number } = {};

    // 基于剩余手牌数量的基础概率
    for (let i = 0; i < this.playersCount; i++) {
      probabilities[i] = remainingCards[i] / 
        Object.values(remainingCards).reduce((a, b) => a + b, 0);
    }

    // 根据出牌模式调整概率
    this.adjustByPlayPattern(cardId, probabilities, analysisState);

    // 根据牌型组合调整概率
    this.adjustByCardCombination(cardId, probabilities, analysisState);

    return probabilities;
  }

  // 根据出牌模式调整概率
  private adjustByPlayPattern(
    cardId: string,
    probabilities: { [playerId: number]: number },
    analysisState: GameAnalysisState
  ): void {
    // 分析历史出牌模式
    analysisState.roundRecords.forEach(round => {
      round.plays.forEach(play => {
        // 如果某玩家打出了相关牌型，调整概率
        if (this.isRelatedCard(cardId, play.cardType)) {
          probabilities[play.playerId] *= 1.2; // 提高概率
        }
      });
    });

    // 归一化概率
    this.normalizeProbabilities(probabilities);
  }

  // 分析可能的牌型组合
  analyzePossibleCombinations(
    playerId: number,
    analysisState: GameAnalysisState,
    cardProbabilities: CardProbability[]
  ): PlayerAnalysis {
    const probableCards = this.getProbableCards(playerId, cardProbabilities);
    
    return {
      playerId,
      estimatedCards: this.estimateRemainingCards(playerId, analysisState),
      probableCardTypes: {
        singles: this.countSingles(probableCards),
        pairs: this.countPairs(probableCards),
        triples: this.countTriples(probableCards),
        straights: this.findPossibleStraights(probableCards),
        bombs: this.findPossibleBombs(probableCards, analysisState.currentRank)
      },
      keyCardProbabilities: {
        rankCards: this.calculateKeyCardProbability(probableCards, 'rank', analysisState.currentRank),
        wildCards: this.calculateKeyCardProbability(probableCards, 'wild', analysisState.currentRank),
        jokers: this.calculateKeyCardProbability(probableCards, 'joker')
      }
    };
  }
}
```

### 3. 战术建议系统
```typescript
// utils/tacticalAdvisor.ts
export class TacticalAdvisor {
  private probabilityEngine: ProbabilityEngine;

  constructor() {
    this.probabilityEngine = new ProbabilityEngine();
  }

  // 生成战术建议
  generateSuggestions(
    currentPlayer: number,
    gameState: GameState,
    analysisState: GameAnalysisState,
    currentRound: CardType | null  // 当前轮次的牌型
  ): TacticalSuggestion[] {
    const suggestions: TacticalSuggestion[] = [];
    
    // 分析所有玩家的状态
    const playerAnalyses = this.analyzeAllPlayers(gameState, analysisState);
    
    // 获取当前玩家的手牌
    const myCards = this.getPlayerCards(currentPlayer, gameState);
    
    // 分析可能的出牌选项
    const playOptions = this.analyzePlayOptions(myCards, currentRound, gameState.currentRank);

    // 为每个选项评分
    playOptions.forEach(option => {
      const score = this.evaluateOption(
        option,
        currentPlayer,
        playerAnalyses,
        analysisState
      );

      suggestions.push({
        action: option.cards.length > 0 ? 'play' : 'pass',
        suggestedCards: option.cards,
        reason: this.generateReason(option, score, playerAnalyses),
        confidence: score.confidence,
        alternativeOptions: []
      });
    });

    // 按置信度排序
    suggestions.sort((a, b) => b.confidence - a.confidence);

    // 添加备选方案
    if (suggestions.length > 1) {
      suggestions[0].alternativeOptions = suggestions.slice(1, 4);
    }

    return suggestions;
  }

  // 评估出牌选项
  private evaluateOption(
    option: PlayOption,
    currentPlayer: number,
    playerAnalyses: Map<number, PlayerAnalysis>,
    analysisState: GameAnalysisState
  ): EvaluationScore {
    let score = 0;
    let confidence = 0.5;

    // 1. 控制权评分
    const controlScore = this.evaluateControl(option, playerAnalyses);
    score += controlScore * 0.3;

    // 2. 剩余牌力评分
    const remainingStrength = this.evaluateRemainingStrength(
      option,
      currentPlayer,
      playerAnalyses
    );
    score += remainingStrength * 0.3;

    // 3. 团队配合评分
    const teamworkScore = this.evaluateTeamwork(
      option,
      currentPlayer,
      playerAnalyses
    );
    score += teamworkScore * 0.2;

    // 4. 风险评估
    const riskScore = this.evaluateRisk(option, playerAnalyses);
    score += riskScore * 0.2;

    // 计算置信度
    confidence = this.calculateConfidence(playerAnalyses, analysisState);

    return { score, confidence };
  }

  // 生成建议理由
  private generateReason(
    option: PlayOption,
    score: EvaluationScore,
    playerAnalyses: Map<number, PlayerAnalysis>
  ): string {
    const reasons: string[] = [];

    // 基于不同因素生成理由
    if (option.isControl) {
      reasons.push("可以掌握出牌权");
    }

    if (option.isBomb) {
      reasons.push("炸弹可以改变局势");
    }

    if (option.preservesStrength) {
      reasons.push("保存实力等待更好时机");
    }

    // 分析对手情况
    const threats = this.identifyThreats(playerAnalyses);
    if (threats.length > 0) {
      reasons.push(`需要防范${threats.join('、')}的威胁`);
    }

    return reasons.join('，') + `（置信度：${Math.round(score.confidence * 100)}%）`;
  }
}
```

### 4. AI助手组件
```typescript
// components/AIAssistant/AIAssistant.tsx
import React, { useState, useEffect } from 'react';
import { useCardTracking } from '../../hooks/useCardTracking';
import { ProbabilityEngine } from '../../utils/probabilityEngine';
import { TacticalAdvisor } from '../../utils/tacticalAdvisor';

interface AIAssistantProps {
  gameState: GameState;
  currentPlayer: number;
  onSuggestionSelect: (cards: string[]) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  gameState,
  currentPlayer,
  onSuggestionSelect
}) => {
  const { analysisState, recordPlay } = useCardTracking(gameState);
  const [suggestions, setSuggestions] = useState<TacticalSuggestion[]>([]);
  const [showProbabilities, setShowProbabilities] = useState(false);
  const [playerAnalyses, setPlayerAnalyses] = useState<PlayerAnalysis[]>([]);

  // 初始化引擎
  const probabilityEngine = new ProbabilityEngine();
  const tacticalAdvisor = new TacticalAdvisor();

  // 更新分析
  useEffect(() => {
    const updateAnalysis = async () => {
      // 计算所有牌的概率
      const cardProbabilities = gameState.cards.map(card =>
        probabilityEngine.calculateCardProbability(
          card.id,
          analysisState,
          new Map(gameState.cards.map(c => [c.id, c.owners[0]]))
        )
      );

      // 分析每个玩家
      const analyses = [];
      for (let i = 0; i < 4; i++) {
        analyses.push(
          probabilityEngine.analyzePossibleCombinations(
            i,
            analysisState,
            cardProbabilities
          )
        );
      }
      setPlayerAnalyses(analyses);

      // 生成战术建议
      const newSuggestions = tacticalAdvisor.generateSuggestions(
        currentPlayer,
        gameState,
        analysisState,
        null // 当前轮次牌型
      );
      setSuggestions(newSuggestions);
    };

    updateAnalysis();
  }, [gameState, analysisState, currentPlayer]);

  return (
    <div className="ai-assistant bg-gray-100 rounded-lg p-4 space-y-4">
      {/* 标题栏 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold flex items-center">
          <span className="mr-2">🤖</span>
          AI助手分析
        </h3>
        <button
          onClick={() => setShowProbabilities(!showProbabilities)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {showProbabilities ? '显示建议' : '显示概率'}
        </button>
      </div>

      {/* 主内容区 */}
      {showProbabilities ? (
        <ProbabilityView playerAnalyses={playerAnalyses} />
      ) : (
        <SuggestionsView 
          suggestions={suggestions}
          onSelect={onSuggestionSelect}
        />
      )}

      {/* 关键信息提示 */}
      <KeyInfoPanel 
        playerAnalyses={playerAnalyses}
        currentPlayer={currentPlayer}
      />
    </div>
  );
};

// 建议视图组件
const SuggestionsView: React.FC<{
  suggestions: TacticalSuggestion[];
  onSelect: (cards: string[]) => void;
}> = ({ suggestions, onSelect }) => {
  if (suggestions.length === 0) {
    return <div className="text-gray-500">正在分析...</div>;
  }

  const mainSuggestion = suggestions[0];

  return (
    <div className="space-y-3">
      {/* 主要建议 */}
      <div className="bg-white rounded-lg p-3 shadow-sm">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="font-medium text-green-700">
              推荐：{mainSuggestion.action === 'play' ? '出牌' : '过牌'}
            </div>
            {mainSuggestion.suggestedCards && (
              <div className="text-sm text-gray-600 mt-1">
                {mainSuggestion.suggestedCards.join(', ')}
              </div>
            )}
            <div className="text-sm text-gray-500 mt-2">
              {mainSuggestion.reason}
            </div>
          </div>
          {mainSuggestion.suggestedCards && (
            <button
              onClick={() => onSelect(mainSuggestion.suggestedCards!)}
              className="ml-3 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            >
              采用
            </button>
          )}
        </div>
      </div>

      {/* 备选建议 */}
      {mainSuggestion.alternativeOptions.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">其他选项：</div>
          {mainSuggestion.alternativeOptions.map((alt, index) => (
            <div key={index} className="bg-gray-50 rounded p-2 text-sm">
              <div className="flex justify-between items-center">
                <div>
                  {alt.action === 'play' ? `出牌: ${alt.suggestedCards?.join(', ')}` : '过牌'}
                </div>
                <div className="text-gray-500">
                  置信度: {Math.round(alt.confidence * 100)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 概率视图组件
const ProbabilityView: React.FC<{
  playerAnalyses: PlayerAnalysis[];
}> = ({ playerAnalyses }) => {
  return (
    <div className="space-y-3">
      {playerAnalyses.map((analysis, index) => (
        <div key={index} className="bg-white rounded-lg p-3 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium">玩家 {index + 1}</div>
            <div className="text-sm text-gray-500">
              约 {analysis.estimatedCards} 张牌
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-center">
              <div className="text-gray-500">级牌概率</div>
              <div className="font-medium">
                {Math.round(analysis.keyCardProbabilities.rankCards * 100)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500">配牌概率</div>
              <div className="font-medium">
                {Math.round(analysis.keyCardProbabilities.wildCards * 100)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500">王牌概率</div>
              <div className="font-medium">
                {Math.round(analysis.keyCardProbabilities.jokers * 100)}%
              </div>
            </div>
          </div>

          {/* 可能的炸弹 */}
          {analysis.probableCardTypes.bombs.length > 0 && (
            <div className="mt-2 text-sm text-red-600">
              ⚠️ 可能有{analysis.probableCardTypes.bombs.length}个炸弹
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// 关键信息面板
const KeyInfoPanel: React.FC<{
  playerAnalyses: PlayerAnalysis[];
  currentPlayer: number;
}> = ({ playerAnalyses, currentPlayer }) => {
  const myTeammate = currentPlayer % 2 === 0 ? currentPlayer + 1 : currentPlayer - 1;
  const teammates = [currentPlayer, myTeammate];
  const opponents = [0, 1, 2, 3].filter(p => !teammates.includes(p));

  // 计算团队优势
  const teamStrength = teammates.reduce((sum, p) => 
    sum + (playerAnalyses[p]?.keyCardProbabilities.rankCards || 0), 0
  );
  const opponentStrength = opponents.reduce((sum, p) => 
    sum + (playerAnalyses[p]?.keyCardProbabilities.rankCards || 0), 0
  );

  return (
    <div className="bg-blue-50 rounded-lg p-3 text-sm">
      <div className="font-medium text-blue-900 mb-2">局势分析</div>
      <div className="space-y-1 text-blue-700">
        <div>
          级牌控制：
          {teamStrength > opponentStrength ? '我方占优' : '对方占优'}
        </div>
        <div>
          剩余炸弹数：约 {
            playerAnalyses.reduce((sum, p) => 
              sum + p.probableCardTypes.bombs.length, 0
            )
          } 个
        </div>
        <div className="text-xs text-blue-600 mt-2">
          提示：AI分析基于概率推测，仅供参考
        </div>
      </div>
    </div>
  );
};
```

### 5. 集成到主应用
```typescript
// 在 App.tsx 中添加 AI 助手
import { AIAssistant } from './components/AIAssistant/AIAssistant';

function App() {
  const { gameState, dispatch } = useGameState();
  const [showAIAssistant, setShowAIAssistant] = useState(true);

  const handleAISuggestion = (cards: string[]) => {
    // 自动选中AI建议的牌
    cards.forEach(cardId => {
      dispatch({ type: 'TOGGLE_CARD', payload: { cardId } });
    });
  };

  return (
    <div className="app">
      {/* 其他组件 */}
      
      {/* AI助手浮动面板 */}
      {showAIAssistant && (
        <div className="fixed bottom-20 right-4 w-80 max-w-[calc(100vw-2rem)] z-50">
          <AIAssistant
            gameState={gameState}
            currentPlayer={gameState.activePlayerId || 0}
            onSuggestionSelect={handleAISuggestion}
          />
        </div>
      )}
      
      {/* AI助手开关按钮 */}
      <button
        onClick={() => setShowAIAssistant(!showAIAssistant)}
        className="fixed bottom-4 right-4 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700"
      >
        🤖
      </button>
    </div>
  );
}
```

## 性能优化建议

1. **延迟计算**：只在需要时计算概率，避免每次状态更新都重算
2. **缓存机制**：缓存计算结果，相同状态不重复计算
3. **Web Worker**：将复杂计算移到 Web Worker 中执行
4. **渐进式更新**：先显示快速计算的结果，然后逐步优化

## 扩展功能

1. **学习功能**：记录玩家的出牌习惯，提高预测准确性
2. **难度调节**：提供不同级别的AI建议（新手/进阶/专家）
3. **复盘分析**：游戏结束后分析关键决策点
4. **教学模式**：解释每个建议背后的逻辑

## 开发提示词

### Claude Code 提示词（AI核心逻辑）：
```
请实现掼蛋AI助手的核心逻辑模块：

1. 创建概率计算引擎（ProbabilityEngine）：
   - 基于已出牌计算剩余牌的概率分布
   - 考虑出牌模式和牌型组合调整概率
   - 支持级牌、配牌的特殊处理

2. 创建战术建议系统（TacticalAdvisor）：
   - 评估所有可能的出牌选项
   - 考虑控制权、剩余牌力、团队配合、风险等因素
   - 生成置信度和详细理由

3. 实现出牌记录系统：
   - 追踪所有已出的牌和轮次信息
   - 分析玩家的出牌模式
   - 支持撤销和重做

要求：
- 使用TypeScript确保类型安全
- 算法要高效，避免阻塞UI
- 提供清晰的接口供组件调用
```

### Cursor 提示词（UI组件）：
```
请创建AI助手的React组件：

1. 主组件（AIAssistant）：
   - 浮动面板设计，可拖拽和折叠
   - 切换建议视图和概率视图
   - 响应式设计适配移动端

2. 建议展示：
   - 清晰显示主要建议和备选方案
   - 一键采用建议功能
   - 动画效果提升体验

3. 概率可视化：
   - 直观显示各玩家的牌力分析
   - 高亮显示威胁和机会
   - 使用图表展示关键数据

样式要求：
- 使用Tailwind CSS
- 与主应用风格一致
- 不遮挡主要游戏区域
```

这个AI助手模块设计既实用又不会过于复杂，可以真正帮助玩家提高掼蛋水平。