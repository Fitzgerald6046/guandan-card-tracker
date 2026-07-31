import React from 'react';
import type { Card, GameConfig } from '../types';
import { PlayerPosition } from '../types';
import PlayerHand from './PlayerHand';

interface GameBoardProps {
  gameConfig: GameConfig;
  onCardClick?: (card: Card) => void;
  onCardTouch?: {
    onTouchStart: (card: Card) => void;
    onTouchMove: (card: Card) => void;
    onTouchEnd: (card: Card) => void;
  };
}

const GameBoard: React.FC<GameBoardProps> = ({
  gameConfig,
  onCardClick,
  onCardTouch
}) => {
  const getPlayerByPosition = (position: PlayerPosition) => {
    return gameConfig.players.find(player => player.position === position);
  };

  const topPlayer = getPlayerByPosition(PlayerPosition.TOP);
  const bottomPlayer = getPlayerByPosition(PlayerPosition.BOTTOM);
  const leftPlayer = getPlayerByPosition(PlayerPosition.LEFT);
  const rightPlayer = getPlayerByPosition(PlayerPosition.RIGHT);

  return (
    <div className="w-full h-screen bg-green-100 flex flex-col relative">
      {/* 顶部玩家 */}
      <div className="flex-shrink-0 p-4">
        {topPlayer && (
          <PlayerHand
            player={topPlayer}
            onCardClick={onCardClick}
            onCardTouch={onCardTouch}
            showCards={false}
          />
        )}
      </div>

      {/* 中间区域 */}
      <div className="flex-1 flex items-center justify-between px-4">
        {/* 左侧玩家 */}
        <div className="flex-shrink-0">
          {leftPlayer && (
            <PlayerHand
              player={leftPlayer}
              onCardClick={onCardClick}
              onCardTouch={onCardTouch}
              showCards={false}
            />
          )}
        </div>

        {/* 中央游戏信息区域 */}
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-lg shadow-lg p-6 mx-4">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">掼蛋记牌器</h2>
            <div className="text-lg text-gray-600">
              当前级数: <span className="font-bold text-blue-600">{gameConfig.level.current}</span>
            </div>
            <div className="text-sm text-gray-500 mt-1">
              下一级数: {gameConfig.level.next}
            </div>
          </div>

          {/* 主花色显示 */}
          {gameConfig.trumpSuit && (
            <div className="text-center mb-4">
              <div className="text-sm text-gray-600">主花色</div>
              <div className="text-2xl">
                {gameConfig.trumpSuit === 'hearts' && '♥'}
                {gameConfig.trumpSuit === 'diamonds' && '♦'}
                {gameConfig.trumpSuit === 'spades' && '♠'}
                {gameConfig.trumpSuit === 'clubs' && '♣'}
              </div>
            </div>
          )}

          {/* 游戏状态 */}
          <div className="text-center">
            <div className="text-sm text-gray-600">游戏状态</div>
            <div className={`text-lg font-semibold ${
              gameConfig.status === 'playing' ? 'text-green-600' : 
              gameConfig.status === 'finished' ? 'text-red-600' : 'text-yellow-600'
            }`}>
              {gameConfig.status === 'playing' ? '游戏中' : 
               gameConfig.status === 'finished' ? '已结束' : '等待开始'}
            </div>
          </div>

          {/* 当前出牌玩家 */}
          {gameConfig.status === 'playing' && (
            <div className="text-center mt-4">
              <div className="text-sm text-gray-600">当前出牌</div>
              <div className="text-lg font-semibold text-blue-600">
                {gameConfig.currentPlayer === PlayerPosition.BOTTOM && '您'}
                {gameConfig.currentPlayer === PlayerPosition.TOP && topPlayer?.name}
                {gameConfig.currentPlayer === PlayerPosition.LEFT && leftPlayer?.name}
                {gameConfig.currentPlayer === PlayerPosition.RIGHT && rightPlayer?.name}
              </div>
            </div>
          )}
        </div>

        {/* 右侧玩家 */}
        <div className="flex-shrink-0">
          {rightPlayer && (
            <PlayerHand
              player={rightPlayer}
              onCardClick={onCardClick}
              onCardTouch={onCardTouch}
              showCards={false}
            />
          )}
        </div>
      </div>

      {/* 底部玩家（自己） */}
      <div className="flex-shrink-0 p-4">
        {bottomPlayer && (
          <PlayerHand
            player={bottomPlayer}
            onCardClick={onCardClick}
            onCardTouch={onCardTouch}
            showCards={true}
          />
        )}
      </div>
    </div>
  );
};

export default GameBoard;
