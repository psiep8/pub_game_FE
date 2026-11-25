import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BonusType } from '../../../shared/enums/bonus-type';
import type { BonusEntranceEntry } from '../../../shared/bonus-entrances';

/**
 * Ingresso scenografico dei cinque bonus.
 *
 * Ogni variante ha una luce, un ritmo e una scossa diversi: il palco del
 * Karaoke, il tavolo del Blackjack, le cinque manche del Casino, il cancello
 * del Cavallo e il buio del numero secco. Niente strobo: le animazioni sono
 * lente e si spengono con `prefers-reduced-motion`.
 */
@Component({
  selector: 'app-bonus-entrance',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="be-overlay" [class]="'be-overlay be-' + type + ' be-motion-' + motion()"
      [class.be-paused]="paused" role="status" aria-live="polite">
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
    .be-KARAOKE { --be-accent: var(--tomato); }
    .be-BLACKJACK { --be-accent: var(--mustard); }
    .be-CASINO_FIVE { --be-accent: var(--acid); }
    .be-CAVALLO { --be-accent: var(--paper-hi); }
    .be-CASINO_NUMBER { --be-accent: var(--mustard); background: #070706; }

    /* La pausa ferma anche l'ingresso: la scena resta, il tempo no. */
    .be-paused, .be-paused * { animation-play-state: paused !important; }

    /* Cinque movimenti diversi, uno per tipo di sorpresa. */
    .be-motion-alarm .be-alarm { opacity: .8; animation-duration: .8s; }
    .be-motion-alarm .be-beam { animation-duration: 1.4s; }
    .be-motion-drop .be-shock { animation-name: be-drop-scene; animation-duration: 1.1s; }
    .be-motion-slam .be-shock { animation: be-slam 700ms cubic-bezier(.2, .8, .2, 1) both; }
    .be-motion-spin .be-beam { animation-duration: 5.5s; }
    .be-motion-spin .be-card { animation: be-card-spin 1.6s cubic-bezier(.2, .8, .2, 1) both; }

    .be-beam {
      position: absolute;
      inset: -20%;
      background: conic-gradient(from 0deg, transparent 0 18%, color-mix(in srgb, var(--be-accent) 26%, transparent) 22%, transparent 28% 68%, color-mix(in srgb, var(--be-accent) 20%, transparent) 72%, transparent 78%);
      animation: be-sweep 2.6s linear infinite;
      opacity: .8;
      pointer-events: none;
    }
    .be-CASINO_FIVE .be-beam { animation-duration: 3.2s; }
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
    .be-CASINO_FIVE .be-alarm { opacity: .7; animation-duration: 1.1s; }
    .be-BLACKJACK .be-alarm { opacity: .35; }

    .be-shock { animation: be-shock 2.6s cubic-bezier(.2, .8, .2, 1) both; }
    .be-CAVALLO .be-shock { animation-duration: 1.2s; }
    .be-KARAOKE .be-shock { animation-duration: 1.6s; }
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
    .be-CASINO_FIVE .be-card { transform: rotate(1.2deg); }
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
    @keyframes be-drop-scene {
      0% { transform: translateY(-60px); opacity: 0; }
      70% { transform: translateY(10px); opacity: 1; }
      100% { transform: none; }
    }
    @keyframes be-slam {
      0% { transform: scale(1.5); opacity: 0; }
      60% { transform: scale(.97); opacity: 1; }
      100% { transform: none; }
    }
    @keyframes be-card-spin {
      0% { transform: rotate(-14deg) scale(.85); opacity: 0; }
      100% { transform: rotate(-1deg) scale(1); opacity: 1; }
    }
    @keyframes be-drop {
      0% { transform: translateY(-40px) scale(.7) rotate(-12deg); opacity: 0; }
      60% { transform: translateY(6px) scale(1.08) rotate(4deg); opacity: 1; }
      100% { transform: translateY(0) scale(1) rotate(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .be-beam, .be-alarm, .be-shock, .be-icon, .be-card { animation: none; }
      .be-alarm { opacity: .25; }
    }
  `],
})
export class BonusEntrance {
  @Input({ required: true }) type: BonusType = 'KARAOKE';
  /** L'ingresso scelto per questa partita; senza, resta la variante del tipo. */
  @Input() entry: BonusEntranceEntry | null = null;
  /** La pausa ferma l'ingresso a metà scena. */
  @Input() paused = false;

  motion(): string {
    return this.entry?.motion ?? 'sweep';
  }

  icon(): string {
    if (this.entry?.icon) return this.entry.icon;
    switch (this.type) {
      case 'BLACKJACK': return '🃏';
      case 'CASINO_FIVE': return '🎰';
      case 'CAVALLO': return '🐎';
      case 'CASINO_NUMBER': return '🎯';
      default: return '🎤';
    }
  }

  kicker(): string {
    if (this.entry?.kicker) return this.entry.kicker;
    switch (this.type) {
      case 'BLACKJACK': return 'IL BANCO SI APRE';
      case 'CASINO_FIVE': return 'CINQUE GIRI, UN TAVOLO';
      case 'CAVALLO': return 'AI CANCELLI';
      case 'CASINO_NUMBER': return 'ULTIMO GIRO';
      default: return 'SI ACCENDE IL PALCO';
    }
  }

  heading(): string {
    switch (this.type) {
      case 'BLACKJACK': return 'BLACKJACK';
      case 'CASINO_FIVE': return 'CINQUE MANCHE';
      case 'CAVALLO': return 'CAVALLO DI BATTAGLIA';
      case 'CASINO_NUMBER': return 'UN NUMERO, TUTTO';
      default: return 'KARAOKE';
    }
  }

  sub(): string {
    switch (this.type) {
      case 'BLACKJACK': return 'Un turno per tavolo, dal fondo della classifica: il banco si ferma a 17.';
      case 'CASINO_FIVE': return 'Cinque manche, una girata ciascuna: colore, dozzina, parità, alto/basso, numero.';
      case 'CAVALLO': return 'Otto domande, un podio: il premio lo consegnano barista e presentatore.';
      case 'CASINO_NUMBER': return 'La finale: una pallina, trentasette caselle, 1000 punti sul numero esatto.';
      default: return 'Cinque manche, un microfono: il primo tavolo che prenota canta e incassa il gettone.';
    }
  }

  rule(): string {
    switch (this.type) {
      case 'BLACKJACK': return 'VITTORIA: PREMIO DEL BAR · SCONFITTA 0';
      case 'CASINO_FIVE': return '100 · 200 · 100 · 100 · 1000';
      case 'CAVALLO': return 'PREMIO DEL BAR AL VINCITORE';
      case 'CASINO_NUMBER': return 'NUMERO ESATTO +1000';
      default: return 'GETTONI +100 / +150 / +200 / +250 / +300';
    }
  }
}
