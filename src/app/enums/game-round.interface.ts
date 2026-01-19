export interface GameRoundPayload {
  category: string;
  question: string;
  type: 'QUIZ' | 'TRUE_FALSE';
  options: string[];
  correctAnswer: string;
}

export interface GameRound {
  id: number;
  status: string;
  payload: GameRoundPayload;
  type: string;
  roundIndex: number;
}
