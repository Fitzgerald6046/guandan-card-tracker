/**
 * 卡牌图像组件
 * 支持 SVG 生成的卡牌图像显示
 */

import React from 'react';
import type { GameRank } from '../types/game';

// ==================== 类型定义 ====================

interface CardImageProps {
  /** 卡牌等级 */
  rank: GameRank | 15 | 16; // 15/16分别表示小王和大王
  /** 花色 */
  suit?: 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker';
  /** 显示名称 */
  displayName?: string;
  /** 是否为配牌 */
  isWildCard?: boolean;
  /** 是否为级数牌 */
  isRankCard?: boolean;
  /** 是否被选中 */
  isSelected?: boolean;
  /** 剩余数量 */
  remainingCount?: number;
  /** 卡牌尺寸 */
  size?: 'tiny' | 'small' | 'medium' | 'large';
  /** 点击事件 */
  onClick?: (e?: React.MouseEvent) => void;
  /** 双击事件 */
  onDoubleClick?: (e: React.MouseEvent) => void;
  /** 右键事件 */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** 触摸开始事件 */
  onTouchStart?: (e: React.TouchEvent) => void;
  /** 鼠标按下事件 */
  onMouseDown?: (e?: React.MouseEvent) => void;
  /** 鼠标进入事件 */
  onMouseEnter?: () => void;
  /** CSS类名 */
  className?: string;
}

// ==================== 工具函数 ====================

/**
 * 获取卡牌显示名称
 */
function getCardDisplayName(rank: GameRank | 15 | 16): string {
  if (rank >= 15) return 'JOKER';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  return rank.toString();
}

// ==================== 主组件 ====================

export const CardImage: React.FC<CardImageProps> = ({
  rank,
  displayName: propDisplayName,
  isWildCard = false,
  isRankCard = false,
  isSelected = false,
  remainingCount = 8,
  size = 'medium',
  onClick,
  onDoubleClick,
  onContextMenu,
  onTouchStart,
  onMouseDown,
  onMouseEnter,
  className = ''
}) => {
  const displayName = propDisplayName || getCardDisplayName(rank);
  const isJoker = rank >= 15;
  
  // 根据尺寸设置方形尺寸
  const getSvgSize = () => {
    switch (size) {
      case 'tiny': return { width: 24, height: 24, viewBox: '0 0 24 24' };
      case 'small': return { width: 32, height: 32, viewBox: '0 0 32 32' };
      case 'large': return { width: 48, height: 48, viewBox: '0 0 48 48' };
      default: return { width: 40, height: 40, viewBox: '0 0 40 40' };
    }
  };
  
  const svgSize = getSvgSize();
  
  // 根据尺寸调整字体大小（方形适配）
  const getFontSizes = () => {
    switch (size) {
      case 'tiny': return { corner: 6, center: 14 };
      case 'small': return { corner: 8, center: 18 };
      case 'large': return { corner: 12, center: 28 };
      default: return { corner: 10, center: 22 };
    }
  };
  
  const fontSizes = getFontSizes();
  
  return (
    <div
      className={`relative cursor-pointer transition-all ${
        isSelected ? 'transform scale-105' : 'hover:transform hover:scale-102'
      } ${remainingCount === 0 ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      onClick={remainingCount > 0 ? (e) => onClick?.(e) : undefined}
      onDoubleClick={remainingCount > 0 ? (e) => onDoubleClick?.(e) : undefined}
      onContextMenu={remainingCount > 0 ? (e) => onContextMenu?.(e) : undefined}
      onTouchStart={remainingCount > 0 ? (e) => onTouchStart?.(e) : undefined}
      onMouseDown={remainingCount > 0 ? (e) => onMouseDown?.(e) : undefined}
      onMouseEnter={onMouseEnter}
    >
      {/* 方形卡牌设计 */}
      <div
        className={`relative rounded-md border-2 flex items-center justify-center font-bold transition-all ${
          isSelected 
            ? 'bg-blue-50 border-blue-500 shadow-lg' 
            : 'bg-white border-gray-300 shadow-sm hover:shadow-md'
        } ${isJoker ? 'bg-gradient-to-br from-red-50 to-orange-50' : ''} ${
          isRankCard && !isWildCard ? 'ring-2 ring-blue-300 ring-opacity-50' : ''
        }`}
        style={{
          width: svgSize.width,
          height: svgSize.height,
          minWidth: svgSize.width,
          minHeight: svgSize.height
        }}
      >
        {/* 主要内容 */}
        <div className="relative w-full h-full flex items-center justify-center">
          {isJoker ? (
            // 王牌显示 - 方形适配
            <div className="text-center leading-none">
              <div 
                className="font-black text-red-600 font-extrabold"
                style={{ fontSize: `${fontSizes.center * 0.7}px` }}
              >
                {displayName.includes('小') ? '小王' : '大王'}
              </div>
            </div>
          ) : (
            // 普通牌显示
            <div 
              className={`font-black ${
                isWildCard ? 'text-red-600 font-extrabold' : 
                'text-gray-800'
              }`}
              style={{ fontSize: `${fontSizes.center}px` }}
            >
              {displayName}
            </div>
          )}
        </div>


        {/* 选中状态指示器 - 方形适配 */}
        {isSelected && (
          <div className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border border-white shadow-sm">
          </div>
        )}
      </div>
    </div>
  );
};

export default CardImage;
