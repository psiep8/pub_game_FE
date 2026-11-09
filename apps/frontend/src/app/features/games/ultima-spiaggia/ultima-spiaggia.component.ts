import { UltimaSpiaggiaPhase } from './ultima-spiaggia.mode';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV di ULTIMA SPIAGGIA: la categoria del round resta fissa mentre ogni squadra
 * sceglie il livello sul telefono. La TV non mostra i livelli disponibili, le
 * domande né le risposte: a fine round pubblica solo livello scelto ed esito.
 */
@Component({
  selector: 'app-ultima-spiaggia',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tm-wrap">
      <header class="tm-head">
        <div class="tm-kicker">🎲 ULTIMA SPIAGGIA</div>
        <h2 class="tm-title">
          @if (displayData?.phase === UltimaSpiaggiaPhase.LEVEL) { CATEGORIA ESTRATTA }
          @else if (displayData?.phase === UltimaSpiaggiaPhase.QUESTION) { RISPONDETE SUL TELEFONO }
          @else if (displayData?.phase === UltimaSpiaggiaPhase.REVEAL) { RISULTATI DEL ROUND }
          @else { IL CONTO FINALE }
        </h2>
        <div class="tm-meta">
          <span class="tm-round">{{ displayData?.phase === UltimaSpiaggiaPhase.REVEAL ? 'LIVELLO ED ESITO' : 'SCELTA SUL TELEFONO' }}</span>
          <span class="tm-timer" [class.hot]="(displayData?.secondsLeft ?? 0) <= 4">{{ displayData?.secondsLeft ?? 0 }}s</span>
        </div>
      </header>

      @if (displayData?.phase === UltimaSpiaggiaPhase.LEVEL) {
        <div class="tm-category-card">
          <span class="tm-category-label">CATEGORIA DEL ROUND</span>
          <strong class="tm-category-name">{{ displayData?.category || '—' }}</strong>
          <p class="tm-hint">Ogni squadra sceglie il proprio livello sul telefono.</p>
        </div>
      }

      @if (displayData?.phase === UltimaSpiaggiaPhase.QUESTION) {
        <div class="tm-category-card">
          <span class="tm-category-label">CATEGORIA</span>
          <strong class="tm-category-name">{{ displayData?.category || '—' }}</strong>
          <p class="tm-note">OGNI TELEFONO HA LA SUA DOMANDA</p>
        </div>
      }

      @if (displayData?.phase === UltimaSpiaggiaPhase.REVEAL || displayData?.phase === UltimaSpiaggiaPhase.FINALE) {
        <div class="tm-results">
          <div class="tm-results-head">
            <span>SQUADRA</span>
            <span>LIVELLO</span>
            <span>{{ displayData?.phase === UltimaSpiaggiaPhase.REVEAL ? 'ESITO' : 'TOTALE' }}</span>
          </div>
          @for (row of displayData?.rows ?? []; track row.playerName) {
            <div class="tm-row" [class.good]="row.status === 'CORRECT'" [class.bad]="row.status !== 'CORRECT'">
              <span class="tm-name">{{ row.playerName }}</span>
              <b class="tm-pick">{{ row.level ?? '—' }}</b>
              @if (displayData?.phase === UltimaSpiaggiaPhase.REVEAL) {
                <b class="tm-result" [class.ok]="row.status === 'CORRECT'">
                  {{ row.status === 'CORRECT' ? 'INDOVINATA' : 'SBAGLIATA' }}
                </b>
              } @else {
                <b class="tm-total">{{ signed(row.total) }}</b>
              }
            </div>
          }
          @if (!(displayData?.rows?.length)) {
            <p class="tm-hint">Nessuna squadra registrata.</p>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .tm-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(10px, 1.8vh, 20px); padding: clamp(14px, 2vw, 28px); color: var(--paper); overflow: hidden; }
    .tm-head { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
    .tm-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .tm-title { margin: 0; font-family: var(--font-display); font-size: clamp(1.4rem, 2.6vw, 2.2rem); font-weight: 400; line-height: .95; letter-spacing: .04em; text-transform: uppercase; }
    .tm-meta { display: flex; align-items: center; gap: clamp(8px, 1.4vw, 18px); flex-wrap: wrap; justify-content: center; }
    .tm-round { color: var(--acid); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .78rem); font-weight: 700; letter-spacing: .16em; }
    .tm-timer { font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.25rem); font-weight: 700; color: var(--acid); }
    .tm-timer.hot { color: var(--tomato); animation: tm-pulse .8s infinite; }

    .tm-category-card { display: flex; flex-direction: column; align-items: center; gap: clamp(6px, 1vh, 12px); width: min(920px, 92vw); padding: clamp(20px, 3.4vw, 40px); background: var(--paper-hi); color: var(--coal); border: 4px solid var(--coal); box-shadow: 10px 10px 0 var(--coal); transform: rotate(-.6deg); text-align: center; }
    .tm-category-label { color: var(--tomato); font-family: var(--font-mono); font-size: clamp(.62rem, 1vw, .82rem); font-weight: 700; letter-spacing: .18em; }
    .tm-category-name { font-family: var(--font-display); font-size: clamp(2rem, 5.2vw, 4.8rem); font-weight: 400; line-height: .95; letter-spacing: .02em; text-transform: uppercase; }
    .tm-category-card .tm-hint { color: var(--coal); opacity: .7; }
    .tm-note { margin: 0; padding: 5px 12px; background: var(--acid); color: var(--coal); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .78rem); font-weight: 700; letter-spacing: .12em; }
    .tm-hint { max-width: 980px; margin: 0; color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.65rem, .95vw, .84rem); text-align: center; }

    .tm-results { display: flex; flex-direction: column; gap: 5px; width: min(1440px, 96vw); flex: 1 1 auto; min-height: 0; overflow-y: auto; }
    .tm-results-head, .tm-row { display: grid; grid-template-columns: minmax(0, 1fr) 110px 190px; gap: 12px; align-items: center; }
    .tm-results-head { position: sticky; top: 0; z-index: 1; background: var(--bg-0); }
    .tm-results-head { padding: 0 14px 2px; color: var(--acid); font-family: var(--font-mono); font-size: clamp(.56rem, .8vw, .7rem); font-weight: 700; letter-spacing: .14em; }
    .tm-results-head span:nth-child(2), .tm-results-head span:nth-child(3) { text-align: right; }
    .tm-row { flex: 0 0 auto; padding: 7px 12px; background: var(--paper-hi); color: var(--coal); border: 3px solid var(--coal); box-shadow: 3px 3px 0 var(--coal); font-size: clamp(.82rem, 1.05vw, .98rem); }
    .tm-row.bad .tm-result { color: var(--tomato); }
    .tm-row.good .tm-result { color: var(--coal); }
    .tm-row.good { background: var(--acid); }
    .tm-row.bad { box-shadow: inset 5px 0 0 var(--tomato), 3px 3px 0 var(--coal); }
    .tm-name { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tm-pick, .tm-result, .tm-total { font-family: var(--font-mono); font-weight: 800; text-align: right; }
    .tm-result { color: var(--tomato); font-size: .8em; letter-spacing: .06em; }
    .tm-result.ok { color: var(--coal); }
    .tm-total { color: var(--coal); }
    @keyframes tm-pulse { 50% { transform: scale(1.08); opacity: .7; } }
  `],
})
export class UltimaSpiaggia {
  /** Fasi del gioco, disponibili anche nel template. */
  readonly UltimaSpiaggiaPhase = UltimaSpiaggiaPhase;

  @Input() displayData: any;
  @Input() timer = 0;

  signed(points: number | null | undefined): string {
    const value = Number(points) || 0;
    return value > 0 ? `+${value}` : `${value}`;
  }
}
