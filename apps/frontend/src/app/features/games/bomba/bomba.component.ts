import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV di Bomba: una domanda, tutte le opzioni sul tabellone, un turno per
 * squadra. Le caselle vere si salvano, le bombe esplodono appena scelte; chi
 * resta fuori viene mostrato sotto il tabellone.
 */
@Component({
  selector: 'app-bomba',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bb-wrap">
      <header class="bb-head">
        <div class="bb-kicker">💣 BOMBA</div>
        <h2 class="bb-title">
          @if (displayData?.active === false) {
            ROUND TERMINATO
          } @else {
            TOCCA A <span class="bb-turn">{{ displayData?.turn || '—' }}</span>
          }
        </h2>
        <div class="bb-clock" [class.hot]="displayData?.active !== false && timer <= 5">{{ timer }}s</div>
      </header>

      @if (displayData?.prompt) {
        <p class="bb-prompt">{{ displayData.prompt }}</p>
      }

      @if (lastEvent) {
        <div class="bb-event" [class.bomb]="lastEvent.kind === 'bomb'">
          {{ eventText(lastEvent) }}
        </div>
      }

      @if (displayData?.active === false) {
        <div class="bb-disarmed">🛡️ LE BOMBE RIMASTE SONO STATE DISINNESCATE</div>
      }

      <div class="bb-board">
        @for (cell of cells; track cell.id) {
          <div
            class="bb-cell"
            [class.picked]="cell.used"
            [class.safe]="cell.bomb === false"
            [class.bomb]="cell.bomb === true"
          >
            <div class="bb-cell-top">
              <span class="bb-cell-mark">{{ mark(cell) }}</span>
            </div>
            <div class="bb-cell-label">{{ cell.label }}</div>
            @if (cell.pickedBy) {
              <div class="bb-cell-names">{{ cell.pickedBy }}</div>
            }
          </div>
        } @empty {
          <div class="bb-empty">Tabellone in arrivo…</div>
        }
      </div>

      @if (displayData?.eliminated?.length) {
        <div class="bb-foot">
          <span class="bb-foot-label">FUORI</span>
          <span class="bb-foot-value danger">{{ displayData.eliminated.join(' · ') }}</span>
        </div>
      } @else {
        <div class="bb-foot">
          <span class="bb-foot-label">CASCELLE</span>
          <span class="bb-foot-value">{{ usedCount }} / {{ cells.length }} USATE</span>
        </div>
      }

      @if (penaltyRows.length) {
        <div class="bb-penalties">
          @for (row of penaltyRows; track row.name) {
            <span class="bb-penalty">{{ row.name }} <b>{{ row.penalty }}</b></span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .bb-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(8px, 1.4vh, 16px); padding: clamp(12px, 2vw, 28px); color: var(--paper); }
    .bb-head { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; text-align: center; }
    .bb-kicker { padding: 4px 11px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .bb-title { margin: 0; font-family: var(--font-display); font-size: clamp(1.3rem, 2.6vw, 2.1rem); font-weight: 400; text-transform: uppercase; letter-spacing: .04em; }
    .bb-turn { color: var(--acid); }
    .bb-clock { font-family: var(--font-mono); font-size: clamp(.9rem, 1.5vw, 1.3rem); font-weight: 700; color: var(--acid); }
    .bb-clock.hot { color: var(--tomato); }
    .bb-prompt { max-width: 1000px; margin: 0; padding: 8px 16px; background: var(--paper-hi); color: var(--coal); border: 3px solid var(--coal); box-shadow: 6px 6px 0 var(--tomato); font-family: var(--font-display); font-size: clamp(.95rem, 1.7vw, 1.5rem); text-align: center; text-transform: uppercase; letter-spacing: .02em; }
    .bb-event { padding: 5px 14px; background: var(--paper-hi); color: var(--coal); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.66rem, 1vw, .84rem); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .bb-event.bomb { background: var(--tomato); color: var(--paper-hi); animation: bb-shake .35s ease-in-out; }
    .bb-disarmed { padding: 6px 14px; background: var(--mint); color: var(--coal); border: 3px solid var(--coal); box-shadow: 4px 4px 0 var(--coal); font-family: var(--font-mono); font-size: clamp(.66rem, 1vw, .84rem); font-weight: 700; letter-spacing: .06em; }

    .bb-board { width: min(1320px, 96vw); display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: clamp(6px, 1vw, 12px); }
    .bb-cell { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; min-height: clamp(58px, 9vh, 92px); background: var(--paper); color: var(--coal); border: 3px solid var(--coal); box-shadow: 4px 4px 0 var(--coal); overflow: hidden; }
    .bb-cell.picked { box-shadow: 5px 5px 0 var(--mustard); }
    .bb-cell.safe { background: var(--mint); }
    .bb-cell.bomb { background: var(--tomato); color: var(--paper-hi); animation: bb-shake .35s ease-in-out; }
    .bb-cell-top { display: flex; align-items: center; justify-content: space-between; }
    .bb-cell-id { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; border: 2px solid currentColor; font-family: var(--font-mono); font-size: .6rem; font-weight: 700; }
    .bb-cell-mark { font-family: var(--font-mono); font-size: .72rem; font-weight: 700; }
    .bb-cell-label { font-family: var(--font-mono); font-size: clamp(.66rem, .95vw, .84rem); font-weight: 700; line-height: 1.15; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .bb-cell-names { font-family: var(--font-mono); font-size: .58rem; letter-spacing: .06em; opacity: .85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bb-empty { grid-column: 1 / -1; padding: 20px; text-align: center; font-family: var(--font-mono); font-size: .8rem; color: var(--ink-dim); }

    .bb-foot { display: flex; align-items: center; gap: 10px; }
    .bb-foot-label { color: var(--acid); font-family: var(--font-mono); font-size: .66rem; font-weight: 700; letter-spacing: .18em; }
    .bb-foot-value { font-family: var(--font-mono); font-size: .8rem; font-weight: 700; }
    .bb-foot-value.danger { color: var(--tomato); }
    .bb-penalties { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .bb-penalty { padding: 3px 9px; background: var(--paper-hi); color: var(--coal); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: .66rem; font-weight: 700; }
    .bb-penalty b { color: var(--tomato); }
    @keyframes bb-shake { 25% { transform: translateX(-4px) rotate(-1deg); } 75% { transform: translateX(4px) rotate(1deg); } }
    @media (max-width: 900px) {
      .bb-board { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
  `],
})
export class Bomba {
  @Input() displayData: any;
  @Input() timer = 0;

  get cells(): any[] {
    return Array.isArray(this.displayData?.cells) ? this.displayData.cells : [];
  }

  get usedCount(): number {
    return this.cells.filter((cell) => cell.used).length;
  }

  get lastEvent(): any {
    return this.displayData?.lastEvent ?? null;
  }

  get penaltyRows(): Array<{ name: string; penalty: number }> {
    const penalties = this.displayData?.penalties ?? {};
    return Object.entries(penalties)
      .map(([name, value]) => ({ name, penalty: Number(value) || 0 }))
      .filter((row) => row.penalty !== 0)
      .sort((a, b) => a.penalty - b.penalty);
  }

  mark(cell: any): string {
    if (cell.bomb === true) return '💥';
    if (cell.bomb === false) return '✓';
    return '';
  }

  eventText(event: any): string {
    if (!event) return '';
    if (event.kind === 'bomb') return `💥 ${event.player}: ${event.label} −200`;
    if (event.kind === 'safe') return `✓ ${event.player}: ${event.label}`;
    if (event.kind === 'timeout') return `⌛ ${event.player}: turno saltato`;
    return '';
  }
}
