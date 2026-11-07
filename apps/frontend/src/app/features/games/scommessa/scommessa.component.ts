import { ScommessaPhase } from './scommessa.mode';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV di TUTTO O METÀ (ex Scommessa): cinque round, livelli 100-500 usati una
 * volta per squadra, una domanda per livello. Il mode manda lo stato deciso.
 */
@Component({
  selector: 'app-scommessa',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tm-wrap">
      <header class="tm-head">
        <div class="tm-kicker">🎲 TUTTO O METÀ</div>
        <h2 class="tm-title">
          @if (displayData?.phase === ScommessaPhase.LEVEL) { SCEGLI IL LIVELLO }
          @else if (displayData?.phase === ScommessaPhase.QUESTION) { LA TUA DOMANDA }
          @else if (displayData?.phase === ScommessaPhase.REVEAL) { TUTTO O METÀ }
          @else { IL CONTO FINALE }
        </h2>
        <div class="tm-meta">
          <span class="tm-round">ROUND {{ displayData?.round ?? 1 }} / {{ displayData?.total ?? 5 }}</span>
          @if (displayData?.category) {
            <span class="tm-category">🎯 {{ displayData?.category }}</span>
          }
          <span class="tm-timer" [class.hot]="(displayData?.secondsLeft ?? 0) <= 4">{{ displayData?.secondsLeft ?? 0 }}s</span>
        </div>
      </header>

      @if (displayData?.phase === ScommessaPhase.LEVEL) {
        <div class="tm-levels">
          @for (level of displayData?.levels ?? []; track level) {
            <div class="tm-level" [class.used]="allUsed(level)">
              <b>{{ level }}</b>
              <span>{{ levelLabel(level) }}</span>
            </div>
          }
        </div>
        <p class="tm-hint">
          Ogni squadra sceglie un livello mai usato: giusta +livello, sbagliata o scaduta −metà.
        </p>
      }

      @if (displayData?.phase === ScommessaPhase.QUESTION) {
        <div class="tm-note">OGNI TELEFONO HA LA SUA DOMANDA</div>
      }

      @if (displayData?.phase === ScommessaPhase.REVEAL || displayData?.phase === ScommessaPhase.FINALE) {
        <div class="tm-answers">
          @for (question of displayData?.questions ?? []; track question.level) {
            <div class="tm-answer">
              <b>{{ question.level }}</b>
              <span>{{ question.correctAnswer }}</span>
            </div>
          }
        </div>
      }

      <div class="tm-rows">
        @for (row of displayData?.rows ?? []; track row.playerName) {
          <div class="tm-row" [class.ready]="row.answered" [class.good]="row.points > 0" [class.bad]="row.points < 0">
            <span class="tm-name">{{ row.playerName }}</span>
            <b class="tm-pick">{{ row.level ?? '—' }}</b>
            @if (displayData?.phase === ScommessaPhase.REVEAL) {
              <span class="tm-state">{{ row.answered ? 'RISPOSTO' : 'SCADUTO' }}</span>
              <b class="tm-delta">{{ signed(row.points) }}</b>
            } @else if (displayData?.phase === ScommessaPhase.FINALE) {
              <span class="tm-state">TOTALE</span>
              <b class="tm-delta">{{ signed(row.total) }}</b>
            } @else if (displayData?.phase === ScommessaPhase.QUESTION) {
              <span class="tm-state">{{ row.answered ? 'RISPOSTO' : 'PENSA' }}</span>
              <b class="tm-delta">×1</b>
            } @else {
              <span class="tm-state">{{ row.used?.length ?? 0 }} / {{ displayData?.total ?? 5 }} USATI</span>
              <b class="tm-delta">—</b>
            }
          </div>
        }
        @if (!(displayData?.rows?.length)) {
          <p class="tm-hint">Nessuna squadra registrata.</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .tm-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(8px, 1.6vh, 18px); padding: clamp(14px, 2vw, 28px); color: var(--paper); }
    .tm-head { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
    .tm-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .tm-title { margin: 0; font-family: var(--font-display); font-size: clamp(1.4rem, 2.6vw, 2.2rem); font-weight: 400; line-height: .95; letter-spacing: .04em; text-transform: uppercase; }
    .tm-meta { display: flex; align-items: center; gap: clamp(8px, 1.4vw, 18px); flex-wrap: wrap; justify-content: center; }
    .tm-round { color: var(--acid); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .78rem); font-weight: 700; letter-spacing: .16em; }
    .tm-category { padding: 2px 10px; border: 2px solid var(--coal); background: var(--acid); color: var(--coal); font-family: var(--font-mono); font-size: clamp(.58rem, .85vw, .74rem); font-weight: 700; letter-spacing: .1em; }
    .tm-timer { font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.25rem); font-weight: 700; color: var(--acid); }
    .tm-timer.hot { color: var(--tomato); animation: tm-pulse .8s infinite; }

    .tm-levels { display: flex; gap: clamp(8px, 1.4vw, 18px); flex-wrap: wrap; justify-content: center; }
    .tm-level { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: clamp(76px, 8vw, 116px); padding: 10px 14px; background: var(--paper-hi); color: var(--coal); border: 3px solid var(--coal); box-shadow: 5px 5px 0 var(--coal); }
    .tm-level.used { background: var(--paper); opacity: .45; box-shadow: 2px 2px 0 var(--coal); }
    .tm-level b { font-family: var(--font-display); font-size: clamp(1.2rem, 2vw, 1.7rem); font-weight: 400; }
    .tm-level span { color: var(--tomato); font-family: var(--font-mono); font-size: .68rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }

    .tm-note { padding: 6px 16px; background: var(--paper-hi); color: var(--coal); border: 2px dashed var(--tomato); font-family: var(--font-mono); font-size: clamp(.62rem, .95vw, .8rem); font-weight: 700; letter-spacing: .12em; }
    .tm-hint { max-width: 980px; margin: 0; color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.65rem, .95vw, .84rem); text-align: center; }

    .tm-answers { display: flex; flex-direction: column; gap: 4px; width: min(1020px, 94vw); }
    .tm-answer { display: grid; grid-template-columns: 64px 1fr; gap: 10px; align-items: center; padding: 4px 12px; background: var(--paper); color: var(--coal); border: 2px solid var(--coal); font-size: clamp(.66rem, 1vw, .84rem); }
    .tm-answer b { font-family: var(--font-mono); color: var(--tomato); }
    .tm-answer span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .tm-rows { display: flex; flex-direction: column; gap: 6px; width: min(1020px, 94vw); }
    .tm-row { display: grid; grid-template-columns: 1fr 80px 1fr auto; gap: 12px; align-items: center; padding: 7px 14px; background: var(--paper-hi); color: var(--coal); border: 2px solid var(--coal); font-size: clamp(.82rem, 1.15vw, 1.02rem); }
    .tm-row.ready { box-shadow: inset 4px 0 0 var(--mustard); }
    .tm-row.good { background: var(--acid); }
    .tm-row.bad { box-shadow: inset 4px 0 0 var(--tomato); }
    .tm-name { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tm-pick { font-family: var(--font-mono); font-size: 1.05em; }
    .tm-state { font-family: var(--font-mono); font-size: .72em; letter-spacing: .08em; color: var(--ink-dim); }
    .tm-delta { font-family: var(--font-mono); font-weight: 800; }
    .tm-row.bad .tm-delta { color: var(--tomato); }
    @keyframes tm-pulse { 50% { transform: scale(1.08); opacity: .7; } }
  `],
})
export class Scommessa {
  /** Fasi del gioco, disponibili anche nel template. */
  readonly ScommessaPhase = ScommessaPhase;

  @Input() displayData: any;
  @Input() timer = 0;

  levelLabel(level: number): string {
    if (level <= 100) return 'cauto';
    if (level <= 200) return 'deciso';
    if (level <= 300) return 'audace';
    if (level <= 400) return 'rischioso';
    return 'tutto';
  }

  /** Un livello è esaurito quando tutte le squadre lo hanno già usato. */
  allUsed(level: number): boolean {
    const rows = this.displayData?.rows ?? [];
    return rows.length > 0 && rows.every((row: any) => (row.used ?? []).includes(level));
  }

  signed(points: number | null | undefined): string {
    const value = Number(points) || 0;
    return value > 0 ? `+${value}` : `${value}`;
  }
}
