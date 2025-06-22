/**
 * 掼蛋游戏分析工具
 * 计算关键牌分布、出牌可能性，生成游戏报告
 */

import type { 
  Card, 
  GameRank, 
  PlayerPosition, 
  Team,
  Suit,
  Rank
} from '../types/game';
import { PlayerPosition as Pos } from '../types/game';
import { 
  isRankCard, 
  isWildCard, 
  isJoker, 
  getRankName,
  getCardOrderValue 
} from './rankUtils';
import { TEAM_CONFIG, RANK_DISPLAY_NAMES, SUIT_SYMBOLS } from './constants';

// ==================== 类型定义 ====================

/** 关键牌类型 */
type CriticalCardType = 'wild' | 'rank' | 'joker' | 'bomb' | 'straight';

/** 关键牌信息 */
interface CriticalCard {
  type: CriticalCardType;
  cards: Card[];
  importance: number;    // 重要性评分 (1-10)
  rarity: number;       // 稀有度 (0-1)
  description: string;
}

/** 牌型分析结果 */
interface CardPatternAnalysis {
  /** 炸弹可能性 */
  bombPotential: {
    rank: GameRank;
    count: number;
    probability: number;
    missingCards: number;
  }[];
  
  /** 顺子可能性 */
  straightPotential: {
    startRank: GameRank;
    length: number;
    probability: number;
    missingCards: Card[];
  }[];
  
  /** 同花顺可能性 */
  flushStraightPotential: {
    suit: Suit;
    startRank: GameRank;
    length: number;
    probability: number;
  }[];
}

/** 出牌概率分析 */
interface PlayProbabilityAnalysis {
  /** 各玩家出牌概率 */
  playerProbabilities: Record<PlayerPosition, {
    /** 主动出牌概率 */
    initiativeProbability: number;
    /** 跟牌概率 */
    followProbability: number;
    /** 过牌概率 */
    passProbability: number;
    /** 预期强度 */
    expectedStrength: number;
  }>;
  
  /** 下一手牌预测 */
  nextPlayPrediction: {
    mostLikelyPlayer: PlayerPosition;
    predictedCardType: CriticalCardType;
    confidence: number;
  };
}

/** 游戏报告 */
interface GameReport {
  /** 报告生成时间 */
  timestamp: number;
  /** 当前级数 */
  currentRank: GameRank;
  /** 游戏进度 (0-1) */
  gameProgress: number;
  
  /** 关键牌分析 */
  criticalCards: CriticalCard[];
  /** 牌型分析 */
  patterns: CardPatternAnalysis;
  /** 出牌概率 */
  playProbabilities: PlayProbabilityAnalysis;
  
  /** 队伍状态评估 */
  teamStatus: Record<Team, {
    strength: number;      // 实力评分 (0-100)
    position: 'advantage' | 'balanced' | 'disadvantage';
    keyAdvantages: string[];
    weaknesses: string[];
    winProbability: number; // 胜率预测 (0-1)
  }>;
  
  /** 关键决策点 */
  keyDecisionPoints: {
    description: string;
    impact: 'high' | 'medium' | 'low';
    suggestion: string;
  }[];
  
  /** 总体评估 */
  overallAssessment: {
    gamePhase: 'early' | 'middle' | 'late' | 'endgame';
    dominantTeam: Team | null;
    riskLevel: 'low' | 'medium' | 'high';
    strategicFocus: string[];
  };
}

/** 卡牌统计信息 */
interface CardStatistics {
  totalCards: number;
  assignedCards: number;
  unassignedCards: number;
  
  byType: {
    wildCards: number;
    rankCards: number;
    jokers: number;
    normalCards: number;
  };
  
  bySuit: Record<Suit | 'joker', number>;
  byRank: Record<GameRank, number>;
  
  distribution: {
    evenness: number;      // 分布均匀度 (0-1)
    concentration: number; // 集中度 (0-1)
    entropy: number;       // 信息熵
  };
}

// ==================== 分析函数 ====================

/**
 * 计算卡牌统计信息
 */
export function calculateCardStatistics(
  cards: Card[],
  cardOwnership: Record<string, PlayerPosition>,
  currentRank: GameRank
): CardStatistics {
  const totalCards = cards.length;
  const assignedCards = Object.keys(cardOwnership).length;
  const unassignedCards = totalCards - assignedCards;
  
  // 按类型统计
  const byType = {
    wildCards: cards.filter(card => isWildCard(card, currentRank)).length,
    rankCards: cards.filter(card => isRankCard(card, currentRank) && !isWildCard(card, currentRank)).length,
    jokers: cards.filter(card => isJoker(card)).length,
    normalCards: 0
  };
  byType.normalCards = totalCards - byType.wildCards - byType.rankCards - byType.jokers;
  
  // 按花色统计
  const bySuit: Record<Suit | 'joker', number> = {
    spades: 0,
    hearts: 0,
    diamonds: 0,
    clubs: 0,
    joker: 0
  };
  
  cards.forEach(card => {
    if (card.suit) {
      bySuit[card.suit]++;
    } else {
      bySuit.joker++;
    }
  });
  
  // 按牌面统计
  const byRank: Record<GameRank, number> = {} as any;
  for (let rank = 2; rank <= 14; rank++) {
    byRank[rank as GameRank] = cards.filter(card => card.rank === rank).length;
  }
  
  // 计算分布特征
  const playerCounts = [Pos.BOTTOM, Pos.LEFT, Pos.TOP, Pos.RIGHT].map(pos => 
    cards.filter(card => cardOwnership[card.id] === pos).length
  );
  
  const totalAssigned = playerCounts.reduce((sum, count) => sum + count, 0);
  const meanCount = totalAssigned / 4;
  
  // 均匀度 (1 - 变异系数)
  const variance = playerCounts.reduce((sum, count) => sum + Math.pow(count - meanCount, 2), 0) / 4;
  const evenness = meanCount > 0 ? Math.max(0, 1 - Math.sqrt(variance) / meanCount) : 1;
  
  // 集中度 (最大值与平均值的比)
  const maxCount = Math.max(...playerCounts);
  const concentration = meanCount > 0 ? maxCount / (meanCount * 4) : 0;
  
  // 信息熵
  const probabilities = playerCounts.map(count => totalAssigned > 0 ? count / totalAssigned : 0);
  const entropy = -probabilities.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0);
  
  return {
    totalCards,
    assignedCards,
    unassignedCards,
    byType,
    bySuit,
    byRank,
    distribution: {
      evenness,
      concentration,
      entropy
    }
  };
}

/**
 * 分析关键牌分布
 */
export function analyzeCriticalCards(
  cards: Card[],
  cardOwnership: Record<string, PlayerPosition>,
  currentRank: GameRank
): CriticalCard[] {
  const criticalCards: CriticalCard[] = [];
  
  // 配牌分析
  const wildCards = cards.filter(card => isWildCard(card, currentRank));
  if (wildCards.length > 0) {
    criticalCards.push({
      type: 'wild',
      cards: wildCards,
      importance: 10,
      rarity: wildCards.length / cards.length,
      description: `${wildCards.length}张配牌(红心${getRankName(currentRank)})`
    });
  }
  
  // 级牌分析
  const rankCards = cards.filter(card => isRankCard(card, currentRank) && !isWildCard(card, currentRank));
  if (rankCards.length > 0) {
    criticalCards.push({
      type: 'rank',
      cards: rankCards,
      importance: 8,
      rarity: rankCards.length / cards.length,
      description: `${rankCards.length}张级牌(${getRankName(currentRank)})`
    });
  }
  
  // 王牌分析
  const jokers = cards.filter(card => isJoker(card));
  if (jokers.length > 0) {
    criticalCards.push({
      type: 'joker',
      cards: jokers,
      importance: 9,
      rarity: jokers.length / cards.length,
      description: `${jokers.length}张王牌`
    });
  }
  
  // 炸弹潜力分析
  const rankGroups: Record<GameRank, Card[]> = {} as any;
  cards.forEach(card => {
    if (card.rank >= 2 && card.rank <= 14) {
      if (!rankGroups[card.rank as GameRank]) {
        rankGroups[card.rank as GameRank] = [];
      }
      rankGroups[card.rank as GameRank].push(card);
    }
  });
  
  Object.entries(rankGroups).forEach(([rank, groupCards]) => {
    const rankNum = parseInt(rank) as GameRank;
    if (groupCards.length >= 3) {
      const importance = groupCards.length === 4 ? 10 : 
                        groupCards.length === 3 ? 7 : 5;
      
      criticalCards.push({
        type: 'bomb',
        cards: groupCards,
        importance,
        rarity: 1 / Object.keys(rankGroups).length,
        description: `${groupCards.length}张${getRankName(rankNum)}(炸弹潜力)`
      });
    }
  });
  
  return criticalCards.sort((a, b) => b.importance - a.importance);
}

/**
 * 分析牌型可能性
 */
export function analyzeCardPatterns(
  cards: Card[],
  cardOwnership: Record<string, PlayerPosition>,
  currentRank: GameRank
): CardPatternAnalysis {
  // 炸弹可能性分析
  const bombPotential: CardPatternAnalysis['bombPotential'] = [];
  const rankCounts: Record<GameRank, number> = {} as any;
  
  cards.forEach(card => {
    if (card.rank >= 2 && card.rank <= 14) {
      const rank = card.rank as GameRank;
      rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    }
  });
  
  Object.entries(rankCounts).forEach(([rank, count]) => {
    const rankNum = parseInt(rank) as GameRank;
    if (count >= 2) {
      const missingCards = 4 - count;
      const probability = count === 4 ? 1 : count === 3 ? 0.8 : 0.4;
      
      bombPotential.push({
        rank: rankNum,
        count,
        probability,
        missingCards
      });
    }
  });
  
  // 顺子可能性分析 (简化版)
  const straightPotential: CardPatternAnalysis['straightPotential'] = [];
  const availableRanks = Object.keys(rankCounts).map(Number).sort((a, b) => a - b);
  
  for (let start = 0; start < availableRanks.length - 2; start++) {
    let length = 1;
    const missingCards: Card[] = [];
    
    for (let i = start + 1; i < availableRanks.length; i++) {
      if (availableRanks[i] === availableRanks[i - 1] + 1) {
        length++;
      } else {
        break;
      }
    }
    
    if (length >= 3) {
      const probability = Math.pow(0.8, missingCards.length);
      straightPotential.push({
        startRank: availableRanks[start] as GameRank,
        length,
        probability,
        missingCards
      });
    }
  }
  
  // 同花顺可能性 (简化版)
  const flushStraightPotential: CardPatternAnalysis['flushStraightPotential'] = [];
  const suitCards: Record<Suit, Card[]> = {
    spades: [],
    hearts: [],
    diamonds: [],
    clubs: []
  };
  
  cards.forEach(card => {
    if (card.suit) {
      suitCards[card.suit].push(card);
    }
  });
  
  Object.entries(suitCards).forEach(([suit, suitCardList]) => {
    if (suitCardList.length >= 3) {
      const sortedRanks = suitCardList
        .map(card => card.rank)
        .filter(rank => rank >= 2 && rank <= 14)
        .sort((a, b) => a - b);
      
      for (let i = 0; i < sortedRanks.length - 2; i++) {
        let length = 1;
        for (let j = i + 1; j < sortedRanks.length; j++) {
          if (sortedRanks[j] === sortedRanks[j - 1] + 1) {
            length++;
          } else {
            break;
          }
        }
        
        if (length >= 3) {
          flushStraightPotential.push({
            suit: suit as Suit,
            startRank: sortedRanks[i] as GameRank,
            length,
            probability: 0.6
          });
        }
      }
    }
  });
  
  return {
    bombPotential: bombPotential.sort((a, b) => b.probability - a.probability),
    straightPotential: straightPotential.sort((a, b) => b.probability - a.probability),
    flushStraightPotential: flushStraightPotential.sort((a, b) => b.probability - a.probability)
  };
}

/**
 * 分析出牌概率
 */
export function analyzePlayProbabilities(
  cards: Card[],
  cardOwnership: Record<string, PlayerPosition>,
  currentRank: GameRank,
  gameStats: any
): PlayProbabilityAnalysis {
  const playerProbabilities: PlayProbabilityAnalysis['playerProbabilities'] = {} as any;
  
  // 分析每个玩家的出牌概率
  [Pos.BOTTOM, Pos.LEFT, Pos.TOP, Pos.RIGHT].forEach(position => {
    const playerCards = cards.filter(card => cardOwnership[card.id] === position);
    const cardCount = playerCards.length;
    
    // 计算牌力强度
    const wildCards = playerCards.filter(card => isWildCard(card, currentRank)).length;
    const rankCards = playerCards.filter(card => isRankCard(card, currentRank)).length;
    const jokers = playerCards.filter(card => isJoker(card)).length;
    
    const strength = wildCards * 3 + rankCards * 2 + jokers * 1.5;
    const normalizedStrength = Math.min(1, strength / 20);
    
    // 基于牌力和牌数计算概率
    const initiativeProbability = Math.min(0.9, normalizedStrength * (cardCount > 0 ? 1 : 0));
    const followProbability = Math.min(0.8, normalizedStrength * 0.8 + (cardCount / 27) * 0.3);
    const passProbability = Math.max(0.1, 1 - initiativeProbability * 0.7);
    
    playerProbabilities[position] = {
      initiativeProbability,
      followProbability,
      passProbability,
      expectedStrength: normalizedStrength
    };
  });
  
  // 预测下一手牌
  const playerStrengths = Object.entries(playerProbabilities).map(([pos, prob]) => ({
    position: pos as PlayerPosition,
    strength: prob.expectedStrength * prob.initiativeProbability
  }));
  
  playerStrengths.sort((a, b) => b.strength - a.strength);
  
  const nextPlayPrediction = {
    mostLikelyPlayer: playerStrengths[0].position,
    predictedCardType: playerStrengths[0].strength > 0.7 ? 'wild' as CriticalCardType : 
                      playerStrengths[0].strength > 0.5 ? 'rank' as CriticalCardType : 'bomb' as CriticalCardType,
    confidence: playerStrengths[0].strength
  };
  
  return {
    playerProbabilities,
    nextPlayPrediction
  };
}

/**
 * 生成游戏报告
 */
export function generateGameReport(
  cards: Card[],
  cardOwnership: Record<string, PlayerPosition>,
  currentRank: GameRank,
  gameStats: any
): GameReport {
  const timestamp = Date.now();
  const gameProgress = Object.keys(cardOwnership).length / cards.length;
  
  // 分析各个方面
  const criticalCards = analyzeCriticalCards(cards, cardOwnership, currentRank);
  const patterns = analyzeCardPatterns(cards, cardOwnership, currentRank);
  const playProbabilities = analyzePlayProbabilities(cards, cardOwnership, currentRank, gameStats);
  const statistics = calculateCardStatistics(cards, cardOwnership, currentRank);
  
  // 队伍状态评估
  const teamStatus: GameReport['teamStatus'] = {} as any;
  
  [1, 2].forEach(team => {
    const teamNum = team as Team;
    const teamPositions = TEAM_CONFIG.TEAM_1_POSITIONS.includes('bottom') ? 
      [Pos.BOTTOM, Pos.TOP] : [Pos.LEFT, Pos.RIGHT];
    
    const teamCards = cards.filter(card => {
      const owner = cardOwnership[card.id];
      return owner && teamPositions.includes(owner);
    });
    
    const wildCards = teamCards.filter(card => isWildCard(card, currentRank)).length;
    const rankCards = teamCards.filter(card => isRankCard(card, currentRank)).length;
    const jokers = teamCards.filter(card => isJoker(card)).length;
    
    const strength = Math.min(100, (wildCards * 15 + rankCards * 10 + jokers * 8));
    const winProbability = Math.min(0.95, Math.max(0.05, strength / 100));
    
    const keyAdvantages: string[] = [];
    const weaknesses: string[] = [];
    
    if (wildCards > 1) keyAdvantages.push(`拥有${wildCards}张配牌`);
    if (rankCards > 2) keyAdvantages.push(`拥有${rankCards}张级牌`);
    if (jokers > 0) keyAdvantages.push(`拥有${jokers}张王牌`);
    
    if (wildCards === 0) weaknesses.push('缺乏配牌');
    if (rankCards < 2) weaknesses.push('级牌不足');
    if (teamCards.length < cards.length / 4) weaknesses.push('总牌数偏少');
    
    teamStatus[teamNum] = {
      strength,
      position: strength > 60 ? 'advantage' : strength < 40 ? 'disadvantage' : 'balanced',
      keyAdvantages,
      weaknesses,
      winProbability
    };
  });
  
  // 关键决策点
  const keyDecisionPoints = [];
  
  if (gameProgress < 0.3) {
    keyDecisionPoints.push({
      description: '游戏初期，建议保存实力观察局势',
      impact: 'medium' as const,
      suggestion: '优先记录关键牌的分布情况'
    });
  } else if (gameProgress < 0.7) {
    keyDecisionPoints.push({
      description: '游戏中期，是出击或防守的关键时刻',
      impact: 'high' as const,
      suggestion: '根据牌力优势选择策略'
    });
  } else {
    keyDecisionPoints.push({
      description: '游戏后期，每一步都至关重要',
      impact: 'high' as const,
      suggestion: '精确计算剩余牌并制定最优策略'
    });
  }
  
  // 总体评估
  const team1Strength = teamStatus[1].strength;
  const team2Strength = teamStatus[2].strength;
  const dominantTeam = team1Strength > team2Strength + 10 ? 1 :
                      team2Strength > team1Strength + 10 ? 2 : null;
  
  const gamePhase = gameProgress < 0.25 ? 'early' :
                   gameProgress < 0.5 ? 'middle' :
                   gameProgress < 0.8 ? 'late' : 'endgame';
  
  const riskLevel = Math.abs(team1Strength - team2Strength) > 30 ? 'high' :
                   Math.abs(team1Strength - team2Strength) > 15 ? 'medium' : 'low';
  
  const strategicFocus = [];
  if (criticalCards.some(card => card.type === 'wild')) {
    strategicFocus.push('配牌运用');
  }
  if (patterns.bombPotential.length > 0) {
    strategicFocus.push('炸弹威胁');
  }
  if (gameProgress > 0.6) {
    strategicFocus.push('残局控制');
  }
  
  return {
    timestamp,
    currentRank,
    gameProgress,
    criticalCards,
    patterns,
    playProbabilities,
    teamStatus,
    keyDecisionPoints,
    overallAssessment: {
      gamePhase,
      dominantTeam,
      riskLevel,
      strategicFocus
    }
  };
}

/**
 * 计算胜率预测
 */
export function calculateWinProbability(
  cards: Card[],
  cardOwnership: Record<string, PlayerPosition>,
  currentRank: GameRank,
  team: Team
): number {
  const teamPositions = team === 1 ? 
    [Pos.BOTTOM, Pos.TOP] : [Pos.LEFT, Pos.RIGHT];
  
  const teamCards = cards.filter(card => {
    const owner = cardOwnership[card.id];
    return owner && teamPositions.includes(owner);
  });
  
  const wildCards = teamCards.filter(card => isWildCard(card, currentRank)).length;
  const rankCards = teamCards.filter(card => isRankCard(card, currentRank)).length;
  const jokers = teamCards.filter(card => isJoker(card)).length;
  const totalCards = teamCards.length;
  
  // 基础胜率 = 牌数比例
  const baseWinRate = totalCards / cards.length * 2; // *2 因为是两人队伍
  
  // 质量加成
  const qualityBonus = (wildCards * 0.15 + rankCards * 0.1 + jokers * 0.08);
  
  // 综合胜率
  const winProbability = Math.min(0.95, Math.max(0.05, baseWinRate + qualityBonus));
  
  return winProbability;
}

/**
 * 导出游戏数据为JSON
 */
export function exportGameData(
  cards: Card[],
  cardOwnership: Record<string, PlayerPosition>,
  currentRank: GameRank,
  gameStats: any
): string {
  const report = generateGameReport(cards, cardOwnership, currentRank, gameStats);
  const statistics = calculateCardStatistics(cards, cardOwnership, currentRank);
  
  const exportData = {
    version: '1.0',
    timestamp: Date.now(),
    game: {
      currentRank,
      totalCards: cards.length,
      assignedCards: Object.keys(cardOwnership).length
    },
    statistics,
    report,
    cards: cards.map(card => ({
      id: card.id,
      suit: card.suit,
      rank: card.rank,
      isRankCard: card.isRankCard,
      isWildCard: card.isWildCard,
      owner: cardOwnership[card.id] || null
    }))
  };
  
  return JSON.stringify(exportData, null, 2);
}

// 导出所有函数
export default {
  calculateCardStatistics,
  analyzeCriticalCards,
  analyzeCardPatterns,
  analyzePlayProbabilities,
  generateGameReport,
  calculateWinProbability,
  exportGameData
};

// 导出类型
export type {
  CriticalCard,
  CriticalCardType,
  CardPatternAnalysis,
  PlayProbabilityAnalysis,
  GameReport,
  CardStatistics
};