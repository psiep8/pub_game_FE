import { signal } from '@angular/core';
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

interface BuzzGuess {
  playerName: string;
  ms: number;
}

interface BuzzResult extends BuzzGuess {
  error: number;
  eliminated: boolean;
  /** Chi non ha premuto: sempre ultimo, eliminato per primo. */
  missed?: boolean;
}

const MANCHES = 3;
const MIN_MS = 5000;
const MAX_MS = 30000;
const MANCHE_MS = 45000;

/**
 * Time Buzzer — tre manche a tempo.
 *
 * La TV mostra un tempo bersaglio casuale (5–30 s). Ogni telefono ha solo un
 * pulsante verde: START quando vuole, STOP quando pensa di essere arrivato.
 * Nessun cronometro sul remote. Il peggior terzo esce a ogni manche.
 */
export class TimeBuzzerMode extends GameModeBase {
  readonly type: GameModeType = 'TIME_BUZZER';
  readonly timerDuration = 45;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private mancheIndex = signal(0);
  private remaining = signal<string[]>([]);
  private eliminatedNames = signal<string[]>([]);
  private guesses = signal<BuzzGuess[]>([]);
  private targetMs = signal(0);
  private revealData = signal<any | null>(null);
  private finished = signal(false);

  private initialCount = 0;
  private timerHandle?: ReturnType<typeof setTimeout>;
  private advanceHandle?: ReturnType<typeof setTimeout>;

  protected onInitialize(): void {
    const players = this.config.activePlayers ?? [];
    this.initialCount = players.length;
    this.remaining.set([...players]);
    this.eliminatedNames.set([]);
    this.mancheIndex.set(0);
    this.guesses.set([]);
    this.revealData.set(null);
    this.targetMs.set(0);
    this.finished.set(false);
    this.timer.set(this.timerDuration);
  }

  protected async onStart(): Promise<void> {
    await this.runPreGameSequence(2500);
    this.beginManche();
  }

  protected onPause(): void {}

  protected onResume(): void {}

  protected onStop(): void {
    this.clearTimers();
  }

  protected onCleanup(): void {
    this.clearTimers();
  }

  protected onTimeout(): void {
    this.revealManche();
  }

  private beginManche(): void {
    if (this.finished()) return;
    if (this.mancheIndex() >= MANCHES) {
      this.finish();
      return;
    }

    this.guesses.set([]);
    this.revealData.set(null);
    this.targetMs.set(Math.round((MIN_MS + Math.random() * (MAX_MS - MIN_MS)) / 10) * 10);
    this.timer.set(this.timerDuration);

    this.clearTimers();
    this.timerHandle = setTimeout(() => this.revealManche(), MANCHE_MS);
    this.broadcast();
  }

  handlePartyEvent(event: any): void {
    if (event?.action !== 'TIME_BUZZER_ANSWER' || !event.playerName) return;
    if (this.revealData() || this.finished()) return;

    const playerName = String(event.playerName);
    if (!this.remaining().includes(playerName)) return;

    const ms = Number(event.ms);
    if (!Number.isFinite(ms) || ms <= 0 || ms > 120000) return;

    this.guesses.update((list) => [
      ...list.filter((guess) => guess.playerName !== playerName),
      { playerName, ms: Math.round(ms) },
    ]);

    if (this.guesses().length >= this.remaining().length) {
      this.revealManche();
    } else {
      this.broadcast();
    }
  }

  private revealManche(): void {
    if (this.revealData() || this.finished()) return;
    this.clearTimers();

    const target = this.targetMs();
    const missing = this.remaining().filter(
      (name) => !this.guesses().some((guess) => guess.playerName === name),
    );

    // Chi non preme non sparisce dai risultati: prende l'errore massimo e
    // viene eliminato per primo. Altrimenti converrebbe non giocare.
    const results: BuzzResult[] = [
      ...this.guesses().map((guess) => ({
        ...guess,
        error: Math.abs(guess.ms - target),
        eliminated: false,
      })),
      ...missing.map((playerName) => ({
        playerName,
        ms: 0,
        error: Number.MAX_SAFE_INTEGER,
        eliminated: false,
        missed: true,
      })),
    ].sort((a, b) => a.error - b.error);

    const survivors = this.remaining().length;
    const eliminateCount = this.mancheIndex() < MANCHES - 1
      ? Math.min(
          Math.max(1, Math.ceil(this.initialCount / 3)),
          Math.max(0, survivors - 3),
        )
      : 0;

    for (let i = 0; i < eliminateCount && i < results.length; i++) {
      results[results.length - 1 - i].eliminated = true;
    }

    const out = results.filter((result) => result.eliminated).map((result) => result.playerName);
    if (out.length) {
      this.eliminatedNames.update((list) => [...list, ...out]);
      this.remaining.update((list) => list.filter((name) => !out.includes(name)));
    }

    results.forEach((result, position) => {
      if (result.eliminated) return;
      this.config.onAnswerReceived?.({
        playerName: result.playerName,
        points: Math.max(50, 300 - position * 100),
        isCorrect: position === 0,
      });
    });

    this.revealData.set({ target, results, eliminated: out });
    this.broadcast();

    this.advanceHandle = setTimeout(() => {
      if (this.mancheIndex() + 1 >= MANCHES || this.remaining().length <= 1) {
        this.finish();
      } else {
        this.mancheIndex.update((value) => value + 1);
        this.beginManche();
      }
    }, 6000);
  }

  private finish(): void {
    if (this.finished()) return;
    this.finished.set(true);
    this.clearTimers();

    const best = this.revealData()?.results?.find((result: BuzzResult) => !result.eliminated);
    if (best) {
      this.config.onAnswerReceived?.({ playerName: best.playerName, points: 500, isCorrect: true });
    }

    this.broadcast();
    this.config.onTimerEnd?.();
  }

  private clearTimers(): void {
    if (this.timerHandle) clearTimeout(this.timerHandle);
    if (this.advanceHandle) clearTimeout(this.advanceHandle);
    this.timerHandle = undefined;
    this.advanceHandle = undefined;
  }

  private broadcast(): void {
    this.config.onBroadcast?.({ action: 'TIME_BUZZER_STATE', state: this.getDisplayData() });
  }

  protected onBuzz(_playerName: string): void {}
  protected onAnswer(_playerName: string, _answer: any, _result: any): void {}
  protected onConfirmCorrect(_result: GameModeResult): void {}
  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(answer: any): any {
    return { isCorrect: false, points: 0, answer };
  }

  protected calculatePoints(): number {
    return 0;
  }

  getDisplayData() {
    return {
      question: this.payload?.question ?? 'Quanto ci metti?',
      targetMs: this.targetMs(),
      manche: this.mancheIndex() + 1,
      total: MANCHES,
      remaining: this.remaining(),
      eliminated: this.eliminatedNames(),
      guesses: this.guesses(),
      reveal: this.revealData(),
      finished: this.finished(),
      isReading: this.isReading(),
      correctAnswer: null,
    };
  }
}
