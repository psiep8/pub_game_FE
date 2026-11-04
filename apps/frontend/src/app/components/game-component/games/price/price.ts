import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV di Quanto costa: una manche per oggetto, stime dei superstiti e prezzo
 * mostrato solo dopo il reveal. Gli eliminati restano segnati a lato.
 */
@Component({
  selector: 'app-price',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="price-wrap">
      <header class="pr-head">
        <div class="pr-kicker">💶 QUANTO COSTA?</div>
        <h2 class="pr-title">
          @if (displayData?.total) { MANCHE {{ displayData?.manche }} / {{ displayData?.total }} }
          @else { INDOVINA IL PREZZO }
        </h2>
        <div class="pr-timer" [class.hot]="timer <= 10">{{ timer }}s</div>
      </header>

      <div class="pr-stage">
        @if (displayData?.item; as item) {
          <article class="pr-card">
            <div class="pr-emoji">{{ item.emoji }}</div>
            <div class="pr-name">{{ item.name }}</div>
            <div class="pr-category">{{ item.category }}</div>

            @if (displayData?.reveal?.price) {
              <div class="pr-price">{{ displayData.reveal.price | number:'1.0-2' }} €</div>
            } @else {
              <div class="pr-live">{{ displayData?.guesses?.length || 0 }} stime ricevute</div>
            }
          </article>

          <div class="pr-side">
            @if (!displayData?.reveal) {
              <div class="pr-side-title">STIME</div>
              <div class="pr-guesses">
                @for (guess of displayData?.guesses; track guess.playerName) {
                  <div class="pr-guess">
                    <span class="pr-guess-name">{{ guess.playerName }}</span>
                    <span class="pr-guess-value">{{ guess.value | number:'1.0-2' }} €</span>
                  </div>
                } @empty {
                  <div class="pr-empty">Nessuna stima: tocca ai telefoni</div>
                }
              </div>
            } @else {
              <div class="pr-side-title">RISULTATO</div>
              <div class="pr-guesses">
                @for (row of displayData?.reveal?.results; track row.playerName) {
                  <div class="pr-guess" [class.out]="row.eliminated" [class.best]="$first && !row.eliminated">
                    <span class="pr-guess-name">{{ row.playerName }}</span>
                    <span class="pr-guess-value">{{ row.value | number:'1.0-2' }} €</span>
                    <span class="pr-guess-error">±{{ row.error | number:'1.0-2' }}</span>
                  </div>
                }
              </div>
            }
          </div>
        } @else {
          <div class="pr-empty">In attesa del prossimo oggetto…</div>
        }
      </div>

      @if (displayData?.eliminated?.length) {
        <div class="pr-out-list">
          <span class="pr-out-label">FUORI</span>
          @for (name of displayData.eliminated; track name) {
            <span class="pr-out-name">{{ name }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .price-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(12px, 2vh, 22px); padding: clamp(14px, 2vw, 30px); color: var(--paper); }
    .pr-head { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
    .pr-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .pr-title { margin: 0; font-family: var(--font-display); font-size: clamp(1.5rem, 3.2vw, 2.9rem); font-weight: 400; line-height: .95; letter-spacing: .02em; text-transform: uppercase; }
    .pr-timer { font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.25rem); font-weight: 700; color: var(--acid); }
    .pr-timer.hot { color: var(--tomato); animation: pr-pulse .8s infinite; }

    .pr-stage { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: clamp(14px, 2.4vw, 34px); width: min(1280px, 95vw); align-items: center; }
    .pr-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: clamp(220px, 42vh, 400px); padding: clamp(16px, 2.4vh, 28px); background: var(--paper); color: var(--coal); border: 4px solid var(--coal); border-top: 10px solid var(--acid); box-shadow: 10px 10px 0 var(--tomato); }
    .pr-emoji { font-size: clamp(3.2rem, 7vw, 6rem); line-height: 1; }
    .pr-name { font-family: var(--font); font-size: clamp(1.4rem, 3vw, 2.6rem); font-weight: 900; line-height: 1.05; text-align: center; }
    .pr-category { color: var(--tomato); font-family: var(--font-mono); font-size: clamp(.6rem, .95vw, .82rem); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .pr-price { margin-top: 8px; padding: 4px 16px; background: var(--acid); border: 3px solid var(--coal); box-shadow: 4px 4px 0 var(--tomato); font-family: var(--font-mono); font-size: clamp(1.8rem, 4vw, 3.2rem); font-weight: 700; letter-spacing: -.04em; }
    .pr-live { margin-top: 8px; padding: 6px 12px; background: var(--paper-hi); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.7rem, 1vw, .9rem); }

    .pr-side { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .pr-side-title { color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.6rem, .85vw, .78rem); font-weight: 700; letter-spacing: .18em; }
    .pr-guesses { display: flex; flex-direction: column; gap: 7px; max-height: 46vh; overflow: auto; padding: 2px 6px 6px 2px; }
    .pr-guess { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center; padding: clamp(7px, 1.1vh, 12px) clamp(10px, 1.3vw, 16px); background: var(--paper-hi); color: var(--coal); border: 2px solid var(--coal); box-shadow: 4px 4px 0 var(--coal); font-size: clamp(.85rem, 1.2vw, 1.1rem); }
    .pr-guess.best { background: var(--acid); box-shadow: 5px 5px 0 var(--tomato); }
    .pr-guess.out { opacity: .45; }
    .pr-guess-name { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pr-guess-value { font-family: var(--font-mono); font-weight: 700; }
    .pr-guess-error { color: rgba(30, 25, 20, .55); font-family: var(--font-mono); font-size: .8em; }
    .pr-out-list { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .pr-out-label { color: var(--tomato); font-family: var(--font-mono); font-size: .72rem; font-weight: 700; letter-spacing: .16em; }
    .pr-out-name { padding: 3px 9px; background: var(--tomato); color: var(--paper-hi); font-family: var(--font-mono); font-size: .78rem; font-weight: 700; text-decoration: line-through; }
    .pr-empty { color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.7rem, 1vw, .9rem); text-align: center; padding: 10px; }
    @keyframes pr-pulse { 50% { transform: scale(1.08); opacity: .7; } }
    @media (max-width: 900px) { .pr-stage { grid-template-columns: 1fr; } .pr-card { min-height: 0; } }
  `]
})
export class Price {
  @Input() displayData: any;
  @Input() timer = 0;
}
