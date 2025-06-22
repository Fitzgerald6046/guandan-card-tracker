/**
 * 卡牌设计演示组件
 * 展示简洁的新卡牌设计
 */

import React from 'react';
import { CardImage } from './CardImage';

export const CardDemo: React.FC = () => {
  const demoCards = [
    { rank: 7, suit: 'hearts', isWildCard: true, label: '配牌(红心7)' },
    { rank: 7, suit: 'spades', isRankCard: true, label: '级牌(黑桃7)' },
    { rank: 11, suit: 'diamonds', label: '普通牌(方块J)' },
    { rank: 14, suit: 'clubs', label: '普通牌(梅花A)' },
    { rank: 15, suit: 'joker', label: '大王' }
  ];

  const sizes = ['tiny', 'small', 'medium', 'large'] as const;

  return (
    <div className="card-demo p-8 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
          🎴 简洁卡牌设计
        </h1>
        
        <div className="bg-white rounded-lg p-6 shadow-lg mb-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">设计特点</h2>
          <ul className="text-gray-600 space-y-2">
            <li>✨ <strong>简洁设计</strong>：去掉了中心的重复数字，只保留一个花色符号</li>
            <li>🎯 <strong>清晰标识</strong>：左上角和右下角保留数字/字母标识</li>
            <li>🎨 <strong>视觉焦点</strong>：中心的大花色符号成为视觉重点</li>
            <li>🔍 <strong>多种尺寸</strong>：支持tiny、small、medium、large四种尺寸</li>
            <li>🎭 <strong>特殊标记</strong>：配牌红心标识、级牌虚线边框</li>
          </ul>
        </div>

        {/* 尺寸展示 */}
        <div className="bg-white rounded-lg p-6 shadow-lg mb-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">尺寸对比</h2>
          <div className="flex items-end justify-center gap-8">
            {sizes.map(size => (
              <div key={size} className="text-center">
                <CardImage
                  rank={7 as any}
                  suit="hearts"
                  displayName="7"
                  isWildCard={true}
                  size={size}
                />
                <div className="mt-2 text-sm text-gray-600 capitalize">{size}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 卡牌类型展示 */}
        <div className="bg-white rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">卡牌类型</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {demoCards.map((card, index) => (
              <div key={index} className="text-center">
                <CardImage
                  rank={card.rank as any}
                  suit={card.suit as any}
                  displayName={card.rank === 15 ? '大王' : card.rank.toString()}
                  isWildCard={card.isWildCard}
                  isRankCard={card.isRankCard}
                  size="medium"
                />
                <div className="mt-3 text-sm text-gray-600">
                  {card.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 选中状态展示 */}
        <div className="bg-white rounded-lg p-6 shadow-lg mt-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">交互状态</h2>
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <CardImage
                rank={10 as any}
                suit="spades"
                displayName="10"
                size="medium"
              />
              <div className="mt-2 text-sm text-gray-600">正常状态</div>
            </div>
            <div className="text-center">
              <CardImage
                rank={10 as any}
                suit="spades"
                displayName="10"
                isSelected={true}
                size="medium"
              />
              <div className="mt-2 text-sm text-gray-600">选中状态</div>
            </div>
            <div className="text-center">
              <CardImage
                rank={10 as any}
                suit="spades"
                displayName="10"
                remainingCount={0}
                size="medium"
              />
              <div className="mt-2 text-sm text-gray-600">已用完</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardDemo;