import type { Card, PlayerPosition, Rank } from '../types/game';

/** 记牌输入只按点数展示，花色由系统在后台自动分配。 */
export const QUICK_INPUT_RANKS: Rank[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
];

export interface QuickCardParseResult {
  ranks: Rank[];
  error?: string;
}

export interface QuickPlayCommandParseResult extends QuickCardParseResult {
  action: 'cards' | 'pass';
  playerPosition?: PlayerPosition;
  explicitPlayer: boolean;
  commitImmediately: boolean;
}

/**
 * 极速模式下，游戏中的合法点数输入默认直接记入。
 * 手牌录入阶段仍保留确认步骤，避免误改初始手牌。
 */
export function shouldCommitQuickPlay(
  command: QuickPlayCommandParseResult,
  isGamePlaying: boolean
): boolean {
  if (command.action !== 'cards' || command.ranks.length === 0) return false;
  return command.commitImmediately || isGamePlaying;
}

/** 解析紧凑点数：7890J、10JQKA、8888、A2345、王炸。 */
export function parseQuickCardText(input: string): QuickCardParseResult {
  const compactText = input
    .trim()
    .toUpperCase()
    .replace(/[\s,，、+]+/g, '');

  if (!compactText) {
    return { ranks: [], error: '请输入点数，例如 7890J' };
  }

  if (compactText === '王炸') {
    return { ranks: [15, 15, 16, 16] };
  }

  const ranks: Rank[] = [];
  let cursor = 0;

  while (cursor < compactText.length) {
    const remainingText = compactText.slice(cursor);

    if (remainingText.startsWith('小王')) {
      ranks.push(15);
      cursor += 2;
      continue;
    }
    if (remainingText.startsWith('大王')) {
      ranks.push(16);
      cursor += 2;
      continue;
    }
    if (remainingText.startsWith('10')) {
      ranks.push(10);
      cursor += 2;
      continue;
    }

    const token = compactText[cursor];
    if (token >= '2' && token <= '9') {
      ranks.push(Number(token) as Rank);
    } else if (token === '0' || token === 'T') {
      ranks.push(10);
    } else if (token === 'J') {
      ranks.push(11);
    } else if (token === 'Q') {
      ranks.push(12);
    } else if (token === 'K') {
      ranks.push(13);
    } else if (token === 'A') {
      ranks.push(14);
    } else if (token === '小') {
      ranks.push(15);
    } else if (token === '大') {
      ranks.push(16);
    } else {
      return {
        ranks: [],
        error: `无法识别“${token}”，支持 2-9、0/10/T、JQKA、小王和大王`
      };
    }
    cursor += 1;
  }

  return { ranks };
}

/**
 * 解析手机快捷指令。
 * - 上/下/对/我用于指定玩家；
 * - “出”表示验证成功后直接记入出牌记录；
 * - “过”直接记录该玩家过牌；
 * - 不写“出”时保持原行为：只加入待确认选牌。
 */
export function parseQuickPlayCommand(input: string): QuickPlayCommandParseResult {
  let commandText = input.trim();
  const playerAliases: Array<[string, PlayerPosition]> = [
    ['自己', 'bottom'],
    ['上家', 'right'],
    ['下家', 'left'],
    ['对家', 'top'],
    ['队友', 'top'],
    ['我', 'bottom'],
    ['上', 'right'],
    ['下', 'left'],
    ['对', 'top']
  ];

  let playerPosition: PlayerPosition | undefined;
  for (const [alias, position] of playerAliases) {
    if (commandText.startsWith(alias)) {
      playerPosition = position;
      commandText = commandText.slice(alias.length).trim();
      break;
    }
  }

  commandText = commandText.replace(/^[:：]/, '').trim();
  const passCommand = commandText.toUpperCase();
  if (passCommand === '过' || passCommand === '不要' || passCommand === 'PASS') {
    return {
      action: 'pass',
      ranks: [],
      playerPosition,
      explicitPlayer: Boolean(playerPosition),
      commitImmediately: true
    };
  }

  const directPlayMatch = commandText.match(/^出(?:牌|了)?/);
  const commitImmediately = Boolean(directPlayMatch);
  if (directPlayMatch) {
    commandText = commandText.slice(directPlayMatch[0].length).trim();
  }

  const parsedCards = parseQuickCardText(commandText);
  return {
    action: 'cards',
    ranks: parsedCards.ranks,
    error: parsedCards.error,
    playerPosition,
    explicitPlayer: Boolean(playerPosition),
    commitImmediately
  };
}

/**
 * 为一次点数点击挑选一张真实卡牌。
 * 普通牌优先于红心配牌，避免用户只是输入级牌时过早消耗配牌。
 */
export function pickNextCardByRank(
  cards: Card[],
  selectedIds: ReadonlySet<string>,
  rank: Rank,
  isSelectable: (cardId: string) => boolean,
  blockedIds: ReadonlySet<string> = new Set()
): Card | undefined {
  return cards
    .filter(card =>
      card.rank === rank &&
      !card.isPlayed &&
      !selectedIds.has(card.id) &&
      !blockedIds.has(card.id) &&
      isSelectable(card.id)
    )
    .sort((left, right) => Number(left.isWildCard) - Number(right.isWildCard))[0];
}

export interface PickCardsByRanksResult {
  success: boolean;
  selectedIds: Set<string>;
  missingRank?: Rank;
  missingExplicitWildCard?: boolean;
}

/**
 * 语音口令中的“红心8/红心J”表示明确要求使用实体配牌。
 * 先锁定这些红心级牌，再从剩余点数中选择普通牌，避免普通级牌抢占配牌位置。
 */
export function pickCardsByVoiceRanks(
  cards: Card[],
  ranks: Rank[],
  explicitWildCardRanks: Rank[],
  isSelectable: (cardId: string) => boolean,
  blockedIds: ReadonlySet<string> = new Set()
): PickCardsByRanksResult {
  const selectedIds = new Set<string>();
  const remainingRanks = [...ranks];

  for (const wildRank of explicitWildCardRanks) {
    const requestedRankIndex = remainingRanks.indexOf(wildRank);
    if (requestedRankIndex < 0) {
      return {
        success: false,
        selectedIds: new Set(),
        missingRank: wildRank,
        missingExplicitWildCard: true
      };
    }

    const wildCard = cards.find(card =>
      card.rank === wildRank &&
      card.isWildCard &&
      !card.isPlayed &&
      !selectedIds.has(card.id) &&
      !blockedIds.has(card.id) &&
      isSelectable(card.id)
    );
    if (!wildCard) {
      return {
        success: false,
        selectedIds: new Set(),
        missingRank: wildRank,
        missingExplicitWildCard: true
      };
    }

    selectedIds.add(wildCard.id);
    remainingRanks.splice(requestedRankIndex, 1);
  }

  return pickCardsByRanks(
    cards,
    selectedIds,
    remainingRanks,
    isSelectable,
    blockedIds
  );
}

/** 原子批量选牌：任一点数不足时保持原选择不变。 */
export function pickCardsByRanks(
  cards: Card[],
  selectedIds: ReadonlySet<string>,
  ranks: Rank[],
  isSelectable: (cardId: string) => boolean,
  blockedIds: ReadonlySet<string> = new Set()
): PickCardsByRanksResult {
  const nextSelectedIds = new Set(selectedIds);

  for (const rank of ranks) {
    const nextCard = pickNextCardByRank(
      cards,
      nextSelectedIds,
      rank,
      isSelectable,
      blockedIds
    );

    if (!nextCard) {
      return {
        success: false,
        selectedIds: new Set(selectedIds),
        missingRank: rank
      };
    }
    nextSelectedIds.add(nextCard.id);
  }

  return { success: true, selectedIds: nextSelectedIds };
}

/** 撤销该点数最近选择的一张真实卡牌。 */
export function removeLastSelectedCardByRank(
  cards: Card[],
  selectedIds: ReadonlySet<string>,
  rank: Rank
): Set<string> {
  const selectedCardId = [...selectedIds]
    .reverse()
    .find(cardId => cards.some(card => card.id === cardId && card.rank === rank));

  const nextSelected = new Set(selectedIds);
  if (selectedCardId) {
    nextSelected.delete(selectedCardId);
  }
  return nextSelected;
}
