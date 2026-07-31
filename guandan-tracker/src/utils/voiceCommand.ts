import type { PlayerPosition, Rank } from '../types/game';
import { parseQuickCardText } from './quickCardInput';

export interface VoiceCommandAction {
  playerPosition?: PlayerPosition;
  action: 'play' | 'pass' | 'undo';
  ranks?: Rank[];
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

const SAME_RANK_COUNTS: Record<string, number> = {
  '二': 2,
  '两': 2,
  '2': 2,
  '三': 3,
  '3': 3,
  '四': 4,
  '4': 4,
  '五': 5,
  '5': 5,
  '六': 6,
  '6': 6,
  '七': 7,
  '7': 7,
  '八': 8,
  '8': 8
};

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
    .replace(/^(?:请)?(?:帮我)?(?:记牌|记录|录入)/, '');

/**
 * 将一个或多个口述点数转换成极速输入格式。
 * 这里刻意不合并重复数字：8888 必须保留为四张 8。
 */
const normalizeRankExpression = (input: string): string =>
  input
    .normalize('NFKC')
    .trim()
    .toUpperCase()
    .replace(/小鬼/g, '小王')
    .replace(/大鬼/g, '大王')
    .replace(/勾|钩|沟|杰/g, 'J')
    .replace(/圈/g, 'Q')
    .replace(/凯|开/g, 'K')
    .replace(/尖|爱司|艾斯/g, 'A')
    .replace(/零/g, '0')
    .replace(/十/g, '0')
    .replace(/二|两/g, '2')
    .replace(/三/g, '3')
    .replace(/四/g, '4')
    .replace(/五/g, '5')
    .replace(/六/g, '6')
    .replace(/七/g, '7')
    .replace(/八/g, '8')
    .replace(/九/g, '9')
    .replace(/(?:和|跟|加|还有|再|的|牌|张|个)/g, '');

const parseRanks = (input: string): Rank[] | null => {
  const normalized = normalizeRankExpression(input);
  const parsed = parseQuickCardText(normalized);
  return parsed.error || parsed.ranks.length === 0 ? null : parsed.ranks;
};

const parseSingleRank = (input: string): Rank | null => {
  const ranks = parseRanks(input);
  return ranks?.length === 1 ? ranks[0] : null;
};

const repeatRank = (rank: Rank, count: number): Rank[] =>
  Array.from({ length: count }, () => rank);

export const formatVoiceRanks = (ranks: Rank[]): string =>
  ranks.map(rank => RANK_TO_QUICK_TEXT[rank] ?? String(rank)).join('');

const parseSpokenCards = (input: string): Rank[] | null => {
  if (input === '王炸') {
    return [15, 15, 16, 16];
  }

  const tripleWithPair = input.match(
    /^(?:三|3)(?:个|张)?(.+?)带(?:一对|对|两张|两个|二张|二个|2张|2个)?(.+)$/
  );
  if (tripleWithPair) {
    const mainRank = parseSingleRank(tripleWithPair[1]);
    const pairRank = parseSingleRank(tripleWithPair[2]);
    if (mainRank && pairRank) {
      return [...repeatRank(mainRank, 3), ...repeatRank(pairRank, 2)];
    }
  }

  const countedCards = input.match(/^([二两三四五六七八2-8])(?:个|张)(.+)$/);
  if (countedCards) {
    const count = SAME_RANK_COUNTS[countedCards[1]];
    const rank = parseSingleRank(countedCards[2]);
    if (count && rank) {
      return repeatRank(rank, count);
    }
  }

  const pair = input.match(/^(?:一对|对|两个|两张|二个|二张|2个|2张)(.+)$/);
  if (pair) {
    const rank = parseSingleRank(pair[1]);
    if (rank) return repeatRank(rank, 2);
  }

  const bomb = input.match(/^(?:炸弹|炸)(.+)$/) ?? input.match(/^(.+)炸弹$/);
  if (bomb) {
    const rank = parseSingleRank(bomb[1]);
    if (rank) return repeatRank(rank, 4);
  }

  const triple = input.match(/^(?:三|3)(?:个|张)?(.+)$/);
  if (triple) {
    const rank = parseSingleRank(triple[1]);
    if (rank) return repeatRank(rank, 3);
  }

  const single = input.match(/^(?:单张|一张|单)(.+)$/);
  if (single) {
    const rank = parseSingleRank(single[1]);
    if (rank) return [rank];
  }

  return parseRanks(input);
};

/**
 * 解析单个使用者播报的短口令。除“撤销”外必须包含玩家位置，
 * 玩家词同时充当唤醒词，避免把牌桌聊天误记为出牌。
 */
export function parseVoiceTranscript(input: string): ParsedVoiceTranscript {
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
      error: '请以上家、下家、对家或我开头'
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

  const ranks = parseSpokenCards(commandText);
  if (!ranks) {
    return {
      normalizedText: `${playerLabel}${commandText}`,
      error: `无法识别牌面“${commandText}”`
    };
  }

  const normalizedText = `${playerLabel}${formatVoiceRanks(ranks)}`;
  return {
    normalizedText,
    command: {
      action: 'play',
      playerPosition,
      ranks,
      normalizedText
    }
  };
}

export const getVoiceCommandKey = (
  command: Pick<VoiceCommandAction, 'action' | 'playerPosition' | 'ranks'>
): string => [
  command.action,
  command.playerPosition ?? '',
  ...(command.ranks ?? [])
].join(':');
