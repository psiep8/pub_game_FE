import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV di Quanto costa: tre oggetti affiancati, stime in diretta e reveal con
 * eliminazione progressiva. I prezzi arrivano solo al reveal dal server.
 */
@Component({
  selector: 'app-price',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="price-wrap">
      <header class="pr-head">
        <div class="pr-kicker">💶 QUANTO COSTA?</div>
        <h2 class="pr-title">Indovina il prezzo di tre oggetti</h2>
        <div class="pr-timer" [class.hot]="timer <= 10">{{ timer }}s</div>
      </header>

      <div class="pr-items" [class.revealed]="!!displayData?.reveal">
        @for (item of cards(); track item.name; let i = $index) {
          <article class="pr-card" [class.gone]="isEliminated(i)">
            <div class="pr-emoji">{{ item.emoji }}</div>
            <div class="pr-name">{{ item.name }}</div>
            <div class="pr-category">{{ item.category }}</div>

            @if (item.price) {
              <div class="pr-price">{{ item.price | number:'1.0-2' }} €</div>
              @if (item.source) { <div class="pr-source">fonte: {{ item.source }}</div> }
              @if (item.eliminated) {
                <div class="pr-out">🚫 {{ item.eliminated }} eliminato</div>
              }
            } @else {
              <div class="pr-live">{{ estimateCount() }} stime ricevute</div>
            }
          </article>
        }
      </div>

      @if (!displayData?.reveal) {
        <p class="pr-hint">
          Sul telefono hai 3 riquadri: scrivi una stima per ognuno e invia.
          <b>Il peggiore di ogni oggetto viene eliminato.</b>
        </p>
      } @else {
        <div class="pr-survivors">
          <div class="pr-survivors-title">SUPERSTITI · PUNTI PER VICINANZA</div>
          <div class="pr-survivors-list">
            @for (row of displayData?.reveal?.results; track row.playerName) {
              <div class="pr-row" [class.winner]="row.survivor && $index === 0" [class.out]="!row.survivor">
                <span class="pr-rank">{{ $index + 1 }}</span>
                <span class="pr-player">{{ row.playerName }}</span>
                <span class="pr-error">scarto {{ row.totalError }}</span>
                <span class="pr-score">{{ row.survivor ? '+' + row.score : 'fuori' }}</span>
              </div>
            } @empty {
              <div class="pr-empty">Nessuna stima ricevuta</div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .price-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(10px, 1.6vh, 20px); padding: clamp(12px, 2vw, 28px); color: var(--paper); }
    .pr-head { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
    .pr-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .pr-title { margin: 0; font-family: var(--font-display); font-size: clamp(1.4rem, 3vw, 2.7rem); font-weight: 400; line-height: .95; letter-spacing: .02em; text-transform: uppercase; }
    .pr-timer { font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.25rem); font-weight: 700; color: var(--acid); }
    .pr-timer.hot { color: var(--tomato); animation: pr-pulse .8s infinite; }
    .pr-items { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(10px, 1.6vw, 22px); width: min(1500px, 96vw); }
    .pr-card { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: clamp(190px, 30vh, 320px); padding: clamp(12px, 2vh, 24px) clamp(10px, 1.2vw, 18px); background: var(--paper); color: var(--coal); border: 3px solid var(--coal); border-top: 9px solid var(--acid); border-radius: 0; box-shadow: 8px 8px 0 var(--tomato); transition: transform .3s, opacity .3s; }
    .pr-card:nth-child(2) { border-top-color: var(--mustard); }
    .pr-card:nth-child(3) { border-top-color: var(--cobalt); }
    .pr-card.gone { opacity: .38; filter: grayscale(.7); transform: translateY(8px); }
    .pr-emoji { font-size: clamp(2.4rem, 5vw, 4.4rem); line-height: 1; }
    .pr-name { font-family: var(--font); font-size: clamp(1rem, 1.8vw, 1.65rem); font-weight: 800; line-height: 1.12; text-align: center; color: var(--coal); }
    .pr-category { color: var(--tomato); font-family: var(--font-mono); font-size: clamp(.52rem, .75vw, .68rem); font-weight: 700; letter-spacing: .1em; text-align: center; text-transform: uppercase; }
    .pr-price { margin-top: 6px; padding: 2px 10px; background: var(--acid); border: 2px solid var(--coal); box-shadow: 3px 3px 0 var(--tomato); font-family: var(--font-mono); font-size: clamp(1.35rem, 2.5vw, 2.3rem); font-weight: 700; letter-spacing: -.05em; color: var(--coal); }
    .pr-source { color: rgba(21, 21, 15, .55); font-family: var(--font-mono); font-size: clamp(.5rem, .7vw, .64rem); }
    .pr-live { margin-top: 8px; padding: 5px 10px; background: var(--paper-hi); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.62rem, .85vw, .78rem); color: var(--coal); }
    .pr-out { margin-top: 6px; padding: 3px 8px; background: var(--tomato); color: var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.6rem, .85vw, .8rem); font-weight: 700; transform: rotate(-1.5deg); }
    .pr-hint { max-width: 900px; margin: 0; color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.66rem, .95vw, .86rem); text-align: center; }
    .pr-hint b { color: var(--acid); }
    .pr-survivors { width: min(1100px, 94vw); display: flex; flex-direction: column; gap: 8px; }
    .pr-survivors-title { text-align: center; color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.55rem, .8vw, .72rem); font-weight: 700; letter-spacing: .16em; }
    .pr-survivors-list { display: flex; flex-direction: column; gap: 7px; max-height: 26vh; overflow: auto; padding: 2px 6px 6px 2px; }
    .pr-row { display: grid; grid-template-columns: 34px 1fr auto auto; gap: 12px; align-items: center; padding: clamp(6px, 1vh, 10px) clamp(10px, 1.4vw, 18px); background: var(--paper-hi); color: var(--coal); border: 2px solid var(--coal); border-radius: 0; box-shadow: 4px 4px 0 var(--coal); font-size: clamp(.75rem, 1vw, .96rem); }
    .pr-row.winner { background: var(--acid); box-shadow: 5px 5px 0 var(--tomato); }
    .pr-row.out { opacity: .55; }
    .pr-rank { color: var(--tomato); font-family: var(--font-mono); font-weight: 700; text-align: center; }
    .pr-player { font-weight: 800; }
    .pr-error { color: rgba(21, 21, 15, .58); font-family: var(--font-mono); font-size: .8em; }
    .pr-score { color: var(--coal); font-family: var(--font-mono); font-weight: 700; }
    .pr-row.out .pr-score { color: var(--tomato); font-size: .8em; }
    .pr-empty { text-align: center; color: var(--ink-dim); font-family: var(--font-mono); }
    @keyframes pr-pulse { 50% { transform: scale(1.08); opacity: .7; } }
    @media (max-width: 900px) { .pr-items { grid-template-columns: 1fr; } .pr-card { min-height: 0; flex-direction: row; justify-content: flex-start; gap: 14px; text-align: left; border-top-width: 3px; border-left: 8px solid var(--acid); } .pr-name, .pr-category { text-align: left; } }
  `]
})
export class Price {
  @Input() displayData: any;
  @Input() timer = 0;

  cards(): any[] {
    const reveal = this.displayData?.reveal;
    return reveal?.items?.length ? reveal.items : (this.displayData?.items ?? []);
  }

  estimateCount(): number {
    return (this.displayData?.guesses ?? []).length;
  }

  isEliminated(index: number): boolean {
    return !!this.cards()[index]?.eliminated;
  }
}
