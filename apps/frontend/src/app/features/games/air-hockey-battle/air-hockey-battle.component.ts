import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-air-hockey-battle',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ahb-wrap">
      <div class="ahb-head">
        <div>
          <h2 class="ahb-title">AIR HOCKEY BATTLE</h2>
          <div class="ahb-kicker">⚡ BATTAGLIA A COLPI DI RISPOSTA</div>
        </div>
        <div class="ahb-head-right">
          <span class="ahb-target">PRIMO A {{ displayData?.target ?? 7 }}</span>
          <span class="ahb-timer" [class.hot]="timer <= 20">{{ timer }}s</span>
        </div>
      </div>

      <div class="ahb-courts" [class.single]="(displayData?.courts?.length ?? 0) === 1">
        @for (court of displayData?.courts; track court.id) {
          <div class="ahb-court" [class.decided]="court.winner">

            <div class="ahb-board">
              <div class="ahb-team" [class.active]="court.turn === 'a' && !court.winner">
                <span class="ahb-name">{{ court.a.playerName }}</span>
                <span class="ahb-score">{{ court.a.score }}</span>
              </div>
              <div class="ahb-mid">
                <span class="ahb-set">SET {{ court.id + 1 }}</span>
                <span class="ahb-vs">VS</span>
              </div>
              <div class="ahb-team right" [class.active]="court.turn === 'b' && !court.winner">
                <span class="ahb-name">{{ court.b.playerName }}</span>
                <span class="ahb-score">{{ court.b.score }}</span>
              </div>
            </div>

            <div class="ahb-rink">
              <div class="ahb-goal-frame left"></div>
              <div class="ahb-goal-frame right"></div>
              <div class="ahb-laser left"></div>
              <div class="ahb-laser right"></div>
              <div class="ahb-center"></div>
              <div class="ahb-puck" [class.to-a]="court.turn === 'a'" [class.to-b]="court.turn === 'b'"
                [class.zigzag]="court.zigzag"
                [style.transition-duration.ms]="court.shotMs || 450"
                [style.animation-duration.ms]="court.shotMs || 450"></div>
              <div class="ahb-paddle left" [class.active]="court.turn === 'a'">🏒</div>
              <div class="ahb-paddle right" [class.active]="court.turn === 'b'">🏒</div>

              @if (court.question === null && court.lastEvent?.kind === 'goal') {
                <div class="ahb-goal-flash">
                  <span class="ahb-goal-word">GOL!</span>
                  <span class="ahb-goal-name">{{ sideName(court, court.lastEvent.side) }}</span>
                </div>
              }
            </div>

            <div class="ahb-question">
              @if (court.winner) {
                <div class="ahb-winner-card">
                  <span class="ahb-cup">🏆</span>
                  <span class="ahb-winner-name">{{ court.winner }}</span>
                  <span class="ahb-winner-note">vince il set</span>
                </div>
              } @else if (court.question) {
                <div class="ahb-q-head">
                  <span class="ahb-defender">{{ sideName(court, court.turn) }} DIFENDE</span>
                  <span class="ahb-diff">{{ difficultyLabel(court.question.difficulty) }}</span>
                  <span class="ahb-clock" [class.hot]="court.serveLeft <= 4">{{ court.serveLeft }}s</span>
                </div>
                <p class="ahb-q-text">{{ court.question.text }}</p>
                <div class="ahb-q-options">
                  @for (option of court.question.options; track $index) {
                    <span class="ahb-q-option"><b>{{ letter($index) }}</b>{{ option }}</span>
                  }
                </div>
              } @else {
                <div class="ahb-waiting">Nuova palla in arrivo...</div>
              }
            </div>
          </div>
        } @empty {
          <div class="ahb-empty">In attesa delle squadre...</div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .ahb-wrap {
      width: 100%; height: 100%; max-width: 1680px; margin: 0 auto;
      display: flex; flex-direction: column; gap: clamp(8px, 1.4vh, 16px);
      padding: clamp(66px, 9vh, 88px) clamp(16px, 2.4vw, 36px) clamp(12px, 2vh, 20px);
      color: var(--paper); box-sizing: border-box;
    }
    .ahb-head { flex: 0 0 auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
    .ahb-kicker { font-family: var(--font-mono); font-size: clamp(.6rem, .95vw, .85rem); letter-spacing: .3em; color: var(--acid); font-weight: 700; }
    .ahb-title {
      margin: 0; color: var(--paper); font-family: var(--font-display); font-weight: 400;
      font-size: clamp(2rem, 3.4vw, 3rem); line-height: .95; letter-spacing: .04em;
      text-shadow: 4px 4px 0 var(--tomato); text-transform: uppercase;
    }
    .ahb-head-right { display: flex; align-items: baseline; gap: clamp(10px, 1.6vw, 22px); }
    .ahb-target { font-family: var(--font-mono); font-size: clamp(.7rem, 1.05vw, 1rem); letter-spacing: .18em; color: var(--ink-dim); }
    .ahb-timer { color: var(--acid); font-family: var(--font-mono); font-size: clamp(1.5rem, 2.2vw, 2rem); font-weight: 700; font-variant-numeric: tabular-nums; }
    .ahb-timer.hot { color: var(--tomato); }

    .ahb-courts {
      flex: 1; min-height: 0; width: 100%;
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: minmax(0, 1fr); gap: clamp(10px, 1.4vw, 20px);
    }
    .ahb-courts.single { grid-template-columns: minmax(0, 980px); justify-content: center; }

    .ahb-court {
      min-height: 0; display: flex; flex-direction: column; gap: clamp(6px, .8vh, 10px);
      padding: clamp(10px, 1.4vh, 16px); background: var(--paper); color: var(--coal);
      border: 3px solid var(--coal); box-shadow: 7px 7px 0 var(--tomato);
    }
    .ahb-court.decided { background: var(--paper-hi); }

    .ahb-board { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .ahb-team {
      flex: 1; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 4px 10px; border: 2px solid var(--coal); background: var(--paper-hi);
      transition: background .2s ease;
    }
    .ahb-team.right { flex-direction: row-reverse; }
    .ahb-team.active { background: var(--acid); }
    .ahb-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font); font-size: clamp(1rem, 1.35vw, 1.35rem); font-weight: 800; }
    .ahb-score { flex: 0 0 auto; font-family: var(--font-mono); font-size: clamp(1.9rem, 2.8vw, 2.8rem); font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
    .ahb-mid { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .ahb-set { font-family: var(--font-mono); font-size: .58rem; letter-spacing: .18em; color: rgba(30, 25, 20, .55); }
    .ahb-vs { font-family: var(--font-mono); font-size: .72rem; font-weight: 700; letter-spacing: .12em; color: var(--tomato); }

    .ahb-rink {
      position: relative; flex: 1 1 auto; min-height: clamp(120px, 18vh, 220px);
      background:
        repeating-linear-gradient(90deg, rgba(30, 25, 20, .06) 0 1px, transparent 1px 34px),
        var(--paper-hi);
      border: 3px solid var(--coal); overflow: hidden;
    }
    .ahb-center { position: absolute; left: 50%; top: 8%; bottom: 8%; width: 3px; margin-left: -1.5px; background: rgba(30, 25, 20, .25); }
    .ahb-goal-frame { position: absolute; top: 14%; bottom: 14%; width: 10px; background: repeating-linear-gradient(180deg, rgba(30,25,20,.35) 0 4px, transparent 4px 8px); }
    .ahb-goal-frame.left { left: 0; border-right: 2px solid var(--coal); }
    .ahb-goal-frame.right { right: 0; border-left: 2px solid var(--coal); }
    .ahb-laser { position: absolute; top: 33%; height: 34%; width: 7px; border-radius: 999px; z-index: 3; }
    .ahb-laser::after { content: ''; position: absolute; inset: -8px -3px; background: inherit; opacity: .22; filter: blur(5px); }
    .ahb-laser.left { left: 7px; background: var(--cobalt); box-shadow: 0 0 10px var(--cobalt), 0 0 22px rgba(37, 99, 235, .55); }
    .ahb-laser.right { right: 7px; background: var(--tomato); box-shadow: 0 0 10px var(--tomato), 0 0 22px rgba(220, 70, 45, .55); }
    .ahb-paddle { position: absolute; top: 50%; transform: translateY(-50%); font-size: clamp(1.4rem, 2.4vw, 2.2rem); opacity: .45; transition: opacity .2s ease; }
    .ahb-paddle.left { left: 8%; }
    .ahb-paddle.right { right: 8%; }
    .ahb-paddle.active { opacity: 1; }
    .ahb-puck {
      position: absolute; top: 50%; width: clamp(14px, 1.8vw, 22px); height: clamp(14px, 1.8vw, 22px);
      margin-top: calc(clamp(14px, 1.8vw, 22px) / -2); border-radius: 50%;
      background: var(--coal); border: 3px solid var(--paper-hi);
      box-shadow: 0 2px 0 var(--tomato);
      transition: left .45s cubic-bezier(.22, 1, .36, 1);
    }
    .ahb-puck.to-a { left: 20%; }
    .ahb-puck.to-b { left: calc(80% - clamp(14px, 1.8vw, 22px)); }
    .ahb-puck.zigzag { animation-name: ahbZigzag; animation-timing-function: ease-in-out; animation-fill-mode: both; }
    @keyframes ahbZigzag {
      0%, 100% { transform: translateY(0); }
      20% { transform: translateY(-75%); }
      40% { transform: translateY(60%); }
      60% { transform: translateY(-60%); }
      80% { transform: translateY(45%); }
    }

    .ahb-goal-flash {
      position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(155, 79, 45, .92); color: var(--paper-hi); gap: 2px;
      animation: ahbGoal .35s ease-out;
    }
    .ahb-goal-word { font-family: var(--font-display); font-weight: 400; font-size: clamp(1.6rem, 2.8vw, 2.4rem); line-height: 1; letter-spacing: .06em; }
    .ahb-goal-name { font-family: var(--font-mono); font-size: clamp(.7rem, 1vw, .95rem); letter-spacing: .12em; text-transform: uppercase; }
    @keyframes ahbGoal { from { transform: scale(.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .ahb-question { flex: 0 0 auto; min-height: clamp(148px, 23vh, 210px); display: flex; flex-direction: column; gap: clamp(8px, 1.2vh, 14px); justify-content: center; }
    .ahb-q-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .ahb-defender { font-family: var(--font-mono); font-size: clamp(.72rem, 1vw, .95rem); font-weight: 700; letter-spacing: .16em; color: var(--tomato); }
    .ahb-diff { margin-left: auto; margin-right: 10px; padding: 1px 7px; border: 1px solid var(--tomato); color: var(--tomato); font-family: var(--font-mono); font-size: .58rem; font-weight: 700; letter-spacing: .12em; }
    .ahb-clock { font-family: var(--font-mono); font-size: clamp(1.7rem, 2.4vw, 2.3rem); font-weight: 700; color: var(--coal); font-variant-numeric: tabular-nums; }
    .ahb-clock.hot { color: var(--tomato); animation: ahbPulse .7s infinite; }
    @keyframes ahbPulse { 50% { opacity: .45; } }
    .ahb-q-text { margin: 0; font-family: var(--font); font-size: clamp(1.3rem, 1.95vw, 1.95rem); font-weight: 800; line-height: 1.15; }
    .ahb-q-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px; }
    .ahb-q-option { display: flex; gap: 8px; min-width: 0; font-family: var(--font); font-size: clamp(1rem, 1.35vw, 1.35rem); line-height: 1.2; }
    .ahb-q-option b { font-family: var(--font-mono); color: var(--tomato); }
    .ahb-q-option:nth-child(1), .ahb-q-option:nth-child(2) { color: rgba(30, 25, 20, .95); }

    .ahb-winner-card { display: flex; align-items: center; gap: 12px; }
    .ahb-cup { font-size: clamp(1.8rem, 2.6vw, 2.4rem); }
    .ahb-winner-name { font-family: var(--font-display); font-size: clamp(1.4rem, 2.2vw, 2rem); text-transform: uppercase; }
    .ahb-winner-note { font-family: var(--font-mono); font-size: .8rem; color: rgba(30, 25, 20, .6); }
    .ahb-waiting { font-family: var(--font-mono); font-size: clamp(.9rem, 1.1vw, 1.05rem); color: rgba(30, 25, 20, .6); }
    .ahb-empty { grid-column: 1 / -1; align-self: center; color: var(--ink-dim); text-align: center; font-family: var(--font-mono); }
  `]
})
export class AirHockeyBattle {
  @Input() displayData: any;
  @Input() timer = 0;

  sideName(court: any, side: 'a' | 'b'): string {
    return side === 'a' ? court?.a?.playerName ?? '' : court?.b?.playerName ?? '';
  }

  letter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  difficultyLabel(difficulty?: string): string {
    if (difficulty === 'EASY') return 'FACILE';
    if (difficulty === 'HARD') return 'DIFFICILE';
    return 'MEDIA';
  }
}
