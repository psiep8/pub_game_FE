import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface BasketScore {
  playerName: string;
  score: number;
  baskets?: number;
}

interface BasketTeam {
  playerName: string;
  score: number;
  baskets: number;
  balls: boolean[];
}

/**
 * TV del BONUS BASKET: le squadre stanno in colonna e riempiono la propria
 * fila di palloni a ogni canestro. Il gioco vero gira sul telefono (/basket).
 */
@Component({
  selector: 'app-basket-bonus-stage',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="bbs-overlay">
      <div class="bbs-card">
        <header class="bbs-head">
          <div class="bbs-heading">
            <span class="bbs-kicker">🏀 BASKET · BONUS DI FINE ATTO</span>
            <h1>OGNI CANESTRO RIEMPIE LA FILA</h1>
            <p>Tirate dal telefono. La TV segna ogni canestro e somma i punti delle tre manche.</p>
          </div>
          <div class="bbs-clock" [class.hot]="secondsLeft <= 10">
            <span>TEMPO</span>
            <b>{{ secondsLeft }}</b>
            <span>SEC</span>
          </div>
        </header>

        <div class="bbs-rules">
          <span><b>MANCHE 1</b> ferro largo · 2 pt · swish 3</span>
          <span><b>MANCHE 2</b> ferro medio · 3 pt · swish 4</span>
          <span><b>MANCHE 3</b> ferro piccolo · 5 pt · swish 6</span>
        </div>

        <section class="bbs-board" aria-label="Tabellone canestri">
          <div class="bbs-board-head">
            <span>POS</span>
            <span>SQUADRA</span>
            <span>FILA DEI CANESTRI</span>
            <span>PUNTI</span>
          </div>

          @for (team of teams(); track team.playerName; let i = $index) {
            <article class="bbs-team" [class.leader]="i === 0 && team.score > 0" [class.waiting]="team.baskets === 0">
              <span class="bbs-pos">{{ (i + 1).toString().padStart(2, '0') }}</span>

              <div class="bbs-name">
                <h2>{{ team.playerName }}</h2>
                <span><b>{{ team.baskets }}</b> {{ team.baskets === 1 ? 'CANESTRO' : 'CANESTRI' }}</span>
              </div>

              <div class="bbs-balls" [attr.aria-label]="team.baskets + ' canestri'">
                @for (ball of team.balls; track $index) {
                  <span class="bbs-ball"></span>
                }
                @if (!team.baskets) {
                  <span class="bbs-empty">IN ATTESA DEL PRIMO CANESTRO</span>
                }
              </div>

              <div class="bbs-score">
                <b>{{ team.score }}</b>
                <span>PUNTI</span>
              </div>
            </article>
          } @empty {
            <p class="bbs-no-teams">In attesa dei tavoli in gara…</p>
          }
        </section>
      </div>
    </div>
  `,
  styles: [`
    .bbs-overlay {
      position: fixed;
      inset: 0;
      z-index: 70;
      display: grid;
      place-items: center;
      padding: clamp(8px, 1.4vw, 22px);
      background: rgba(8, 6, 4, .62);
      color: var(--coal);
      font-family: var(--font);
    }
    .bbs-card {
      display: flex;
      flex-direction: column;
      gap: clamp(7px, 1.1vh, 14px);
      width: min(1480px, 98vw);
      max-height: 97dvh;
      padding: clamp(14px, 2vw, 28px);
      background: var(--paper);
      border: 4px solid var(--coal);
      box-shadow: 12px 12px 0 var(--mustard);
      overflow: hidden;
    }
    .bbs-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      padding-bottom: clamp(5px, .9vh, 10px);
      border-bottom: 3px solid var(--coal);
    }
    .bbs-heading { min-width: 0; }
    .bbs-kicker {
      display: inline-block;
      padding: 3px 10px;
      background: var(--tomato);
      color: var(--paper-hi);
      border: 2px solid var(--coal);
      font-family: var(--font-mono);
      font-size: clamp(.6rem, .9vw, .8rem);
      font-weight: 800;
      letter-spacing: .16em;
      transform: rotate(-1.2deg);
    }
    .bbs-head h1 {
      margin: 7px 0 0;
      font-family: var(--font-display);
      font-size: clamp(1.5rem, 3vw, 2.8rem);
      font-weight: 400;
      line-height: .94;
      letter-spacing: .03em;
      text-transform: uppercase;
    }
    .bbs-head p {
      margin: 5px 0 0;
      color: rgba(30, 25, 20, .62);
      font-family: var(--font-mono);
      font-size: clamp(.6rem, .92vw, .78rem);
      letter-spacing: .04em;
    }
    .bbs-clock {
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      min-width: clamp(92px, 9vw, 140px);
      padding: 5px 14px 7px;
      background: var(--paper-hi);
      border: 3px solid var(--coal);
      box-shadow: 5px 5px 0 var(--tomato);
      font-family: var(--font-mono);
      line-height: 1;
    }
    .bbs-clock span {
      color: rgba(30, 25, 20, .55);
      font-size: clamp(.5rem, .8vw, .65rem);
      font-weight: 800;
      letter-spacing: .18em;
    }
    .bbs-clock b {
      margin: 3px 0 1px;
      font-size: clamp(1.8rem, 3.8vw, 3.2rem);
      font-variant-numeric: tabular-nums;
    }
    .bbs-clock.hot { background: var(--tomato); color: var(--paper-hi); }
    .bbs-clock.hot span { color: rgba(255, 248, 232, .75); }
    .bbs-rules {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 7px;
      font-family: var(--font-mono);
      font-size: clamp(.55rem, .82vw, .7rem);
      letter-spacing: .03em;
    }
    .bbs-rules span {
      padding: 5px 8px;
      background: var(--paper-hi);
      border: 2px solid var(--coal);
      color: rgba(30, 25, 20, .66);
    }
    .bbs-rules b { color: var(--coal); letter-spacing: .07em; }
    .bbs-board {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 0;
      overflow: auto;
      padding: 2px 5px 5px 2px;
    }
    .bbs-board-head {
      display: grid;
      grid-template-columns: clamp(28px, 2.2vw, 36px) clamp(130px, 16vw, 220px) minmax(0, 1fr) clamp(70px, 7vw, 104px);
      gap: clamp(8px, 1vw, 14px);
      padding: 0 12px;
      color: rgba(30, 25, 20, .55);
      font-family: var(--font-mono);
      font-size: clamp(.46rem, .7vw, .58rem);
      font-weight: 800;
      letter-spacing: .12em;
    }
    .bbs-board-head span:last-child { text-align: right; }
    .bbs-team {
      display: grid;
      grid-template-columns: clamp(28px, 2.2vw, 36px) clamp(130px, 16vw, 220px) minmax(0, 1fr) clamp(70px, 7vw, 104px);
      align-items: center;
      gap: clamp(8px, 1vw, 14px);
      padding: clamp(6px, .9vh, 9px) 12px;
      background: var(--paper-hi);
      border: 3px solid var(--coal);
      border-left: 8px solid var(--tomato);
      box-shadow: 3px 3px 0 rgba(21, 21, 15, .2);
    }
    .bbs-team:nth-of-type(4n + 2) { border-left-color: var(--tomato); }
    .bbs-team:nth-of-type(4n + 3) { border-left-color: var(--mustard); }
    .bbs-team:nth-of-type(4n + 4) { border-left-color: var(--cobalt); }
    .bbs-team:nth-of-type(4n + 5) { border-left-color: var(--mint); }
    .bbs-team.leader {
      background: var(--acid);
      border-left-color: var(--tomato);
      box-shadow: 5px 5px 0 var(--tomato);
    }
    .bbs-team.waiting { opacity: .78; }
    .bbs-pos {
      display: grid;
      place-items: center;
      width: clamp(26px, 2.2vw, 34px);
      height: clamp(26px, 2.2vw, 34px);
      background: var(--coal);
      color: var(--paper-hi);
      font-family: var(--font-mono);
      font-size: clamp(.62rem, .88vw, .78rem);
      font-weight: 800;
    }
    .bbs-team.leader .bbs-pos { background: var(--tomato); }
    .bbs-name { min-width: 0; }
    .bbs-name h2 {
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--font-display);
      font-size: clamp(1rem, 1.9vw, 1.6rem);
      font-weight: 400;
      line-height: 1;
      letter-spacing: .03em;
      text-transform: uppercase;
    }
    .bbs-name span {
      display: block;
      margin-top: 2px;
      color: rgba(30, 25, 20, .55);
      font-family: var(--font-mono);
      font-size: clamp(.46rem, .7vw, .58rem);
      font-weight: 800;
      letter-spacing: .08em;
    }
    .bbs-name b { color: var(--coal); }
    .bbs-balls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: clamp(4px, .5vw, 7px);
      min-height: clamp(30px, 3.4vw, 40px);
    }
    .bbs-ball {
      position: relative;
      display: block;
      width: clamp(22px, 2.4vw, 34px);
      height: clamp(22px, 2.4vw, 34px);
      border-radius: 50%;
      background: var(--tomato);
      border: 2px solid var(--coal);
      box-shadow: 2px 2px 0 rgba(21, 21, 15, .28);
    }
    .bbs-ball::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 2px;
      right: 2px;
      height: 2px;
      background: var(--coal);
      transform: translateY(-50%);
    }
    .bbs-ball::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 58%;
      height: 100%;
      border-left: 2px solid var(--coal);
      border-right: 2px solid var(--coal);
      border-radius: 50%;
      transform: translate(-50%, -50%);
    }
    .bbs-empty {
      color: rgba(30, 25, 20, .42);
      font-family: var(--font-mono);
      font-size: clamp(.5rem, .72vw, .62rem);
      font-weight: 800;
      letter-spacing: .07em;
    }
    .bbs-score {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      line-height: 1;
    }
    .bbs-score b {
      font-family: var(--font-mono);
      font-size: clamp(1.35rem, 2.6vw, 2.2rem);
      font-variant-numeric: tabular-nums;
    }
    .bbs-score span {
      margin-top: 2px;
      color: rgba(30, 25, 20, .5);
      font-family: var(--font-mono);
      font-size: clamp(.44rem, .66vw, .54rem);
      font-weight: 800;
      letter-spacing: .12em;
    }
    .bbs-no-teams {
      margin: 0;
      padding: 20px;
      border: 2px dashed rgba(21, 21, 15, .35);
      font-family: var(--font-mono);
      text-align: center;
    }
    @media (max-width: 900px) {
      .bbs-board-head,
      .bbs-team {
        grid-template-columns: 28px minmax(100px, 140px) minmax(0, 1fr) 66px;
      }
      .bbs-rules { grid-template-columns: 1fr; }
    }
    @media (max-height: 720px) {
      .bbs-head p { display: none; }
      .bbs-rules { display: none; }
      .bbs-card { gap: 6px; padding: 11px 15px; }
      .bbs-team { padding: 4px 10px; }
      .bbs-balls { min-height: 26px; }
      .bbs-ball { width: 24px; height: 24px; }
    }
  `],
})
export class BasketBonusStage {
  @Input() secondsLeft = 0;
  @Input() scores: BasketScore[] = [];
  @Input() players: string[] = [];

  teams(): BasketTeam[] {
    const tables = new Map<string, { score: number; baskets: number }>();

    for (const player of this.players) {
      const name = String(player ?? '').trim();
      if (name) tables.set(name, { score: 0, baskets: 0 });
    }

    for (const row of this.scores) {
      const name = String(row?.playerName ?? '').trim();
      if (!name) continue;
      tables.set(name, {
        score: Number(row.score) || 0,
        baskets: Math.max(0, Number(row.baskets) || 0),
      });
    }

    return [...tables.entries()]
      .map(([playerName, data]) => ({
        playerName,
        score: data.score,
        baskets: data.baskets,
        balls: Array.from({ length: data.baskets }, () => true),
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.baskets - a.baskets ||
          a.playerName.localeCompare(b.playerName),
      );
  }
}
