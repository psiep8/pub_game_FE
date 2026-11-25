import { GamePhase } from '../../../shared/enums/game-phase';
import { WsAction } from '../../../shared/enums/ws-action';
import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';
import {
  AZZARDO_CHIPS,
  AZZARDO_CHIP_VALUE,
  AZZARDO_MAX_CHIPS_PER_MANCHE,
  AZZARDO_MAX_LOSS_PER_ROUND,
  AZZARDO_MAX_WIN_PER_MANCHE,
  AZZARDO_MAX_WIN_PER_ROUND,
  AZZARDO_MANCHES,
  AzzardoChipsBreakdown,
  AzzardoLevel,
  bankFor,
  chipCapFor,
  chipsBreakdown,
  levelForOccurrence,
  lossMultiplierFor,
  maxBetFor,
  maxChipsFor,
  oddsForLevel,
} from './azzardo-rules';

/** Fasi di Azzardo: le comuni arrivano da `GamePhase`. */
export const AzzardoPhase = {
  BET: 'BET',
  REVEAL: GamePhase.REVEAL,
  FINALE: GamePhase.FINALE,
} as const;
export type AzzardoPhase = (typeof AzzardoPhase)[keyof typeof AzzardoPhase];

export interface AzzardoMedia {
  kind: 'celebrity' | 'song' | 'country';
  name?: string;
  imageUrl?: string;
  previewUrl?: string;
  albumCover?: string;
  title?: string;
  artist?: string;
  country?: string;
  countryCode?: string;
  mapUrl?: string;
  flagUrl?: string;
  clues?: string[];
}

export interface AzzardoQuestion {
  question: string;
  category: string;
  unit: string;
  value: number;
  options: number[];
  answerIndex: number;
  media?: AzzardoMedia;
}

export interface AzzardoRow {
  playerName: string;
  stake: number;
  choice: number;
  points: number;
  total: number;
  played: boolean;
  /** Fiches messe per opzione, quando la squadra gioca a fiches. */
  chips?: number[];
  /** Punti incassati dalle fiches giuste e persi dalle sbagliate. */
  win?: number;
  loss?: number;
  odds?: number;
  lossPercent?: number;
}

interface Stake {
  /** Distribuzione delle fiches sulle quattro opzioni. */
  chips: number[];
}

// F-25: trenta secondi per puntare. Chi non punta perde 100 punti, dentro il
// tetto di perdita del round.
const BET_SECONDS = 30;
const NO_BET_PENALTY = 100;
const REVEAL_SECONDS = 7;
const FINALE_SECONDS = 5;

/**
 * AZZARDO — quattro manche, una per categoria.
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
export class AzzardoMode extends GameModeBase {
  readonly type: GameModeType = 'AZZARDO';
  readonly timerDuration = AZZARDO_MANCHES * (BET_SECONDS + REVEAL_SECONDS) + FINALE_SECONDS;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private players: string[] = [];
  private questions: AzzardoQuestion[] = [];
  private level = signal<AzzardoLevel>(2);
  private phase = signal<AzzardoPhase>(AzzardoPhase.BET);
  private secondsLeft = signal(BET_SECONDS);
  private rows = signal<AzzardoRow[]>([]);
  private manche = signal(0);
  private stakes = new Map<string, Stake>();
  private points = new Map<string, number>();
  private totals = new Map<string, number>();
  /**
   * Fiches di ogni squadra: ogni manche ne arrivano dieci nuove e quelle
   * avanzate restano nel salvadanaio, così chi risparmia se le ritrova dopo.
   */
  private chipBank = new Map<string, number>();
  /** Conversione fiches → punti dell'ultima manche, per TV e telefono. */
  private breakdowns = new Map<string, AzzardoChipsBreakdown>();
  private finished = false;
  private clock?: ReturnType<typeof setInterval>;
  /** Istante in cui la sala si è fermata; null quando il tempo scorre. */
  private pausedAt: number | null = null;

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

  protected onPause(): void {
    // Il checkpoint segna l'istante di fermo: dopo un refresh durante la pausa
    // il tempo trascorso a sala ferma non viene scalato dal countdown.
    this.pausedAt = Date.now();
    this.saveCheckpoint();
  }

  protected onResume(): void {
    // Il tempo torna a scorrere: il prossimo ripristino lo conta da qui.
    this.pausedAt = null;
    this.saveCheckpoint();
  }

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
    if (event?.action !== 'AZZARDO_ACTION') return;
    // Pausa della TV: la puntata arrivata dal telefono nel frattempo non conta.
    if (this.isPaused()) return;

    const playerName = String(event.playerName ?? '').trim();
    if (!playerName || !this.players.includes(playerName)) return;
    // F-26: ogni tocco aggiorna la puntata; vale l'ultima al tempo scaduto.
    if (this.phase() !== AzzardoPhase.BET) return;

    const question = this.questions[this.manche()];
    if (!question) return;

    const raw = event.value ?? {};
    if (!Array.isArray(raw.chips)) return;

    const chips = Array.from({ length: question.options.length }, (_, index) =>
      Math.max(0, Math.floor(Number(raw.chips[index]) || 0)),
    );
    const total = chips.reduce((sum, value) => sum + value, 0);

    // Puntata con le fiches del salvadanaio, entro il tetto della squadra.
    const bank = this.chipBank.get(playerName) ?? 0;
    if (total > maxChipsFor(bank, this.bankPoints(playerName))) return;

    // F-26: togliere tutte le fiches annulla la puntata, non lascia la vecchia.
    if (total <= 0) {
      this.stakes.delete(playerName);
    } else {
      this.stakes.set(playerName, { chips });
    }
    this.syncRows();
    this.publish();
    this.saveCheckpoint();
  }

  /** Punti veri in classifica: tagliano le perdite, mai sotto zero. */
  private availablePoints(playerName: string): number {
    return Math.max(0, Math.floor(this.config.playerPoints?.(playerName) ?? 0));
  }

  /** Credito su cui si punta: chi ha zero punti gioca lo stesso. */
  private bankPoints(playerName: string): number {
    return bankFor(this.availablePoints(playerName));
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
          media: question.media && typeof question.media === 'object'
            ? question.media as AzzardoMedia
            : undefined,
        };
      });
  }

  private resetRound(): void {
    this.finished = false;
    this.manche.set(0);
    this.phase.set(AzzardoPhase.BET);
    this.secondsLeft.set(BET_SECONDS);
    this.stakes.clear();
    this.points.clear();
    this.totals.clear();
    this.chipBank.clear();
    this.breakdowns.clear();
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
    this.breakdowns.clear();
    // Dieci fiches nuove per manche, in aggiunta a quelle avanzate.
    for (const playerName of this.players) {
      this.chipBank.set(playerName, (this.chipBank.get(playerName) ?? 0) + AZZARDO_CHIPS);
    }
    this.phase.set(AzzardoPhase.BET);
    this.secondsLeft.set(BET_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(BET_SECONDS, () => this.revealManche());
    this.saveCheckpoint();
  }

  private revealManche(): void {
    if (this.phase() !== AzzardoPhase.BET) return;
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
        // F-25: chi non punta paga la manche, senza scendere sotto il tetto.
        const before = this.totals.get(playerName) ?? 0;
        const penalty = Math.max(-AZZARDO_MAX_LOSS_PER_ROUND - before, -NO_BET_PENALTY);
        this.points.set(playerName, penalty);
        this.totals.set(playerName, before + penalty);
        if (penalty !== 0) {
          this.config.onAnswerReceived?.({ playerName, points: penalty, isCorrect: false });
        }
        return;
      }

      const used = stake.chips.reduce((sum, value) => sum + value, 0);
      this.chipBank.set(playerName, Math.max(0, (this.chipBank.get(playerName) ?? 0) - used));

      const breakdown = this.breakdownFor(stake, question, available);
      const before = this.totals.get(playerName) ?? 0;
      // Tetti di round: quattro manche non portano oltre +1500 né sotto −1000.
      const points = Math.max(
        -AZZARDO_MAX_LOSS_PER_ROUND - before,
        Math.min(AZZARDO_MAX_WIN_PER_ROUND - before, breakdown.points),
      );
      // Se il tetto di round taglia la manche, anche la riga mostrata si
      // allinea: la vincita non supera il saldo disponibile e la perdita resta
      // la differenza, mai negativa.
      const win = Math.min(breakdown.win, Math.max(0, points + breakdown.loss));
      const loss = Math.max(0, win - points);
      this.breakdowns.set(playerName, { ...breakdown, points, win, loss });
      this.points.set(playerName, points);
      this.totals.set(playerName, before + points);

      if (points !== 0) {
        this.config.onAnswerReceived?.({ playerName, points, isCorrect: points > 0 });
      }
    });

    this.phase.set(AzzardoPhase.REVEAL);
    this.secondsLeft.set(REVEAL_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(REVEAL_SECONDS, () => this.advanceAfterReveal());
    this.saveCheckpoint();
  }

  /** Fine del reveal: manche successiva o finale. Comune a gioco e ripresa. */
  private advanceAfterReveal(): void {
    if (this.manche() + 1 >= this.questions.length) {
      this.finale();
    } else {
      this.manche.set(this.manche() + 1);
      this.startBet();
    }
  }

  private finale(): void {
    if (this.phase() === AzzardoPhase.FINALE) return;
    this.clearClock();
    this.phase.set(AzzardoPhase.FINALE);
    this.secondsLeft.set(FINALE_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(FINALE_SECONDS, () => this.finish());
    this.saveCheckpoint();
  }

  /**
   * Riprende il round dopo un refresh. Fiches, puntate, punteggi e conversioni
   * arrivano dal checkpoint: il reveal già avvenuto non ricalcola i punti, così
   * nessuno li incassa due volte.
   */
  restore(secondsLeft: number, snapshot?: unknown): void {
    const checkpoint = snapshot as { revision?: number; state?: any } | null | undefined;
    const state = checkpoint?.state ?? {};
    this.players = [...(this.config.activePlayers ?? [])];
    this.questions = this.readQuestions();
    this.finished = state.finished === true;
    this.revealed.set(state.revealed === true);

    const manche = Number(state.manche);
    this.manche.set(Number.isInteger(manche) && manche >= 0 && manche < Math.max(1, this.questions.length)
      ? manche
      : 0);

    this.stakes.clear();
    for (const row of Array.isArray(state.stakes) ? state.stakes : []) {
      const playerName = String(row?.playerName ?? '').trim();
      const chips = Array.isArray(row?.chips)
        ? row.chips.map((value: any) => Math.max(0, Math.floor(Number(value) || 0)))
        : [];
      if (playerName && chips.length) this.stakes.set(playerName, { chips });
    }
    this.points = this.entriesOf(state.points, true);
    this.totals = this.entriesOf(state.totals, true);
    this.chipBank = this.entriesOf(state.chipBank, true);
    this.breakdowns = this.entriesOf(state.breakdowns) as Map<string, AzzardoChipsBreakdown>;

    // Il tempo non riparte da capo: si toglie quello passato dal salvataggio
    // fermandosi all'istante della pausa. I secondi di sala ferma non contano:
    // altrimenti un refresh durante la pausa accorcerebbe il countdown.
    const savedSeconds = Number(state.secondsLeft);
    const savedAt = Number(state.savedAt);
    const pausedAt = Number(state.pausedAt);
    const stoppedAt = Number.isFinite(pausedAt) && pausedAt > 0 ? pausedAt : Date.now();
    const elapsed = Number.isFinite(savedAt) && savedAt > 0
      ? Math.max(0, Math.floor((stoppedAt - savedAt) / 1000))
      : 0;
    const seconds = Number.isFinite(savedSeconds)
      ? Math.max(0, Math.round(savedSeconds) - elapsed)
      : Math.max(0, Math.round(Number(secondsLeft) || 0));

    this.syncRows();
    this.timer.set(this.timerDuration);
    this.isActive.set(true);
    this.isPaused.set(false);
    this.pausedAt = null;

    const phase = String(state.phase);
    if (phase === AzzardoPhase.REVEAL) {
      this.phase.set(AzzardoPhase.REVEAL);
      this.startClock(seconds, () => this.advanceAfterReveal());
      // Il checkpoint riparte da qui: un altro refresh conta il tempo nuovo.
      this.saveCheckpoint();
      return;
    }
    if (phase === AzzardoPhase.FINALE) {
      this.phase.set(AzzardoPhase.FINALE);
      this.startClock(seconds, () => this.finish());
      this.saveCheckpoint();
      return;
    }

    // Puntata in corso: le fiches già messe restano sul tavolo.
    this.phase.set(AzzardoPhase.BET);
    if (seconds <= 0) {
      this.revealManche();
      return;
    }
    this.startClock(seconds, () => this.revealManche());
    this.saveCheckpoint();
  }

  /** Coppie `[nome, valore]` del checkpoint: le mappe non passano in JSON. */
  private entriesOf(value: unknown, numeric = false): Map<string, any> {
    const map = new Map<string, any>();
    if (!Array.isArray(value)) return map;
    for (const row of value) {
      if (!Array.isArray(row) || typeof row[0] !== 'string') continue;
      const key = row[0];
      map.set(key, numeric ? Number(row[1]) || 0 : row[1]);
    }
    return map;
  }

  /** Stato della partita: fiches, puntate, punteggi e fase corrente. */
  private saveCheckpoint(): void {
    this.config.onTvCheckpoint?.({
      type: this.type,
      revision: Date.now(),
      state: {
        manche: this.manche(),
        phase: this.phase(),
        secondsLeft: this.secondsLeft(),
        savedAt: Date.now(),
        pausedAt: this.pausedAt,
        stakes: [...this.stakes].map(([playerName, stake]) => ({ playerName, chips: stake.chips })),
        points: [...this.points],
        totals: [...this.totals],
        chipBank: [...this.chipBank],
        breakdowns: [...this.breakdowns],
        finished: this.finished,
        revealed: this.revealed(),
      },
    });
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.clearClock();
    this.revealed.set(true);
    this.config.onTimerEnd?.();
  }

  /**
   * Conversione della puntata in punti: fiches giuste × quota, fiches
   * sbagliate × percentuale di manche, con il tetto di vincita già applicato
   * da `chipsBreakdown`.
   */
  private breakdownFor(
    stake: Stake,
    question: AzzardoQuestion,
    available: number,
  ): AzzardoChipsBreakdown {
    return chipsBreakdown({
      chips: stake.chips,
      answerIndex: question.answerIndex,
      level: this.level(),
      manche: this.manche(),
      available,
    });
  }

  private syncRows(): void {
    this.rows.set(
      this.players.map((playerName) => {
        const chips = this.stakes.get(playerName)?.chips ?? [];
        const totalChips = chips.reduce((sum, value) => sum + value, 0);
        const breakdown = this.breakdowns.get(playerName);
        return {
          playerName,
          // TV e telefono leggono la puntata in punti e l'opzione più carica.
          stake: totalChips * AZZARDO_CHIP_VALUE,
          choice: totalChips > 0 ? chips.indexOf(Math.max(...chips)) : -1,
          points: this.points.get(playerName) ?? 0,
          total: this.totals.get(playerName) ?? 0,
          played: totalChips > 0,
          chips,
          win: breakdown?.win ?? 0,
          loss: breakdown?.loss ?? 0,
          odds: breakdown?.odds ?? oddsForLevel(this.level()),
          lossPercent: breakdown?.lossPercent ?? Math.round(lossMultiplierFor(this.manche()) * 100),
        };
      }),
    );
  }

  private message(text: string): void {
    this.config.onBroadcast?.({ action: WsAction.AZZARDO_MESSAGE, text });
  }

  private publish(): void {
    this.config.onBroadcast?.({
      action: WsAction.AZZARDO_STATE,
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
    const revealed = this.phase() === AzzardoPhase.REVEAL || this.phase() === AzzardoPhase.FINALE;

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
      media: current?.media ?? null,
      // F-27: l'indizio della celebrità resta solo in Indovina chi.
      clue: null,
      clueIndex: 0,
      clueTotal: 0,
      chips: AZZARDO_CHIPS,
      chipValue: AZZARDO_CHIP_VALUE,
      chipCap: AZZARDO_MAX_CHIPS_PER_MANCHE,
      winCap: AZZARDO_MAX_WIN_PER_MANCHE,
      ready: this.players.map((playerName) => ({
        playerName,
        ready: this.stakes.has(playerName),
        points: this.availablePoints(playerName),
        maxBet: maxBetFor(this.bankPoints(playerName)),
        chips: this.stakes.get(playerName)?.chips ?? [],
        chipsBank: this.chipBank.get(playerName) ?? 0,
        chipsCap: chipCapFor(this.chipBank.get(playerName) ?? 0),
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
