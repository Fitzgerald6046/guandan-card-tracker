import React from 'react';
import type { Card as CardType, Team, PlayerPosition } from '../../types';
import { Suit, Rank } from '../../types/game';

interface CardProps {
  /** 卡牌数据 */
  card: CardType;
  /** 卡牌尺寸 */
  size?: 'small' | 'medium' | 'large';
  /** 拥有此卡牌的玩家队伍 */
  ownerTeam?: Team;
  /** 拥有此卡牌的玩家位置（用于多玩家显示） */
  ownerPosition?: PlayerPosition;
  /** 多个拥有者信息（用于分区显示） */
  owners?: Array<{ team: Team; position: PlayerPosition; count: number }>;
  /** 是否显示动画效果 */
  animated?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 点击事件 */
  onClick?: (card: CardType) => void;
  /** 触摸事件 */
  onTouchStart?: (card: CardType) => void;
  onTouchMove?: (card: CardType) => void;
  onTouchEnd?: (card: CardType) => void;
}

const Card: React.FC<CardProps> = ({
  card,
  size = 'medium',
  ownerTeam,
  owners,
  animated = true,
  className = '',
  onClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd
}) => {
  // 获取花色符号
  const getSuitSymbol = (suit: Suit | null): string => {
    switch (suit) {
      case Suit.SPADES: return '♠';
      case Suit.HEARTS: return '♥';
      case Suit.DIAMONDS: return '♦';
      case Suit.CLUBS: return '♣';
      default: return '';
    }
  };

  // 获取花色颜色
  const getSuitColor = (suit: Suit | null): string => {
    return suit === Suit.HEARTS || suit === Suit.DIAMONDS ? 'text-red-500' : 'text-black';
  };

  // 获取卡牌尺寸样式
  const getCardSize = () => {
    switch (size) {
      case 'small': 
        return {
          container: 'w-8 h-12',
          text: 'text-xs',
          symbol: 'text-sm',
          badge: 'w-2.5 h-2.5 text-[8px]'
        };
      case 'large': 
        return {
          container: 'w-20 h-28',
          text: 'text-lg',
          symbol: 'text-2xl',
          badge: 'w-4 h-4 text-xs'
        };
      default: 
        return {
          container: 'w-12 h-18',
          text: 'text-sm',
          symbol: 'text-lg',
          badge: 'w-3 h-3 text-xs'
        };
    }
  };

  // 获取队伍边框样式
  const getTeamBorderStyle = (team: Team): string => {
    return team === 1 
      ? 'ring-2 ring-blue-400 border-blue-300' 
      : 'ring-2 ring-green-400 border-green-300';
  };

  // 获取队伍标识颜色
  const getTeamBadgeStyle = (team: Team): string => {
    return team === 1 ? 'bg-blue-500' : 'bg-green-500';
  };

  // 获取队伍条状颜色
  const getTeamBarStyle = (team: Team): string => {
    return team === 1 ? 'bg-blue-500' : 'bg-green-500';
  };

  // 获取牌面显示文本
  const getDisplayRank = (rank: Rank): string => {
    switch (rank) {
      case Rank.JOKER_SMALL: return '小王';
      case Rank.JOKER_BIG: return '大王';
      case Rank.JACK: return 'J';
      case Rank.QUEEN: return 'Q';
      case Rank.KING: return 'K';
      case Rank.ACE: return 'A';
      default: return rank.toString();
    }
  };

  // 判断是否为王牌
  const isJoker = card.rank === Rank.JOKER_SMALL || card.rank === Rank.JOKER_BIG;
  
  // 判断是否为红心配牌
  const isWildCard = card.isWildCard && card.suit === Suit.HEARTS;

  const sizes = getCardSize();

  // 事件处理
  const handleClick = () => {
    if (onClick) onClick(card);
  };

  const handleTouchStart = () => {
    if (onTouchStart) onTouchStart(card);
  };

  const handleTouchMove = () => {
    if (onTouchMove) onTouchMove(card);
  };

  const handleTouchEnd = () => {
    if (onTouchEnd) onTouchEnd(card);
  };

  return (
    <div
      className={`
        ${sizes.container}
        relative rounded-xl bg-white shadow-md cursor-pointer
        flex flex-col items-center justify-center
        transition-all duration-300 ease-in-out transform
        hover:shadow-lg hover:scale-105 hover:-translate-y-1
        select-none active:scale-95
        ${card.isSelected ? 'card-enhanced selected shadow-strong scale-110 -translate-y-2 z-10' : 'card-enhanced'}
        ${card.isPlayed ? 'opacity-40 grayscale cursor-not-allowed' : ''}
        ${card.isRankCard ? 'rank-card' : ''}
        ${isWildCard ? 'wild-card' : ''}
        ${ownerTeam && !card.isPlayed ? getTeamBorderStyle(ownerTeam) : ''}
        ${className}
      `}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        minWidth: '2rem',
        minHeight: '3rem',
        touchAction: 'manipulation'
      }}
    >
      {/* 级牌光晕效果 */}
      {card.isRankCard && animated && (
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 rounded-xl opacity-20 pulse"></div>
      )}

      {/* 配牌特殊光效 */}
      {isWildCard && animated && (
        <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-pink-400 to-red-400 rounded-xl opacity-20 bounce"></div>
      )}

      {/* 级牌标识 */}
      {card.isRankCard && (
        <div className={`
          absolute -top-2 -right-2 ${sizes.badge} 
          bg-gradient-to-br from-yellow-500 to-orange-500 
          rounded-full flex items-center justify-center 
          text-white font-bold shadow-md border-2 border-white
          ${animated ? 'bounce' : ''}
        `}>
          ⭐
        </div>
      )}
      
      {/* 红心配牌特殊标识 */}
      {isWildCard && (
        <div className={`
          absolute -top-2 -left-2 ${sizes.badge}
          bg-gradient-to-br from-red-500 to-pink-500 
          rounded-full flex items-center justify-center 
          text-white font-bold shadow-md border-2 border-white
          ${animated ? 'wiggle' : ''}
        `}>
          🔥
        </div>
      )}

      {/* 队伍标识 */}
      {ownerTeam && !card.isPlayed && (
        <div className={`
          absolute -bottom-1 -right-1 w-4 h-4 
          ${getTeamBadgeStyle(ownerTeam)}
          rounded-full border-2 border-white shadow-md
          flex items-center justify-center text-white text-xs font-bold
        `}>
          {ownerTeam}
        </div>
      )}

      {/* 多拥有者分区显示 */}
      {owners && owners.length > 0 && (
        <div className="absolute -bottom-1 left-0 right-0 flex justify-center space-x-0.5">
          {owners.map((owner, index) => (
            <div
              key={`${owner.team}-${owner.position}`}
              className={`
                w-3 h-1.5 ${getTeamBarStyle(owner.team)} shadow-sm
                ${index === 0 ? 'rounded-l-full' : ''} 
                ${index === owners.length - 1 ? 'rounded-r-full' : ''}
              `}
              title={`队伍${owner.team}: ${owner.count}张`}
            />
          ))}
        </div>
      )}

      {/* 牌面内容 */}
      <div className="flex flex-col items-center justify-center flex-1 z-10 relative">
        {/* 数字/字母 */}
        <div className={`
          ${sizes.text} font-bold text-shadow
          ${isJoker ? 'text-purple-600' : getSuitColor(card.suit)}
          ${isWildCard ? 'text-red-600' : ''}
          ${card.isRankCard && !isWildCard ? 'text-yellow-700' : ''}
          ${animated && card.isSelected ? 'pulse' : ''}
        `}>
          {getDisplayRank(card.rank)}
        </div>
        
        {/* 花色符号 */}
        {!isJoker && (
          <div className={`
            ${sizes.symbol} font-bold
            ${getSuitColor(card.suit)}
            ${isWildCard ? 'text-red-500' : ''}
            ${animated && isWildCard ? 'pulse' : ''}
            drop-shadow-sm
          `}>
            {getSuitSymbol(card.suit)}
          </div>
        )}

        {/* 王牌特效 */}
        {isJoker && animated && (
          <div className="absolute inset-0 bg-gradient-to-r from-purple-300 via-transparent to-purple-300 rounded-xl opacity-30 pulse"></div>
        )}
      </div>

      {/* 选中状态指示器 */}
      {card.isSelected && (
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-300 to-yellow-100 bg-opacity-40 rounded-xl border-2 border-yellow-400 pulse" />
      )}

      {/* 已出牌蒙版 */}
      {card.isPlayed && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-60 rounded-xl flex items-center justify-center backdrop-blur-sm">
          <span className="text-white text-xs font-bold text-shadow">❌ 已出</span>
        </div>
      )}

      {/* 悬停光效 */}
      <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-0 hover:opacity-20 rounded-xl transition-opacity duration-300"></div>
    </div>
  );
};

export default Card;
