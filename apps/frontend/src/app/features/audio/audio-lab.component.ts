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
import { AUDIO_FILES } from '../../core/services/audio-files';
import { BED_LOOPS, type BedLoop } from '../../core/services/bed-loops';
import {
  ACT_BASE,
  ACT_BEDS,
  ACT_NUMBERS,
  GAME_BEDS,
  allBedFiles,
  bedsForAct,
} from '../../core/services/bed-map';
import { formatWeight, measureBeds, type BedWeight } from '../../core/services/bed-weights';
import { ACT_DECKS } from '../../shared/schedule';
import { GAME_MODE_TYPES, type GameModeType } from '../../shared/enums/game-mode-type';

/**
 * Nome breve delle modalità per la regia: qui si legge in fretta, senza il
 * trattino da scheda del manuale.
 */
const GAME_NAMES: Record<GameModeType, string> = {
  QUIZ: 'Quiz',
  IMAGE_BLUR: 'Indovina chi',
  MUSIC: 'Musica',
  WHEEL_OF_FORTUNE: 'Ruota',
  ARENA: 'Arena',
  TIMELINE: 'Timeline',
  TIME_BUZZER: 'Time Buzzer',
  BOMBA: 'Bomba',
  SPEED_RUSH: 'Speed Rush',
  TENNIS_BATTLE: 'Tennis',
  ULTIMA_SPIAGGIA: 'Ultima spiaggia',
  AZZARDO: 'Azzardo',
  BLACKJACK: 'Blackjack',
  BIGLIE: 'Biglie',
};

interface BedRow {
  /** Chiave di tracciamento: 'base' o il tipo di gioco. */
  key: string;
  name: string;
  meta: string;
}

interface AudioCard {
  event: AudioEventDefinition;
  id: AudioEventId;
  variant: number;
  variantLabel: string;
  /** True quando l'evento ha un file registrato e non solo la sintesi. */
  hasFile: boolean;
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
          <button class="lab-btn ghost" (click)="playEveryFile()">▶ TUTTI I FILE</button>
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
                <span class="lab-source">{{ card.hasFile ? 'file' : card.event.source }}</span>
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
        <h2>SOTTOFONDI PER ATTO</h2>
        <div class="lab-grid beds">
          @for (group of actGroups(); track group.act) {
            <article class="lab-bed static">
              <span class="lab-bed-label">{{ group.title }}</span>
              <span class="lab-bed-meta">TOTALE {{ group.total }}</span>
              <ul class="lab-bed-rows">
                @for (row of group.rows; track row.key) {
                  <li>
                    <span>{{ row.name }}</span>
                    <span class="lab-bed-meta">{{ row.meta }}</span>
                  </li>
                }
              </ul>
            </article>
          }
        </div>
      </section>

      <section class="lab-group">
        <h2>SOTTOFONDI PER GIOCO</h2>
        <div class="lab-grid beds">
          @for (card of gameCards(); track card.type) {
            <article class="lab-bed static">
              <span class="lab-bed-label">{{ card.name }}</span>
              <span class="lab-bed-meta">{{ card.bed }}</span>
              <span class="lab-bed-meta">{{ card.meta }}</span>
            </article>
          }
        </div>
      </section>

      <section class="lab-group">
        <h2>TAPPETI — ASCOLTO</h2>
        <div class="lab-grid beds">
          @for (bed of beds; track bed.id) {
            <button class="lab-bed" [class.active]="bed.id === bedId()" (click)="playBed(bed)">
              <span class="lab-bed-label">{{ bed.label }}</span>
              <span class="lab-bed-meta">
                {{ bed.file }} · {{ weightOf(bed.file) }}
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
                <span class="lab-source">{{ card.hasFile ? 'file' : card.event.source }}</span>
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
      .lab-bed.static {
        cursor: default;
      }
      .lab-bed.static:active {
        transform: none;
        box-shadow: 4px 4px 0 var(--coal);
      }
      .lab-bed-rows {
        margin: 4px 0 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .lab-bed-rows li {
        display: flex;
        flex-direction: column;
        gap: 1px;
        font-family: var(--font-mono);
        font-size: 0.68rem;
        letter-spacing: 0.04em;
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
  readonly beds = Object.values(BED_LOOPS);
  readonly bedId = signal('');
  /** Peso reale di ogni sottofondo, chiesto al server con una HEAD. */
  private readonly weights = signal<Record<string, BedWeight>>({});

  constructor() {
    void measureBeds(allBedFiles()).then((weights) => this.weights.set(weights));
  }

  private readonly variantById = signal<Record<string, number>>({});

  private fileQueue?: ReturnType<typeof setInterval>;

  readonly cards = computed<AudioCard[]>(() => {
    const variants = this.variantById();
    return AUDIO_EVENT_ORDER.map((id) => {
      const event = AUDIO_EVENTS[id];
      const variant = variants[id] ?? 0;
      return {
        event,
        id,
        variant,
        variantLabel: this.variantLabel(id, variant),
        hasFile: (AUDIO_FILES[id]?.length ?? 0) > 0,
      };
    });
  });

  readonly roomCards = computed(() => this.cards().filter((card) => card.event.bus !== 'phone'));
  readonly phoneCards = computed(() => this.cards().filter((card) => card.event.bus === 'phone'));

  /**
   * Il catalogo per atto: la base e i giochi che la scaletta mette in quell'atto,
   * ognuno con il file e il peso. Il totale somma i file dell'atto una volta
   * sola — i giochi condivisi non si contano due volte — e dice quanti
   * sottofondi mancano ancora alla consegna.
   */
  readonly actGroups = computed(() => {
    const weights = this.weights();
    return ACT_NUMBERS.map((act) => {
      const base = ACT_BEDS[act];
      const rows: BedRow[] = [
        { key: 'base', name: 'Base d’atto', meta: this.bedMeta(base.file, weights) },
      ];
      for (const type of new Set(ACT_DECKS[act - 1])) {
        const bed = GAME_BEDS[type];
        if (bed === null) {
          rows.push({ key: type, name: GAME_NAMES[type], meta: 'silenzio' });
        } else if (bed === ACT_BASE) {
          rows.push({ key: type, name: GAME_NAMES[type], meta: 'base dell’atto' });
        } else {
          rows.push({ key: type, name: GAME_NAMES[type], meta: this.bedMeta(bed.file, weights) });
        }
      }

      let bytes = 0;
      let missing = 0;
      for (const bed of bedsForAct(act)) {
        const weight = weights[bed.file];
        if (typeof weight === 'number') bytes += weight;
        else missing += 1;
      }
      const total = `${bytes > 0 ? formatWeight(bytes) : '—'}${missing > 0 ? ` · ${missing} da consegnare` : ''}`;
      return { act, title: base.label, rows, total };
    });
  });

  /** Ogni modalità con il sottofondo che le tocca davvero. */
  readonly gameCards = computed(() => {
    const weights = this.weights();
    return GAME_MODE_TYPES.map((type) => {
      const bed = GAME_BEDS[type];
      if (bed === null) return { type, name: GAME_NAMES[type], bed: 'Silenzio', meta: 'nessun file' };
      if (bed === ACT_BASE) {
        return { type, name: GAME_NAMES[type], bed: 'Base dell’atto', meta: 'loop/atto-N.m4a' };
      }
      return {
        type,
        name: GAME_NAMES[type],
        bed: bed.label,
        meta: this.bedMeta(bed.file, weights),
      };
    });
  });

  /** Peso di un file per la lista dei tappeti. */
  weightOf(file: string): string {
    return formatWeight(this.weights()[file]);
  }

  private bedMeta(file: string, weights: Record<string, BedWeight>): string {
    return `${file} · ${formatWeight(weights[file])}`;
  }

  toggleMute(): void {
    this.audio.toggleAudio();
  }

  /** Prova un tappeto: è quello che sentirà la sala durante quel gioco. */
  playBed(bed: BedLoop): void {
    this.audio.setBedLoop(bed.id);
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
    this.stopFileQueue();
    this.audio.stopAll();
    this.audio.stopAmbient();
    this.lastPlayed.set(null);
    this.bedId.set('');
  }

  /**
   * Ascolto in fila di tutti i file registrati, varianti comprese: serve a
   * sentire l'intera cartella dopo una rielaborazione, senza cercare i pulsanti.
   */
  playEveryFile(): void {
    this.stopFileQueue();
    const queue: Array<{ id: AudioEventId; variant: number }> = [];
    for (const [id, files] of Object.entries(AUDIO_FILES)) {
      for (let variant = 0; variant < (files?.length ?? 0); variant += 1) {
        queue.push({ id: id as AudioEventId, variant });
      }
    }
    if (queue.length === 0) return;
    let index = 0;
    this.fileQueue = setInterval(() => {
      const item = queue[index];
      index += 1;
      if (!item) {
        this.lastPlayed.set(`File: finiti ${queue.length}`);
        this.stopFileQueue();
        return;
      }
      this.audio.play(item.id, item.variant);
      this.lastPlayed.set(`File ${index}/${queue.length}: ${item.id}`);
    }, 1400);
  }

  private stopFileQueue(): void {
    if (this.fileQueue) {
      clearInterval(this.fileQueue);
      this.fileQueue = undefined;
    }
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
