import { signal } from '@angular/core';
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

interface BuzzGuess {
  playerName: string;
  ms: number;
}

interface BuzzResult extends BuzzGuess {
  error: number;
  /** Chi non ha premuto: prende zero punti per quella manche. */
  missed?: boolean;
}

const MANCHES = 3;
const MIN_MS = 5000;
const MAX_MS = 30000;
const MANCHE_SECONDS = 30;
const REVEAL_MS = 5000;

/** Bonus per posizione: la forbice si allarga manche dopo manche. */
const BANDS = [
  [300, 220, 150, 90, 50],
  [400, 300, 200, 120, 70],
  [500, 380, 260, 160, 100],
];

const ELIMINATION_PENALTY = [-250, -100];
const FINALIST_BONUS = 150;

/**
 * Time Buzzer — tre manche a tempo, con tagli tra una manche e l'altra.
 *
 * La TV mostra un tempo bersaglio casuale (5–30 s). Ogni telefono ha solo un
 * pulsante verde: START quando vuole, STOP quando pensa di essere arrivato.
 * Dopo la prima manche esce il terzo più lento (chi non preme è ultimo), dopo
 * la seconda escono gli ultimi due: quelli restano in negativo e devono
 * recuperare. I finalisti prendono un bonus, chi è arrivato in fondo non paga
 * penalità.
 */
export class TimeBuzzerMode extends GameModeBase {
  readonly type: GameModeType = 'TIME_BUZZER';
  readonly timerDuration = MANCHE_SECONDS;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private players: string[] = [];
  private mancheIndex = signal(0);
  private guesses = signal<BuzzGuess[]>([]);
  private targetMs = signal(0);
  private revealData = signal<any | null>(null);
  private eliminated = signal<string[]>([]);
  private finished = signal(false);
  private secondsLeft = 0;

  private clock?: ReturnType<typeof setInterval>;
  private advanceHandle?: ReturnType<typeof setTimeout>;

  protected onInitialize(): void {
    this.resetState();
  }

  protected async onStart(): Promise<void> {
    this.players = [...(this.config.activePlayers ?? [])];
    this.resetState();
    await this.runPreGameSequence(2500);
    this.beginManche();
  }

  /** Il countdown delle manche è gestito da questo gioco, non dal timer base. */
  protected override startTimer(): void {}

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

  private resetState(): void {
    this.mancheIndex.set(0);
    this.guesses.set([]);
    this.revealData.set(null);
    this.targetMs.set(0);
    this.eliminated.set([]);
    this.finished.set(false);
    this.secondsLeft = this.timerDuration;
    this.timer.set(this.timerDuration);
  }

  private activePlayers(): string[] {
    const out = new Set(this.eliminated());
    return this.players.filter((name) => !out.has(name));
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
    this.secondsLeft = this.timerDuration;
    this.timer.set(this.timerDuration);
    this.config.onTimerTick?.(this.timerDuration);

    this.startClock();
    this.broadcast();
  }

  private startClock(): void {
    this.clearClock();
    this.clock = setInterval(() => {
      if (this.isPaused()) return;

      this.secondsLeft -= 1;
      this.timer.set(Math.max(0, this.secondsLeft));
      this.config.onTimerTick?.(Math.max(0, this.secondsLeft));

      if (this.secondsLeft <= 0) {
        this.clearClock();
        this.revealManche();
      }
    }, 1000);
  }

  handlePartyEvent(event: any): void {
    if (event?.action !== 'TIME_BUZZER_ANSWER' || !event.playerName) return;
    if (this.revealData() || this.finished()) return;

    const playerName = String(event.playerName);
    if (!this.activePlayers().includes(playerName)) return;

    const ms = Number(event.ms);
    if (!Number.isFinite(ms) || ms <= 0 || ms > 120000) return;

    this.guesses.update((list) => [
      ...list.filter((guess) => guess.playerName !== playerName),
      { playerName, ms: Math.round(ms) },
    ]);

    if (this.guesses().length >= this.activePlayers().length) {
      this.revealManche();
    } else {
      this.broadcast();
    }
  }

  private revealManche(): void {
    if (this.revealData() || this.finished()) return;
    this.clearClock();

    const target = this.targetMs();
    const active = this.activePlayers();
    const missing = active.filter(
      (name) => !this.guesses().some((guess) => guess.playerName === name),
    );

    // Chi non preme è ultimo: entra nella coda delle eliminazioni e non prende
    // punti per la manche.
    const results: BuzzResult[] = [
      ...this.guesses().map((guess) => ({
        ...guess,
        error: Math.abs(guess.ms - target),
      })),
      ...missing.map((playerName) => ({
        playerName,
        ms: 0,
        error: Number.MAX_SAFE_INTEGER,
        missed: true,
      })),
    ].sort((a, b) => a.error - b.error);

    const bands = BANDS[this.mancheIndex()] ?? BANDS[BANDS.length - 1];
    results.forEach((result, position) => {
      if (result.missed) return;
      const points = bands[Math.min(position, bands.length - 1)];
      this.config.onAnswerReceived?.({
        playerName: result.playerName,
        points,
        isCorrect: position === 0,
      });
    });

    let eliminatedNow: string[] = [];
    if (this.mancheIndex() < MANCHES - 1) {
      const cuts = this.mancheIndex() === 0
        ? Math.max(1, Math.ceil(active.length / 3))
        : Math.min(2, Math.max(0, active.length - 1));
      eliminatedNow = results.slice(-cuts).map((result) => result.playerName).filter(Boolean);

      const penalty = ELIMINATION_PENALTY[this.mancheIndex()] ?? -100;
      for (const playerName of eliminatedNow) {
        this.config.onAnswerReceived?.({
          playerName,
          points: penalty,
          isCorrect: false,
        });
      }
      this.eliminated.update((list) => [...new Set([...list, ...eliminatedNow])]);
    } else {
      // Chi arriva alla terza manche ha già pagato i tagli: bonus finale.
      for (const playerName of active) {
        this.config.onAnswerReceived?.({
          playerName,
          points: FINALIST_BONUS,
          isCorrect: true,
        });
      }
    }

    const markedResults = results.map((result) => ({
      ...result,
      eliminated: eliminatedNow.includes(result.playerName),
    }));
    this.revealData.set({ target, results: markedResults, eliminated: this.eliminated(), eliminatedNow });
    this.broadcast();

    this.advanceHandle = setTimeout(() => {
      if (this.mancheIndex() + 1 >= MANCHES) {
        this.finish();
      } else {
        this.mancheIndex.update((value) => value + 1);
        this.beginManche();
      }
    }, REVEAL_MS);
  }

  private finish(): void {
    if (this.finished()) return;
    this.finished.set(true);
    this.clearTimers();

    this.broadcast();
    this.config.onTimerEnd?.();
  }

  private clearClock(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = undefined;
  }

  private clearTimers(): void {
    this.clearClock();
    if (this.advanceHandle) clearTimeout(this.advanceHandle);
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
      manche: Math.min(this.mancheIndex() + 1, MANCHES),
      total: MANCHES,
      remaining: this.activePlayers(),
      eliminated: this.eliminated(),
      guesses: this.guesses(),
      reveal: this.revealData(),
      finished: this.finished(),
      isReading: this.isReading(),
      correctAnswer: null,
    };
  }
}
