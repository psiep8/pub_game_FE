import { WsAction } from '../../../shared/enums/ws-action';
import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';

type Side = 'a' | 'b';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
/**
 * Come viaggia il disco. Quattro traiettorie di base e quattro legate al tempo
 * di risposta: chi risponde piano lancia un disco pesante, chi risponde secco
 * un disco che sfreccia.
 */
export type HockeyTrajectory =
  | 'dritto'
  | 'zigzag'
  | 'curva'
  | 'salto'
  | 'veloce'
  | 'accelerato'
  | 'frenata'
  | 'lento';

interface CourtSide {
  playerName: string;
  score: number;
  isBot: boolean;
  shots: number;
}

interface AirHockeyQuestion {
  text: string;
  options: string[];
  correctIndex: number;
  difficulty: Difficulty;
}

interface CourtEvent {
  kind: 'return' | 'goal';
  side: Side;
  id: number;
}

interface Court {
  id: number;
  a: CourtSide;
  b: CourtSide;
  winner: string | null;
  turn: Side;
  /** Lato da cui riparte il disco dopo un gol (chi lo ha subito). */
  puckSide?: Side;
  serveLeft: number;
  question: AirHockeyQuestion | null;
  lastEvent: CourtEvent | null;
  awarded: boolean;
  questionAt: number;
  shotMs: number;
  trajectory: HockeyTrajectory;
}

const POINTS_TO_WIN = 7;
const SERVE_SECONDS = 12;

/** Quanto pesa la traiettoria sul tempo di percorrenza del disco. */
const SHOT_SPEED: Record<HockeyTrajectory, number> = {
  dritto: 1,
  zigzag: 1,
  curva: 1,
  salto: 0.85,
  veloce: 0.45,
  accelerato: 0.7,
  frenata: 1.2,
  lento: 1.6,
};

const question = (
  difficulty: Difficulty,
  text: string,
  options: string[],
  correctIndex = 0
): AirHockeyQuestion => ({ difficulty, text, options, correctIndex });

/** Primi 3 tiri a testa: domande facili. */
const EASY_QUESTIONS: AirHockeyQuestion[] = [
  question('EASY', "Qual è la capitale d'Italia?", ['Roma', 'Milano', 'Napoli', 'Torino']),
  question('EASY', 'Quanti giorni ha una settimana?', ['7', '5', '10', '12']),
  question('EASY', 'Di che colore è il cielo in una giornata serena?', ['Azzurro', 'Verde', 'Rosso', 'Nero']),
  question('EASY', 'Quanto fa 2 + 2?', ['4', '5', '3', '6']),
  question('EASY', 'Quante zampe ha un ragno?', ['8', '6', '4', '10']),
  question('EASY', 'Su quale pianeta viviamo?', ['Terra', 'Marte', 'Luna', 'Venere']),
  question('EASY', 'Qual è il giorno dopo lunedì?', ['Martedì', 'Domenica', 'Venerdì', 'Mercoledì']),
  question('EASY', 'Quanti mesi ha un anno?', ['12', '10', '11', '13']),
  question('EASY', 'Qual è il colore del latte?', ['Bianco', 'Nero', 'Rosso', 'Blu']),
  question('EASY', 'In quale stagione di solito nevica?', ['Inverno', 'Estate', 'Primavera', 'Autunno']),
];

/** Poi 5 tiri a testa: domande medie. */
const MEDIUM_QUESTIONS: AirHockeyQuestion[] = [
  question('MEDIUM', 'Qual è la capitale della Francia?', ['Parigi', 'Lione', 'Marsiglia', 'Nizza']),
  question('MEDIUM', 'Chi ha dipinto la Gioconda?', ['Leonardo da Vinci', 'Michelangelo', 'Raffaello', 'Caravaggio']),
  question('MEDIUM', 'Quante corde ha un violino?', ['4', '5', '6', '3']),
  question('MEDIUM', "Qual è il fiume più lungo d'Italia?", ['Po', 'Tevere', 'Adige', 'Arno']),
  question('MEDIUM', 'Quale pianeta è il più vicino al Sole?', ['Mercurio', 'Venere', 'Marte', 'Terra']),
  question('MEDIUM', 'Chi ha scritto la Divina Commedia?', ['Dante Alighieri', 'Petrarca', 'Boccaccio', 'Manzoni']),
  question('MEDIUM', 'Quale elemento chimico ha simbolo Au?', ['Oro', 'Argento', 'Rame', 'Alluminio']),
  question('MEDIUM', 'Qual è la moneta del Giappone?', ['Yen', 'Won', 'Yuan', 'Ringgit']),
  question('MEDIUM', 'Quante sono le regioni italiane?', ['20', '19', '21', '18']),
  question('MEDIUM', 'In che anno è caduto il Muro di Berlino?', ['1989', '1991', '1987', '1985']),
];

/** Dopo 8 tiri a testa: tutte difficili. */
const HARD_QUESTIONS: AirHockeyQuestion[] = [
  question('HARD', "Qual è la capitale dell'Australia?", ['Canberra', 'Sydney', 'Melbourne', 'Perth']),
  question('HARD', 'Chi ha composto la Nona Sinfonia?', ['Beethoven', 'Mozart', 'Bach', 'Chopin']),
  question('HARD', 'Qual è il mare più salato?', ['Mar Morto', 'Mediterraneo', 'Mar Rosso', 'Adriatico']),
  question('HARD', 'Quanti giocatori ha una squadra di rugby in campo?', ['15', '11', '13', '7']),
  question('HARD', 'Chi ha scritto "1984"?', ['George Orwell', 'Aldous Huxley', 'Ray Bradbury', 'Franz Kafka']),
  question('HARD', 'Qual è la capitale del Canada?', ['Ottawa', 'Toronto', 'Montreal', 'Vancouver']),
  question('HARD', 'Quante ossa ha il corpo umano adulto?', ['206', '186', '226', '246']),
  question('HARD', "Qual è l'unità di misura della forza?", ['Newton', 'Joule', 'Watt', 'Pascal']),
  question('HARD', "Qual è l'elemento chimico con simbolo W?", ['Tungsteno', 'Titanio', 'Tallio', 'Tennesso']),
  question('HARD', 'Qual è il deserto più grande del mondo?', ['Antartico', 'Sahara', 'Gobi', 'Kalahari']),
];

/**
 * Traiettoria del disco in base al tempo di risposta e ai tiri già fatti.
 *
 * Risposta lenta = palla lavorata (zigzag, poi curva) che rallenta ancora
 * oltre i 9 secondi; risposta secca = tiro dritto, con un rimbalzo a salto o
 * uno scatto ogni pochi tiri per non avere sempre lo stesso tragitto. Sotto
 * il secondo il disco è una fucilata.
 */
export function trajectoryFor(elapsedMs: number, shots: number): HockeyTrajectory {
  if (elapsedMs >= 10500) return 'lento';
  if (elapsedMs >= 9000) return 'frenata';
  if (elapsedMs >= 7000) return 'curva';
  if (elapsedMs >= 4500) return 'zigzag';
  if (elapsedMs < 800) return 'veloce';
  if (shots % 4 === 3) return 'accelerato';
  return shots % 3 === 2 ? 'salto' : 'dritto';
}

/**
 * Quanto ci mette il disco ad attraversare la pista, in ms. Dipende dalla
 * traiettoria: un tiro "veloce" arriva in meno della metà del tempo.
 */
export function shotDurationFor(elapsedMs: number, shots: number): number {
  const trajectory = trajectoryFor(elapsedMs, shots);
  const base = Math.max(420, Math.min(2600, Math.round(400 + elapsedMs * 0.18)));
  return Math.max(220, Math.min(3400, Math.round(base * SHOT_SPEED[trajectory])));
}

/**
 * Air Hockey Battle: duello a domande.
 *
 * La palla è sempre da un lato: chi la riceve ha SERVE_SECONDS per rispondere
 * dal telefono. Risposta giusta = palla rimandata di là (nessun punto).
 * Risposta sbagliata o tempo scaduto = gol per l'avversario. Primo a 5.
 */
export class AirHockeyBattleMode extends GameModeBase {
  readonly type: GameModeType = 'AIR_HOCKEY_BATTLE';
  readonly timerDuration = 300;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private courts = signal<Court[]>([]);
  private eventCounter = 0;
  private pairsKey = 'pubgame.hockey.pairs';
  private tickInterval?: ReturnType<typeof setInterval>;
  private questions: AirHockeyQuestion[] = [];
  private lastQuestionText = '';
  /** Round già chiuso perché tutte le sfide sono decise. */
  private finished = false;

  protected onInitialize(): void {
    this.courts.set([]);
    this.finished = false;
    this.questions = this.buildQuestions();
  }

  protected async onStart(): Promise<void> {
    await this.loadBankQuestions();
    this.startMatch();
    await this.runPreGameSequence(3000);
  }

  /**
   * Le domande vere vengono dalla banca (con la difficoltà). Gli elenchi
   * scritti qui sotto restano solo come riserva se il backend non risponde.
   */
  private async loadBankQuestions(): Promise<void> {
    const loader = this.config.loadAirHockeyQuestions;
    if (!loader) return;

    try {
      const rows = await loader('MIXED');
      const fromBank: AirHockeyQuestion[] = rows
        .filter((row) => Array.isArray(row.options) && row.options.length >= 2)
        .map((row) => ({
          text: row.text,
          options: row.options,
          correctIndex: row.correctIndex >= 0 ? row.correctIndex : 0,
          difficulty: row.difficulty,
        }));

      if (fromBank.length > 0) {
        this.questions = [...fromBank, ...this.questions];
      }
    } catch {
      // Banca irraggiungibile: si continua con le domande di riserva.
    }
  }

  /** Esposto per il QA: accoppia i giocatori e serve la prima palla. */
  startMatch(): void {
    if (this.courts().length > 0) return;

    const players = this.shufflePlayers(this.config.activePlayers ?? []);
    this.pairsKey = `pubgame.hockey.pairs.${this.config.gameId || 0}`;
    const usedPairs = this.loadPairs();
    const next: Court[] = [];
    const waiting = [...players];

    // Accoppiamenti casuali e mai uguali due volte nella stessa serata: si
    // ripesca solo quando tutte le combinazioni possibili sono esaurite.
    while (waiting.length >= 2) {
      const first = waiting.shift()!;
      let opponentIndex = waiting.findIndex((name) => !usedPairs.has(this.pairKey(first, name)));
      if (opponentIndex < 0) {
        usedPairs.clear();
        opponentIndex = 0;
      }
      const opponent = waiting.splice(opponentIndex, 1)[0];
      usedPairs.add(this.pairKey(first, opponent));
      next.push(this.createCourt(next.length, first, opponent));
    }

    if (waiting.length === 1) {
      const last = waiting[0];
      next.push({
        id: next.length,
        a: { playerName: last, score: POINTS_TO_WIN, isBot: false, shots: 0 },
        b: { playerName: 'RIPOSO', score: 0, isBot: true, shots: 0 },
        winner: last,
        turn: 'a',
        serveLeft: 0,
        question: null,
        lastEvent: null,
        awarded: false,
        questionAt: Date.now(),
        shotMs: 450,
        trajectory: 'dritto',
      });
      this.awardCourt(next[next.length - 1]);
    }

    this.savePairs(usedPairs);
    this.courts.set(next);
    this.tickInterval = setInterval(() => this.tickServes(), 1000);
    this.broadcast();
  }

  private shufflePlayers(players: string[]): string[] {
    const copy = [...players];
    for (let index = copy.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  private pairKey(first: string, second: string): string {
    return [first.trim().toLowerCase(), second.trim().toLowerCase()].sort().join('|');
  }

  private loadPairs(): Set<string> {
    try {
      const raw = localStorage.getItem(this.pairsKey);
      const rows = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(rows) ? rows.map((row) => String(row)) : []);
    } catch {
      return new Set();
    }
  }

  private savePairs(pairs: Set<string>): void {
    try {
      localStorage.setItem(this.pairsKey, JSON.stringify([...pairs]));
    } catch {
      // Senza storage si riparte dalle combinazioni libere al prossimo round.
    }
  }

  private createCourt(id: number, a: string, b: string): Court {
    return {
      id,
      a: { playerName: a, score: 0, isBot: false, shots: 0 },
      b: { playerName: b, score: 0, isBot: false, shots: 0 },
      winner: null,
      turn: 'a',
      serveLeft: SERVE_SECONDS,
      question: this.nextQuestion('EASY'),
      lastEvent: null,
      awarded: false,
      questionAt: Date.now(),
      shotMs: 450,
      trajectory: 'dritto',
    };
  }

  private buildQuestions(): AirHockeyQuestion[] {
    const custom: AirHockeyQuestion[] = [];
    const payload = this.payload ?? {};

    if (payload.question && Array.isArray(payload.options) && payload.options.length >= 2) {
      const correct = payload.options.indexOf(payload.correctAnswer);
      custom.push({
        text: String(payload.question),
        options: payload.options.map((o: any) => String(o)),
        correctIndex: correct >= 0 ? correct : 0,
        difficulty: 'MEDIUM',
      });
    }

    return [...custom, ...EASY_QUESTIONS, ...MEDIUM_QUESTIONS, ...HARD_QUESTIONS];
  }

  private nextQuestion(difficulty: Difficulty = 'EASY'): AirHockeyQuestion {
    if (this.questions.length === 0) this.questions = this.buildQuestions();

    const pool = this.questions.filter((q) => q.difficulty === difficulty);
    const source = pool.length > 0 ? pool : this.questions;
    let index = Math.floor(Math.random() * source.length);
    if (source.length > 1 && source[index].text === this.lastQuestionText) {
      index = (index + 1) % source.length;
    }

    const picked = source[index];
    this.lastQuestionText = picked.text;
    return this.shuffleQuestion(picked);
  }

  /** Le opzioni vengono mescolate a ogni tiro: la risposta non è sempre la A. */
  private shuffleQuestion(q: AirHockeyQuestion): AirHockeyQuestion {
    const correct = q.options[q.correctIndex] ?? q.options[0];
    const options = [...q.options];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { ...q, options, correctIndex: Math.max(0, options.indexOf(correct)) };
  }

  /** Fasce di difficoltà: primi tiri facili, poi medie, poi solo difficili. */
  difficultyFor(shots: number): Difficulty {
    if (shots < 3) return 'EASY';
    if (shots < 8) return 'MEDIUM';
    return 'HARD';
  }

  private tickServes(): void {
    if (this.isPaused()) return;

    let changed = false;
    const next = this.courts().map((court) => {
      if (court.winner || !court.question || court.serveLeft <= 0) return court;
      changed = true;
      return { ...court, serveLeft: court.serveLeft - 1 };
    });

    if (changed) {
      this.courts.set(next);
      this.broadcast();

      for (const court of this.courts()) {
        if (!court.winner && court.question && court.serveLeft <= 0) {
          this.concede(court.id, court.turn);
        }
      }
    }
  }

  /** Evento dal telefono: AIR_HOCKEY_BATTLE_ANSWER con l'indice scelto. */
  handlePartyEvent(event: any): void {
    if (event?.action !== 'AIR_HOCKEY_BATTLE_ANSWER' || !event.playerName) return;

    const playerKey = String(event.playerName).trim().toLowerCase();
    const index = Number(event.answerIndex);
    const court = this.courts().find((c) =>
      c.a.playerName.trim().toLowerCase() === playerKey ||
      c.b.playerName.trim().toLowerCase() === playerKey
    );
    if (!court || court.winner || !court.question) return;

    const side: Side = court.a.playerName.trim().toLowerCase() === playerKey ? 'a' : 'b';
    if (court.turn !== side) return;

    const elapsedMs = Math.max(200, Date.now() - court.questionAt);

    if (index === court.question.correctIndex) {
      this.returnBall(court.id, side, elapsedMs);
    } else {
      this.concede(court.id, side);
    }
  }

  /** Palla rimandata: cambia lato, nuova domanda, nessun punto. */
  private returnBall(courtId: number, side: Side, elapsedMs: number): void {
    const other: Side = side === 'a' ? 'b' : 'a';
    this.eventCounter += 1;
    const eventId = this.eventCounter;

    // Risposta rapida = tiro secco e meno tempo all'avversario.
    // Risposta lenta = tiro a zig-zag e più tempo all'avversario.
    const seconds = Math.max(1, Math.min(20, Math.round(elapsedMs / 1000)));
    const serveLeft = Math.max(4, Math.min(SERVE_SECONDS, 3 + seconds));
    // Traiettoria e tempo di volo dipendono dal tiro appena fatto: il disco
    // lento ci mette il doppio, quello veloce arriva prima che l'avversario
    // legga la domanda. Si calcolano dentro il map, sul lato che ha tirato.

    this.courts.update((courts) => courts.map((court) => {
      if (court.id !== courtId || court.winner) return court;
      const trajectory = trajectoryFor(elapsedMs, court[side].shots + 1);
      const shotMs = shotDurationFor(elapsedMs, court[side].shots + 1);
      return {
        ...court,
        [side]: { ...court[side], shots: court[side].shots + 1 },
        turn: other,
        serveLeft,
        question: this.nextQuestion(this.difficultyFor(court[other].shots)),
        questionAt: Date.now(),
        shotMs,
        trajectory,
        lastEvent: { kind: 'return', side, id: eventId },
      };
    }));

    this.broadcast();
  }

  /** Gol: punto all'avversario, poi si riparte dal giocatore che l'ha preso. */
  private concede(courtId: number, side: Side): void {
    const other: Side = side === 'a' ? 'b' : 'a';
    this.eventCounter += 1;
    const eventId = this.eventCounter;

    this.courts.update((courts) => courts.map((court) => {
      if (court.id !== courtId || court.winner) return court;

      const scorer = court[other];
      const score = Math.min(POINTS_TO_WIN, scorer.score + 1);
      const updated: Court = {
        ...court,
        [other]: { ...scorer, score },
        [side]: { ...court[side], shots: court[side].shots + 1 },
        // Il disco parte dal lato di chi ha subito, ma la domanda è di chi ha segnato.
        turn: other,
        puckSide: side,
        serveLeft: SERVE_SECONDS,
        question: null,
        lastEvent: { kind: 'goal', side: other, id: eventId },
      } as Court;

      if (score >= POINTS_TO_WIN) {
        updated.winner = scorer.playerName;
      }
      return updated;
    }));

    const court = this.courts().find((c) => c.id === courtId);
    this.broadcast();
    if (court?.winner) {
      this.awardCourt(court);
      // Sfide tutte decise: il round chiude subito, non si aspetta il timer.
      this.finishIfDecided();
    }

    // Un attimo per vedere il gol, poi nuova palla al giocatore che l'ha subito.
    setTimeout(() => {
      const latest = this.courts().find((c) => c.id === courtId);
      if (!latest || latest.winner) return;
      const difficulty = this.difficultyFor(latest[other].shots);
      this.courts.update((courts) => courts.map((c) => c.id === courtId
        ? { ...c, turn: other, question: this.nextQuestion(difficulty), serveLeft: SERVE_SECONDS, questionAt: Date.now(), shotMs: 450, trajectory: 'dritto' }
        : c));
      this.broadcast();
    }, 1400);
  }

  /**
   * Ogni campo ha il suo vincitore: il round è finito, anche se al timer
   * generale restano secondi. Prima si aspettava il countdown completo.
   */
  private finishIfDecided(): void {
    if (this.finished) return;
    const courts = this.courts();
    if (!courts.length || courts.some((court) => !court.winner)) return;
    this.finished = true;
    this.stopTicking();
    this.handleTimeout();
  }

  private awardCourt(court: Court): void {
    if (court.awarded) return;
    court.awarded = true;

    if (court.b.isBot) {
      this.config.onAnswerReceived?.({ playerName: court.a.playerName, points: 700, isCorrect: true });
      return;
    }

    const winnerSide: Side = court.winner === court.a.playerName ? 'a' : 'b';
    const loserSide: Side = winnerSide === 'a' ? 'b' : 'a';

    this.config.onAnswerReceived?.({
      playerName: court[winnerSide].playerName,
      points: 1000,
      isCorrect: true,
    });
    this.config.onAnswerReceived?.({
      playerName: court[loserSide].playerName,
      points: 200,
      isCorrect: false,
    });
  }

  private broadcast(): void {
    this.config.onBroadcast?.({
      action: WsAction.AIR_HOCKEY_BATTLE_STATE,
      target: POINTS_TO_WIN,
      courts: this.courts().map((court) => ({
        id: court.id,
        index: court.id + 1,
        total: this.courts().length,
        a: { playerName: court.a.playerName, score: court.a.score },
        b: { playerName: court.b.playerName, score: court.b.score },
        winner: court.winner,
        turn: court.turn,
        puckSide: court.puckSide ?? court.turn,
        serveLeft: court.serveLeft,
        question: court.question,
        lastEvent: court.lastEvent,
        shotMs: court.shotMs,
        trajectory: court.trajectory,
        difficulty: court.question?.difficulty ?? null,
      })),
    });
  }

  protected onPause(): void {}

  protected onResume(): void {}

  protected onStop(): void {
    this.stopTicking();
  }

  protected onCleanup(): void {
    this.stopTicking();
    this.courts.set([]);
  }

  private stopTicking(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }
  }

  protected onTimeout(): void {
    this.stopTicking();
    for (const court of this.courts()) {
      if (!court.winner) {
        if (court.a.score === court.b.score) {
          this.config.onAnswerReceived?.({ playerName: court.a.playerName, points: 500, isCorrect: true });
          this.config.onAnswerReceived?.({ playerName: court.b.playerName, points: 500, isCorrect: true });
        } else {
          const winnerSide: Side = court.a.score > court.b.score ? 'a' : 'b';
          const loserSide: Side = winnerSide === 'a' ? 'b' : 'a';
          this.config.onAnswerReceived?.({ playerName: court[winnerSide].playerName, points: 1000, isCorrect: true });
          this.config.onAnswerReceived?.({ playerName: court[loserSide].playerName, points: 200, isCorrect: false });
        }
        court.awarded = true;
      }
    }
    this.revealed.set(true);
  }

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(_playerName: string, _answer: any, _result: any): void {}

  protected onConfirmCorrect(_result: GameModeResult): void {}

  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(answer: any, _timeMs: number): any {
    return { isCorrect: !!answer, points: 0 };
  }

  protected calculatePoints(_isCorrect: boolean, _elapsedMs: number): number {
    return 0;
  }

  getDisplayData() {
    return {
      question: 'Air Hockey Battle!',
      courts: this.courts(),
      target: POINTS_TO_WIN,
      isReading: this.isReading(),
      revealed: this.revealed(),
      correctAnswer: null,
    };
  }
}
