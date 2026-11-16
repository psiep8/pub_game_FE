import { WsAction } from '../../../shared/enums/ws-action';
import { signal } from '@angular/core';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { REVEAL_DELAY_MS } from '../../../shared/models/scoring-rules';

interface QuizManche {
  question: string;
  options: string[];
  correctAnswer: string;
  difficulty: 'facile' | 'medio' | 'difficile';
  maxPoints: number;
}

import { GAME_TIMINGS } from '../../../shared/models/game-timings';

const MANCHES = GAME_TIMINGS.QUIZ.manches;
const MANCHE_SECONDS = GAME_TIMINGS.QUIZ.mancheSeconds;
const REVEAL_SECONDS = 3;

/**
 * Quiz — tre manches da quindici secondi.
 *
 * Il round vale 1000 punti in tutto, divisi tra le tre domande in base alla
 * difficolta: una facile pesa 1, una media 1,5, una difficile 2. Dentro la
 * manche il tempo taglia il valore: rispondere subito vale il tetto della
 * domanda, rispondere all'ultimo secondo vale zero. Una risposta sbagliata
 * sottrae la stessa quota.
 */
export class QuizMode extends GameModeBase {
  readonly type: GameModeType = 'QUIZ';
  readonly timerDuration = MANCHE_SECONDS;
  readonly requiresBubbles = true;
  readonly requiresBuzz = false;

  private questions: QuizManche[] = [];
  private mancheIndex = signal(0);
  private mancheReveal = signal<QuizManche | null>(null);
  private answers = signal<Array<{ playerName: string; points: number; isCorrect: boolean; manche: number }>>([]);
  /** Scadenza del tempo, soluzione non ancora mostrata. */
  private revealPending = signal(false);
  private finished = signal(false);
  private secondsLeft = 0;
  private answeredThisManche = new Set<string>();
  /** Cresce a ogni salvataggio: una scrittura vecchia non deve tornare indietro. */
  private revision = 0;

  private clock?: ReturnType<typeof setInterval>;
  private advanceHandle?: ReturnType<typeof setTimeout>;

  protected onInitialize(): void {
    this.questions = this.readQuestions();
    this.mancheIndex.set(0);
    this.mancheReveal.set(null);
    this.answers.set([]);
    this.finished.set(false);
    this.secondsLeft = MANCHE_SECONDS;
    this.timer.set(MANCHE_SECONDS);
    this.answeredThisManche.clear();
    this.revision = 0;
    this.clearTimers();
  }

  override async onStart(): Promise<void> {
    this.questions = this.readQuestions();
    this.mancheIndex.set(0);
    this.mancheReveal.set(null);
    this.answers.set([]);
    this.finished.set(false);
    this.answeredThisManche.clear();
    await this.runPreGameSequence(10000);
    this.startManche(0);
  }

  /** Le manches hanno un cronometro proprio: il timer della base resta fermo. */
  protected override startTimer(): void {}

  protected onPause(): void {}

  protected onResume(): void {
    void this.broadcastState();
  }

  protected onStop(): void {
    this.clearTimers();
  }

  protected onCleanup(): void {
    this.clearTimers();
    this.questions = [];
    this.answers.set([]);
    this.revision = 0;
  }

  protected onTimeout(): void {
    this.finish();
  }

  override handleAnswer(playerName: string, answer: any, timeMs: number): void {
    if (this.finished() || this.mancheReveal()) return;
    const name = String(playerName ?? '').trim();
    if (!name || this.answeredThisManche.has(name)) return;

    this.answeredThisManche.add(name);
    super.handleAnswer(name, answer, timeMs);
  }

  private readQuestions(): QuizManche[] {
    const raw = Array.isArray(this.payload?.questions)
      ? this.payload.questions
      : [this.payload];

    const questions: QuizManche[] = raw
      .filter((row: any) => row && row.question && Array.isArray(row.options) && row.options.length >= 2)
      .slice(0, MANCHES)
      .map((row: any): QuizManche => ({
        question: String(row.question),
        options: row.options.map((option: any) => String(option)),
        correctAnswer: String(row.correctAnswer ?? ''),
        difficulty: this.normalizeDifficulty(row.difficulty),
        maxPoints: Number(row.maxPoints) || 0,
      }));

    if (!questions.length) return [];

    const totalWeight = questions.reduce((sum, row) => sum + this.weight(row.difficulty), 0);
    let assigned = 0;
    return questions.map((row, index) => {
      const maxPoints = row.maxPoints > 0
        ? row.maxPoints
        : index === questions.length - 1
          ? Math.max(0, 1000 - assigned)
          : Math.round((1000 * this.weight(row.difficulty)) / totalWeight);
      assigned += maxPoints;
      return { ...row, maxPoints };
    });
  }

  private normalizeDifficulty(value: any): 'facile' | 'medio' | 'difficile' {
    const text = String(value ?? '').toLowerCase();
    if (text === 'facile' || text === 'easy') return 'facile';
    if (text === 'difficile' || text === 'hard') return 'difficile';
    return 'medio';
  }

  private weight(difficulty: QuizManche['difficulty']): number {
    if (difficulty === 'facile') return 1;
    if (difficulty === 'difficile') return 3;
    return 2;
  }

  private startManche(index: number): void {
    this.clearTimers();
    this.mancheIndex.set(index);
    this.mancheReveal.set(null);
    this.revealPending.set(false);
    this.answeredThisManche.clear();
    this.secondsLeft = MANCHE_SECONDS;
    this.timer.set(MANCHE_SECONDS);
    this.config.onTimerTick?.(MANCHE_SECONDS);
    this.startClock();
    void this.broadcastState();
    this.emitCheckpoint();
  }

  private startClock(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = setInterval(() => {
      if (this.isPaused()) return;

      this.secondsLeft -= 1;
      this.timer.set(Math.max(0, this.secondsLeft));
      this.config.onTimerTick?.(Math.max(0, this.secondsLeft));

      if (this.secondsLeft <= 0) {
        this.clearClock();
        this.revealPending.set(true);
        this.emitCheckpoint();
        void this.broadcastState();
        this.revealManche();
      } else {
        this.emitCheckpoint();
      }
    }, 1000);
  }

  private revealManche(): void {
    if (this.finished() || this.mancheReveal()) return;
    this.clearClock();

    const current = this.questions[this.mancheIndex()];
    if (!current) {
      this.finish();
      return;
    }

    // Suspense: la soluzione non è mai simultanea alla scadenza.
    this.advanceHandle = setTimeout(() => {
      this.revealPending.set(false);
      this.mancheReveal.set(current);
      this.emitCheckpoint();
      this.config.onBroadcast?.({
        action: WsAction.QUIZ_STATE,
        state: this.getDisplayData(),
      });
      this.scheduleAdvance();
    }, REVEAL_DELAY_MS);
  }

  /** Dopo la soluzione si passa alla manche successiva, o si chiude il round. */
  private scheduleAdvance(): void {
    this.advanceHandle = setTimeout(() => {
      if (this.mancheIndex() + 1 >= this.questions.length) {
        this.finish();
      } else {
        this.startManche(this.mancheIndex() + 1);
      }
    }, REVEAL_SECONDS * 1000);
  }

  private finish(): void {
    if (this.finished()) return;
    this.finished.set(true);
    this.clearTimers();
    this.revealed.set(true);
    this.timer.set(0);
    void this.broadcastState();
    this.config.onTimerEnd?.();
  }

  private async broadcastState(): Promise<void> {
    this.config.onBroadcast?.({
      action: WsAction.QUIZ_STATE,
      state: this.getDisplayData(),
    });
  }

  private clearClock(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = undefined;
  }

  private clearTimers(): void {
    this.clearClock();
    if (this.advanceHandle) clearTimeout(this.advanceHandle);
    this.advanceHandle = undefined;
    this.revealPending.set(false);
  }

  /**
   * Riprende la manche in corso dal checkpoint: la domanda arriva dal payload,
   * quindi bastano indice, tempo residuo, risposte già date e stadio della TV
   * (gioco, attesa del reveal, soluzione già mostrata).
   */
  restore(secondsLeft: number, snapshot?: unknown): void {
    const checkpoint = snapshot as { revision?: number; state?: any } | null | undefined;
    const revision = checkpoint ? Number(checkpoint.revision) : 0;
    if (checkpoint && (!Number.isSafeInteger(revision) || revision <= 0)) {
      throw new Error('Stato Quiz non ripristinabile');
    }

    this.questions = this.readQuestions();
    if (!this.questions.length) {
      throw new Error('Stato Quiz non ripristinabile');
    }

    const state = checkpoint?.state ?? {};
    const rawIndex = Number(state.mancheIndex);
    const index = Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < this.questions.length
      ? rawIndex
      : 0;
    const answers = Array.isArray(state.answers)
      ? state.answers
        .filter((row: any) => row && typeof row.playerName === 'string' && Number.isFinite(Number(row.points)))
        .map((row: any) => ({
          playerName: String(row.playerName),
          points: Number(row.points) || 0,
          isCorrect: !!row.isCorrect,
          manche: Number.isInteger(Number(row.manche)) ? Number(row.manche) : index,
        }))
      : [];
    const answered = Array.isArray(state.answeredThisManche)
      ? state.answeredThisManche.filter((name: unknown) => typeof name === 'string')
      : [];
    const savedSeconds = Number(state.secondsLeft);
    const seconds = Number.isFinite(savedSeconds)
      ? Math.max(0, Math.min(MANCHE_SECONDS, Math.round(savedSeconds)))
      : Math.max(0, Math.round(Number(secondsLeft) || 0));
    const stage = state.stage === 'suspense' || state.stage === 'reveal' ? state.stage : 'play';

    this.revision = revision;
    this.clearTimers();
    this.mancheIndex.set(index);
    this.answers.set(answers);
    this.answeredThisManche = new Set(answered);
    this.finished.set(false);
    this.revealed.set(false);
    this.mancheReveal.set(null);
    this.secondsLeft = seconds;
    this.timer.set(seconds);
    this.config.onTimerTick?.(seconds);
    this.isActive.set(true);
    this.isPaused.set(false);

    if (stage === 'suspense') {
      // Il tempo era già scaduto: manca solo la soluzione.
      this.revealPending.set(true);
      this.revealManche();
    } else if (stage === 'reveal') {
      const current = this.questions[index];
      if (current) {
        this.mancheReveal.set(current);
        this.scheduleAdvance();
      }
    } else {
      this.startClock();
    }
    void this.broadcastState();
  }

  /** Salva lo stato minimo per riaprire la stessa manche dopo un refresh. */
  private emitCheckpoint(): void {
    const save = this.config.onTvCheckpoint;
    if (!save || this.finished()) return;
    this.revision++;
    save({
      type: this.type,
      revision: this.revision,
      state: {
        mancheIndex: this.mancheIndex(),
        secondsLeft: Math.max(0, this.secondsLeft),
        stage: this.mancheReveal() ? 'reveal' : this.revealPending() ? 'suspense' : 'play',
        answers: this.answers(),
        answeredThisManche: [...this.answeredThisManche],
      },
    });
  }

  getDisplayData(): any {
    const current = this.questions[this.mancheIndex()];
    return {
      type: 'QUIZ',
      category: this.payload?.category ?? '',
      explain: this.payload?.explain ?? '',
      question: current?.question ?? this.payload?.question ?? '',
      options: current?.options ?? this.payload?.options ?? [],
      currentManche: current,
      manche: Math.min(this.mancheIndex() + 1, Math.max(1, this.questions.length)),
      totalManches: this.questions.length || MANCHES,
      maxPoints: current?.maxPoints ?? 0,
      difficulty: current?.difficulty ?? 'medio',
      revealed: this.revealed(),
      mancheReveal: this.mancheReveal(),
      revealPending: this.revealPending(),
      solution: this.revealed() ? this.questions : [],
      summary: this.questions.map((question, index) => {
        const rows = this.answers().filter((row) => row.manche === index);
        return {
          question: question.question,
          correctAnswer: question.correctAnswer,
          correctTeams: rows.filter((row) => row.isCorrect).map((row) => row.playerName),
          wrongTeams: rows.filter((row) => !row.isCorrect).map((row) => row.playerName),
        };
      }),
      answers: this.answers(),
      correctAnswer: this.revealed() ? (current?.correctAnswer ?? null) : null,
      isReading: this.isReading(),
    };
  }

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(playerName: string, _answer: any, result: any): void {
    const manche = this.mancheIndex();
    this.answers.update((rows) => [
      ...rows.filter((row) => !(row.playerName === playerName && row.manche === manche)),
      {
        playerName,
        points: Number(result?.points) || 0,
        isCorrect: !!result?.isCorrect,
        manche,
      },
    ]);
    this.emitCheckpoint();
  }

  protected onConfirmCorrect(_result: GameModeResult): void {}

  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(answer: any, timeMs: number): any {
    const current = this.questions[this.mancheIndex()];
    if (!current) return { isCorrect: false, points: 0 };

    const index = Number(answer);
    const playerChoice = current.options[index];
    const isCorrect = playerChoice === current.correctAnswer;
    const points = this.calculatePoints(isCorrect, timeMs);
    return { isCorrect, points, playerChoice };
  }

  protected calculatePoints(isCorrect: boolean, elapsedMs: number): number {
    const current = this.questions[this.mancheIndex()];
    const maxPoints = current?.maxPoints ?? Math.round(1000 / MANCHES);
    const elapsed = Math.max(0, Math.min(MANCHE_SECONDS * 1000, Number(elapsedMs) || 0));
    const decay = Math.max(0, 1 - elapsed / (MANCHE_SECONDS * 1000));
    return Math.round((isCorrect ? 1 : -1) * maxPoints * decay);
  }
}
