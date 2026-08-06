import type { Card } from '../types/game';
import type { CardType } from './guandanRules';

const isConsecutive = (ranks: number[]): boolean =>
  ranks.length > 0 &&
  ranks.every((rank, index) =>
    rank <= 14 && (index === 0 || rank === ranks[index - 1] + 1)
  );

/** 斗地主常用牌型校验。记牌器只判断牌型合法性，不负责比较能否压过上家。 */
export function validateDoudizhuCardType(cards: Card[]): CardType {
  if (cards.length === 0) {
    return { type: 'invalid', description: '请选择卡牌', isValid: false };
  }

  const counts = new Map<number, number>();
  cards.forEach(card => counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1));
  const entries = [...counts.entries()].sort(([left], [right]) => left - right);
  const frequencies = entries.map(([, count]) => count).sort((a, b) => b - a);
  const ranks = entries.map(([rank]) => rank);

  if (
    cards.length === 2 &&
    counts.get(15) === 1 &&
    counts.get(16) === 1
  ) {
    return { type: 'four_kings', description: '王炸', isValid: true, cardCount: 2 };
  }
  if (cards.length === 1) {
    return { type: 'single', description: '单张', isValid: true, cardCount: 1 };
  }
  if (cards.length === 2 && entries.length === 1) {
    return { type: 'pair', description: '对子', isValid: true, cardCount: 2 };
  }
  if (cards.length === 3 && entries.length === 1) {
    return { type: 'triple', description: '三张', isValid: true, cardCount: 3 };
  }
  if (cards.length === 4 && entries.length === 1) {
    return { type: 'bomb', description: '四张炸弹', isValid: true, cardCount: 4 };
  }
  if (cards.length === 4 && frequencies[0] === 3) {
    return { type: 'triple_with_pair', description: '三带一', isValid: true, cardCount: 4 };
  }
  if (cards.length === 5 && frequencies[0] === 3 && frequencies[1] === 2) {
    return { type: 'triple_with_pair', description: '三带一对', isValid: true, cardCount: 5 };
  }
  if (
    (cards.length === 6 && frequencies[0] === 4) ||
    (cards.length === 8 && frequencies[0] === 4 && frequencies.slice(1).every(count => count === 2))
  ) {
    return { type: 'airplane', description: '四带二', isValid: true, cardCount: cards.length };
  }
  if (
    cards.length >= 5 &&
    entries.length === cards.length &&
    isConsecutive(ranks)
  ) {
    return { type: 'straight', description: '顺子', isValid: true, cardCount: cards.length };
  }
  if (
    cards.length >= 6 &&
    cards.length % 2 === 0 &&
    entries.every(([, count]) => count === 2) &&
    isConsecutive(ranks)
  ) {
    return { type: 'consecutive_pairs', description: '连对', isValid: true, cardCount: cards.length };
  }

  const tripleRanks = entries
    .filter(([rank, count]) => rank <= 14 && count >= 3)
    .map(([rank]) => rank);
  if (tripleRanks.length >= 2 && isConsecutive(tripleRanks)) {
    const bodyCount = tripleRanks.length * 3;
    const wingCount = cards.length - bodyCount;
    if (wingCount === 0) {
      return { type: 'steel_board', description: '三顺', isValid: true, cardCount: cards.length };
    }
    if (wingCount === tripleRanks.length || wingCount === tripleRanks.length * 2) {
      return { type: 'airplane', description: '飞机带翅膀', isValid: true, cardCount: cards.length };
    }
  }

  return {
    type: 'invalid',
    description: '不符合斗地主常用牌型',
    isValid: false
  };
}

