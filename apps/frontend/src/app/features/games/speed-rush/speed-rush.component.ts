import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV di Speed Rush: pista stampata in carta/inchiostro, gettoni al posto delle
 * pedine, barre piene senza gradienti né aloni. L'header parte sotto il badge
 * del round (`ROUND: n/13` in alto a sinistra) per non sovrapporsi.
 */
@Component({
  selector: 'app-speed-rush',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sr-wrap">
      <div class="sr-head">
        <div class="sr-head-text">
          <div class="sr-kicker">⚡ CORSA A TAP</div>
          <h2 class="sr-title">SPEED RUSH</h2>
        </div>
        <div class="sr-clock" [class.hot]="timer <= 10">
          <span class="sr-clock-value">{{ timer }}s</span>
          <span class="sr-clock-label">AL TRAGUARDO</span>
        </div>
      </div>

      <div class="sr-board">
        <div class="sr-board-head">
          <span>POS</span>
          <span>SQUADRA</span>
          <span>PISTA</span>
          <span>FATTO</span>
        </div>

        <div class="sr-lanes">
          @for (lane of displayData?.lanes; track lane.playerName; let i = $index) {
            <div class="sr-lane" [class.finished]="lane.finished">
              <span class="sr-pos">{{ lane.finished ? lane.position : i + 1 }}</span>
              <span class="sr-name">
                <span class="sr-player">{{ lane.playerName }}</span>
                @if (lane.multiplier > 1) {
                  <span class="sr-combo" [class.x3]="lane.multiplier === 3" [class.x4]="lane.multiplier === 4">×{{ lane.multiplier }}</span>
                }
              </span>
              <span class="sr-track" [class.boost]="lane.multiplier > 1">
                <span class="sr-fill" [style.width.%]="lane.progress"></span>
                <span class="sr-token" [class.boost]="lane.multiplier > 1" [style.--p]="lane.progress + '%'">{{ initial(lane.playerName) }}</span>
                <span class="sr-finish"></span>
              </span>
              <span class="sr-pct">{{ lane.progress }}%</span>
            </div>
          } @empty {
            <div class="sr-empty">IN ATTESA DELLE SQUADRE…</div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .sr-wrap {
      width: 100%; height: 100%; display: flex; flex-direction: column;
      gap: clamp(12px, 2vh, 22px);
      /* Il badge ROUND della regia sta in alto a sinistra: si parte sotto. */
      padding: clamp(96px, 12vh, 124px) clamp(20px, 3vw, 44px) clamp(16px, 2vh, 26px);
      color: var(--paper);
    }

    .sr-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
    .sr-head-text { display: flex; flex-direction: column; gap: 6px; }
    .sr-kicker {
      align-self: flex-start; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi);
      border: 2px solid var(--coal); box-shadow: 4px 4px 0 var(--coal);
      font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .78rem);
      font-weight: 700; letter-spacing: .16em; transform: rotate(-1.2deg);
    }
    .sr-title {
      margin: 0; font-family: var(--font-display); font-weight: 400;
      font-size: clamp(2rem, 3.6vw, 3.2rem); line-height: .95; letter-spacing: .04em; text-transform: uppercase;
    }
    .sr-clock {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      padding: 8px clamp(12px, 1.6vw, 22px); background: var(--paper-hi); color: var(--coal);
      border: 3px solid var(--coal); box-shadow: 6px 6px 0 var(--coal);
      font-family: var(--font-mono); font-variant-numeric: tabular-nums;
    }
    .sr-clock-value { font-size: clamp(1.3rem, 2vw, 1.9rem); font-weight: 700; line-height: 1; }
    .sr-clock-label { font-size: clamp(.5rem, .72vw, .62rem); font-weight: 700; letter-spacing: .18em; opacity: .65; }
    .sr-clock.hot { background: var(--tomato); color: var(--paper-hi); border-color: var(--coal); box-shadow: 6px 6px 0 var(--coal); }

    .sr-board {
      flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px;
      padding: clamp(10px, 1.6vh, 18px) clamp(12px, 1.8vw, 24px);
      background: var(--paper); color: var(--coal);
      border: 4px solid var(--coal); box-shadow: 12px 12px 0 var(--coal);
    }
    .sr-board-head {
      display: grid; grid-template-columns: 52px minmax(120px, 220px) 1fr 78px; gap: clamp(10px, 1.4vw, 20px);
      padding: 0 0 6px; border-bottom: 3px solid var(--coal);
      font-family: var(--font-mono); font-size: clamp(.5rem, .82vw, .66rem);
      font-weight: 700; letter-spacing: .18em; opacity: .6;
    }
    .sr-lanes { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: clamp(6px, 1.1vh, 14px); }

    .sr-lane {
      display: grid; grid-template-columns: 52px minmax(120px, 220px) 1fr 78px;
      align-items: center; gap: clamp(10px, 1.4vw, 20px);
      padding: 6px 8px; border: 2px solid var(--coal); background: var(--paper-hi);
    }
    .sr-lane.finished { background: var(--acid); }

    .sr-pos {
      display: inline-flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; background: var(--coal); color: var(--paper-hi);
      border: 2px solid var(--coal); font-family: var(--font-mono); font-weight: 700; font-size: .95rem;
    }
    .sr-lane.finished .sr-pos { background: var(--mustard); color: var(--coal); }

    .sr-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .sr-player {
      font-family: var(--font); font-weight: 800; font-size: clamp(.9rem, 1.3vw, 1.25rem);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .sr-combo {
      flex: 0 0 auto; padding: 1px 6px; background: var(--mint); color: var(--coal);
      border: 2px solid var(--coal); box-shadow: 2px 2px 0 var(--coal);
      font-family: var(--font-mono); font-size: clamp(.58rem, .74vw, .72rem); font-weight: 700;
    }
    .sr-combo.x3 { background: var(--mustard); }
    .sr-combo.x4 { background: var(--tomato); color: var(--paper-hi); }

    .sr-track {
      position: relative; display: block; height: clamp(30px, 4.4vh, 46px);
      background: var(--paper); border: 3px solid var(--coal); overflow: hidden;
    }
    .sr-fill {
      position: absolute; inset: 0 auto 0 0; display: block;
      background: var(--cobalt); border-right: 3px solid var(--coal);
      transition: width .18s linear;
    }
    .sr-track.boost .sr-fill { background: var(--acid); }

    /* Gettone: oggetto fisico, quindi cerchio. */
    .sr-token {
      /* Mai a metà fuori dalla pista: il gettone resta dentro il bordo. */
      position: absolute; top: 50%; left: clamp(16px, var(--p, 0%), calc(100% - 16px)); transform: translate(-50%, -50%);
      display: inline-flex; align-items: center; justify-content: center;
      width: clamp(22px, 2vw, 30px); height: clamp(22px, 2vw, 30px);
      border-radius: 50%; background: var(--paper-hi); color: var(--coal);
      border: 3px solid var(--coal); box-shadow: 2px 2px 0 var(--coal);
      font-family: var(--font-mono); font-size: clamp(.6rem, .8vw, .78rem); font-weight: 700;
      transition: left .18s linear; z-index: 2;
    }
    .sr-token.boost { background: var(--acid); }
    .sr-finish { position: absolute; top: 0; right: 6px; bottom: 0; width: 4px; background: var(--coal); box-shadow: -8px 0 0 var(--coal); }

    .sr-pct {
      justify-self: end; font-family: var(--font-mono); font-variant-numeric: tabular-nums;
      font-weight: 700; font-size: clamp(.85rem, 1.2vw, 1.1rem);
    }
    .sr-lane.finished .sr-pct { background: var(--coal); color: var(--paper-hi); padding: 1px 8px; }

    .sr-empty { font-family: var(--font-mono); letter-spacing: .14em; text-align: center; opacity: .6; }

    @media (max-width: 800px) {
      .sr-board-head, .sr-lane { grid-template-columns: 40px minmax(84px, 130px) 1fr 58px; }
      .sr-pos { width: 26px; height: 26px; font-size: .8rem; }
    }
  `]
})
export class SpeedRush {
  @Input() displayData: any;
  @Input() timer = 0;

  /** Iniziale del gettone: al posto dell'emoji, un timbro mono. */
  initial(playerName: string): string {
    return String(playerName || '?').trim().charAt(0).toUpperCase() || '?';
  }
}
