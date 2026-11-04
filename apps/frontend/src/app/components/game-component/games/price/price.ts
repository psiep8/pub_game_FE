import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-price',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="price-wrap">
      <h2 class="pr-title">💶 QUANTO COSTA?</h2>

      <div class="pr-product">
        <div class="pr-emoji">{{ displayData?.emoji }}</div>
        <div class="pr-name">{{ displayData?.name }}</div>
        <div class="pr-category">{{ displayData?.category }}</div>
      </div>

      @if (!displayData?.reveal) {
        <div class="pr-ask">Scrivete la vostra stima sul telefono <span class="pr-timer">{{ timer }}s</span></div>
      } @else {
        <div class="pr-reveal">
          <div class="pr-label">PREZZO REALE</div>
          <div class="pr-price">{{ displayData?.reveal?.price | number:'1.2-2' }} €</div>
          @if (displayData?.reveal?.source) {
            <div class="pr-source">fonte: {{ displayData?.reveal?.source }}</div>
          }
        </div>
      }

      <div class="pr-guesses">
        @for (g of displayData?.guesses; track g.playerName) {
          <span class="pr-chip">{{ g.playerName }}: {{ g.estimate | number:'1.0-2' }} €</span>
        } @empty {
          <span class="pr-chip muted">Nessuna stima ancora</span>
        }
      </div>

      @if (displayData?.reveal?.results?.length) {
        <div class="pr-results">
          @for (r of displayData?.reveal?.results; track r.playerName) {
            <div class="pr-result" [class.closest]="r.closest">
              <span class="pr-player">{{ r.playerName }}</span>
              <span class="pr-est">{{ r.estimate | number:'1.0-2' }} €</span>
              <span class="pr-score">+{{ r.score }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .price-wrap { height: 100%; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 24px; color: #f8fafc; }
    .pr-title { font-size: 2.6rem; margin: 0; letter-spacing: 4px; }
    .pr-product { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .pr-emoji { font-size: 6rem; line-height: 1; }
    .pr-name { font-size: 2.2rem; font-weight: 800; text-align: center; }
    .pr-category { text-transform: uppercase; letter-spacing: 3px; font-size: .8rem; opacity: .6; }
    .pr-ask { font-size: 1.3rem; opacity: .85; }
    .pr-timer { color: #ffd166; font-weight: 900; margin-left: 10px; }
    .pr-reveal { text-align: center; }
    .pr-label { letter-spacing: 4px; font-size: .8rem; opacity: .7; }
    .pr-price { font-size: 4rem; font-weight: 900; color: #86efac; }
    .pr-source { font-size: .75rem; opacity: .5; }
    .pr-guesses { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 900px; }
    .pr-chip { background: rgba(255,255,255,.1); border-radius: 999px; padding: 6px 14px; font-size: .95rem; }
    .pr-chip.muted { opacity: .5; }
    .pr-results { width: min(700px, 94%); display: flex; flex-direction: column; gap: 6px; }
    .pr-result { display: flex; justify-content: space-between; padding: 8px 16px; border-radius: 10px; background: rgba(255,255,255,.06); }
    .pr-result.closest { background: rgba(134,239,172,.18); border: 1px solid rgba(134,239,172,.5); }
    .pr-score { font-weight: 900; color: #86efac; }
  `]
})
export class Price {
  @Input() displayData: any;
  @Input() timer = 0;
}
