import { PlayType } from '../types/game';
import type { PlayType as GamePlayType } from '../types/game';

/** 将规则验证器的内部名称统一成历史记录和 AI 使用的标准牌型。 */
export function normalizePlayType(ruleType: string, cardCount: number): GamePlayType {
  if (ruleType === 'flush_straight') return PlayType.STRAIGHT_FLUSH;
  if (ruleType === 'consecutive_pairs' || ruleType === 'wooden_board') {
    return PlayType.PAIR_STRAIGHT;
  }
  if (ruleType === 'steel_board') return PlayType.TRIPLE_STRAIGHT;
  if (ruleType === 'airplane') return PlayType.PLANE;
  if (ruleType === 'four_kings') return PlayType.FOUR_KINGS;

  if (ruleType === 'bomb') {
    if (cardCount >= 8) return PlayType.BOMB_EIGHT;
    if (cardCount === 7) return PlayType.BOMB_SEVEN;
    if (cardCount === 6) return PlayType.BOMB_SIX;
    if (cardCount === 5) return PlayType.BOMB_FIVE;
    return PlayType.BOMB_FOUR;
  }

  const standardType = Object.values(PlayType).find(type => type === ruleType);
  return standardType ?? PlayType.SINGLE;
}
