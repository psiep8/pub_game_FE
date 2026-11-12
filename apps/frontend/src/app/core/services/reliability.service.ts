import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subject, firstValueFrom } from 'rxjs';
import { environment } from '../environment/environment';
import { WebSocketService } from '../websocket/web-socket.service';

export type DeviceRole = 'TV' | 'REMOTE' | 'ADMIN';

const DEVICE_KEY = 'pubgame.deviceId';
// Un token per ruolo: TV, admin e telefono possono condividere lo stesso
// browser/profile senza rubarsi la sessione a vicenda.
const sessionKey = (gameId: number, role: DeviceRole) => `pubgame.session.${gameId}.${role}`;
/** Oltre questo numero di eventi ricordati si riparte: evita memoria infinita. */
const MAX_SEEN_EVENTS = 200;

/**
 * Affidabilità del dispositivo: sessione, heartbeat, sincronizzazione.
 *
 * Il WebSocket porta gli aggiornamenti veloci, ma non è l'unica verità: appena
 * la socket torna su questo servizio riapre la sessione con il token salvato
 * (stessa squadra, stesso dispositivo) e chiede al server snapshot ed eventi
 * mancanti. Se il server non risponde il dispositivo resta "offline" e riprova,
 * senza mai inventare uno stato per conto proprio.
 */
@Injectable({ providedIn: 'root' })
export class ReliabilityService {
  private http = inject(HttpClient);
  private ws = inject(WebSocketService);
  private baseUrl = environment.apiUrl;

  readonly online = signal(false);
  readonly syncing = signal(false);
  readonly stateVersion = signal(0);
  readonly seq = signal(0);
  readonly lastSyncAt = signal<number | null>(null);
  readonly sessionToken = signal<string | null>(null);
  readonly resumedSession = signal(false);
  readonly duplicateDisplay = signal(false);
  readonly serverSkewMs = signal(0);
  readonly lastError = signal<string | null>(null);
  readonly reconnectCount = signal(0);

  /** Snapshot + eventi mancanti: chi vuole ridisegnare la schermata ascolta qui. */
  readonly syncState$ = new Subject<any>();
  /** Singolo evento recuperato dopo una disconnessione, in ordine di sequenza. */
  readonly syncEvent$ = new Subject<any>();

  private gameId = 1;
  private role: DeviceRole = 'REMOTE';
  private playerName = '';
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private started = false;
  private listening = false;
  /** Un errore di rete isolato non deve accendere un alert sul telefono. */
  private heartbeatFailures = 0;
  private seenEvents = new Set<string>();
  /**
   * Codice di abbinamento già inserito in questa scheda. Vale una volta sola
   * lato server: serve solo a non richiederlo a ogni riavvio della sessione.
   */
  private pairingCode: string | null = null;
  /** Segreto di regia inserito in questa scheda: serve solo alla TV per generare codici. */
  private controlSecret: string | null = null;

  /** Avvia sessione e heartbeat per questo dispositivo (idempotente). */
  async start(gameId: number, role: DeviceRole, playerName = ''): Promise<boolean> {
    if (role === 'REMOTE' && !playerName.trim()) return false;
    if (this.started && gameId === this.gameId && role === this.role && playerName.trim() === this.playerName
      && this.sessionToken()) {
      this.ws.connect();
      return true;
    }
    if (gameId !== this.gameId || role !== this.role) this.sessionToken.set(null);
    this.role = role;
    this.playerName = playerName.trim();
    this.gameId = gameId;
    this.started = true;
    this.heartbeatFailures = 0;
    this.ws.subscribeToGame(gameId);
    if (!this.listening) {
      this.listening = true;
      this.ws.connectedAt$.subscribe(() => {
        this.online.set(true);
        void this.onReconnected();
      });
    }
    const registered = await this.ensureSession();
    if (registered) {
      this.ws.setSessionToken(this.sessionToken()!, this.role);
      void this.sync();
      this.startHeartbeat();
    } else {
      this.started = false;
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    return registered;
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    this.started = false;
  }

  /** Ora del server: i timer del round non si basano sull'orologio del telefono. */
  serverNow(): number {
    return Date.now() + this.serverSkewMs();
  }

  deviceId(): string {
    try {
      const stored = localStorage.getItem(DEVICE_KEY);
      if (stored) return stored;
      const generated =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, generated);
      return generated;
    } catch {
      return 'dev-anon';
    }
  }

  /** Chiave di idempotenza stabile per un comando (risposta, stima, ordine). */
  idempotencyKey(kind: string, discriminator: string): string {
    return `${this.deviceId()}:${kind}:${discriminator}`;
  }

  /**
   * Codice breve per l'abbinamento della regia (solo dalla TV). Il segreto di
   * regia viene chiesto una volta sola per scheda e poi tenuto in memoria.
   */
  async requestPairingCode(): Promise<{ code: string; ttlSeconds: number } | null> {
    try {
      this.controlSecret ??= window.prompt('Inserisci il segreto di regia');
      if (!this.controlSecret) return null;
      const response = await firstValueFrom(
        this.http.post<{ code: string; ttlSeconds: number }>(
          `${this.baseUrl}/games/${this.gameId}/pairing-code`, {},
          { headers: { 'X-Control-Secret': this.controlSecret } })
      );
      return response;
    } catch (error) {
      if ((error as HttpErrorResponse)?.status === 401) this.controlSecret = null;
      this.lastError.set('Impossibile creare il codice di abbinamento');
      return null;
    }
  }

  /**
   * Salva la mano Blackjack sul server (solo la TV). Un errore di rete non
   * ferma il gioco: al peggio la ripresa mostra il round senza la mano.
   */
  saveBlackjackState(state: unknown | null): void {
    const token = this.sessionToken();
    if (!token || this.role !== 'TV' || this.gameId == null) return;
    this.http.post(`${this.baseUrl}/games/${this.gameId}/blackjack-state`, {
      sessionToken: token,
      state,
    }).subscribe({ error: () => undefined });
  }

  /** Riapre la sessione con il token salvato (o ne crea una nuova). */
  async ensureSession(): Promise<boolean> {
    try {
      const token = this.sessionToken() ?? this.storedToken();
      const needsAuth = !token && this.role !== 'REMOTE';
      // Codice breve dalla TV (4-6 cifre); il segreto completo resta come ripiego.
      const pairingCode = needsAuth
        ? (this.pairingCode ??= window.prompt('Inserisci il codice della TV'))
        : null;
      if (needsAuth && !pairingCode) return false;
      const response = await firstValueFrom(
        this.http.post<any>(`${this.baseUrl}/games/${this.gameId}/session`, {
          deviceId: this.deviceId(),
          role: this.role,
          playerName: this.playerName || null,
          sessionToken: token,
          pairingCode: pairingCode ? pairingCode.trim() : null,
        })
      );
      this.applyTiming(response);
      this.pairingCode = null;
      this.sessionToken.set(response?.sessionToken ?? null);
      this.persistToken(response?.sessionToken);
      this.resumedSession.set(!!response?.resumed);
      this.duplicateDisplay.set(!!response?.duplicateDisplay);
      this.stateVersion.set(Number(response?.stateVersion ?? this.stateVersion()));
      // Il server ha risposto: la sessione è viva anche se la socket STOMP è
      // ancora in riapertura. Senza questo, la badge restava su "Riconnessione"
      // anche con tutto funzionante.
      this.online.set(true);
      this.lastError.set(null);
      return true;
    } catch (error) {
      const status = (error as HttpErrorResponse)?.status;
      if (status === 403 && this.role === 'REMOTE') {
        this.lastError.set('Il nome non corrisponde alla sessione salvata');
        this.online.set(false);
        return false;
      }
      if (status === 401 && (this.sessionToken() || this.storedToken())) {
        this.persistToken(null);
        this.sessionToken.set(null);
        return this.ensureSession();
      }
      if (status === 401) {
        // Il codice non è valido o è scaduto: il prossimo tentativo lo richiede.
        this.pairingCode = null;
      }
      this.online.set(false);
      this.lastError.set(status === 409 ? 'Nome già in uso, scegline un altro' : 'Sessione non disponibile');
      return false;
    }
  }

  /** Stato autorevole + eventi mancanti dalla sequenza nota. */
  async sync(): Promise<void> {
    if (this.syncing()) return;
    this.syncing.set(true);
    try {
      const token = this.sessionToken();
      let snapshot: any = {};
      let complete = false;
      while (!complete) {
        const previousSeq = this.seq();
        const query = `?sinceSeq=${previousSeq}`;
        const response = await firstValueFrom(
          this.http.get<any>(`${this.baseUrl}/games/${this.gameId}/sync${query}`, {
            headers: token ? { 'X-Session-Token': token } : {},
          })
        );
        this.applyTiming(response);
        snapshot = response?.snapshot ?? {};
        const missed = Array.isArray(response?.events) ? response.events : [];
        for (const event of missed) this.applyEvent(event);
        const nextSeq = Number(response?.toSeq ?? previousSeq);
        complete = response?.complete !== false;
        if (!Number.isFinite(nextSeq) || (!complete && nextSeq <= previousSeq && !response?.stale)) {
          throw new Error('Sincronizzazione senza avanzamento');
        }
        this.seq.set(nextSeq);
      }
      this.stateVersion.set(Number(snapshot.version ?? 0));
      this.online.set(true);
      this.lastSyncAt.set(Date.now());
      this.lastError.set(null);
      this.syncState$.next(snapshot);
    } catch (error) {
      console.error('❌ Sincronizzazione non riuscita', error);
      this.online.set(false);
      this.lastError.set('Sincronizzazione non riuscita');
    } finally {
      this.syncing.set(false);
    }
  }

  /** Heartbeat periodico: presenza, versione e richiesta di sync se serve. */
  async heartbeat(): Promise<void> {
    const token = this.sessionToken();
    if (!token) {
      if (await this.ensureSession()) {
        this.ws.setSessionToken(this.sessionToken()!, this.role);
        await this.sync();
      }
      return;
    }
    try {
      const response = await firstValueFrom(
        this.http.post<any>(`${this.baseUrl}/games/${this.gameId}/session/heartbeat`, {
          sessionToken: token,
          seq: this.seq(),
        })
      );
      this.applyTiming(response);
      // Un heartbeat riuscito significa che il backend risponde, anche se la
      // socket STOMP sta ancora riaprendo.
      this.online.set(true);
      this.heartbeatFailures = 0;
      if (this.lastError() === 'Heartbeat non riuscito') this.lastError.set(null);
      if (Number(response?.stateVersion ?? 0) > this.stateVersion()) {
        this.stateVersion.set(Number(response.stateVersion));
      }
      if (response?.needsSync) {
        await this.sync();
      } else if (this.lastSyncAt() !== null) {
        // Senza un sync riuscito il seq non si allinea: altrimenti un telefono
        // appena ricaricato salterebbe gli eventi persi senza mai applicare lo
        // snapshot e resterebbe bloccato sulla schermata di attesa.
        this.seq.set(Number(response?.seq ?? this.seq()));
      }
    } catch (error) {
      const status = (error as HttpErrorResponse)?.status;
      if (status === 410 || status === 401) {
        // Il server non conosce più questa sessione: si riparte dal token nuovo.
        this.heartbeatFailures = 0;
        if (this.lastError() === 'Heartbeat non riuscito') this.lastError.set(null);
        this.persistToken(null);
        this.sessionToken.set(null);
        if (await this.ensureSession()) {
          this.ws.setSessionToken(this.sessionToken()!, this.role);
          await this.sync();
        }
        return;
      }
      this.online.set(false);
      this.heartbeatFailures += 1;
      if (this.heartbeatFailures >= 2) this.lastError.set('Heartbeat non riuscito');
    }
  }

  async diagnostics(gameId = this.gameId): Promise<any | null> {
    try {
      return await firstValueFrom(
        this.http.get<any>(`${this.baseUrl}/games/${gameId}/diagnostics`)
      );
    } catch {
      return null;
    }
  }

  private async onReconnected(): Promise<void> {
    this.reconnectCount.update((value) => value + 1);
    await this.sync();
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    // 10 s: metà del timeout del server, così un pacchetto perso non basta a
    // far sembrare offline un telefono che sta giocando.
    this.heartbeatTimer = setInterval(() => void this.heartbeat(), 10000);
  }

  private applyEvent(event: any): void {
    const eventId = String(event?.eventId ?? '');
    if (!eventId || this.seenEvents.has(eventId)) return;
    this.seenEvents.add(eventId);
    if (this.seenEvents.size > MAX_SEEN_EVENTS) {
      this.seenEvents = new Set(Array.from(this.seenEvents).slice(-MAX_SEEN_EVENTS));
    }
    this.syncEvent$.next(event);
  }

  private applyTiming(response: any): void {
    const serverTime = Number(response?.serverTime);
    if (Number.isFinite(serverTime) && serverTime > 0) {
      this.serverSkewMs.set(serverTime - Date.now());
    }
  }

  private storedToken(): string | null {
    try {
      return localStorage.getItem(sessionKey(this.gameId, this.role));
    } catch {
      return null;
    }
  }

  private persistToken(token: string | null | undefined): void {
    try {
      if (token) {
        localStorage.setItem(sessionKey(this.gameId, this.role), token);
      } else {
        localStorage.removeItem(sessionKey(this.gameId, this.role));
      }
    } catch {
      // Storage negato (modalità privata): la sessione resta solo in memoria.
    }
  }
}
