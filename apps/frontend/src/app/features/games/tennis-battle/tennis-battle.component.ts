import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tennis-battle',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-wrap">
      <div class="tb-head">
        <div>
          <h2 class="tb-title">TENNIS BATTLE</h2>
          <div class="tb-kicker">BATTAGLIA A COLPI DI RISPOSTA</div>
        </div>
        <div class="tb-head-right">
          <span class="tb-target">PRIMO A {{ displayData?.target ?? 7 }}</span>
          <span class="tb-timer" [class.hot]="timer <= 20">{{ timer }}s</span>
        </div>
      </div>

      @if (ended()) {
        <div class="tb-end">
          <div class="tb-end-stamp">ROUND TERMINATO</div>
          <div class="tb-end-rows">
            @for (court of displayData?.courts; track court.id) {
              <div class="tb-end-row">
                <span class="tb-end-set">SET {{ court.id + 1 }}</span>
                <span class="tb-end-team">{{ court.a.playerName }}</span>
                <span class="tb-end-score">{{ court.a.games }} — {{ court.b.games }}</span>
                <span class="tb-end-team right">{{ court.b.playerName }}</span>
                <span class="tb-end-winner" [class.bye]="!court.b.playerName || court.b.playerName === 'RIPOSO'">{{ court.winner }}</span>
              </div>
            }
          </div>
          <div class="tb-end-note">VINCE CHI ARRIVA PRIMO A {{ displayData?.target ?? 7 }}</div>
        </div>
      } @else {
      <div class="tb-courts" [class.single]="(displayData?.courts?.length ?? 0) === 1">
        @for (court of displayData?.courts; track court.id) {
          <div class="tb-court" [class.decided]="court.winner">

            <div class="tb-board">
              <div class="tb-team" [class.active]="court.turn === 'a' && !court.winner">
                <span class="tb-name">{{ court.a.playerName }}</span>
                <span class="tb-score">{{ pointLabel(court.a.score) }}</span>
              </div>
              <div class="tb-mid">
                <span class="tb-set">SET {{ court.id + 1 }}</span>
                @if (court.killerPoint) {
                  <span class="tb-killer">KILLER POINT</span>
                }
                <span class="tb-vs">VS</span>
              </div>
              <div class="tb-team right" [class.active]="court.turn === 'b' && !court.winner">
                <span class="tb-name">{{ court.b.playerName }}</span>
                <span class="tb-score">{{ pointLabel(court.b.score) }}</span>
              </div>
            </div>

            <div class="tb-rink">
              <div class="tb-line tb-baseline top"></div>
              <div class="tb-line tb-baseline bottom"></div>
              <div class="tb-line tb-sideline left"></div>
              <div class="tb-line tb-sideline right"></div>
              <div class="tb-line tb-service left"></div>
              <div class="tb-line tb-service right"></div>
              <div class="tb-line tb-net"></div>
              <div class="tb-racket left" [class.active]="court.turn === 'a' && !court.winner" aria-hidden="true"><svg viewBox="0 0 24 48"><ellipse cx="12" cy="14" rx="9" ry="12" /><rect x="10.5" y="25" width="3" height="22" rx="1" /></svg></div>
              <div class="tb-racket right" [class.active]="court.turn === 'b' && !court.winner" aria-hidden="true"><svg viewBox="0 0 24 48"><ellipse cx="12" cy="14" rx="9" ry="12" /><rect x="10.5" y="25" width="3" height="22" rx="1" /></svg></div>
              <div class="tb-puck"
                [class.to-a]="(court.question ? court.turn : (court.puckSide || court.turn)) === 'a'"
                [class.to-b]="(court.question ? court.turn : (court.puckSide || court.turn)) === 'b'"
                [class.traj-diagonale]="court.trajectory === 'diagonale'"
                [class.traj-stretto]="court.trajectory === 'stretto'"
                                 [class.traj-corto]="court.trajectory === 'corto'"
                 [class.traj-centrale]="court.trajectory === 'centrale'"
                 [class.traj-linea]="court.trajectory === 'linea'"

                [class.traj-lob]="court.trajectory === 'lob'"
                [class.traj-veloce]="court.trajectory === 'veloce'"
                [class.traj-lento]="court.trajectory === 'lento'"
                [style.transition-duration.ms]="court.shotMs || 450"
                [style.animation-duration.ms]="court.shotMs || 450"></div>

              @if (court.question === null && court.lastEvent?.kind === 'goal') {
                <div class="tb-goal-flash">
                  <span class="tb-goal-word">PUNTO!</span>
                  <span class="tb-goal-name">{{ sideName(court, court.lastEvent.side) }}</span>
                </div>
              }
            </div>

            <div class="tb-question">
              @if (court.winner) {
                <div class="tb-winner-card">
                  
                  <span class="tb-winner-name">{{ court.winner }}</span>
                  <span class="tb-winner-note">VINCE LA GARA</span>
                </div>
              } @else if (court.question) {
                <div class="tb-q-head">
                  <span class="tb-defender">{{ sideName(court, court.turn) }} RISPONDE</span>
                  <span class="tb-diff">{{ difficultyLabel(court.question.difficulty) }}</span>
                  <span class="tb-clock" [class.hot]="court.serveLeft <= 4">{{ court.serveLeft }}s</span>
                </div>
                <div class="tb-waiting">Domanda sul telefono</div>
              } @else {
                <div class="tb-waiting">Nuova palla in arrivo...</div>
              }
            </div>
          </div>
        } @empty {
          <div class="tb-empty">In attesa delle squadre...</div>
        }
      </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .tb-wrap {
      width: 100%; height: 100%; max-width: 1680px; margin: 0 auto;
      display: flex; flex-direction: column; gap: clamp(8px, 1.4vh, 16px);
      /* Il badge ROUND della regia sta in alto a sinistra: si parte sotto. */
      padding: clamp(96px, 12vh, 124px) clamp(16px, 2.4vw, 36px) clamp(12px, 2vh, 20px);
      color: var(--paper); box-sizing: border-box;
    }
    .tb-head { flex: 0 0 auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
    .tb-kicker { font-family: var(--font-mono); font-size: clamp(.6rem, .95vw, .85rem); letter-spacing: .3em; color: var(--acid); font-weight: 700; }
    .tb-title {
      margin: 0; color: var(--paper); font-family: var(--font-display); font-weight: 400;
      font-size: clamp(2rem, 3.4vw, 3rem); line-height: .95; letter-spacing: .04em;
      text-shadow: 4px 4px 0 var(--tomato); text-transform: uppercase;
    }
    .tb-head-right { display: flex; align-items: baseline; gap: clamp(10px, 1.6vw, 22px); }
    .tb-target { font-family: var(--font-mono); font-size: clamp(.7rem, 1.05vw, 1rem); letter-spacing: .18em; color: var(--ink-dim); }
    .tb-timer { color: var(--acid); font-family: var(--font-mono); font-size: clamp(1.5rem, 2.2vw, 2rem); font-weight: 700; font-variant-numeric: tabular-nums; }
    .tb-timer.hot { color: var(--tomato); }

    .tb-courts {
      flex: 1; min-height: 0; width: 100%;
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: minmax(0, 1fr); gap: clamp(10px, 1.4vw, 20px);
    }
    .tb-courts.single { grid-template-columns: minmax(0, 980px); justify-content: center; }

    .tb-court {
      min-height: 0; display: flex; flex-direction: column; gap: clamp(6px, .8vh, 10px);
      padding: clamp(10px, 1.4vh, 16px); background: var(--paper); color: var(--coal);
      border: 3px solid var(--coal); box-shadow: 7px 7px 0 var(--tomato);
    }
    .tb-court.decided { background: var(--paper-hi); }

    .tb-board { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .tb-team {
      flex: 1; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 4px 10px; border: 2px solid var(--coal); background: var(--paper-hi);
      transition: background .2s ease;
    }
    .tb-team.right { flex-direction: row-reverse; }
    .tb-team.active { background: var(--acid); }
    .tb-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font); font-size: clamp(1rem, 1.35vw, 1.35rem); font-weight: 800; }
    .tb-score { flex: 0 0 auto; font-family: var(--font-mono); font-size: clamp(1.9rem, 2.8vw, 2.8rem); font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
    .tb-mid { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .tb-set { font-family: var(--font-mono); font-size: .58rem; letter-spacing: .18em; color: color-mix(in srgb, var(--coal) 55%, transparent); }
    .tb-vs { font-family: var(--font-mono); font-size: .72rem; font-weight: 700; letter-spacing: .12em; color: var(--tomato); }

    /* Campo da tennis: il colore del campo segue il tema (--acid nel tema Acid, altrimenti --cobalt). */
    .tb-rink {
      position: relative; flex: 1 1 auto; min-height: clamp(120px, 18vh, 220px);
      background: var(--tb-court, var(--cobalt));
      border: 3px solid var(--coal); overflow: hidden;
    }
    .tb-line { position: absolute; background: var(--paper-hi); opacity: .92; }
    .tb-baseline { left: 4%; right: 4%; height: 3px; }
    .tb-baseline.top { top: 6%; }
    .tb-baseline.bottom { bottom: 6%; }
    .tb-sideline { top: 6%; bottom: 6%; width: 3px; }
    .tb-sideline.left { left: 4%; }
    .tb-sideline.right { right: 4%; }
    .tb-service { top: 22%; bottom: 22%; width: 3px; }
    .tb-service.left { left: 26%; }
    .tb-service.right { right: 26%; }
    .tb-net { left: 50%; top: 0; bottom: 0; width: 4px; margin-left: -2px; background: var(--paper-hi); }
    .tb-racket { position: absolute; top: 50%; width: clamp(16px, 2vw, 26px); height: clamp(32px, 4.4vw, 56px); margin-top: calc(clamp(32px, 4.4vw, 56px) / -2); z-index: 3; }
    .tb-racket.left { left: 1%; animation: tbSwayLeft 2.6s ease-in-out infinite; }
    .tb-racket.right { right: 1%; animation: tbSwayRight 2.6s ease-in-out infinite; }
    .tb-racket.active { animation-duration: 1.2s; }
    /* Racchette che si muovono in continuo sul fondo: chi risponde le tiene più alte. */
    @keyframes tbSwayLeft { 0%, 100% { transform: translateY(-22%) rotate(-8deg); } 50% { transform: translateY(22%) rotate(8deg); } }
    @keyframes tbSwayRight { 0%, 100% { transform: translateY(22%) rotate(8deg); } 50% { transform: translateY(-22%) rotate(-8deg); } }
    .tb-racket svg { width: 100%; height: 100%; display: block; overflow: visible; }
    .tb-racket ellipse { fill: var(--paper-hi); stroke: var(--coal); stroke-width: 2; }
    .tb-racket rect { fill: var(--coal); }
    .tb-puck {
      position: absolute; top: 50%; width: clamp(12px, 1.5vw, 18px); height: clamp(12px, 1.5vw, 18px);
      margin-top: calc(clamp(12px, 1.5vw, 18px) / -2); border-radius: 50%;
      background: var(--acid); border: 2px solid var(--coal);
      box-shadow: 2px 2px 0 var(--coal);
      transition: left .45s cubic-bezier(.22, 1, .36, 1);
    }
    .tb-puck.to-a { left: 20%; }
    .tb-puck.to-b { left: calc(80% - clamp(12px, 1.5vw, 18px)); }
    .tb-puck.traj-diagonale { animation-name: tbDiagonale; animation-timing-function: ease-in; animation-fill-mode: both; }
    .tb-puck.traj-stretto { animation-name: tbStretto; animation-timing-function: linear; animation-fill-mode: both; }
    .tb-puck.traj-corto { animation-name: tbCorto; animation-timing-function: ease-out; animation-fill-mode: both; }
    .tb-puck.traj-lob { animation-name: tbLob; animation-timing-function: ease-out; animation-fill-mode: both; }
    .tb-puck.traj-veloce { animation-name: tbVeloce; animation-timing-function: cubic-bezier(.1, .9, .2, 1); animation-fill-mode: both; }
    .tb-puck.traj-lento { animation-name: tbLento; animation-timing-function: linear; animation-fill-mode: both; }
    .tb-puck.traj-centrale { animation-name: tbCentrale; animation-timing-function: ease-in-out; animation-fill-mode: both; }
    .tb-puck.traj-linea { animation-name: tbLinea; animation-timing-function: ease-in; animation-fill-mode: both; }
    /* Centrale: va dritta al centro della rete, senza scarti laterali. */
    @keyframes tbCentrale {
      0% { transform: translateY(-6%) scale(.95); }
      100% { transform: translateY(0) scale(1); }
    }
    /* Linea: spinge lungo la linea di fondo, rasente al bordo. */
    @keyframes tbLinea {
      0% { transform: translateY(-30%) scaleX(1.1); }
      100% { transform: translateY(0) scaleX(1); }
    }
    /* Diagonale: parte da un lato e scende in angolo sul lato opposto. */
    @keyframes tbDiagonale {
      0% { transform: translate(0, -70%); }
      100% { transform: translate(0, 0); }
    }
    /* Stretto: resta sulla linea laterale, dritto e rasente. */
    @keyframes tbStretto {
      0% { transform: translateY(-4%) scaleX(1.05); }
      100% { transform: translateY(0) scaleX(1); }
    }
    /* Corto: palla smorzata, muore a metà campo. */
    @keyframes tbCorto {
      0% { transform: translateY(-40%) scaleX(.9); }
      70% { transform: translateY(0) scaleX(1); }
      100% { transform: translateY(0) scaleX(1); }
    }
    /* Lob: alza la palla alta e la fa ricadere in campo. */
    @keyframes tbLob {
      0% { transform: translateY(-90%) scale(.9); }
      50% { transform: translateY(-30%) scale(1.15); }
      100% { transform: translateY(0) scale(1); }
    }
    /* Fucilata: fila basso e allungato, non si alza di un millimetro. */
    @keyframes tbVeloce {
      0% { transform: translateY(-14%) scaleX(1.3); }
      70% { transform: translateY(-4%) scaleX(1.1); }
      100% { transform: translateY(0) scaleX(1); }
    }
    /* Disco pesante: striscia in basso, ruota piano e si ferma. */
    @keyframes tbLento {
      0% { transform: translateY(42%) rotate(0deg); }
      55% { transform: translateY(24%) rotate(-40deg); }
      100% { transform: translateY(0) rotate(-80deg); }
    }

    .tb-goal-flash {
      position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--tomato) 92%, transparent); color: var(--paper-hi); gap: 2px;
      animation: tbGoal .35s ease-out;
    }
    .tb-goal-word { font-family: var(--font-display); font-weight: 400; font-size: clamp(1.6rem, 2.8vw, 2.4rem); line-height: 1; letter-spacing: .06em; }
    .tb-goal-name { font-family: var(--font-mono); font-size: clamp(.7rem, 1vw, .95rem); letter-spacing: .12em; text-transform: uppercase; }
    @keyframes tbGoal { from { transform: scale(.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .tb-question { flex: 0 0 auto; min-height: clamp(64px, 9vh, 88px); display: flex; flex-direction: column; gap: clamp(6px, .8vh, 10px); justify-content: center; }
    .tb-q-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .tb-defender { font-family: var(--font-mono); font-size: clamp(.72rem, 1vw, .95rem); font-weight: 700; letter-spacing: .16em; color: var(--tomato); }
    .tb-diff { margin-left: auto; margin-right: 10px; padding: 1px 7px; border: 1px solid var(--tomato); color: var(--tomato); font-family: var(--font-mono); font-size: .58rem; font-weight: 700; letter-spacing: .12em; }
    .tb-clock { font-family: var(--font-mono); font-size: clamp(1.7rem, 2.4vw, 2.3rem); font-weight: 700; color: var(--coal); font-variant-numeric: tabular-nums; }
    .tb-clock.hot { color: var(--tomato); animation: tbPulse .7s infinite; }
    @keyframes tbPulse { 50% { opacity: .45; } }
    .tb-q-text { margin: 0; font-family: var(--font); font-size: clamp(1.3rem, 1.95vw, 1.95rem); font-weight: 800; line-height: 1.15; }
    .tb-q-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px; }
    .tb-q-option { display: flex; gap: 8px; min-width: 0; font-family: var(--font); font-size: clamp(1rem, 1.35vw, 1.35rem); line-height: 1.2; }
    .tb-q-option b { font-family: var(--font-mono); color: var(--tomato); }
    .tb-q-option:nth-child(1), .tb-q-option:nth-child(2) { color: color-mix(in srgb, var(--coal) 95%, transparent); }

    .tb-winner-card { display: flex; align-items: center; gap: 12px; }
    
    .tb-winner-name { font-family: var(--font-display); font-size: clamp(1.4rem, 2.2vw, 2rem); text-transform: uppercase; }
    .tb-winner-note { font-family: var(--font-mono); font-size: .8rem; color: color-mix(in srgb, var(--coal) 60%, transparent); }
    .tb-waiting { font-family: var(--font-mono); font-size: clamp(.9rem, 1.1vw, 1.05rem); color: color-mix(in srgb, var(--coal) 60%, transparent); }
    .tb-empty { grid-column: 1 / -1; align-self: center; color: var(--ink-dim); text-align: center; font-family: var(--font-mono); }

    /* Pannello di fine round: esiti dei campi stampati su carta. */
    .tb-end {
      flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: clamp(12px, 2vh, 22px); padding: clamp(16px, 2.6vh, 30px);
      background: var(--paper); color: var(--coal);
      border: 4px solid var(--coal); box-shadow: 14px 14px 0 var(--tomato);
    }
    .tb-end-stamp {
      padding: 4px 22px; background: var(--acid); color: var(--coal);
      border: 4px solid var(--coal); box-shadow: 8px 8px 0 var(--coal);
      font-family: var(--font-display); font-size: clamp(1.6rem, 3.2vw, 2.8rem);
      line-height: 1; letter-spacing: .1em; text-transform: uppercase; transform: rotate(-2deg);
    }
    .tb-end-rows { width: min(1100px, 94%); display: flex; flex-direction: column; border-top: 3px solid var(--coal); }
    .tb-end-row {
      display: grid; grid-template-columns: 84px minmax(0, 1fr) auto minmax(0, 1fr) minmax(110px, auto);
      align-items: center; gap: clamp(8px, 1.2vw, 18px); padding: 8px 10px;
      border-bottom: 2px solid var(--coal);
    }
    .tb-end-set { font-family: var(--font-mono); font-size: clamp(.58rem, .82vw, .72rem); font-weight: 700; letter-spacing: .16em; opacity: .6; }
    .tb-end-team { font-family: var(--font); font-weight: 800; font-size: clamp(.95rem, 1.3vw, 1.2rem); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tb-end-team.right { text-align: right; }
    .tb-end-score { font-family: var(--font-mono); font-weight: 700; font-size: clamp(1.1rem, 1.7vw, 1.5rem); font-variant-numeric: tabular-nums; }
    .tb-end-winner {
      justify-self: end; padding: 2px 10px; background: var(--acid); color: var(--coal);
      border: 2px solid var(--coal); box-shadow: 3px 3px 0 var(--coal);
      font-family: var(--font-mono); font-size: clamp(.62rem, .86vw, .78rem); font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    }
    .tb-end-winner.bye { background: var(--mustard); }
    .tb-killer { display: inline-block; margin-left: .5rem; padding: .1rem .4rem; border: 2px solid var(--coal); background: var(--tomato); color: var(--paper-hi); font-family: var(--font-mono); font-size: .65rem; font-weight: 700; letter-spacing: .12em; }
    .tb-end-note { font-family: var(--font-mono); font-size: clamp(.6rem, .86vw, .76rem); letter-spacing: .16em; opacity: .6; }
  `]
})
export class TennisBattle {
  @Input() displayData: any;
  @Input() timer = 0;

  /** Tutti i campi hanno un vincitore: si mostra il pannello di fine round. */
  ended(): boolean {
    const courts = this.displayData?.courts;
    if (!Array.isArray(courts) || !courts.length) return false;
    return courts.every((court: any) => !!court?.winner);
  }

  /** Punteggio in stile tennis: 0, 15, 30, 40, ADV. */
  pointLabel(score: unknown): string {
    if (score === 'adv') return 'ADV';
    return String(score ?? 0);
  }

  sideName(court: any, side: 'a' | 'b'): string {
    return side === 'a' ? court?.a?.playerName ?? '' : court?.b?.playerName ?? '';
  }

  letter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  /** Difficoltà della domanda in corso, scritta sulla TV. */
  difficultyLabel(difficulty?: string | null): string {
    if (difficulty === 'EASY') return 'FACILE';
    if (difficulty === 'HARD') return 'DIFFICILE';
    return 'MEDIA';
  }
}
