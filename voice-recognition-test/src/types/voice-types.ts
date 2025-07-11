/**
 * 语音识别模块类型定义
 */

// 玩家标识符 - 优化为更简洁的格式
export type PlayerIdentifier = 'me' | 'up' | 'partner' | 'down';

// 动作类型
export type ActionType = 'PLAY' | 'PASS' | 'UNDO' | 'RESET';

// 牌型定义
export type CardPattern = 
  | 'single'              // 单张
  | 'pair'               // 对子  
  | 'triple'             // 三张
  | 'full_house'         // 三带二
  | 'straight'           // 顺子
  | 'consecutive_pairs'   // 连对
  | 'consecutive_triples' // 飞机/钢板
  | 'bomb'               // 炸弹
  | 'flush_straight'     // 同花顺
  | 'joker_bomb';        // 王炸

// 牌面值定义
export type CardValue = 
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' 
  | 'J' | 'Q' | 'K' | 'A' 
  | '小王' | '大王';

// 解析后的指令对象（核心数据结构）
export interface ParsedCommand {
  player: PlayerIdentifier;     // 出牌玩家
  action: ActionType;          // 执行的动作
  playDetails?: {              // 出牌详情（仅当action为PLAY时）
    pattern: CardPattern;      // 牌型
    rawDescription: string;    // 原始语音描述
    mainCard?: CardValue;      // 主牌（如三张的8）
    attachCard?: CardValue;    // 带牌（如三带二的2）
    count?: number;           // 数量（如顺子张数、炸弹个数）
    startCard?: CardValue;    // 起始牌（如顺子的起始）
  };
  confidence?: number;         // 识别置信度
  timestamp: number;          // 时间戳
}

// 语音识别配置
export interface VoiceConfig {
  // 同义词映射 - 处理方言和发音差异
  synonymMap: {
    [key: string]: string[];
  };
  
  // 数字映射 - 处理中文数字和花牌
  cardMap: {
    [key: string]: CardValue;
  };
  
  // 玩家映射
  playerMap: {
    [key: string]: PlayerIdentifier;
  };
}

// 语音识别结果
export interface VoiceRecognitionResult {
  text: string;               // 识别的文本
  confidence: number;         // 置信度
  alternatives?: string[];    // 备选结果
}

// 语音识别错误类型
export interface VoiceError {
  code: string;
  message: string;
  type: 'network' | 'permission' | 'recognition' | 'parsing';
}

// 解析规则定义
export interface ParseRule {
  name: string;
  pattern: RegExp;
  parser: (player: PlayerIdentifier, match: RegExpMatchArray) => Omit<ParsedCommand, 'timestamp'>;
  priority: number; // 规则优先级，数字越大优先级越高
}

// 测试用例类型
export interface TestCase {
  input: string;
  expected: ParsedCommand | null;
  description: string;
}

// 语音识别状态
export type VoiceRecognitionState = 
  | 'idle'        // 空闲
  | 'listening'   // 正在监听
  | 'processing'  // 正在处理
  | 'success'     // 成功
  | 'error';      // 错误

// 语音识别事件
export interface VoiceEvents {
  onStateChange: (state: VoiceRecognitionState) => void;
  onResult: (result: VoiceRecognitionResult) => void;
  onCommand: (command: ParsedCommand) => void;
  onError: (error: VoiceError) => void;
}