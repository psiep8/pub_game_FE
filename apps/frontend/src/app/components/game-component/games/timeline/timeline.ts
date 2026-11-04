import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-timeline',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="timeline-wrap">
      <h2 class="tl-title">🕰️ TIMELINE</h2>

      @if (!displayData?.revealed) {
        <p class="tl-hint">
          Ordinate le carte dalla più antica alla più recente
          <span class="tl-timer">{{ timer }}s</span>
        </p>
        <div class="tl-cards">
          @for (card of displayData?.items; track card.id) {
            <div class="tl-card">
              <span class="tl-pin">📌</span>
              <span class="tl-label">{{ card.label }}</span>
            </div>
          }
        </div>
      } @else {
        <p class="tl-hint">La soluzione, dal passato al presente</p>
        <div class="tl-axis">
          @for (item of displayData?.ordered; track item.label) {
            <div class="tl-axis-item">
              <div class="tl-year">{{ item.year }}</div>
              <div class="tl-dot"></div>
              <div class="tl-label-small">{{ item.label }}</div>
            </div>
          }
        </div>

        <div class="tl-results">
          @for (r of displayData?.results; track r.playerName) {
            <div class="tl-result">
              <span class="tl-name">{{ r.playerName }}</span>
              <span class="tl-pairs">{{ r.correctPairs }}/{{ r.totalPairs }} coppie</span>
              <span class="tl-score">+{{ r.score }}</span>
            </div>
          } @empty {
            <div class="tl-empty">Nessuna squadra ha risposto in tempo</div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .timeline-wrap { height: 100%; display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 24px; color: #f5f3ff; }
    .tl-title { font-size: 3rem; margin: 0; letter-spacing: 6px; }
    .tl-hint { font-size: 1.3rem; opacity: .8; margin: 0; }
    .tl-timer { margin-left: 12px; font-weight: 800; color: #ffd166; }
    .tl-cards { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
    .tl-card { min-width: 180px; max-width: 260px; background: rgba(255,255,255,.08); border: 2px solid rgba(167,139,250,.5); border-radius: 16px; padding: 16px; display: flex; gap: 10px; align-items: flex-start; }
    .tl-label { font-size: 1.05rem; line-height: 1.3; }
    .tl-axis { display: flex; align-items: flex-start; gap: 10px; overflow-x: auto; width: 100%; padding: 8px 0; }
    .tl-axis-item { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 150px; }
    .tl-year { font-size: 1.5rem; font-weight: 900; color: #ffd166; }
    .tl-dot { width: 12px; height: 12px; border-radius: 50%; background: #a78bfa; }
    .tl-label-small { font-size: .9rem; text-align: center; opacity: .9; }
    .tl-results { width: min(720px, 92%); display: flex; flex-direction: column; gap: 8px; }
    .tl-result { display: flex; justify-content: space-between; background: rgba(255,255,255,.07); padding: 10px 16px; border-radius: 12px; }
    .tl-pairs { opacity: .7; }
    .tl-score { font-weight: 900; color: #86efac; }
    .tl-empty { text-align: center; opacity: .6; }
  `]
})
export class Timeline {
  @Input() displayData: any;
  @Input() timer = 0;
}
