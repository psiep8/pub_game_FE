import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV del round BLACK JACK: il tavolo di turno contro un banco nuovo.
 * Il mode manda lo stato già deciso: qui si disegna soltanto.
 */
@Component({
  selector: 'app-blackjack',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="bj-wrap">
      <header class="bj-head">
        <div class="bj-kicker">🃏 BLACK JACK</div>
        <h2 class="bj-title">CONTRO IL BANCO</h2>
        <div class="bj-meta">
          <span class="bj-progress">TAVOLO {{ displayData?.index ?? 0 }} / {{ displayData?.total ?? 0 }}</span>
          <span class="bj-timer" [class.hot]="(displayData?.secondsLeft ?? 0) <= 4">{{ displayData?.secondsLeft ?? 0 }}s</span>
        </div>
      </header>

      @if (displayData?.phase === 'FINALE') {
        <div class="bj-final">
          <div class="bj-final-title">BANCO CHIUSO</div>
          <div class="bj-final-rows">
            @for (row of displayData?.rows ?? []; track row.playerName) {
              <div class="bj-final-row" [class.paid]="row.points > 0">
                <span>{{ row.playerName }}</span>
                <b>{{ row.points > 0 ? '+' + row.points : '0' }}</b>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="bj-table">
          <section class="bj-side bank">
            <span class="bj-label">IL BANCO</span>
            <div class="bj-cards">
              @for (card of displayData?.bank?.cards ?? []; track $index) {
                <span class="bj-card" [class.red]="isRed(card)">
                  <span class="bj-rank">{{ rank(card) }}</span>
                  <span class="bj-suit">{{ suit(card) }}</span>
                </span>
              }
              @if (displayData?.bank?.hidden) {
                <span class="bj-card back">?</span>
              }
            </div>
            <b class="bj-total">{{ displayData?.bank?.hidden ? '?' : (displayData?.bank?.total ?? '—') }}</b>
          </section>

          <section
            class="bj-side table"
            [class.won]="(displayData?.result?.points ?? 0) > 0"
            [class.lost]="displayData?.result && (displayData?.result?.points ?? 0) === 0">
            <span class="bj-label">{{ displayData?.currentTable || 'IN ATTESA' }}</span>
            <div class="bj-cards">
              @for (card of displayData?.cards ?? []; track $index) {
                <span class="bj-card" [class.red]="isRed(card)">
                  <span class="bj-rank">{{ rank(card) }}</span>
                  <span class="bj-suit">{{ suit(card) }}</span>
                </span>
              }
              @if (!(displayData?.cards ?? []).length) {
                <span class="bj-card back">?</span>
                <span class="bj-card back">?</span>
              }
            </div>
            <b class="bj-total" [class.bust]="(displayData?.handTotal ?? 0) > 21">
              {{ (displayData?.cards ?? []).length ? (displayData?.handTotal ?? 0) : '—' }}
            </b>
          </section>
        </div>

        <div class="bj-call">
          @if (displayData?.phase === 'DECIDE') {
            <span class="bj-hint">{{ displayData?.choice === 'HIT' ? 'CARTA CHIESTA' : 'CARTA O STAI?' }}</span>
          } @else if (displayData?.result; as result) {
            <span class="bj-outcome" [class.good]="result.points > 0" [class.bad]="result.points === 0">
              {{ outcomeLabel(result.outcome) }}
            </span>
            <span class="bj-bank-total">BANCO {{ result.bankTotal }}</span>
            <span class="bj-points">{{ result.points > 0 ? '+' + result.points : '0' }}</span>
          }
        </div>

        <div class="bj-strip">
          @for (row of displayData?.rows ?? []; track row.playerName) {
            <div class="bj-chip" [class.active]="row.status === 'ACTIVE'" [class.paid]="row.points > 0">
              <span class="bj-chip-name">{{ row.playerName }}</span>
              <span class="bj-chip-status">{{ statusLabel(row.status) }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .bj-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(8px, 1.6vh, 18px); padding: clamp(14px, 2vw, 28px); color: var(--paper); }
    .bj-head { display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; }
    .bj-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .bj-title { margin: 0; font-family: var(--font-display); font-size: clamp(1.3rem, 2.4vw, 2rem); font-weight: 400; line-height: .95; letter-spacing: .04em; text-transform: uppercase; }
    .bj-meta { display: flex; align-items: center; gap: 16px; }
    .bj-progress { color: var(--acid); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .78rem); font-weight: 700; letter-spacing: .16em; }
    .bj-timer { font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.2rem); font-weight: 700; color: var(--acid); }
    .bj-timer.hot { color: var(--tomato); animation: bj-pulse .8s infinite; }
    .bj-table { display: flex; align-items: stretch; justify-content: center; gap: clamp(12px, 2vw, 30px); width: min(1180px, 96vw); }
    .bj-side { flex: 1; display: flex; flex-direction: column; align-items: center; gap: clamp(6px, 1vh, 12px); padding: clamp(10px, 1.6vw, 20px); background: var(--paper-hi); color: var(--coal); border: 3px solid var(--coal); box-shadow: 6px 6px 0 var(--coal); }
    .bj-side.bank { box-shadow: 6px 6px 0 var(--tomato); }
    .bj-side.table.won { background: var(--acid); box-shadow: 6px 6px 0 var(--coal); }
    .bj-side.table.lost { opacity: .85; }
    .bj-label { font-family: var(--font-mono); font-size: clamp(.62rem, .9vw, .8rem); font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .bj-cards { display: flex; gap: clamp(4px, .6vw, 10px); flex-wrap: wrap; justify-content: center; min-height: clamp(74px, 11vh, 118px); align-items: center; }
    .bj-card { display: inline-flex; flex-direction: column; justify-content: space-between; width: clamp(54px, 5.6vw, 82px); height: clamp(74px, 8vw, 116px); padding: clamp(4px, .5vw, 8px); background: var(--paper-hi); color: var(--coal); border: 3px solid var(--coal); border-radius: 6px; font-family: var(--font-mono); font-weight: 800; }
    .bj-card.red { color: var(--tomato); }
    .bj-card.back { align-items: center; justify-content: center; background: repeating-linear-gradient(45deg, var(--coal), var(--coal) 6px, #3b3b3b 6px, #3b3b3b 12px); color: var(--paper-hi); font-size: clamp(1.2rem, 2vw, 1.8rem); }
    .bj-rank { font-size: clamp(1rem, 1.8vw, 1.6rem); line-height: 1; }
    .bj-suit { align-self: flex-end; font-size: clamp(1rem, 1.7vw, 1.5rem); line-height: 1; }
    .bj-total { font-family: var(--font-display); font-size: clamp(1.6rem, 3vw, 2.6rem); line-height: 1; }
    .bj-total.bust { color: var(--tomato); }
    .bj-call { display: flex; align-items: center; gap: clamp(10px, 1.6vw, 22px); min-height: clamp(34px, 5vh, 54px); }
    .bj-hint { font-family: var(--font-mono); font-size: clamp(.7rem, 1vw, .9rem); letter-spacing: .18em; color: var(--paper); opacity: .8; }
    .bj-outcome { padding: 4px 14px; font-family: var(--font-display); font-size: clamp(1rem, 1.8vw, 1.5rem); letter-spacing: .06em; border: 3px solid var(--coal); }
    .bj-outcome.good { background: var(--acid); color: var(--coal); }
    .bj-outcome.bad { background: var(--tomato); color: var(--paper-hi); }
    .bj-bank-total { font-family: var(--font-mono); font-size: clamp(.7rem, 1vw, .9rem); letter-spacing: .14em; opacity: .8; }
    .bj-points { font-family: var(--font-mono); font-size: clamp(1rem, 1.6vw, 1.4rem); font-weight: 800; color: var(--acid); }
    .bj-strip { display: flex; flex-wrap: wrap; gap: clamp(4px, .7vw, 10px); justify-content: center; width: min(1180px, 96vw); }
    .bj-chip { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: clamp(76px, 8vw, 120px); padding: 4px 8px; background: rgba(255, 255, 255, .08); border: 2px solid rgba(255, 255, 255, .16); }
    .bj-chip.active { background: var(--paper-hi); border-color: var(--coal); color: var(--coal); }
    .bj-chip.paid { background: var(--acid); border-color: var(--coal); color: var(--coal); }
    .bj-chip-name { font-family: var(--font-mono); font-size: clamp(.58rem, .8vw, .72rem); font-weight: 700; letter-spacing: .06em; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bj-chip-status { font-family: var(--font-mono); font-size: clamp(.5rem, .7vw, .62rem); letter-spacing: .12em; opacity: .8; }
    .bj-final { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .bj-final-title { font-family: var(--font-display); font-size: clamp(1.4rem, 2.6vw, 2.2rem); letter-spacing: .08em; }
    .bj-final-rows { display: flex; flex-direction: column; gap: 5px; width: min(760px, 92vw); }
    .bj-final-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 14px; background: var(--paper-hi); color: var(--coal); border: 2px solid var(--coal); font-size: clamp(.8rem, 1.1vw, 1rem); }
    .bj-final-row.paid { background: var(--acid); }
    @keyframes bj-pulse { 50% { transform: scale(1.08); opacity: .7; } }
  `],
})
export class Blackjack {
  @Input() displayData: any;
  @Input() timer = 0;

  rank(card: string): string {
    return String(card ?? '').slice(0, -1);
  }

  suit(card: string): string {
    return String(card ?? '').slice(-1);
  }

  isRed(card: string): boolean {
    const value = String(card ?? '');
    return value.includes('♥') || value.includes('♦');
  }

  outcomeLabel(outcome: string | null | undefined): string {
    switch (outcome) {
      case 'WIN':
        return 'VINCE';
      case 'PUSH':
        return 'PARI';
      case 'BLACKJACK':
        return 'BLACK JACK!';
      case 'BUST':
        return 'SBALLA';
      case 'LOSE':
        return 'PERDE';
      default:
        return '';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'AL BANCO';
      case 'WIN':
        return 'VINCE';
      case 'PUSH':
        return 'PARI';
      case 'BLACKJACK':
        return 'BLACK JACK';
      case 'BUST':
        return 'SBALLA';
      case 'LOSE':
        return 'PERDE';
      default:
        return 'IN ATTESA';
    }
  }
}
