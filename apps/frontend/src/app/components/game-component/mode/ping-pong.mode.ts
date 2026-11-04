import { signal } from '@angular/core';
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

interface CourtSide {
  playerName: string;
  score: number;
  isBot: boolean;
}

interface Court {
  a: CourtSide;
  b: CourtSide;
  winner: string | null;
}

const POINTS_TO_WIN = 5;
const HIT_COOLDOWN_MS = 220;

/**
 * Ping Pong: sfide 1 contro 1 in parallelo, accoppiate per classifica.
 *
 * Il telefono manda solo un tocco per colpo; la TV tiene il punteggio e
 * assegna i punti finali. Con un numero dispari l'ultima squadra passa il
 * turno e prende comunque un premio di consolazione.
 */
export class PingPongMode extends GameModeBase {
  readonly type: GameModeType = 'PING_PONG';
  readonly timerDuration = 60;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private courts = signal<Court[]>([]);
  private lastHit = new Map<string, number>();
  private pointsApplied = false;

  protected onInitialize(): void {
    this.courts.set([]);
    this.lastHit.clear();
    this.pointsApplied = false;
    this.timer.set(this.timerDuration);
  }

  protected async onStart(): Promise<void> {
    this.initializeCourts();
    await this.runPreGameSequence(3000);
  }

  protected onPause(): void {}
  protected onResume(): void {}
  protected onStop(): void {}

  protected onCleanup(): void {
    this.courts.set([]);
  }

  protected onTimeout(): void {
    this.finishTournament();
  }

  private initializeCourts(): void {
    if (this.courts().length > 0) return;

    const players = this.config.activePlayers ?? [];
    const next: Court[] = [];

    // Accoppiamento adiacente: 1ª contro 2ª, 3ª contro 4ª.
    for (let index = 0; index + 1 < players.length; index += 2) {
      next.push({
        a: { playerName: players[index], score: 0, isBot: false },
        b: { playerName: players[index + 1], score: 0, isBot: false },
        winner: null,
      });
    }

    // Numero dispari: l'ultima squadra salta il turno ma resta in classifica.
    if (players.length % 2 === 1) {
      const last = players[players.length - 1];
      next.push({
        a: { playerName: last, score: 0, isBot: false },
        b: { playerName: 'RIPOSO', score: 0, isBot: true },
        winner: last,
      });
    }

    this.courts.set(next);
  }

  handlePartyEvent(event: any): void {
    if (event?.action !== 'PING_PONG_HIT' || !event.playerName) return;

    const key = String(event.playerName).trim().toLowerCase();
    const now = Date.now();
    if (now - (this.lastHit.get(key) ?? 0) < HIT_COOLDOWN_MS) return;
    this.lastHit.set(key, now);

    this.courts.update((courts) => courts.map((court) => {
      if (court.winner) return court;

      if (court.a.playerName.trim().toLowerCase() === key) {
        const score = Math.min(POINTS_TO_WIN, court.a.score + 1);
        return {
          ...court,
          a: { ...court.a, score },
          winner: score >= POINTS_TO_WIN ? court.a.playerName : null,
        };
      }

      if (court.b.playerName.trim().toLowerCase() === key) {
        const score = Math.min(POINTS_TO_WIN, court.b.score + 1);
        return {
          ...court,
          b: { ...court.b, score },
          winner: score >= POINTS_TO_WIN ? court.b.playerName : null,
        };
      }

      return court;
    }));

    if (this.courts().every((court) => court.winner)) {
      this.finishTournament();
    }
  }

  private finishTournament(): void {
    if (this.pointsApplied) return;
    this.pointsApplied = true;

    const awards: Array<{ playerName: string; points: number }> = [];

    for (const court of this.courts()) {
      if (court.b.isBot) {
        awards.push({ playerName: court.a.playerName, points: 700 });
        continue;
      }

      const aWon = court.winner === court.a.playerName;
      const bWon = court.winner === court.b.playerName;

      if (aWon) {
        awards.push({ playerName: court.a.playerName, points: 1000 });
        awards.push({ playerName: court.b.playerName, points: 200 });
      } else if (bWon) {
        awards.push({ playerName: court.b.playerName, points: 1000 });
        awards.push({ playerName: court.a.playerName, points: 200 });
      } else {
        // Parità allo scadere: nessuno vince il campo, entrambi prendono 500.
        awards.push({ playerName: court.a.playerName, points: 500 });
        awards.push({ playerName: court.b.playerName, points: 500 });
      }
    }

    for (const award of awards) {
      this.config.onAnswerReceived?.({
        playerName: award.playerName,
        points: award.points,
        isCorrect: award.points >= 700,
      });
    }
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
      question: this.payload?.question ?? 'Ping Pong!',
      courts: this.courts(),
      isReading: this.isReading(),
      revealed: this.revealed(),
      correctAnswer: null,
    };
  }
}
