import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV di Time Buzzer: cronometro bersaglio in stile carta/inchiostro,
 * tempi dei giocatori al reveal ed eliminati in evidenza.
 */
@Component({
  selector: 'app-time-buzzer',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-wrap">
      <header class="tb-head">
        <div class="tb-kicker">⏱️ TIME BUZZER</div>
        <h2 class="tb-title">MANCHE {{ displayData?.manche || 1 }} / {{ displayData?.total || 3 }}</h2>
        <div class="tb-timer" [class.hot]="timer <= 10">{{ timer }}s</div>
      </header>

      <div class="tb-clock-box">
        <div class="tb-clock">{{ format(displayData?.targetMs) }}</div>
        <div class="tb-clock-label">TEMPO BERSAGLIO</div>
      </div>

      <p class="tb-hint">Premi START, poi STOP il più vicino possibile a questo tempo.</p>

      @if (displayData?.reveal) {
        <div class="tb-results">
          @for (row of displayData.reveal.results; track row.playerName) {
            <div class="tb-row" [class.out]="row.eliminated" [class.best]="$first && !row.eliminated">
              <span class="tb-name">{{ row.playerName }}</span>
              <span class="tb-value">{{ format(row.ms) }}</span>
              <span class="tb-error">± {{ format(row.error) }}</span>
            </div>
          }
        </div>
      } @else {
        <div class="tb-count">{{ displayData?.guesses?.length || 0 }} / {{ displayData?.remaining?.length || 0 }} TEMPI REGISTRATI</div>
      }

      @if (displayData?.eliminated?.length) {
        <div class="tb-out">
          <span class="tb-out-label">FUORI</span>
          @for (name of displayData.eliminated; track name) {
            <span class="tb-out-name">{{ name }}</span>
          }
        </div>
      }

      @if (displayData?.reveal && displayData?.eliminated?.length) {
        <div class="tb-pass">
          <span class="tb-pass-label">PASSANO</span>
          @for (name of displayData.remaining; track name) {
            <span class="tb-pass-name">{{ name }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .tb-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(10px, 1.8vh, 20px); padding: clamp(14px, 2vw, 30px); color: var(--paper); }
    .tb-head { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
    .tb-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .tb-title { margin: 0; font-family: var(--font-display); font-size: clamp(1.4rem, 2.6vw, 2.2rem); font-weight: 400; line-height: .95; letter-spacing: .04em; text-transform: uppercase; }
    .tb-timer { font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.25rem); font-weight: 700; color: var(--acid); }
    .tb-timer.hot { color: var(--tomato); animation: tb-pulse .8s infinite; }

    .tb-clock-box { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: clamp(14px, 2.4vh, 26px) clamp(24px, 4vw, 56px); background: var(--paper); color: var(--coal); border: 4px solid var(--coal); box-shadow: 10px 10px 0 var(--tomato); }
    .tb-clock { font-family: var(--font-mono); font-size: clamp(4rem, 11vw, 9rem); font-weight: 700; letter-spacing: -.06em; line-height: 1; font-variant-numeric: tabular-nums; }
    .tb-clock-label { color: var(--tomato); font-family: var(--font-mono); font-size: clamp(.55rem, .8vw, .72rem); font-weight: 700; letter-spacing: .2em; }
    .tb-hint { max-width: 900px; margin: 0; color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.66rem, .95vw, .86rem); text-align: center; }

    .tb-results { width: min(900px, 94vw); display: flex; flex-direction: column; gap: 6px; }
    .tb-row { display: grid; grid-template-columns: 1fr auto auto; gap: 14px; align-items: center; padding: 8px 14px; background: var(--paper-hi); color: var(--coal); border: 2px solid var(--coal); box-shadow: 4px 4px 0 var(--coal); font-size: clamp(.8rem, 1.1vw, 1rem); }
    .tb-row.best { background: var(--acid); box-shadow: 5px 5px 0 var(--tomato); }
    .tb-row.out { opacity: .5; }
    .tb-name { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tb-value { font-family: var(--font-mono); font-weight: 700; }
    .tb-error { color: rgba(30, 25, 20, .55); font-family: var(--font-mono); font-size: .82em; }
    .tb-count { color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.7rem, 1vw, .9rem); letter-spacing: .1em; }
    .tb-out { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .tb-out-label { color: var(--tomato); font-family: var(--font-mono); font-size: .72rem; font-weight: 700; letter-spacing: .16em; }
    .tb-out-name { padding: 3px 9px; background: var(--tomato); color: var(--paper-hi); font-family: var(--font-mono); font-size: .78rem; font-weight: 700; }
    .tb-pass { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .tb-pass-label { color: var(--acid); font-family: var(--font-mono); font-size: .72rem; font-weight: 700; letter-spacing: .16em; }
    .tb-pass-name { padding: 3px 9px; background: var(--acid); color: var(--coal); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: .78rem; font-weight: 700; }
    @keyframes tb-pulse { 50% { transform: scale(1.08); opacity: .7; } }
  `]
})
export class TimeBuzzer {
  @Input() displayData: any;
  @Input() timer = 0;

  /** Formato mm:ss:cc, es. 00:19:23 = 19 secondi e 23 centesimi. */
  format(ms: number): string {
    const centiseconds = Math.max(0, Math.round((Number(ms) || 0) / 10));
    const cs = centiseconds % 100;
    const totalSeconds = Math.floor(centiseconds / 100);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}:${pad(cs)}`;
  }
}
