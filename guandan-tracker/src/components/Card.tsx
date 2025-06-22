import React from 'react';
import type { Card as CardType } from '../types';
import { Suit, Rank } from '../types';

interface CardProps {
  card: CardType;
  size?: 'small' | 'medium' | 'large';
  onClick?: (card: CardType) => void;
  onTouchStart?: (card: CardType) => void;
  onTouchMove?: (card: CardType) => void;
  onTouchEnd?: (card: CardType) => void;
}

const Card: React.FC<CardProps> = ({
  card,
  size = 'medium',
  onClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd
}) => {
  const getSuitSymbol = (suit: Suit | null): string => {
    switch (suit) {
      case Suit.SPADES: return '♠';
      case Suit.HEARTS: return '♥';
      case Suit.DIAMONDS: return '♦';
      case Suit.CLUBS: return '♣';
      default: return '';
    }
  };

  const getSuitColor = (suit: Suit | null): string => {
    return suit === Suit.HEARTS || suit === Suit.DIAMONDS ? 'text-red-500' : 'text-black';
  };

  const getCardSize = () => {
    switch (size) {
      case 'small': return 'w-8 h-12 text-xs';
      case 'large': return 'w-16 h-24 text-lg';
      default: return 'w-12 h-18 text-sm';
    }
  };

  const getDisplayRank = (rank: Rank): string => {
    switch (rank) {
      case Rank.JOKER_SMALL: return '小王';
      case Rank.JOKER_BIG: return '大王';
      default: return rank;
    }
  };

  const isJoker = card.rank === Rank.JOKER_SMALL || card.rank === Rank.JOKER_BIG;
  const isRedLevel = card.isRed && card.isLevel;

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
        ${getCardSize()}
        border border-gray-300 rounded-lg bg-white shadow-sm cursor-pointer
        flex flex-col items-center justify-center relative
        ${card.isSelected ? 'ring-2 ring-blue-500 transform -translate-y-2' : ''}
        ${card.isUsed ? 'opacity-50 grayscale' : ''}
        ${isRedLevel ? 'ring-2 ring-red-400 bg-red-50' : ''}
        hover:shadow-md transition-all duration-200
      `}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 级牌标识 */}
      {card.isLevel && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full text-xs flex items-center justify-center">
          级
        </div>
      )}
      
      {/* 红心级牌特殊标识 */}
      {isRedLevel && (
        <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
          配
        </div>
      )}

      {/* 牌面内容 */}
      <div className={`${isJoker ? 'text-purple-600' : getSuitColor(card.suit)} font-bold`}>
        {getDisplayRank(card.rank)}
      </div>
      
      {!isJoker && (
        <div className={`${getSuitColor(card.suit)} text-lg`}>
          {getSuitSymbol(card.suit)}
        </div>
      )}
    </div>
  );
};

export default Card;