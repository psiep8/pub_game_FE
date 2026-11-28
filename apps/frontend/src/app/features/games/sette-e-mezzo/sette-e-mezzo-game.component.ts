import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import {
  SetteEMezzoGame,
  isMattaCard as isMatta,
  shortRank as toShortRank,
  suitShort as toSuitShort,
} from './sette-e-mezzo-game';
import { cardValue, suitOf as cardSuit } from './sette-e-mezzo-rules';

/**
 * Sette e Mezzo giocabile, con il manuale in pagina.
 *
 * <p>È una scena autonoma: mazzo, banco e cinque mani vivono nel motore puro
 * `SetteEMezzoGame`, qui si disegna e si aspetta il tocco. Il tavolo non ha
 * timer: si gioca con calma, come al bar.</p>
 */
@Component({
  selector: 'app-sette-e-mezzo-game',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="head">
        <a class="back" href="/tv">← TORNA ALLA TV</a>
        <div class="kicker">GIOCO DI CARTE · MANUALE INCLUSO</div>
        <h1>SETTE E MEZZO</h1>
        <p class="sub">Mazzo napoletano da 40 carte. Cinque mani contro il banco, matta compresa.</p>
      </header>

      <div class="score-strip">
        <div class="score-cell">
          <span class="score-key">MANO</span>
          <b>{{ state().handNumber }} / {{ state().hands }}</b>
        </div>
        <div class="score-cell accent">
          <span class="score-key">PUNTI</span>
          <b>{{ state().score }}</b>
        </div>
        <div class="score-cell">
          <span class="score-key">OBIETTIVO</span>
          <b>{{ fmt(state().target) }}</b>
        </div>
        <div class="score-cell">
          <span class="score-key">BANCO FERMO A</span>
          <b>{{ fmt(state().bankThreshold) }}</b>
        </div>
      </div>

      <section class="table" aria-label="Tavolo di Sette e Mezzo">
        <div class="side bank">
          <div class="side-head">
            <span class="side-label">IL BANCO</span>
            <span class="side-tag">PESCA SOTTO {{ fmt(state().bankThreshold) }}</span>
          </div>
          <div class="cards">
            @for (card of state().bank; track $index) {
              <div class="card" [class.denari]="suitOf(card) === 'DENARI'" [class.coppe]="suitOf(card) === 'COPPE'"
                   [class.bastoni]="suitOf(card) === 'BASTONI'" [class.matta]="isMattaCard(card)">
                <span class="rank">{{ shortRank(card) }}</span>
                <span class="suit">{{ suitShort(card) }}</span>
                <span class="value">{{ valueLabel(card) }}</span>
              </div>
            }
            @if (state().bankHidden) {
              <div class="card back" aria-label="Carta coperta">?</div>
            }
          </div>
          <div class="total">
            <span>TOTALE BANCO</span>
            <b>{{ state().bankHidden ? '?' : fmt(state().bankTotal) }}</b>
          </div>
        </div>

        <div class="side player" [class.won]="isWin(state().result?.outcome)" [class.lost]="isLoss(state().result?.outcome)">
          <div class="side-head">
            <span class="side-label">LA TUA MANO</span>
            <span class="side-tag">{{ state().score }} PT IN BACHECA</span>
          </div>
          <div class="cards">
            @for (card of state().player; track $index) {
              <div class="card" [class.denari]="suitOf(card) === 'DENARI'" [class.coppe]="suitOf(card) === 'COPPE'"
                   [class.bastoni]="suitOf(card) === 'BASTONI'" [class.matta]="isMattaCard(card)">
                <span class="rank">{{ shortRank(card) }}</span>
                <span class="suit">{{ suitShort(card) }}</span>
                <span class="value">{{ valueLabel(card) }}</span>
              </div>
            }
          </div>
          <div class="total">
            <span>TOTALE MANO</span>
            <b [class.bust]="state().playerTotal > state().target">{{ fmt(state().playerTotal) }}</b>
          </div>
        </div>
      </section>

      @if (state().result; as result) {
        <div class="verdict" [class.good]="isWin(result.outcome)" [class.bad]="isLoss(result.outcome)">
          <span class="verdict-stamp">{{ outcomeLabel(result.outcome) }}</span>
          <span class="verdict-text">
            Mano {{ fmt(result.playerTotal) }} · banco {{ fmt(result.bankTotal) }}
          </span>
          <span class="verdict-points" [class.neg]="result.points < 0">{{ pointsLabel(result.points) }} PT</span>
        </div>
      } @else {
        <div class="verdict idle">
          <span class="verdict-stamp">TOCCA A TE</span>
          <span class="verdict-text">Pesca una carta o fermati: il banco gioca da solo.</span>
        </div>
      }

      <div class="actions">
        @if (state().phase === 'PLAY') {
          <button type="button" class="btn primary" (click)="hit()">CARTA</button>
          <button type="button" class="btn" (click)="stand()">STAI</button>
        } @else if (state().phase === 'REVEAL') {
          <button type="button" class="btn primary" (click)="next()">
            {{ state().handIndex + 1 >= state().hands ? 'VEDI IL RISULTATO' : 'MANO SUCCESSIVA' }}
          </button>
        } @else {
          <button type="button" class="btn primary" (click)="reset()">NUOVA PARTITA</button>
        }
      </div>

      <section class="manual" aria-labelledby="manual-title">
        <div class="manual-head">
          <span class="kicker">IL MANUALE DEL TAVOLO</span>
          <h2 id="manual-title">COME SI GIOCA</h2>
        </div>
        <div class="manual-grid">
          <article class="rule">
            <h3>OBIETTIVO</h3>
            <p>Avvicinarsi a <b>7,5</b> senza superarlo. Chi va oltre <b>sballa</b> e perde la mano.</p>
          </article>
          <article class="rule">
            <h3>VALORI</h3>
            <p>Asso <b>1</b>; carte da 2 a 7 il <b>valore stampato</b>; Fante, Cavallo e Re <b>0,5</b>.</p>
          </article>
          <article class="rule matta-rule">
            <h3>LA MATTA</h3>
            <p>Il <b>Re di denari</b> vale <b>1 o 0,5</b>, sempre nel modo che avvicina di più la mano a 7,5 senza sballare.</p>
          </article>
          <article class="rule">
            <h3>IL BANCO</h3>
            <p>Pesca finché sta sotto <b>7,25</b>, poi si ferma. Il <b>pareggio vince al banco</b>.</p>
          </article>
          <article class="rule">
            <h3>NATURALE</h3>
            <p><b>7 + figura</b> in due carte: la mano chiude subito e paga <b>+500</b>, salvo naturale del banco.</p>
          </article>
          <article class="rule">
            <h3>PUNTI</h3>
            <p>Vittoria <b>+250</b>; naturale <b>+500</b>; sconfitta <b>−250</b>, mai sotto zero. Si giocano <b>cinque mani</b>.</p>
          </article>
        </div>
      </section>
    </main>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--bg-0); color: var(--paper); }
    .page { width: min(1240px, 96vw); margin: 0 auto; padding: clamp(16px, 3vh, 34px) 0 clamp(30px, 6vh, 64px); display: flex; flex-direction: column; gap: clamp(12px, 2vh, 22px); }
    .head { position: relative; display: flex; flex-direction: column; gap: 6px; }
    .back { position: absolute; top: 0; right: 0; color: var(--paper); font-family: var(--font-mono); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-decoration: none; border-bottom: 2px solid var(--tomato); padding-bottom: 2px; }
    .kicker { color: var(--acid); font-family: var(--font-mono); font-size: clamp(11px, 1.4vh, 14px); font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
    h1 { margin: 0; color: var(--paper); font-family: var(--font-display); font-size: clamp(2.4rem, 8vw, 5.4rem); font-weight: 400; line-height: .9; letter-spacing: .02em; text-transform: uppercase; text-shadow: 5px 5px 0 var(--tomato); }
    .sub { margin: 2px 0 0; max-width: 62ch; color: var(--paper-2); font-family: var(--font); font-size: clamp(14px, 1.8vh, 18px); line-height: 1.35; }
    .score-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .score-cell { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; background: var(--bg-1); border: 3px solid var(--paper); box-shadow: 4px 4px 0 var(--coal); }
    .score-cell.accent { background: var(--acid); color: var(--coal); border-color: var(--coal); box-shadow: 4px 4px 0 var(--paper); }
    .score-key { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: .14em; opacity: .75; }
    .score-cell b { font-family: var(--font-mono); font-size: clamp(16px, 2.4vh, 24px); font-weight: 800; }
    .table { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(12px, 2vw, 24px); }
    .side { display: flex; flex-direction: column; gap: 10px; padding: clamp(12px, 2vh, 20px); background: var(--bg-1); border: 3px solid var(--paper); box-shadow: 8px 8px 0 var(--coal); }
    .side.bank { box-shadow: 8px 8px 0 var(--tomato); }
    .side.player { background: var(--paper); color: var(--coal); border-color: var(--coal); box-shadow: 8px 8px 0 var(--mustard); }
    .side.player.won { background: var(--acid); }
    .side.player.lost { background: var(--paper-2); }
    .side-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .side-label { font-family: var(--font-display); font-size: clamp(18px, 2.8vh, 26px); letter-spacing: .04em; text-transform: uppercase; }
    .side-tag { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: .1em; opacity: .7; }
    .cards { display: flex; flex-wrap: wrap; gap: clamp(8px, 1vw, 14px); min-height: clamp(126px, 19vh, 172px); align-items: center; }
    .card { position: relative; display: flex; flex-direction: column; justify-content: space-between; width: clamp(74px, 8vw, 104px); height: clamp(112px, 12vw, 150px); padding: 7px 8px; background: var(--paper-hi); color: var(--coal); border: 3px solid var(--coal); border-radius: 0; box-shadow: 5px 5px 0 var(--coal); font-family: var(--font-mono); font-weight: 800; }
    .card.denari { box-shadow: 5px 5px 0 var(--mustard); }
    .card.coppe { box-shadow: 5px 5px 0 var(--tomato); }
    .card.bastoni { box-shadow: 5px 5px 0 var(--cobalt); }
    .card.matta { background: var(--mustard); }
    .card .rank { font-family: var(--font-display); font-size: clamp(24px, 3.4vh, 38px); line-height: .9; }
    .card .suit { align-self: flex-end; font-size: clamp(12px, 1.6vh, 16px); letter-spacing: .08em; }
    .card .value { position: absolute; left: 8px; bottom: 7px; font-size: 12px; font-weight: 700; opacity: .7; }
    .card.back { align-items: center; justify-content: center; background: repeating-linear-gradient(45deg, var(--coal), var(--coal) 7px, var(--coal-2) 7px, var(--coal-2) 14px); color: var(--paper-hi); font-family: var(--font-display); font-size: 34px; }
    .total { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; border-top: 2px solid currentColor; padding-top: 6px; font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: .12em; opacity: .85; }
    .total b { font-family: var(--font-display); font-size: clamp(28px, 4.4vh, 44px); font-weight: 400; letter-spacing: .02em; opacity: 1; }
    .total b.bust { color: var(--tomato); }
    .verdict { display: flex; align-items: center; gap: clamp(10px, 1.6vw, 20px); flex-wrap: wrap; padding: 10px 14px; background: var(--bg-1); border: 3px solid var(--paper); box-shadow: 5px 5px 0 var(--coal); }
    .verdict.good { background: var(--acid); color: var(--coal); border-color: var(--coal); box-shadow: 5px 5px 0 var(--paper); }
    .verdict.bad { background: var(--tomato); color: var(--paper-hi); border-color: var(--coal); }
    .verdict.idle { opacity: .9; }
    .verdict-stamp { font-family: var(--font-display); font-size: clamp(18px, 2.6vh, 26px); letter-spacing: .04em; text-transform: uppercase; }
    .verdict-text { font-family: var(--font-mono); font-size: 12px; font-weight: 700; letter-spacing: .06em; }
    .verdict-points { margin-left: auto; font-family: var(--font-mono); font-size: clamp(16px, 2.2vh, 22px); font-weight: 800; }
    .verdict-points.neg { color: var(--tomato); }
    .verdict.good .verdict-points.neg { color: var(--coal); }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn { min-width: 150px; padding: 12px 22px; background: var(--paper); color: var(--coal); border: 4px solid var(--coal); border-radius: 0; box-shadow: 6px 6px 0 var(--coal); font-family: var(--font-display); font-size: clamp(18px, 2.4vh, 24px); letter-spacing: .06em; text-transform: uppercase; cursor: pointer; }
    .btn.primary { background: var(--acid); box-shadow: 6px 6px 0 var(--tomato); }
    .btn:active { transform: translate(3px, 3px); box-shadow: 2px 2px 0 var(--coal); }
    .manual { margin-top: clamp(10px, 2vh, 20px); display: flex; flex-direction: column; gap: 12px; }
    .manual-head { display: flex; flex-direction: column; gap: 4px; }
    .manual-head h2 { margin: 0; font-family: var(--font-display); font-size: clamp(26px, 4vh, 40px); font-weight: 400; line-height: 1; text-transform: uppercase; text-shadow: 3px 3px 0 var(--cobalt); }
    .manual-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .rule { padding: 12px 14px; background: var(--paper); color: var(--coal); border: 3px solid var(--coal); box-shadow: 5px 5px 0 var(--coal); }
    .rule.matta-rule { background: var(--mustard); }
    .rule h3 { margin: 0 0 5px; font-family: var(--font-mono); font-size: 12px; font-weight: 800; letter-spacing: .14em; }
    .rule p { margin: 0; font-size: clamp(13px, 1.6vh, 16px); line-height: 1.35; }
    .rule b { font-family: var(--font-mono); }
    @media (max-width: 900px) {
      .score-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .table { grid-template-columns: 1fr; }
      .manual-grid { grid-template-columns: 1fr 1fr; }
      .back { position: static; align-self: flex-start; margin-bottom: 4px; }
    }
    @media (max-width: 560px) {
      .manual-grid { grid-template-columns: 1fr; }
      .btn { flex: 1; min-width: 0; }
    }
  `],
})
export class SetteEMezzoGameComponent {
  private game = new SetteEMezzoGame();
  readonly state = signal(this.game.snapshot());

  hit(): void {
    this.game.hit();
    this.sync();
  }

  stand(): void {
    this.game.stand();
    this.sync();
  }

  next(): void {
    this.game.next();
    this.sync();
  }

  reset(): void {
    this.game.reset();
    this.sync();
  }

  fmt(value: number | null | undefined): string {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return String(Number(number.toFixed(2))).replace('.', ',');
  }

  valueLabel(card: string): string {
    if (this.isMattaCard(card)) return '½/1';
    const value = cardValue(card);
    return value === 0.5 ? '½' : String(value);
  }

  outcomeLabel(outcome: string | null | undefined): string {
    switch (outcome) {
      case 'WIN':
        return 'VINCE';
      case 'NATURAL':
        return 'NATURALE';
      case 'BUST':
        return 'SBALLA';
      case 'LOSE':
        return 'PERDE';
      default:
        return '';
    }
  }

  isWin(outcome: string | null | undefined): boolean {
    return outcome === 'WIN' || outcome === 'NATURAL';
  }

  isLoss(outcome: string | null | undefined): boolean {
    return outcome === 'BUST' || outcome === 'LOSE';
  }

  pointsLabel(points: number): string {
    return points > 0 ? `+${points}` : `${points}`;
  }

  shortRank(card: string): string {
    return toShortRank(card);
  }

  suitShort(card: string): string {
    return toSuitShort(card);
  }

  suitOf(card: string): string {
    return cardSuit(card);
  }

  isMattaCard(card: string): boolean {
    return isMatta(card);
  }

  private sync(): void {
    this.state.set(this.game.snapshot());
  }
}
