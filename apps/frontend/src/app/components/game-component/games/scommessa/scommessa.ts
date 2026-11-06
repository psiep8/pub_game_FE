import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV de LA SCOMMESSA: gettoni, banca che raddoppia, tre domande e incasso.
 * Nessun punteggio calcolato qui: il mode manda lo stato già deciso.
 */
@Component({
  selector: 'app-scommessa',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="sc-wrap">
      <header class="sc-head">
        <div class="sc-kicker">🎲 LA SCOMMESSA</div>
        <h2 class="sc-title">
          @if (displayData?.phase === 'BET') { PUNTA PRIMA DI VEDERE }
          @else if (displayData?.phase === 'QUESTION') { QUANTO HAI OSATO? }
          @else if (displayData?.phase === 'REVEAL') { LA BANCA PARLA }
          @else if (displayData?.phase === 'CASHOUT') { INCASSARE O RISCHIARE? }
          @else { IL BANCO PAGA }
        </h2>
        @if (displayData?.phase !== 'BET') {
          <div class="sc-progress">DOMANDA {{ displayData?.index ?? 1 }} / {{ displayData?.total ?? 3 }}</div>
        }
        <div class="sc-timer" [class.hot]="(displayData?.secondsLeft ?? 0) <= 5">{{ displayData?.secondsLeft ?? 0 }}s</div>
      </header>

      @if (displayData?.phase === 'BET') {
        <div class="sc-envelope">
          <span class="sc-seal">?</span>
          <span class="sc-envelope-label">TRE DOMANDE PRIMA DEL CONTO</span>
        </div>

        <div class="sc-stakes">
          @for (chip of stakes; track chip.value) {
            <div class="sc-stake">
              <b>{{ chip.value }}</b>
              <span>{{ chip.label }}</span>
            </div>
          }
        </div>

        <p class="sc-hint">Ogni squadra tocca un gettone sul telefono. Chi non punta gioca il minimo.</p>

        @if (displayData?.stakes?.length) {
          <div class="sc-bets">
            @for (bet of displayData.stakes; track bet.playerName) {
              <span class="sc-bet">{{ bet.playerName }} · {{ bet.stake }}</span>
            }
          </div>
        }
      }

      @if (displayData?.phase === 'QUESTION' || displayData?.phase === 'REVEAL') {
        @if (displayData?.category) {
          <div class="sc-category">🎯 {{ displayData.category }}</div>
        }
        <div class="sc-question">{{ displayData?.question }}</div>

        <div class="sc-options" [class.two]="(displayData?.options?.length ?? 0) <= 2">
          @for (option of displayData?.options ?? []; track $index; let i = $index) {
            <div class="sc-option" [class.correct]="i === displayData?.correctIndex">
              <span class="sc-letter">{{ letter(i) }}</span>
              <span>{{ option }}</span>
            </div>
          }
        </div>

        @if (displayData?.phase === 'REVEAL') {
          <div class="sc-answer">
            RISPOSTA ESATTA: {{ correctOption() }}
          </div>
        }
      }

      @if (displayData?.phase === 'CASHOUT') {
        <div class="sc-mult">
          <span>BANCA PRONTA</span>
          <b>×{{ displayData?.multiplier ?? 2 }}</b>
          <span>su ogni gettone</span>
        </div>
        <p class="sc-hint">Sul telefono: INCASSA i punti o RISCHIA il raddoppio. Chi non sceglie incassa.</p>
      }

      @if (displayData?.phase === 'REVEAL' || displayData?.phase === 'CASHOUT' || displayData?.phase === 'FINALE') {
        <div class="sc-reveal">
          @for (row of displayData?.rows ?? []; track row.playerName) {
            <div class="sc-row" [class.cash]="row.status === 'CASHED'" [class.bust]="row.status === 'BUST'">
              <span class="sc-name">{{ row.playerName }}</span>
              <span class="sc-stake-tag">{{ row.status === 'BUST' ? 'BRUCIATA' : row.status === 'CASHED' ? 'INCASSATA' : 'IN GIOCO' }}</span>
              <b class="sc-bank">{{ row.bank }}</b>
              <b class="sc-points">{{ row.points > 0 ? '+' + row.points : '' }}</b>
            </div>
          }
          @if (!(displayData?.rows?.length)) {
            <p class="sc-hint">Nessuna scommessa registrata.</p>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .sc-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(10px, 1.8vh, 20px); padding: clamp(14px, 2vw, 30px); color: var(--paper); }
    .sc-head { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
    .sc-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .sc-title { margin: 0; font-family: var(--font-display); font-size: clamp(1.4rem, 2.6vw, 2.2rem); font-weight: 400; line-height: .95; letter-spacing: .04em; text-transform: uppercase; }
    .sc-progress { color: var(--acid); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .78rem); font-weight: 700; letter-spacing: .16em; }
    .sc-timer { font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.25rem); font-weight: 700; color: var(--acid); }
    .sc-timer.hot { color: var(--tomato); animation: sc-pulse .8s infinite; }

    .sc-envelope { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: clamp(16px, 3vh, 30px) clamp(34px, 6vw, 70px); background: var(--paper); color: var(--coal); border: 4px solid var(--coal); box-shadow: 10px 10px 0 var(--tomato); }
    .sc-seal { font-family: var(--font-mono); font-size: clamp(3rem, 7vw, 5rem); font-weight: 700; line-height: 1; }
    .sc-envelope-label { color: var(--tomato); font-family: var(--font-mono); font-size: clamp(.55rem, .8vw, .72rem); font-weight: 700; letter-spacing: .2em; }

    .sc-stakes { display: flex; gap: clamp(8px, 1.4vw, 18px); }
    .sc-stake { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: clamp(80px, 9vw, 130px); padding: 10px 16px; background: var(--paper-hi); color: var(--coal); border: 3px solid var(--coal); box-shadow: 5px 5px 0 var(--coal); }
    .sc-stake b { font-family: var(--font-mono); font-size: clamp(1.2rem, 2vw, 1.7rem); }
    .sc-stake span { color: var(--tomato); font-family: var(--font-mono); font-size: .68rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }

    .sc-category { padding: 3px 12px; border: 2px solid var(--coal); background: var(--acid); color: var(--coal); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .78rem); font-weight: 700; letter-spacing: .1em; }
    .sc-question { max-width: 1100px; font-family: var(--font-display); font-size: clamp(1.3rem, 3vw, 2.3rem); line-height: 1.15; text-align: center; }
    .sc-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: min(1100px, 94vw); }
    .sc-options.two { grid-template-columns: 1fr 1fr; max-width: 700px; }
    .sc-option { display: flex; align-items: center; gap: 12px; padding: clamp(10px, 1.4vw, 16px); background: var(--paper-hi); color: var(--coal); border: 3px solid var(--coal); box-shadow: 4px 4px 0 var(--coal); font-size: clamp(.85rem, 1.2vw, 1.1rem); font-weight: 700; }
    .sc-option.correct { background: var(--acid); }
    .sc-letter { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 auto; background: var(--tomato); color: var(--paper-hi); font-family: var(--font-mono); font-size: .85rem; }
    .sc-answer { padding: 6px 16px; background: var(--acid); color: var(--coal); font-family: var(--font-mono); font-size: clamp(.7rem, 1vw, .9rem); font-weight: 700; letter-spacing: .06em; }

    .sc-mult { display: flex; align-items: baseline; gap: 12px; padding: 8px 20px; background: var(--paper-hi); color: var(--coal); border: 3px solid var(--coal); box-shadow: 6px 6px 0 var(--tomato); }
    .sc-mult span { font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .78rem); font-weight: 700; letter-spacing: .12em; }
    .sc-mult b { color: var(--tomato); font-family: var(--font-mono); font-size: clamp(1.4rem, 2.4vw, 2rem); }

    .sc-bets { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .sc-bet { padding: 4px 10px; border: 2px solid var(--coal); background: var(--paper-hi); color: var(--coal); font-family: var(--font-mono); font-size: clamp(.65rem, .9vw, .8rem); font-weight: 700; }

    .sc-reveal { display: flex; flex-direction: column; gap: 8px; width: min(980px, 94vw); }
    .sc-row { display: grid; grid-template-columns: 1fr auto auto auto; gap: 14px; align-items: center; padding: 10px 16px; background: var(--paper-hi); color: var(--coal); border: 3px solid var(--coal); box-shadow: 5px 5px 0 var(--coal); font-size: clamp(.9rem, 1.3vw, 1.15rem); }
    .sc-row.cash { background: var(--acid); }
    .sc-row.bust { background: var(--tomato); color: var(--paper-hi); }
    .sc-name { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sc-stake-tag { font-family: var(--font-mono); font-size: .7em; letter-spacing: .08em; }
    .sc-bank { font-family: var(--font-mono); }
    .sc-points { font-family: var(--font-mono); }
    .sc-hint { max-width: 900px; margin: 0; color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.66rem, .95vw, .86rem); text-align: center; }
    @keyframes sc-pulse { 50% { transform: scale(1.08); opacity: .7; } }
  `]
})
export class Scommessa {
  @Input() displayData: any;
  @Input() timer = 0;

  readonly stakes = [
    { value: 100, label: 'cauto' },
    { value: 200, label: 'deciso' },
    { value: 300, label: 'tutto' },
  ];

  letter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  correctOption(): string {
    const options = this.displayData?.options ?? [];
    const index = this.displayData?.correctIndex;
    return typeof index === 'number' && index >= 0 ? String(options[index] ?? '') : '';
  }
}
