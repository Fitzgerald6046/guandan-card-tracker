import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { GameRank, Card } from '../../types';
import { getRankName, getNextRank, getPreviousRank, countRankCards } from '../../utils/rankUtils';

interface RankSelectorProps {
  /** 当前级数 */
  currentRank: GameRank;
  /** 级数变更回调 */
  onRankChange: (rank: GameRank) => void;
  /** 所有卡牌数据（用于统计） */
  allCards?: Card[];
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

interface RankStats {
  rankCards: number;
  wildCards: number;
  totalCards: number;
}

const VALID_RANKS: GameRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const RankSelector: React.FC<RankSelectorProps> = ({
  currentRank,
  onRankChange,
  allCards = [],
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingRank, setPendingRank] = useState<GameRank | null>(null);
  const [stats, setStats] = useState<RankStats>({ rankCards: 0, wildCards: 0, totalCards: 0 });
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const selectorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 计算级牌统计
  const calculateStats = useCallback((rank: GameRank, cards: Card[]): RankStats => {
    if (cards.length === 0) {
      return { rankCards: 0, wildCards: 0, totalCards: 0 };
    }

    const { rankCards, wildCards, total } = countRankCards(cards, rank);
    return {
      rankCards,
      wildCards,
      totalCards: total
    };
  }, []);

  // 处理级数选择
  const handleRankSelection = useCallback((rank: GameRank) => {
    if (rank === currentRank) return;

    setPendingRank(rank);
    setShowConfirmDialog(true);
    setIsOpen(false);
  }, [currentRank]);

  // 更新统计信息
  useEffect(() => {
    setStats(calculateStats(currentRank, allCards));
  }, [currentRank, allCards, calculateStats]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled) return;

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          handleRankSelection(getPreviousRank(currentRank));
          break;
        case 'ArrowDown':
          event.preventDefault();
          handleRankSelection(getNextRank(currentRank));
          break;
        case 'Escape':
          setIsOpen(false);
          break;
        case 'Enter':
        case ' ':
          if (isOpen) {
            setIsOpen(false);
          } else {
            setIsOpen(true);
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [currentRank, disabled, isOpen, handleRankSelection]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectorRef.current &&
        !selectorRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // 确认级数变更
  const confirmRankChange = () => {
    if (pendingRank) {
      onRankChange(pendingRank);
      setPendingRank(null);
    }
    setShowConfirmDialog(false);
  };

  // 取消级数变更
  const cancelRankChange = () => {
    setPendingRank(null);
    setShowConfirmDialog(false);
  };

  // 触摸事件处理
  const handleTouchStart = (event: React.TouchEvent) => {
    if (disabled) return;
    
    const touch = event.touches[0];
    setTouchStartX(touch.clientX);
    setIsDragging(false);
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (disabled || touchStartX === null) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartX;
    
    if (Math.abs(deltaX) > 10) {
      setIsDragging(true);
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (disabled || touchStartX === null || !isDragging) {
      setTouchStartX(null);
      setIsDragging(false);
      return;
    }
    
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const threshold = 50;
    
    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0) {
        // 向右滑动 - 上一级
        handleRankSelection(getPreviousRank(currentRank));
      } else {
        // 向左滑动 - 下一级
        handleRankSelection(getNextRank(currentRank));
      }
    }
    
    setTouchStartX(null);
    setIsDragging(false);
  };

  return (
    <>
      <div className={`relative ${className}`}>
        {/* 主要选择器 */}
        <div
          ref={selectorRef}
          className={`
            bg-white rounded-lg shadow-lg border border-gray-200 p-4
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-xl'}
            transition-all duration-300 select-none
            ${isDragging ? 'scale-105' : ''}
          `}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={`当前级数: ${getRankName(currentRank)}`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-600 mb-1">当前级数</div>
              <div className="flex items-center space-x-3">
                <div className="text-3xl font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-1 min-w-[4rem] text-center">
                  {getRankName(currentRank)}
                </div>
                <div className="text-xs text-gray-500">
                  <div>下一级: {getRankName(getNextRank(currentRank))}</div>
                  <div className="mt-1 text-green-600">滑动切换</div>
                </div>
              </div>
            </div>
            
            {/* 展开图标 */}
            <div className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* 统计信息 */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-red-50 rounded-lg p-2">
                <div className="text-lg font-semibold text-red-600">{stats.rankCards}</div>
                <div className="text-xs text-red-500">级牌</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-2">
                <div className="text-lg font-semibold text-purple-600">{stats.wildCards}</div>
                <div className="text-xs text-purple-500">配牌</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <div className="text-lg font-semibold text-gray-600">{stats.totalCards}</div>
                <div className="text-xs text-gray-500">总数</div>
              </div>
            </div>
          </div>
        </div>

        {/* 下拉菜单 */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-64 overflow-y-auto"
            role="listbox"
            aria-label="级数选择"
          >
            <div className="p-2">
              <div className="text-sm font-medium text-gray-700 mb-2 px-2">选择级数</div>
              <div className="grid grid-cols-7 gap-1">
                {VALID_RANKS.map((rank) => {
                  const isSelected = rank === currentRank;
                  const rankStats = calculateStats(rank, allCards);
                  
                  return (
                    <button
                      key={rank}
                      onClick={() => handleRankSelection(rank)}
                      className={`
                        relative p-2 rounded-lg border font-semibold text-sm min-h-[3rem]
                        transition-all duration-200 hover:scale-105
                        ${isSelected
                          ? 'bg-blue-500 text-white border-blue-500 shadow-lg'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-300'
                        }
                      `}
                      role="option"
                      aria-selected={isSelected}
                      aria-label={`级数 ${getRankName(rank)}, 级牌 ${rankStats.rankCards} 张`}
                    >
                      <div className="text-base">{getRankName(rank)}</div>
                      {rankStats.rankCards > 0 && (
                        <div className={`text-xs mt-1 ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                          {rankStats.rankCards}张
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 确认对话框 */}
      {showConfirmDialog && pendingRank && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                确认级数变更
              </h3>
              
              <p className="text-gray-600 mb-6">
                将级数从 <span className="font-semibold text-blue-600">{getRankName(currentRank)}</span> 
                {' '}改为{' '}
                <span className="font-semibold text-blue-600">{getRankName(pendingRank)}</span>？
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                <div className="text-sm text-yellow-800">
                  <div className="font-medium mb-1">⚠️ 注意</div>
                  <div>变更级数将重新计算所有卡牌的级牌标记</div>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={cancelRankChange}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  取消
                </button>
                <button
                  onClick={confirmRankChange}
                  className="flex-1 px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors duration-200"
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RankSelector;
