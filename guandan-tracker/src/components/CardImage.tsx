/**
 * 卡牌图像组件
 * 支持 SVG 生成的卡牌图像显示
 */

import React from 'react';
import type { GameRank } from '../types/game';

// ==================== 类型定义 ====================

interface CardImageProps {
  /** 卡牌等级 */
  rank: GameRank | 15; // 15表示王
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
function getCardDisplayName(rank: GameRank | 15): string {
  if (rank === 15) return 'JOKER';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  return rank.toString();
}

/**
 * 获取花色符号
 */
function getSuitSymbol(suit: string): string {
  switch (suit) {
    case 'hearts': return '♥';
    case 'diamonds': return '♦';
    case 'clubs': return '♣';
    case 'spades': return '♠';
    default: return '';
  }
}

/**
 * 获取花色颜色
 */
function getSuitColor(suit: string): string {
  return suit === 'hearts' || suit === 'diamonds' ? '#dc2626' : '#1f2937';
}

// ==================== 主组件 ====================

export const CardImage: React.FC<CardImageProps> = ({
  rank,
  suit = 'hearts',
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
  const suitSymbol = getSuitSymbol(suit);
  const suitColor = getSuitColor(suit);
  const isJoker = rank === 15;
  
  // 根据尺寸设置SVG尺寸
  const getSvgSize = () => {
    switch (size) {
      case 'tiny': return { width: 20, height: 30, viewBox: '0 0 24 36' };
      case 'small': return { width: 30, height: 45, viewBox: '0 0 36 54' };
      case 'large': return { width: 60, height: 90, viewBox: '0 0 72 108' };
      default: return { width: 40, height: 60, viewBox: '0 0 48 72' };
    }
  };
  
  const svgSize = getSvgSize();
  
  // 根据尺寸调整字体大小
  const getFontSizes = () => {
    switch (size) {
      case 'tiny': return { corner: 6, center: 14 };
      case 'small': return { corner: 7, center: 18 };
      case 'large': return { corner: 12, center: 32 };
      default: return { corner: 8, center: 24 };
    }
  };
  
  const fontSizes = getFontSizes();
  
  // 卡牌背景色
  const cardBg = isSelected ? '#dbeafe' : '#ffffff';
  const borderColor = isSelected ? '#3b82f6' : remainingCount > 0 ? '#d1d5db' : '#e5e7eb';
  const borderWidth = isSelected ? '3' : '2';
  
  return (
    <div
      className={`relative cursor-pointer transition-all transform hover:scale-105 ${
        isSelected ? 'scale-105 shadow-lg' : 'hover:shadow-md'
      } ${remainingCount === 0 ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      onClick={remainingCount > 0 ? (e) => onClick?.(e) : undefined}
      onDoubleClick={remainingCount > 0 ? (e) => onDoubleClick?.(e) : undefined}
      onContextMenu={remainingCount > 0 ? (e) => onContextMenu?.(e) : undefined}
      onTouchStart={remainingCount > 0 ? (e) => onTouchStart?.(e) : undefined}
      onMouseDown={remainingCount > 0 ? (e) => onMouseDown?.(e) : undefined}
      onMouseEnter={onMouseEnter}
    >
      {/* 卡牌主体 SVG */}
      <svg
        width={svgSize.width}
        height={svgSize.height}
        viewBox={svgSize.viewBox}
        className="drop-shadow-sm"
      >
        {/* 卡牌背景 */}
        <rect
          x="2"
          y="2"
          width="44"
          height="68"
          rx="6"
          ry="6"
          fill={cardBg}
          stroke={borderColor}
          strokeWidth={borderWidth}
        />
        
        {/* 王牌特殊处理 */}
        {isJoker ? (
          <g>
            {/* 王字背景 */}
            <circle cx="24" cy="24" r="12" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2"/>
            <text
              x="24"
              y="30"
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill="#92400e"
            >
              {displayName.includes('小') ? '小' : '大'}
            </text>
            <text
              x="24"
              y="42"
              textAnchor="middle"
              fontSize="8"
              fontWeight="bold"
              fill="#92400e"
            >
              王
            </text>
            
            {/* 配牌标识 */}
            {isWildCard && (
              <circle cx="38" cy="8" r="3" fill="#dc2626"/>
            )}
          </g>
        ) : (
          <g>
            {/* 左上角数字/字母 */}
            <text
              x="6"
              y="12"
              fontSize={fontSizes.corner}
              fontWeight="bold"
              fill={suitColor}
            >
              {displayName}
            </text>
            
            {/* 左上角花色 */}
            <text
              x="6"
              y={12 + fontSizes.corner + 2}
              fontSize={fontSizes.corner + 2}
              fill={suitColor}
            >
              {suitSymbol}
            </text>
            
            {/* 简洁的中心花色 - 只显示花色符号 */}
            <text
              x="24"
              y="40"
              textAnchor="middle"
              fontSize={fontSizes.center}
              fill={suitColor}
              opacity="0.8"
            >
              {suitSymbol}
            </text>
            
            {/* 右下角倒置数字/字母 */}
            <text
              x="42"
              y="62"
              fontSize={fontSizes.corner}
              fontWeight="bold"
              fill={suitColor}
              transform="rotate(180 42 62)"
            >
              {displayName}
            </text>
            
            {/* 右下角倒置花色 */}
            <text
              x="42"
              y="52"
              fontSize={fontSizes.corner + 2}
              fill={suitColor}
              transform="rotate(180 42 52)"
            >
              {suitSymbol}
            </text>
          </g>
        )}
        
        {/* 级数牌背景高亮 */}
        {isRankCard && !isWildCard && (
          <rect
            x="2"
            y="2"
            width="44"
            height="68"
            rx="6"
            ry="6"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="4,2"
            opacity="0.6"
          />
        )}
        
        {/* 配牌红心标识 */}
        {isWildCard && !isJoker && (
          <g>
            <circle cx="38" cy="8" r="4" fill="#dc2626"/>
            <text
              x="38"
              y="12"
              textAnchor="middle"
              fontSize="8"
              fill="white"
              fontWeight="bold"
            >
              ♥
            </text>
          </g>
        )}
      </svg>
      
      
      {/* 选中状态指示器 */}
      {isSelected && (
        <div className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full" />
        </div>
      )}
    </div>
  );
};

export default CardImage;