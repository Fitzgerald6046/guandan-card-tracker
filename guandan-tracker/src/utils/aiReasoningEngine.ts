import type { GameState, Card, PlayRecord, GameRank, AIAnalysisResult, PlayerPosition, Suit, Rank, PlayType } from '../types/game';
import { GAME_CONSTANTS, RANK_DISPLAY_NAMES, SUIT_SYMBOLS } from '../types/game';

// 辅助函数：获取卡牌的等级（用于比较）
const getCardValue = (card: Card): number => {
  if (card.rank === Rank.JOKER_BIG) return 17; // 大王
  if (card.rank === Rank.JOKER_SMALL) return 16; // 小王
  return card.rank; // 其他牌直接使用其数值
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
    const playedCards = new Set<string>();
    this.playHistory.forEach(record => record.cards.forEach(card => playedCards.add(card.id)));

    const remainingCardsInDeck = allCards.filter(card => !playedCards.has(card.id));

    // --- 1. 关键牌分析 ---
    const keyCardCounts = this.analyzeKeyCards(remainingCardsInDeck);

    // --- 2. 玩家手牌推断 (简化版) ---
    const playerEstimates = this.estimatePlayerHands(players, this.playHistory, remainingCardsInDeck);

    // --- 3. 结构排斥原理分析 ---
    const { warnings, strategicInsights } = this.analyzeStructuralExclusion(this.playHistory);

    // --- 4. 局势评估与建议 ---
    let adviceReasoning = "AI 算牌建议：\n\n";
    let confidence = 0.5;

    adviceReasoning += "**关键牌剩余:**\n";
    adviceReasoning += `- 大王: ${keyCardCounts.jokers.big}, 小王: ${keyCardCounts.jokers.small}\n`;
    adviceReasoning += `- 主牌 (${RANK_DISPLAY_NAMES[this.currentRank]}): ${keyCardCounts.levelCards}张\n`;
    adviceReasoning += `- A: ${keyCardCounts.aces}张, K: ${keyCardCounts.kings}张, 10: ${keyCardCounts.tens}张, 5: ${keyCardCounts.fives}张\n\n`;

    adviceReasoning += "**局势分析:**\n";
    const lastPlay = this.playHistory.length > 0 ? this.playHistory[this.playHistory.length - 1] : null;

    if (lastPlay) {
      adviceReasoning += `- 上家 (${lastPlay.playerPosition}) 出了 ${lastPlay.cards.map(c => RANK_DISPLAY_NAMES[c.rank]).join('')} (${lastPlay.type}).\n`;
      // 简单的跟牌建议
      const myPlayer = players.find(p => p.position === currentPlayerPosition);
      if (myPlayer && myPlayer.cards.length > 0) {
        adviceReasoning += `- 考虑你的手牌，是否有牌型能压过上家。如果没有，选择过牌保留实力。\n`;
      } else {
        adviceReasoning += `- 你已无牌可出或已出完牌。\n`;
      }
    } else {
      adviceReasoning += `- 你是当前轮次的第一个出牌者。\n`;
      // 简单的领牌建议
      const myPlayer = players.find(p => p.position === currentPlayerPosition);
      if (myPlayer && myPlayer.cards.length > 0) {
        adviceReasoning += `- 建议优先出手中较长的顺子、连对或三带二，以消耗手牌并控制牌权。\n`;
        adviceReasoning += `- 如果手牌较散，可以尝试出小单张或对子，试探对手牌力。\n`;
      } else {
        adviceReasoning += `- 你已无牌可出或已出完牌。\n`;
      }
    }

    // 根据玩家推断给出建议
    playerEstimates.forEach(estimate => {
      if (estimate.likelyHasBomb) {
        adviceReasoning += `- 玩家 ${estimate.position} 可能有炸弹，出牌时需警惕。\n`;
      }
      if (estimate.likelyMissingSuit) {
        adviceReasoning += `- 玩家 ${estimate.position} 可能缺少 ${SUIT_SYMBOLS[estimate.likelyMissingSuit]} 花色。\n`;
      }
    });

    adviceReasoning += "\n> _注意：以上建议仅供参考，实际决策请结合具体牌局情况。_";

    return {
      timestamp: Date.now(),
      gamePhase: this.getGamePhase(remainingCardsInDeck.length),
      estimatedCardCounts: playerEstimates.reduce((acc, curr) => {
        acc[curr.position] = { count: curr.remainingCount, confidence: curr.confidence };
        return acc;
      }, {} as Record<PlayerPosition, { count: number; confidence: number }>),
      keyCardDistribution: {
        wildCards: { bottom: 0, left: 0, top: 0, right: 0 }, // 待实现
        rankCards: { bottom: 0, left: 0, top: 0, right: 0 }, // 待实现
        jokers: { bottom: 0, left: 0, top: 0, right: 0 }, // 待实现
      },
      threatLevels: players.reduce((acc, p) => {
        acc[p.position] = { level: 'low', reasoning: [] }; // 待实现
        return acc;
      }, {} as Record<PlayerPosition, { level: 'low' | 'medium' | 'high' | 'critical'; reasoning: string[] }>),
      suggestions: {
        action: 'wait', // 待实现更具体的动作
        reasoning: adviceReasoning,
        confidence: confidence,
      },
      // 填充 structureAnalysis
      structureAnalysis: {
        criticalCardAnalysis: {
          rankCards: {
            remaining: keyCardCounts.levelCards,
            distribution: "待实现", // 待实现更详细的分布分析
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
      recommendations: { immediate: [] }, // 待实现
      confidence: confidence,
    };
  }

  private getDefaultAnalysisResult(reasoning: string): AIAnalysisResult {
    return {
      timestamp: Date.now(),
      gamePhase: 'early',
      estimatedCardCounts: {
        bottom: { count: 0, confidence: 0.5 },
        left: { count: 0, confidence: 0.5 },
        top: { count: 0, confidence: 0.5 },
        right: { count: 0, confidence: 0.5 },
      },
      keyCardDistribution: {
        wildCards: { bottom: 0, left: 0, top: 0, right: 0 },
        rankCards: { bottom: 0, left: 0, top: 0, right: 0 },
        jokers: { bottom: 0, left: 0, top: 0, right: 0 },
      },
      threatLevels: {
        bottom: { level: 'low', reasoning: [] },
        left: { level: 'low', reasoning: [] },
        top: { level: 'low', reasoning: [] },
        right: { level: 'low', reasoning: [] },
      },
      suggestions: {
        action: 'wait',
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
      else if (card.rank === Rank.JOKER_SMALL) counts.jokers.small++;
      else if (card.rank === this.currentRank) counts.levelCards++;
      else if (card.rank === Rank.ACE) counts.aces++;
      else if (card.rank === Rank.KING) counts.kings++;
      else if (card.rank === Rank.TEN) counts.tens++;
      else if (card.rank === Rank.FIVE) counts.fives++;
    });
    return counts;
  }

  private estimatePlayerHands(players: GameState['players'], history: PlayRecord[], remainingCardsInDeck: Card[]) {
    // 这是一个非常简化的推断，实际需要更复杂的概率模型
    const playerEstimates = players.map(p => ({
      position: p.position,
      remainingCount: p.cards.length, // 假设这里能拿到玩家手牌数
      confidence: 0.6, // 初始置信度
      likelyHasBomb: false,
      likelyMissingSuit: null as Suit | null,
    }));

    // 根据历史记录进行简单推断
    history.forEach(record => {
      const playerEstimate = playerEstimates.find(pe => pe.position === record.playerPosition);
      if (playerEstimate) {
        // 如果玩家出过炸弹类型，标记为可能持有炸弹
        if (record.type.startsWith('bomb') || record.type === 'straight_flush') {
          playerEstimate.likelyHasBomb = true;
          playerEstimate.confidence = Math.min(1, playerEstimate.confidence + 0.1);
        }
        // 如果玩家过牌，且场上有某种花色，可能缺少该花色（非常粗略的推断）
        if (record.type === 'pass' && record.cards.length === 0 && this.playHistory.length > 1) {
          const prevPlay = this.playHistory[this.playHistory.indexOf(record) - 1];
          if (prevPlay && prevPlay.cards.length > 0 && prevPlay.cards[0].suit) {
            // 假设过牌是因为没有该花色，但实际可能只是牌型不符
            // playerEstimate.likelyMissingSuit = prevPlay.cards[0].suit;
            // playerEstimate.confidence = Math.max(0.1, playerEstimate.confidence - 0.05);
          }
        }
      }
    });

    // 假设剩余牌数是准确的，但实际游戏中AI无法直接得知对手剩余牌数
    // 这里需要更复杂的推断逻辑，例如根据发牌数量和已出牌数量来估算
    const totalCards = GAME_CONSTANTS.TOTAL_CARDS;
    const cardsPerPlayer = GAME_CONSTANTS.CARDS_PER_PLAYER; // 27张

    // 估算每个玩家的剩余牌数
    players.forEach(player => {
      const playedByPlayer = history.filter(h => h.playerPosition === player.position).reduce((sum, h) => sum + h.cards.length, 0);
      // 这是一个简化的估算，实际需要考虑贡牌、回牌等
      playerEstimates.find(pe => pe.position === player.position)!.remainingCount = cardsPerPlayer - playedByPlayer;
    });


    return playerEstimates;
  }

  private analyzeStructuralExclusion(history: PlayRecord[]): { warnings: string[]; strategicInsights: string[] } {
    const warnings: string[] = [];
    const strategicInsights: string[] = [];

    const playTypeCounts: Record<PlayType, number> = {
      single: 0,
      pair: 0,
      triple: 0,
      triple_with_pair: 0,
      straight: 0,
      pair_straight: 0,
      triple_straight: 0,
      plane: 0,
      bomb_four: 0,
      bomb_five: 0,
      bomb_six: 0,
      bomb_seven: 0,
      bomb_eight: 0,
      straight_flush: 0,
      pass: 0,
    };

    history.forEach(record => {
      if (record.type in playTypeCounts) {
        playTypeCounts[record.type]++;
      }
    });

    // 结构排斥原理推断
    // 1. 炸弹多，则单张多的概率上升
    if (playTypeCounts.bomb_four + playTypeCounts.bomb_five + playTypeCounts.bomb_six + playTypeCounts.bomb_seven + playTypeCounts.bomb_eight + playTypeCounts.straight_flush >= 2) {
      strategicInsights.push("场上已出现多个炸弹，对手手牌中单张牌的比例可能较高，可尝试出压制性顺子或控制型对子。");
    }

    // 2. 对子多，则三带对少
    if (playTypeCounts.pair >= 5) {
      strategicInsights.push("对子牌型出现较多，对手手牌中三带对的组合可能较少。");
    }

    // 3. 顺子多，则三带对与炸弹的可能性下降
    if (playTypeCounts.straight >= 3) {
      strategicInsights.push("顺子牌型出现较多，对手手牌中三带对和炸弹的可能性可能下降。");
    }

    // 4. 三带对频繁出现，则顺子结构被破坏
    if (playTypeCounts.triple_with_pair >= 3) {
      strategicInsights.push("三带对牌型频繁出现，对手手牌中顺子结构可能已被破坏。");
    }

    // 5. 5和10的特殊性
    const fivesPlayed = history.filter(r => r.cards.some(c => c.rank === Rank.FIVE)).length;
    const tensPlayed = history.filter(r => r.cards.some(c => c.rank === Rank.TEN)).length;

    if (fivesPlayed >= 2 && tensPlayed >= 2) {
      warnings.push("场上已打出多张5和10，本局出现长顺子的可能性较低，请注意。");
    }

    // 6. 红心级牌的出现
    const redLevelCardsPlayed = history.filter(r => r.cards.some(c => c.isWildCard)).length;
    if (redLevelCardsPlayed === 0 && history.length > 10) { // 游戏进行到一定阶段仍未出现红心级牌
      warnings.push("红心级牌迟迟未出现，对手可能持有同花顺或大炸弹，需警惕。");
    }

    // 7. 10张报牌时的牌型推测
    // 假设我们能获取到每个玩家的剩余牌数，这里简化处理，只根据总牌数判断游戏阶段
    const totalPlayedCards = history.reduce((sum, record) => sum + record.cards.length, 0);
    const remainingTotalCards = GAME_CONSTANTS.TOTAL_CARDS - totalPlayedCards;

    if (remainingTotalCards <= 40 && remainingTotalCards > 20) { // 粗略估计10张报牌阶段
      strategicInsights.push("游戏进入中后期，有玩家可能已报牌（剩余10张左右），请留意对手牌型变化。");
    }

    // 8. 根据出牌路数推断手牌结构
    // 3带2推牌出3个7带2，说明手上没有小顺子，出大顺子如10JQKA，则手中没有大的3带2。
    const lastThreeWithTwo = history.findLast(r => r.type === 'triple_with_pair');
    if (lastThreeWithTwo && lastThreeWithTwo.cards.some(c => c.rank === Rank.SEVEN)) {
      strategicInsights.push("有玩家打出三带二（带7），可能暗示其手中缺少小顺子。");
    }
    const lastStraight = history.findLast(r => r.type === 'straight');
    if (lastStraight && lastStraight.cards.some(c => c.rank === Rank.TEN)) {
      strategicInsights.push("有玩家打出大顺子，可能暗示其手中缺少大的三带二。");
    }

    // 9. 小牌顺牌
    const lastSingleOrPair = history.findLast(r => r.type === 'single' || r.type === 'pair');
    if (lastSingleOrPair && lastSingleOrPair.cards.every(c => getCardValue(c) <= Rank.FOUR)) {
      strategicInsights.push("有玩家出小单/对，如果上家也跟小牌，可考虑不接，让对家有机会顺牌走。");
    }

    // 10. 封顶对手
    const lastPlay = history.length > 0 ? history[history.length - 1] : null;
    if (lastPlay && (lastPlay.type === 'triple_with_pair' || lastPlay.type === 'straight')) {
      strategicInsights.push(`上家出了${RANK_DISPLAY_NAMES[lastPlay.cards[0].rank]}${lastPlay.type === 'triple_with_pair' ? '三带二' : '顺子'}，若手中有${RANK_DISPLAY_NAMES[Rank.ACE]}三张或${RANK_DISPLAY_NAMES[Rank.TEN]}${RANK_DISPLAY_NAMES[Rank.JACK]}${RANK_DISPLAY_NAMES[Rank.QUEEN]}${RANK_DISPLAY_NAMES[Rank.KING]}${RANK_DISPLAY_NAMES[Rank.ACE]}顺子，可考虑封顶。`);
    }

    return { warnings, strategicInsights };
  }

  private getGamePhase(remainingCardsCount: number): AIAnalysisResult['gamePhase'] {
    const totalCards = GAME_CONSTANTS.TOTAL_CARDS;
    const playedPercentage = (totalCards - remainingCardsCount) / totalCards;

    if (playedPercentage < 0.3) return 'early';
    if (playedPercentage < 0.7) return 'middle';
    return 'late';
  }
}

// 兼容旧的getAIAdvice，但建议迁移到GuandanAIReasoningEngine类
export const getAIAdvice = (gameState: GameState): string => {
  const engine = new GuandanAIReasoningEngine(gameState.currentRank);
  engine.updateGameData(gameState.playHistory, gameState.currentRank, gameState);
  const analysis = engine.performFullAnalysis();
  return analysis.suggestions.reasoning;
};