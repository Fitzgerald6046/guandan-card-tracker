import React from 'react';
import type { Player, Card as CardType } from '../types';
import { PlayerPosition } from '../types';
import Card from './Card';

interface PlayerHandProps {
  player: Player;
  onCardClick?: (card: CardType) => void;
  onCardTouch?: {
    onTouchStart: (card: CardType) => void;
    onTouchMove: (card: CardType) => void;
    onTouchEnd: (card: CardType) => void;
  };
  showCards?: boolean;
}

const PlayerHand: React.FC<PlayerHandProps> = ({
  player,
  onCardClick,
  onCardTouch,
  showCards = true
}) => {
  const getPositionClasses = () => {
    switch (player.position) {
      case PlayerPosition.BOTTOM:
        return 'flex-row justify-center items-end';
      case PlayerPosition.TOP:
        return 'flex-row justify-center items-start';
      case PlayerPosition.LEFT:
        return 'flex-col justify-center items-start';
      case PlayerPosition.RIGHT:
        return 'flex-col justify-center items-end';
      default:
        return 'flex-row justify-center';
    }
  };

  const getCardSize = () => {
    return player.position === PlayerPosition.BOTTOM ? 'medium' : 'small';
  };

  const getPlayerNamePosition = () => {
    switch (player.position) {
      case PlayerPosition.BOTTOM:
        return 'mb-2';
      case PlayerPosition.TOP:
        return 'mt-2';
      case PlayerPosition.LEFT:
        return 'mr-2';
      case PlayerPosition.RIGHT:
        return 'ml-2';
      default:
        return '';
    }
  };

  const renderCards = () => {
    if (!showCards && player.position !== PlayerPosition.BOTTOM) {
      return (
        <div className="text-center">
          <div className="text-lg font-bold">{player.remainingCount}</div>
          <div className="text-sm text-gray-600">张牌</div>
        </div>
      );
    }

    return (
      <div className={`flex ${getPositionClasses()} gap-1 max-w-full overflow-x-auto`}>
        {player.cards.map((card) => (
          <div
            key={card.id}
            className={player.position === PlayerPosition.BOTTOM ? '' : 'transform scale-75'}
          >
            <Card
              card={card}
              size={getCardSize()}
              onClick={onCardClick}
              onTouchStart={onCardTouch?.onTouchStart}
              onTouchMove={onCardTouch?.onTouchMove}
              onTouchEnd={onCardTouch?.onTouchEnd}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center">
      {/* 玩家名称和剩余牌数 */}
      <div className={`text-center ${getPlayerNamePosition()}`}>
        <div className="font-semibold text-gray-800">{player.name}</div>
        {player.position !== PlayerPosition.BOTTOM && (
          <div className="text-sm text-gray-600">
            剩余: {player.remainingCount}张
          </div>
        )}
      </div>

      {/* 手牌区域 */}
      <div className="relative">
        {renderCards()}
      </div>

      {/* 队伍标识 */}
      <div className={`mt-1 px-2 py-1 rounded text-xs ${
        player.team === 'team_a' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
      }`}>
        {player.team === 'team_a' ? '队伍A' : '队伍B'}
      </div>
    </div>
  );
};

export default PlayerHand;