/**
 * 工具函数测试验证
 * 用于验证所有工具函数的正确性
 */

import type { GameRank } from '../types/game';
import { Suit, Rank } from '../types/game';

// 导入要测试的模块
import { 
  GAME_CONFIG, 
  RANK_CONFIG, 
  VALID_RANKS,
  RANK_DISPLAY_NAMES,
  isValidGameRank 
} from './constants';

import {
  generateCards,
  generateAndDealCards,
  analyzeCardDistribution,
  validateCardSet,
  sortCardsByGuandanRule,
  shuffleCards
} from './cardData';

import {
  isValidRank,
  getRankName,
  getNextRank,
  getPreviousRank,
  isRankCard,
  isWildCard,
  isJoker,
  getCardOrderValue,
  countRankCards,
  suggestBestRank
} from './rankUtils';

// ==================== 测试结果类型 ====================

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  duration: number;
}

interface TestSuite {
  suiteName: string;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalDuration: number;
}

// ==================== 测试工具函数 ====================

function createTestRunner() {
  const results: TestSuite[] = [];
  let currentSuite: TestSuite | null = null;

  function startSuite(suiteName: string) {
    currentSuite = {
      suiteName,
      tests: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      totalDuration: 0
    };
  }

  function test(testName: string, testFn: () => void | boolean) {
    if (!currentSuite) {
      throw new Error('No test suite started');
    }

    const startTime = performance.now();
    let passed = false;
    let message = '';

    try {
      const result = testFn();
      passed = result !== false;
      message = passed ? 'Passed' : 'Test returned false';
    } catch (error) {
      passed = false;
      message = error instanceof Error ? error.message : 'Unknown error';
    }

    const duration = performance.now() - startTime;

    const testResult: TestResult = {
      testName,
      passed,
      message,
      duration
    };

    currentSuite.tests.push(testResult);
    currentSuite.totalTests++;
    currentSuite.totalDuration += duration;

    if (passed) {
      currentSuite.passedTests++;
    } else {
      currentSuite.failedTests++;
    }
  }

  function endSuite() {
    if (currentSuite) {
      results.push(currentSuite);
      currentSuite = null;
    }
  }

  function assert(condition: boolean, message: string = 'Assertion failed') {
    if (!condition) {
      throw new Error(message);
    }
  }

  function assertEquals<T>(actual: T, expected: T, message?: string) {
    const msg = message || `Expected ${expected}, got ${actual}`;
    assert(actual === expected, msg);
  }

  function assertArrayEquals<T>(actual: T[], expected: T[], message?: string) {
    const msg = message || `Arrays not equal. Expected [${expected}], got [${actual}]`;
    assert(actual.length === expected.length, `${msg} - Different lengths`);
    for (let i = 0; i < actual.length; i++) {
      assert(actual[i] === expected[i], `${msg} - Different at index ${i}`);
    }
  }

  return {
    startSuite,
    test,
    endSuite,
    assert,
    assertEquals,
    assertArrayEquals,
    getResults: () => results
  };
}

// ==================== 常量测试 ====================

function testConstants() {
  const { startSuite, test, endSuite, assert, assertEquals } = createTestRunner();

  startSuite('Constants Tests');

  test('GAME_CONFIG constants', () => {
    assertEquals(GAME_CONFIG.TOTAL_CARDS, 108);
    assertEquals(GAME_CONFIG.CARDS_PER_PLAYER, 27);
    assertEquals(GAME_CONFIG.PLAYER_COUNT, 4);
    assertEquals(GAME_CONFIG.DECK_COUNT, 2);
  });

  test('RANK_CONFIG constants', () => {
    assertEquals(RANK_CONFIG.MIN_RANK, 2);
    assertEquals(RANK_CONFIG.MAX_RANK, 14);
    assertEquals(RANK_CONFIG.DEFAULT_RANK, 2);
    assertEquals(RANK_CONFIG.RANK_COUNT, 13);
  });

  test('VALID_RANKS array', () => {
    assertEquals(VALID_RANKS.length, 13);
    assertEquals(VALID_RANKS[0], 2);
    assertEquals(VALID_RANKS[12], 14);
  });

  test('RANK_DISPLAY_NAMES mapping', () => {
    assertEquals(RANK_DISPLAY_NAMES[2], '2');
    assertEquals(RANK_DISPLAY_NAMES[11], 'J');
    assertEquals(RANK_DISPLAY_NAMES[12], 'Q');
    assertEquals(RANK_DISPLAY_NAMES[13], 'K');
    assertEquals(RANK_DISPLAY_NAMES[14], 'A');
  });

  test('isValidGameRank function', () => {
    assert(isValidGameRank(2), 'Should accept 2');
    assert(isValidGameRank(14), 'Should accept 14');
    assert(!isValidGameRank(1), 'Should reject 1');
    assert(!isValidGameRank(15), 'Should reject 15');
    assert(!isValidGameRank('2'), 'Should reject string');
  });

  endSuite();
  return createTestRunner().getResults();
}

// ==================== 级数工具测试 ====================

function testRankUtils() {
  const { startSuite, test, endSuite, assert, assertEquals } = createTestRunner();

  startSuite('Rank Utils Tests');

  test('isValidRank function', () => {
    assert(isValidRank(2));
    assert(isValidRank(14));
    assert(!isValidRank(1));
    assert(!isValidRank(15));
  });

  test('getRankName function', () => {
    assertEquals(getRankName(2), '2');
    assertEquals(getRankName(11), 'J');
    assertEquals(getRankName(14), 'A');
  });

  test('getNextRank function', () => {
    assertEquals(getNextRank(2), 3);
    assertEquals(getNextRank(13), 14);
    assertEquals(getNextRank(14), 2); // 循环到2
  });

  test('getPreviousRank function', () => {
    assertEquals(getPreviousRank(3), 2);
    assertEquals(getPreviousRank(14), 13);
    assertEquals(getPreviousRank(2), 14); // 循环到A
  });

  test('isRankCard function', () => {
    const testCard = {
      id: 'test',
      suit: Suit.SPADES,
      rank: Rank.FIVE,
      isRankCard: false,
      isWildCard: false,
      isPlayed: false,
      isSelected: false,
      timestamp: Date.now()
    };

    assert(isRankCard(testCard, 5), 'Should be rank card when rank matches');
    assert(!isRankCard(testCard, 6), 'Should not be rank card when rank differs');
  });

  test('isWildCard function', () => {
    const heartsCard = {
      id: 'test',
      suit: Suit.HEARTS,
      rank: Rank.FIVE,
      isRankCard: false,
      isWildCard: false,
      isPlayed: false,
      isSelected: false,
      timestamp: Date.now()
    };

    const spadesCard = {
      ...heartsCard,
      suit: Suit.SPADES
    };

    assert(isWildCard(heartsCard, 5), 'Hearts rank card should be wild card');
    assert(!isWildCard(spadesCard, 5), 'Non-hearts rank card should not be wild card');
  });

  test('isJoker function', () => {
    const smallJoker = {
      id: 'test',
      suit: null,
      rank: Rank.JOKER_SMALL,
      isRankCard: false,
      isWildCard: false,
      isPlayed: false,
      isSelected: false,
      timestamp: Date.now()
    };

    const normalCard = {
      ...smallJoker,
      suit: Suit.SPADES,
      rank: Rank.FIVE
    };

    assert(isJoker(smallJoker), 'Should identify joker');
    assert(!isJoker(normalCard), 'Should not identify normal card as joker');
  });

  endSuite();
  return createTestRunner().getResults();
}

// ==================== 卡牌数据测试 ====================

function testCardData() {
  const { startSuite, test, endSuite, assert, assertEquals } = createTestRunner();

  startSuite('Card Data Tests');

  test('generateCards function', () => {
    const cards = generateCards(5);
    assertEquals(cards.length, 108, 'Should generate 108 cards');

    // 验证级牌标记
    const rankFiveCards = cards.filter(card => card.rank === 5);
    assertEquals(rankFiveCards.length, 8, 'Should have 8 cards of rank 5');
    
    for (const card of rankFiveCards) {
      assert(card.isRankCard, 'All rank 5 cards should be marked as rank cards');
    }

    // 验证配牌标记
    const wildCards = cards.filter(card => card.isWildCard);
    assertEquals(wildCards.length, 2, 'Should have 2 wild cards (hearts 5)');
    
    for (const card of wildCards) {
      assert(card.suit === Suit.HEARTS, 'Wild cards should be hearts');
      assert(card.rank === 5, 'Wild cards should be rank 5');
    }
  });

  test('generateAndDealCards function', () => {
    const { allCards, playerHands } = generateAndDealCards(7, false);
    
    assertEquals(allCards.length, 108, 'Should have 108 total cards');
    assertEquals(playerHands.length, 4, 'Should have 4 player hands');
    
    for (let i = 0; i < 4; i++) {
      assertEquals(playerHands[i].length, 27, `Player ${i} should have 27 cards`);
    }

    // 验证所有卡牌都被分发
    const allDealtCards = playerHands.flat();
    assertEquals(allDealtCards.length, 108, 'All cards should be dealt');
  });

  test('analyzeCardDistribution function', () => {
    const cards = generateCards(10);
    const analysis = analyzeCardDistribution(cards, 10);

    assertEquals(analysis.total, 108);
    assertEquals(analysis.byType.wildCards, 2); // 红心10
    assertEquals(analysis.byType.rankCards, 6); // 其他花色的10
    assertEquals(analysis.byType.jokers, 4); // 大小王各2张
    
    // 验证花色分布
    assertEquals(analysis.bySuit[Suit.SPADES], 26);
    assertEquals(analysis.bySuit[Suit.HEARTS], 26);
    assertEquals(analysis.bySuit[Suit.DIAMONDS], 26);
    assertEquals(analysis.bySuit[Suit.CLUBS], 26);
    assertEquals(analysis.bySuit.jokers, 4);
  });

  test('validateCardSet function', () => {
    const validCards = generateCards(8);
    const validation = validateCardSet(validCards);
    
    assert(validation.isValid, 'Valid card set should pass validation');
    assertEquals(validation.errors.length, 0, 'Should have no errors');

    // 测试无效卡组
    const incompleteCards = validCards.slice(0, 50);
    const invalidValidation = validateCardSet(incompleteCards);
    
    assert(!invalidValidation.isValid, 'Incomplete card set should fail validation');
    assert(invalidValidation.errors.length > 0, 'Should have errors');
  });

  test('sortCardsByGuandanRule function', () => {
    const cards = generateCards(6);
    const sortedCards = sortCardsByGuandanRule(cards, 6);
    
    assertEquals(sortedCards.length, 108, 'Sorted array should have same length');

    // 验证配牌在最前面
    const wildCards = sortedCards.filter(card => card.isWildCard);
    const firstWildCardIndex = sortedCards.findIndex(card => card.isWildCard);
    const lastWildCardIndex = sortedCards.findIndex(card => card.isWildCard && 
      sortedCards.indexOf(card) === sortedCards.lastIndexOf(card));
    
    assert(firstWildCardIndex >= 0, 'Should find wild cards');
    assert(firstWildCardIndex < 10, 'Wild cards should be near the beginning');
  });

  test('shuffleCards function', () => {
    const originalCards = generateCards(4);
    const shuffledCards = shuffleCards(originalCards);
    
    assertEquals(shuffledCards.length, originalCards.length, 'Shuffled array should have same length');
    
    // 验证所有卡牌都存在（通过ID）
    const originalIds = new Set(originalCards.map(card => card.id));
    const shuffledIds = new Set(shuffledCards.map(card => card.id));
    
    assertEquals(shuffledIds.size, originalIds.size, 'Should have same number of unique cards');
    
    for (const id of originalIds) {
      assert(shuffledIds.has(id), `Should contain card with id ${id}`);
    }
  });

  endSuite();
  return createTestRunner().getResults();
}

// ==================== 综合测试 ====================

function testIntegration() {
  const { startSuite, test, endSuite, assert, assertEquals } = createTestRunner();

  startSuite('Integration Tests');

  test('级数变更时卡牌状态更新', () => {
    // 测试级数从5变更到7时，卡牌状态的正确更新
    const cards = generateCards(5);
    
    // 验证初始状态（级数5）
    const initialRankCards = cards.filter(card => card.isRankCard);
    const initialWildCards = cards.filter(card => card.isWildCard);
    
    assertEquals(initialRankCards.length, 8, 'Should have 8 rank cards initially');
    assertEquals(initialWildCards.length, 2, 'Should have 2 wild cards initially');
    
    // 模拟级数变更到7
    const updatedCards = cards.map(card => ({
      ...card,
      isRankCard: isRankCard(card, 7),
      isWildCard: isWildCard(card, 7)
    }));
    
    // 验证更新后状态（级数7）
    const newRankCards = updatedCards.filter(card => card.isRankCard);
    const newWildCards = updatedCards.filter(card => card.isWildCard);
    
    assertEquals(newRankCards.length, 8, 'Should have 8 rank cards after update');
    assertEquals(newWildCards.length, 2, 'Should have 2 wild cards after update');
    
    // 验证所有7都被标记为级牌
    for (const card of newRankCards) {
      assertEquals(card.rank, 7, 'All rank cards should be 7');
    }
    
    // 验证红心7被标记为配牌
    for (const card of newWildCards) {
      assertEquals(card.rank, 7, 'All wild cards should be 7');
      assertEquals(card.suit, Suit.HEARTS, 'All wild cards should be hearts');
    }
  });

  test('排序后卡牌优先级正确', () => {
    const cards = generateCards(12); // 级数Q
    const sortedCards = sortCardsByGuandanRule(cards, 12);
    
    // 验证排序优先级：配牌 > 级牌 > 大王 > 小王 > 普通牌
    let lastOrderValue = Number.MAX_SAFE_INTEGER;
    
    for (const card of sortedCards) {
      const currentOrderValue = getCardOrderValue(card, 12);
      assert(currentOrderValue <= lastOrderValue, 
        `Card order should be descending. Current: ${currentOrderValue}, Last: ${lastOrderValue}`);
      lastOrderValue = currentOrderValue;
    }
    
    // 验证配牌在最前面
    const firstCard = sortedCards[0];
    assert(firstCard.isWildCard, 'First card should be wild card');
    
    // 验证大王在小王前面（在相同类别内）
    const bigJokerIndex = sortedCards.findIndex(card => card.rank === Rank.JOKER_BIG);
    const smallJokerIndex = sortedCards.findIndex(card => card.rank === Rank.JOKER_SMALL);
    
    if (bigJokerIndex >= 0 && smallJokerIndex >= 0) {
      assert(bigJokerIndex < smallJokerIndex, 'Big joker should come before small joker');
    }
  });

  test('完整游戏流程模拟', () => {
    const currentRank: GameRank = 8;
    
    // 1. 生成并发牌
    const { allCards, playerHands } = generateAndDealCards(currentRank, true);
    
    // 2. 验证发牌结果
    assertEquals(allCards.length, 108);
    assertEquals(playerHands.length, 4);
    
    let totalDealtCards = 0;
    for (const hand of playerHands) {
      assertEquals(hand.length, 27);
      totalDealtCards += hand.length;
    }
    assertEquals(totalDealtCards, 108);
    
    // 3. 排序每个玩家的手牌
    const sortedHands = playerHands.map(hand => 
      sortCardsByGuandanRule(hand, currentRank)
    );
    
    // 4. 统计每个玩家的级牌情况
    for (let i = 0; i < 4; i++) {
      const stats = countRankCards(sortedHands[i], currentRank);
      assert(stats.total === 27, `Player ${i} should have 27 cards`);
      assert(stats.rankCards + stats.wildCards + stats.normalCards + stats.jokers === 27,
        `Player ${i} card counts should add up to 27`);
    }
    
    // 5. 验证级数建议功能
    for (const hand of sortedHands) {
      const suggestions = suggestBestRank(hand);
      assert(suggestions.length > 0, 'Should provide rank suggestions');
      assert(suggestions.every(rank => isValidRank(rank)), 'All suggestions should be valid ranks');
    }
  });

  endSuite();
  return createTestRunner().getResults();
}

// ==================== 测试执行器 ====================

export function runAllTests(): {
  suites: TestSuite[];
  summary: {
    totalSuites: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    totalDuration: number;
    successRate: number;
  };
} {
  console.log('🃏 开始运行掼蛋工具函数测试...\n');

  const allResults: TestSuite[] = [];

  // 运行所有测试套件
  const constantsResults = testConstants();
  const rankUtilsResults = testRankUtils();
  const cardDataResults = testCardData();
  const integrationResults = testIntegration();

  allResults.push(...constantsResults, ...rankUtilsResults, ...cardDataResults, ...integrationResults);

  // 计算总体统计
  const summary = {
    totalSuites: allResults.length,
    totalTests: allResults.reduce((sum, suite) => sum + suite.totalTests, 0),
    passedTests: allResults.reduce((sum, suite) => sum + suite.passedTests, 0),
    failedTests: allResults.reduce((sum, suite) => sum + suite.failedTests, 0),
    totalDuration: allResults.reduce((sum, suite) => sum + suite.totalDuration, 0),
    successRate: 0
  };

  summary.successRate = summary.totalTests > 0 ? 
    (summary.passedTests / summary.totalTests) * 100 : 0;

  // 打印结果
  console.log('📊 测试结果汇总:');
  console.log(`总测试套件: ${summary.totalSuites}`);
  console.log(`总测试数: ${summary.totalTests}`);
  console.log(`通过: ${summary.passedTests}`);
  console.log(`失败: ${summary.failedTests}`);
  console.log(`成功率: ${summary.successRate.toFixed(2)}%`);
  console.log(`总耗时: ${summary.totalDuration.toFixed(2)}ms\n`);

  // 打印详细结果
  for (const suite of allResults) {
    const status = suite.failedTests === 0 ? '✅' : '❌';
    console.log(`${status} ${suite.suiteName}: ${suite.passedTests}/${suite.totalTests} 通过`);
    
    if (suite.failedTests > 0) {
      for (const test of suite.tests) {
        if (!test.passed) {
          console.log(`  ❌ ${test.testName}: ${test.message}`);
        }
      }
    }
  }

  return {
    suites: allResults,
    summary
  };
}

// 自动运行测试（如果是直接执行）
if (typeof window === 'undefined' && import.meta.url.endsWith('testUtils.ts')) {
  runAllTests();
}

export default {
  runAllTests,
  testConstants,
  testRankUtils,
  testCardData,
  testIntegration
};