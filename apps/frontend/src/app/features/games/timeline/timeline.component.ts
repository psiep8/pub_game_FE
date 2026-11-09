import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV della Timeline. Al reveal mostra l'asse degli anni e spiega il punteggio:
 * conta la posizione esatta di ogni carta, non le coppie in ordine.
 */
@Component({
  selector: 'app-timeline',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="timeline-wrap">
      <header class="tl-head">
        <div class="tl-kicker">🕰️ TIMELINE</div>
        <h2 class="tl-title">Dal passato al presente</h2>
        @if (!displayData?.revealed) {
          <div class="tl-timer" [class.hot]="timer <= 10">{{ timer }}s</div>
        }
      </header>

      @if (!displayData?.revealed) {
        <p class="tl-hint">
          Ordinate le {{ displayData?.count }} carte sul telefono, trascinandole.
          <b>Più carte metti nel posto giusto, più punti prendi.</b>
        </p>

        <div class="tl-cards">
          @for (card of displayData?.items; track card.id) {
            <div class="tl-card">
              <span class="tl-pin">📌</span>
              <span class="tl-label">{{ card.label }}</span>
            </div>
          }
        </div>

        <div class="tl-legend">
          {{ displayData?.count }} carte = {{ totalPairs() }} posizioni
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

        <div class="tl-explain">
          <span>Posizioni esatte</span>
          <span>Ogni carta nel posto giusto vale un punto · massimo 1200, sotto soglia fino a −400</span>
        </div>

        <div class="tl-results">
          @for (r of displayData?.results; track r.playerName) {
            <div class="tl-result">
              <span class="tl-name">{{ r.playerName }}</span>
              <span class="tl-pairs">{{ r.correctPairs }}/{{ r.totalPairs }} posizioni</span>
              <span class="tl-bar"><i [style.width.%]="r.totalPairs ? (r.correctPairs / r.totalPairs) * 100 : 0"></i></span>
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
    .timeline-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(10px, 1.8vh, 22px); padding: clamp(14px, 2vw, 30px); color: var(--paper); }
    .tl-head { display: flex; flex-direction: column; align-items: center; gap: 3px; }
    .tl-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .tl-title { margin: 0; font-family: var(--font-display); font-size: clamp(1.5rem, 3.2vw, 2.9rem); font-weight: 400; line-height: .95; letter-spacing: .02em; text-transform: uppercase; text-align: center; }
    .tl-timer { font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.2rem); font-weight: 700; color: var(--acid); }
    .tl-timer.hot { color: var(--tomato); }
    .tl-hint { max-width: 900px; margin: 0; color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.72rem, 1.05vw, .94rem); text-align: center; }
    .tl-hint b { color: var(--acid); }
    .tl-cards { display: flex; flex-wrap: wrap; gap: clamp(8px, 1.2vw, 16px); justify-content: center; max-width: 1500px; }
    .tl-card { min-width: clamp(150px, 14vw, 230px); max-width: 280px; display: flex; align-items: flex-start; gap: 10px; padding: clamp(10px, 1.4vh, 16px); background: var(--paper); color: var(--coal); border: 3px solid var(--coal); border-radius: 0; box-shadow: 5px 5px 0 var(--tomato); font-size: clamp(.78rem, 1vw, 1rem); }
    .tl-card:nth-child(even) { background: var(--paper-hi); }
    .tl-pin { font-size: .9em; filter: grayscale(1); }
    .tl-label { font-weight: 600; line-height: 1.22; }
    .tl-legend { color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.58rem, .82vw, .72rem); letter-spacing: .08em; text-align: center; text-transform: uppercase; }
    .tl-axis { position: relative; display: flex; align-items: flex-start; gap: clamp(4px, .8vw, 14px); width: 100%; max-width: 1600px; overflow-x: auto; padding: 4px 0 10px; }
    .tl-axis::before { content: ''; position: absolute; left: 2%; right: 2%; top: 42px; height: 3px; background: rgba(244, 232, 206, .35); }
    .tl-axis-item { position: relative; z-index: 1; display: flex; flex: 1; flex-direction: column; align-items: center; gap: 6px; min-width: clamp(120px, 11vw, 190px); }
    .tl-year { color: var(--acid); font-family: var(--font-mono); font-size: clamp(.95rem, 1.6vw, 1.5rem); font-weight: 700; letter-spacing: -.04em; }
    .tl-dot { width: 14px; height: 14px; margin: 4px 0; background: var(--tomato); border: 3px solid var(--paper); border-radius: 50%; box-shadow: none; }
    .tl-label-small { color: var(--paper); font-size: clamp(.62rem, .88vw, .8rem); line-height: 1.22; text-align: center; }
    .tl-explain { display: flex; flex-direction: column; align-items: center; gap: 2px; color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.56rem, .8vw, .72rem); text-align: center; }
    .tl-explain span:first-child { color: var(--acid); font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    .tl-results { width: min(1000px, 92vw); display: flex; flex-direction: column; gap: 7px; }
    .tl-result { display: grid; grid-template-columns: minmax(90px, 1fr) auto minmax(80px, 220px) auto; gap: clamp(8px, 1.2vw, 18px); align-items: center; padding: clamp(6px, 1vh, 10px) clamp(10px, 1.4vw, 18px); background: var(--paper-hi); color: var(--coal); border: 2px solid var(--coal); border-radius: 0; box-shadow: 4px 4px 0 var(--tomato); font-size: clamp(.72rem, .98vw, .92rem); }
    .tl-name { font-weight: 800; }
    .tl-pairs { color: rgba(21, 21, 15, .6); font-family: var(--font-mono); font-size: .9em; white-space: nowrap; }
    .tl-bar { height: 7px; overflow: hidden; background: rgba(21, 21, 15, .16); border: 1px solid var(--coal); }
    .tl-bar i { display: block; height: 100%; background: var(--tomato); }
    .tl-score { color: var(--coal); font-family: var(--font-mono); font-weight: 700; }
    .tl-empty { color: var(--ink-dim); font-family: var(--font-mono); text-align: center; }
    @media (max-width: 700px) { .tl-result { grid-template-columns: 1fr auto; } .tl-bar, .tl-pairs { display: none; } }
  `]
})
export class Timeline {
  @Input() displayData: any;
  @Input() timer = 0;

  totalPairs(): number {
    return Number(this.displayData?.count) || 0;
  }
}
