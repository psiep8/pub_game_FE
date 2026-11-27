import { ChangeDetectionStrategy, Component, computed, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReliabilityService } from '../../../core/services/reliability.service';
import { WebSocketService } from '../../../core/websocket/web-socket.service';

/**
 * Indicatore di connessione: dice subito se il dispositivo è online, se sta
 * riprovando o se ha perso la rete. È volutamente discreto: informa senza
 * coprire il gioco.
 */
@Component({
  selector: 'app-connection-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="conn-badge"
      [class.online]="reliability.online() && !reliability.syncing()"
      [class.reconnecting]="!reliability.online() && ws.connectionState() !== 'offline'"
      [class.offline]="!reliability.online() && ws.connectionState() === 'offline'"
      [attr.title]="detail()"
    >
      <span class="dot"></span>
      <span class="label">{{ label() }}</span>
      @if (reliability.syncing()) {
        <span class="extra">SYNC</span>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .conn-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        /*
         * Misura fissa: passando da TV a Sincronizzo (o mostrando il chip SYNC)
         * la badge non deve allargarsi, altrimenti l'angolo in alto a destra si
         * sposta a ogni cambio di stato.
         */
        width: 168px;
        box-sizing: border-box;
        white-space: nowrap;
        padding: 4px 8px;
        border-radius: 0;
        font-family: var(--font-mono, monospace);
        font-size: clamp(0.6rem, 0.8vw, 0.75rem);
        font-weight: 700;
        letter-spacing: 0.1em;
        line-height: 1;
        text-transform: uppercase;
        border: 2px solid var(--coal);
        background: var(--paper-hi);
        color: var(--coal);
        box-shadow: 3px 3px 0 var(--coal);
        pointer-events: none;
      }
      .dot {
        width: 8px;
        height: 8px;
        flex: 0 0 8px;
        border-radius: 50%;
        background: currentColor;
        border: 1px solid var(--coal);
      }
      .online {
        background: var(--mint);
        color: var(--coal);
      }
      .reconnecting {
        background: var(--mustard);
        color: var(--coal);
      }
      .offline {
        background: var(--tomato);
        color: var(--on-tomato, var(--coal));
      }
      .extra {
        padding: 1px 3px;
        background: var(--acid);
        color: var(--coal);
      }
    `,
  ],
})
export class ConnectionBadge {
  readonly reliability = inject(ReliabilityService);
  readonly ws = inject(WebSocketService);

  @Input() role = 'REMOTE';

  readonly label = computed(() => {
    if (this.reliability.syncing()) return 'Sincronizzo';
    if (this.reliability.online()) return this.role;
    return this.ws.connectionState() === 'offline' ? 'Offline' : 'Riconnessione';
  });

  readonly detail = computed(() => {
    const parts = [
      `Stato: ${this.reliability.online() ? 'online' : this.ws.connectionState()}`,
      `Versione stato: ${this.reliability.stateVersion()}`,
      `Eventi ricevuti: ${this.reliability.seq()}`,
      `Riconnessioni: ${this.reliability.reconnectCount()}`,
    ];
    if (this.reliability.lastError()) {
      parts.push(`Ultimo errore: ${this.reliability.lastError()}`);
    }
    if (this.reliability.duplicateDisplay()) {
      parts.push('Un altro schermo TV è collegato a questa partita.');
    }
    return parts.join(' · ');
  });
}
