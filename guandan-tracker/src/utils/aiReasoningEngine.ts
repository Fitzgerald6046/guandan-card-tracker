import type { GameState, Card, PlayRecord, GameRank, AIAnalysisResult, PlayerPosition, PlayType } from '../types/game';
import { GAME_CONSTANTS, RANK_DISPLAY_NAMES, Rank } from '../types/game';
import { findLowestCostBeat } from './beatSolver';
import { analyzePassInferences } from './passInference';
import { inferCardDistribution } from './cardDistributionInference';
import { analyzeHumanReasoning } from './humanReasoning';
import { buildInferenceEvidenceLedger } from './evidenceFusion';
import { inferEndgameHands } from './endgameCsp';
import {
  buildThreatLevels,
  decideBeatResponse
} from './decisionPolicy';
import {
  PLAYER_DISPLAY_NAMES,
  isSameTeam
} from './gameProgress';
import {
  MODEL_CONFIDENCE_CONFIG,
  PASS_INFERENCE_CONFIDENCE
} from './inferenceConstants';

// 辅助函数：获取卡牌的等级（用于比较）
const getCardValue = (card: Card): number => {
  if (card.rank === Rank.JOKER_BIG) return 17; // 大王
  if (card.rank === Rank.JOKER_SMALL) return 16; // 小王
  return card.rank; // 其他牌直接使用其数值
};

const PLAY_TYPE_DISPLAY_NAMES: Record<PlayType, string> = {
  single: '单张',
  pair: '对子',
  triple: '三张',
  triple_with_pair: '三带二',
  straight: '顺子',
  pair_straight: '连对',
  triple_straight: '钢板',
  plane: '飞机',
  bomb_four: '四张炸弹',
  bomb_five: '五张炸弹',
  bomb_six: '六张炸弹',
  bomb_seven: '七张炸弹',
  bomb_eight: '八张及以上炸弹',
  straight_flush: '同花顺',
  four_kings: '四王炸',
  pass: '过牌'
};

// 增强版AI推理引擎类
export class GuandanAIReasoningEngine {
  private currentRank: GameRank;
  private playHistory: PlayRecord[] = [];
  private gameState: GameState | null = null;

  constructor(initialRank: GameRank) {
    this.currentRank = initialRank;
  }

  // 更新游戏数据
  updateGameData(playHistory: PlayRecord[], currentRank: GameRank, gameState: GameState) {
    this.playHistory = playHistory;
    this.currentRank = currentRank;
    this.gameState = gameState;
  }

  // 执行完整的AI分析
  performFullAnalysis(): AIAnalysisResult {
    if (!this.gameState) {
      return this.getDefaultAnalysisResult('等待游戏数据...');
    }

    const { allCards, players, currentPlayerPosition } = this.gameState;
    const playerTeams = players.reduce((teams, player) => {
      teams[player.position] = player.team;
      return teams;
    }, {} as Partial<Record<PlayerPosition, 1 | 2>>);
    const playedCards = new Set<string>();
    this.playHistory.forEach(record => record.cards.forEach(card => playedCards.add(card.id)));

    const remainingCardsInDeck = allCards.filter(card => !playedCards.has(card.id));

    // --- 1. 关键牌分析 ---
    const keyCardCounts = this.analyzeKeyCards(remainingCardsInDeck);

    // --- 2. 结构排斥原理分析 ---
    const { warnings, strategicInsights } = this.analyzeStructuralExclusion(this.playHistory);
    const passInferences = analyzePassInferences(
      this.playHistory,
      this.currentRank,
      players.reduce((counts, player) => {
        counts[player.position] = player.remainingCount;
        return counts;
      }, {} as Partial<Record<PlayerPosition, number>>),
      playerTeams
    );
    // 第一遍只建立无行为先验；第二遍把限制选择似然真正送回概率模型。
    // 显式手牌/明牌已在 inferCardDistribution 内扣除，账本不会重复进账。
    const baseCardDistribution = inferCardDistribution(this.gameState);
    const baseHumanReasoning = analyzeHumanReasoning(
      this.gameState,
      baseCardDistribution
    );
    const evidenceLedger = buildInferenceEvidenceLedger(
      this.gameState,
      baseHumanReasoning,
      passInferences
    );
    const cardDistribution = evidenceLedger.rankCountEvidence.length > 0
      ? inferCardDistribution(
        this.gameState,
        evidenceLedger.rankCountEvidence
      )
      : baseCardDistribution;
    const humanReasoning = analyzeHumanReasoning(
      this.gameState,
      cardDistribution
    );
    const endgameInference = inferEndgameHands(
      this.gameState,
      evidenceLedger
    );
    humanReasoning.openingInsights
      .slice(0, 2)
      .reverse()
      .forEach(insight => strategicInsights.unshift(insight));
    humanReasoning.ownershipClues
      .slice(0, 2)
      .reverse()
      .forEach(clue => strategicInsights.unshift(clue.summary));
    endgameInference.players
      .slice(0, 2)
      .reverse()
      .forEach(inference => strategicInsights.unshift(inference.summary));
    passInferences
      .filter(inference => inference.status === 'active' && inference.confidence >= 0.55)
      .slice(0, 3)
      .forEach(inference => {
        strategicInsights.unshift(inference.summary);
      });

    // --- 3. 局势评估与建议 ---
    let adviceReasoning = "AI 算牌建议：\n\n";
    const knownUnplayedCards = players.reduce(
      (total, player) => total + player.cards.filter(card => !playedCards.has(card.id)).length,
      0
    );
    const informationCoverage = Math.min(
      1,
      (playedCards.size + knownUnplayedCards) / GAME_CONSTANTS.TOTAL_CARDS
    );
    const modelConfidence = Math.min(
      MODEL_CONFIDENCE_CONFIG.cap,
      MODEL_CONFIDENCE_CONFIG.base +
        informationCoverage *
          MODEL_CONFIDENCE_CONFIG.informationCoverageWeight +
        cardDistribution.certainty *
          MODEL_CONFIDENCE_CONFIG.distributionCertaintyWeight
    );

    adviceReasoning += "**关键牌剩余:**\n";
    adviceReasoning += `- 大王: ${keyCardCounts.jokers.big}, 小王: ${keyCardCounts.jokers.small}\n`;
    adviceReasoning += `- 主牌 (${RANK_DISPLAY_NAMES[this.currentRank]}): ${keyCardCounts.levelCards}张\n`;
    adviceReasoning += `- A: ${keyCardCounts.aces}张, K: ${keyCardCounts.kings}张, 10: ${keyCardCounts.tens}张, 5: ${keyCardCounts.fives}张\n\n`;

    adviceReasoning += "**局势分析:**\n";
    const lastAction = this.playHistory.length > 0
      ? this.playHistory[this.playHistory.length - 1]
      : null;
    const latestActivePlay = [...this.playHistory]
      .reverse()
      .find(record => record.cards.length > 0);
    const currentLeadPlay = this.gameState.currentRound.currentMaxPlay ??
      (this.gameState.currentRound.passCount > 0 ? latestActivePlay : null);
    let trailingPassCount = 0;
    for (let index = this.playHistory.length - 1; index >= 0; index--) {
      if (this.playHistory[index].type !== 'pass') break;
      trailingPassCount += 1;
    }
    const currentPlayer = players.find(player => player.position === currentPlayerPosition);
    const knownPlayableCards = currentPlayer?.cards.filter(
      card => !playedCards.has(card.id)
    ) ?? [];
    const hasCompleteCurrentHand = Boolean(
      currentPlayer &&
      knownPlayableCards.length >= currentPlayer.remainingCount
    );
    const responseSolution = currentLeadPlay && knownPlayableCards.length > 0
      ? findLowestCostBeat(knownPlayableCards, currentLeadPlay.cards, this.currentRank)
      : null;
    const threatLevels = buildThreatLevels(players, cardDistribution);
    const decision = decideBeatResponse({
      currentPlayerPosition,
      currentPlayerRemainingCount: currentPlayer?.remainingCount ?? 0,
      leadPlayerPosition: currentLeadPlay?.playerPosition,
      responseSolution,
      hasCompleteCurrentHand,
      knownPlayableCount: knownPlayableCards.length,
      leadThreat: currentLeadPlay
        ? threatLevels[currentLeadPlay.playerPosition]
        : undefined
    });
    const suggestedAction = decision.action;

    if (currentLeadPlay) {
      adviceReasoning += `- 当前待压：${PLAYER_DISPLAY_NAMES[currentLeadPlay.playerPosition]}的${currentLeadPlay.cards.map(c => RANK_DISPLAY_NAMES[c.rank]).join(' ')}（${PLAY_TYPE_DISPLAY_NAMES[currentLeadPlay.type]}）。\n`;
      if (trailingPassCount > 0) {
        adviceReasoning += `- 之后已有 ${trailingPassCount} 家过牌，待压牌型没有改变。\n`;
      }
    } else {
      adviceReasoning += `- ${PLAYER_DISPLAY_NAMES[currentPlayerPosition]}是当前轮次的第一个出牌者。\n`;
    }
    adviceReasoning += `- ${decision.summary}\n`;
    if (decision.resourceWarning) {
      adviceReasoning += `- 资源提醒：${decision.resourceWarning}\n`;
    }

    adviceReasoning += "\n> _注意：以上建议仅供参考，实际决策请结合具体牌局情况。_";

    const knownRankCardCount = players.reduce(
      (total, player) =>
        total + player.cards.filter(
          card =>
            !playedCards.has(card.id) &&
            card.rank === this.currentRank
        ).length,
      0
    );

    const immediateRecommendations: string[] = [];
    if (currentPlayer && currentPlayer.remainingCount <= 10) {
      immediateRecommendations.push(
        `当前玩家仅剩${currentPlayer.remainingCount}张，优先保持牌权并减少零散牌。`
      );
    }
    immediateRecommendations.unshift(decision.summary);
    if (decision.resourceWarning) {
      immediateRecommendations.push(decision.resourceWarning);
    }
    if (!currentLeadPlay && lastAction?.type === 'pass') {
      immediateRecommendations.push(
        `${Math.max(1, players.length - 1)}家过牌后本轮已重置，可重新选择领牌牌型。`
      );
    }
    if (keyCardCounts.jokers.big + keyCardCounts.jokers.small >= 3) {
      immediateRecommendations.push('场外仍有至少3张王，单张和对子牌权风险较高。');
    }
    if (!currentLeadPlay) {
      const exploitablePass = passInferences.find(inference =>
        inference.status === 'active' &&
        (playerTeams[inference.playerPosition] === undefined ||
          playerTeams[currentPlayerPosition] === undefined
          ? !isSameTeam(inference.playerPosition, currentPlayerPosition)
          : playerTeams[inference.playerPosition] !== playerTeams[currentPlayerPosition]) &&
        inference.confidence >=
          PASS_INFERENCE_CONFIDENCE.displayLikelyThreshold
      );
      if (exploitablePass) {
        immediateRecommendations.unshift(
          `可尝试用${PLAY_TYPE_DISPLAY_NAMES[exploitablePass.leadType]}施压${PLAYER_DISPLAY_NAMES[exploitablePass.playerPosition]}：其此前在 ${exploitablePass.leadDisplay} 上过牌${exploitablePass.evidenceCount}次。`
        );
      }
    }

    return {
      timestamp: Date.now(),
      threatLevels,
      suggestions: {
        action: suggestedAction,
        summary: decision.summary,
        reasoning: adviceReasoning,
        confidence: decision.confidence,
        resourceWarning: decision.resourceWarning,
        reasonCodes: decision.reasonCodes,
      },
      // 填充 structureAnalysis
      structureAnalysis: {
          criticalCardAnalysis: {
            rankCards: {
              remaining: keyCardCounts.levelCards,
              distribution: `已定位${knownRankCardCount}张`,
          },
          fives: {
            remaining: keyCardCounts.fives,
          },
          tens: {
            remaining: keyCardCounts.tens,
          },
        },
      },
      warnings: warnings, // 填充警告
      strategicInsights: strategicInsights, // 填充战略洞察
      recommendations: { immediate: immediateRecommendations },
      passInferences,
      cardDistribution,
      baselineCardDistribution: baseCardDistribution,
      evidenceLedger,
      humanReasoning,
      endgameInference,
      confidence: modelConfidence,
    };
  }

  private getDefaultAnalysisResult(reasoning: string): AIAnalysisResult {
    return {
      timestamp: Date.now(),
      threatLevels: {
        bottom: { level: 'low', score: 0, role: 'self', reasoning: [] },
        left: { level: 'low', score: 0, role: 'opponent', reasoning: [] },
        top: { level: 'low', score: 0, role: 'teammate', reasoning: [] },
        right: { level: 'low', score: 0, role: 'opponent', reasoning: [] },
      },
      suggestions: {
        action: 'wait',
        summary: reasoning,
        reasoning: reasoning,
        confidence: 0.1,
      },
      structureAnalysis: { // 默认值
        criticalCardAnalysis: {
          rankCards: { remaining: 0, distribution: "" },
          fives: { remaining: 0 },
          tens: { remaining: 0 },
        },
      },
      warnings: [],
      strategicInsights: [],
      recommendations: { immediate: [] },
      passInferences: [],
      cardDistribution: {
        informationCoverage: 0,
        bombCandidates: [],
        certainty: 0,
        playerShapes: [],
        appliedEvidenceCount: 0,
      },
      baselineCardDistribution: {
        informationCoverage: 0,
        bombCandidates: [],
        certainty: 0,
        playerShapes: [],
        appliedEvidenceCount: 0,
      },
      evidenceLedger: {
        knownCardFactCount: 0,
        rankCountEvidence: [],
        choiceEvidence: [],
        summary: '等待游戏数据。'
      },
      humanReasoning: {
        openingInsights: [],
        ownershipClues: [],
        playerStructures: [],
        choiceEvidence: [],
        straightRoutes: {
          fivesRemaining: 0,
          tensRemaining: 0,
          naturalRoutesRemaining: 0,
          totalNaturalRoutes: 10,
          status: 'blocked',
          summary: '等待游戏数据。'
        },
        latestStepReminders: []
      },
      endgameInference: {
        threshold: 5,
        players: []
      },
      confidence: 0.1,
    };
  }

  private analyzeKeyCards(remainingCards: Card[]) {
    const counts = {
      jokers: { big: 0, small: 0 },
      levelCards: 0,
      aces: 0,
      kings: 0,
      tens: 0,
      fives: 0,
    };

    remainingCards.forEach(card => {
      if (card.rank === Rank.JOKER_BIG) counts.jokers.big++;
      if (card.rank === Rank.JOKER_SMALL) counts.jokers.small++;
      if (card.rank === this.currentRank) counts.levelCards++;
      if (card.rank === Rank.ACE) counts.aces++;
      if (card.rank === Rank.KING) counts.kings++;
      if (card.rank === Rank.TEN) counts.tens++;
      if (card.rank === Rank.FIVE) counts.fives++;
    });
    return counts;
  }

  private analyzeStructuralExclusion(history: PlayRecord[]): { warnings: string[]; strategicInsights: string[] } {
    const warnings: string[] = [];
    const strategicInsights: string[] = [];

    // 5和10各连接五条五张顺子路线。必须按实际张数，而不是“出现过几轮”计算。
    const fivesPlayed = history.reduce(
      (total, record) =>
        total + record.cards.filter(card => card.rank === Rank.FIVE).length,
      0
    );
    const tensPlayed = history.reduce(
      (total, record) =>
        total + record.cards.filter(card => card.rank === Rank.TEN).length,
      0
    );
    if (fivesPlayed >= 8 && tensPlayed >= 8) {
      warnings.push(
        '5和10各8张都已出完，所有自然五张顺子路线被切断；仍需防红心级牌配牌补缺。'
      );
    } else if (fivesPlayed >= 8 || tensPlayed >= 8) {
      strategicInsights.push(
        `${fivesPlayed >= 8 ? '5' : '10'}已出完，只能排除包含该点数的5条自然顺子路线，不能据此断定所有顺子都没有。`
      );
    }

    // 配牌未出现只保留为风险提示，不直接推断一定组成炸弹或同花顺。
    const redLevelCardsPlayed = history.reduce(
      (total, record) =>
        total + record.cards.filter(card => card.isWildCard).length,
      0
    );
    if (redLevelCardsPlayed === 0 && history.length > 10) {
      warnings.push(
        '两张红心级牌仍未公开，隐藏组合的上限风险尚未下降，但不能据此确定其已组成炸弹。'
      );
    }

    // 小牌顺牌
    const lastSingleOrPair = history.findLast(r => r.type === 'single' || r.type === 'pair');
    if (lastSingleOrPair && lastSingleOrPair.cards.every(c => getCardValue(c) <= Rank.FOUR)) {
      strategicInsights.push("有玩家出小单/对，如果上家也跟小牌，可考虑不接，让对家有机会顺牌走。");
    }

    // 封顶对手
    const lastPlay = history.length > 0 ? history[history.length - 1] : null;
    if (lastPlay && (lastPlay.type === 'triple_with_pair' || lastPlay.type === 'straight')) {
      strategicInsights.push(`上家出了${RANK_DISPLAY_NAMES[lastPlay.cards[0].rank]}${lastPlay.type === 'triple_with_pair' ? '三带二' : '顺子'}，若手中有${RANK_DISPLAY_NAMES[Rank.ACE]}三张或${RANK_DISPLAY_NAMES[Rank.TEN]}${RANK_DISPLAY_NAMES[Rank.JACK]}${RANK_DISPLAY_NAMES[Rank.QUEEN]}${RANK_DISPLAY_NAMES[Rank.KING]}${RANK_DISPLAY_NAMES[Rank.ACE]}顺子，可考虑封顶。`);
    }

    return { warnings, strategicInsights };
  }

}

// 兼容旧的getAIAdvice，但建议迁移到GuandanAIReasoningEngine类
export const getAIAdvice = (gameState: GameState): string => {
  const engine = new GuandanAIReasoningEngine(gameState.currentRank);
  engine.updateGameData(gameState.playHistory, gameState.currentRank, gameState);
  const analysis = engine.performFullAnalysis();
  return analysis.suggestions.reasoning;
};
