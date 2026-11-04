import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ping-pong',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="pp-wrap">
      <div class="pp-head">
        <h2 class="pp-title">🏓 PING PONG</h2>
        <span class="pp-timer">{{ timer }}s</span>
      </div>

      <div class="pp-courts">
        @for (court of displayData?.courts; track court.a.playerName) {
          <div class="pp-court" [class.decided]="court.winner">
            <div class="pp-side" [class.winner]="court.winner === court.a.playerName">
              <span class="pp-name">{{ court.a.playerName }}</span>
              <span class="pp-score">{{ court.a.score }}</span>
            </div>
            <div class="pp-vs">VS</div>
            <div class="pp-side" [class.winner]="court.winner === court.b.playerName">
              <span class="pp-name">{{ court.b.playerName }}</span>
              <span class="pp-score">{{ court.b.score }}</span>
            </div>
            @if (court.winner) {
              <div class="pp-winner">🏆 {{ court.winner }}</div>
            }
          </div>
        } @empty {
          <div class="pp-empty">In attesa delle squadre...</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .pp-wrap { height: 100%; display: flex; flex-direction: column; gap: 16px; padding: 20px; color: #ecfeff; }
    .pp-head { display: flex; align-items: baseline; justify-content: center; gap: 24px; }
    .pp-title { font-size: 2.6rem; margin: 0; letter-spacing: 4px; }
    .pp-timer { font-size: 1.5rem; font-weight: 900; color: #67e8f9; }
    .pp-courts { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
    .pp-court { position: relative; background: rgba(255,255,255,.06); border: 2px solid rgba(34,211,238,.35); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 6px; }
    .pp-court.decided { border-color: rgba(134,239,172,.7); }
    .pp-side { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-radius: 10px; background: rgba(255,255,255,.05); }
    .pp-side.winner { background: rgba(134,239,172,.2); }
    .pp-name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pp-score { font-size: 1.9rem; font-weight: 900; font-variant-numeric: tabular-nums; }
    .pp-vs { align-self: center; font-size: .75rem; letter-spacing: 3px; opacity: .5; }
    .pp-winner { text-align: center; font-size: .9rem; color: #86efac; }
    .pp-empty { text-align: center; opacity: .6; grid-column: 1 / -1; }
  `]
})
export class PingPong {
  @Input() displayData: any;
  @Input() timer = 0;
}
