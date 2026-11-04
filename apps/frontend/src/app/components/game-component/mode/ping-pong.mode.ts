import { signal } from '@angular/core';
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

type Side = 'a' | 'b';

interface CourtSide {
  playerName: string;
  score: number;
  isBot: boolean;
}

interface PingQuestion {
  text: string;
  options: string[];
  correctIndex: number;
}

interface CourtEvent {
  kind: 'return' | 'goal';
  side: Side;
  id: number;
}

interface Court {
  id: number;
  a: CourtSide;
  b: CourtSide;
  winner: string | null;
  turn: Side;
  serveLeft: number;
  question: PingQuestion | null;
  lastEvent: CourtEvent | null;
  awarded: boolean;
}

const POINTS_TO_WIN = 5;
const SERVE_SECONDS = 12;

const QUESTION_BANK: PingQuestion[] = [
  { text: "Qual è la capitale dell'Australia?", options: ['Canberra', 'Sydney', 'Melbourne', 'Perth'], correctIndex: 0 },
  { text: 'Chi ha dipinto la Gioconda?', options: ['Leonardo da Vinci', 'Michelangelo', 'Raffaello', 'Caravaggio'], correctIndex: 0 },
  { text: 'Quante corde ha un violino?', options: ['4', '5', '6', '3'], correctIndex: 0 },
  { text: 'In che anno è caduto il Muro di Berlino?', options: ['1989', '1991', '1987', '1985'], correctIndex: 0 },
  { text: "Qual è il fiume più lungo d'Italia?", options: ['Po', 'Tevere', 'Adige', 'Arno'], correctIndex: 0 },
  { text: 'Quale pianeta è il più vicino al Sole?', options: ['Mercurio', 'Venere', 'Marte', 'Terra'], correctIndex: 0 },
  { text: 'Chi ha scritto la Divina Commedia?', options: ['Dante Alighieri', 'Petrarca', 'Boccaccio', 'Manzoni'], correctIndex: 0 },
  { text: 'Quante sono le regioni italiane?', options: ['20', '19', '21', '18'], correctIndex: 0 },
  { text: 'Quale elemento chimico ha simbolo Au?', options: ['Oro', 'Argento', 'Rame', 'Alluminio'], correctIndex: 0 },
  { text: 'In quale sport si usa il termine "ace"?', options: ['Tennis', 'Calcio', 'Basket', 'Rugby'], correctIndex: 0 },
  { text: 'Qual è il mare più salato?', options: ['Mar Morto', 'Mediterraneo', 'Mar Rosso', 'Adriatico'], correctIndex: 0 },
  { text: 'Chi ha composto la Nona Sinfonia?', options: ['Beethoven', 'Mozart', 'Bach', 'Chopin'], correctIndex: 0 },
  { text: 'Qual è la moneta del Giappone?', options: ['Yen', 'Won', 'Yuan', 'Ringgit'], correctIndex: 0 },
  { text: 'Quanti giocatori ha una squadra di rugby in campo?', options: ['15', '11', '13', '7'], correctIndex: 0 },
  { text: 'Mescolando blu e giallo si ottiene...', options: ['Verde', 'Viola', 'Arancione', 'Marrone'], correctIndex: 0 },
  { text: 'Chi ha scritto "1984"?', options: ['George Orwell', 'Aldous Huxley', 'Ray Bradbury', 'Franz Kafka'], correctIndex: 0 },
];

/**
 * Ping Pong "air hockey a domande".
 *
 * La palla è sempre da un lato: chi la riceve ha SERVE_SECONDS per rispondere
 * dal telefono. Risposta giusta = palla rimandata di là (nessun punto).
 * Risposta sbagliata o tempo scaduto = gol per l'avversario. Primo a 5.
 */
export class PingPongMode extends GameModeBase {
  readonly type: GameModeType = 'PING_PONG';
  readonly timerDuration = 180;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private courts = signal<Court[]>([]);
  private eventCounter = 0;
  private tickInterval?: ReturnType<typeof setInterval>;
  private questions: PingQuestion[] = [];

  protected onInitialize(): void {
    this.courts.set([]);
    this.questions = this.buildQuestions();
  }

  protected async onStart(): Promise<void> {
    this.startMatch();
    await this.runPreGameSequence(3000);
  }

  /** Esposto per il QA: accoppia i giocatori e serve la prima palla. */
  startMatch(): void {
    if (this.courts().length > 0) return;

    const players = this.config.activePlayers ?? [];
    const next: Court[] = [];

    for (let index = 0; index + 1 < players.length; index += 2) {
      next.push(this.createCourt(next.length, players[index], players[index + 1]));
    }

    if (players.length % 2 === 1) {
      const last = players[players.length - 1];
      next.push({
        id: next.length,
        a: { playerName: last, score: POINTS_TO_WIN, isBot: false },
        b: { playerName: 'RIPOSO', score: 0, isBot: true },
        winner: last,
        turn: 'a',
        serveLeft: 0,
        question: null,
        lastEvent: null,
        awarded: false,
      });
      this.awardCourt(next[next.length - 1]);
    }

    this.courts.set(next);
    this.tickInterval = setInterval(() => this.tickServes(), 1000);
    this.broadcast();
  }

  private createCourt(id: number, a: string, b: string): Court {
    const question = this.nextQuestion();
    return {
      id,
      a: { playerName: a, score: 0, isBot: false },
      b: { playerName: b, score: 0, isBot: false },
      winner: null,
      turn: 'a',
      serveLeft: SERVE_SECONDS,
      question,
      lastEvent: null,
      awarded: false,
    };
  }

  private buildQuestions(): PingQuestion[] {
    const custom: PingQuestion[] = [];
    const payload = this.payload ?? {};

    if (payload.question && Array.isArray(payload.options) && payload.options.length >= 2) {
      const correct = payload.options.indexOf(payload.correctAnswer);
      custom.push({
        text: String(payload.question),
        options: payload.options.map((o: any) => String(o)),
        correctIndex: correct >= 0 ? correct : 0,
      });
    }

    return [...custom, ...QUESTION_BANK];
  }

  private nextQuestion(): PingQuestion {
    if (this.questions.length === 0) this.questions = this.buildQuestions();
    const index = Math.floor(Math.random() * this.questions.length);
    const [question] = this.questions.splice(index, 1);
    this.questions.push(question);
    return question;
  }

  private tickServes(): void {
    if (this.isPaused()) return;

    let changed = false;
    const next = this.courts().map((court) => {
      if (court.winner || !court.question || court.serveLeft <= 0) return court;
      changed = true;
      return { ...court, serveLeft: court.serveLeft - 1 };
    });

    if (changed) {
      this.courts.set(next);
      this.broadcast();

      for (const court of this.courts()) {
        if (!court.winner && court.question && court.serveLeft <= 0) {
          this.concede(court.id, court.turn);
        }
      }
    }
  }

  /** Evento dal telefono: PING_PONG_ANSWER con l'indice scelto. */
  handlePartyEvent(event: any): void {
    if (event?.action !== 'PING_PONG_ANSWER' || !event.playerName) return;

    const playerKey = String(event.playerName).trim().toLowerCase();
    const index = Number(event.answerIndex);
    const court = this.courts().find((c) =>
      c.a.playerName.trim().toLowerCase() === playerKey ||
      c.b.playerName.trim().toLowerCase() === playerKey
    );
    if (!court || court.winner || !court.question) return;

    const side: Side = court.a.playerName.trim().toLowerCase() === playerKey ? 'a' : 'b';
    if (court.turn !== side) return;

    if (index === court.question.correctIndex) {
      this.returnBall(court.id, side);
    } else {
      this.concede(court.id, side);
    }
  }

  /** Palla rimandata: cambia lato, nuova domanda, nessun punto. */
  private returnBall(courtId: number, side: Side): void {
    const other: Side = side === 'a' ? 'b' : 'a';
    this.eventCounter += 1;
    const eventId = this.eventCounter;

    this.courts.update((courts) => courts.map((court) => {
      if (court.id !== courtId || court.winner) return court;
      return {
        ...court,
        turn: other,
        serveLeft: SERVE_SECONDS,
        question: this.nextQuestion(),
        lastEvent: { kind: 'return', side, id: eventId },
      };
    }));

    this.broadcast();
  }

  /** Gol: punto all'avversario, poi si riparte dal giocatore che l'ha preso. */
  private concede(courtId: number, side: Side): void {
    const other: Side = side === 'a' ? 'b' : 'a';
    this.eventCounter += 1;
    const eventId = this.eventCounter;

    this.courts.update((courts) => courts.map((court) => {
      if (court.id !== courtId || court.winner) return court;

      const scorer = court[other];
      const score = Math.min(POINTS_TO_WIN, scorer.score + 1);
      const updated: Court = {
        ...court,
        [other]: { ...scorer, score },
        turn: side,
        serveLeft: SERVE_SECONDS,
        question: null,
        lastEvent: { kind: 'goal', side: other, id: eventId },
      } as Court;

      if (score >= POINTS_TO_WIN) {
        updated.winner = scorer.playerName;
      }
      return updated;
    }));

    const court = this.courts().find((c) => c.id === courtId);
    this.broadcast();
    if (court?.winner) this.awardCourt(court);

    // Un attimo per vedere il gol, poi nuova palla al giocatore che l'ha subito.
    setTimeout(() => {
      if (!court || court.winner) return;
      this.courts.update((courts) => courts.map((c) => c.id === courtId
        ? { ...c, question: this.nextQuestion(), serveLeft: SERVE_SECONDS }
        : c));
      this.broadcast();
    }, 1400);
  }

  private awardCourt(court: Court): void {
    if (court.awarded) return;
    court.awarded = true;

    if (court.b.isBot) {
      this.config.onAnswerReceived?.({ playerName: court.a.playerName, points: 700, isCorrect: true });
      return;
    }

    const winnerSide: Side = court.winner === court.a.playerName ? 'a' : 'b';
    const loserSide: Side = winnerSide === 'a' ? 'b' : 'a';

    this.config.onAnswerReceived?.({
      playerName: court[winnerSide].playerName,
      points: 1000,
      isCorrect: true,
    });
    this.config.onAnswerReceived?.({
      playerName: court[loserSide].playerName,
      points: 200,
      isCorrect: false,
    });
  }

  private broadcast(): void {
    this.config.onBroadcast?.({
      action: 'PING_PONG_STATE',
      target: POINTS_TO_WIN,
      courts: this.courts().map((court) => ({
        id: court.id,
        a: { playerName: court.a.playerName, score: court.a.score },
        b: { playerName: court.b.playerName, score: court.b.score },
        winner: court.winner,
        turn: court.turn,
        serveLeft: court.serveLeft,
        question: court.question,
        lastEvent: court.lastEvent,
      })),
    });
  }

  protected onPause(): void {}

  protected onResume(): void {}

  protected onStop(): void {
    this.stopTicking();
  }

  protected onCleanup(): void {
    this.stopTicking();
    this.courts.set([]);
  }

  private stopTicking(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }
  }

  protected onTimeout(): void {
    this.stopTicking();
    for (const court of this.courts()) {
      if (!court.winner) {
        if (court.a.score === court.b.score) {
          this.config.onAnswerReceived?.({ playerName: court.a.playerName, points: 500, isCorrect: true });
          this.config.onAnswerReceived?.({ playerName: court.b.playerName, points: 500, isCorrect: true });
        } else {
          const winnerSide: Side = court.a.score > court.b.score ? 'a' : 'b';
          const loserSide: Side = winnerSide === 'a' ? 'b' : 'a';
          this.config.onAnswerReceived?.({ playerName: court[winnerSide].playerName, points: 1000, isCorrect: true });
          this.config.onAnswerReceived?.({ playerName: court[loserSide].playerName, points: 200, isCorrect: false });
        }
        court.awarded = true;
      }
    }
    this.revealed.set(true);
  }

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(_playerName: string, _answer: any, _result: any): void {}

  protected onConfirmCorrect(_result: GameModeResult): void {}

  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(answer: any, _timeMs: number): any {
    return { isCorrect: !!answer, points: 0 };
  }

  protected calculatePoints(_isCorrect: boolean, _elapsedMs: number): number {
    return 0;
  }

  getDisplayData() {
    return {
      question: 'Ping Pong!',
      courts: this.courts(),
      target: POINTS_TO_WIN,
      isReading: this.isReading(),
      revealed: this.revealed(),
      correctAnswer: null,
    };
  }
}
