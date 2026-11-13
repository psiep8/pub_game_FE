import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BasketBonusStage } from '../basket/basket-bonus-stage.component';
import { BiglieBonus } from '../biglie/biglie-bonus.component';
import { CasinoBonus } from '../casino/casino-bonus.component';
import { CavalloBonus } from '../cavallo/cavallo-bonus.component';

type PreviewKind = 'casino' | 'basket' | 'cavallo' | 'biglie';

interface PreviewCard {
  id: PreviewKind;
  icon: string;
  title: string;
  subtitle: string;
  note: string;
}

const PREVIEW_TYPES: PreviewKind[] = ['casino', 'basket', 'cavallo', 'biglie'];

const PREVIEW_CARDS: PreviewCard[] = [
  {
    id: 'casino',
    icon: '🎰',
    title: 'CASINO',
    subtitle: 'QUATTRO MANCHE · ROULETTE',
    note: 'Colore, dozzina, sestina e numero secco. La ruota resta in TV.',
  },
  {
    id: 'basket',
    icon: '🏀',
    title: 'BASKET',
    subtitle: 'TRE MANCHE AL CANESTRO',
    note: 'La TV mostra ferro, timer e classifica; si tira dal telefono.',
  },
  {
    id: 'cavallo',
    icon: '🐎',
    title: 'CAVALLO',
    subtitle: 'OTTO DOMANDE FLASH',
    note: 'Categoria scelta dai tavoli e tabellone che si riordina.',
  },
  {
    id: 'biglie',
    icon: '🎱',
    title: 'BIGLIE',
    subtitle: 'QUATTRO GARE · QUATTRO FONDI',
    note: 'Pista fisica, corsie, bump e classifica cumulativa.',
  },
];

@Component({
  selector: 'app-bonus-preview',
  standalone: true,
  imports: [CommonModule, RouterLink, CasinoBonus, BasketBonusStage, CavalloBonus, BiglieBonus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!kind()) {
      <main class="bp-index">
        <header class="bp-head">
          <span class="bp-stamp">BONUS PREVIEW</span>
          <h1>QUATTRO BONUS, UN SOLO BANCO DI PROVA</h1>
          <p>
            Anteprima TV con dati demo. Ogni scheda apre la stessa esperienza che vede il
            pubblico, senza aspettare la fine di un atto.
          </p>
        </header>

        <section class="bp-grid">
          @for (card of cards; track card.id; let i = $index) {
            <a class="bp-card" [routerLink]="['/bonus-preview', card.id]">
              <span class="bp-number">{{ (i + 1).toString().padStart(2, '0') }}</span>
              <span class="bp-icon">{{ card.icon }}</span>
              <h2>{{ card.title }}</h2>
              <strong>{{ card.subtitle }}</strong>
              <p>{{ card.note }}</p>
              <span class="bp-open">APRI {{ card.title }} →</span>
            </a>
          }
        </section>

        <footer class="bp-foot">
          <span>USCITA RAPIDA</span>
          <a routerLink="/tv">TV</a>
          <a routerLink="/admin">ADMIN</a>
          <a href="/basket" target="_blank" rel="noreferrer">PHONE /basket</a>
        </footer>
      </main>
    } @else {
      @if (!capture) {
      <nav class="bp-bar" aria-label="Selettore bonus preview">
        <span class="bp-bar-tag">BONUS PREVIEW</span>
        @for (card of cards; track card.id) {
          <a
            [routerLink]="['/bonus-preview', card.id]"
            [class.on]="kind() === card.id"
            [attr.aria-current]="kind() === card.id ? 'page' : null">
            {{ card.icon }} {{ card.title }}
          </a>
        }
        <a class="bp-phone" href="/basket" target="_blank" rel="noreferrer">📱 /basket</a>
      </nav>
      }

      <div class="bp-live" [class.capture]="capture">
        @switch (kind()) {
          @case ('casino') {
          <app-casino-bonus [gameId]="1" [players]="players" [preview]="true" />
        }
        @case ('basket') {
          <app-basket-bonus-stage [secondsLeft]="72" [scores]="scores" [players]="players" />
        }
        @case ('cavallo') {
          <app-cavallo-bonus [gameId]="1" [players]="players" [categories]="categories" [preview]="true" />
        }
          @case ('biglie') {
            <app-biglie-bonus [gameId]="1" [players]="players" [preview]="true" />
          }
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100dvh;
      color: var(--paper);
      font-family: var(--font);
    }
    .bp-index {
      min-height: 100dvh;
      padding: clamp(20px, 4vw, 56px);
      background-color: var(--bg-0);
      background-image:
        radial-gradient(color-mix(in srgb, var(--ink) 10%, transparent) 1px, transparent 1px),
        linear-gradient(115deg, transparent 0 64%, color-mix(in srgb, var(--tomato) 8%, transparent) 64% 65%, transparent 65%);
      background-size: 16px 16px, 100% 100%;
    }
    .bp-head {
      max-width: 1050px;
      margin: 0 auto clamp(24px, 4vw, 48px);
      border-left: 10px solid var(--tomato);
      padding-left: clamp(14px, 2vw, 24px);
    }
    .bp-stamp {
      display: inline-block;
      padding: 4px 10px;
      background: var(--acid);
      color: var(--coal);
      border: 2px solid var(--coal);
      box-shadow: 4px 4px 0 var(--coal);
      font-family: var(--font-mono);
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.18em;
      transform: rotate(-1.2deg);
    }
    .bp-head h1 {
      margin: 16px 0 8px;
      color: var(--paper);
      font-family: var(--font-display);
      font-size: clamp(2rem, 5vw, 4.4rem);
      font-weight: 400;
      line-height: 0.95;
      text-transform: uppercase;
    }
    .bp-head p {
      max-width: 720px;
      margin: 0;
      color: color-mix(in srgb, var(--ink) 68%, transparent);
      font-family: var(--font-mono);
      font-size: clamp(0.75rem, 1.1vw, 0.95rem);
      line-height: 1.5;
    }
    .bp-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: clamp(10px, 1.8vw, 22px);
      max-width: 1250px;
      margin: 0 auto;
    }
    .bp-card {
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 300px;
      padding: 18px;
      background: var(--paper);
      color: var(--coal);
      border: 4px solid var(--coal);
      box-shadow: 8px 8px 0 var(--tomato);
      text-decoration: none;
      transition: transform 0.12s ease-out, box-shadow 0.12s ease-out;
    }
    .bp-card:nth-child(2) { box-shadow: 8px 8px 0 var(--mustard); }
    .bp-card:nth-child(3) { box-shadow: 8px 8px 0 var(--mint); }
    .bp-card:nth-child(4) { box-shadow: 8px 8px 0 var(--acid); }
    .bp-card:hover {
      transform: translate(-2px, -2px);
      box-shadow: 12px 12px 0 var(--coal);
    }
    .bp-number {
      align-self: flex-end;
      color: color-mix(in srgb, var(--coal) 30%, transparent);
      font-family: var(--font-mono);
      font-size: 0.72rem;
      font-weight: 800;
    }
    .bp-icon { margin-top: 4px; font-size: clamp(2.2rem, 4vw, 3.4rem); line-height: 1; }
    .bp-card h2 {
      margin: 18px 0 4px;
      font-family: var(--font-display);
      font-size: clamp(1.6rem, 2.8vw, 2.5rem);
      font-weight: 400;
      line-height: 0.92;
    }
    .bp-card strong {
      color: var(--tomato);
      font-family: var(--font-mono);
      font-size: 0.62rem;
      letter-spacing: 0.1em;
    }
    .bp-card p {
      flex: 1;
      margin: 14px 0;
      color: color-mix(in srgb, var(--coal) 62%, transparent);
      font-family: var(--font-mono);
      font-size: 0.78rem;
      line-height: 1.45;
    }
    .bp-open {
      padding-top: 10px;
      border-top: 2px dashed color-mix(in srgb, var(--coal) 25%, transparent);
      font-family: var(--font-mono);
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.06em;
    }
    .bp-foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      max-width: 1250px;
      margin: 28px auto 0;
      color: color-mix(in srgb, var(--ink) 50%, transparent);
      font-family: var(--font-mono);
      font-size: 0.68rem;
      letter-spacing: 0.14em;
    }
    .bp-foot a {
      color: var(--paper);
      border-bottom: 1px solid var(--tomato);
      text-decoration: none;
    }
    .bp-live {
      position: relative;
      height: calc(100dvh - 48px);
      margin-top: 48px;
    }
    .bp-live.capture {
      height: 100dvh;
      margin-top: 0;
    }
    .bp-bar {
      position: fixed;
      top: 8px;
      left: 8px;
      z-index: 120;
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 4px;
      max-width: calc(100vw - 16px);
      overflow-x: auto;
      padding: 5px;
      background: color-mix(in srgb, var(--coal) 92%, transparent);
      border: 2px solid var(--paper);
      box-shadow: 4px 4px 0 var(--tomato);
      font-family: var(--font-mono);
    }
    .bp-bar-tag {
      padding: 4px 7px;
      color: var(--acid);
      font-size: 0.58rem;
      font-weight: 800;
      letter-spacing: 0.12em;
    }
    .bp-bar a {
      padding: 4px 7px;
      color: var(--paper);
      border: 1px solid transparent;
      font-size: 0.6rem;
      font-weight: 700;
      text-decoration: none;
    }
    .bp-bar a:hover,
    .bp-bar a.on {
      color: var(--coal);
      background: var(--acid);
      border-color: var(--paper);
    }
    .bp-phone { color: var(--mint) !important; }
    @media (max-width: 900px) {
      .bp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .bp-card { min-height: 250px; }
    }
    @media (max-width: 700px) {
      .bp-bar-tag { display: none; }
      .bp-bar a { padding: 4px 6px; font-size: 0.56rem; }
    }
    @media (max-width: 560px) {
      .bp-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class BonusPreview {
  private readonly route = inject(ActivatedRoute);

  readonly cards = PREVIEW_CARDS;
  readonly players = ['Anna', 'Luca', 'Marco', 'Sara', 'Paolo', 'Giulia', 'Davide', 'Elena'];
  readonly categories = [
    { id: 1, name: 'STORIA', emoji: '🏛️', active: true },
    { id: 2, name: 'SCIENZA', emoji: '🔬', active: true },
    { id: 3, name: 'CINEMA', emoji: '🎬', active: true },
    { id: 4, name: 'SPORT', emoji: '🏅', active: true },
  ];
  readonly scores = [
    { playerName: 'Anna', score: 18, baskets: 5 },
    { playerName: 'Luca', score: 14, baskets: 4 },
    { playerName: 'Marco', score: 11, baskets: 3 },
    { playerName: 'Sara', score: 7, baskets: 2 },
    { playerName: 'Paolo', score: 6, baskets: 2 },
    { playerName: 'Giulia', score: 3, baskets: 1 },
  ];

  /** Le catture TV nascondono la toolbar e usano tutto il viewport. */
  readonly capture =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('capture');

  readonly kind = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const value = params.get('type') as PreviewKind | null;
        return value && PREVIEW_TYPES.includes(value) ? value : null;
      }),
    ),
    { initialValue: this.currentKind() },
  );

  private currentKind(): PreviewKind | null {
    const value = this.route.snapshot.paramMap.get('type') as PreviewKind | null;
    return value && PREVIEW_TYPES.includes(value) ? value : null;
  }
}
