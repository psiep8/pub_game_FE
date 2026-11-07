import { GamePhase } from '../../../shared/enums/game-phase';
import { WsAction } from '../../../shared/enums/ws-action';
import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';

/** Fasi di Tutto o metà: le comuni arrivano da `GamePhase`. */
export const ScommessaPhase = {
  LEVEL: 'LEVEL',
  QUESTION: 'QUESTION',
  REVEAL: GamePhase.REVEAL,
  FINALE: GamePhase.FINALE,
} as const;
export type ScommessaPhase = (typeof ScommessaPhase)[keyof typeof ScommessaPhase];
export type ScommessaStatus = 'PENDING' | 'CORRECT' | 'WRONG';

/** I cinque livelli: ognuno si può usare una sola volta per squadra. */
export const SCOMMESSA_LEVELS = [100, 200, 300, 400, 500] as const;

export interface ScommessaRow {
  playerName: string;
  level: number | null;
  used: number[];
  answered: boolean;
  points: number;
  total: number;
  status: ScommessaStatus;
}

interface ScommessaQuestion {
  level: number;
  question: string;
  options: string[];
  correctAnswer: string;
  category: string;
}

const LEVEL_SECONDS = 12;
const QUESTION_SECONDS = 15;
const REVEAL_SECONDS = 5;
const FINALE_SECONDS = 5;

/**
 * TUTTO O METÀ (ex Scommessa) — cinque round, cinque livelli.
 *
 * In ogni round ogni squadra sceglie un livello da 100 a 500, mai usato prima:
 * al quinto round resta un solo livello. La domanda dipende dal livello, quindi
 * chi sceglie lo stesso livello riceve la stessa domanda a quattro risposte.
 * Risposta giusta = +livello; sbagliata o scaduta = −metà del livello. La TV
 * mostra per squadra il livello scelto e l'esito.
 */
export class ScommessaMode extends GameModeBase {
  readonly type: GameModeType = 'SCOMMESSA';
  readonly timerDuration =
    SCOMMESSA_LEVELS.length * (LEVEL_SECONDS + QUESTION_SECONDS + REVEAL_SECONDS) + FINALE_SECONDS;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private players: string[] = [];
  private questions: ScommessaQuestion[] = [];
  private phase = signal<ScommessaPhase>(ScommessaPhase.LEVEL);
  private secondsLeft = signal(LEVEL_SECONDS);
  private round = signal(0);
  private rows = signal<ScommessaRow[]>([]);
  private picks = new Map<string, number>();
  private used = new Map<string, Set<number>>();
  private answers = new Map<string, number>();
  private points = new Map<string, number>();
  private totals = new Map<string, number>();
  private statuses = new Map<string, ScommessaStatus>();
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
    if (event?.action !== 'SCOMMESSA_ACTION') return;

    const playerName = String(event.playerName ?? '').trim();
    if (!playerName || !this.players.includes(playerName)) return;

    if (event.kind === 'LEVEL') {
      if (this.phase() !== ScommessaPhase.LEVEL) return;
      if (this.picks.has(playerName)) return;

      const level = Number(event.value);
      if (!this.levels().includes(level)) return;
      if (this.usedBy(playerName).has(level)) return;

      this.picks.set(playerName, level);
      this.usedBy(playerName).add(level);
      this.syncRows();
      this.publish();
      this.closeLevelIfComplete();
      return;
    }

    if (event.kind === 'ANSWER') {
      if (this.phase() !== ScommessaPhase.QUESTION) return;
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

  private readQuestions(): ScommessaQuestion[] {
    const raw = Array.isArray(this.payload?.questions) ? this.payload.questions : [];
    return raw
      .filter((question: any) => question && question.question && Array.isArray(question.options))
      .map((question: any) => ({
        level: Number(question.level),
        question: String(question.question),
        options: question.options.map((option: any) => String(option)),
        correctAnswer: String(question.correctAnswer ?? ''),
        category: String(question.category ?? ''),
      }))
      .filter((question: ScommessaQuestion) => question.level > 0)
      .sort((a: ScommessaQuestion, b: ScommessaQuestion) => a.level - b.level);
  }

  /** Livelli disponibili nel round: quelli del payload, nell'ordine crescente. */
  levels(): number[] {
    const levels = this.questions.map((question) => question.level);
    return levels.length ? levels : [...SCOMMESSA_LEVELS];
  }

  private questionFor(level: number): ScommessaQuestion | undefined {
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

  private resetRound(): void {
    this.finished = false;
    this.round.set(0);
    this.phase.set(ScommessaPhase.LEVEL);
    this.secondsLeft.set(LEVEL_SECONDS);
    this.picks.clear();
    this.used.clear();
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

    this.phase.set(ScommessaPhase.LEVEL);
    this.secondsLeft.set(LEVEL_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(LEVEL_SECONDS, () => {
      this.assignMissingLevels();
      this.startQuestion();
    });
  }

  private closeLevelIfComplete(): void {
    if (this.phase() !== ScommessaPhase.LEVEL) return;
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

      this.picks.set(playerName, level);
      this.usedBy(playerName).add(level);
    });
  }

  private startQuestion(): void {
    this.assignMissingLevels();
    this.answers.clear();
    this.phase.set(ScommessaPhase.QUESTION);
    this.secondsLeft.set(QUESTION_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(QUESTION_SECONDS, () => this.revealRound());
  }

  private revealRound(): void {
    if (this.phase() !== ScommessaPhase.QUESTION) return;
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

    this.phase.set(ScommessaPhase.REVEAL);
    this.secondsLeft.set(REVEAL_SECONDS);
    this.syncRows();
    this.publish();
    this.startClock(REVEAL_SECONDS, () => {
      if (this.round() + 1 >= this.levels().length) {
        this.finale();
      } else {
        this.round.set(this.round() + 1);
        this.startLevel();
      }
    });
  }

  private finale(): void {
    if (this.phase() === ScommessaPhase.FINALE) return;
    this.clearClock();
    this.phase.set(ScommessaPhase.FINALE);
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
      action: WsAction.SCOMMESSA_STATE,
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
    const reveal = this.phase() === ScommessaPhase.REVEAL || this.phase() === ScommessaPhase.FINALE;

    return {
      phase: this.phase(),
      secondsLeft: this.secondsLeft(),
      round: this.round() + 1,
      total: this.levels().length,
      category: this.questions[0]?.category ?? String(this.payload?.category ?? ''),
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
