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
  /** Il server ha chiuso la sessione (reset o espulsione): si torna al setup. */
  readonly sessionRevoked$ = new Subject<void>();

  private gameId = 1;
  private role: DeviceRole = 'REMOTE';
  private playerName = '';
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private started = false;
  private listening = false;
  private seenEvents = new Set<string>();
  private syncGeneration = 0;
  private freshSyncPending = false;
  /**
   * Codice di abbinamento già inserito in questa scheda. Vale una volta sola
   * lato server: serve solo a non richiederlo a ogni riavvio della sessione.
   */
  private pairingCode: string | null = null;
  /** False per la regia: il codice si chiede nel pannello, non con window.prompt. */
  private promptForCode = true;
  /** Segreto di regia inserito in questa scheda: apre TV e admin come regia. */
  private controlSecret: string | null = null;
  /** La sessione corrente può leggere le soluzioni e generare il codice TV. */
  readonly regia = signal(false);
  /** Round il cui checkpoint il server ha già scartato: non si ritenta. */
  private rejectedTvCheckpointRound: number | null = null;

  /** Avvia sessione e heartbeat per questo dispositivo (idempotente). */
  async start(
    gameId: number,
    role: DeviceRole,
    playerName = '',
    promptForCode = true,
  ): Promise<boolean> {
    if (role === 'REMOTE' && !playerName.trim()) return false;
    if (this.started && gameId === this.gameId && role === this.role && playerName.trim() === this.playerName
      && this.sessionToken()) {
      this.ws.connect();
      return true;
    }
    if (gameId !== this.gameId || role !== this.role || playerName.trim() !== this.playerName) {
      this.syncGeneration++;
      this.freshSyncPending = false;
      this.seq.set(0);
      this.stateVersion.set(0);
      this.lastSyncAt.set(null);
      this.seenEvents.clear();
    }
    if (gameId !== this.gameId || role !== this.role) this.sessionToken.set(null);
    this.role = role;
    this.playerName = playerName.trim();
    this.gameId = gameId;
    this.promptForCode = promptForCode;
    this.started = true;
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
      void this.sync(true);
      this.startHeartbeat();
    } else {
      this.started = false;
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    return registered;
  }

  /**
   * Segreto di regia per questa scheda. La TV aperta senza segreto resta uno
   * schermo di lobby: niente codice di abbinamento e niente soluzioni.
   */
  setControlSecret(secret: string | null): void {
    const value = (secret ?? '').trim();
    this.controlSecret = value || null;
  }

  /**
   * Abbinamento della regia con il codice scritto nel pannello: niente
   * window.prompt, il riquadro "Regia non abbinata" sta nell'admin.
   */
  async pairAdmin(gameId: number, code: string): Promise<boolean> {
    const value = code.trim();
    if (!value) return false;
    this.role = 'ADMIN';
    this.gameId = gameId;
    this.sessionToken.set(null);
    this.persistToken(null);
    this.started = false;
    this.pairingCode = value;
    return this.start(gameId, 'ADMIN', '', false);
  }

  stop(): void {
    this.syncGeneration++;
    this.freshSyncPending = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    this.started = false;
  }

  /**
   * Espulsione: il token viene buttato e il dispositivo smette di fare
   * heartbeat, altrimenti al primo giro si riregistrerebbe da solo.
   */
  forgetSession(): void {
    this.stop();
    this.persistToken(null);
    this.sessionToken.set(null);
    this.playerName = '';
    this.seenEvents.clear();
    this.ws.disconnect();
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
   * Codice breve per l'abbinamento della regia (solo dalla TV). La TV ha una
   * sessione propria: il codice arriva dal server senza chiedere il segreto,
   * altrimenti con il database appena azzerato nessuno poteva generarlo.
   */
  async requestPairingCode(): Promise<{ code: string; ttlSeconds: number; expiresAt?: number } | null> {
    const token = this.sessionToken();
    if (!token) return null;
    try {
      const response = await firstValueFrom(
        this.http.post<{ code: string; ttlSeconds: number; expiresAt?: number }>(
          `${this.baseUrl}/games/${this.gameId}/pairing-code`, {},
          { headers: { 'X-Session-Token': token } }
        )
      );
      return response;
    } catch (error) {
      if ((error as HttpErrorResponse)?.status === 401) this.lastError.set('TV non abbinata: ricarica la TV');
      else this.lastError.set('Impossibile creare il codice di abbinamento');
      return null;
    }
  }

  /** Codice attivo senza rigenerarlo: la TV capisce quando è scaduto o usato. */
  async pairingCodeStatus(): Promise<{ code: string | null; expiresAt: number; ttlSeconds: number } | null> {
    const token = this.sessionToken();
    if (!token) return null;
    try {
      return await firstValueFrom(
        this.http.get<{ code: string | null; expiresAt: number; ttlSeconds: number }>(
          `${this.baseUrl}/games/${this.gameId}/pairing-code`,
          { headers: { 'X-Session-Token': token } }
        )
      );
    } catch {
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

  /**
   * Bonus dell'atto: la TV segna quando parte e quando si chiude, così un
   * refresh non lo salta e non lo riapre una volta pagato.
   */
  saveBonusAct(bonus: { act: number; type: string; status: 'STARTED' | 'CLOSED' }): void {
    const token = this.sessionToken();
    if (!token || this.role !== 'TV' || this.gameId == null) return;
    this.http.post(`${this.baseUrl}/games/${this.gameId}/bonus-state`, bonus, {
      headers: { 'X-Session-Token': token },
    }).subscribe({ error: () => undefined });
  }

  /**
   * Checkpoint TV del round aperto: lo stato che serve a ripararlo dopo un
   * refresh. Un solo endpoint per tutte le modalità; il server lo lega al round
   * corrente e scarta revisioni vecchie. Un errore di rete non ferma il gioco.
   */
  saveTvCheckpoint(
    checkpoint: { mode: string; roundIndex: number; revision: number; state: unknown },
  ): void {
    const token = this.sessionToken();
    if (!token || this.role !== 'TV' || this.gameId == null) return;
    // Il server risponde 409 quando il round è già chiuso, è un altro o la
    // modalità non coincide: insistere con lo stesso round produce solo una
    // raffica di errori in console (20 in una serata di prova).
    if (this.rejectedTvCheckpointRound === checkpoint.roundIndex) return;
    this.http.post(`${this.baseUrl}/games/${this.gameId}/tv-state`, checkpoint, {
      headers: { 'X-Session-Token': token },
    }).subscribe({
      next: () => {
        this.rejectedTvCheckpointRound = null;
      },
      error: (error: unknown) => {
        if ((error as HttpErrorResponse)?.status === 409) {
          this.rejectedTvCheckpointRound = checkpoint.roundIndex;
        }
      },
    });
  }

  /** Riapre la sessione con il token salvato (o ne crea una nuova). */
  async ensureSession(): Promise<boolean> {
    try {
      const token = this.sessionToken() ?? this.storedToken();
      // La TV è uno schermo, non un comando: il server la registra senza
      // segreto (vedi ReliabilityController.openSession). Chiedere il codice
      // anche a lei lasciava la lobby su "TV NON IN LINEA" a ogni partita
      // nuova, quando il browser non aveva ancora un token salvato.
      const needsAuth = !token && this.role === 'ADMIN';
      // Codice breve dalla TV (4-6 cifre); il segreto completo resta come ripiego.
      // Il codice già inserito nel pannello vale anche quando il prompt è spento.
      let pairingCode = needsAuth ? this.pairingCode : null;
      if (!pairingCode && needsAuth && this.promptForCode) {
        pairingCode = window.prompt('Inserisci il codice della TV, oppure il segreto di regia');
        this.pairingCode = pairingCode;
      }
      if (needsAuth && !pairingCode) return false;
      // Un codice a 4-6 cifre si redime; qualsiasi altra cosa è il segreto di
      // regia e viaggia solo nell'header. Mandato come codice verrebbe rifiutato
      // e consumerebbe uno dei cinque tentativi prima del blocco di un minuto.
      const typed = pairingCode ? pairingCode.trim() : '';
      const isPairingCode = /^\d{4,6}$/.test(typed);
      if (typed && !isPairingCode) this.controlSecret = typed;
      const authHeaders = this.controlSecret && !isPairingCode && this.role !== 'REMOTE'
        ? { headers: { 'X-Control-Secret': this.controlSecret } }
        : {};
      const response = await firstValueFrom(
        this.http.post<any>(`${this.baseUrl}/games/${this.gameId}/session`, {
          deviceId: this.deviceId(),
          role: this.role,
          playerName: this.playerName || null,
          sessionToken: token,
          pairingCode: isPairingCode ? typed : null,
        }, authHeaders)
      );
      this.applyTiming(response);
      this.pairingCode = null;
      this.sessionToken.set(response?.sessionToken ?? null);
      this.persistToken(response?.sessionToken);
      this.resumedSession.set(!!response?.resumed);
      this.duplicateDisplay.set(!!response?.duplicateDisplay);
      this.regia.set(!!response?.regia);
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
        if (this.role === 'REMOTE') {
          this.revokeSession();
          this.lastError.set('La partita è stata resettata: rientra con il tuo nome.');
          return false;
        }
        return this.ensureSession();
      }
      if (status === 401 && this.role === 'TV' && this.controlSecret) {
        // Segreto rifiutato (ruotato o sbagliato): la TV resta una lobby invece
        // di morire sul 401. Al prossimo avvio si riprova col segreto salvato.
        this.controlSecret = null;
        return this.ensureSession();
      }
      if (status === 401) {
        // Il codice non è valido o è scaduto: il prossimo tentativo lo richiede.
        this.pairingCode = null;
      }
      this.online.set(false);
      // La regia che ha appena battuto un codice deve sapere che il problema è
      // il codice, non il backend: "Sessione non disponibile" sembrava un guasto.
      const rejectedCode = (status === 401 || status === 410 || status === 429) && !this.sessionToken();
      this.lastError.set(status === 409
        ? 'Nome già in uso, scegline un altro'
        : status === 410 ? 'Codice scaduto: guarda la TV, ce n’è uno nuovo'
        : status === 429 ? 'Troppi tentativi: attendi un minuto e riprova'
        : rejectedCode ? 'Codice non valido: guarda la TV, ce n’è uno nuovo'
        : 'Sessione non disponibile');
      return false;
    }
  }

  /** Stato autorevole + eventi mancanti dalla sequenza nota. */
  async sync(fresh = false): Promise<void> {
    if (fresh) {
      this.syncGeneration++;
      this.lastSyncAt.set(null);
      if (this.syncing()) this.freshSyncPending = true;
    }
    if (this.syncing()) return;
    this.syncing.set(true);
    const generation = this.syncGeneration;
    const gameId = this.gameId;
    const token = this.sessionToken();
    try {
      let snapshot: any = {};
      let complete = false;
      while (!complete) {
        const previousSeq = this.seq();
        const query = `?sinceSeq=${previousSeq}`;
        const response = await firstValueFrom(
          this.http.get<any>(`${this.baseUrl}/games/${gameId}/sync${query}`, {
            headers: token ? { 'X-Session-Token': token } : {},
          })
        );
        if (generation !== this.syncGeneration || gameId !== this.gameId || token !== this.sessionToken()) return;
        this.applyTiming(response);
        snapshot = response?.snapshot;
        if (!snapshot || typeof snapshot.hasState !== 'boolean'
            || Number(snapshot.gameId) !== gameId || !Number.isFinite(Number(snapshot.version))
            || typeof snapshot.status !== 'string') {
          throw new Error('Snapshot non valido');
        }
        if (Number(snapshot.version) < this.stateVersion()) {
          throw new Error('Snapshot precedente alla versione già osservata');
        }
        const missed = Array.isArray(response?.events) ? response.events : [];
        for (const event of missed) this.applyEvent(event);
        const nextSeq = Number(response?.toSeq ?? previousSeq);
        complete = response?.complete !== false;
        if (!Number.isFinite(nextSeq) || (!complete && nextSeq <= previousSeq && !response?.stale)) {
          throw new Error('Sincronizzazione senza avanzamento');
        }
        this.seq.set(nextSeq);
      }
      this.stateVersion.set(Number(snapshot.version));
      this.online.set(true);
      this.lastSyncAt.set(Date.now());
      this.lastError.set(null);
      this.syncState$.next(snapshot);
    } catch (error) {
      if (generation !== this.syncGeneration || gameId !== this.gameId || token !== this.sessionToken()) return;
      console.error('❌ Sincronizzazione non riuscita', error);
      this.online.set(false);
      // Anche dopo uno snapshot precedente occorre ritentare al prossimo
      // heartbeat: quello vecchio non vale per il rientro appena fallito.
      this.lastSyncAt.set(null);
    } finally {
      this.syncing.set(false);
      if (this.freshSyncPending) {
        this.freshSyncPending = false;
        void this.sync();
      }
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
      if (Number(response?.stateVersion ?? 0) > this.stateVersion()) {
        this.stateVersion.set(Number(response.stateVersion));
      }
      // Se il primo snapshot non è mai arrivato (sync fallita all'avvio) si
      // riprova a ogni heartbeat, non solo quando il server segnala eventi.
      if (response?.needsSync || this.lastSyncAt() === null) {
        await this.sync();
      } else if (this.lastSyncAt() !== null && !this.syncing()) {
        // Senza un sync riuscito il seq non si allinea: altrimenti un telefono
        // appena ricaricato salterebbe gli eventi persi senza mai applicare lo
        // snapshot e resterebbe bloccato sulla schermata di attesa.
        this.seq.set(Number(response?.seq ?? this.seq()));
      }
    } catch (error) {
      const status = (error as HttpErrorResponse)?.status;
      if (status === 410 || status === 401) {
        if (this.role === 'REMOTE') {
          // Il reset revoca le squadre: non si rientra da soli con lo stesso
          // nome, altrimenti il telefono ricreerebbe la squadra appena tolta.
          this.revokeSession();
          this.lastError.set('La partita è stata resettata: rientra con il tuo nome.');
          return;
        }
        // Il server non conosce più questa sessione: si riparte dal token nuovo.
        this.persistToken(null);
        this.sessionToken.set(null);
        if (await this.ensureSession()) {
          this.ws.setSessionToken(this.sessionToken()!, this.role);
          await this.sync();
        }
        return;
      }
      this.online.set(false);
    }
  }

  /**
   * Seme delle entrate a sorpresa: lo decide il server, stabile per partita.
   * Se non risponde, la TV ripiega sull'id della partita.
   */
  async bonusEntranceSeed(gameId = this.gameId): Promise<number> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ seed: number }>(`${this.baseUrl}/games/${gameId}/bonus-entrance`)
      );
      return Number(response?.seed) || 0;
    } catch {
      return 0;
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

  /** Sessione REMOTE revocata dal server: il componente torna al setup. */
  private revokeSession(): void {
    this.stop();
    this.persistToken(null);
    this.sessionToken.set(null);
    this.playerName = '';
    this.seenEvents.clear();
    this.ws.disconnect();
    this.sessionRevoked$.next();
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

  /** Token corrente o quello salvato dopo un refresh: serve alle chiamate REST
   *  che non passano dal canale di gioco (es. banca Karaoke). */
  token(): string | null {
    return this.sessionToken() ?? this.storedToken();
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
