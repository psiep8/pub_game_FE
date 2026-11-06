import { signal } from '@angular/core';
import { GameModeBase } from '../interfaces/game-mode-base.class';
import { GameModeResult, GameModeType } from '../interfaces/game-mode-type';

export type ScommessaPhase = 'BET' | 'QUESTION' | 'REVEAL' | 'CASHOUT' | 'FINALE';
export type ScommessaStatus = 'PLAYING' | 'CASHED' | 'BUST';

export interface ScommessaRow {
  playerName: string;
  stake: number;
  bank: number;
  status: ScommessaStatus;
  points: number;
}

interface ScommessaQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  category?: string;
}

const BET_SECONDS = 10;
const QUESTION_SECONDS = 12;
const REVEAL_SECONDS = 6;
const CASHOUT_SECONDS = 8;
const FINALE_SECONDS = 7;

const TOTAL_QUESTIONS = 3;
const STAKES = [100, 200, 300];
const MIN_STAKE = 100;

/**
 * LA SCOMMESSA — tre domande, una banca che raddoppia e la scelta di incassare.
 *
 * Si punta prima di vedere la prima domanda (100/200/300). Ogni risposta esatta
 * raddoppia la banca (100 → 200 → 400 → 800); sbagliare o non rispondere la
 * brucia. Dopo la prima e la seconda domanda la squadra decide se incassare
 * subito o rischiare il resto: chi non sceglie entro otto secondi incassa
 * d'ufficio, così un telefono in tasca non costa punti. Alla terza domanda si
 * incassa automaticamente.
 */
export class ScommessaMode extends GameModeBase {
  readonly type: GameModeType = 'SCOMMESSA';
  readonly timerDuration =
    BET_SECONDS
    + TOTAL_QUESTIONS * (QUESTION_SECONDS + REVEAL_SECONDS)
    + (TOTAL_QUESTIONS - 1) * CASHOUT_SECONDS
    + FINALE_SECONDS;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private players: string[] = [];
  private questions: ScommessaQuestion[] = [];
  private phase = signal<ScommessaPhase>('BET');
  private secondsLeft = signal(BET_SECONDS);
  private rows = signal<ScommessaRow[]>([]);
  private index = signal(0);
  private stakes = new Map<string, number>();
  private banks = new Map<string, number>();
  private statuses = new Map<string, ScommessaStatus>();
  private answers = new Map<string, number>();
  private cashouts = new Map<string, 'CASH' | 'RISK'>();
  private paidPoints = new Map<string, number>();
  private paid = new Set<string>();
  private finished = false;
  private clock?: ReturnType<typeof setInterval>;

  protected onInitialize(): void {
    this.players = [...(this.config.activePlayers ?? [])];
    this.questions = this.readQuestions();
    this.resetRound();
  }

  protected async onStart(): Promise<void> {
    // setConfig arriva dopo initialize: i giocatori si leggono qui.
    this.players = [...(this.config.activePlayers ?? [])];
    this.questions = this.readQuestions();
    this.resetRound();
    await this.runPreGameSequence(1200);
    this.startBet();
  }

  /** Le fasi hanno un countdown proprio: il timer base resta fermo. */
  protected override startTimer(): void {}

  protected onPause(): void {}

  protected onResume(): void {}

  protected onStop(): void {
    this.clearClock();
  }

  protected onCleanup(): void {
    this.clearClock();
  }

  protected onTimeout(): void {
    this.finish();
  }

  handlePartyEvent(event: any): void {
    if (event?.action !== 'SCOMMESSA_ACTION') return;

    const playerName = String(event.playerName ?? '').trim();
    if (!playerName || !this.players.includes(playerName)) return;

    if (event.kind === 'STAKE') {
      if (this.phase() !== 'BET') return;

      const stake = Number(event.value);
      if (!STAKES.includes(stake)) return;

      this.stakes.set(playerName, stake);
      this.syncRows();
      this.publish();
      this.closeBetIfComplete();
      return;
    }

    if (event.kind === 'ANSWER') {
      if (this.phase() !== 'QUESTION' || this.answers.has(playerName)) return;
      if (this.status(playerName) !== 'PLAYING') return;

      const index = Number(event.value);
      if (!Number.isInteger(index) || index < 0 || index >= this.currentQuestion().options.length) return;

      this.answers.set(playerName, index);
      this.publish();
      if (this.activePlayers().every((name) => this.answers.has(name))) {
        this.revealQuestion();
      }
      return;
    }

    if (event.kind === 'CASHOUT') {
      if (this.phase() !== 'CASHOUT') return;
      if (this.status(playerName) !== 'PLAYING') return;

      const choice = String(event.value ?? '').toUpperCase();
      if (choice !== 'CASH' && choice !== 'RISK') return;

      this.cashouts.set(playerName, choice);
      this.publish();
      if (this.activePlayers().every((name) => this.cashouts.has(name))) {
        this.resolveCashout(false);
      }
    }
  }

  private readQuestions(): ScommessaQuestion[] {
    const raw = Array.isArray(this.payload?.questions) ? this.payload.questions : [this.payload];
    const questions = raw
      .filter((question: any) => question && question.question && Array.isArray(question.options))
      .slice(0, TOTAL_QUESTIONS)
      .map((question: any) => ({
        question: String(question.question),
        options: question.options.map((option: any) => String(option)),
        correctAnswer: String(question.correctAnswer ?? ''),
        category: question.category ? String(question.category) : undefined,
      }));

    return questions.length ? questions : [];
  }

  private resetRound(): void {
    this.finished = false;
    this.index.set(0);
    this.phase.set('BET');
    this.secondsLeft.set(BET_SECONDS);
    this.stakes.clear();
    this.banks.clear();
    this.statuses.clear();
    this.answers.clear();
    this.cashouts.clear();
    this.paidPoints.clear();
    this.paid.clear();
    this.rows.set([]);
    this.revealed.set(false);
    this.timer.set(this.timerDuration);
  }

  private startBet(): void {
    this.phase.set('BET');
    this.secondsLeft.set(BET_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(BET_SECONDS, () => this.startQuestion(0));
  }

  private closeBetIfComplete(): void {
    if (this.phase() !== 'BET') return;
    if (this.players.length === 0) return;
    if (!this.players.every((playerName) => this.stakes.has(playerName))) return;
    this.clearClock();
    this.startQuestion(0);
  }

  private startQuestion(index: number): void {
    if (index >= this.questions.length) {
      this.finale();
      return;
    }

    this.index.set(index);
    this.phase.set('QUESTION');
    this.answers.clear();
    this.cashouts.clear();
    this.secondsLeft.set(QUESTION_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(QUESTION_SECONDS, () => this.revealQuestion());
  }

  private revealQuestion(): void {
    if (this.phase() !== 'QUESTION') return;
    this.clearClock();

    const current = this.currentQuestion();
    const correctIndex = this.correctIndex();

    this.players.forEach((playerName) => {
      if (this.status(playerName) !== 'PLAYING') return;

      const answer = this.answers.get(playerName);
      if (answer !== undefined && answer === correctIndex) {
        this.banks.set(playerName, this.bank(playerName) * 2);
        return;
      }

      this.banks.set(playerName, 0);
      this.statuses.set(playerName, 'BUST');
    });

    this.phase.set('REVEAL');
    this.secondsLeft.set(REVEAL_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(REVEAL_SECONDS, () => this.afterReveal());
  }

  private afterReveal(): void {
    const stillPlaying = this.activePlayers();
    if (!stillPlaying.length || this.index() >= this.questions.length - 1) {
      this.finale();
      return;
    }
    this.startCashout();
  }

  private startCashout(): void {
    this.phase.set('CASHOUT');
    this.cashouts.clear();
    this.secondsLeft.set(CASHOUT_SECONDS);
    this.syncRows();
    this.publish();
    // Allo scadere si incassa: chi non tocca il telefono non perde nulla.
    this.startClock(CASHOUT_SECONDS, () => this.resolveCashout(true));
  }

  private resolveCashout(timeout: boolean): void {
    if (this.phase() !== 'CASHOUT') return;
    this.clearClock();

    this.players.forEach((playerName) => {
      if (this.status(playerName) !== 'PLAYING') return;

      const choice = this.cashouts.get(playerName) ?? (timeout ? 'CASH' : 'RISK');
      if (choice === 'CASH') this.cashIn(playerName);
    });

    this.syncRows();
    this.publish();

    // Se hanno incassato tutti non resta nessuno in gioco: si chiude subito.
    if (this.activePlayers().length === 0) {
      this.finale();
      return;
    }

    this.startQuestion(this.index() + 1);
  }

  private finale(): void {
    if (this.phase() === 'FINALE') return;
    this.clearClock();
    this.players.forEach((playerName) => {
      if (this.status(playerName) === 'PLAYING') this.cashIn(playerName);
    });

    this.phase.set('FINALE');
    this.secondsLeft.set(FINALE_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(FINALE_SECONDS, () => this.finish());
  }

  private cashIn(playerName: string): void {
    const points = this.bank(playerName);
    this.statuses.set(playerName, 'CASHED');
    if (points <= 0 || this.paid.has(playerName)) return;

    this.paid.add(playerName);
    this.paidPoints.set(playerName, points);
    this.config.onAnswerReceived?.({ playerName, points, isCorrect: true });
  }

  private activePlayers(): string[] {
    return this.players.filter((playerName) => this.status(playerName) === 'PLAYING' && this.bank(playerName) > 0);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.clearClock();
    this.revealed.set(true);
    this.config.onTimerEnd?.();
  }

  private startClock(seconds: number, onEnd: () => void): void {
    this.clearClock();
    this.secondsLeft.set(seconds);
    this.publish();

    this.clock = setInterval(() => {
      if (this.isPaused()) return;

      const next = Math.max(0, this.secondsLeft() - 1);
      this.secondsLeft.set(next);
      this.publish();

      if (next <= 0) {
        this.clearClock();
        onEnd();
      }
    }, 1000);
  }

  private currentQuestion(): ScommessaQuestion {
    return this.questions[this.index()] ?? { question: 'La Scommessa', options: [], correctAnswer: '' };
  }

  private correctIndex(): number {
    return this.currentQuestion().options.indexOf(this.currentQuestion().correctAnswer);
  }

  private stake(playerName: string): number {
    return this.stakes.get(playerName) ?? MIN_STAKE;
  }

  private bank(playerName: string): number {
    return this.banks.get(playerName) ?? this.stake(playerName);
  }

  private status(playerName: string): ScommessaStatus {
    return this.statuses.get(playerName) ?? 'PLAYING';
  }

  private syncRows(): void {
    this.rows.set(
      this.players.map((playerName) => ({
        playerName,
        stake: this.stake(playerName),
        bank: this.bank(playerName),
        status: this.status(playerName),
        points: this.paidPoints.get(playerName) ?? 0,
      })),
    );
  }

  private publish(): void {
    this.config.onBroadcast?.({
      action: 'SCOMMESSA_STATE',
      state: this.getDisplayData(),
    });
  }

  private clearClock(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = undefined;
  }

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(_playerName: string, _answer: any, _result: any): void {}

  protected onConfirmCorrect(_result: GameModeResult): void {}

  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(answer: any, _timeMs?: number): any {
    return { isCorrect: false, points: 0, answer };
  }

  protected calculatePoints(_isCorrect?: boolean, _elapsedMs?: number): number {
    return 0;
  }

  getDisplayData() {
    const current = this.currentQuestion();
    const reveal = this.phase() === 'REVEAL';

    return {
      question: current.question,
      category: current.category ?? '',
      options: current.options,
      phase: this.phase(),
      secondsLeft: this.secondsLeft(),
      index: this.index() + 1,
      total: this.questions.length || 1,
      multiplier: Math.pow(2, this.index() + 1),
      stakes: [...this.stakes.entries()].map(([playerName, stake]) => ({ playerName, stake })),
      rows: this.rows(),
      correctIndex: reveal ? this.correctIndex() : null,
      correctAnswer: null,
      revealed: reveal,
      isReading: this.isReading(),
    };
  }
}
