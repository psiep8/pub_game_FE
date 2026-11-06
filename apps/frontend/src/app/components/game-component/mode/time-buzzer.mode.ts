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

/**
 * Time Buzzer — tre manche a tempo.
 *
 * La TV mostra un tempo bersaglio casuale (5–30 s). Ogni telefono ha solo un
 * pulsante verde: START quando vuole, STOP quando pensa di essere arrivato.
 * Nessun cronometro sul remote. Ogni manche assegna punti a chi ci va più
 * vicino: i bonus sono unici di fine atto e non eliminano nessuno.
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
  private finished = signal(false);
  private secondsLeft = 0;

  private clock?: ReturnType<typeof setInterval>;
  private advanceHandle?: ReturnType<typeof setTimeout>;

  protected onInitialize(): void {
    this.resetState();
  }

  protected async onStart(): Promise<void> {
    // setConfig arriva dopo initialize: i giocatori si leggono qui, altrimenti
    // la lista è sempre vuota e la prima manche non può chiudersi.
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
    this.finished.set(false);
    this.secondsLeft = this.timerDuration;
    this.timer.set(this.timerDuration);
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
    if (!this.players.includes(playerName)) return;

    const ms = Number(event.ms);
    if (!Number.isFinite(ms) || ms <= 0 || ms > 120000) return;

    this.guesses.update((list) => [
      ...list.filter((guess) => guess.playerName !== playerName),
      { playerName, ms: Math.round(ms) },
    ]);

    if (this.guesses().length >= this.players.length) {
      this.revealManche();
    } else {
      this.broadcast();
    }
  }

  private revealManche(): void {
    if (this.revealData() || this.finished()) return;
    this.clearClock();

    const target = this.targetMs();
    const missing = this.players.filter(
      (name) => !this.guesses().some((guess) => guess.playerName === name),
    );

    // Chi non preme resta in classifica con zero punti: non sparisce dai
    // risultati e non viene eliminato, si giocano tutte e tre le manche.
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

    results.forEach((result, position) => {
      if (result.missed) return;
      const points = Math.max(20, 100 - position * 20);
      this.config.onAnswerReceived?.({
        playerName: result.playerName,
        points,
        isCorrect: position === 0,
      });
    });

    this.revealData.set({ target, results, eliminated: [] });
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
      remaining: this.players,
      eliminated: [],
      guesses: this.guesses(),
      reveal: this.revealData(),
      finished: this.finished(),
      isReading: this.isReading(),
      correctAnswer: null,
    };
  }
}
