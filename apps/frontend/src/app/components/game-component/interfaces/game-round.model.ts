import {GameModeType} from './game-mode-type';

export interface GameRound {
  id: number;
  type: GameModeType;
  status: 'ACTIVE' | 'REVEAL' | 'ENDED';
  payload: GamePayload;
}

export interface GamePayload {
  question: string;
  correctAnswer: string;
  options?: string[] | null;
  imageUrl?: string;
  hint?: string;
  type: GameModeType;
}

export interface PlayerResponse {
  playerName: string;
  answerIndex: number;
  responseTimeMs: number;
}
