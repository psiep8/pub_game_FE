import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV del BONUS BASKET: tre manche con canestro sempre più piccolo.
 * Il gioco vero gira sul telefono (/basket); qui restano countdown e classifica.
 */
@Component({
  selector: 'app-basket-bonus-stage',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="bbs-overlay">
      <div class="bbs-card">
        <div class="bbs-kicker">🏀 BASKET · BONUS DI FINE ATTO</div>
        <h1>TRE MANCHE AL CANESTRO</h1>
        <p class="bbs-sub">Apri il canestro dal telefono. Ogni manche ha un ferro più piccolo.</p>

        <div class="bbs-manches">
          <div class="bbs-manche">
            <span class="bbs-hoop big"></span>
            <b>MANCHE 1</b>
            <span>CANESTRO GRANDE</span>
            <em>2 punti · swish 3</em>
          </div>
          <div class="bbs-manche">
            <span class="bbs-hoop medium"></span>
            <b>MANCHE 2</b>
            <span>CANESTRO MEDIO</span>
            <em>3 punti · swish 4</em>
          </div>
          <div class="bbs-manche">
            <span class="bbs-hoop small"></span>
            <b>MANCHE 3</b>
            <span>CANESTRO PICCOLO</span>
            <em>5 punti · swish 6</em>
          </div>
        </div>

        <div class="bbs-timer">{{ secondsLeft }}s</div>

        @if (scores.length) {
          <div class="bbs-scores">
            @for (row of scores; track row.playerName; let i = $index) {
              <div class="bbs-row" [class.top]="i === 0">
                <span>{{ row.playerName }}</span>
                <b>{{ row.score }}</b>
              </div>
            }
          </div>
        } @else {
          <p class="bbs-hint">In attesa dei primi canestri…</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .bbs-overlay {
      position: fixed;
      inset: 0;
      z-index: 70;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: radial-gradient(circle at 50% 10%, #1f2937 0%, #0b1020 60%, #05070f 100%);
      color: #f8fafc;
    }
    .bbs-card {
      width: min(1200px, 96vw);
      padding: clamp(18px, 2.6vw, 36px);
      border: 3px solid #334155;
      border-radius: 24px;
      background: linear-gradient(165deg, #111827, #0b1020);
      text-align: center;
      box-shadow: 0 30px 90px rgba(0, 0, 0, .55);
    }
    .bbs-kicker { color: #f97316; font-family: var(--font-mono, monospace); font-size: clamp(.6rem, .9vw, .78rem); font-weight: 700; letter-spacing: .2em; }
    .bbs-card h1 { margin: 8px 0 6px; font-family: var(--font-display, inherit); font-size: clamp(1.5rem, 3.4vw, 2.8rem); text-transform: uppercase; }
    .bbs-sub { margin: 0 0 20px; color: #94a3b8; font-size: clamp(.8rem, 1.1vw, 1rem); }
    .bbs-manches { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .bbs-manche {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 18px 10px;
      border: 2px solid #334155;
      border-radius: 16px;
      background: #0f172a;
    }
    .bbs-manche b { color: #f97316; font-family: var(--font-mono, monospace); font-size: .78rem; letter-spacing: .14em; }
    .bbs-manche span:not(.bbs-hoop) { font-weight: 800; letter-spacing: .04em; }
    .bbs-manche em { color: #94a3b8; font-size: .8rem; font-style: normal; }
    .bbs-hoop {
      display: block;
      border: 4px solid #f97316;
      border-radius: 999px;
      background: rgba(249, 115, 22, .12);
      margin-bottom: 4px;
    }
    .bbs-hoop.big { width: 96px; height: 26px; }
    .bbs-hoop.medium { width: 72px; height: 22px; }
    .bbs-hoop.small { width: 50px; height: 18px; }
    .bbs-timer {
      display: inline-block;
      margin: 22px auto 10px;
      padding: 10px 28px;
      border: 2px solid #a3e635;
      border-radius: 14px;
      background: rgba(163, 230, 53, .1);
      color: #a3e635;
      font-family: var(--font-mono, monospace);
      font-size: clamp(1.8rem, 4vw, 3rem);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .bbs-hint { color: #94a3b8; }
    .bbs-scores { display: flex; flex-direction: column; gap: 6px; max-width: 760px; margin: 8px auto 0; }
    .bbs-row { display: flex; justify-content: space-between; gap: 16px; padding: 8px 16px; border: 1px solid #334155; border-radius: 10px; background: #0f172a; font-size: clamp(.85rem, 1.2vw, 1.05rem); }
    .bbs-row.top { border-color: #a3e635; background: rgba(163, 230, 53, .1); }
    .bbs-row b { color: #f97316; font-family: var(--font-mono, monospace); }
  `],
})
export class BasketBonusStage {
  @Input() secondsLeft = 0;
  @Input() scores: Array<{ playerName: string; score: number }> = [];
}
