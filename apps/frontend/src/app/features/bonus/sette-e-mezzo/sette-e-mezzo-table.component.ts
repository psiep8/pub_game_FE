import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  isMattaCard,
  shortRank,
  suitShort,
} from '../../games/sette-e-mezzo/sette-e-mezzo-game';
import { suitOf } from '../../games/sette-e-mezzo/sette-e-mezzo-rules';

/**
 * Tavolo TV del bonus Sette e Mezzo: banco, mano del tavolo chiamato e
 * tabellone delle mani. Non decide nulla: disegna lo stato pubblicato dal
 * componente bonus, che è l'unico proprietario di carte e turni.
 */
@Component({
  selector: 'app-sette-e-mezzo-table',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="st-shell">
      <header class="st-head">
        <span class="st-kicker">SETTE E MEZZO · BANCO A 7,25</span>
        <span class="st-hand" *ngIf="display?.total">
          TAVOLO {{ display?.index }} / {{ display?.total }}
        </span>
      </header>

      <section class="st-bank">
        <div class="st-side-label">BANCO</div>
        <div class="st-cards">
          @for (card of bankCards(); track $index) {
            <span class="st-card" [class.red]="isRed(card)">
              <b>{{ rank(card) }}</b>
              <small>{{ suit(card) }}</small>
            </span>
          }
        </div>
        <div class="st-total">
          {{ display?.bank?.hidden ? '—' : (display?.bank?.total ?? '—') }}
        </div>
      </section>

      <div class="st-center">
        @if (display?.phase === 'FINALE') {
          <span class="st-banner">BONUS CHIUSO</span>
        } @else if (display?.phase === 'REVEAL') {
          <span class="st-banner" [class.win]="display?.result?.outcome === 'WIN' || display?.result?.outcome === 'NATURAL'">
            {{ outcomeLabel(display?.result?.outcome) }}
          </span>
          <span class="st-meta">
            MANO {{ display?.result?.handTotal ?? '—' }} · BANCO {{ display?.result?.bankTotal ?? '—' }}
          </span>
        } @else {
          <span class="st-banner">{{ display?.currentTable || 'TAVOLO' }}</span>
          <span class="st-meta">CARTA O STAI · {{ display?.handTotal ?? 0 }} PUNTI</span>
        }
      </div>

      <section class="st-player">
        <div class="st-side-label">{{ display?.currentTable || 'TAVOLO' }}</div>
        <div class="st-cards">
          @for (card of display?.cards ?? []; track $index) {
            <span class="st-card" [class.red]="isRed(card)" [class.matta]="isMatta(card)">
              <b>{{ rank(card) }}</b>
              <small>{{ suit(card) }}</small>
            </span>
          }
        </div>
        <div class="st-total">{{ display?.handTotal ?? 0 }}</div>
      </section>

      <footer class="st-rows">
        @for (row of display?.rows ?? []; track row.playerName) {
          <div class="st-row" [class.active]="row.status === 'ACTIVE'" [class.win]="row.status === 'WIN' || row.status === 'NATURAL'" [class.bust]="row.status === 'BUST' || row.status === 'LOSE'">
            <span>{{ row.playerName }}</span>
            <b>{{ statusLabel(row.status) }}</b>
          </div>
        }
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .st-shell {
      display: flex;
      flex-direction: column;
      gap: clamp(8px, 1.2vh, 16px);
      width: min(1100px, 100%);
      margin: 0 auto;
      padding: clamp(10px, 1.6vw, 22px);
      border: 3px solid var(--ink);
      background: var(--paper);
      color: var(--ink);
      box-shadow: 6px 6px 0 var(--ink);
    }
    .st-head, .st-bank, .st-player, .st-center {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .st-head { justify-content: space-between; border-bottom: 2px solid var(--ink); padding-bottom: 6px; }
    .st-kicker, .st-hand, .st-meta, .st-side-label, .st-row, .st-total {
      font-family: var(--font-mono);
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .st-kicker { font-size: clamp(.65rem, 1vw, .85rem); font-weight: 700; }
    .st-hand { font-size: clamp(.6rem, .9vw, .75rem); }
    .st-bank, .st-player { justify-content: space-between; }
    .st-side-label { min-width: 7ch; font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; }
    .st-cards { display: flex; gap: 6px; flex: 1; min-height: 74px; }
    .st-card {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: clamp(42px, 5vw, 62px);
      height: clamp(62px, 8vh, 88px);
      border: 2px solid var(--ink);
      background: var(--paper-hi);
      box-shadow: 3px 3px 0 var(--ink);
      font-family: var(--font-mono);
    }
    .st-card b { font-size: clamp(1.1rem, 2vw, 1.6rem); line-height: 1; }
    .st-card small { font-size: clamp(.5rem, .8vw, .65rem); letter-spacing: .04em; }
    .st-card.red { color: var(--tomato); }
    .st-card.matta { border-color: var(--mustard); background: #fff6d6; }
    .st-card.hidden { background: var(--ink); color: var(--paper-hi); }
    .st-total {
      min-width: 8ch;
      text-align: right;
      font-size: clamp(1.4rem, 3vw, 2.4rem);
      font-weight: 700;
    }
    .st-center { flex-direction: column; justify-content: center; gap: 2px; border-block: 2px dashed var(--ink); padding: 6px 0; }
    .st-banner {
      font-family: var(--font-mono);
      font-size: clamp(.85rem, 1.5vw, 1.15rem);
      font-weight: 700;
      letter-spacing: .12em;
      text-transform: uppercase;
      padding: 3px 10px;
      border: 2px solid var(--ink);
      background: var(--mustard);
    }
    .st-banner.win { background: #bfe6b8; }
    .st-meta { font-size: clamp(.55rem, .85vw, .72rem); }
    .st-rows { display: flex; flex-wrap: wrap; gap: 6px; border-top: 2px solid var(--ink); padding-top: 6px; }
    .st-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      min-width: 12ch;
      padding: 3px 8px;
      border: 1px solid var(--ink);
      font-size: clamp(.55rem, .85vw, .7rem);
    }
    .st-row.active { background: var(--mustard); }
    .st-row.win { background: #bfe6b8; }
    .st-row.bust { opacity: .55; }
    @media (max-width: 640px) {
      .st-bank, .st-player { flex-wrap: wrap; }
      .st-total { min-width: 0; }
    }
  `],
})
export class SetteEMezzoTable {
  @Input({ required: true }) display: any = null;

  rank(card: string): string {
    return shortRank(card);
  }

  suit(card: string): string {
    return suitShort(card);
  }

  isRed(card: string): boolean {
    const suit = suitOf(card);
    return suit === 'DENARI' || suit === 'COPPE';
  }

  isMatta(card: string): boolean {
    return isMattaCard(card);
  }

  /** Il banco mostra solo la prima carta finché non si apre. */
  bankCards(): string[] {
    const cards: string[] = this.display?.bank?.cards ?? [];
    return this.display?.bank?.hidden ? cards.slice(0, 1) : cards;
  }

  outcomeLabel(outcome: string | undefined): string {
    switch (outcome) {
      case 'WIN': return 'BANCO BATTUTO';
      case 'NATURAL': return 'NATURALE';
      case 'BUST': return 'SBALLATO';
      case 'LOSE': return 'VINCE IL BANCO';
      default: return 'MANO CHIUSA';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'WIN': return 'VINTA';
      case 'NATURAL': return 'NATURALE';
      case 'BUST': return 'SBALLATO';
      case 'LOSE': return 'PERSA';
      case 'ACTIVE': return 'AL BANCO';
      default: return 'ATTENDE';
    }
  }
}
