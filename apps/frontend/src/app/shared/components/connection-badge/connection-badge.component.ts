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
        gap: 6px;
        padding: 3px 9px;
        border-radius: 999px;
        font-family: var(--font-mono, monospace);
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        border: 2px solid rgba(255, 255, 255, 0.28);
        background: rgba(15, 23, 42, 0.72);
        color: #e2e8f0;
        pointer-events: none;
      }
      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
      }
      .online {
        color: #86efac;
        border-color: rgba(134, 239, 172, 0.5);
      }
      .reconnecting {
        color: #fbbf24;
        border-color: rgba(251, 191, 36, 0.55);
      }
      .offline {
        color: #f87171;
        border-color: rgba(248, 113, 113, 0.55);
      }
      .reconnecting .dot {
        animation: connPulse 1s infinite;
      }
      .extra {
        opacity: 0.8;
      }
      @keyframes connPulse {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.35;
          transform: scale(0.7);
        }
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
