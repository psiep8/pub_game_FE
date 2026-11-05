import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV di Bomba: mostra i possessori, le scintille, i passaggi e gli scoppi.
 * Non mostra mai il valore esatto della miccia: solo il livello di pericolo.
 */
@Component({
  selector: 'app-bomba',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="bomba-wrap">
      <header class="bomba-head">
        <div class="bomba-kicker">💣 BOMBA</div>
        <h2 class="bomba-title">
          @if (displayData?.active === false) {
            ROUND TERMINATO
          } @else {
            {{ displayData?.bombs?.length || 0 }} BOMBE IN GIOCO
          }
        </h2>
        <div class="bomba-round-clock">{{ timer }}s</div>
      </header>

      @if (latestEvent; as event) {
        @if (event.kind === 'explode' || event.kind === 'pass' || event.kind === 'wrong' || event.kind === 'pass_timeout') {
          <div class="bomba-event" [class.explode]="event.kind === 'explode'">
            {{ eventText(event) }}
          </div>
        }
      }

      <div class="bomba-stage">
        @for (bomb of bombs; track bomb.id) {
          <div
            class="bomb-card"
            [class.danger-low]="bomb.danger === 'LOW'"
            [class.danger-medium]="bomb.danger === 'MEDIUM'"
            [class.danger-high]="bomb.danger === 'HIGH'"
          >
            <div class="bomb-sparks" aria-hidden="true">
              <span>✦</span><span>✧</span><span>✦</span>
            </div>
            <div class="bomb-emoji">💣</div>
            <div class="bomb-holder">{{ bomb.holder }}</div>
            <div class="bomb-danger">{{ dangerLabel(bomb.danger) }}</div>

            @if (bomb.question) {
              <p class="bomb-question">{{ bomb.question }}</p>
              <div class="bomb-options">
                @for (option of bomb.options; track $index) {
                  <span class="bomb-option">{{ letter($index) }}. {{ option }}</span>
                }
              </div>
              <div class="bomb-answer-clock">{{ bomb.questionSecondsLeft }}s</div>
            } @else {
              <p class="bomb-question muted">Passaggio in corso…</p>
            }
          </div>
        } @empty {
          <div class="bomba-empty">
            <div class="bomb-emoji">💣</div>
            <p>Nessuna bomba attiva</p>
          </div>
        }
      </div>

      <div class="bomba-bottom">
        <div class="bomba-scores">
          <div class="bomba-panel-head">PUNTI ROUND</div>
          @for (row of scoreRows; track row.name) {
            <div class="bomba-score-row">
              <span class="bomba-score-name">{{ row.name }}</span>
              <span class="bomba-score-value">{{ row.score }}</span>
              <span class="bomba-score-delta" [class.positive]="row.score > 1000" [class.negative]="row.score < 1000">
                {{ delta(row.score) }}
              </span>
            </div>
          }
        </div>

        <div class="bomba-log">
          <div class="bomba-panel-head">ULTIMI EVENTI</div>
          @for (event of recentEvents; track event.id) {
            <div class="bomba-log-row" [class.explode]="event.kind === 'explode'">
              <span>{{ eventText(event) }}</span>
            </div>
          } @empty {
            <div class="bomba-log-row muted">La miccia sta scorrendo…</div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bomba-wrap {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: clamp(8px, 1.4vh, 16px);
      padding: clamp(12px, 2vw, 28px);
      color: var(--paper);
    }
    .bomba-head { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; text-align: center; }
    .bomba-kicker {
      padding: 4px 11px; background: var(--tomato); color: var(--paper-hi);
      border: 2px solid var(--paper-hi); font-family: var(--font-mono);
      font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; letter-spacing: .16em;
      transform: rotate(-1.2deg);
    }
    .bomba-title { margin: 0; font-family: var(--font-display); font-size: clamp(1.4rem, 3vw, 2.4rem); font-weight: 400; text-transform: uppercase; letter-spacing: .04em; }
    .bomba-round-clock { font-family: var(--font-mono); font-size: clamp(.9rem, 1.5vw, 1.3rem); font-weight: 700; color: var(--acid); }
    .bomba-event {
      padding: 6px 16px; border: 2px solid var(--paper-hi); background: var(--paper-hi);
      color: var(--coal); font-family: var(--font-mono); font-size: clamp(.7rem, 1vw, .9rem);
      font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    }
    .bomba-event.explode { background: var(--tomato); color: var(--paper-hi); animation: bomba-shake .35s ease-in-out; }
    .bomba-stage {
      width: min(1250px, 96vw); flex: 1; min-height: 0;
      display: flex; align-items: stretch; justify-content: center; gap: clamp(10px, 2vw, 24px);
    }
    .bomb-card {
      position: relative; flex: 1; min-width: 0; max-width: 390px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; padding: clamp(12px, 2vh, 24px); text-align: center;
      border: 4px solid var(--coal); background: var(--paper); color: var(--coal);
      box-shadow: 10px 10px 0 var(--tomato); overflow: hidden;
    }
    .bomb-card.danger-medium { box-shadow: 10px 10px 0 var(--acid); }
    .bomb-card.danger-high { box-shadow: 10px 10px 0 var(--tomato); animation: bomb-breathe .7s infinite alternate; }
    .bomb-sparks { position: absolute; inset: 0; pointer-events: none; opacity: .5; }
    .bomb-sparks span { position: absolute; font-size: clamp(1.4rem, 2.4vw, 2.4rem); color: var(--tomato); animation: spark 1s infinite; }
    .bomb-sparks span:nth-child(1) { top: 12%; left: 12%; }
    .bomb-sparks span:nth-child(2) { top: 18%; right: 14%; animation-delay: .35s; }
    .bomb-sparks span:nth-child(3) { bottom: 18%; left: 18%; animation-delay: .65s; }
    .bomb-card.danger-low .bomb-sparks { opacity: .16; }
    .bomb-card.danger-medium .bomb-sparks { opacity: .42; }
    .bomb-card.danger-high .bomb-sparks { opacity: .9; }
    .bomb-card.danger-high .bomb-sparks span { animation-duration: .45s; }
    .bomb-emoji { font-size: clamp(3rem, 7vw, 5rem); line-height: 1; filter: drop-shadow(0 6px 0 rgba(0,0,0,.18)); }
    .bomb-holder { font-family: var(--font-display); font-size: clamp(1.3rem, 2.6vw, 2rem); line-height: 1; text-transform: uppercase; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bomb-danger { font-family: var(--font-mono); font-size: .65rem; font-weight: 700; letter-spacing: .18em; color: var(--tomato); }
    .bomb-question { margin: 4px 0 0; font-size: clamp(.9rem, 1.45vw, 1.15rem); font-weight: 800; line-height: 1.25; }
    .bomb-question.muted { opacity: .55; font-weight: 500; }
    .bomb-options { display: flex; flex-direction: column; gap: 5px; width: 100%; }
    .bomb-option { padding: 5px 8px; border: 1px solid rgba(30,25,20,.26); background: rgba(30,25,20,.06); font-size: clamp(.7rem, 1.05vw, .9rem); text-align: left; }
    .bomb-answer-clock { font-family: var(--font-mono); color: var(--tomato); font-size: 1.1rem; font-weight: 700; }
    .bomba-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--ink-dim); }
    .bomba-bottom { width: min(1250px, 96vw); display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; }
    .bomba-scores, .bomba-log { border: 2px solid var(--paper-hi); padding: 8px 12px; background: rgba(0,0,0,.12); }
    .bomba-panel-head { color: var(--acid); font-family: var(--font-mono); font-size: .63rem; font-weight: 700; letter-spacing: .16em; margin-bottom: 5px; }
    .bomba-score-row { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,.12); font-size: clamp(.72rem, 1.1vw, .9rem); }
    .bomba-score-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bomba-score-value { font-family: var(--font-mono); font-weight: 700; }
    .bomba-score-delta { font-family: var(--font-mono); font-size: .78em; color: var(--ink-dim); min-width: 46px; text-align: right; }
    .bomba-score-delta.positive { color: var(--acid); }
    .bomba-score-delta.negative { color: var(--tomato); }
    .bomba-log-row { padding: 2px 0; font-family: var(--font-mono); font-size: clamp(.62rem, .9vw, .76rem); color: var(--ink-dim); }
    .bomba-log-row.explode { color: var(--tomato); }
    .muted { opacity: .55; }
    @keyframes spark { 0%, 100% { transform: scale(.7) rotate(0deg); opacity: .45; } 50% { transform: scale(1.15) rotate(18deg); opacity: 1; } }
    @keyframes bomb-breathe { from { transform: scale(.99); } to { transform: scale(1.015); } }
    @keyframes bomba-shake { 25% { transform: translateX(-5px) rotate(-1deg); } 75% { transform: translateX(5px) rotate(1deg); } }
    @media (max-width: 760px) {
      .bomba-stage { gap: 8px; }
      .bomb-card { padding: 10px; box-shadow: 6px 6px 0 var(--tomato); }
      .bomb-option { font-size: .65rem; }
      .bomba-bottom { grid-template-columns: 1fr; }
    }
  `],
})
export class Bomba {
  @Input() displayData: any;
  @Input() timer = 0;

  get bombs(): any[] {
    return Array.isArray(this.displayData?.bombs) ? this.displayData.bombs : [];
  }

  get scoreRows(): Array<{ name: string; score: number }> {
    const scores = this.displayData?.scores ?? {};
    return Object.entries(scores)
      .map(([name, score]) => ({ name, score: Number(score) }))
      .filter((row) => Number.isFinite(row.score))
      .sort((a, b) => b.score - a.score);
  }

  get recentEvents(): any[] {
    const events = Array.isArray(this.displayData?.events) ? this.displayData.events : [];
    return [...events].reverse().slice(0, 5);
  }

  get latestEvent(): any {
    return this.recentEvents[0] ?? null;
  }

  letter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  delta(score: number): string {
    const value = Math.round(Number(score) - 1000);
    return value > 0 ? `+${value}` : String(value);
  }

  dangerLabel(danger: string): string {
    if (danger === 'HIGH') return 'MICCIA CRITICA';
    if (danger === 'MEDIUM') return 'SCINTILLE';
    return 'MICCIA LENTA';
  }

  eventText(event: any): string {
    if (!event) return '';
    switch (event.kind) {
      case 'explode':
        return `💥 ${event.player} −300`;
      case 'pass':
        return `→ ${event.player}`;
      case 'wrong':
        return `✕ ${event.player}: miccia −3s`;
      case 'pass_timeout':
        return `⌛ ${event.player}: miccia −3s`;
      case 'timeout':
        return `⌛ ${event.player}: miccia −3s`;
      case 'correct':
        return `✓ ${event.player} passa la bomba`;
      case 'spawn':
        return `💣 ${event.player} riceve una bomba`;
      case 'start':
        return 'Bombe in gioco';
      case 'pause':
        return 'Round in pausa';
      case 'resume':
        return 'Round ripreso';
      case 'end':
        return 'Fine round';
      default:
        return String(event.kind ?? '');
    }
  }
}
