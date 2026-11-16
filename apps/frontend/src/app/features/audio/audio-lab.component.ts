import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AUDIO_EVENTS,
  AUDIO_EVENT_ORDER,
  BONUS_ENTRANCE_TYPES,
  type AudioEventDefinition,
  type AudioEventId,
} from '../../core/services/audio-catalog';
import { AudioService } from '../../core/services/audio.service';
import { BED_PROFILES, type BedProfile } from '../../core/services/bed-profiles';

interface AudioCard {
  event: AudioEventDefinition;
  id: AudioEventId;
  variant: number;
  variantLabel: string;
}

/**
 * Regia audio: un pulsante per ogni evento del catalogo, con i controlli che
 * servono all'ascolto di sala. Nessuna logica di gioco: suona e basta, così
 * un suono si prova senza montare un round.
 */
@Component({
  selector: 'app-audio-lab',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lab">
      <header class="lab-head">
        <div>
          <h1>REGIA AUDIO</h1>
          <p class="lab-sub">
            {{ cards().length }} eventi · un pulsante per ascoltarli tutti, senza aprire un round
          </p>
        </div>
        <div class="lab-controls">
          <button class="lab-btn" (click)="toggleMute()" [attr.aria-pressed]="enabled()">
            {{ enabled() ? '🔊 AUDIO ON' : '🔇 MUTO' }}
          </button>
          <label class="lab-slider">
            <span>VOLUME {{ volume() }}%</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              [value]="volume()"
              (input)="setVolume($event)"
              aria-label="Volume generale della regia"
            />
          </label>
          <button class="lab-btn ghost" (click)="stopAll()">■ FERMA TUTTO</button>
        </div>
      </header>

      <p class="lab-status" role="status">
        @if (lastPlayed(); as last) {
          Ultimo evento: <b>{{ last }}</b>
        } @else {
          Pronto. Il primo tocco sblocca l'audio del browser.
        }
      </p>

      <section class="lab-group">
        <h2>TV E SALA</h2>
        <div class="lab-grid">
          @for (card of roomCards(); track card.id) {
            <article class="lab-card" [class.muted]="!enabled()">
              <div class="lab-card-head">
                <span class="lab-source">{{ card.event.source }}</span>
                <code>{{ card.id }}</code>
              </div>
              <h3>{{ card.event.label }}</h3>
              <p class="lab-when">{{ card.event.when }}</p>
              @if (card.event.variants > 1) {
                <button class="lab-variant" (click)="nextVariant(card.id)">
                  VARIANTE {{ card.variant + 1 }}/{{ card.event.variants }}: {{ card.variantLabel }}
                </button>
              }
              <button class="lab-play" (click)="play(card)">
                ▶ SUONA
              </button>
            </article>
          }
        </div>
      </section>

      <section class="lab-group">
        <h2>TAPPETI — UNO PER GIOCO</h2>
        <div class="lab-grid beds">
          @for (bed of beds; track bed.id) {
            <button class="lab-bed" [class.active]="bed.id === bedId()" (click)="playBed(bed)">
              <span class="lab-bed-label">{{ bed.label }}</span>
              <span class="lab-bed-meta">
                {{ bed.bpm }} BPM · {{ bed.chords.length * 2 }} BATTUTE
                @if (bed.id === bedId()) { · IN ONDA }
              </span>
            </button>
          }
        </div>
      </section>

      <section class="lab-group">
        <h2>TELEFONI</h2>
        <div class="lab-grid">
          @for (card of phoneCards(); track card.id) {
            <article class="lab-card" [class.muted]="!enabled()">
              <div class="lab-card-head">
                <span class="lab-source">{{ card.event.source }}</span>
                <code>{{ card.id }}</code>
              </div>
              <h3>{{ card.event.label }}</h3>
              <p class="lab-when">{{ card.event.when }}</p>
              @if (card.event.variants > 1) {
                <button class="lab-variant" (click)="nextVariant(card.id)">
                  VARIANTE {{ card.variant + 1 }}/{{ card.event.variants }}: {{ card.variantLabel }}
                </button>
              }
              <button class="lab-play" (click)="play(card)">
                ▶ SUONA
              </button>
            </article>
          }
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        /* Il body dell'app è fisso e senza scorrimento: la regia audio deve
           scorrere da sola, altrimenti le ultime schede non si raggiungono. */
        height: 100vh;
        overflow-y: auto;
        overscroll-behavior: contain;
        touch-action: pan-y;
        background: var(--bg-0);
        color: var(--coal);
        padding: clamp(16px, 2vw, 32px);
        padding-bottom: 56px;
        box-sizing: border-box;
      }
      .lab-head {
        /* I comandi restano sotto mano anche scorrendo le ventinove schede. */
        position: sticky;
        top: 0;
        z-index: 2;
        background: var(--bg-0);
        padding-top: 8px;
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        padding-bottom: 16px;
        border-bottom: 4px solid var(--coal);
      }
      h1 {
        margin: 0;
        font-family: var(--font-display);
        font-size: clamp(1.8rem, 3vw, 2.6rem);
        letter-spacing: 0.08em;
      }
      .lab-sub {
        margin: 6px 0 0;
        font-family: var(--font-mono);
        font-size: 0.8rem;
        letter-spacing: 0.08em;
        color: var(--ink-dim);
      }
      .lab-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
      }
      .lab-btn {
        padding: 10px 16px;
        border: 3px solid var(--coal);
        background: var(--acid);
        color: var(--coal);
        font-family: var(--font-mono);
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        box-shadow: 4px 4px 0 var(--coal);
        cursor: pointer;
      }
      .lab-btn:active {
        transform: translate(2px, 2px);
        box-shadow: 2px 2px 0 var(--coal);
      }
      .lab-btn.ghost {
        background: var(--paper-hi);
        color: var(--tomato);
      }
      .lab-slider {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-family: var(--font-mono);
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        padding: 6px 10px;
        background: var(--paper-hi);
        border: 3px solid var(--coal);
      }
      .lab-slider input {
        width: 180px;
        accent-color: var(--tomato);
      }
      .lab-status {
        margin: 14px 0 0;
        font-family: var(--font-mono);
        font-size: 0.8rem;
        color: var(--ink-dim);
      }
      .lab-group {
        margin-top: 24px;
      }
      h2 {
        margin: 0 0 12px;
        font-family: var(--font-mono);
        font-size: 0.8rem;
        letter-spacing: 0.18em;
        font-weight: 700;
      }
      .lab-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 14px;
      }
      .lab-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 14px;
        background: var(--paper-hi);
        border: 3px solid var(--coal);
        box-shadow: 5px 5px 0 var(--coal);
        border-radius: 0;
      }
      .lab-card.muted {
        opacity: 0.55;
      }
      .lab-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-family: var(--font-mono);
        font-size: 0.62rem;
        letter-spacing: 0.1em;
      }
      .lab-source {
        padding: 2px 6px;
        border: 2px solid var(--coal);
        background: var(--paper-2);
      }
      code {
        font-size: 0.62rem;
        color: var(--ink-dim);
      }
      h3 {
        margin: 0;
        font-family: var(--font-display);
        font-size: 1.05rem;
        letter-spacing: 0.02em;
      }
      .lab-when {
        margin: 0;
        font-size: 0.78rem;
        color: var(--ink-dim);
        min-height: 2.4em;
      }
      .lab-variant {
        padding: 6px 8px;
        border: 2px dashed var(--coal);
        background: var(--paper-2);
        color: var(--coal);
        font-family: var(--font-mono);
        font-size: 0.66rem;
        letter-spacing: 0.06em;
        cursor: pointer;
        text-align: left;
      }
      .lab-play {
        margin-top: auto;
        padding: 10px;
        border: 3px solid var(--coal);
        background: var(--tomato);
        color: var(--paper-hi);
        font-family: var(--font-mono);
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        cursor: pointer;
      }
      .lab-play:active {
        transform: translate(2px, 2px);
      }
      .lab-grid.beds {
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      }
      .lab-bed {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px;
        text-align: left;
        background: var(--paper-hi);
        border: 3px solid var(--coal);
        box-shadow: 4px 4px 0 var(--coal);
        color: var(--coal);
        cursor: pointer;
        border-radius: 0;
      }
      .lab-bed.active {
        background: var(--acid);
      }
      .lab-bed-label {
        font-family: var(--font-display);
        font-size: 0.95rem;
        letter-spacing: 0.02em;
      }
      .lab-bed-meta {
        font-family: var(--font-mono);
        font-size: 0.62rem;
        letter-spacing: 0.08em;
        color: var(--ink-dim);
      }
      .lab-bed:active {
        transform: translate(2px, 2px);
        box-shadow: 2px 2px 0 var(--coal);
      }
    `,
  ],
})
export class AudioLab {
  private readonly audio = inject(AudioService);

  readonly enabled = computed(() => this.audio.isEnabled());
  readonly volume = signal(Math.round(this.audio.masterVolume() * 100));
  readonly lastPlayed = signal<string | null>(null);
  readonly beds = Object.values(BED_PROFILES);
  readonly bedId = signal('');

  private readonly variantById = signal<Record<string, number>>({});

  readonly cards = computed<AudioCard[]>(() => {
    const variants = this.variantById();
    return AUDIO_EVENT_ORDER.map((id) => {
      const event = AUDIO_EVENTS[id];
      const variant = variants[id] ?? 0;
      return { event, id, variant, variantLabel: this.variantLabel(id, variant) };
    });
  });

  readonly roomCards = computed(() => this.cards().filter((card) => card.event.bus !== 'phone'));
  readonly phoneCards = computed(() => this.cards().filter((card) => card.event.bus === 'phone'));

  toggleMute(): void {
    this.audio.toggleAudio();
  }

  /** Prova un tappeto: è quello che sentirà la sala durante quel gioco. */
  playBed(bed: BedProfile): void {
    this.audio.setGameBed(bed.id);
    this.audio.startAmbient();
    this.bedId.set(bed.id);
    this.lastPlayed.set(`Tappeto: ${bed.label}`);
  }

  setVolume(raw: Event): void {
    const target = raw.target as HTMLInputElement | null;
    const value = Number(target?.value ?? 100);
    this.audio.setMasterVolume(value / 100);
    this.volume.set(Math.round(this.audio.masterVolume() * 100));
    if (this.audio.isEnabled()) this.audio.play('tick');
  }

  stopAll(): void {
    this.audio.stopAll();
    this.audio.stopAmbient();
    this.lastPlayed.set(null);
    this.bedId.set('');
  }

  nextVariant(id: AudioEventId): void {
    const total = AUDIO_EVENTS[id].variants;
    const current = this.variantById()[id] ?? 0;
    this.variantById.set({ ...this.variantById(), [id]: (current + 1) % total });
  }

  play(card: AudioCard): void {
    const played = this.audio.play(card.id, card.variant);
    this.lastPlayed.set(
      played
        ? `${card.event.label}${card.variantLabel ? ` · ${card.variantLabel}` : ''}`
        : `${card.event.label} — saltato (muto o troppo ravvicinato)`,
    );
  }

  private variantLabel(id: AudioEventId, variant: number): string {
    if (id === 'bonusEntrance') return BONUS_ENTRANCE_TYPES[variant] ?? '';
    if (id === 'podiumReveal') return ['TERZO POSTO', 'SECONDO POSTO', 'PRIMO POSTO'][variant] ?? '';
    if (id === 'rankReveal') return variant === 0 ? 'QUINTO POSTO' : 'QUARTO POSTO';
    return '';
  }
}
