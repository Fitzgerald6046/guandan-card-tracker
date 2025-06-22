/**
 * 触摸选择Hook - 支持滑动批量选择卡牌
 * 完全重写以支持新的类型系统
 */

import { useState, useCallback, useRef } from 'react';
import type { 
  Card, 
  TouchSelectState, 
  TouchEventData, 
  TouchEventType 
} from '../types/game';

import { getCardsInRange } from '../utils/gameUtils';

// ==================== 常量配置 ====================

const TOUCH_CONFIG = {
  /** 长按触发时间（毫秒） */
  LONG_PRESS_DURATION: 500,
  
  /** 最小移动距离（像素） */
  MIN_MOVE_DISTANCE: 10,
  
  /** 选择反馈延迟（毫秒） */
  SELECTION_FEEDBACK_DELAY: 50
} as const;

// ==================== Hook ====================

export function useTouchSelect() {
  // ==================== 状态管理 ====================
  
  const [touchState, setTouchState] = useState<TouchSelectState>({
    isSelecting: false,
    startCard: null,
    selectedCards: [],
    startTime: undefined
  });

  // 使用ref存储不需要触发重渲染的状态
  const touchRef = useRef({
    startCoordinates: { x: 0, y: 0 },
    currentCoordinates: { x: 0, y: 0 },
    longPressTimer: null as NodeJS.Timeout | null,
    isLongPress: false,
    hasMoved: false
  });

  // ==================== 工具函数 ====================

  /**
   * 计算两点间距离
   */
  const calculateDistance = useCallback((
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): number => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  /**
   * 清除长按定时器
   */
  const clearLongPressTimer = useCallback(() => {
    if (touchRef.current.longPressTimer) {
      clearTimeout(touchRef.current.longPressTimer);
      touchRef.current.longPressTimer = null;
    }
  }, []);

  /**
   * 重置触摸状态
   */
  const resetTouchState = useCallback(() => {
    clearLongPressTimer();
    touchRef.current.isLongPress = false;
    touchRef.current.hasMoved = false;
    
    setTouchState({
      isSelecting: false,
      startCard: null,
      selectedCards: [],
      startTime: undefined
    });
  }, [clearLongPressTimer]);

  // ==================== 事件处理器 ====================

  /**
   * 处理触摸开始
   */
  const handleTouchStart = useCallback((
    card: Card,
    coordinates: { x: number; y: number }
  ) => {
    const now = Date.now();
    
    // 记录起始信息
    touchRef.current.startCoordinates = coordinates;
    touchRef.current.currentCoordinates = coordinates;
    touchRef.current.hasMoved = false;
    touchRef.current.isLongPress = false;

    // 设置选择状态
    setTouchState({
      isSelecting: true,
      startCard: card,
      selectedCards: [card],
      startTime: now
    });

    // 设置长按定时器
    touchRef.current.longPressTimer = setTimeout(() => {
      touchRef.current.isLongPress = true;
      // 触觉反馈（如果支持）
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, TOUCH_CONFIG.LONG_PRESS_DURATION);

  }, []);

  /**
   * 处理触摸移动
   */
  const handleTouchMove = useCallback((
    card: Card,
    coordinates: { x: number; y: number },
    allCards: Card[]
  ) => {
    if (!touchState.isSelecting || !touchState.startCard) return;

    // 更新当前坐标
    touchRef.current.currentCoordinates = coordinates;

    // 检查是否移动了足够距离
    const distance = calculateDistance(touchRef.current.startCoordinates, coordinates);
    if (distance > TOUCH_CONFIG.MIN_MOVE_DISTANCE) {
      touchRef.current.hasMoved = true;
      clearLongPressTimer(); // 移动时取消长按
    }

    // 如果正在移动，更新选择范围
    if (touchRef.current.hasMoved || touchRef.current.isLongPress) {
      const rangeCards = getCardsInRange(touchState.startCard, card, allCards);
      
      setTouchState(prev => ({
        ...prev,
        selectedCards: rangeCards
      }));
    }
  }, [touchState.isSelecting, touchState.startCard, calculateDistance, clearLongPressTimer]);

  /**
   * 处理触摸结束
   */
  const handleTouchEnd = useCallback((
    coordinates?: { x: number; y: number }
  ): Card[] => {
    clearLongPressTimer();

    if (!touchState.isSelecting) return [];

    const selectedCards = [...touchState.selectedCards];
    const wasLongPress = touchRef.current.isLongPress;
    const hasMoved = touchRef.current.hasMoved;

    // 重置状态
    resetTouchState();

    // 返回选中的卡牌
    return selectedCards;
  }, [touchState.isSelecting, touchState.selectedCards, clearLongPressTimer, resetTouchState]);

  /**
   * 处理触摸取消
   */
  const handleTouchCancel = useCallback(() => {
    resetTouchState();
    return [];
  }, [resetTouchState]);

  /**
   * 手动清除选择
   */
  const clearSelection = useCallback(() => {
    resetTouchState();
  }, [resetTouchState]);

  // ==================== 高级操作 ====================

  /**
   * 切换单张卡牌选择状态
   */
  const toggleSingleCard = useCallback((card: Card): Card[] => {
    return [{ ...card, isSelected: !card.isSelected }];
  }, []);

  /**
   * 选择范围内的所有卡牌
   */
  const selectRange = useCallback((
    startCard: Card,
    endCard: Card,
    allCards: Card[]
  ): Card[] => {
    return getCardsInRange(startCard, endCard, allCards);
  }, []);

  /**
   * 基于条件选择卡牌
   */
  const selectByCondition = useCallback((
    allCards: Card[],
    condition: (card: Card) => boolean
  ): Card[] => {
    return allCards.filter(condition);
  }, []);

  // ==================== 便捷选择器 ====================

  /**
   * 选择所有级牌
   */
  const selectAllRankCards = useCallback((allCards: Card[]): Card[] => {
    return selectByCondition(allCards, card => card.isRankCard);
  }, [selectByCondition]);

  /**
   * 选择所有配牌
   */
  const selectAllWildCards = useCallback((allCards: Card[]): Card[] => {
    return selectByCondition(allCards, card => card.isWildCard);
  }, [selectByCondition]);

  /**
   * 选择同花色卡牌
   */
  const selectSameSuit = useCallback((allCards: Card[], targetSuit: string): Card[] => {
    return selectByCondition(allCards, card => card.suit === targetSuit);
  }, [selectByCondition]);

  /**
   * 选择同点数卡牌
   */
  const selectSameRank = useCallback((allCards: Card[], targetRank: number): Card[] => {
    return selectByCondition(allCards, card => card.rank === targetRank);
  }, [selectByCondition]);

  // ==================== 状态查询 ====================

  /**
   * 获取当前选择统计
   */
  const getSelectionStats = useCallback(() => {
    const { selectedCards } = touchState;
    
    return {
      count: selectedCards.length,
      hasRankCards: selectedCards.some(card => card.isRankCard),
      hasWildCards: selectedCards.some(card => card.isWildCard),
      suits: [...new Set(selectedCards.map(card => card.suit).filter(Boolean))],
      ranks: [...new Set(selectedCards.map(card => card.rank))],
      isConsecutive: false, // TODO: 实现连续性检查
      isValidPlay: false    // TODO: 实现出牌有效性检查
    };
  }, [touchState]);

  // ==================== 返回值 ====================

  return {
    // 状态
    touchState,
    isSelecting: touchState.isSelecting,
    selectedCards: touchState.selectedCards,
    selectionStats: getSelectionStats(),

    // 基础事件处理
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    clearSelection,

    // 高级操作
    toggleSingleCard,
    selectRange,
    selectByCondition,

    // 便捷选择器
    selectAllRankCards,
    selectAllWildCards,
    selectSameSuit,
    selectSameRank,

    // 配置
    config: TOUCH_CONFIG
  };
}

/**
 * 简化版触摸选择Hook - 适用于基础场景
 */
export function useSimpleTouchSelect() {
  const {
    touchState,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    clearSelection
  } = useTouchSelect();

  const handleCardTouch = useCallback((
    eventType: TouchEventType,
    card: Card,
    coordinates: { x: number; y: number },
    allCards?: Card[]
  ): Card[] => {
    switch (eventType) {
      case 'start':
        handleTouchStart(card, coordinates);
        return [];
        
      case 'move':
        if (allCards) {
          handleTouchMove(card, coordinates, allCards);
        }
        return [];
        
      case 'end':
        return handleTouchEnd(coordinates);
        
      case 'cancel':
        clearSelection();
        return [];
        
      default:
        return [];
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, clearSelection]);

  return {
    touchState,
    handleCardTouch,
    clearSelection
  };
}

export type UseTouchSelectReturn = ReturnType<typeof useTouchSelect>;
export type UseSimpleTouchSelectReturn = ReturnType<typeof useSimpleTouchSelect>;