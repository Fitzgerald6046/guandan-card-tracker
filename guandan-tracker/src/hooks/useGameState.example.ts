/**
 * useGameState Hook 使用示例
 * 展示如何使用游戏状态管理Hook
 */

import { useGameState } from './useGameState';
import type { GameRank, PlayerPosition } from '../types/game';
import { PlayerPosition as Pos } from '../types/game';

// ==================== 基础使用示例 ====================

export function BasicUsageExample() {
  // 初始化游戏状态管理（默认级数为2）
  const gameState = useGameState(5); // 或者指定初始级数为5
  
  const {
    // 状态
    currentRank,
    nextRank,
    selectedPlayer,
    cards,
    stats,
    gameInfo
  } = gameState;

  // 基础信息展示
  console.log('=== 游戏基础信息 ===');
  console.log(`当前级数: ${gameInfo.currentRankName} (${currentRank})`);
  console.log(`下一级数: ${gameInfo.nextRankName} (${nextRank})`);
  console.log(`当前选中玩家: ${selectedPlayer}`);
  console.log(`总卡牌数: ${cards.length}`);
  console.log(`已分配卡牌: ${gameInfo.totalAssignedCards}`);
  console.log(`未分配卡牌: ${gameInfo.totalUnassignedCards}`);
  console.log(`分配完成: ${gameInfo.isComplete ? '是' : '否'}`);

  // 统计信息展示
  console.log('\n=== 统计信息 ===');
  console.log(`总级牌数: ${stats.rankCardStats.total}`);
  console.log(`总配牌数: ${stats.wildCardStats.total}`);
  console.log(`总王牌数: ${stats.jokerStats.total}`);
  
  // 各玩家统计
  console.log('\n=== 各玩家统计 ===');
  Object.entries(stats.playerCardCounts).forEach(([position, count]) => {
    const rankCards = stats.rankCardStats.byPlayer[position as PlayerPosition];
    const wildCards = stats.wildCardStats.byPlayer[position as PlayerPosition];
    const jokers = stats.jokerStats.byPlayer[position as PlayerPosition];
    
    console.log(`${position}: 总计${count}张, 级牌${rankCards}张, 配牌${wildCards}张, 王牌${jokers}张`);
  });

  // 各队伍统计
  console.log('\n=== 各队伍统计 ===');
  Object.entries(stats.teamCardCounts).forEach(([team, count]) => {
    const teamNum = Number(team) as 1 | 2;
    const rankCards = stats.rankCardStats.byTeam[teamNum];
    const wildCards = stats.wildCardStats.byTeam[teamNum];
    const jokers = stats.jokerStats.byTeam[teamNum];
    
    console.log(`队伍${team}: 总计${count}张, 级牌${rankCards}张, 配牌${wildCards}张, 王牌${jokers}张`);
  });

  return gameState;
}

// ==================== 操作示例 ====================

export function OperationExample() {
  const gameState = useGameState();
  
  const {
    setRank,
    selectPlayer,
    toggleCard,
    batchToggleCards,
    resetGame,
    updatePlayer,
    getWildCards,
    cards
  } = gameState;

  // 1. 设置级数
  console.log('\n=== 操作示例: 设置级数 ===');
  const targetRank: GameRank = 8;
  setRank(targetRank);
  console.log(`级数已设置为: ${targetRank}`);

  // 2. 选择玩家
  console.log('\n=== 操作示例: 选择玩家 ===');
  selectPlayer(Pos.LEFT);
  console.log('已选择左方玩家');

  // 3. 切换单张卡牌归属
  console.log('\n=== 操作示例: 切换卡牌归属 ===');
  if (cards.length > 0) {
    const firstCard = cards[0];
    toggleCard(firstCard.id);
    console.log(`已切换卡牌 ${firstCard.id} 的归属`);
  }

  // 4. 批量切换配牌归属
  console.log('\n=== 操作示例: 批量分配配牌 ===');
  const wildCards = getWildCards();
  if (wildCards.length > 0) {
    const wildCardIds = wildCards.map(card => card.id);
    batchToggleCards(wildCardIds);
    console.log(`已批量分配 ${wildCards.length} 张配牌给当前玩家`);
  }

  // 5. 更新玩家信息
  console.log('\n=== 操作示例: 更新玩家信息 ===');
  updatePlayer(Pos.BOTTOM, { name: '我自己' });
  console.log('已更新底部玩家名称');

  // 6. 重置游戏（保留级数）
  console.log('\n=== 操作示例: 重置游戏 ===');
  setTimeout(() => {
    resetGame(true); // 保留级数
    console.log('游戏已重置（保留级数）');
  }, 1000);

  return gameState;
}

// ==================== 选择器使用示例 ====================

export function SelectorExample() {
  const gameState = useGameState(10); // 级数10
  
  const {
    getTeamCards,
    getRankCards,
    getWildCards,
    getPlayerCards,
    getUnassignedCards,
    getCurrentPlayer,
    getTeamPlayers,
    batchToggleCards
  } = gameState;

  // 先分配一些卡牌用于演示
  const rankCards = getRankCards();
  // 给队伍1分配所有级牌
  if (rankCards.length > 0) {
    batchToggleCards(rankCards.slice(0, 4).map(card => card.id)); // 分配4张给当前玩家
  }

  console.log('\n=== 选择器使用示例 ===');

  // 1. 获取某队伍的所有卡牌
  const team1Cards = getTeamCards(1);
  const team2Cards = getTeamCards(2);
  console.log(`队伍1拥有卡牌: ${team1Cards.length}张`);
  console.log(`队伍2拥有卡牌: ${team2Cards.length}张`);

  // 2. 获取所有级牌
  const allRankCards = getRankCards();
  console.log(`所有级牌数量: ${allRankCards.length}张`);
  allRankCards.forEach(card => {
    const suitSymbol = card.suit ? 
      (card.suit === 'hearts' ? '♥' : card.suit === 'spades' ? '♠' : 
       card.suit === 'diamonds' ? '♦' : '♣') : '';
    console.log(`  - ${suitSymbol}${card.rank} ${card.isWildCard ? '[配牌]' : '[级牌]'}`);
  });

  // 3. 获取所有配牌
  const allWildCards = getWildCards();
  console.log(`\n所有配牌数量: ${allWildCards.length}张`);
  allWildCards.forEach(card => {
    console.log(`  - ♥${card.rank} [配牌]`);
  });

  // 4. 获取特定玩家的卡牌
  const bottomPlayerCards = getPlayerCards(Pos.BOTTOM);
  console.log(`\n底部玩家拥有卡牌: ${bottomPlayerCards.length}张`);

  // 5. 获取未分配的卡牌
  const unassignedCards = getUnassignedCards();
  console.log(`未分配卡牌: ${unassignedCards.length}张`);

  // 6. 获取当前玩家信息
  const currentPlayer = getCurrentPlayer();
  console.log(`\n当前玩家: ${currentPlayer.name} (${currentPlayer.position}, 队伍${currentPlayer.team})`);

  // 7. 获取队伍玩家
  const team1Players = getTeamPlayers(1);
  const team2Players = getTeamPlayers(2);
  console.log(`队伍1玩家: ${team1Players.map(p => p.name).join(', ')}`);
  console.log(`队伍2玩家: ${team2Players.map(p => p.name).join(', ')}`);

  return gameState;
}

// ==================== 高级使用示例 ====================

export function AdvancedUsageExample() {
  const gameState = useGameState();
  
  const {
    setRank,
    selectPlayer,
    batchToggleCards,
    getRankCards,
    getWildCards,
    getTeamCards,
    stats,
    gameInfo
  } = gameState;

  console.log('\n=== 高级使用示例 ===');

  // 1. 智能分配策略：优先给某队伍分配优势牌
  const smartDistribution = () => {
    console.log('\n执行智能分配策略...');
    
    // 获取所有配牌和级牌
    const wildCards = getWildCards();
    const rankCards = getRankCards().filter(card => !card.isWildCard);
    
    // 选择队伍1的第一个玩家
    selectPlayer(Pos.BOTTOM);
    
    // 分配所有配牌给队伍1
    if (wildCards.length > 0) {
      batchToggleCards(wildCards.map(card => card.id));
      console.log(`已分配 ${wildCards.length} 张配牌给队伍1`);
    }
    
    // 分配一半级牌给队伍1
    const halfRankCards = rankCards.slice(0, Math.ceil(rankCards.length / 2));
    if (halfRankCards.length > 0) {
      batchToggleCards(halfRankCards.map(card => card.id));
      console.log(`已分配 ${halfRankCards.length} 张级牌给队伍1`);
    }
    
    // 选择队伍2的第一个玩家
    selectPlayer(Pos.LEFT);
    
    // 分配剩余级牌给队伍2
    const remainingRankCards = rankCards.slice(Math.ceil(rankCards.length / 2));
    if (remainingRankCards.length > 0) {
      batchToggleCards(remainingRankCards.map(card => card.id));
      console.log(`已分配 ${remainingRankCards.length} 张级牌给队伍2`);
    }
  };

  // 2. 分析队伍优势
  const analyzeTeamAdvantage = () => {
    console.log('\n分析队伍优势...');
    
    const team1Cards = getTeamCards(1);
    const team2Cards = getTeamCards(2);
    
    const team1Advantage = 
      stats.wildCardStats.byTeam[1] * 3 + // 配牌权重3
      stats.rankCardStats.byTeam[1] * 2 + // 级牌权重2
      stats.jokerStats.byTeam[1] * 1;     // 王牌权重1
      
    const team2Advantage = 
      stats.wildCardStats.byTeam[2] * 3 + 
      stats.rankCardStats.byTeam[2] * 2 + 
      stats.jokerStats.byTeam[2] * 1;
    
    console.log(`队伍1优势评分: ${team1Advantage} (${team1Cards.length}张牌)`);
    console.log(`队伍2优势评分: ${team2Advantage} (${team2Cards.length}张牌)`);
    
    if (team1Advantage > team2Advantage) {
      console.log('队伍1具有优势');
    } else if (team2Advantage > team1Advantage) {
      console.log('队伍2具有优势');
    } else {
      console.log('两队伍实力相当');
    }
  };

  // 3. 级数变更测试
  const testRankChange = () => {
    console.log('\n测试级数变更...');
    
    const originalRank = gameState.currentRank;
    console.log(`原级数: ${gameInfo.currentRankName}`);
    
    // 变更级数
    const newRank: GameRank = originalRank === 14 ? 2 : (originalRank + 1) as GameRank;
    setRank(newRank);
    
    setTimeout(() => {
      console.log(`新级数: ${gameInfo.currentRankName}`);
      console.log(`配牌数量: ${getWildCards().length}`);
      console.log(`级牌数量: ${getRankCards().length}`);
      
      // 变回原级数
      setRank(originalRank);
      console.log(`已变回原级数: ${gameInfo.currentRankName}`);
    }, 100);
  };

  // 执行示例
  smartDistribution();
  setTimeout(() => analyzeTeamAdvantage(), 200);
  setTimeout(() => testRankChange(), 500);

  return gameState;
}

// ==================== 完整使用流程示例 ====================

export function CompleteWorkflowExample() {
  const gameState = useGameState(7); // 级数7
  
  console.log('\n=== 完整使用流程示例 ===');
  
  // 流程1: 设置玩家名称
  console.log('\n1. 设置玩家名称');
  gameState.updatePlayer(Pos.BOTTOM, { name: '张三' });
  gameState.updatePlayer(Pos.LEFT, { name: '李四' });
  gameState.updatePlayer(Pos.TOP, { name: '王五' });
  gameState.updatePlayer(Pos.RIGHT, { name: '赵六' });
  
  // 流程2: 查看初始状态
  console.log('\n2. 查看初始状态');
  console.log(`级数: ${gameState.gameInfo.currentRankName}`);
  console.log(`玩家: ${gameState.players.map(p => p.name).join(', ')}`);
  console.log(`卡牌总数: ${gameState.cards.length}`);
  
  // 流程3: 分配卡牌
  console.log('\n3. 开始分配卡牌');
  
  // 给张三分配所有配牌
  gameState.selectPlayer(Pos.BOTTOM);
  const wildCards = gameState.getWildCards();
  gameState.batchToggleCards(wildCards.map(card => card.id));
  console.log(`给${gameState.getCurrentPlayer().name}分配了${wildCards.length}张配牌`);
  
  // 给李四分配一些级牌
  gameState.selectPlayer(Pos.LEFT);
  const rankCards = gameState.getRankCards().filter(card => !card.isWildCard);
  gameState.batchToggleCards(rankCards.slice(0, 3).map(card => card.id));
  console.log(`给${gameState.getCurrentPlayer().name}分配了3张级牌`);
  
  // 流程4: 查看分配结果
  console.log('\n4. 查看分配结果');
  gameState.players.forEach(player => {
    const playerCards = gameState.getPlayerCards(player.position);
    const rankCount = playerCards.filter(card => card.isRankCard).length;
    const wildCount = playerCards.filter(card => card.isWildCard).length;
    
    console.log(`${player.name}: ${playerCards.length}张 (级牌${rankCount}, 配牌${wildCount})`);
  });
  
  // 流程5: 队伍统计
  console.log('\n5. 队伍统计');
  console.log(`队伍1总卡牌: ${gameState.stats.teamCardCounts[1]}张`);
  console.log(`队伍2总卡牌: ${gameState.stats.teamCardCounts[2]}张`);
  console.log(`未分配卡牌: ${gameState.getUnassignedCards().length}张`);
  
  // 流程6: 保存状态演示
  console.log('\n6. 状态会自动保存到localStorage');
  console.log('刷新页面后状态会自动恢复');
  
  return gameState;
}

// ==================== 导出所有示例 ====================

export default {
  BasicUsageExample,
  OperationExample,
  SelectorExample,
  AdvancedUsageExample,
  CompleteWorkflowExample
};
