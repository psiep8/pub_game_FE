import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environment/environment';
import { ReliabilityService } from './reliability.service';

export interface ButtonTestTeam {
  playerName: string;
  completedSteps: number;
  nextStep: number;
  done: boolean[];
  latencyMs: number;
  vibrated: boolean | null;
  flagged: boolean;
  skipped: boolean;
  completed: boolean;
  updatedAt: number;
}

export interface ButtonTestSnapshot {
  active: boolean;
  steps: number;
  targetIndex: number;
  targetLabel: string;
  allReady: boolean;
  startedAt: number;
  teams: ButtonTestTeam[];
}

export interface ButtonTestStep {
  step: number;
  vibrated?: boolean;
  latencyMs?: number;
  flagged?: boolean;
}

/** Unico punto di accesso alla prova: il nome della squadra lo mette il server. */
@Injectable({ providedIn: 'root' })
export class ButtonTestService {
  private http = inject(HttpClient);
  private reliability = inject(ReliabilityService);

  snapshot(gameId: number): Observable<ButtonTestSnapshot> {
    return this.http.get<ButtonTestSnapshot>(this.url(gameId));
  }

  me(gameId: number): Observable<ButtonTestTeam & { steps: number; targetLabel: string }> {
    return this.http.get<ButtonTestTeam & { steps: number; targetLabel: string }>(this.url(gameId, 'me'), {
      headers: this.authHeaders(),
    });
  }

  step(gameId: number, result: ButtonTestStep): Observable<ButtonTestTeam & { steps: number }> {
    return this.http.post<ButtonTestTeam & { steps: number }>(this.url(gameId, 'step'), result, {
      headers: this.authHeaders(),
    });
  }

  ping(gameId: number, clientAt: number): Observable<{ serverTime: number; clientAt: number }> {
    return this.http.post<{ serverTime: number; clientAt: number }>(
      this.url(gameId, 'ping'),
      { clientAt },
      { headers: this.authHeaders() },
    );
  }

  start(gameId: number): Observable<ButtonTestSnapshot> {
    return this.http.post<ButtonTestSnapshot>(this.url(gameId, 'start'), {}, { headers: this.authHeaders() });
  }

  reset(gameId: number, playerName: string): Observable<ButtonTestTeam> {
    return this.http.post<ButtonTestTeam>(this.url(gameId, 'reset'), { playerName }, { headers: this.authHeaders() });
  }

  skip(gameId: number): Observable<ButtonTestSnapshot> {
    return this.http.post<ButtonTestSnapshot>(this.url(gameId, 'skip'), {}, { headers: this.authHeaders() });
  }

  finish(gameId: number): Observable<ButtonTestSnapshot> {
    return this.http.post<ButtonTestSnapshot>(this.url(gameId, 'finish'), {}, { headers: this.authHeaders() });
  }

  private url(gameId: number, suffix = ''): string {
    return `${environment.apiUrl}/games/${gameId}/button-test${suffix ? '/' + suffix : ''}`;
  }

  private authHeaders(): Record<string, string> {
    const token = this.reliability.sessionToken();
    return token ? { 'X-Session-Token': token } : {};
  }
}
