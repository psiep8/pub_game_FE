import { GamePhase } from '../../../shared/enums/game-phase';
import { WsAction } from '../../../shared/enums/ws-action';
import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';

/** Fasi di Ultima spiaggia: le comuni arrivano da `GamePhase`. */
export const UltimaSpiaggiaPhase = {
  LEVEL: 'LEVEL',
  QUESTION: 'QUESTION',
  REVEAL: GamePhase.REVEAL,
  FINALE: GamePhase.FINALE,
} as const;
export type UltimaSpiaggiaPhase = (typeof UltimaSpiaggiaPhase)[keyof typeof UltimaSpiaggiaPhase];
export type UltimaSpiaggiaStatus = 'PENDING' | 'CORRECT' | 'WRONG';

/** I cinque livelli: ognuno si può usare una sola volta per squadra. */
export const ULTIMA_SPIAGGIA_LEVELS = [100, 200, 300, 400, 500] as const;

export interface UltimaSpiaggiaRow {
  playerName: string;
  level: number | null;
  used: number[];
  answered: boolean;
  points: number;
  total: number;
  status: UltimaSpiaggiaStatus;
}

interface UltimaSpiaggiaQuestion {
  level: number;
  question: string;
  options: string[];
  correctAnswer: string;
  category: string;
}

const LEVEL_SECONDS = 12;
const QUESTION_SECONDS = 15;
const REVEAL_SECONDS = 5;

/**
 * ULTIMA SPIAGGIA — una manche per occorrenza.
 *
 * Ogni volta che il gioco viene estratto, la categoria è fissata per quel
 * round e ogni squadra sceglie un livello tra quelli che non ha ancora
 * consumato nelle occorrenze precedenti della stessa partita. La scelta è
 * definitiva: il livello 100 usato nell'atto 1 non ricompare nel successivo
 * Ultima spiaggia. La domanda dipende dal livello; la TV mostra solo categoria
 * e, al reveal, livello scelto ed esito.
 */
export class UltimaSpiaggiaMode extends GameModeBase {
  readonly type: GameModeType = 'ULTIMA_SPIAGGIA';
  readonly timerDuration = LEVEL_SECONDS + QUESTION_SECONDS + REVEAL_SECONDS;
  readonly requiresBubbles = true;
  readonly requiresBuzz = false;

  /** Identifica questa singola occorrenza, non il round interno. */
  private readonly occurrenceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  private players: string[] = [];
  private category = '';
  private questions: UltimaSpiaggiaQuestion[] = [];
  private phase = signal<UltimaSpiaggiaPhase>(UltimaSpiaggiaPhase.LEVEL);
  private secondsLeft = signal(LEVEL_SECONDS);
  private rows = signal<UltimaSpiaggiaRow[]>([]);
  private picks = new Map<string, number>();
  private used = new Map<string, Set<number>>();
  private answers = new Map<string, number>();
  private points = new Map<string, number>();
  private totals = new Map<string, number>();
  private statuses = new Map<string, UltimaSpiaggiaStatus>();
  private finished = false;
  private clock?: ReturnType<typeof setInterval>;

  protected onInitialize(): void {
    this.readPayload();
    this.resetRound();
  }

  protected async onStart(): Promise<void> {
    this.players = [...(this.config.activePlayers ?? [])];
    this.readPayload();
    this.resetRound();
    await this.runPreGameSequence(1200);
    this.startLevel();
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

  /** Scelta del livello e risposta della manche: una sola per squadra. */
  handlePartyEvent(event: any): void {
    if (event?.action !== 'ULTIMA_SPIAGGIA_ACTION') return;

    const playerName = String(event.playerName ?? '').trim();
    if (!playerName || !this.players.includes(playerName)) return;

    if (event.kind === 'LEVEL') {
      if (this.phase() !== UltimaSpiaggiaPhase.LEVEL) return;
      if (this.picks.has(playerName)) return;

      const level = Number(event.value);
      if (!this.availableLevels(playerName).includes(level)) return;

      this.recordLevel(playerName, level);
      this.syncRows();
      this.publish();
      this.closeLevelIfComplete();
      return;
    }

    if (event.kind === 'ANSWER') {
      if (this.phase() !== UltimaSpiaggiaPhase.QUESTION) return;
      if (this.answers.has(playerName)) return;

      const level = this.picks.get(playerName);
      const question = level === undefined ? undefined : this.questionFor(level);
      if (!question) return;

      const index = Number(event.value);
      if (!Number.isInteger(index) || index < 0 || index >= question.options.length) return;

      this.answers.set(playerName, index);
      this.syncRows();
      this.publish();
      if (this.players.every((name) => this.answers.has(name))) {
        this.revealRound();
      }
    }
  }

  /** Carica la categoria, le cinque domande e i livelli già consumati. */
  private readPayload(): void {
    const rounds = Array.isArray(this.payload?.rounds) ? this.payload.rounds : [];
    const firstRound = rounds.length ? rounds[0] : null;
    const rawQuestions = this.payload?.questions ?? firstRound?.questions;
    this.questions = this.readQuestionList(rawQuestions);
    this.category = String(
      this.payload?.category
        ?? firstRound?.category
        ?? this.questions[0]?.category
        ?? '',
    );

    this.used.clear();
    const rawUsed = this.payload?.usedLevels ?? this.payload?.used ?? {};
    if (rawUsed && typeof rawUsed === 'object' && !Array.isArray(rawUsed)) {
      for (const [name, values] of Object.entries(rawUsed)) {
        if (!Array.isArray(values)) continue;
        const levels = new Set<number>();
        for (const value of values) {
          const level = Number(value);
          if (ULTIMA_SPIAGGIA_LEVELS.includes(level as any)) levels.add(level);
        }
        if (levels.size) this.used.set(String(name).trim(), levels);
      }
    }
  }

  private readQuestionList(raw: any): UltimaSpiaggiaQuestion[] {
    const list = Array.isArray(raw) ? raw : [];
    return list
      .filter((question: any) => question && question.question && Array.isArray(question.options))
      .map((question: any) => ({
        level: Number(question.level),
        question: String(question.question),
        options: question.options.map((option: any) => String(option)),
        correctAnswer: String(question.correctAnswer ?? ''),
        category: String(question.category ?? ''),
      }))
      .filter((question: UltimaSpiaggiaQuestion) => question.level > 0)
      .sort((a: UltimaSpiaggiaQuestion, b: UltimaSpiaggiaQuestion) => a.level - b.level);
  }

  /** Livelli disponibili nella manche: quelli del payload, in ordine. */
  levels(): number[] {
    const levels = this.questions.map((question) => question.level);
    return levels.length ? levels : [...ULTIMA_SPIAGGIA_LEVELS];
  }

  private questionFor(level: number): UltimaSpiaggiaQuestion | undefined {
    return this.questions.find((question) => question.level === level);
  }

  private usedBy(playerName: string): Set<number> {
    let used = this.used.get(playerName);
    if (!used) {
      used = new Set<number>();
      this.used.set(playerName, used);
    }
    return used;
  }

  private availableLevels(playerName: string): number[] {
    const used = this.usedBy(playerName);
    return this.levels().filter((level) => !used.has(level));
  }

  /**
   * Il livello scelto vale per tutta la partita: lo si registra subito sul
   * backend, così la prossima occorrenza lo vede già bloccato.
   */
  private recordLevel(playerName: string, level: number): void {
    this.picks.set(playerName, level);
    this.usedBy(playerName).add(level);
    this.config.onUltimaSpiaggiaLevel?.(playerName, level);
  }

  private resetRound(): void {
    this.finished = false;
    this.phase.set(UltimaSpiaggiaPhase.LEVEL);
    this.secondsLeft.set(LEVEL_SECONDS);
    this.picks.clear();
    this.answers.clear();
    this.points.clear();
    this.totals.clear();
    this.statuses.clear();
    this.rows.set([]);
    this.revealed.set(false);
    this.timer.set(this.timerDuration);
  }

  private startLevel(): void {
    this.picks.clear();
    this.answers.clear();
    this.points.clear();
    this.statuses.clear();

    this.phase.set(UltimaSpiaggiaPhase.LEVEL);
    this.secondsLeft.set(LEVEL_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(LEVEL_SECONDS, () => {
      this.assignMissingLevels();
      this.startQuestion();
    });
  }

  private closeLevelIfComplete(): void {
    if (this.phase() !== UltimaSpiaggiaPhase.LEVEL) return;
    if (!this.players.length) return;
    if (!this.players.every((playerName) => this.picks.has(playerName))) return;
    this.clearClock();
    this.startQuestion();
  }

  /** Chi non sceglie prende il livello più basso rimasto: il round prosegue. */
  private assignMissingLevels(): void {
    this.players.forEach((playerName) => {
      if (this.picks.has(playerName)) return;

      const level = this.availableLevels(playerName)[0];
      if (level === undefined) return;

      this.recordLevel(playerName, level);
    });
  }

  private startQuestion(): void {
    this.assignMissingLevels();
    this.answers.clear();
    this.phase.set(UltimaSpiaggiaPhase.QUESTION);
    this.secondsLeft.set(QUESTION_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(QUESTION_SECONDS, () => this.revealRound());
  }

  private revealRound(): void {
    if (this.phase() !== UltimaSpiaggiaPhase.QUESTION) return;
    this.clearClock();

    this.players.forEach((playerName) => {
      const level = this.picks.get(playerName);
      if (level === undefined) {
        this.points.set(playerName, 0);
        this.statuses.set(playerName, 'WRONG');
        return;
      }

      const question = this.questionFor(level);
      const correctIndex = question ? question.options.indexOf(question.correctAnswer) : -1;
      const answer = this.answers.get(playerName);
      const correct = correctIndex >= 0 && answer === correctIndex;
      const points = correct ? level : -Math.round(level / 2);

      this.points.set(playerName, points);
      this.totals.set(playerName, (this.totals.get(playerName) ?? 0) + points);
      this.statuses.set(playerName, correct ? 'CORRECT' : 'WRONG');
      this.config.onAnswerReceived?.({ playerName, points, isCorrect: correct });
    });

    this.phase.set(UltimaSpiaggiaPhase.REVEAL);
    this.secondsLeft.set(REVEAL_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(REVEAL_SECONDS, () => this.finish());
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
        level: this.picks.get(playerName) ?? null,
        used: [...this.usedBy(playerName)].sort((a, b) => a - b),
        answered: this.answers.has(playerName),
        points: this.points.get(playerName) ?? 0,
        total: this.totals.get(playerName) ?? 0,
        status: this.statuses.get(playerName) ?? 'PENDING',
      })),
    );
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

  private publish(): void {
    this.config.onBroadcast?.({
      action: WsAction.ULTIMA_SPIAGGIA_STATE,
      state: this.getDisplayData(),
    });
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
    const reveal = this.phase() === UltimaSpiaggiaPhase.REVEAL;
    return {
      phase: this.phase(),
      occurrenceId: this.occurrenceId,
      secondsLeft: this.secondsLeft(),
      round: 1,
      total: 1,
      category: this.category,
      levels: this.levels(),
      questions: this.questions.map((question) => ({
        level: question.level,
        question: question.question,
        options: question.options,
        category: question.category,
        // La risposta arriva ai telefoni solo al reveal.
        correctAnswer: reveal ? question.correctAnswer : null,
      })),
      rows: this.rows(),
      isReading: this.isReading(),
    };
  }
}
