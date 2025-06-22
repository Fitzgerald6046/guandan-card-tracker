import React, { useState, useMemo } from 'react';
import CardGrid, { type GroupByOption } from './CardGrid';
import type { Card, GameRank, Team, PlayerPosition, Suit } from '../../types';
import { Rank } from '../../types/game';

// 生成唯一卡牌ID
const generateCardId = (): string => {
  return `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * CardGrid 组件演示页面
 * 展示智能排序、分组显示、快速定位和批量操作功能
 */
const CardGridDemo: React.FC = () => {
  const [currentRank, setCurrentRank] = useState<GameRank>(7);
  const [groupBy, setGroupBy] = useState<GroupByOption>('rank');
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');

  // 创建演示卡牌数据
  const demoCards = useMemo((): Card[] => {
    const cards: Card[] = [];
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

    // 创建普通牌（每种花色的每个数值）
    suits.forEach(suit => {
      ranks.forEach(rank => {
        // 每个数值创建1-3张牌，模拟实际游戏情况
        const count = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < count; i++) {
          const isCurrentRankCard = rank === currentRank;
          const isWild = suit === 'hearts' && isCurrentRankCard;
          
          cards.push({
            id: generateCardId(),
            suit: suit,
            rank: rank,
            isRankCard: isCurrentRankCard,
            isWildCard: isWild,
            isPlayed: false,
            isSelected: false,
            timestamp: Date.now() + Math.random() * 1000
          });
        }
      });
    });

    // 添加大小王
    cards.push({
      id: generateCardId(),
      suit: null,
      rank: Rank.JOKER_BIG,
      isRankCard: false,
      isWildCard: false,
      isPlayed: false,
      isSelected: false,
      timestamp: Date.now()
    });

    cards.push({
      id: generateCardId(),
      suit: null,
      rank: Rank.JOKER_SMALL,
      isRankCard: false,
      isWildCard: false,
      isPlayed: false,
      isSelected: false,
      timestamp: Date.now()
    });

    return cards;
  }, [currentRank]);

  // 模拟队伍归属
  const getCardOwnerTeam = (card: Card): Team | undefined => {
    // 随机分配队伍，模拟游戏状态
    const random = parseInt(card.id.slice(-1), 16);
    if (random < 8) return 1;
    if (random < 14) return 2;
    return undefined; // 无人拥有
  };

  // 模拟多拥有者情况
  const getCardOwners = (card: Card) => {
    const random = parseInt(card.id.slice(-2), 16);
    if (random % 10 === 0) {
      // 10%概率有多个拥有者
      return [
        { team: 1 as Team, position: 'bottom' as PlayerPosition, count: 2 },
        { team: 2 as Team, position: 'left' as PlayerPosition, count: 1 }
      ];
    }
    return undefined;
  };

  // 处理级数变更
  const handleRankChange = (newRank: GameRank) => {
    setCurrentRank(newRank);
  };

  // 处理分组方式变更
  const handleGroupByChange = (newGroupBy: GroupByOption) => {
    setGroupBy(newGroupBy);
  };

  // 处理卡牌点击
  const handleCardClick = (card: Card) => {
    console.log('卡牌点击:', card);
  };

  // 处理卡牌长按
  const handleCardLongPress = (card: Card) => {
    console.log('卡牌长按:', card);
  };

  // 处理选择变更
  const handleSelectionChange = (cards: Card[]) => {
    setSelectedCards(cards);
    console.log('选择变更:', cards);
  };

  // 监听分组变更事件
  React.useEffect(() => {
    const handleGroupChange = (event: any) => {
      setGroupBy(event.detail);
    };

    window.addEventListener('groupByChange', handleGroupChange);
    return () => window.removeEventListener('groupByChange', handleGroupChange);
  }, []);

  const rankOptions: GameRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const getRankDisplayName = (rank: GameRank): string => {
    if (rank === 11) return 'J';
    if (rank === 12) return 'Q';
    if (rank === 13) return 'K';
    if (rank === 14) return 'A';
    return rank.toString();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 头部控制区 */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            CardGrid 组件演示
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 级数选择 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                当前级数
              </label>
              <select
                value={currentRank}
                onChange={(e) => handleRankChange(Number(e.target.value) as GameRank)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {rankOptions.map(rank => (
                  <option key={rank} value={rank}>
                    {getRankDisplayName(rank)}
                  </option>
                ))}
              </select>
            </div>

            {/* 分组方式 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                分组方式
              </label>
              <select
                value={groupBy}
                onChange={(e) => handleGroupByChange(e.target.value as GroupByOption)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="rank">按数值分组</option>
                <option value="suit">按花色分组</option>
                <option value="level">按级牌分组</option>
              </select>
            </div>

            {/* 卡牌尺寸 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                卡牌尺寸
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as 'small' | 'medium' | 'large')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="small">小 (32×48px)</option>
                <option value="medium">中 (48×72px)</option>
                <option value="large">大 (80×112px)</option>
              </select>
            </div>

            {/* 选中统计 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                选中统计
              </label>
              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-lg font-semibold text-blue-600">
                  {selectedCards.length}
                </div>
                <div className="text-xs text-blue-500">
                  张已选择
                </div>
              </div>
            </div>
          </div>

          {/* 功能说明 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">功能说明</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
              <div>
                <strong>智能排序:</strong> 按掼蛋规则排序，配牌和级牌优先显示
              </div>
              <div>
                <strong>分组显示:</strong> 支持按数值、花色、级牌三种分组方式
              </div>
              <div>
                <strong>快速定位:</strong> 点击"跳转到级牌"快速定位到级牌区域
              </div>
              <div>
                <strong>批量操作:</strong> 长按进入多选模式，支持全选/反选
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CardGrid 组件 */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ height: '600px' }}>
          <CardGrid
            cards={demoCards}
            currentRank={currentRank}
            size={size}
            groupBy={groupBy}
            allowMultiSelect={true}
            showControls={true}
            showStats={true}
            onCardClick={handleCardClick}
            onCardLongPress={handleCardLongPress}
            onSelectionChange={handleSelectionChange}
            getCardOwnerTeam={getCardOwnerTeam}
            getCardOwners={getCardOwners}
          />
        </div>

        {/* 选中卡牌详情 */}
        {selectedCards.length > 0 && (
          <div className="mt-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              选中的卡牌 ({selectedCards.length} 张)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-sm">
              {selectedCards.map(card => (
                <div
                  key={card.id}
                  className="px-2 py-1 bg-blue-50 border border-blue-200 rounded text-blue-800"
                >
                  {card.suit ? (
                    <span>
                      {card.suit === 'hearts' ? '♥' : 
                       card.suit === 'diamonds' ? '♦' : 
                       card.suit === 'clubs' ? '♣' : '♠'}
                      {getRankDisplayName(card.rank as GameRank)}
                    </span>
                  ) : (
                    <span>{card.rank === 16 ? '大王' : '小王'}</span>
                  )}
                  {card.isWildCard && <span className="ml-1 text-red-500">配</span>}
                  {card.isRankCard && !card.isWildCard && <span className="ml-1 text-yellow-600">级</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 页脚说明 */}
      <div className="bg-gray-800 text-white p-6 mt-12">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-lg font-semibold mb-4">使用提示</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium mb-2">操作说明:</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• 点击卡牌: 单选模式下触发点击事件</li>
                <li>• 长按卡牌: 进入多选模式并选中该卡牌</li>
                <li>• 滚动查看: 自动显示当前区域提示</li>
                <li>• 跳转定位: 快速定位到级牌区域</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">视觉说明:</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• 红色背景: 配牌 (红心级牌)</li>
                <li>• 黄色背景: 级牌</li>
                <li>• 蓝色边框: 队伍1拥有</li>
                <li>• 绿色边框: 队伍2拥有</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardGridDemo; 