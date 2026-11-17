import { Injectable, signal } from '@angular/core';
import { play as playFoley, set as setFoley, unlock as unlockFoley, type CueName } from '@foleyjs/core';
import {
  AUDIO_EVENTS,
  BONUS_ENTRANCE_TYPES,
  type AudioEventId,
} from './audio-catalog';
import { AudioEngine } from './audio-engine';
import { SoundPlayer } from './sound-player';
import { marbleRollStyle } from './marble-roll';
import { bell, click, modal, noiseVoice, pluck } from './audio-dsp';
import {
  bedBar,
  bedForGame,
  bedSecondsPerBar,
  bedSecondsPerBeat,
  midiToFrequency,
  type BedProfile,
} from './bed-profiles';

/**
 * Tabella evento → suono di interfaccia, in un solo posto.
 *
 * I suoni di Foley sono sintetizzati al volo (nessun file audio) e coprono
 * tocchi, conferme ed errori. La sala e i giochi suonano i file della
 * libreria: qui resta solo l'interfaccia.
 */
export const UI_SOUNDS = {
  tocco: 'tick',
  rispostaInviata: 'complete',
  giusto: 'success',
  sbagliato: 'error',
  tempoScaduto: 'warning',
  prenotazione: 'press',
  ingresso: 'chime',
  eliminazione: 'denied',
  rivelazione: 'rise',
  vittoria: 'sparkle',
} as const satisfies Record<string, CueName>;

/** Foley sta sotto la voce del presentatore: mai il suono più forte della sala. */
const UI_VOLUME = 0.45;

/**
 * Suoni della serata.
 *
 * Gli effetti sono file (`assets/audio/...`), i tappeti sono ancora generati
 * da `bed-profiles.ts` finché la spec dei bed non li porta su file. Nessun
 * evento ricade sulla sintesi: un file mancante si sente in console.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly audioEnabled = signal(true);
  private readonly engine = new AudioEngine();
  private readonly player: SoundPlayer;
  private ambientInterval?: ReturnType<typeof setInterval>;
  private ambientBar = 0;
  private ambientNextBarAt = 0;
  /** Tappeto attivo: uno per gioco, deciso da `setGameBed`. */
  private bedProfile: BedProfile = bedForGame(null);
  private ambientNoise?: AudioBufferSourceNode;
  private ambientNoiseGain?: GainNode;

  /** Foley ha il suo contesto: si configura una volta sola. */
  private uiReady = false;

  /** Volume generale della TV, 0–1. Il muto resta il suo interruttore. */
  readonly masterVolume = signal(1);
  /** Ultima riproduzione per evento: serve alla distanza minima del catalogo. */
  private readonly lastEventAt = new Map<string, number>();

  constructor() {
    this.player = new SoundPlayer(
      this.engine,
      () => this.audioEnabled(),
      (url) => console.warn(`[audio] file mancante: ${url}`),
    );
    this.engine.setVolume(1);
    this.engine.armUnlock(() => this.unlockFoley());
  }

  /**
   * Heartbeat della serata. `intensity` va da 0 (lobby) a 1 (round 40):
   * più si alza, più il battito è presente.
   */
  startHeartbeat(intensity = 0): void {
    if (!this.audioEnabled()) return;
    const level = 0.55 + Math.max(0, Math.min(1, intensity)) * 0.45;
    this.player.startLoop('heartbeat', level);
  }

  stopHeartbeat(): void {
    this.player.stopLoop('heartbeat');
  }

  /**
   * Suspense dei giochi a conto alla rovescia: parte dal round 20 e sale
   * gradualmente fino al round 40. Il battito cresce con la serata.
   */
  startSuspense(round: number): void {
    const level = Math.max(0, Math.min(1, (round - 19) / 21));
    if (level <= 0) {
      this.stopSuspense();
      return;
    }
    this.startHeartbeat(level);
  }

  stopSuspense(): void {
    this.stopHeartbeat();
  }

  startClock(): void {
    if (!this.audioEnabled()) return;
    this.player.startLoop('clock', 1);
  }

  stopClock(): void {
    this.player.stopLoop('clock');
  }

  /**
   * Sottofondo del rotolamento delle Biglie: parte col via della gara e si
   * spegne all'arrivo. Il fondo della pista decide passo e timbro dello stesso
   * file, così la sabbia non suona come il vetro.
   */
  startMarbleBed(trackId?: string | null): void {
    if (!this.audioEnabled()) return;
    const style = marbleRollStyle(trackId);
    this.player.startLoop('marbleRoll', style.level, {
      rate: style.rate,
      lowpass: style.lowpass,
    });
  }

  stopMarbleBed(): void {
    this.player.stopLoop('marbleRoll');
  }

  playBell(): void {
    this.play('bell');
  }

  playCorrect(): void {
    this.stopClock();
    this.playUi('giusto');
    this.play('correct');
  }

  playWrong(): void {
    this.playUi('sbagliato');
    this.play('wrong');
  }

  playCoins(): void {
    this.play('coins');
  }

  playApplause(): void {
    this.play('applause');
  }

  playRacketHit(): void {
    this.play('racket');
  }

  /**
   * Urti delle Biglie: biglia contro biglia, contro il muro e contro la
   * superficie. La superficie è sorda sui fondi morbidi, secca sui duri.
   */
  playMarbleHit(): void {
    this.play('marbleHit');
  }

  playMarbleWall(): void {
    this.play('marbleWall');
  }

  playMarbleSurface(soft = false): void {
    this.play(soft ? 'marbleSurfaceSoft' : 'marbleSurfaceHard');
  }

  playUuuh(): void {
    this.play('uuuh');
  }

  playBombSiren(): void {
    this.play('bombSiren');
  }

  playBonusEntrance(type: string): void {
    const index = BONUS_ENTRANCE_TYPES.indexOf(type as (typeof BONUS_ENTRANCE_TYPES)[number]);
    this.play('bonusEntrance', index < 0 ? 0 : index);
  }

  playConfirm(): void {
    this.playUi('prenotazione');
    this.play('confirm');
  }

  playError(): void {
    this.playUi('sbagliato');
    this.play('error');
  }

  playGong(): void {
    this.play('gong');
  }

  playTimeUp(): void {
    this.play('timeUp');
  }

  playReveal(): void {
    this.stopClock();
    this.playUi('rivelazione');
    this.play('reveal');
  }

  playRouletteTicks(_durationMs = 6750): void {
    this.play('rouletteTicks');
  }

  playRouletteLanding(): void {
    this.play('rouletteLanding');
  }

  playJoin(): void {
    this.playUi('ingresso');
    this.play('join');
  }

  playTick(): void {
    if (!this.audioEnabled()) return;
    this.playUi('tocco');
    this.play('tick');
  }

  playCountdownTick(): void {
    this.play('countdownTick');
  }

  playFuse(): void {
    this.play('fuse');
  }

  playExplosion(): void {
    this.play('explosion');
  }

  playCountdownBong(): void {
    this.play('countdownBong');
  }

  playWhoosh(): void {
    this.play('whoosh');
  }

  playElimination(): void {
    this.playUi('eliminazione');
    this.play('elimination');
  }

  playPodium(): void {
    this.play('podium');
  }

  playDrumroll(_seconds = 2, _strength = 0.6): void {
    this.play('drumroll');
  }

  playRankReveal(position: number): void {
    this.playUi('tocco');
    this.play('rankReveal', position === 5 ? 0 : 1);
  }

  playPodiumReveal(position: number): void {
    this.playUi('vittoria');
    this.play('podiumReveal', Math.max(0, Math.min(2, position - 1)));
  }

  /** Tappeto del pub: parte in lobby e resta sotto classifiche e bonus. */
  startAmbient(gameType?: string | null): void {
    if (!this.audioEnabled()) return;
    if (gameType !== undefined) this.setGameBed(gameType);
    if (this.ambientInterval) return;
    const ctx = this.engine.context();
    if (!ctx) return;

    this.ambientBar = 0;
    this.ambientNextBarAt = ctx.currentTime + 0.12;
    this.startVinyl(ctx);
    this.ambientInterval = setInterval(() => this.scheduleAmbient(), 250);
    this.scheduleAmbient();
  }

  /**
   * Cambia il tappeto: il gioco appena partito ha il suo. La battuta in corso
   * finisce com'era, la successiva parte col nuovo tempo e i nuovi strumenti,
   * così non si sente uno stacco.
   */
  setGameBed(gameType: string | null | undefined): void {
    const next = bedForGame(gameType);
    if (next.id === this.bedProfile.id) return;
    this.bedProfile = next;
    this.ambientBar = 0;
  }

  /** Tappeto attivo: la regia lo mostra e i test lo controllano. */
  currentBed(): BedProfile {
    return this.bedProfile;
  }

  stopAmbient(): void {
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = undefined;
    }
    try {
      this.ambientNoise?.stop();
      this.ambientNoise?.disconnect();
    } catch {
      // già fermo
    }
    this.ambientNoise = undefined;
    this.ambientNoiseGain?.disconnect();
    this.ambientNoiseGain = undefined;
  }

  stopAll(): void {
    this.stopSuspense();
    this.stopClock();
  }

  toggleAudio(): void {
    this.audioEnabled.update((enabled) => !enabled);
    this.engine.setEnabled(this.audioEnabled());
    this.engine.applyGain();
    this.muteUi(!this.audioEnabled());
    if (!this.audioEnabled()) {
      this.stopAll();
      this.stopAmbient();
      this.stopMarbleBed();
      return;
    }
    void this.unlock();
    this.startAmbient();
    this.playTick();
  }

  isEnabled(): boolean {
    return this.audioEnabled();
  }

  /**
   * Suona un evento del catalogo, con la sua distanza minima e la sua
   * rifinitura di volume. È il punto d'ingresso della regia audio: i metodi
   * storici restano per i chiamanti esistenti.
   */
  play(event: AudioEventId, variant = 0): boolean {
    if (!this.audioEnabled()) return false;
    const definition = AUDIO_EVENTS[event];
    if (!definition) return false;

    const now = Date.now();
    const last = this.lastEventAt.get(event) ?? -Infinity;
    if (now - last < definition.minIntervalMs) return false;
    this.lastEventAt.set(event, now);

    this.engine.beginEventBus(definition.volume);
    if (!this.player.play(event, variant)) {
      console.warn(`[audio] nessun file per l'evento «${event}»`);
      return false;
    }
    return true;
  }

  /** Volume generale 0–1, applicato al bus master senza click. */
  setMasterVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
    this.masterVolume.set(clamped);
    this.engine.setVolume(clamped);
  }

  /** Un evento del catalogo per id, con etichetta e regole: lo usa la regia. */
  event(id: AudioEventId) {
    return AUDIO_EVENTS[id];
  }

  /** Contesto condiviso: anche il Quiz musicale ci appende i suoi filtri. */
  context(): AudioContext | undefined {
    return this.engine.context();
  }

  /** Bus di uscita comune: ogni sorgente passa dal gain master. */
  output(): AudioNode | undefined {
    return this.engine.output();
  }

  /** Riprende il contesto dopo un gesto utente o al ritorno sulla scheda. */
  async unlock(): Promise<void> {
    await this.engine.unlock();
    this.unlockFoley();
  }

  /** Suono di interfaccia (Foley): tabella unica, volume discreto, muto rispettato. */
  private playUi(event: keyof typeof UI_SOUNDS): void {
    if (!this.audioEnabled()) return;
    try {
      if (!this.uiReady) {
        setFoley({ volume: UI_VOLUME, muted: false });
        this.uiReady = true;
      }
      playFoley(UI_SOUNDS[event]);
    } catch {
      // Un browser senza Web Audio non deve fermare il gioco.
    }
  }

  private unlockFoley(): void {
    try {
      unlockFoley();
      setFoley({ volume: UI_VOLUME, muted: !this.audioEnabled() });
      this.uiReady = true;
    } catch {
      // Nessun Web Audio (browser vecchio o test): la serata resta silenziosa.
    }
  }

  private muteUi(muted: boolean): void {
    try {
      setFoley({ muted });
    } catch {
      // Il muto principale resta comunque attivo.
    }
  }

  /** Programma le battute con un piccolo anticipo, come un vero sequencer. */
  private scheduleAmbient(): void {
    const ctx = this.engine.context();
    if (!ctx || !this.ambientInterval || !this.audioEnabled()) return;

    const barSeconds = bedSecondsPerBar(this.bedProfile);

    // Scheda in background: il timer arranca. Si salta al punto giusto invece
    // di scaricare tutte le battute arretrate in un colpo.
    if (this.ambientNextBarAt < ctx.currentTime) {
      const skipped = Math.ceil((ctx.currentTime - this.ambientNextBarAt) / barSeconds);
      this.ambientBar = (this.ambientBar + skipped) % 4096;
      this.ambientNextBarAt += skipped * barSeconds;
    }

    const horizon = ctx.currentTime + 1.2;
    while (this.ambientNextBarAt < horizon) {
      this.scheduleAmbientBar(this.ambientBar, this.ambientNextBarAt);
      this.ambientBar = (this.ambientBar + 1) % 4096;
      this.ambientNextBarAt += barSeconds;
    }
  }

  private scheduleAmbientBar(barIndex: number, startAt: number): void {
    const ctx = this.engine.context();
    if (!ctx) return;

    const profile = this.bedProfile;
    const bar = bedBar(profile, barIndex);
    // Il tappeto non passa dal bus dell'evento: suona sempre al suo volume.
    const bus = this.engine.room(ctx);
    const beatSeconds = bedSecondsPerBeat(profile);
    // Il tappeto suona sotto gli effetti: le note del giro restano scritte
    // piano nel generatore, qui si porta il trio a volume di sala.
    const BED_GAIN = 4;

    for (const note of bar.notes) {
      const at = startAt + note.beat * beatSeconds;
      const freq = midiToFrequency(note.midi);
      switch (note.voice) {
        case 'bass':
          pluck(ctx, bus, {
            at,
            freq,
            duration: note.duration,
            gain: note.gain * BED_GAIN,
            brightness: 0.28,
            pan: note.pan,
          });
          break;
        case 'epiano':
          // Campana FM con rapporto quasi 1: corpo tondo, attacco morbido.
          bell(ctx, bus, {
            at,
            freq,
            duration: note.duration,
            gain: note.gain * BED_GAIN,
            ratio: 1.01,
            index: 0.7,
            pan: note.pan,
          });
          break;
        case 'vibes':
          bell(ctx, bus, {
            at,
            freq,
            duration: note.duration,
            gain: note.gain * BED_GAIN,
            ratio: 4,
            index: 1.1,
            pan: note.pan,
          });
          break;
        case 'glass':
          modal(ctx, bus, {
            at,
            gain: note.gain * BED_GAIN,
            partials: [
              { freq, decay: note.duration, q: 90 },
              { freq: freq * 2.76, decay: note.duration * 0.6, q: 95, gain: 0.45 },
            ],
            pan: note.pan,
          });
          break;
        case 'rim':
          click(ctx, bus, { at, gain: note.gain * BED_GAIN, freq: 1800, q: 5, decay: 0.05, pan: note.pan });
          break;
        case 'brush':
          noiseVoice(ctx, bus, {
            at,
            duration: 0.11,
            gain: note.gain * BED_GAIN,
            freq: 3400,
            q: 0.8,
            attack: 0.004,
            release: 0.1,
            pan: note.pan,
          });
          break;
        case 'marimba':
          // Legno intonato: fondamentale e ottava, coda corta.
          modal(ctx, bus, {
            at,
            gain: note.gain * BED_GAIN,
            partials: [
              { freq, decay: Math.min(0.5, note.duration), q: 40 },
              { freq: freq * 3.93, decay: 0.12, q: 60, gain: 0.3 },
            ],
            strike: { freq: 1600, q: 2, duration: 0.02, gain: note.gain * BED_GAIN * 0.8 },
            pan: note.pan,
          });
          break;
        case 'shaker':
          noiseVoice(ctx, bus, {
            at,
            duration: 0.07,
            gain: note.gain * BED_GAIN,
            freq: 6200,
            q: 0.7,
            attack: 0.003,
            release: 0.06,
            pan: note.pan,
          });
          break;
        case 'wood':
          click(ctx, bus, { at, gain: note.gain * BED_GAIN, freq: 1200, q: 9, decay: 0.05, pan: note.pan });
          break;
        case 'pad':
          // Tappeto lungo: due campane molli e detunate, attacco lento.
          bell(ctx, bus, {
            at,
            freq,
            duration: note.duration,
            gain: note.gain * BED_GAIN,
            ratio: 0.5,
            index: 0.25,
            pan: note.pan,
          });
          bell(ctx, bus, {
            at: at + 0.03,
            freq: freq * 1.006,
            duration: note.duration,
            gain: note.gain * BED_GAIN * 0.6,
            ratio: 0.5,
            index: 0.2,
            pan: note.pan,
          });
          break;
      }
    }
  }

  /** Fruscio da vinile: un filo costante sotto gli strumenti. */
  private startVinyl(ctx: AudioContext): void {
    if (this.ambientNoise) return;

    const frames = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.35;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.6;

    const gain = ctx.createGain();
    gain.gain.value = 0.003;

    source.connect(filter).connect(gain).connect(this.engine.output() ?? ctx.destination);
    source.start();
    this.ambientNoise = source;
    this.ambientNoiseGain = gain;
  }
}
