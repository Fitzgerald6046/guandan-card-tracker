/**
 * 掼蛋级牌控制力分析Hook
 * 计算队伍级牌控制力、配牌分布，提供战术建议
 */

import { useMemo, useCallback } from 'react';
import type { 
  Card, 
  GameRank, 
  PlayerPosition, 
  Suit,
  Team 
} from '../types/game';
import { PlayerPosition as Pos } from '../types/game';
import { isRankCard, isWildCard, isJoker, getRankName } from '../utils/rankUtils';
import { TEAM_CONFIG } from '../utils/constants';
import type { UseGameStateReturn } from './useGameState';

// ==================== 类型定义 ====================

/** 级牌控制力分析结果 */
interface RankControlAnalysis {
  /** 总级牌数 */
  totalRankCards: number;
  /** 总配牌数 */
  totalWildCards: number;
  /** 各队伍级牌控制力 */
  teamControl: Record<Team, {
    rankCards: number;
    wildCards: number;
    controlRatio: number;  // 控制力比例 (0-1)
    advantage: number;     // 优势评分
  }>;
  /** 各玩家控制力 */
  playerControl: Record<PlayerPosition, {
    rankCards: number;
    wildCards: number;
    controlPower: number;  // 控制力评分
  }>;
  /** 控制力优势队伍 */
  dominantTeam: Team | null;
  /** 控制力差距 */
  controlGap: number;
}

/** 配牌分布分析结果 */
interface WildCardDistribution {
  /** 总配牌数 */
  total: number;
  /** 已分配配牌数 */
  assigned: number;
  /** 未分配配牌数 */
  unassigned: number;
  /** 各队伍配牌分布 */
  byTeam: Record<Team, {
    count: number;
    ratio: number;      // 占总配牌比例
    players: Record<PlayerPosition, number>;
  }>;
  /** 配牌集中度 (0-1, 越高越集中) */
  concentration: number;
  /** 是否存在配牌垄断 */
  hasMonopoly: boolean;
  /** 垄断队伍 */
  monopolyTeam: Team | null;
}

/** 战术建议 */
interface TacticalAdvice {
  /** 建议类型 */
  type: 'offensive' | 'defensive' | 'balanced' | 'desperate';
  /** 建议标题 */
  title: string;
  /** 建议描述 */
  description: string;
  /** 优先级 (1-5) */
  priority: number;
  /** 针对队伍 */
  targetTeam: Team;
  /** 关键行动 */
  keyActions: string[];
}

/** 关键牌分析 */
interface KeyCardsAnalysis {
  /** 王牌分布 */
  jokers: {
    total: number;
    byTeam: Record<Team, number>;
    advantage: Team | null;
  };
  /** 级牌缺失分析 */
  missingRankCards: {
    suits: string[];
    impact: 'low' | 'medium' | 'high';
  };
  /** 配牌优势 */
  wildCardAdvantage: {
    team: Team | null;
    ratio: number;
  };
}

/** Hook返回类型 */
interface UseRankLogicReturn {
  /** 级牌控制力分析 */
  rankControl: RankControlAnalysis;
  /** 配牌分布分析 */
  wildCardDistribution: WildCardDistribution;
  /** 战术建议 */
  tacticalAdvice: TacticalAdvice[];
  /** 关键牌分析 */
  keyCards: KeyCardsAnalysis;
  /** 刷新分析 */
  refreshAnalysis: () => void;
  /** 获取队伍优势评分 */
  getTeamAdvantageScore: (team: Team) => number;
  /** 获取最佳出牌建议 */
  getBestPlayAdvice: (playerPosition: PlayerPosition) => string[];
}

// ==================== 分析函数 ====================

/**
 * 分析级牌控制力
 */
function analyzeRankControl(
  cards: Card[],
  cardOwnership: Record<string, PlayerPosition>,
  currentRank: GameRank
): RankControlAnalysis {
  const rankCards = cards.filter(card => isRankCard(card, currentRank));
  const wildCards = cards.filter(card => isWildCard(card, currentRank));
  
  // 初始化统计
  const teamStats: Record<Team, { rankCards: number; wildCards: number }> = {
    1: { rankCards: 0, wildCards: 0 },
    2: { rankCards: 0, wildCards: 0 }
  };
  
  const playerStats: Record<PlayerPosition, { rankCards: number; wildCards: number }> = {
    [Pos.BOTTOM]: { rankCards: 0, wildCards: 0 },
    [Pos.LEFT]: { rankCards: 0, wildCards: 0 },
    [Pos.TOP]: { rankCards: 0, wildCards: 0 },
    [Pos.RIGHT]: { rankCards: 0, wildCards: 0 }
  };
  
  // 统计级牌和配牌
  [...rankCards, ...wildCards].forEach(card => {
    const owner = cardOwnership[card.id];
    if (!owner) return;
    
    const team = TEAM_CONFIG.POSITION_TO_TEAM[owner];
    
    if (isWildCard(card, currentRank)) {
      teamStats[team].wildCards++;
      playerStats[owner].wildCards++;
    } else {
      teamStats[team].rankCards++;
      playerStats[owner].rankCards++;
    }
  });
  
  // 计算控制力
  const totalRankCards = rankCards.length;
  const totalWildCards = wildCards.length;
  const totalControl = totalRankCards + totalWildCards * 2; // 配牌权重为2
  
  const teamControl: RankControlAnalysis['teamControl'] = {
    1: { rankCards: 0, wildCards: 0, controlRatio: 0, advantage: 0 },
    2: { rankCards: 0, wildCards: 0, controlRatio: 0, advantage: 0 }
  };
  let dominantTeam: Team | null = null;
  let maxAdvantage = 0;
  
  ([1, 2] as Team[]).forEach(team => {
    const rankCount = teamStats[team].rankCards;
    const wildCount = teamStats[team].wildCards;
    const advantage = rankCount + wildCount * 2;
    const controlRatio = totalControl > 0 ? advantage / totalControl : 0;
    
    teamControl[team] = {
      rankCards: rankCount,
      wildCards: wildCount,
      controlRatio,
      advantage
    };
    
    if (advantage > maxAdvantage) {
      maxAdvantage = advantage;
      dominantTeam = team;
    }
  });
  
  const playerControl: RankControlAnalysis['playerControl'] = {
    bottom: { rankCards: 0, wildCards: 0, controlPower: 0 },
    left: { rankCards: 0, wildCards: 0, controlPower: 0 },
    top: { rankCards: 0, wildCards: 0, controlPower: 0 },
    right: { rankCards: 0, wildCards: 0, controlPower: 0 }
  };
  Object.keys(playerStats).forEach(pos => {
    const position = pos as PlayerPosition;
    const stats = playerStats[position];
    playerControl[position] = {
      ...stats,
      controlPower: stats.rankCards + stats.wildCards * 2
    };
  });
  
  // 计算控制力差距
  const team1Advantage = teamControl[1].advantage;
  const team2Advantage = teamControl[2].advantage;
  const controlGap = Math.abs(team1Advantage - team2Advantage);
  
  return {
    totalRankCards,
    totalWildCards,
    teamControl,
    playerControl,
    dominantTeam,
    controlGap
  };
}

/**
 * 分析配牌分布
 */
function analyzeWildCardDistribution(
  cards: Card[],
  cardOwnership: Record<string, PlayerPosition>,
  currentRank: GameRank
): WildCardDistribution {
  const wildCards = cards.filter(card => isWildCard(card, currentRank));
  const total = wildCards.length;
  
  // 统计分配情况
  let assigned = 0;
  const teamCounts: Record<Team, number> = { 1: 0, 2: 0 };
  const teamPlayers: Record<Team, Record<PlayerPosition, number>> = {
    1: { [Pos.BOTTOM]: 0, [Pos.LEFT]: 0, [Pos.TOP]: 0, [Pos.RIGHT]: 0 },
    2: { [Pos.BOTTOM]: 0, [Pos.LEFT]: 0, [Pos.TOP]: 0, [Pos.RIGHT]: 0 }
  };
  
  wildCards.forEach(card => {
    const owner = cardOwnership[card.id];
    if (owner) {
      assigned++;
      const team = TEAM_CONFIG.POSITION_TO_TEAM[owner];
      teamCounts[team]++;
      teamPlayers[team][owner]++;
    }
  });
  
  const unassigned = total - assigned;
  
  // 构建分布结果
  const byTeam: WildCardDistribution['byTeam'] = {
    1: { count: 0, ratio: 0, players: teamPlayers[1] },
    2: { count: 0, ratio: 0, players: teamPlayers[2] }
  };
  ([1, 2] as Team[]).forEach(team => {
    byTeam[team] = {
      count: teamCounts[team],
      ratio: total > 0 ? teamCounts[team] / total : 0,
      players: teamPlayers[team]
    };
  });
  
  // 计算集中度 (使用基尼系数概念)
  const distribution = Object.values(teamPlayers).flat().map(record => Object.values(record).reduce((sum, count) => sum + count, 0));
  const totalAssigned = distribution.reduce((sum, count) => sum + count, 0);
  let concentration = 0;
  
  if (totalAssigned > 0) {
    const meanCount = totalAssigned / distribution.length;
    const variance = distribution.reduce((sum, count) => sum + Math.pow(count - meanCount, 2), 0) / distribution.length;
    concentration = Math.min(1, variance / (meanCount * meanCount + 1));
  }
  
  // 检查垄断情况 (一个队伍拥有超过80%的配牌)
  let hasMonopoly = false;
  let monopolyTeam: Team | null = null;
  
  ([1, 2] as Team[]).forEach(team => {
    if (byTeam[team].ratio >= 0.8) {
      hasMonopoly = true;
      monopolyTeam = team;
    }
  });
  
  return {
    total,
    assigned,
    unassigned,
    byTeam,
    concentration,
    hasMonopoly,
    monopolyTeam
  };
}

/**
 * 分析关键牌
 */
function analyzeKeyCards(
  cards: Card[],
  cardOwnership: Record<string, PlayerPosition>,
  currentRank: GameRank
): KeyCardsAnalysis {
  // 王牌分析
  const jokers = cards.filter(card => isJoker(card));
  const jokerTeamCounts: Record<Team, number> = { 1: 0, 2: 0 };
  
  jokers.forEach(card => {
    const owner = cardOwnership[card.id];
    if (owner) {
      const team = TEAM_CONFIG.POSITION_TO_TEAM[owner];
      jokerTeamCounts[team]++;
    }
  });
  
  const jokerAdvantage = jokerTeamCounts[1] > jokerTeamCounts[2] ? 1 : 
                       jokerTeamCounts[2] > jokerTeamCounts[1] ? 2 : null;
  
  // 级牌缺失分析
  const rankCards = cards.filter(card => isRankCard(card, currentRank));
  const presentSuits = new Set<Suit>(
    rankCards
      .map(card => card.suit)
      .filter((suit): suit is Suit => suit !== null)
  );
  const allSuits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const missingSuits = allSuits.filter(suit => !presentSuits.has(suit));
  
  const missingImpact = missingSuits.length === 0 ? 'low' :
                       missingSuits.length <= 1 ? 'medium' : 'high';
  
  // 配牌优势
  const wildCards = cards.filter(card => isWildCard(card, currentRank));
  const wildTeamCounts: Record<Team, number> = { 1: 0, 2: 0 };
  
  wildCards.forEach(card => {
    const owner = cardOwnership[card.id];
    if (owner) {
      const team = TEAM_CONFIG.POSITION_TO_TEAM[owner];
      wildTeamCounts[team]++;
    }
  });
  
  const wildAdvantageTeam = wildTeamCounts[1] > wildTeamCounts[2] ? 1 :
                          wildTeamCounts[2] > wildTeamCounts[1] ? 2 : null;
  const wildAdvantageRatio = wildAdvantageTeam ? 
    wildTeamCounts[wildAdvantageTeam] / Math.max(1, wildCards.length) : 0;
  
  return {
    jokers: {
      total: jokers.length,
      byTeam: jokerTeamCounts,
      advantage: jokerAdvantage
    },
    missingRankCards: {
      suits: missingSuits,
      impact: missingImpact
    },
    wildCardAdvantage: {
      team: wildAdvantageTeam,
      ratio: wildAdvantageRatio
    }
  };
}

/**
 * 生成战术建议
 */
function generateTacticalAdvice(
  rankControl: RankControlAnalysis,
  wildDistribution: WildCardDistribution,
  keyCards: KeyCardsAnalysis,
  currentRank: GameRank
): TacticalAdvice[] {
  const advice: TacticalAdvice[] = [];
  const rankName = getRankName(currentRank);
  
  // 配牌优势建议
  if (wildDistribution.hasMonopoly && wildDistribution.monopolyTeam) {
    advice.push({
      type: 'offensive',
      title: '配牌垄断优势',
      description: `队伍${wildDistribution.monopolyTeam}垄断了配牌，应积极进攻控制节奏`,
      priority: 5,
      targetTeam: wildDistribution.monopolyTeam,
      keyActions: [
        '优先出配牌控制节奏',
        '配合级牌形成连续进攻',
        '防止对方反制'
      ]
    });
  }
  
  // 级牌控制力建议
  if (rankControl.dominantTeam && rankControl.controlGap > 3) {
    const isOffensive = rankControl.controlGap > 5;
    advice.push({
      type: isOffensive ? 'offensive' : 'balanced',
      title: '级牌控制优势',
      description: `队伍${rankControl.dominantTeam}在级牌控制上有明显优势`,
      priority: 4,
      targetTeam: rankControl.dominantTeam,
      keyActions: [
        `合理使用${rankName}牌`,
        '配合队友形成牌型优势',
        '控制出牌节奏'
      ]
    });
  }
  
  // 王牌优势建议
  if (keyCards.jokers.advantage) {
    advice.push({
      type: 'balanced',
      title: '王牌优势',
      description: `队伍${keyCards.jokers.advantage}在王牌数量上有优势`,
      priority: 3,
      targetTeam: keyCards.jokers.advantage,
      keyActions: [
        '适时使用王牌破局',
        '保护王牌到关键时刻',
        '配合其他大牌使用'
      ]
    });
  }
  
  // 劣势队伍防守建议
  const weakerTeam: Team = rankControl.dominantTeam === 1 ? 2 : 1;
  if (rankControl.controlGap > 2) {
    advice.push({
      type: 'defensive',
      title: '防守反制策略',
      description: `队伍${weakerTeam}应采取防守反制策略`,
      priority: 3,
      targetTeam: weakerTeam,
      keyActions: [
        '保存实力等待机会',
        '干扰对方节奏',
        '寻找反击时机'
      ]
    });
  }
  
  // 配牌分散建议
  if (wildDistribution.concentration > 0.6) {
    advice.push({
      type: 'balanced',
      title: '配牌集中风险',
      description: '配牌过于集中，需要注意风险控制',
      priority: 2,
      targetTeam: wildDistribution.monopolyTeam || 1,
      keyActions: [
        '避免配牌浪费',
        '合理分配使用时机',
        '防止被针对'
      ]
    });
  }
  
  return advice.sort((a, b) => b.priority - a.priority);
}

// ==================== Hook主函数 ====================

export function useRankLogic(gameState: UseGameStateReturn): UseRankLogicReturn {
  const { cards, cardOwnership, currentRank } = gameState;
  
  // 级牌控制力分析
  const rankControl = useMemo(() => 
    analyzeRankControl(cards, cardOwnership, currentRank),
    [cards, cardOwnership, currentRank]
  );
  
  // 配牌分布分析
  const wildCardDistribution = useMemo(() =>
    analyzeWildCardDistribution(cards, cardOwnership, currentRank),
    [cards, cardOwnership, currentRank]
  );
  
  // 关键牌分析
  const keyCards = useMemo(() =>
    analyzeKeyCards(cards, cardOwnership, currentRank),
    [cards, cardOwnership, currentRank]
  );
  
  // 战术建议
  const tacticalAdvice = useMemo(() =>
    generateTacticalAdvice(rankControl, wildCardDistribution, keyCards, currentRank),
    [rankControl, wildCardDistribution, keyCards, currentRank]
  );
  
  // 刷新分析
  const refreshAnalysis = useCallback(() => {
    // 触发重新分析（通过清除缓存）
    gameState.clearStatsCache();
  }, [gameState]);
  
  // 获取队伍优势评分
  const getTeamAdvantageScore = useCallback((team: Team): number => {
    const control = rankControl.teamControl[team];
    const jokers = keyCards.jokers.byTeam[team];
    
    // 综合评分：配牌*3 + 级牌*2 + 王牌*1
    return control.wildCards * 3 + control.rankCards * 2 + jokers;
  }, [rankControl, keyCards]);
  
  // 获取最佳出牌建议
  const getBestPlayAdvice = useCallback((playerPosition: PlayerPosition): string[] => {
    const team = TEAM_CONFIG.POSITION_TO_TEAM[playerPosition];
    const playerCards = gameState.getPlayerCards(playerPosition);
    const advice: string[] = [];
    
    // 基于玩家手牌给出建议
    const playerWildCards = playerCards.filter(card => isWildCard(card, currentRank));
    const playerRankCards = playerCards.filter(card => isRankCard(card, currentRank) && !isWildCard(card, currentRank));
    const playerJokers = playerCards.filter(card => isJoker(card));
    
    if (playerWildCards.length > 0) {
      advice.push(`拥有${playerWildCards.length}张配牌，可考虑主动出击`);
    }
    
    if (playerRankCards.length > 0) {
      advice.push(`拥有${playerRankCards.length}张级牌，注意配合使用`);
    }
    
    if (playerJokers.length > 0) {
      advice.push(`拥有${playerJokers.length}张王牌，关键时刻使用`);
    }
    
    // 基于队伍整体情况给出建议
    const teamAdvantage = getTeamAdvantageScore(team);
    const opponentTeam: Team = team === 1 ? 2 : 1;
    const opponentAdvantage = getTeamAdvantageScore(opponentTeam);
    
    if (teamAdvantage > opponentAdvantage + 2) {
      advice.push('队伍有优势，可以积极进攻');
    } else if (teamAdvantage < opponentAdvantage - 2) {
      advice.push('处于劣势，建议保守打法');
    } else {
      advice.push('双方实力相当，灵活应对');
    }
    
    return advice.length > 0 ? advice : ['根据场上情况灵活出牌'];
  }, [gameState, currentRank, getTeamAdvantageScore]);
  
  return {
    rankControl,
    wildCardDistribution,
    tacticalAdvice,
    keyCards,
    refreshAnalysis,
    getTeamAdvantageScore,
    getBestPlayAdvice
  };
}

export default useRankLogic;
export type { 
  RankControlAnalysis, 
  WildCardDistribution, 
  TacticalAdvice, 
  KeyCardsAnalysis,
  UseRankLogicReturn 
};
