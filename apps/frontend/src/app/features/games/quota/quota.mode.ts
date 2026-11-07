import { GamePhase } from '../../../shared/enums/game-phase';
import { WsAction } from '../../../shared/enums/ws-action';
import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';
import {
  AZZARDO_MANCHES,
  AzzardoLevel,
  clampAzzardoBet,
  levelForOccurrence,
  lossMultiplierFor,
  maxBetFor,
  oddsForLevel,
  settleManche,
} from './azzardo-rules';

/** Fasi di Azzardo: le comuni arrivano da `GamePhase`. */
export const QuotaPhase = {
  BET: 'BET',
  REVEAL: GamePhase.REVEAL,
  FINALE: GamePhase.FINALE,
} as const;
export type QuotaPhase = (typeof QuotaPhase)[keyof typeof QuotaPhase];

export interface AzzardoQuestion {
  question: string;
  category: string;
  unit: string;
  value: number;
  options: number[];
  answerIndex: number;
}

export interface AzzardoRow {
  playerName: string;
  stake: number;
  choice: number;
  points: number;
  total: number;
  played: boolean;
}

interface Stake {
  stake: number;
  choice: number;
}

const BET_SECONDS = 15;
const REVEAL_SECONDS = 7;
const FINALE_SECONDS = 5;

/**
 * AZZARDO (ex Quota) — quattro manche, una per categoria.
 *
 * La serata lo incontra tre volte, sempre più difficile: il livello arriva dal
 * backend (facile, media, difficile) e vale ×2, ×3, ×4. In ogni manche si
 * puntano 100, 200 o 300 punti veri su una delle quattro opzioni numeriche,
 * molto vicine tra loro. Vincere paga puntata × quota; sbagliare costa una
 * quota della puntata che scende lungo le manche (100%, 80%, 60%, 40%), così
 * chi perde presto paga più di chi resiste. La classifica non scende mai sotto
 * zero: la puntata è tagliata sui punti posseduti e la perdita su quelli che
 * restano.
 */
export class QuotaMode extends GameModeBase {
  readonly type: GameModeType = 'QUOTA';
  readonly timerDuration = AZZARDO_MANCHES * (BET_SECONDS + REVEAL_SECONDS) + FINALE_SECONDS;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private players: string[] = [];
  private questions: AzzardoQuestion[] = [];
  private level = signal<AzzardoLevel>(2);
  private phase = signal<QuotaPhase>(QuotaPhase.BET);
  private secondsLeft = signal(BET_SECONDS);
  private rows = signal<AzzardoRow[]>([]);
  private manche = signal(0);
  private stakes = new Map<string, Stake>();
  private points = new Map<string, number>();
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

  /** Puntata e risposta della manche: una sola per squadra. */
  handlePartyEvent(event: any): void {
    if (event?.action !== 'QUOTA_ACTION') return;

    const playerName = String(event.playerName ?? '').trim();
    if (!playerName || !this.players.includes(playerName)) return;
    if (this.phase() !== QuotaPhase.BET || this.stakes.has(playerName)) return;

    const question = this.questions[this.manche()];
    if (!question) return;

    const raw = event.value ?? {};
    const stakeValue = Number(raw.stake ?? raw[0]);
    const choice = Number(raw.choice ?? raw[1]);
    if (!Number.isInteger(choice) || choice < 0 || choice >= question.options.length) return;

    this.stakes.set(playerName, {
      stake: clampAzzardoBet(stakeValue, this.availablePoints(playerName)),
      choice,
    });
    this.syncRows();
    this.publish();
    this.closeBetIfComplete();
  }

  private availablePoints(playerName: string): number {
    return Math.max(0, Math.floor(this.config.playerPoints?.(playerName) ?? 0));
  }

  private readQuestions(): AzzardoQuestion[] {
    const raw = Array.isArray(this.payload?.questions) ? this.payload.questions : [];
    const level = Number(this.payload?.level);

    this.level.set(level === 1 || level === 3 ? level : levelForOccurrence(2));

    return raw
      .filter((question: any) => question && question.question && Array.isArray(question.options))
      .slice(0, AZZARDO_MANCHES)
      .map((question: any) => {
        const options = question.options.map((value: any) => Number(value));
        const declared = Number(question.answerIndex);
        const byValue = options.indexOf(Number(question.value));
        const answerIndex = Number.isInteger(declared) && options[declared] !== undefined
          ? declared
          : Math.max(0, byValue);

        return {
          question: String(question.question),
          category: String(question.category ?? ''),
          unit: String(question.unit ?? ''),
          value: Number(question.value) || 0,
          options,
          answerIndex,
        };
      });
  }

  private resetRound(): void {
    this.finished = false;
    this.manche.set(0);
    this.phase.set(QuotaPhase.BET);
    this.secondsLeft.set(BET_SECONDS);
    this.stakes.clear();
    this.points.clear();
    this.totals.clear();
    this.rows.set([]);
    this.revealed.set(false);
    this.timer.set(this.timerDuration);
  }

  private startBet(): void {
    if (!this.questions.length) {
      this.message('Nessuna domanda di Azzardo disponibile.');
      this.finale();
      return;
    }

    this.stakes.clear();
    this.points.clear();
    this.phase.set(QuotaPhase.BET);
    this.secondsLeft.set(BET_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(BET_SECONDS, () => this.revealManche());
  }

  private closeBetIfComplete(): void {
    if (this.phase() !== QuotaPhase.BET) return;
    if (!this.players.length) return;
    if (!this.players.every((playerName) => this.stakes.has(playerName))) return;
    this.clearClock();
    this.revealManche();
  }

  private revealManche(): void {
    if (this.phase() !== QuotaPhase.BET) return;
    this.clearClock();

    const question = this.questions[this.manche()];
    if (!question) {
      this.finale();
      return;
    }

    this.players.forEach((playerName) => {
      const stake = this.stakes.get(playerName);
      const available = this.availablePoints(playerName);

      if (!stake) {
        // Chi non risponde non punta: la manche resta a zero.
        this.points.set(playerName, 0);
        this.totals.set(playerName, this.totals.get(playerName) ?? 0);
        return;
      }

      const points = settleManche({
        stake: stake.stake,
        correct: stake.choice === question.answerIndex,
        level: this.level(),
        manche: this.manche(),
        available,
      });
      this.points.set(playerName, points);
      this.totals.set(playerName, (this.totals.get(playerName) ?? 0) + points);

      if (points !== 0) {
        this.config.onAnswerReceived?.({ playerName, points, isCorrect: points > 0 });
      }
    });

    this.phase.set(QuotaPhase.REVEAL);
    this.secondsLeft.set(REVEAL_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(REVEAL_SECONDS, () => {
      if (this.manche() + 1 >= this.questions.length) {
        this.finale();
      } else {
        this.manche.set(this.manche() + 1);
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
      this.players.map((playerName) => {
        const stake = this.stakes.get(playerName);
        return {
          playerName,
          stake: stake?.stake ?? 0,
          choice: stake?.choice ?? -1,
          points: this.points.get(playerName) ?? 0,
          total: this.totals.get(playerName) ?? 0,
          played: !!stake,
        };
      }),
    );
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
    const current = this.questions[this.manche()];
    const revealed = this.phase() === QuotaPhase.REVEAL || this.phase() === QuotaPhase.FINALE;

    return {
      phase: this.phase(),
      secondsLeft: this.secondsLeft(),
      level: this.level(),
      odds: oddsForLevel(this.level()),
      lossMultiplier: lossMultiplierFor(this.manche()),
      manche: this.manche() + 1,
      total: this.questions.length || AZZARDO_MANCHES,
      question: current?.question ?? 'Azzardo',
      category: current?.category ?? '',
      unit: current?.unit ?? '',
      options: current?.options ?? [],
      value: revealed ? current?.value ?? null : null,
      answerIndex: revealed ? current?.answerIndex ?? null : null,
      ready: this.players.map((playerName) => ({
        playerName,
        ready: this.stakes.has(playerName),
        maxBet: maxBetFor(this.availablePoints(playerName)),
      })),
      rows: revealed ? this.rows() : [],
      best: revealed ? this.best() : null,
      isReading: this.isReading(),
    };
  }

  private best(): AzzardoRow | null {
    let best: AzzardoRow | null = null;
    for (const row of this.rows()) {
      if (!best || row.points > best.points) best = row;
    }
    return best && best.points > 0 ? best : null;
  }
}
