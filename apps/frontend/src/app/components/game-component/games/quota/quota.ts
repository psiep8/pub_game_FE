import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV del round QUOTA: quattro domande numeriche, fasce con quota e gettoni.
 * Il mode manda lo stato già deciso: qui si disegna soltanto.
 */
@Component({
  selector: 'app-quota',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="qt-wrap">
      <header class="qt-head">
        <div class="qt-kicker">📊 QUOTA</div>
        <h2 class="qt-title">
          @if (displayData?.phase === 'BET') { DISTRIBUISCI 100 GETTONI }
          @else if (displayData?.phase === 'REVEAL') { IL VALORE È }
          @else { CLASSIFICA DEL ROUND }
        </h2>
        <div class="qt-progress">DOMANDA {{ displayData?.index ?? 1 }} / {{ displayData?.total ?? 4 }}</div>
        <div class="qt-timer" [class.hot]="(displayData?.secondsLeft ?? 0) <= 4">{{ displayData?.secondsLeft ?? 0 }}s</div>
      </header>

      @if (displayData?.phase !== 'FINALE') {
        <div class="qt-question">{{ displayData?.question }}</div>
        @if (displayData?.category) {
          <div class="qt-category">{{ displayData.category }} · {{ displayData.unit }}</div>
        }

        <div class="qt-bands">
          @for (band of displayData?.bands ?? []; track $index; let i = $index) {
            <div class="qt-band" [class.correct]="displayData?.phase === 'REVEAL' && i === displayData?.correctBand">
              <span class="qt-range">{{ band.from }} – {{ band.to }}</span>
              <b class="qt-odds">×{{ band.odds }}</b>
              @if (displayData?.phase === 'REVEAL') {
                <span class="qt-crowd">{{ crowdPct(i) }}%</span>
              }
            </div>
          }
        </div>

        @if (displayData?.phase === 'BET') {
          <p class="qt-hint">Ogni squadra ha 100 gettoni. La fascia che contiene il valore paga la quota; le altre perdono i gettoni.</p>
          <div class="qt-ready">
            @for (row of displayData?.ready ?? []; track row.playerName) {
              <span class="qt-chip" [class.ok]="row.ready">{{ row.playerName }}</span>
            }
          </div>
        }

        @if (displayData?.phase === 'REVEAL') {
          <div class="qt-value">VALORE: {{ displayData?.value }} {{ displayData?.unit }}</div>
          @if (displayData?.best; as best) {
            <div class="qt-best">🎯 CECCHINO: {{ best.playerName }} · +{{ best.payout }}</div>
          }
          <div class="qt-rows">
            @for (row of displayData?.rows ?? []; track row.playerName) {
              <div class="qt-row">
                <span>{{ row.playerName }}</span>
                <span class="qt-tokens">{{ tokens(row.tokens) }}</span>
                <b>+{{ row.payout }}</b>
                <span class="qt-total">{{ row.total }}</span>
              </div>
            }
          </div>
        }
      } @else {
        <div class="qt-rows">
          @for (row of displayData?.rows ?? []; track row.playerName; let i = $index) {
            <div class="qt-row" [class.top]="i === 0">
              <span>{{ i + 1 }}. {{ row.playerName }}</span>
              <b>{{ row.total }}</b>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .qt-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(8px, 1.5vh, 16px); padding: clamp(14px, 2vw, 28px); color: var(--paper); }
    .qt-head { display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; }
    .qt-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .qt-title { margin: 0; font-family: var(--font-display); font-size: clamp(1.3rem, 2.4vw, 2rem); font-weight: 400; line-height: .95; letter-spacing: .04em; text-transform: uppercase; }
    .qt-progress { color: var(--acid); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .78rem); font-weight: 700; letter-spacing: .16em; }
    .qt-timer { font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.2rem); font-weight: 700; color: var(--acid); }
    .qt-timer.hot { color: var(--tomato); animation: qt-pulse .8s infinite; }
    .qt-question { max-width: 1100px; font-family: var(--font-display); font-size: clamp(1.2rem, 2.7vw, 2.1rem); line-height: 1.15; text-align: center; }
    .qt-category { padding: 2px 12px; border: 2px solid var(--coal); background: var(--acid); color: var(--coal); font-family: var(--font-mono); font-size: clamp(.58rem, .85vw, .74rem); font-weight: 700; letter-spacing: .1em; }
    .qt-bands { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(8px, 1.2vw, 16px); width: min(1180px, 96vw); }
    .qt-band { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: clamp(10px, 1.6vw, 18px); background: var(--paper-hi); color: var(--coal); border: 3px solid var(--coal); box-shadow: 5px 5px 0 var(--coal); }
    .qt-band.correct { background: var(--acid); box-shadow: 5px 5px 0 var(--tomato); }
    .qt-range { font-family: var(--font-mono); font-size: clamp(.9rem, 1.5vw, 1.25rem); font-weight: 700; }
    .qt-odds { font-family: var(--font-mono); font-size: clamp(1.1rem, 1.9vw, 1.6rem); color: var(--tomato); }
    .qt-crowd { font-family: var(--font-mono); font-size: .72rem; color: var(--coal); }
    .qt-value { padding: 6px 18px; background: var(--acid); color: var(--coal); border: 3px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.2rem); font-weight: 800; }
    .qt-best { padding: 4px 14px; background: var(--paper-hi); color: var(--coal); border: 2px dashed var(--tomato); font-family: var(--font-mono); font-size: clamp(.7rem, 1vw, .9rem); font-weight: 700; }
    .qt-hint { max-width: 900px; margin: 0; color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.65rem, .95vw, .84rem); text-align: center; }
    .qt-ready { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .qt-chip { padding: 3px 10px; border: 2px solid var(--coal); background: var(--paper-hi); color: var(--coal); font-family: var(--font-mono); font-size: .72rem; font-weight: 700; opacity: .55; }
    .qt-chip.ok { background: var(--acid); opacity: 1; }
    .qt-rows { display: flex; flex-direction: column; gap: 6px; width: min(980px, 94vw); }
    .qt-row { display: grid; grid-template-columns: 1.4fr 1.2fr auto auto; gap: 12px; align-items: center; padding: 7px 14px; background: var(--paper-hi); color: var(--coal); border: 2px solid var(--coal); font-size: clamp(.8rem, 1.1vw, 1rem); }
    .qt-row.top { background: var(--acid); }
    .qt-tokens { font-family: var(--font-mono); font-size: .8em; color: var(--ink-dim); }
    .qt-total { font-family: var(--font-mono); font-weight: 700; }
    @keyframes qt-pulse { 50% { transform: scale(1.08); opacity: .7; } }
  `]
})
export class Quota {
  @Input() displayData: any;
  @Input() timer = 0;

  crowdPct(index: number): number {
    const crowd: number[] = this.displayData?.crowd ?? [];
    const total = crowd.reduce((sum, value) => sum + value, 0);
    if (!total) return 0;
    return Math.round(((crowd[index] ?? 0) / total) * 100);
  }

  tokens(tokens: number[]): string {
    return (tokens ?? []).join(' / ');
  }
}
