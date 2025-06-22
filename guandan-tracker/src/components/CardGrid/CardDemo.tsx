import React, { useState } from 'react';
import Card from './Card';
import type { Card as CardType, Team, PlayerPosition } from '../../types';
import { Suit, Rank } from '../../types/game';

const CardDemo: React.FC = () => {
  const [animated, setAnimated] = useState(true);
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');

  // 创建示例卡牌
  const createSampleCard = (
    rank: Rank, 
    suit: Suit | null, 
    isRankCard = false, 
    isWildCard = false,
    isSelected = false,
    isPlayed = false
  ): CardType => ({
    id: `${suit}-${rank}-${Date.now()}`,
    suit,
    rank,
    isRankCard,
    isWildCard,
    isPlayed,
    isSelected,
    timestamp: Date.now()
  });

  const sampleCards: Array<{ card: CardType; title: string; ownerTeam?: Team; owners?: Array<{ team: Team; position: PlayerPosition; count: number }> }> = [
    {
      card: createSampleCard(Rank.TWO, Suit.HEARTS, false, false),
      title: '普通红心2'
    },
    {
      card: createSampleCard(Rank.FIVE, Suit.SPADES, true, false),
      title: '级牌（假设5是当前级数）',
      ownerTeam: 1
    },
    {
      card: createSampleCard(Rank.FIVE, Suit.HEARTS, true, true),
      title: '红心配牌（红心5）',
      ownerTeam: 2
    },
    {
      card: createSampleCard(Rank.JOKER_SMALL, null, false, false),
      title: '小王'
    },
    {
      card: createSampleCard(Rank.JOKER_BIG, null, false, false),
      title: '大王'
    },
    {
      card: createSampleCard(Rank.ACE, Suit.DIAMONDS, false, false, true),
      title: '选中状态的红方A'
    },
    {
      card: createSampleCard(Rank.KING, Suit.CLUBS, false, false, false, true),
      title: '已出牌的梅花K'
    },
    {
      card: createSampleCard(Rank.QUEEN, Suit.SPADES, false, false),
      title: '多拥有者显示',
      owners: [
        { team: 1, position: 'bottom' as PlayerPosition, count: 2 },
        { team: 2, position: 'top' as PlayerPosition, count: 1 }
      ]
    }
  ];

  const handleCardClick = (card: CardType) => {
    console.log('卡牌被点击:', card);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">优化后的卡牌组件演示</h1>
          <p className="text-gray-600">展示级牌特殊样式、红心配牌突出显示、队伍归属显示等功能</p>
        </div>

        {/* 控制面板 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">控制面板</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                卡牌尺寸
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as 'small' | 'medium' | 'large')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="small">小 (32×48px)</option>
                <option value="medium">中 (48×72px)</option>
                <option value="large">大 (80×112px)</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="animated"
                checked={animated}
                onChange={(e) => setAnimated(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="animated" className="ml-2 block text-sm text-gray-700">
                启用动画效果
              </label>
            </div>
          </div>
        </div>

        {/* 卡牌展示 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">卡牌样式展示</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6">
            {sampleCards.map((item, index) => (
              <div key={index} className="flex flex-col items-center space-y-3">
                <Card
                  card={item.card}
                  size={size}
                  ownerTeam={item.ownerTeam}
                  owners={item.owners}
                  animated={animated}
                  onClick={handleCardClick}
                />
                <p className="text-xs text-gray-600 text-center max-w-20">
                  {item.title}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 功能说明 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">功能说明</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">级牌特殊样式</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                  黄色渐变背景
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mr-2"></div>
                  右上角"级"字标识
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-yellow-200 rounded-full mr-2"></div>
                  脉冲动画效果
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">红心配牌突出显示</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-red-400 rounded-full mr-2"></div>
                  红粉渐变背景
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-pink-500 rounded-full mr-2"></div>
                  左上角"配"字标识
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-red-300 rounded-full mr-2"></div>
                  弹跳和光晕动画
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">队伍归属显示</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  队伍1：蓝色边框和标识
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  队伍2：绿色边框和标识
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                  多拥有者分区显示
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">响应式优化</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
                  三种尺寸适配
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
                  触摸友好的点击区域
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
                  悬停缩放效果
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 使用示例 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">使用示例</h2>
          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-sm text-gray-800 overflow-x-auto">
{`// 基本用法
<Card
  card={cardData}
  size="medium"
  onClick={handleCardClick}
/>

// 显示队伍归属
<Card
  card={cardData}
  ownerTeam={1}
  animated={true}
/>

// 多拥有者显示
<Card
  card={cardData}
  owners={[
    { team: 1, position: 'bottom', count: 2 },
    { team: 2, position: 'top', count: 1 }
  ]}
/>`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardDemo; 