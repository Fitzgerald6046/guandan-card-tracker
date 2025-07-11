/**
 * 语音识别模块类型定义
 */
export type PlayerIdentifier = 'me' | 'up' | 'partner' | 'down';
export type ActionType = 'PLAY' | 'PASS' | 'UNDO' | 'RESET';
export type CardPattern = 'single' | 'pair' | 'triple' | 'full_house' | 'straight' | 'consecutive_pairs' | 'consecutive_triples' | 'bomb' | 'flush_straight' | 'joker_bomb';
export type CardValue = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '小王' | '大王';
export interface ParsedCommand {
    player: PlayerIdentifier;
    action: ActionType;
    playDetails?: {
        pattern: CardPattern;
        rawDescription: string;
        mainCard?: CardValue;
        attachCard?: CardValue;
        count?: number;
        startCard?: CardValue;
    };
    confidence?: number;
    timestamp: number;
}
export interface VoiceConfig {
    synonymMap: {
        [key: string]: string[];
    };
    cardMap: {
        [key: string]: CardValue;
    };
    playerMap: {
        [key: string]: PlayerIdentifier;
    };
}
export interface VoiceRecognitionResult {
    text: string;
    confidence: number;
    alternatives?: string[];
}
export interface VoiceError {
    code: string;
    message: string;
    type: 'network' | 'permission' | 'recognition' | 'parsing';
}
export interface ParseRule {
    name: string;
    pattern: RegExp;
    parser: (player: PlayerIdentifier, match: RegExpMatchArray) => Omit<ParsedCommand, 'timestamp'>;
    priority: number;
}
export interface TestCase {
    input: string;
    expected: ParsedCommand | null;
    description: string;
}
export type VoiceRecognitionState = 'idle' | 'listening' | 'processing' | 'success' | 'error';
export interface VoiceEvents {
    onStateChange: (state: VoiceRecognitionState) => void;
    onResult: (result: VoiceRecognitionResult) => void;
    onCommand: (command: ParsedCommand) => void;
    onError: (error: VoiceError) => void;
}
//# sourceMappingURL=voice-types.d.ts.map