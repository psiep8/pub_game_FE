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
import { TV_TIMING } from '../../tv/tv-timing';

const MANCHES = GAME_TIMINGS.QUIZ.manches;
const MANCHE_SECONDS = GAME_TIMINGS.QUIZ.mancheSeconds;
const REVEAL_SECONDS = 3;
/** Il respiro fra le manche: la domanda dopo è a schermo, il timer è fermo. */
const MANCHE_BREATH_MS = TV_TIMING.mancheBreathMs;
/** Durata di gioco di un round: manche, reveal e i respiri fra le manche. */
export const QUIZ_ROUND_SECONDS =
  MANCHES * (MANCHE_SECONDS + REVEAL_SECONDS) + (MANCHES - 1) * (MANCHE_BREATH_MS / 1000);

/**
 * Quiz — tre manches da venti secondi.
 *
 * Il round vale 1000 punti in tutto, divisi tra le tre domande in base al mix
 * di difficolta: tre diverse valgono 200 / 350 / 450, due uguali piu una
 * lasciano 250 alle piu facili e il resto alle altre, tre uguali 333 / 333 /
 * 334. Dentro la
 * manche il tempo taglia il valore della risposta esatta: rispondere subito
 * vale il tetto della domanda, rispondere all'ultimo secondo vale zero. Il voto
 * lo arbitra il server (`QuizService`) con la stessa regola: la sbagliata toglie
 * la quota della domanda scalata dal tempo, quindi il round va da −1000 a
 * +1000. `calculatePoints` resta solo per i vecchi test: in partita il
 * punteggio arriva da `applyServerAnswer`.
 */
export class QuizMode extends GameModeBase {
  readonly type: GameModeType = 'QUIZ';
  readonly timerDuration = MANCHE_SECONDS;
  readonly requiresBubbles = true;
  readonly requiresBuzz = false;

  private questions: QuizManche[] = [];
  private mancheIndex = signal(0);
  private mancheReveal = signal<QuizManche | null>(null);
  private answers = signal<Array<{ playerName: string; points: number; isCorrect: boolean; manche: number; optionIndex?: number | null }>>([]);
  /** Scadenza del tempo, soluzione non ancora mostrata. */
  private revealPending = signal(false);
  private finished = signal(false);
  private secondsLeft = 0;
  private answeredThisManche = new Set<string>();
  /** Cresce a ogni salvataggio: una scrittura vecchia non deve tornare indietro. */
  private revision = 0;
  private answersGeneration = 0;

  private clock?: ReturnType<typeof setInterval>;
  private advanceHandle?: ReturnType<typeof setTimeout>;

  protected onInitialize(): void {
    this.answersGeneration++;
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
    this.answersGeneration++;
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

  /** La pausa ferma il cronometro: il checkpoint deve dire da quando è fermo. */
  protected onPause(): void {
    this.emitCheckpoint();
  }

  protected onResume(): void {
    this.emitCheckpoint();
    void this.broadcastState();
  }

  protected onStop(): void {
    this.answersGeneration++;
    this.clearTimers();
    this.setQuestionOpen(false);
  }

  protected onCleanup(): void {
    this.answersGeneration++;
    this.clearTimers();
    this.setQuestionOpen(false);
    this.questions = [];
    this.answers.set([]);
    this.revision = 0;
  }

  protected onTimeout(): void {
    this.finish();
  }

  /**
   * Il voto non si calcola più in TV: lo arbitra il server (`QUIZ_ANSWER`).
   * Un telefono che mandasse ancora il vecchio messaggio WebSocket non prende
   * punti, e un doppio voto non esiste perché lo rifiuta il server.
   */
  override handleAnswer(_playerName: string, _answer: any, _timeMs: number): void {}

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

  /**
   * Apre una manche. Con `readingMs` la domanda resta prima in lettura (N-12):
   * a schermo, cronometro fermo e manche non ancora aperta sul server, così chi
   * risponde durante la lettura non prende punti.
   */
  private startManche(index: number, readingMs = 0): void {
    this.clearTimers();
    this.mancheIndex.set(index);
    this.mancheReveal.set(null);
    this.revealPending.set(false);
    this.answeredThisManche.clear();
    this.secondsLeft = MANCHE_SECONDS;
    this.timer.set(MANCHE_SECONDS);
    this.config.onTimerTick?.(MANCHE_SECONDS);

    const open = () => {
      this.isReading.set(false);
      this.startClock();
      void this.broadcastState();
      this.emitCheckpoint();
      void this.announceManche(index);
      this.setQuestionOpen(true);
    };

    if (readingMs <= 0) {
      open();
      return;
    }

    this.isReading.set(true);
    this.setQuestionOpen(false);
    void this.broadcastState();
    this.emitCheckpoint();
    this.advanceHandle = setTimeout(open, readingMs);
  }

  /**
   * Il server deve sapere quale manche è aperta prima di accettare voti.
   * Con `secondsLeft` la manche si riapre con il tempo che le resta: dopo un
   * refresh i punti non ripartono pieni.
   */
  private async announceManche(index: number, secondsLeft?: number): Promise<void> {
    try {
      if (secondsLeft == null) await this.config.startQuizManche?.(index);
      else await this.config.startQuizManche?.(index, secondsLeft);
    } catch {
      // Senza annuncio i voti vengono rifiutati: la TV mostra comunque la manche.
    }
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
      }
    }, 1000);
  }

  private revealManche(): void {
    if (this.finished() || this.mancheReveal()) return;
    // Il tempo è scaduto: da qui si legge la soluzione, non la domanda.
    this.setQuestionOpen(false);
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
        this.startManche(this.mancheIndex() + 1, MANCHE_BREATH_MS);
      }
    }, REVEAL_SECONDS * 1000);
  }

  private finish(): void {
    if (this.finished()) return;
    this.finished.set(true);
    this.setQuestionOpen(false);
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
    this.answersGeneration++;
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
          optionIndex: Number.isInteger(Number(row.optionIndex)) ? Number(row.optionIndex) : null,
        }))
      : [];
    const answered = Array.isArray(state.answeredThisManche)
      ? state.answeredThisManche.filter((name: unknown) => typeof name === 'string')
      : [];
    // Il checkpoint non è più scritto a ogni secondo: si toglie il tempo
    // trascorso da savedAt, tranne in pausa, dove il cronometro è fermo.
    const savedAt = Number(state.savedAt);
    const elapsed = state.paused === true || !Number.isFinite(savedAt) || savedAt <= 0
      ? 0
      : Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
    const savedSeconds = Number(state.secondsLeft);
    const seconds = Number.isFinite(savedSeconds)
      ? Math.max(0, Math.min(MANCHE_SECONDS, Math.round(savedSeconds) - elapsed))
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

    if (stage === 'suspense' || (stage === 'play' && seconds <= 0)) {
      // Il tempo era già scaduto: manca solo la soluzione.
      this.revealPending.set(true);
      this.revealManche();
    } else if (stage === 'reveal') {
      this.setQuestionOpen(false);
      const current = this.questions[index];
      if (current) {
        this.mancheReveal.set(current);
        this.scheduleAdvance();
      }
    } else {
      this.startClock();
      this.setQuestionOpen(true);
      // La manche va riannunciata anche se il server l'ha persa (riavvio) o la
      // sua finestra si era chiusa: dopo un refresh i telefoni devono votare.
      void this.announceManche(index, seconds);
    }
    void this.refreshAnswers();
    void this.broadcastState();
  }

  /**
   * Le risposte autorevoli sono sul server: quelle arrivate mentre la TV era
   * via non esistono più solo nel browser. Se la chiamata fallisce restano
   * quelle del checkpoint.
   */
  private async refreshAnswers(): Promise<void> {
    const generation = this.answersGeneration;
    try {
      const state = await this.config.loadQuizAnswers?.();
      if (generation !== this.answersGeneration) return;
      if (this.config.quizRoundStartId && state?.roundStartId !== this.config.quizRoundStartId) return;
      const rows: any[] = Array.isArray(state?.answers) ? state.answers : [];
      if (!rows.length) return;
      const answers = rows
        .filter((row: any) => row && typeof row.playerName === 'string' && Number.isInteger(Number(row.manche)))
        .map((row: any) => ({
          playerName: String(row.playerName),
          points: Number(row.points) || 0,
          isCorrect: !!row.isCorrect,
          manche: Number(row.manche),
          optionIndex: Number.isInteger(Number(row.optionIndex)) ? Number(row.optionIndex) : null,
        }));
      // I voti WebSocket arrivati dopo la richiesta sono più recenti della
      // fotografia HTTP: non vanno cancellati né sostituiti dal riepilogo.
      const merged = [...this.answers()];
      for (const row of answers) {
        if (!merged.some((current) => current.manche === row.manche
          && current.playerName.trim().toLowerCase() === row.playerName.trim().toLowerCase())) merged.push(row);
      }
      this.answers.set(merged);
      const manche = this.mancheIndex();
      this.answeredThisManche = new Set(
        merged.filter((row) => row.manche === manche).map((row) => row.playerName),
      );
    } catch {
      // Rete assente: la TV tiene le risposte del checkpoint.
    }
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
        // Il cronometro non si salva a ogni secondo: il tempo trascorso da qui
        // si ricava al recupero, e in pausa il tempo è fermo.
        savedAt: Date.now(),
        paused: this.isPaused(),
        stage: this.mancheReveal() ? 'reveal' : this.revealPending() ? 'suspense' : 'play',
        answers: this.answers(),
        answeredThisManche: [...this.answeredThisManche],
      },
    });
  }

  getDisplayData(): any {
    const current = this.questions[this.mancheIndex()];
    const options: string[] = current?.options ?? this.payload?.options ?? [];
    // I bottoni si chiudono appena scade il tempo, ma la soluzione si accende
    // solo quando la TV la mostra: durante l'attesa la suspense resta intera.
    const locked = this.revealPending() || !!this.mancheReveal() || this.revealed();
    const solved = !!this.mancheReveal() || this.revealed();
    const answerIndex = solved ? Math.max(-1, options.indexOf(current?.correctAnswer ?? '')) : -1;
    const pickedIndexes = solved
      ? [...new Set(this.answers()
        .filter((row) => row.manche === this.mancheIndex() && Number.isInteger(row.optionIndex))
        .map((row) => Number(row.optionIndex)))]
      : [];
    const wrongIndexes = pickedIndexes.filter((index) => index !== answerIndex);
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
      answerIndex,
      wrongIndexes,
      answersLocked: locked,
      correctAnswer: this.revealed() ? (current?.correctAnswer ?? null) : null,
      isReading: this.isReading(),
    };
  }

  /** Apre o chiude la domanda: la TV abbassa o rialza la base d'atto. */
  private setQuestionOpen(open: boolean): void {
    this.config.onQuestionOpenChange?.(open);
  }

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(_playerName: string, _answer: any, _result: any): void {
    // Il voto lo registra il server: la TV applica solo `applyServerAnswer`.
  }

  /** Esito dal server: una sola riga per giocatore e manche. */
  applyServerAnswer(result: any): boolean {
    if (this.config.quizRoundStartId && result?.roundStartId !== this.config.quizRoundStartId) return false;
    const playerName = String(result?.playerName ?? '').trim();
    const manche = Number(result?.manche);
    if (!playerName || !Number.isInteger(manche) || manche < 0) return false;
    const already = this.answers().some(
      (row) => row.manche === manche && row.playerName === playerName,
    );
    if (already) return false;

    this.answers.update((rows) => [...rows, {
      playerName,
      points: Number(result?.points) || 0,
      isCorrect: !!result?.isCorrect,
      manche,
      // La scelta del telefono: serve alla TV per accendere la sbagliata.
      optionIndex: Number.isInteger(Number(result?.optionIndex)) ? Number(result.optionIndex) : null,
    }]);
    if (manche === this.mancheIndex()) this.answeredThisManche.add(playerName);
    this.emitCheckpoint();
    return true;
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
