import { Injectable, signal } from '@angular/core';
import { WebSocketService } from '../websocket/web-socket.service';

const STORAGE_KEY = 'pubgame.avatars';
/** Un avatar compresso sta sotto i 30 KB: oltre questa soglia è un errore. */
const MAX_AVATAR_LENGTH = 240_000;

/**
 * Avatar di squadra.
 *
 * Il telefono comprime la foto e la manda in broadcast con `PLAYER_AVATAR`;
 * la TV ascolta lo stesso canale e la mostra nelle classifiche. La copia
 * locale serve a ritrovare l'avatar dopo un refresh o una riconnessione.
 *
 * Il collegamento al WebSocket è esplicito (`connect`): le classifiche possono
 * leggere gli avatar senza aprire una connessione propria.
 */
@Injectable({ providedIn: 'root' })
export class PlayerAvatarService {
  private readonly avatars = signal<Record<string, string>>(this.load());
  private ws?: WebSocketService;
  private connected = false;

  connect(ws: WebSocketService): void {
    this.ws = ws;
    if (this.connected) return;
    this.connected = true;

    ws.status$.subscribe((status: any) => {
      if (status?.action !== 'PLAYER_AVATAR') return;

      const playerName = String(status.playerName ?? '').trim();
      const avatar = String(status.avatar ?? '');
      if (!this.isValid(playerName, avatar)) return;

      this.setAvatar(playerName, avatar);
    });
  }

  avatarFor(playerName: string): string | null {
    return this.avatars()[playerName] ?? null;
  }

  setAvatar(playerName: string, avatar: string): void {
    if (!this.isValid(playerName, avatar)) return;
    this.avatars.update((current) => ({ ...current, [playerName]: avatar }));
    this.persist();
  }

  /** Rimanda l'avatar alla TV: serve dopo una riconnessione o un refresh. */
  publish(playerName: string, gameId = 1): void {
    const name = playerName.trim();
    const avatar = this.avatarFor(name);
    if (!name || !avatar) return;

    this.ws?.broadcastStatus(gameId, {
      action: 'PLAYER_AVATAR',
      playerName: name,
      avatar,
    });
  }

  private isValid(playerName: string, avatar: string): boolean {
    return Boolean(
      playerName
      && avatar.startsWith('data:image/')
      && avatar.length > 100
      && avatar.length <= MAX_AVATAR_LENGTH,
    );
  }

  private load(): Record<string, string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.avatars()));
    } catch {
      // localStorage può essere pieno o bloccato: l'avatar resta in memoria.
    }
  }
}
