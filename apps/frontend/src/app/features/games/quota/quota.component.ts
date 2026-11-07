import { QuotaPhase } from './quota.mode';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV di AZZARDO (ex Quota): quattro manche numeriche, una per categoria.
 * Il mode manda lo stato già deciso: qui si disegna soltanto.
 */
@Component({
  selector: 'app-quota',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="az-wrap">
      <header class="az-head">
        <div class="az-kicker">📊 AZZARDO</div>
        <h2 class="az-title">
          @if (displayData?.phase === QuotaPhase.BET) { PUNTA SULLA RISPOSTA }
          @else if (displayData?.phase === QuotaPhase.REVEAL) { IL VALORE È }
          @else { CLASSIFICA DEL ROUND }
        </h2>
        <div class="az-meta">
          <span class="az-level">LIVELLO {{ displayData?.level ?? 1 }} · {{ levelLabel }} · ×{{ displayData?.odds ?? 2 }}</span>
          <span class="az-progress">MANCHE {{ displayData?.manche ?? 1 }} / {{ displayData?.total ?? 4 }}</span>
          <span class="az-timer" [class.hot]="(displayData?.secondsLeft ?? 0) <= 4">{{ displayData?.secondsLeft ?? 0 }}s</span>
        </div>
      </header>

      @if (displayData?.phase !== QuotaPhase.FINALE) {
        <div class="az-question">{{ displayData?.question }}</div>
        <div class="az-category">{{ displayData?.category || 'AZZARDO' }} · in {{ displayData?.unit }}</div>

        <div class="az-options">
          @for (option of displayData?.options ?? []; track $index; let i = $index) {
            <div class="az-option" [class.correct]="displayData?.phase === QuotaPhase.REVEAL && i === displayData?.answerIndex">
              <span class="az-letter">{{ letter(i) }}</span>
              <b class="az-number">{{ option }}</b>
            </div>
          }
        </div>

        @if (displayData?.phase === QuotaPhase.BET) {
          <p class="az-hint">
            Puntata 100, 200 o 300 punti reali: vince chi prende l'opzione giusta e incassa
            puntata × {{ displayData?.odds }}. Sbagliare costa il {{ lossPercent() }}% della puntata.
          </p>
          <div class="az-ready">
            @for (row of displayData?.ready ?? []; track row.playerName) {
              <span class="az-chip" [class.ok]="row.ready" [class.poor]="row.maxBet < 100">
                {{ row.playerName }}@if (row.ready) {<b> ✓</b>}
              </span>
            }
          </div>
        }

        @if (displayData?.phase === QuotaPhase.REVEAL) {
          <div class="az-value">VALORE: {{ displayData?.value }} {{ displayData?.unit }}</div>
          @if (displayData?.best; as best) {
            <div class="az-best">🎯 COLPO GROSSO: {{ best.playerName }} · +{{ best.points }}</div>
          }
          <div class="az-rows">
            @for (row of displayData?.rows ?? []; track row.playerName) {
              <div class="az-row" [class.paid]="row.points > 0" [class.lost]="row.points < 0">
                <span class="az-name">{{ row.playerName }}</span>
                <span class="az-pick">{{ row.played ? (row.stake + ' su ' + letter(row.choice)) : 'non gioca' }}</span>
                <b class="az-delta">{{ signed(row.points) }}</b>
                <span class="az-total">{{ row.total }}</span>
              </div>
            }
          </div>
        }
      } @else {
        <div class="az-rows">
          @for (row of displayData?.rows ?? []; track row.playerName; let i = $index) {
            <div class="az-row" [class.top]="i === 0">
              <span class="az-name">{{ i + 1 }}. {{ row.playerName }}</span>
              <span class="az-pick">quota ×{{ displayData?.odds }}</span>
              <b class="az-delta">{{ signed(row.total) }}</b>
              <span class="az-total">{{ row.total }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .az-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(8px, 1.5vh, 16px); padding: clamp(14px, 2vw, 28px); color: var(--paper); }
    .az-head { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
    .az-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .az-title { margin: 0; font-family: var(--font-display); font-size: clamp(1.3rem, 2.4vw, 2rem); font-weight: 400; line-height: .95; letter-spacing: .04em; text-transform: uppercase; }
    .az-meta { display: flex; align-items: center; gap: clamp(8px, 1.4vw, 18px); flex-wrap: wrap; justify-content: center; }
    .az-level { padding: 2px 8px; background: var(--mustard); color: var(--coal); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.58rem, .85vw, .74rem); font-weight: 800; letter-spacing: .12em; }
    .az-progress { color: var(--acid); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .78rem); font-weight: 700; letter-spacing: .16em; }
    .az-timer { font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.2rem); font-weight: 700; color: var(--acid); }
    .az-timer.hot { color: var(--tomato); animation: az-pulse .8s infinite; }
    .az-question { max-width: 1100px; font-family: var(--font-display); font-size: clamp(1.2rem, 2.7vw, 2.1rem); line-height: 1.15; text-align: center; }
    .az-category { padding: 2px 12px; border: 2px solid var(--coal); background: var(--acid); color: var(--coal); font-family: var(--font-mono); font-size: clamp(.58rem, .85vw, .74rem); font-weight: 700; letter-spacing: .1em; }
    .az-options { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(8px, 1.2vw, 16px); width: min(1180px, 96vw); }
    .az-option { display: flex; align-items: center; justify-content: center; gap: 10px; padding: clamp(12px, 2vw, 22px); background: var(--paper-hi); color: var(--coal); border: 3px solid var(--coal); box-shadow: 5px 5px 0 var(--coal); }
    .az-option.correct { background: var(--acid); box-shadow: 5px 5px 0 var(--tomato); }
    .az-letter { display: inline-flex; align-items: center; justify-content: center; width: clamp(24px, 2.4vw, 34px); height: clamp(24px, 2.4vw, 34px); background: var(--coal); color: var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.65rem, .9vw, .8rem); font-weight: 800; }
    .az-number { font-family: var(--font-display); font-size: clamp(1.2rem, 2.4vw, 2rem); line-height: 1; font-weight: 400; }
    .az-hint { max-width: 980px; margin: 0; color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.65rem, .95vw, .84rem); text-align: center; }
    .az-ready { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .az-chip { padding: 3px 10px; border: 2px solid var(--coal); background: var(--paper-hi); color: var(--coal); font-family: var(--font-mono); font-size: .72rem; font-weight: 700; opacity: .5; }
    .az-chip.ok { background: var(--acid); opacity: 1; }
    .az-chip.poor { border-style: dashed; }
    .az-value { padding: 6px 18px; background: var(--acid); color: var(--coal); border: 3px solid var(--coal); box-shadow: 5px 5px 0 var(--coal); font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.2rem); font-weight: 800; }
    .az-best { padding: 4px 14px; background: var(--paper-hi); color: var(--coal); border: 2px dashed var(--tomato); font-family: var(--font-mono); font-size: clamp(.7rem, 1vw, .9rem); font-weight: 700; }
    .az-rows { display: flex; flex-direction: column; gap: 6px; width: min(1020px, 94vw); }
    .az-row { display: grid; grid-template-columns: 1.4fr 1.1fr auto auto; gap: 12px; align-items: center; padding: 7px 14px; background: var(--paper-hi); color: var(--coal); border: 2px solid var(--coal); font-size: clamp(.8rem, 1.1vw, 1rem); }
    .az-row.top, .az-row.paid { background: var(--acid); }
    .az-row.lost { box-shadow: inset 4px 0 0 var(--tomato); }
    .az-pick { font-family: var(--font-mono); font-size: .8em; color: var(--ink-dim); }
    .az-delta { font-family: var(--font-mono); font-weight: 800; }
    .az-row.lost .az-delta { color: var(--tomato); }
    .az-total { font-family: var(--font-mono); font-weight: 700; }
    @keyframes az-pulse { 50% { transform: scale(1.08); opacity: .7; } }
  `],
})
export class Quota {
  /** Fasi del gioco, disponibili anche nel template. */
  readonly QuotaPhase = QuotaPhase;

  @Input() displayData: any;
  @Input() timer = 0;

  get levelLabel(): string {
    const level = Number(this.displayData?.level) || 1;
    if (level === 1) return 'FACILE';
    return level === 3 ? 'DIFFICILE' : 'MEDIA';
  }

  lossPercent(): number {
    return Math.round((Number(this.displayData?.lossMultiplier) || 1) * 100);
  }

  letter(index: number): string {
    return index < 0 ? '—' : String.fromCharCode(65 + index);
  }

  signed(points: number | null | undefined): string {
    const value = Number(points) || 0;
    return value > 0 ? `+${value}` : `${value}`;
  }
}
