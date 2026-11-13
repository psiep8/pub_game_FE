import { GamePhase } from '../../../shared/enums/game-phase';
import { WsAction } from '../../../shared/enums/ws-action';
import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';
import {
  AZZARDO_CHIPS,
  AZZARDO_CHIP_VALUE,
  AZZARDO_MAX_CHIPS_PER_MANCHE,
  AZZARDO_MANCHES,
  AzzardoChipsBreakdown,
  AzzardoLevel,
  bankFor,
  chipsBreakdown,
  clampAzzardoBet,
  levelForOccurrence,
  lossMultiplierFor,
  maxBetFor,
  maxChipsFor,
  oddsForLevel,
  settleManche,
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
  stake: number;
  choice: number;
  /** Distribuzione delle fiches sulle opzioni, quando si gioca a fiches. */
  chips?: number[];
}

const BET_SECONDS = 15;
const REVEAL_SECONDS = 7;
const FINALE_SECONDS = 5;
/**
 * Manche con tutti pronti: la puntata si chiude solo dopo questi secondi, così
 * chi gioca dal telefono ha il tempo di spostare le fiches anche quando tutte
 * le altre squadre hanno già puntato.
 */
const BET_MIN_READ_SECONDS = 10;

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
    if (event?.action !== 'AZZARDO_ACTION') return;

    const playerName = String(event.playerName ?? '').trim();
    if (!playerName || !this.players.includes(playerName)) return;
    if (this.phase() !== AzzardoPhase.BET || this.stakes.has(playerName)) return;

    const question = this.questions[this.manche()];
    if (!question) return;

    const raw = event.value ?? {};
    const available = this.bankPoints(playerName);

    // Nuovo formato: distribuzione di fiches, al massimo dieci.
    if (Array.isArray(raw.chips)) {
      const chips = Array.from({ length: question.options.length }, (_, index) =>
        Math.max(0, Math.floor(Number(raw.chips[index]) || 0)),
      );
      const total = chips.reduce((sum, value) => sum + value, 0);

      // Si punta solo con le fiches nel salvadanaio, mai più di dieci sul
      // tavolo per manche e mai oltre il credito in punti.
      const bank = this.chipBank.get(playerName) ?? 0;
      if (total > maxChipsFor(bank, available)) return;

      const choice = chips.indexOf(Math.max(...chips));
      this.stakes.set(playerName, { stake: total * AZZARDO_CHIP_VALUE, choice, chips });
      this.syncRows();
      this.publish();
      this.closeBetIfComplete();
      return;
    }

    const stakeValue = Number(raw.stake ?? raw[0]);
    const choice = Number(raw.choice ?? raw[1]);
    if (!Number.isInteger(choice) || choice < 0 || choice >= question.options.length) return;

    this.stakes.set(playerName, {
      stake: clampAzzardoBet(stakeValue, available),
      choice,
    });
    this.syncRows();
    this.publish();
    this.closeBetIfComplete();
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
  }

  private closeBetIfComplete(): void {
    if (this.phase() !== AzzardoPhase.BET) return;
    if (!this.players.length) return;
    if (!this.players.every((playerName) => this.stakes.has(playerName))) return;
    // Anche con tutti pronti il telefono deve poter spostare le fiches: la
    // manche chiude in anticipo solo a lettura fatta. Altrimenti la fa finire
    // il cronometro della puntata.
    if (BET_SECONDS - this.secondsLeft() < BET_MIN_READ_SECONDS) return;
    this.clearClock();
    this.revealManche();
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
        // Chi non risponde non punta: la manche resta a zero.
        this.points.set(playerName, 0);
        this.totals.set(playerName, this.totals.get(playerName) ?? 0);
        return;
      }

      if (stake.chips) {
        const used = stake.chips.reduce((sum, value) => sum + value, 0);
        this.chipBank.set(playerName, Math.max(0, (this.chipBank.get(playerName) ?? 0) - used));
      }

      const breakdown = this.breakdownFor(stake, question, available);
      const points = breakdown.points;
      this.breakdowns.set(playerName, breakdown);
      this.points.set(playerName, points);
      this.totals.set(playerName, (this.totals.get(playerName) ?? 0) + points);

      if (points !== 0) {
        this.config.onAnswerReceived?.({ playerName, points, isCorrect: points > 0 });
      }
    });

    this.phase.set(AzzardoPhase.REVEAL);
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
    if (this.phase() === AzzardoPhase.FINALE) return;
    this.clearClock();
    this.phase.set(AzzardoPhase.FINALE);
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

  /**
   * Conversione della puntata in punti: fiches giuste × quota, fiches
   * sbagliate × percentuale di manche. La puntata vecchia (100/200/300) resta
   * supportata e passa dalla stessa forma, così la TV mostra sempre il conto.
   */
  private breakdownFor(
    stake: Stake,
    question: AzzardoQuestion,
    available: number,
  ): AzzardoChipsBreakdown {
    if (stake.chips) {
      return chipsBreakdown({
        chips: stake.chips,
        answerIndex: question.answerIndex,
        level: this.level(),
        manche: this.manche(),
        available,
      });
    }

    const points = settleManche({
      stake: stake.stake,
      correct: stake.choice === question.answerIndex,
      level: this.level(),
      manche: this.manche(),
      available,
    });

    return {
      chips: [],
      totalChips: 0,
      stake: stake.stake,
      correctChips: 0,
      wrongChips: 0,
      odds: oddsForLevel(this.level()),
      lossPercent: Math.round(lossMultiplierFor(this.manche()) * 100),
      win: points > 0 ? points : 0,
      loss: points < 0 ? -points : 0,
      points,
    };
  }

  private syncRows(): void {
    this.rows.set(
      this.players.map((playerName) => {
        const stake = this.stakes.get(playerName);
        const breakdown = this.breakdowns.get(playerName);
        return {
          playerName,
          stake: stake?.stake ?? 0,
          choice: stake?.choice ?? -1,
          points: this.points.get(playerName) ?? 0,
          total: this.totals.get(playerName) ?? 0,
          played: !!stake,
          chips: stake?.chips ?? [],
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
    const clues = current?.media?.clues ?? [];
    const elapsed = this.phase() === AzzardoPhase.BET
      ? Math.max(0, BET_SECONDS - this.secondsLeft())
      : 0;
    const clueIndex = clues.length
      ? Math.min(clues.length - 1, Math.floor(elapsed / 5))
      : -1;

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
      clue: this.phase() === AzzardoPhase.BET && clueIndex >= 0 ? clues[clueIndex] : null,
      clueIndex: clueIndex + 1,
      clueTotal: clues.length,
      chips: AZZARDO_CHIPS,
      chipValue: AZZARDO_CHIP_VALUE,
      chipCap: AZZARDO_MAX_CHIPS_PER_MANCHE,
      ready: this.players.map((playerName) => ({
        playerName,
        ready: this.stakes.has(playerName),
        points: this.availablePoints(playerName),
        maxBet: maxBetFor(this.bankPoints(playerName)),
        chips: this.stakes.get(playerName)?.chips ?? [],
        chipsBank: this.chipBank.get(playerName) ?? 0,
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
