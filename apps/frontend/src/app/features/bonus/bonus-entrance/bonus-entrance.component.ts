import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BonusType } from '../../../shared/enums/bonus-type';

/**
 * Ingresso scenografico dei cinque bonus.
 *
 * Ogni variante ha una luce, un ritmo e una scossa diversi: il rosso/nero del
 * Casino, il tavolo del Blackjack, la dozzina acida, il cancello del Cavallo e
 * il buio del numero secco. Niente strobo: le animazioni sono lente e si
 * spengono con `prefers-reduced-motion`.
 */
@Component({
  selector: 'app-bonus-entrance',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="be-overlay" [class]="'be-overlay be-' + type" role="status" aria-live="polite">
      <div class="be-beam" aria-hidden="true"></div>
      <div class="be-alarm" aria-hidden="true"></div>
      <div class="be-shock">
        <div class="be-card">
          <span class="be-icon">{{ icon() }}</span>
          <span class="be-kicker">{{ kicker() }}</span>
          <h1>{{ heading() }}</h1>
          <p>{{ sub() }}</p>
          <span class="be-rule">{{ rule() }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .be-overlay {
      position: fixed;
      inset: 0;
      z-index: 120;
      display: grid;
      place-items: center;
      overflow: hidden;
      padding: clamp(16px, 3vw, 42px);
      background:
        radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--be-accent) 34%, transparent) 0%, transparent 42%),
        radial-gradient(circle at 50% 120%, color-mix(in srgb, var(--be-accent) 18%, transparent) 0%, transparent 40%),
        var(--coal);
      color: var(--paper);
      --be-accent: var(--paper-hi);
    }
    .be-CASINO_COLOR { --be-accent: var(--tomato); }
    .be-BLACKJACK { --be-accent: var(--mustard); }
    .be-CASINO_DOZEN { --be-accent: var(--acid); }
    .be-CAVALLO { --be-accent: var(--paper-hi); }
    .be-CASINO_NUMBER { --be-accent: var(--mustard); background: #070706; }

    .be-beam {
      position: absolute;
      inset: -20%;
      background: conic-gradient(from 0deg, transparent 0 18%, color-mix(in srgb, var(--be-accent) 26%, transparent) 22%, transparent 28% 68%, color-mix(in srgb, var(--be-accent) 20%, transparent) 72%, transparent 78%);
      animation: be-sweep 2.6s linear infinite;
      opacity: .8;
      pointer-events: none;
    }
    .be-CASINO_NUMBER .be-beam { animation-duration: 4.2s; opacity: .5; }
    .be-BLACKJACK .be-beam { animation-duration: 3.8s; }
    .be-CAVALLO .be-beam { animation-duration: 1.8s; }

    .be-alarm {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        -45deg,
        transparent 0 18px,
        color-mix(in srgb, var(--be-accent) 10%, transparent) 18px 22px
      );
      opacity: 0;
      animation: be-alarm 2.6s ease-in-out infinite;
      pointer-events: none;
    }
    .be-CASINO_DOZEN .be-alarm { opacity: .7; animation-duration: 1.1s; }
    .be-BLACKJACK .be-alarm { opacity: .35; }

    .be-shock { animation: be-shock 2.6s cubic-bezier(.2, .8, .2, 1) both; }
    .be-CAVALLO .be-shock { animation-duration: 1.2s; }
    .be-CASINO_NUMBER .be-shock { animation-duration: 3.4s; }

    .be-card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      width: min(760px, 88vw);
      padding: clamp(22px, 4vw, 52px) clamp(20px, 4vw, 56px);
      border: 4px solid var(--be-accent);
      background: var(--paper-hi);
      color: var(--coal);
      box-shadow: 14px 14px 0 var(--be-accent);
      text-align: center;
      transform: rotate(-1deg);
    }
    .be-CASINO_DOZEN .be-card { transform: rotate(1.2deg); }
    .be-CASINO_NUMBER .be-card { transform: none; }
    .be-icon { font-size: clamp(2.6rem, 6vw, 5rem); line-height: 1; animation: be-drop 1.2s cubic-bezier(.2, .8, .2, 1.3) both; }
    .be-kicker {
      padding: 3px 10px;
      border: 2px solid var(--coal);
      background: var(--be-accent);
      color: var(--coal);
      font-family: var(--font-mono);
      font-size: clamp(.58rem, 1vw, .8rem);
      font-weight: 800;
      letter-spacing: .18em;
    }
    h1 {
      margin: 0;
      font-family: var(--font-display);
      font-size: clamp(1.8rem, 5vw, 4.4rem);
      font-weight: 400;
      line-height: .9;
      letter-spacing: .02em;
      text-transform: uppercase;
    }
    p { margin: 0; max-width: 46ch; font-size: clamp(.9rem, 1.4vw, 1.12rem); line-height: 1.35; }
    .be-rule {
      margin-top: 6px;
      padding-top: 10px;
      border-top: 3px solid var(--coal);
      font-family: var(--font-mono);
      font-size: clamp(.62rem, .95vw, .78rem);
      font-weight: 700;
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    @keyframes be-sweep { to { transform: rotate(360deg); } }
    @keyframes be-alarm { 0%, 100% { opacity: .1; } 50% { opacity: .7; } }
    @keyframes be-shock {
      0% { transform: translate(-18px, 8px) rotate(-2deg); opacity: 0; }
      14% { transform: translate(12px, -6px) rotate(1.4deg); opacity: 1; }
      22% { transform: translate(-8px, 4px) rotate(-1deg); }
      30% { transform: translate(4px, -2px) rotate(.4deg); }
      38%, 100% { transform: translate(0, 0) rotate(0); opacity: 1; }
    }
    @keyframes be-drop {
      0% { transform: translateY(-40px) scale(.7) rotate(-12deg); opacity: 0; }
      60% { transform: translateY(6px) scale(1.08) rotate(4deg); opacity: 1; }
      100% { transform: translateY(0) scale(1) rotate(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .be-beam, .be-alarm, .be-shock, .be-icon { animation: none; }
      .be-alarm { opacity: .25; }
    }
  `],
})
export class BonusEntrance {
  @Input({ required: true }) type: BonusType = 'CASINO_COLOR';

  icon(): string {
    switch (this.type) {
      case 'BLACKJACK': return '🃏';
      case 'CASINO_DOZEN': return '🎰';
      case 'CAVALLO': return '🐎';
      case 'CASINO_NUMBER': return '🎯';
      default: return '🔴';
    }
  }

  kicker(): string {
    switch (this.type) {
      case 'BLACKJACK': return 'IL BANCO SI APRE';
      case 'CASINO_DOZEN': return 'ALLARME DOZZINA';
      case 'CAVALLO': return 'AI CANCELLI';
      case 'CASINO_NUMBER': return 'ULTIMO GIRO';
      default: return 'LUCI SUL TAVOLO';
    }
  }

  heading(): string {
    switch (this.type) {
      case 'BLACKJACK': return 'BLACKJACK';
      case 'CASINO_DOZEN': return 'DODICI PER VOLTA';
      case 'CAVALLO': return 'CAVALLO DI BATTAGLIA';
      case 'CASINO_NUMBER': return 'UN NUMERO, TUTTO';
      default: return 'NERO O ROSSO';
    }
  }

  sub(): string {
    switch (this.type) {
      case 'BLACKJACK': return 'Un turno per tavolo, dal fondo della classifica: il banco si ferma a 17.';
      case 'CASINO_DOZEN': return 'Tre dozzine, una sola rotazione. La casella giusta paga 120.';
      case 'CAVALLO': return 'Otto domande, un podio: primo 200, secondo 100, terzo 50.';
      case 'CASINO_NUMBER': return 'La finale: una pallina, trentasette caselle, 300 punti sul numero esatto.';
      default: return 'Una sola puntata sul colore: rosso o nero, e la ruota decide.';
    }
  }

  rule(): string {
    switch (this.type) {
      case 'BLACKJACK': return 'VITTORIA +150 · PARI +75 · SCONFITTA 0';
      case 'CASINO_DOZEN': return '1-12 · 13-24 · 25-36';
      case 'CAVALLO': return 'PODIO +200 / +100 / +50';
      case 'CASINO_NUMBER': return 'NUMERO ESATTO +300';
      default: return 'COLORE GIUSTO +100';
    }
  }
}
