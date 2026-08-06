import type { GameRank, PlayerPosition, Rank } from '../types/game';
import { parseQuickCardText } from './quickCardInput';

export interface VoiceCommandAction {
  playerPosition?: PlayerPosition;
  action: 'play' | 'pass' | 'undo';
  ranks?: Rank[];
  /** 用户明确说出的红心级牌，例如“红心8”；必须选中真实配牌，不能拿普通8代替。 */
  wildCardRanks?: Rank[];
  rawText: string;
  normalizedText: string;
  confidence: number;
  timestamp: number;
}

export interface VoiceCommandOutcome {
  success: boolean;
  message: string;
}

export interface ParsedVoiceTranscript {
  command?: Omit<VoiceCommandAction, 'rawText' | 'confidence' | 'timestamp'>;
  normalizedText: string;
  error?: string;
}

const PLAYER_ALIASES: Array<[string, PlayerPosition, string]> = [
  ['自己', 'bottom', '我'],
  ['上家', 'right', '上'],
  ['上手', 'right', '上'],
  ['下家', 'left', '下'],
  ['下手', 'left', '下'],
  ['对家', 'top', '对'],
  ['对门', 'top', '对'],
  ['队友', 'top', '对'],
  ['我', 'bottom', '我'],
  ['上', 'right', '上'],
  ['下', 'left', '下'],
  ['对', 'top', '对']
];

const RANK_TO_QUICK_TEXT: Record<number, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '0',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
  15: '小王',
  16: '大王'
};

const compactTranscript = (input: string): string =>
  input
    .normalize('NFKC')
    .trim()
    .toUpperCase()
    .replace(/[，。！？、,.!?；;：:\s]+/g, '')
    // 手机普通话识别经常把“下家”写成“夏家/下架”，把“对家”写成“队家”。
    // 只修正句首玩家称呼，避免误改后面的正常牌桌用语。
    .replace(/^(?:夏家|下架|下加|吓家|夏加|夏嘉|瞎家)/, '下家')
    .replace(/^夏(?=(?:[一二三四五六七八九十两俩0-9]|个|张|大王|小王))/, '下')
    .replace(/^(?:上架|上加|尚家)/, '上家')
    .replace(/^(?:队家|对加|对嘉)/, '对家')
    // “队友”不与对子牌型冲突，作为对家最稳的推荐称呼；兼容常见同音识别。
    .replace(/^(?:队有|对友|队油|队右|对有)/, '队友')
    .replace(/红星|红新|红芯|红兴/g, '红心')
    .replace(/^(?:请)?(?:帮我)?(?:记牌|记录|录入)/, '');

// 单字“对”既可能表示对家，也可能表示对子；“上/下”也可能出现在自然口语中。
// 批量拆分只能使用不会与牌型冲突的玩家称呼，否则“我对7”“三张4带对6”会被误切。
const SAFE_BATCH_PLAYER_ALIASES = PLAYER_ALIASES
  .map(([alias]) => alias)
  .filter(alias => alias.length > 1 || alias === '我')
  .sort((left, right) => right.length - left.length);

/**
 * 仅拆分带有多个明确玩家称呼的连续播报，例如“我7上家8下家9”。
 * “上对7对8对9”必须保留为一条牌型命令，表示三对连牌。
 */
export const splitVoiceTranscript = (input: string): string[] => {
  const compact = compactTranscript(input);
  if (!compact) return [];

  const aliasPattern = new RegExp(`(?:${SAFE_BATCH_PLAYER_ALIASES.join('|')})`, 'g');
  const matches = [...compact.matchAll(aliasPattern)];
  if (matches.length <= 1 || matches[0].index !== 0) return [compact];

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = index + 1 < matches.length
      ? (matches[index + 1].index ?? compact.length)
      : compact.length;
    return compact.slice(start, end);
  }).filter(Boolean);
};

/**
 * 先把浏览器常见的同音字、英文读音和花色描述归一化，但保留“张/个/对/带”等结构词。
 * 红心级牌在记牌器中仍按真实点数记录，因此“红心勾”最终记为 J。
 */
const normalizeSpokenCardExpression = (input: string): string =>
  input
    .normalize('NFKC')
    .trim()
    .toUpperCase()
    .replace(/[，。！？、,.!?；;：:\s]+/g, '')
    .replace(/小鬼|小怪/g, '小王')
    .replace(/大鬼|大怪/g, '大王')
    .replace(/勾|钩|沟|杰/g, 'J')
    .replace(/圈/g, 'Q')
    .replace(/凯|开/g, 'K')
    .replace(/爱司|艾斯|尖|E[IY]|诶|欸|哎/g, 'A')
    // “有红心”但没说具体点数时只能作为牌型说明，不能确定是哪张实体牌。
    .replace(/有红心$/g, '')
    .replace(/红心(?:配牌|配)|红桃(?:配牌|配)/g, '♥')
    .replace(/红桃|红心/g, '♥')
    .replace(/黑桃|方片|方块|梅花/g, '')
    .replace(/同花顺|顺子|钢板|木板/g, '')
    .replace(/配牌|百搭|癞子|赖子/g, '♥')
    .replace(/♥+/g, '♥')
    .replace(/单张|单/g, '1张')
    .replace(/零|拾|十/g, '0')
    // 手机普通话识别经常把“八”识别成“吧/巴/扒”，统一按点数 8 处理。
    .replace(/捌|吧|巴|扒/g, '8')
    .replace(/壹|一/g, '1')
    .replace(/贰|俩|二|两/g, '2')
    .replace(/叁|三/g, '3')
    .replace(/肆|四/g, '4')
    .replace(/伍|五/g, '5')
    .replace(/陆|六/g, '6')
    .replace(/柒|七/g, '7')
    .replace(/八/g, '8')
    .replace(/玖|九/g, '9')
    // “六七八十红心勾”在部分手机上会被压成“六80红星勾”。
    // 该窄规则只修复这一种五张顺子口令，不扩散到普通散牌。
    .replace(/^680(?=♥J$)/, '6780')
    .replace(/(?:还有|然后|再来|再|的|牌|只|枚)/g, '');

interface CanonicalRankToken {
  rank: Rank;
  length: number;
  isExplicitWildCard: boolean;
}

const readCanonicalRank = (
  input: string,
  cursor: number,
  currentRank?: GameRank
): CanonicalRankToken | null => {
  const tokenStart = cursor;
  let isExplicitWildCard = false;
  if (input[cursor] === '♥') {
    isExplicitWildCard = true;
    cursor += 1;
  }

  const remaining = input.slice(cursor);
  // “红心配/配牌”没有重复说当前级数时，直接使用牌局正在打的级数。
  // 例如打8时，“一张6红心配”等同于“一张6红心8”。
  if (
    isExplicitWildCard &&
    currentRank !== undefined &&
    (remaining.length === 0 || /^(?:带|和|跟|加|有)/.test(remaining))
  ) {
    return {
      rank: currentRank,
      length: cursor - tokenStart,
      isExplicitWildCard: true
    };
  }

  let rank: Rank | null = null;
  let rankLength = 0;
  if (remaining.startsWith('小王')) {
    rank = 15;
    rankLength = 2;
  } else if (remaining.startsWith('大王')) {
    rank = 16;
    rankLength = 2;
  } else if (remaining.startsWith('10')) {
    rank = 10;
    rankLength = 2;
  } else {
    const token = input[cursor];
    if (token >= '2' && token <= '9') rank = Number(token) as Rank;
    else if (token === '0' || token === 'T') rank = 10;
    else if (token === 'J') rank = 11;
    else if (token === 'Q') rank = 12;
    else if (token === 'K') rank = 13;
    else if (token === 'A' || token === 'S') rank = 14;
    else if (token === '小') rank = 15;
    else if (token === '大') rank = 16;
    if (rank !== null) rankLength = 1;
  }

  if (rank === null) return null;
  cursor += rankLength;

  return {
    rank,
    length: cursor - tokenStart,
    isExplicitWildCard
  };
};

const repeatRank = (rank: Rank, count: number): Rank[] =>
  Array.from({ length: count }, () => rank);

interface ParsedSpokenCards {
  ranks: Rank[];
  wildCardRanks: Rank[];
}

export const formatVoiceRanks = (ranks: Rank[]): string =>
  ranks.map(rank => RANK_TO_QUICK_TEXT[rank] ?? String(rank)).join('');

/**
 * 按口语片段逐段扫描，支持：
 * - 对7 / 7对 / 两张7；
 * - 三张10三张J、对7对8对9；
 * - 三张4带对6；
 * - 三张圈红心勾、67810红心勾。
 */
const parseSpokenCards = (
  input: string,
  currentRank?: GameRank
): ParsedSpokenCards | null => {
  const normalized = normalizeSpokenCardExpression(input);
  if (!normalized) return null;
  if (normalized === '王炸') {
    return { ranks: [15, 15, 16, 16], wildCardRanks: [] };
  }

  const ranks: Rank[] = [];
  const wildCardRanks: Rank[] = [];
  const addRank = (rankToken: CanonicalRankToken, count = 1) => {
    ranks.push(...repeatRank(rankToken.rank, count));
    if (rankToken.isExplicitWildCard) {
      wildCardRanks.push(...repeatRank(rankToken.rank, count));
    }
  };
  let cursor = 0;

  while (cursor < normalized.length) {
    const remaining = normalized.slice(cursor);

    const connector = ['带', '和', '跟', '加', '有'].find(word => remaining.startsWith(word));
    if (connector) {
      cursor += connector.length;
      continue;
    }

    if (remaining.startsWith('炸弹') || remaining.startsWith('炸')) {
      const prefixLength = remaining.startsWith('炸弹') ? 2 : 1;
      const rankToken = readCanonicalRank(
        normalized,
        cursor + prefixLength,
        currentRank
      );
      if (!rankToken) return null;
      addRank(rankToken, 4);
      cursor += prefixLength + rankToken.length;
      continue;
    }

    const counted = remaining.match(/^([1-8])(?:个|张)/);
    if (counted) {
      const count = Number(counted[1]);
      const rankToken = readCanonicalRank(
        normalized,
        cursor + counted[0].length,
        currentRank
      );
      if (!rankToken) return null;
      addRank(rankToken, count);
      cursor += counted[0].length + rankToken.length;
      continue;
    }

    const pairPrefix = ['1对', '对', '2个', '2张'].find(prefix => remaining.startsWith(prefix));
    if (pairPrefix) {
      const rankToken = readCanonicalRank(
        normalized,
        cursor + pairPrefix.length,
        currentRank
      );
      if (!rankToken) return null;
      addRank(rankToken, 2);
      cursor += pairPrefix.length + rankToken.length;
      continue;
    }

    const rankToken = readCanonicalRank(normalized, cursor, currentRank);
    if (!rankToken) return null;
    cursor += rankToken.length;

    if (normalized.startsWith('炸弹', cursor)) {
      addRank(rankToken, 4);
      cursor += 2;
    } else if (normalized.startsWith('对', cursor)) {
      addRank(rankToken, 2);
      cursor += 1;
    } else {
      addRank(rankToken);
    }
  }

  if (ranks.length === 0) return null;
  const quickCheck = parseQuickCardText(formatVoiceRanks(ranks));
  return quickCheck.error ? null : { ranks, wildCardRanks };
};

/**
 * 解析单个使用者播报的短口令。除“撤销”外必须包含玩家位置，
 * 玩家词同时充当唤醒词，避免把牌桌聊天误记为出牌。
 */
export function parseVoiceTranscript(
  input: string,
  currentRank?: GameRank
): ParsedVoiceTranscript {
  let commandText = compactTranscript(input);
  if (!commandText) {
    return { normalizedText: '', error: '没有听到有效口令' };
  }

  if (/^(?:撤销|撤回|退回|取消上一步|上一步)$/.test(commandText)) {
    return {
      normalizedText: '撤销',
      command: {
        action: 'undo',
        normalizedText: '撤销'
      }
    };
  }

  let playerPosition: PlayerPosition | undefined;
  let playerLabel = '';
  for (const [alias, position, label] of PLAYER_ALIASES) {
    if (commandText.startsWith(alias)) {
      playerPosition = position;
      playerLabel = label;
      commandText = commandText.slice(alias.length);
      break;
    }
  }

  if (!playerPosition) {
    return {
      normalizedText: commandText,
      error: '请以上家、下家、队友/对家或我开头'
    };
  }

  commandText = commandText.replace(
    /^(?:出的是|出的牌是|出了|出牌|出|打出了|打出|打|走了|走)/
    , ''
  );

  if (/^(?:过|不要|要不起|过牌|PASS)$/.test(commandText)) {
    const normalizedText = `${playerLabel}过`;
    return {
      normalizedText,
      command: {
        action: 'pass',
        playerPosition,
        normalizedText
      }
    };
  }

  const parsedCards = parseSpokenCards(commandText, currentRank);
  if (!parsedCards) {
    return {
      normalizedText: `${playerLabel}${commandText}`,
      error: `无法识别牌面“${commandText}”`
    };
  }

  const wildCardCounts = new Map<Rank, number>();
  parsedCards.wildCardRanks.forEach(rank => {
    wildCardCounts.set(rank, (wildCardCounts.get(rank) ?? 0) + 1);
  });
  const displayRanks = [...parsedCards.ranks];
  const normalizedCards = displayRanks.map(rank => {
    const remainingWildCards = wildCardCounts.get(rank) ?? 0;
    if (remainingWildCards > 0) {
      wildCardCounts.set(rank, remainingWildCards - 1);
      return `♥${RANK_TO_QUICK_TEXT[rank] ?? String(rank)}`;
    }
    return RANK_TO_QUICK_TEXT[rank] ?? String(rank);
  }).join('');
  const normalizedText = `${playerLabel}${normalizedCards}`;
  return {
    normalizedText,
    command: {
      action: 'play',
      playerPosition,
      ranks: parsedCards.ranks,
      wildCardRanks: parsedCards.wildCardRanks.length > 0
        ? parsedCards.wildCardRanks
        : undefined,
      normalizedText
    }
  };
}

export const isIncompleteVoiceTranscript = (input: string): boolean => {
  let commandText = compactTranscript(input);
  const playerAlias = PLAYER_ALIASES.find(([alias]) => commandText.startsWith(alias));
  if (!playerAlias) return false;

  commandText = commandText.slice(playerAlias[0].length).replace(
    /^(?:出的是|出的牌是|出了|出牌|出|打出了|打出|打|走了|走)/,
    ''
  );
  if (!commandText) return true;

  const normalized = normalizeSpokenCardExpression(commandText);
  return /^(?:[1-8](?:个|张)|1对|2个|2张|对)$/.test(normalized);
};

export const parseVoiceTranscriptBatch = (
  input: string,
  currentRank?: GameRank
): ParsedVoiceTranscript[] =>
  splitVoiceTranscript(input).map(transcript =>
    parseVoiceTranscript(transcript, currentRank)
  );

export const getVoiceCommandKey = (
  command: Pick<VoiceCommandAction, 'action' | 'playerPosition' | 'ranks' | 'wildCardRanks'>
): string => [
  command.action,
  command.playerPosition ?? '',
  ...(command.ranks ?? []),
  'wild',
  ...(command.wildCardRanks ?? [])
].join(':');
