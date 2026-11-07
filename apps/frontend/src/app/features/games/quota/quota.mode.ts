import { GamePhase } from '../../../shared/enums/game-phase';
import { WsAction } from '../../../shared/enums/ws-action';
import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';

/** Fasi di Quota: le comuni arrivano da `GamePhase`. */
export const QuotaPhase = {
  BET: 'BET',
  REVEAL: GamePhase.REVEAL,
  FINALE: GamePhase.FINALE,
} as const;
export type QuotaPhase = (typeof QuotaPhase)[keyof typeof QuotaPhase];

export interface QuotaBand {
  from: number;
  to: number;
  odds: number;
}

export interface QuotaQuestion {
  question: string;
  category?: string;
  unit: string;
  value: number;
  correctBand: number;
  bands: QuotaBand[];
}

export interface QuotaRow {
  playerName: string;
  tokens: number[];
  payout: number;
  total: number;
}

const BET_SECONDS = 15;
const REVEAL_SECONDS = 7;
const FINALE_SECONDS = 5;
const TOTAL_QUESTIONS = 4;
const TOTAL_TOKENS = 100;
const DEFAULT_TOKENS = [25, 25, 25, 25];
const PAYOUT_CAP = 500;

/**
 * QUOTA — quattro domande numeriche, cento gettoni da distribuire sulle fasce.
 *
 * La quota di ogni fascia dipende dalla sua ampiezza (più stretta = più alta);
 * solo la fascia che contiene il valore paga, con tetto di 500 punti per
 * domanda. Chi non invia la puntata gioca 25 gettoni per fascia. Nessun punto
 * negativo: si perdono solo i gettoni giocati.
 */
export class QuotaMode extends GameModeBase {
  readonly type: GameModeType = 'QUOTA';
  readonly timerDuration = TOTAL_QUESTIONS * (BET_SECONDS + REVEAL_SECONDS) + FINALE_SECONDS;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private players: string[] = [];
  private questions: QuotaQuestion[] = [];
  private phase = signal<QuotaPhase>(QuotaPhase.BET);
  private secondsLeft = signal(BET_SECONDS);
  private rows = signal<QuotaRow[]>([]);
  private index = signal(0);
  private bets = new Map<string, number[]>();
  private payouts = new Map<string, number>();
  private totals = new Map<string, number>();
  private finished = false;
  private clock?: ReturnType<typeof setInterval>;

  protected onInitialize(): void {
    this.players = [...(this.config.activePlayers ?? [])];
    this.questions = this.readQuestions();
    this.resetRound();
  }

  protected async onStart(): Promise<void> {
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
    if (event?.action !== 'QUOTA_ACTION') return;

    const playerName = String(event.playerName ?? '').trim();
    if (!playerName || !this.players.includes(playerName)) return;
    if (this.phase() !== QuotaPhase.BET || this.bets.has(playerName)) return;

    const tokens = this.normalizeTokens(event.value);
    if (!tokens) return;

    this.bets.set(playerName, tokens);
    this.syncRows();
    this.publish();
    this.closeBetIfComplete();
  }

  private readQuestions(): QuotaQuestion[] {
    const raw = Array.isArray(this.payload?.questions) ? this.payload.questions : [];
    return raw
      .filter((question: any) => question && question.question && Array.isArray(question.bands))
      .slice(0, TOTAL_QUESTIONS)
      .map((question: any) => ({
        question: String(question.question),
        category: question.category ? String(question.category) : undefined,
        unit: String(question.unit ?? ''),
        value: Number(question.value) || 0,
        correctBand: Number(question.correctBand) || 0,
        bands: question.bands.map((band: any) => ({
          from: Number(band.from) || 0,
          to: Number(band.to) || 0,
          odds: Number(band.odds) || 1,
        })),
      }));
  }

  private resetRound(): void {
    this.finished = false;
    this.index.set(0);
    this.phase.set(QuotaPhase.BET);
    this.secondsLeft.set(BET_SECONDS);
    this.bets.clear();
    this.payouts.clear();
    this.totals.clear();
    this.rows.set([]);
    this.revealed.set(false);
    this.timer.set(this.timerDuration);
  }

  private startBet(): void {
    if (!this.questions.length) {
      this.message('Nessuna domanda numerica disponibile.');
      this.finale();
      return;
    }
    this.phase.set(QuotaPhase.BET);
    this.secondsLeft.set(BET_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(BET_SECONDS, () => this.revealQuestion());
  }

  private closeBetIfComplete(): void {
    if (this.phase() !== QuotaPhase.BET) return;
    if (!this.players.length) return;
    if (!this.players.every((playerName) => this.bets.has(playerName))) return;
    this.clearClock();
    this.revealQuestion();
  }

  private revealQuestion(): void {
    if (this.phase() !== QuotaPhase.BET) return;
    this.clearClock();

    const question = this.questions[this.index()];
    if (!question) {
      this.finale();
      return;
    }

    this.players.forEach((playerName) => {
      if (!this.bets.has(playerName)) {
        this.bets.set(playerName, [...DEFAULT_TOKENS]);
      }
      const tokens = this.bets.get(playerName) ?? DEFAULT_TOKENS;
      const band = question.bands[question.correctBand];
      const payout = Math.min(
        PAYOUT_CAP,
        Math.round((tokens[question.correctBand] ?? 0) * (band?.odds ?? 0)),
      );

      this.payouts.set(playerName, payout);
      this.totals.set(playerName, (this.totals.get(playerName) ?? 0) + payout);
      if (payout > 0) {
        this.config.onAnswerReceived?.({ playerName, points: payout, isCorrect: true });
      }
    });

    this.phase.set(QuotaPhase.REVEAL);
    this.secondsLeft.set(REVEAL_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(REVEAL_SECONDS, () => {
      if (this.index() + 1 >= this.questions.length) {
        this.finale();
      } else {
        this.index.set(this.index() + 1);
        this.startBet();
      }
    });
  }

  private finale(): void {
    if (this.phase() === QuotaPhase.FINALE) return;
    this.clearClock();
    this.phase.set(QuotaPhase.FINALE);
    this.secondsLeft.set(FINALE_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(FINALE_SECONDS, () => this.finish());
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.clearClock();
    this.revealed.set(true);
    this.config.onTimerEnd?.();
  }

  private syncRows(): void {
    this.rows.set(
      this.players.map((playerName) => ({
        playerName,
        tokens: this.bets.get(playerName) ?? [],
        payout: this.payouts.get(playerName) ?? 0,
        total: this.totals.get(playerName) ?? 0,
      })),
    );
  }

  private normalizeTokens(raw: any): number[] | null {
    if (!Array.isArray(raw) || raw.length !== 4) return null;
    const tokens = raw.map((value: any) => Number(value));
    if (tokens.some((value) => !Number.isInteger(value) || value < 0)) return null;
    if (tokens.reduce((sum, value) => sum + value, 0) !== TOTAL_TOKENS) return null;
    return tokens;
  }

  private crowd(): number[] {
    const totals = [0, 0, 0, 0];
    this.bets.forEach((tokens) => {
      tokens.forEach((value, index) => {
        totals[index] += value;
      });
    });
    return totals;
  }

  private best(): { playerName: string; payout: number } | null {
    let bestName = '';
    let bestPayout = 0;
    this.payouts.forEach((payout, playerName) => {
      if (payout > bestPayout) {
        bestPayout = payout;
        bestName = playerName;
      }
    });
    return bestPayout > 0 ? { playerName: bestName, payout: bestPayout } : null;
  }

  private message(text: string): void {
    this.config.onBroadcast?.({ action: WsAction.QUOTA_MESSAGE, text });
  }

  private publish(): void {
    this.config.onBroadcast?.({
      action: WsAction.QUOTA_STATE,
      state: this.getDisplayData(),
    });
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
    const current = this.questions[this.index()];
    const revealed = this.phase() === QuotaPhase.REVEAL || this.phase() === QuotaPhase.FINALE;

    return {
      question: current?.question ?? 'Quota',
      category: current?.category ?? '',
      unit: current?.unit ?? '',
      phase: this.phase(),
      secondsLeft: this.secondsLeft(),
      index: this.index() + 1,
      total: this.questions.length || TOTAL_QUESTIONS,
      bands: current?.bands ?? [],
      correctBand: revealed ? current?.correctBand ?? null : null,
      value: revealed ? current?.value ?? null : null,
      ready: this.players.map((playerName) => ({ playerName, ready: this.bets.has(playerName) })),
      rows: revealed ? this.rows() : [],
      crowd: revealed ? this.crowd() : [],
      best: revealed ? this.best() : null,
      isReading: this.isReading(),
    };
  }
}
