/**
 * 工具函数演示
 * 展示新实现的工具函数的核心功能
 */

import type { GameRank } from '../types/game';
import { Suit, Rank } from '../types/game';

// 导入工具函数
import { generateCards, analyzeCardDistribution, sortCardsByGuandanRule } from './cardData';
import { getRankName, getNextRank, isRankCard, isWildCard, countRankCards } from './rankUtils';
import { GAME_CONFIG, RANK_DISPLAY_NAMES } from './constants';

// ==================== 演示函数 ====================

/**
 * 演示卡牌生成功能
 */
function demoCardGeneration() {
  console.log('🃏 演示卡牌生成功能\n');
  
  const currentRank: GameRank = 5;
  console.log(`当前级数: ${getRankName(currentRank)}`);
  console.log(`下一级数: ${getRankName(getNextRank(currentRank))}\n`);
  
  // 生成108张牌
  const cards = generateCards(currentRank);
  console.log(`✅ 成功生成 ${cards.length} 张牌`);
  
  // 分析卡牌分布
  const analysis = analyzeCardDistribution(cards, currentRank);
  console.log('\n📊 卡牌分析:');
  console.log(`- 配牌(红心${getRankName(currentRank)}): ${analysis.byType.wildCards}张`);
  console.log(`- 级牌(其他花色${getRankName(currentRank)}): ${analysis.byType.rankCards}张`);
  console.log(`- 王牌: ${analysis.byType.jokers}张`);
  console.log(`- 普通牌: ${analysis.byType.normalCards}张`);
  
  console.log('\n🃏 各花色分布:');
  console.log(`- ♠黑桃: ${analysis.bySuit.spades}张`);
  console.log(`- ♥红心: ${analysis.bySuit.hearts}张`);
  console.log(`- ♦方块: ${analysis.bySuit.diamonds}张`);
  console.log(`- ♣梅花: ${analysis.bySuit.clubs}张`);
  console.log(`- 王牌: ${analysis.bySuit.jokers}张`);
  
  return cards;
}

/**
 * 演示级牌和配牌标识
 */
function demoRankCardIdentification() {
  console.log('\n🎯 演示级牌和配牌标识\n');
  
  const currentRank: GameRank = 8;
  console.log(`当前级数: ${getRankName(currentRank)}`);
  
  // 创建测试卡牌
  const testCards = [
    { id: '1', suit: Suit.HEARTS, rank: Rank.EIGHT, isRankCard: false, isWildCard: false, isPlayed: false, isSelected: false, timestamp: Date.now() },
    { id: '2', suit: Suit.SPADES, rank: Rank.EIGHT, isRankCard: false, isWildCard: false, isPlayed: false, isSelected: false, timestamp: Date.now() },
    { id: '3', suit: Suit.HEARTS, rank: Rank.FIVE, isRankCard: false, isWildCard: false, isPlayed: false, isSelected: false, timestamp: Date.now() },
    { id: '4', suit: null, rank: Rank.JOKER_SMALL, isRankCard: false, isWildCard: false, isPlayed: false, isSelected: false, timestamp: Date.now() }
  ];
  
  testCards.forEach(card => {
    const isRank = isRankCard(card, currentRank);
    const isWild = isWildCard(card, currentRank);
    const cardName = card.suit ? `${card.suit.charAt(0).toUpperCase()}${card.rank}` : `${card.rank}`;
    
    console.log(`${cardName}: 级牌=${isRank ? '✅' : '❌'}, 配牌=${isWild ? '✅' : '❌'}`);
  });
}

/**
 * 演示级数循环
 */
function demoRankCycle() {
  console.log('\n🔄 演示级数循环\n');
  
  let currentRank: GameRank = 12; // Q
  console.log('级数循环演示:');
  
  for (let i = 0; i < 5; i++) {
    const displayName = getRankName(currentRank);
    const nextRank = getNextRank(currentRank);
    const nextDisplayName = getRankName(nextRank);
    
    console.log(`${displayName} -> ${nextDisplayName}`);
    currentRank = nextRank;
  }
}

/**
 * 演示卡牌排序
 */
function demoCardSorting() {
  console.log('\n📊 演示卡牌排序\n');
  
  const currentRank: GameRank = 7;
  console.log(`当前级数: ${getRankName(currentRank)}`);
  
  // 生成一些测试卡牌
  const cards = generateCards(currentRank);
  
  // 取前20张进行排序演示
  const sampleCards = cards.slice(0, 20);
  const sortedCards = sortCardsByGuandanRule(sampleCards, currentRank);
  
  console.log('\n排序后的卡牌（前20张）:');
  sortedCards.forEach((card, index) => {
    const suitSymbol = card.suit ? 
      (card.suit === 'spades' ? '♠' : card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : '♣') 
      : '';
    const rankName = RANK_DISPLAY_NAMES[card.rank as GameRank] || card.rank.toString();
    const cardName = card.suit ? `${suitSymbol}${rankName}` : rankName;
    
    let flags = '';
    if (card.isWildCard) flags += ' [配牌]';
    else if (card.isRankCard) flags += ' [级牌]';
    if (card.suit === null) flags += ' [王牌]';
    
    console.log(`${(index + 1).toString().padStart(2, '0')}. ${cardName}${flags}`);
  });
}

/**
 * 演示手牌统计
 */
function demoHandStatistics() {
  console.log('\n📈 演示手牌统计\n');
  
  const currentRank: GameRank = 10;
  console.log(`当前级数: ${getRankName(currentRank)}`);
  
  // 生成108张牌并取27张作为手牌
  const allCards = generateCards(currentRank);
  const handCards = allCards.slice(0, 27);
  
  // 统计手牌
  const stats = countRankCards(handCards, currentRank);
  
  console.log('🃏 手牌统计结果:');
  console.log(`- 总牌数: ${stats.total}张`);
  console.log(`- 配牌: ${stats.wildCards}张`);
  console.log(`- 级牌: ${stats.rankCards}张`);
  console.log(`- 王牌: ${stats.jokers}张`);
  console.log(`- 普通牌: ${stats.normalCards}张`);
  
  const advantage = stats.wildCards * 2 + stats.rankCards + stats.jokers * 0.5;
  console.log(`\n⭐ 优势评分: ${advantage.toFixed(1)} (配牌x2 + 级牌x1 + 王牌x0.5)`);
}

/**
 * 运行所有演示
 */
export function runDemo() {
  console.log('🎮 掼蛋工具函数演示\n');
  console.log('=' .repeat(50));
  
  try {
    // 1. 卡牌生成演示
    demoCardGeneration();
    
    // 2. 级牌识别演示
    demoRankCardIdentification();
    
    // 3. 级数循环演示
    demoRankCycle();
    
    // 4. 卡牌排序演示
    demoCardSorting();
    
    // 5. 手牌统计演示
    demoHandStatistics();
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ 所有演示完成！工具函数运行正常。');
    
    // 返回演示结果
    return {
      success: true,
      message: '所有工具函数演示成功完成',
      gameConfig: GAME_CONFIG,
      validRanks: Object.keys(RANK_DISPLAY_NAMES).map(Number).filter(n => !isNaN(n))
    };
    
  } catch (error) {
    console.error('\n❌ 演示过程中出现错误:', error);
    return {
      success: false,
      message: '演示过程中出现错误',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// 导出演示函数
export default {
  runDemo,
  demoCardGeneration,
  demoRankCardIdentification,
  demoRankCycle,
  demoCardSorting,
  demoHandStatistics
};