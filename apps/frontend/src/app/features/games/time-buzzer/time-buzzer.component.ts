import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioService } from '../../../core/services/audio.service';

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
        @if (displayData?.waitingNext) {
          <div class="tb-next">PROSSIMA MANCHE · PARTI DALL'ADMIN</div>
        }
      </header>

      <div class="tb-clock-box">
        @if (phase() === 'spin') {
          <div class="tb-clock tb-clock-spin">{{ spinText() }}</div>
          <div class="tb-clock-label">TEMPO IN ARRIVO…</div>
        } @else if (countdown() > 0) {
          <div class="tb-clock tb-countdown">{{ countdown() }}</div>
          <div class="tb-clock-label">BERSAGLIO {{ format(displayData?.targetMs) }}</div>
        } @else {
          <div class="tb-clock">{{ format(displayData?.targetMs) }}</div>
          <div class="tb-clock-label">TEMPO BERSAGLIO</div>
          <div class="tb-clock-note">IL CONTEGGIO PARTE AL VIA!</div>
        }
      </div>

      @if (goFlash()) {
        <div class="tb-go">VIA!</div>
      }

      <p class="tb-hint">Premi START, poi STOP il più vicino possibile a questo tempo.</p>

      @if (displayData?.reveal) {
        <div class="tb-results">
          @for (row of displayData.reveal.results; track row.playerName) {
            <div class="tb-row" [class.out]="row.eliminated" [class.best]="$first && !row.eliminated">
              <span class="tb-name">{{ row.playerName }}</span>
              <span class="tb-value">{{ row.missed ? '—' : format(row.ms) }}</span>
              @if (row.missed) {
                <span class="tb-error tb-missed">TEMPO MANCANTE</span>
              } @else {
                <span class="tb-error">± {{ format(row.error) }}</span>
              }
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
    .tb-wrap { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(10px, 1.8vh, 20px); padding: clamp(14px, 2vw, 30px); color: var(--paper); }
    .tb-head { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
    .tb-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .tb-title { margin: 0; font-family: var(--font-display); font-size: clamp(1.4rem, 2.6vw, 2.2rem); font-weight: 400; line-height: .95; letter-spacing: .04em; text-transform: uppercase; }
    .tb-next { padding: 6px 14px; background: var(--acid); color: var(--coal); border: 2px solid var(--coal); box-shadow: 4px 4px 0 var(--tomato); font-family: var(--font-mono); font-size: clamp(.7rem, 1vw, .9rem); font-weight: 700; letter-spacing: .12em; }

    .tb-clock-box { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: clamp(14px, 2.4vh, 26px) clamp(24px, 4vw, 56px); background: var(--paper); color: var(--coal); border: 4px solid var(--coal); box-shadow: 10px 10px 0 var(--tomato); }
    .tb-clock { font-family: var(--font-mono); font-size: clamp(4rem, 11vw, 9rem); font-weight: 700; letter-spacing: -.06em; line-height: 1; font-variant-numeric: tabular-nums; }
    .tb-clock-note { color: var(--coal); font-family: var(--font-mono); font-size: clamp(.55rem, .8vw, .72rem); font-weight: 700; letter-spacing: .18em; opacity: .7; }
    .tb-clock-label { color: var(--tomato); font-family: var(--font-mono); font-size: clamp(.55rem, .8vw, .72rem); font-weight: 700; letter-spacing: .2em; }
    .tb-clock-spin { color: var(--tomato); }
    .tb-countdown { color: var(--tomato); font-size: clamp(6rem, 16vw, 13rem); }
    .tb-go { position: absolute; top: 50%; left: 50%; z-index: 5; padding: clamp(6px, 1.2vh, 14px) clamp(28px, 6vw, 72px); background: var(--acid); color: var(--coal); border: 4px solid var(--coal); box-shadow: 14px 14px 0 var(--tomato); font-family: var(--font-display); font-size: clamp(3rem, 9vw, 7rem); font-weight: 400; line-height: 1; letter-spacing: .1em; text-transform: uppercase; transform: translate(-50%, -50%) rotate(-3deg); text-align: center; }
    .tb-hint { max-width: 900px; margin: 0; color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.66rem, .95vw, .86rem); text-align: center; }

    .tb-results { width: min(900px, 94vw); display: flex; flex-direction: column; gap: 6px; }
    .tb-row { display: grid; grid-template-columns: 1fr auto auto; gap: 14px; align-items: center; padding: 8px 14px; background: var(--paper-hi); color: var(--coal); border: 2px solid var(--coal); box-shadow: 4px 4px 0 var(--coal); font-size: clamp(.8rem, 1.1vw, 1rem); }
    .tb-row.best { background: var(--acid); box-shadow: 5px 5px 0 var(--tomato); }
    .tb-row.out { opacity: .5; }
    .tb-name { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tb-value { font-family: var(--font-mono); font-weight: 700; }
    .tb-error { color: color-mix(in srgb, var(--coal) 55%, transparent); font-family: var(--font-mono); font-size: .82em; }
    .tb-missed { color: var(--tomato); font-weight: 700; letter-spacing: .12em; }
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
export class TimeBuzzer implements OnChanges, OnDestroy {
  @Input() displayData: any;
  @Input() timer = 0;

  private readonly audio = inject(AudioService);

  /** Timbro VIA! per quattro secondi dopo il via del server. */
  goFlash = signal(false);
  /** Numeri che girano durante lo slot iniziale. */
  spinText = signal('00:00:00');
  private goTimer?: ReturnType<typeof setTimeout>;
  private spinTimer?: ReturnType<typeof setInterval>;
  private lastStartedAt = 0;

  /** Fase della manche: 'spin' | 'reveal' | 'countdown' | 'running'. */
  phase(): string {
    return this.displayData?.phase ?? 'running';
  }

  countdown(): number {
    return Number(this.displayData?.countdown ?? 0) || 0;
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.syncSpin();

    const startedAt = Number(this.displayData?.startedAt ?? 0);
    if (!startedAt || startedAt === this.lastStartedAt) return;
    this.lastStartedAt = startedAt;
    this.goFlash.set(true);
    // Il gong sancisce il via: da qui i telefoni contano.
    this.audio.playGong();
    if (this.goTimer) clearTimeout(this.goTimer);
    this.goTimer = setTimeout(() => this.goFlash.set(false), 4000);
  }

  ngOnDestroy(): void {
    if (this.goTimer) clearTimeout(this.goTimer);
    if (this.spinTimer) clearInterval(this.spinTimer);
  }

  /** Slot della preparazione: i numeri scorrono finché il bersaglio non esce. */
  private syncSpin(): void {
    const spinning = this.phase() === 'spin';
    if (spinning && !this.spinTimer) {
      const roll = () => this.spinText.set(this.format(Math.round(Math.random() * 29000)));
      roll();
      this.spinTimer = setInterval(roll, 70);
      return;
    }
    if (!spinning && this.spinTimer) {
      clearInterval(this.spinTimer);
      this.spinTimer = undefined;
    }
  }

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
