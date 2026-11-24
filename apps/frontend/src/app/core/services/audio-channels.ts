import type { AudioEventId } from './audio-catalog';

/**
 * Canali audio della serata e proprietari dei loop.
 *
 * <p>Un loop non appartiene al servizio audio: appartiene al gioco, al round o
 * al bonus che l'ha chiesto. Da qui passano tutti i loop (battito, ticchettio,
 * rotolamento delle Biglie), così al cambio di proprietario si spengono con una
 * dissolvenza sola e non restano appesi alla scena dopo.</p>
 *
 * <p>Le due corse che questo file deve impedire: il fade-out del gioco A non
 * deve cancellare l'avvio del gioco B (per questo la dissolvenza tocca solo i
 * loop del proprietario uscente), e un avvio in ritardo di A non deve partire
 * dopo la fine di A (per questo ogni avvio porta il proprietario e viene
 * rifiutato se non è più quello attivo).</p>
 */

/** I quattro canali della serata, in ordine di priorità di ascolto. */
export type AudioChannel = 'bed' | 'loop-gioco' | 'effetto' | 'voce';

export const AUDIO_CHANNELS: readonly AudioChannel[] = ['bed', 'loop-gioco', 'effetto', 'voce'];

export const CHANNEL_LABELS: Record<AudioChannel, string> = {
  bed: 'Sottofondo',
  'loop-gioco': 'Loop di gioco',
  effetto: 'Effetti',
  voce: 'Voce',
};

/** Dissolvenza standard al cambio scena: dentro la finestra 300–600 ms. */
export const OWNER_FADE_SECONDS = 0.45;
/** Pausa e ripresa: un filo più rapida, la sala non deve sentire un taglio. */
export const PAUSE_FADE_SECONDS = 0.3;

/** Loop già avviato, fermato in pausa: si conserva il punto per riprendere. */
export interface SuspendedLoop {
  event: AudioEventId;
  channel: AudioChannel;
  owner: string;
  label: string;
  level: number;
  style: LoopStyle;
  position: number;
}

/** Ritocco del loop, uguale a quello del player. */
export interface LoopStyle {
  rate?: number;
  lowpass?: number;
}

export interface LoopStart {
  channel: AudioChannel;
  owner: string;
  label: string;
  level?: number;
  style?: LoopStyle;
}

/** Stato mostrato dal pannello `?audiodebug=1` in TV. */
export interface AudioChannelEntry {
  channel: AudioChannel;
  label: string;
  owner: string;
  event?: AudioEventId;
}

/** Chi suona davvero: il SoundPlayer in sala, un finto nei test. */
export interface LoopSink {
  startLoop(event: AudioEventId, level?: number, style?: LoopStyle, offsetSeconds?: number): void;
  stopLoop(event: AudioEventId, fadeSeconds?: number): void;
  isLooping(event: AudioEventId): boolean;
  loopPosition(event: AudioEventId): number;
}

interface ActiveEntry extends LoopStart {
  level: number;
  style: LoopStyle;
}

export class AudioChannels {
  /** Proprietario attivo: `lobby`, `round:7:QUIZ`, `bonus:CASINO_COLOR`… */
  private owner = 'lobby';
  private readonly loops = new Map<AudioEventId, ActiveEntry>();
  private suspended: SuspendedLoop[] = [];
  private bed?: { owner: string; label: string; file: string };
  private paused = false;

  constructor(private readonly sink: LoopSink) {}

  get currentOwner(): string {
    return this.owner;
  }

  get isSuspended(): boolean {
    return this.paused;
  }

  /** Sottofondo in onda: canale `bed`, con lo stesso proprietario dei loop. */
  setBed(owner: string, label: string, file: string): void {
    this.bed = { owner, label, file };
  }

  clearBed(): void {
    this.bed = undefined;
  }

  /** Il loop è del proprietario attivo? Serve all'anti-corsa dei chiamanti. */
  isActiveOwner(owner: string): boolean {
    return owner === this.owner;
  }

  /**
   * Cambio di scena: spegne con dissolvenza i loop del proprietario uscente e
   * lascia in onda quelli del nuovo. Un loop che non si può più riprendere
   * (per esempio il rotolamento di una gara finita) muore qui.
   */
  setOwner(owner: string, fadeSeconds = OWNER_FADE_SECONDS): void {
    const next = owner.trim() || 'lobby';
    if (next === this.owner) return;
    this.owner = next;
    if (this.paused) {
      // In pausa si cambia comunque scena, ma non deve suonare niente.
      this.suspended = [];
      this.loops.clear();
      return;
    }
    for (const [event, entry] of [...this.loops]) {
      if (entry.owner === next) continue;
      this.sink.stopLoop(event, fadeSeconds);
      this.loops.delete(event);
    }
  }

  /**
   * Avvia un loop per il proprietario attivo. Torna `false` quando il
   * proprietario non è più quello in scena: il chiamante in ritardo non riapre
   * un gioco già chiuso.
   */
  start(event: AudioEventId, start: LoopStart): boolean {
    if (start.owner !== this.owner) return false;
    if (this.paused) return false;
    const active = this.loops.get(event);
    if (active && active.owner === start.owner && active.channel === start.channel) {
      // Stesso loop già in onda: non riparte da capo, si limita il volume.
      return true;
    }
    const entry: ActiveEntry = {
      ...start,
      level: start.level ?? 1,
      style: start.style ?? {},
    };
    this.sink.startLoop(event, entry.level, entry.style);
    this.loops.set(event, entry);
    return true;
  }

  stop(event: AudioEventId, fadeSeconds = 0): void {
    this.loops.delete(event);
    this.sink.stopLoop(event, fadeSeconds);
  }

  /**
   * Pausa: sospende tutto e ricorda il punto di ogni loop. Nessun effetto
   * nuovo parte finché non si riprende (lo decide il servizio audio).
   */
  suspend(): void {
    if (this.paused) return;
    this.paused = true;
    this.suspended = [];
    for (const [event, entry] of this.loops) {
      const position = this.sink.loopPosition(event);
      this.suspended.push({
        event,
        channel: entry.channel,
        owner: entry.owner,
        label: entry.label,
        level: entry.level,
        style: entry.style,
        position,
      });
      this.sink.stopLoop(event, PAUSE_FADE_SECONDS);
    }
    this.loops.clear();
  }

  /** Ripresa: riparte dal punto in cui il loop si era fermato. */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    const pending = this.suspended;
    this.suspended = [];
    for (const loop of pending) {
      // Un loop di un proprietario ormai uscito non torna in onda.
      if (loop.owner !== this.owner) continue;
      this.sink.startLoop(loop.event, loop.level, loop.style, loop.position);
      this.loops.set(loop.event, {
        channel: loop.channel,
        owner: loop.owner,
        label: loop.label,
        level: loop.level,
        style: loop.style,
      });
    }
  }

  /** Reset: azzera tutto, senza memoria di ripresa. */
  reset(fadeSeconds = 0.2): void {
    this.paused = false;
    this.suspended = [];
    for (const event of [...this.loops.keys()]) this.sink.stopLoop(event, fadeSeconds);
    this.loops.clear();
    this.bed = undefined;
    this.owner = 'lobby';
  }

  /** Uscita dalla TV: nessun loop resta acceso, nemmeno se la scena è cambiata. */
  release(fadeSeconds = OWNER_FADE_SECONDS): void {
    this.reset(fadeSeconds);
  }

  /** Canali attivi, per la verifica in sala (`?audiodebug=1`). */
  snapshot(): AudioChannelEntry[] {
    const rows: AudioChannelEntry[] = [];
    if (this.bed) {
      rows.push({
        channel: 'bed',
        label: this.bed.label,
        owner: this.bed.owner,
      });
    }
    for (const [event, entry] of this.loops) {
      rows.push({ channel: entry.channel, label: entry.label, owner: entry.owner, event });
    }
    return rows;
  }
}
