import { signal } from '@angular/core';
import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';

export interface ArenaTeamProgress {
  playerName: string;
  /** 0 = centro, 100 = bordo esterno. */
  distance: number;
  eliminated: boolean;
  score: number;
  position?: number;
}

export interface ArenaDisplayData {
  teams: ArenaTeamProgress[];
  circleRadius: number;
  eliminatedPlayers: string[];
  gameEnded: boolean;
  winners: string[];
}

export interface ArenaSnapshot {
  teams: ArenaTeamProgress[];
  eliminatedPlayers: string[];
  inactivityTotals: Array<[string, number]>;
  deferredInactivity: Array<{ playerName: string; count: number }>;
  appliedAnswerSeqs: number[];
}

const MIN_RADIUS = 14;
/** Venti secondi di respiro: il restringimento si distribuisce sul resto del round. */
const SHRINK_GRACE_SECONDS = 20;
const TICK_MS = 1000;
/** Ogni quanto la TV chiede al server se qualcuno è rimasto inattivo. */
const INACTIVITY_POLL_MS = 2000;

export class ArenaMode extends GameModeBase {
  readonly type: GameModeType = 'ARENA';
  readonly timerDuration = 130;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  private teams = signal<Map<string, ArenaTeamProgress>>(new Map());
  private circleRadius = signal<number>(100);
  private eliminatedPlayers = signal<string[]>([]);
  private gameEnded = signal<boolean>(false);
  private winners = signal<string[]>([]);
  private inactivityPoll?: ReturnType<typeof setInterval>;
  private inactivityPollPending = false;
  private inactivityGeneration = 0;
  private deferredInactivity: Array<{ playerName: string; count: number }> = [];
  private inactivityTotals = new Map<string, number>();
  private appliedAnswerSeqs = new Set<number>();

  protected onInitialize(): void {
    // Le squadre si creano in onStart, quando la configurazione è già applicata.
  }

  protected async onStart(): Promise<void> {
    this.initializeTeams();
    await this.runPreGameSequence(5000);
  }

  /** Stato necessario a ricostruire il round, escluso il timer autorevole. */
  snapshot(): ArenaSnapshot {
    return {
      teams: Array.from(this.teams().values(), (team) => ({ ...team })),
      eliminatedPlayers: [...this.eliminatedPlayers()],
      inactivityTotals: Array.from(this.inactivityTotals.entries()),
      deferredInactivity: this.deferredInactivity.map((row) => ({ ...row })),
      appliedAnswerSeqs: [...this.appliedAnswerSeqs],
    };
  }

  /** Riprende dal tempo residuo del server senza inizializzare nuove squadre. */
  restore(secondsLeft: number, snapshot?: unknown): void {
    const state = snapshot as ArenaSnapshot;
    if (!state || !Array.isArray(state.teams) || !Array.isArray(state.eliminatedPlayers)
      || !Array.isArray(state.inactivityTotals) || !Array.isArray(state.deferredInactivity)
      || !Array.isArray(state.appliedAnswerSeqs)
      || !state.teams.every((team) => team && typeof team.playerName === 'string' && team.playerName.trim()
        && Number.isFinite(team.distance) && team.distance >= 0 && team.distance <= 100
        && Number.isFinite(team.score) && typeof team.eliminated === 'boolean')
      || new Set(state.teams.map((team) => team.playerName.trim().toLowerCase())).size !== state.teams.length
      || !state.eliminatedPlayers.every((name) => typeof name === 'string'
        && state.teams.some((team) => team.playerName === name && team.eliminated))
      || new Set(state.eliminatedPlayers).size !== state.eliminatedPlayers.length
      || state.teams.filter((team) => team.eliminated).length !== state.eliminatedPlayers.length
      || !state.inactivityTotals.every((row) => Array.isArray(row) && row.length === 2
        && typeof row[0] === 'string' && Number.isSafeInteger(row[1]) && row[1] >= 0)
      || !state.deferredInactivity.every((row) => row && typeof row.playerName === 'string'
        && Number.isSafeInteger(row.count) && row.count > 0)
      || !state.appliedAnswerSeqs.every((seq) => Number.isSafeInteger(seq) && seq > 0)) {
      throw new Error('Stato Arena non ripristinabile');
    }
    this.teams.set(new Map(state.teams.map((team) => [team.playerName, { ...team }])));
    this.eliminatedPlayers.set([...state.eliminatedPlayers]);
    this.inactivityTotals = new Map(state.inactivityTotals);
    this.appliedAnswerSeqs = new Set(state.appliedAnswerSeqs ?? []);
    this.deferredInactivity = state.deferredInactivity.map((row) => ({ ...row }));
    this.gameEnded.set(false);
    this.winners.set([]);
    const remaining = Math.max(0, Math.min(this.timerDuration, Math.round(Number(secondsLeft) || 0)));
    this.timer.set(remaining);
    this.circleRadius.set(this.radiusForSecond(remaining + 1));
    this.started = true;
    this.isActive.set(true);
    this.isPaused.set(false);
    this.applyInactivityPenalties(this.deferredInactivity.splice(0));
    if (!this.gameEnded()) this.startTimer();
  }

  protected onPause(): void {
    // Il polling può recuperare penalità già maturate prima della pausa;
    // il server esclude il tempo fermo anche se la TV perde la connessione.
    this.startInactivityPoll();
  }

  protected onResume(): void {
    this.applyInactivityPenalties(this.deferredInactivity.splice(0));
  }

  protected onStop(): void {
    this.inactivityGeneration++;
    this.deferredInactivity = [];
    this.endGame();
  }

  protected onCleanup(): void {
    this.inactivityGeneration++;
    this.deferredInactivity = [];
    this.inactivityTotals.clear();
    this.appliedAnswerSeqs.clear();
    this.stopInactivityPoll();
    this.teams.set(new Map());
    this.circleRadius.set(100);
    this.eliminatedPlayers.set([]);
    this.gameEnded.set(false);
    this.winners.set([]);
  }

  protected onTimeout(): void {
    this.endGame();
  }

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(playerName: string, _answer: any, result: any): void {
    if (this.gameEnded() || !this.isActive()) return;

    this.updateTeamFromAnswer(playerName, !!result?.isCorrect, result?.points || 0);
  }

  hasArenaAnswer(eventSeq: number): boolean {
    return this.appliedAnswerSeqs.has(eventSeq);
  }

  /** Risposta rapida arrivata dal telefono (canale WebSocket dedicato). */
  applyArenaAnswer(playerName: string, isCorrect: boolean, points: number = 0, eventSeq?: number): boolean {
    if (this.gameEnded() || !this.isActive()) return false;
    if (eventSeq && this.appliedAnswerSeqs.has(eventSeq)) return false;
    if (eventSeq) this.appliedAnswerSeqs.add(eventSeq);
    this.updateTeamFromAnswer(playerName, isCorrect, points);
    return true;
  }

  protected onConfirmCorrect(_result: GameModeResult): void {}

  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(answer: any, _timeMs: number): any {
    return { isCorrect: answer?.isCorrect || false };
  }

  protected calculatePoints(isCorrect: boolean, _elapsedMs: number): number {
    return isCorrect ? 10 : -10;
  }

  /**
   * Il cerchio si restringe negli ultimi secondi: chi resta fuori viene eliminato.
   */
  protected override startTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.isPaused() || this.buzzedPlayer()) return;

      const current = this.timer();
      if (current > 0) {
        this.timer.set(current - 1);
        this.config.onTimerTick?.(current - 1);
        this.circleRadius.set(this.radiusForSecond(current));
        this.checkEliminations();
      } else {
        this.stopTimer();
        this.handleTimeout();
      }
    }, TICK_MS);
    this.startInactivityPoll();
  }

  protected override stopTimer(): void {
    super.stopTimer();
    this.stopInactivityPoll();
  }

  private radiusForSecond(secondsLeft: number): number {
    const timeRatio = secondsLeft / this.timerDuration;
    const shrinkStartRatio = (this.timerDuration - SHRINK_GRACE_SECONDS) / this.timerDuration;

    if (timeRatio >= shrinkStartRatio) return 100;

    const normalizedRatio = timeRatio / shrinkStartRatio;
    return MIN_RADIUS + (100 - MIN_RADIUS) * normalizedRatio;
  }

  private initializeTeams(): void {
    const activePlayers = this.config.activePlayers ?? [];
    const initialTeams = new Map<string, ArenaTeamProgress>();

    // L'array arriva già ordinato per classifica: chi è davanti parte più
    // vicino al centro, chi è indietro più vicino al bordo.
    activePlayers.forEach((playerName: string, index: number) => {
      const rankRatio = activePlayers.length > 1 ? index / (activePlayers.length - 1) : 0.5;

      initialTeams.set(playerName, {
        playerName,
        distance: 30 + rankRatio * 50,
        eliminated: false,
        score: 0,
      });
    });

    this.teams.set(initialTeams);
    this.circleRadius.set(100);
    this.eliminatedPlayers.set([]);
    this.gameEnded.set(false);
    this.winners.set([]);
  }

  private updateTeamFromAnswer(playerName: string, isCorrect: boolean, roundScore: number): void {
    const currentTeams = new Map(this.teams());
    const key = playerName.trim().toLowerCase();

    const teamKey = Array.from(currentTeams.keys()).find((name) => name.toLowerCase() === key);
    if (!teamKey) return;

    const team = currentTeams.get(teamKey);
    if (!team || team.eliminated) return;

    // Verso il centro si avanza più lentamente; l'errore spinge un po' meno
    // verso il bordo. Il bilanciamento va verificato con giocatori reali.
    const movement = isCorrect ? -5 : 12;
    currentTeams.set(teamKey, {
      ...team,
      distance: Math.max(0, Math.min(100, team.distance + movement)),
      score: team.score + roundScore,
    });

    this.teams.set(currentTeams);
    this.checkEliminations();
  }

  /** Il server possiede il timeout: la TV chiede e applica solo le penalità. */
  private startInactivityPoll(): void {
    if (!this.config.onArenaInactivityCheck) return;
    if (this.inactivityPoll) clearInterval(this.inactivityPoll);
    this.inactivityPoll = setInterval(() => void this.pollInactivity(), INACTIVITY_POLL_MS);
    // Primo tick subito: il server registra l'istante di partenza esatto.
    void this.pollInactivity();
  }

  private stopInactivityPoll(): void {
    if (this.inactivityPoll) {
      clearInterval(this.inactivityPoll);
      this.inactivityPoll = undefined;
    }
  }

  private async pollInactivity(): Promise<void> {
    const check = this.config.onArenaInactivityCheck;
    if (!check || this.inactivityPollPending || this.gameEnded() || !this.isActive()) return;
    const players = Array.from(this.teams().values())
      .filter((team) => !team.eliminated)
      .map((team) => team.playerName);
    if (players.length === 0) return;

    this.inactivityPollPending = true;
    const generation = this.inactivityGeneration;
    try {
      const due = await check(players);
      // Una penalità già consegnata dal server non va persa durante la pausa.
      if (generation !== this.inactivityGeneration || this.gameEnded() || !this.isActive()) return;
      const increments: Array<{ playerName: string; count: number }> = [];
      for (const row of due) {
        const total = Number(row.count);
        if (!Number.isSafeInteger(total) || total <= 0) continue;
        const key = row.playerName.trim().toLowerCase();
        const previous = this.inactivityTotals.get(key) ?? 0;
        if (total <= previous) continue;
        this.inactivityTotals.set(key, total);
        increments.push({ playerName: row.playerName, count: total - previous });
      }
      if (this.isPaused()) this.deferredInactivity.push(...increments);
      else this.applyInactivityPenalties(increments);
    } catch {
      // Senza server niente penalità inventate: si riprova al prossimo tick.
    } finally {
      this.inactivityPollPending = false;
    }
  }

  private applyInactivityPenalties(due: Array<{ playerName: string; count: number }>): void {
    if (this.gameEnded() || due.length === 0) return;
    const currentTeams = new Map(this.teams());
    for (const row of due) {
      const key = row.playerName.trim().toLowerCase();
      const teamKey = Array.from(currentTeams.keys()).find((name) => name.toLowerCase() === key);
      const team = teamKey ? currentTeams.get(teamKey) : null;
      if (!teamKey || !team || team.eliminated) continue;
      const count = Math.max(1, Number(row.count) || 1);
      currentTeams.set(teamKey, {
        ...team,
        distance: Math.min(100, team.distance + 12 * count),
      });
    }
    // Le penalità dello stesso tick sono simultanee: prima muoviamo tutti,
    // poi decidiamo le eliminazioni e l'eventuale fine della partita.
    this.teams.set(currentTeams);
    this.checkEliminations();
  }

  private checkEliminations(): void {
    if (this.gameEnded()) return;

    const currentRadius = this.circleRadius();
    const currentTeams = new Map(this.teams());
    const eliminated = [...this.eliminatedPlayers()];
    const tolerance = 2;
    let newlyEliminated = false;
    let stillInGame = 0;

    currentTeams.forEach((team, key) => {
      if (team.eliminated) return;

      if (team.distance > currentRadius + tolerance) {
        currentTeams.set(key, { ...team, eliminated: true });
        eliminated.push(team.playerName);
        newlyEliminated = true;
        this.config.onPlayerEliminated?.(team.playerName);
      } else {
        stillInGame++;
      }
    });

    if (!newlyEliminated) return;

    this.teams.set(currentTeams);
    this.eliminatedPlayers.set(eliminated);

    if (stillInGame <= 1) this.endGame();
  }

  private endGame(): void {
    if (this.gameEnded()) return;

    this.gameEnded.set(true);

    const eliminatedOrder = this.eliminatedPlayers();
    const teams = Array.from(this.teams().values()).sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (!a.eliminated) return a.distance - b.distance;
      return eliminatedOrder.indexOf(b.playerName) - eliminatedOrder.indexOf(a.playerName);
    });

    // Il podio premia chi è arrivato più vicino al centro; la metà bassa perde punti.
    const halfMark = Math.ceil(teams.length / 2);
    const ranked = teams.map((team, index) => {
      let score = 0;
      if (index === 0) score = 1000;
      else if (index < halfMark) score = 500;
      else score = -300;

      return { ...team, position: index + 1, score };
    });

    this.winners.set(ranked.slice(0, 3).map((team) => team.playerName));
    this.teams.set(new Map(ranked.map((team) => [team.playerName, team])));

    if (this.isActive()) this.stop();
    this.config.onRoundEnded?.();
  }

  getDisplayData(): ArenaDisplayData {
    return {
      teams: Array.from(this.teams().values()),
      circleRadius: this.circleRadius(),
      eliminatedPlayers: this.eliminatedPlayers(),
      gameEnded: this.gameEnded(),
      winners: this.winners(),
    };
  }
}
