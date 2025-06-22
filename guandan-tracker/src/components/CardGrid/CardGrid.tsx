import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Card from './Card';
import type { Card as CardType, GameRank, Team, PlayerPosition, Suit } from '../../types';
import { Rank } from '../../types/game';
import { 
  getCardOrderValue, 
  compareCards, 
  isRankCard, 
  isWildCard, 
  isJoker, 
  getRankName 
} from '../../utils/rankUtils';

// 分组显示选项
export type GroupByOption = 'rank' | 'suit' | 'level';

// 卡牌分组接口
interface CardGroup {
  id: string;
  label: string;
  cards: CardType[];
  priority: number;
}

interface CardGridProps {
  /** 卡牌列表 */
  cards: CardType[];
  /** 当前级数 */
  currentRank: GameRank;
  /** 卡牌尺寸 */
  size?: 'small' | 'medium' | 'large';
  /** 分组方式 */
  groupBy?: GroupByOption;
  /** 是否允许多选 */
  allowMultiSelect?: boolean;
  /** 是否显示操作栏 */
  showControls?: boolean;
  /** 是否显示统计信息 */
  showStats?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 卡牌点击事件 */
  onCardClick?: (card: CardType) => void;
  /** 卡牌长按事件 */
  onCardLongPress?: (card: CardType) => void;
  /** 批量选择变更事件 */
  onSelectionChange?: (selectedCards: CardType[]) => void;
  /** 队伍归属获取函数 */
  getCardOwnerTeam?: (card: CardType) => Team | undefined;
  /** 多拥有者信息获取函数 */
  getCardOwners?: (card: CardType) => Array<{ team: Team; position: PlayerPosition; count: number }> | undefined;
}

const CardGrid: React.FC<CardGridProps> = ({
  cards,
  currentRank,
  size = 'medium',
  groupBy = 'rank',
  allowMultiSelect = false,
  showControls = true,
  showStats = true,
  className = '',
  onCardClick,
  onCardLongPress,
  onSelectionChange,
  getCardOwnerTeam,
  getCardOwners
}) => {
  // 状态管理
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [currentArea, setCurrentArea] = useState<string>('');
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
  
  // 引用
  const gridRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  // 智能排序函数
  const sortCards = useCallback((cardList: CardType[]): CardType[] => {
    return [...cardList].sort((a, b) => {
      // 使用掼蛋规则排序
      const comparison = compareCards(a, b, currentRank);
      return -comparison; // 降序排列，高牌在前
    });
  }, [currentRank]);

  // 分组函数
  const groupCards = useCallback((cardList: CardType[]): CardGroup[] => {
    const groups: CardGroup[] = [];
    
    switch (groupBy) {
      case 'level': {
        // 按级牌/非级牌分组
        const wildCards = cardList.filter(card => isWildCard(card, currentRank));
        const rankCards = cardList.filter(card => isRankCard(card, currentRank) && !isWildCard(card, currentRank));
        const jokers = cardList.filter(card => isJoker(card));
        const normalCards = cardList.filter(card => 
          !isRankCard(card, currentRank) && !isWildCard(card, currentRank) && !isJoker(card)
        );

        if (wildCards.length > 0) {
          groups.push({
            id: 'wild',
            label: `配牌 (${wildCards.length})`,
            cards: sortCards(wildCards),
            priority: 4
          });
        }

        if (rankCards.length > 0) {
          groups.push({
            id: 'rank',
            label: `级牌 (${rankCards.length})`,
            cards: sortCards(rankCards),
            priority: 3
          });
        }

        if (jokers.length > 0) {
          groups.push({
            id: 'jokers',
            label: `大小王 (${jokers.length})`,
            cards: sortCards(jokers),
            priority: 2
          });
        }

        if (normalCards.length > 0) {
          groups.push({
            id: 'normal',
            label: `普通牌 (${normalCards.length})`,
            cards: sortCards(normalCards),
            priority: 1
          });
        }
        break;
      }

      case 'suit': {
        // 按花色分组
        const suitGroups = new Map<string, CardType[]>();
        const jokers: CardType[] = [];

        cardList.forEach(card => {
          if (isJoker(card)) {
            jokers.push(card);
          } else if (card.suit) {
            const suitKey = card.suit;
            if (!suitGroups.has(suitKey)) {
              suitGroups.set(suitKey, []);
            }
            suitGroups.get(suitKey)!.push(card);
          }
        });

        const suitOrder = ['hearts', 'diamonds', 'clubs', 'spades'];
        const suitNames = {
          'hearts': '♥ 红心',
          'diamonds': '♦ 方块',
          'clubs': '♣ 梅花',
          'spades': '♠ 黑桃'
        };

        suitOrder.forEach((suit, index) => {
          const suitCards = suitGroups.get(suit);
          if (suitCards && suitCards.length > 0) {
            groups.push({
              id: suit,
              label: `${suitNames[suit as keyof typeof suitNames]} (${suitCards.length})`,
              cards: sortCards(suitCards),
              priority: 4 - index
            });
          }
        });

        if (jokers.length > 0) {
          groups.push({
            id: 'jokers',
            label: `大小王 (${jokers.length})`,
            cards: sortCards(jokers),
            priority: 5
          });
        }
        break;
      }

      case 'rank':
      default: {
        // 按数值分组
        const rankGroups = new Map<number, CardType[]>();
        const jokers: CardType[] = [];

        cardList.forEach(card => {
          if (isJoker(card)) {
            jokers.push(card);
          } else {
            const rankKey = card.rank;
            if (!rankGroups.has(rankKey)) {
              rankGroups.set(rankKey, []);
            }
            rankGroups.get(rankKey)!.push(card);
          }
        });

        // 按掼蛋权重排序
        const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => {
          const cardA = { rank: a } as CardType;
          const cardB = { rank: b } as CardType;
          return -compareCards(cardA, cardB, currentRank);
        });

        sortedRanks.forEach(rank => {
          const rankCards = rankGroups.get(rank)!;
          const displayName = getRankName(rank as GameRank);
          const isCurrentRank = rank === currentRank;
          
          groups.push({
            id: `rank-${rank}`,
            label: `${displayName}${isCurrentRank ? ' (级牌)' : ''} (${rankCards.length})`,
            cards: sortCards(rankCards),
            priority: getCardOrderValue({ rank } as CardType, currentRank)
          });
        });

        if (jokers.length > 0) {
          groups.push({
            id: 'jokers',
            label: `大小王 (${jokers.length})`,
            cards: sortCards(jokers),
            priority: 1000
          });
        }
        break;
      }
    }

    return groups.sort((a, b) => b.priority - a.priority);
  }, [groupBy, currentRank, sortCards]);

  // 计算分组后的卡牌
  const cardGroups = useMemo(() => groupCards(cards), [cards, groupCards]);

  // 统计信息
  const stats = useMemo(() => {
    const wildCards = cards.filter(card => isWildCard(card, currentRank)).length;
    const rankCards = cards.filter(card => isRankCard(card, currentRank) && !isWildCard(card, currentRank)).length;
    const jokers = cards.filter(card => isJoker(card)).length;
    const normal = cards.length - wildCards - rankCards - jokers;
    const selected = selectedCards.size;

    return { total: cards.length, wildCards, rankCards, jokers, normal, selected };
  }, [cards, currentRank, selectedCards.size]);

  // 滚动监听，显示当前区域
  useEffect(() => {
    const handleScroll = () => {
      if (!gridRef.current) return;

      const scrollTop = gridRef.current.scrollTop;
      const containerHeight = gridRef.current.clientHeight;
      const midPoint = scrollTop + containerHeight / 2;

      let currentSection = '';
      sectionRefs.current.forEach((element, id) => {
        const rect = element.getBoundingClientRect();
        const containerRect = gridRef.current!.getBoundingClientRect();
        const elementTop = rect.top - containerRect.top + scrollTop;
        const elementBottom = elementTop + rect.height;

        if (midPoint >= elementTop && midPoint <= elementBottom) {
          currentSection = id;
        }
      });

      setCurrentArea(currentSection);
    };

    const gridElement = gridRef.current;
    if (gridElement) {
      gridElement.addEventListener('scroll', handleScroll);
      handleScroll(); // 初始化
      return () => gridElement.removeEventListener('scroll', handleScroll);
    }
  }, [cardGroups]);

  // 处理卡牌点击
  const handleCardClick = useCallback((card: CardType) => {
    if (isMultiSelectMode) {
      const newSelected = new Set(selectedCards);
      if (newSelected.has(card.id)) {
        newSelected.delete(card.id);
      } else {
        newSelected.add(card.id);
      }
      setSelectedCards(newSelected);
      onSelectionChange?.(cards.filter(c => newSelected.has(c.id)));
    } else {
      onCardClick?.(card);
    }
  }, [isMultiSelectMode, selectedCards, cards, onCardClick, onSelectionChange]);

  // 处理长按开始
  const handleTouchStart = useCallback((card: CardType) => {
    if (allowMultiSelect && !isMultiSelectMode) {
      const timer = setTimeout(() => {
        setIsMultiSelectMode(true);
        const newSelected = new Set([card.id]);
        setSelectedCards(newSelected);
        onSelectionChange?.([card]);
        onCardLongPress?.(card);
      }, 500); // 500ms长按

      setLongPressTimer(timer);
    }
  }, [allowMultiSelect, isMultiSelectMode, onCardLongPress, onSelectionChange]);

  // 处理触摸结束
  const handleTouchEnd = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  // 跳转到级牌
  const scrollToRankCards = useCallback(() => {
    const rankGroup = cardGroups.find(group => 
      group.id === 'rank' || group.id === 'wild' || group.id.includes('rank')
    );
    
    if (rankGroup) {
      const element = sectionRefs.current.get(rankGroup.id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [cardGroups]);

  // 全选/反选
  const handleSelectAll = useCallback(() => {
    if (selectedCards.size === cards.length) {
      // 全部已选，执行反选
      setSelectedCards(new Set());
      onSelectionChange?.([]);
    } else {
      // 执行全选
      const allIds = new Set(cards.map(card => card.id));
      setSelectedCards(allIds);
      onSelectionChange?.(cards);
    }
  }, [cards, selectedCards.size, onSelectionChange]);

  // 退出多选模式
  const exitMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(false);
    setSelectedCards(new Set());
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  // 分组选项按钮样式
  const getGroupButtonStyle = (option: GroupByOption) => {
    return groupBy === option
      ? 'btn-primary text-xs px-3 py-1'
      : 'btn-outline text-xs px-3 py-1';
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* 控制栏 */}
      {showControls && (
        <div className="flex-shrink-0 card-enhanced glassmorphism p-4 m-2 fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 text-shadow">
              🃏 卡牌列表 {stats.total > 0 && `(${stats.total}张)`}
            </h3>
            
            {/* 当前区域提示 */}
            {currentArea && (
              <div className="text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-xl font-medium bounce">
                📍 {cardGroups.find(g => g.id === currentArea)?.label || ''}
              </div>
            )}
          </div>

          {/* 分组选项 */}
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-sm font-medium text-gray-700">🔄 分组方式:</span>
            <button
              onClick={() => groupBy !== 'rank' && window.dispatchEvent(new CustomEvent('groupByChange', { detail: 'rank' }))}
              className={getGroupButtonStyle('rank')}
            >
              🔢 按数值
            </button>
            <button
              onClick={() => groupBy !== 'suit' && window.dispatchEvent(new CustomEvent('groupByChange', { detail: 'suit' }))}
              className={getGroupButtonStyle('suit')}
            >
              🌈 按花色
            </button>
            <button
              onClick={() => groupBy !== 'level' && window.dispatchEvent(new CustomEvent('groupByChange', { detail: 'level' }))}
              className={getGroupButtonStyle('level')}
            >
              ⭐ 按级牌
            </button>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={scrollToRankCards}
                className="bg-yellow-500 text-white px-3 py-1 text-sm rounded-xl font-medium shadow-md
                         transition-all duration-200 ease-in-out hover:bg-yellow-600 hover:shadow-lg
                         active:scale-95 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
              >
                🎯 跳转到级牌
              </button>
              
              {allowMultiSelect && (
                <button
                  onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                  className={`px-3 py-1 text-sm rounded-xl font-medium shadow-md
                           transition-all duration-200 ease-in-out hover:shadow-lg
                           active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    isMultiSelectMode 
                      ? 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500' 
                      : 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500'
                  }`}
                >
                  {isMultiSelectMode ? '❌ 退出多选' : '☑️ 多选模式'}
                </button>
              )}
            </div>

            {/* 多选操作 */}
            {isMultiSelectMode && (
              <div className="flex items-center space-x-2 fade-in">
                <span className="text-sm text-gray-600 font-medium">
                  ✨ 已选择 {selectedCards.size} 张
                </span>
                <button
                  onClick={handleSelectAll}
                  className="bg-green-500 text-white px-3 py-1 text-sm rounded-xl font-medium shadow-md
                           transition-all duration-200 ease-in-out hover:bg-green-600 hover:shadow-lg
                           active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  {selectedCards.size === cards.length ? '🔄 反选' : '✅ 全选'}
                </button>
                <button
                  onClick={exitMultiSelectMode}
                  className="btn-secondary text-sm"
                >
                  ❌ 取消
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 统计信息 */}
      {showStats && (
        <div className="flex-shrink-0 card-enhanced glassmorphism mx-2 mb-2 px-4 py-2 fade-in">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div className="bg-red-100 rounded-xl p-3 hover:bg-red-200 transition-colors duration-200">
              <div className="text-lg font-bold text-red-600">{stats.wildCards}</div>
              <div className="text-xs text-red-500 font-medium">🔥 配牌</div>
            </div>
            <div className="bg-yellow-100 rounded-xl p-3 hover:bg-yellow-200 transition-colors duration-200">
              <div className="text-lg font-bold text-yellow-600">{stats.rankCards}</div>
              <div className="text-xs text-yellow-500 font-medium">⭐ 级牌</div>
            </div>
            <div className="bg-purple-100 rounded-xl p-3 hover:bg-purple-200 transition-colors duration-200">
              <div className="text-lg font-bold text-purple-600">{stats.jokers}</div>
              <div className="text-xs text-purple-500 font-medium">👑 大小王</div>
            </div>
            <div className="bg-gray-100 rounded-xl p-3 hover:bg-gray-200 transition-colors duration-200">
              <div className="text-lg font-bold text-gray-600">{stats.normal}</div>
              <div className="text-xs text-gray-500 font-medium">🃏 普通牌</div>
            </div>
            <div className="bg-blue-100 rounded-xl p-3 hover:bg-blue-200 transition-colors duration-200">
              <div className="text-lg font-bold text-blue-600">{stats.selected}</div>
              <div className="text-xs text-blue-500 font-medium">✨ 已选择</div>
            </div>
          </div>
        </div>
      )}

      {/* 卡牌网格 */}
      <div 
        ref={gridRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4"
      >
        {cardGroups.map((group, index) => (
          <div
            key={group.id}
            ref={(el) => {
              if (el) {
                sectionRefs.current.set(group.id, el);
              } else {
                sectionRefs.current.delete(group.id);
              }
            }}
            className="card-enhanced glassmorphism p-4 fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* 分组标题 */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-900 text-shadow">{group.label}</h4>
              <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-lg font-medium">
                {group.cards.filter(card => selectedCards.has(card.id)).length > 0 && 
                  `✨ ${group.cards.filter(card => selectedCards.has(card.id)).length} 张已选`
                }
              </div>
            </div>

            {/* 卡牌网格 */}
            <div className={`grid gap-3 ${
              size === 'small' 
                ? 'grid-cols-8 md:grid-cols-12 lg:grid-cols-16' 
                : size === 'large'
                ? 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8'
                : 'grid-cols-6 md:grid-cols-8 lg:grid-cols-12'
            }`}>
              {group.cards.map((card, cardIndex) => (
                                  <div
                    key={card.id}
                    style={{ animationDelay: `${(index * 100) + (cardIndex * 20)}ms` }}
                    className={`
                      ${isMultiSelectMode ? 'transform-none' : 'hover:-translate-y-1'}
                      ${selectedCards.has(card.id) ? 'card-enhanced selected shadow-strong' : 'card-enhanced hover:shadow-lg'}
                      transition-all duration-200 ease-in-out fade-in
                    `}
                  >
                    <Card
                      card={{
                        ...card,
                        isSelected: selectedCards.has(card.id)
                      }}
                      size={size}
                      ownerTeam={getCardOwnerTeam?.(card)}
                      owners={getCardOwners?.(card)}
                      animated={!isMultiSelectMode}
                      onClick={() => handleCardClick(card)}
                      onTouchStart={() => handleTouchStart(card)}
                      onTouchEnd={handleTouchEnd}
                    />
                  </div>
              ))}
            </div>
          </div>
        ))}

        {/* 空状态 */}
        {cardGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 fade-in">
            <svg className="w-16 h-16 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-lg font-medium text-gray-600">🃏 暂无卡牌</p>
            <p className="text-sm text-gray-500">请添加卡牌或检查筛选条件</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardGrid;