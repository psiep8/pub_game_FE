import { Injectable, signal } from '@angular/core';
import { play as playFoley, set as setFoley, unlock as unlockFoley, type CueName } from '@foleyjs/core';
import {
  PUB_BED_SECONDS_PER_BAR,
  PUB_BED_SECONDS_PER_BEAT,
  PUB_BED_TOTAL_BARS,
  midiToFrequency,
  pubBedBar,
} from './pub-bed';

interface ToneOptions {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
  attack?: number;
  detune?: number;
}

/**
 * Tabella evento → suono di interfaccia, in un solo posto.
 *
 * I suoni di Foley sono sintetizzati al volo (nessun file audio) e coprono
 * tocchi, conferme ed errori. Roulette, applausi, rulli ed esplosioni non
 * sono suoni di interfaccia: restano sintetizzati qui sotto come suoni da
 * sala, sempre dietro questo servizio.
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
 * Suoni della TV.
 *
 * I file mp3 coprono countdown e risposte; il resto è sintetizzato con la Web
 * Audio API, così non serve nessun asset esterno e la licenza è nostra.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private audioEnabled = signal(true);
  private audioContext?: AudioContext;

  private heartbeatLoopInterval?: any;
  private heartbeatIntensity = 0;
  private clockLoopInterval?: any;
  private ambientInterval?: ReturnType<typeof setInterval>;
  private ambientBar = 0;
  private ambientNextBarAt = 0;
  private ambientNoise?: AudioBufferSourceNode;
  private ambientNoiseGain?: GainNode;
  private master?: GainNode;

  /** Foley ha il suo contesto: si configura una volta sola. */
  private uiReady = false;

  constructor() {
    this.armUnlock();
  }

  /**
   * Heartbeat della serata. `intensity` va da 0 (lobby) a 1 (round 40):
   * più si alza, più il battito è frequente e presente.
   */
  startHeartbeat(intensity = 0): void {
    this.stopHeartbeat();
    if (!this.audioEnabled()) return;

    this.heartbeatIntensity = Math.max(0, Math.min(1, intensity));
    const beat = () => {
      this.tone({ freq: 92, duration: 0.16, type: 'sine', gain: 0.05 + this.heartbeatIntensity * 0.025, slideTo: 55 });
      this.tone({ freq: 180, duration: 0.09, type: 'triangle', gain: 0.018, slideTo: 105 });
    };
    beat();

    const interval = Math.round(1500 - this.heartbeatIntensity * 650);
    this.heartbeatLoopInterval = setInterval(beat, interval);
  }

  stopHeartbeat(): void {
    if (this.heartbeatLoopInterval) {
      clearInterval(this.heartbeatLoopInterval);
      this.heartbeatLoopInterval = undefined;
    }
    this.heartbeatIntensity = 0;
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
    this.playSuspenseSting(level);
  }

  stopSuspense(): void {
    this.stopHeartbeat();
  }

  startClock(): void {
    if (!this.audioEnabled()) return;
    // Un solo tick per volta: se un round riparte senza stop (ripresa dopo
    // refresh, pausa, nuovo round) gli intervalli si sommerebbero e il
    // ticchettio resterebbe acceso per tutta la serata.
    this.stopClock();
    const tick = () => this.tone({ freq: 1650, duration: 0.04, type: 'square', gain: 0.024, slideTo: 900 });
    tick();
    this.clockLoopInterval = setInterval(tick, 1000);
  }

  stopClock(): void {
    if (this.clockLoopInterval) {
      clearInterval(this.clockLoopInterval);
      this.clockLoopInterval = undefined;
    }
  }

  playBell(): void {
    if (!this.audioEnabled()) return;
    this.tone({ freq: 1318.5, duration: 0.35, type: 'sine', gain: 0.05 });
    this.tone({ freq: 1975.5, duration: 0.22, type: 'sine', gain: 0.025, delay: 0.02 });
  }

  playCorrect(): void {
    if (!this.audioEnabled()) return;
    this.stopClock();
    this.playUi('giusto');
    this.chord([523.25, 659.25, 783.99], 0.55);
    this.playCoins();
    this.playApplause();
  }

  playWrong(): void {
    if (!this.audioEnabled()) return;
    this.playUi('sbagliato');
    this.tone({ freq: 196, duration: 0.45, type: 'sawtooth', gain: 0.05, slideTo: 110 });
    this.playUuuh();
  }

  /** Tintinnio di gettoni: pioggia di ping metallici, effetto da bar. */
  playCoins(): void {
    if (!this.audioEnabled()) return;
    const pings = [1760, 2093, 2349, 2637, 3136];
    for (let i = 0; i < 12; i++) {
      const freq = pings[i % pings.length] * (i % 3 === 0 ? 1 : 0.75);
      this.tone({
        freq,
        duration: 0.09,
        type: 'triangle',
        gain: 0.014 + (i % 4) * 0.003,
        delay: i * 0.035,
      });
    }
    this.tone({ freq: 880, duration: 0.12, type: 'sine', gain: 0.02, delay: 0.02 });
  }

  /** Applauso sintetico: folate di rumore filtrato, senza asset esterni. */
  playApplause(): void {
    if (!this.audioEnabled()) return;
    this.noiseBurst(0.55, 0.05, 0, 1500);
    this.noiseBurst(0.7, 0.045, 0.12, 1900);
    this.noiseBurst(0.9, 0.035, 0.28, 1200);
  }

  /**
   * «PUAH»: colpo di racchetta sulla pallina da tennis, quando la risposta è
   * giusta e il punto è tuo. Impulso di rumore filtrato più una nota corta.
   */
  playRacketHit(): void {
    if (!this.audioEnabled()) return;
    this.noiseBurst(0.12, 0.09, 0, 2400);
    this.tone({ freq: 620, duration: 0.09, type: 'triangle', gain: 0.05, slideTo: 380 });
  }

  /** «Uuuh» del pubblico quando una squadra sbaglia. */
  playUuuh(): void {
    if (!this.audioEnabled()) return;
    this.tone({ freq: 320, duration: 0.55, type: 'sawtooth', gain: 0.028, slideTo: 150 });
    this.tone({ freq: 240, duration: 0.6, type: 'triangle', gain: 0.022, delay: 0.04, slideTo: 120 });
  }

  /** Sirena della Bomba: due toni alternati, da allarme da bar. */
  playBombSiren(): void {
    if (!this.audioEnabled()) return;
    for (let i = 0; i < 6; i++) {
      this.tone({
        freq: i % 2 === 0 ? 720 : 520,
        duration: 0.24,
        type: 'square',
        gain: 0.025,
        delay: i * 0.26,
      });
    }
  }

  /**
   * Conferma globale: risposta registrata o azione accettata dal server.
   * Suono breve, due note in salita, pensato per il telefono.
   */
  playConfirm(): void {
    this.playUi('prenotazione');
    this.tone({ freq: 740, duration: 0.07, type: 'triangle', gain: 0.05 });
    this.tone({ freq: 1108.73, duration: 0.1, type: 'triangle', gain: 0.04, delay: 0.06 });
  }

  /**
   * Errore globale: risposta rifiutata, azione non valida o tempo scaduto.
   * Suono corto e grave, distinto dal «sbagliato» della TV.
   */
  playError(): void {
    this.playUi('sbagliato');
    this.tone({ freq: 220, duration: 0.16, type: 'square', gain: 0.035, slideTo: 140 });
    this.tone({ freq: 165, duration: 0.18, type: 'square', gain: 0.03, delay: 0.08, slideTo: 110 });
  }

  /**
   * Gong del via: fondamentale grave con parziali inarmoniche, coda lunga e
   * un attacco metallico. È il segnale che fa partire il conteggio dei telefoni.
   */
  playGong(): void {
    if (!this.audioEnabled()) return;
    if (!this.ensureContext()) return;
    const partials: Array<[number, number, number]> = [
      [98, 0.09, 2.8],
      [196, 0.05, 2.3],
      [294.7, 0.032, 1.8],
      [412.5, 0.024, 1.4],
      [589.3, 0.017, 1.0],
      [1244, 0.011, 0.7],
    ];
    for (const [freq, gain, duration] of partials) {
      this.tone({ freq, duration, type: 'sine', gain, attack: 0.006, detune: -4 });
    }
    this.noiseBurst(0.18, 0.035, 0, 900);
  }

  /** Tempo scaduto: la conferma che il round non accetta più risposte. */
  playTimeUp(): void {
    this.playUi('tempoScaduto');
  }

  playReveal(): void {
    if (!this.audioEnabled()) return;
    this.stopClock();
    this.playUi('rivelazione');
    // Il rullo accompagna l'avvicinarsi della soluzione; l'accordo entra
    // quando il pubblico ha già capito che sta per succedere qualcosa.
    this.playDrumroll(0.9, 0.65);
    window.setTimeout(() => {
      if (!this.audioEnabled()) return;
      this.chord([523.25, 659.25, 783.99], 0.6);
      this.tone({ freq: 1567.98, duration: 0.5, type: 'sine', gain: 0.035, delay: 0.05 });
    }, 720);
  }

  /**
   * Tick della pallina sui separatori della roulette: partono fitti e
   * rallentano fino al fermo, con un tonfo quando la pallina scende sul rotore.
   */
  playRouletteTicks(durationMs = 6750): void {
    if (!this.audioEnabled()) return;
    if (!this.ensureContext()) return;

    let elapsed = 0;
    while (elapsed < durationMs - 120) {
      const progress = elapsed / durationMs;
      const jitter = Math.sin(elapsed * 0.017) * 55;
      // Legno del separatore + corpo basso della pallina.
      this.tone({
        freq: 1720 - progress * 560 + jitter,
        duration: 0.024,
        type: 'triangle',
        gain: 0.028 * (1 - progress * 0.45),
        delay: elapsed / 1000,
      });
      this.tone({
        freq: 205 - progress * 70,
        duration: 0.018,
        type: 'sine',
        gain: 0.012 * (1 - progress * 0.5),
        delay: elapsed / 1000,
      });
      elapsed += 26 + Math.pow(progress, 2.4) * 340;
    }

    this.tone({
      freq: 92,
      duration: 0.22,
      type: 'sine',
      gain: 0.055,
      delay: (durationMs * 0.29) / 1000,
    });
  }

  /** Atterraggio della roulette: tonfo grave e accento luminoso. */
  playRouletteLanding(): void {
    if (!this.audioEnabled()) return;
    this.tone({ freq: 120, duration: 0.32, type: 'sine', gain: 0.075, slideTo: 58 });
    this.tone({ freq: 1046.5, duration: 0.16, type: 'triangle', gain: 0.04, delay: 0.02 });
    this.chord([523.25, 659.25, 783.99], 0.75, 0.06);
    this.tone({ freq: 1567.98, duration: 0.42, type: 'sine', gain: 0.032, delay: 0.16 });
  }

  /** Nuova squadra collegata: bip luminoso a due note. */
  playJoin(): void {
    this.playUi('ingresso');
    this.tone({ freq: 659.25, duration: 0.12, type: 'sine', gain: 0.06 });
    this.tone({ freq: 987.77, duration: 0.16, type: 'sine', gain: 0.05, delay: 0.1 });
  }

  /** Tick delle classifiche e dei countdown. */
  playTick(): void {
    this.playUi('tocco');
    this.tone({ freq: 880, duration: 0.06, type: 'triangle', gain: 0.035 });
  }

  /** Tick del countdown: legno secco e bassissimo, sotto la musica. */
  playCountdownTick(): void {
    this.tone({ freq: 1180, duration: 0.035, type: 'triangle', gain: 0.022 });
  }

  /** Bong di fine countdown: campana grave con coda breve. */
  playCountdownBong(): void {
    this.tone({ freq: 196, duration: 0.55, type: 'sine', gain: 0.055, slideTo: 130 });
    this.tone({ freq: 392, duration: 0.35, type: 'sine', gain: 0.022, delay: 0.02 });
  }

  /** Transizione tra schermate. */
  playWhoosh(): void {
    this.tone({ freq: 220, duration: 0.35, type: 'sine', gain: 0.05, slideTo: 1320 });
  }

  /** Eliminazione dall'Arena. */
  playElimination(): void {
    this.playUi('eliminazione');
    this.tone({ freq: 330, duration: 0.3, type: 'sawtooth', gain: 0.06, slideTo: 90 });
  }

  /** Fanfara del podio: arpeggio ascendente e accordo finale. */
  playPodium(): void {
    if (!this.audioEnabled()) return;
    const notes = [392, 523.25, 659.25, 783.99];
    notes.forEach((freq, index) => {
      this.tone({ freq, duration: 0.22, type: 'square', gain: 0.04, delay: index * 0.14 });
    });
    this.chord([523.25, 659.25, 783.99, 1046.5], 0.9, 0.6);
    this.tone({ freq: 1567.98, duration: 0.5, type: 'sine', gain: 0.045, delay: 0.7 });
  }

  /** Rullo di tamburi sintetico; `strength` regola volume e presenza. */
  playDrumroll(seconds = 2, strength = 0.6): void {
    if (!this.audioEnabled()) return;
    const hits = Math.max(1, Math.floor(seconds * 14));
    const baseGain = 0.012 + Math.max(0, Math.min(1, strength)) * 0.03;
    for (let i = 0; i < hits; i++) {
      this.tone({
        freq: 90 + (i % 3) * 8,
        duration: 0.045,
        type: 'square',
        gain: baseGain * (0.85 + (i / hits) * 0.35),
        delay: i / 14,
      });
    }
  }

  /**
   * Podio della classifica: il rullo sale dal terzo al primo posto e lascia
   * spazio al festeggiamento. Al secondo si aggiungono le botticelle, al
   * primo i botti pieni.
   */
  playPodiumReveal(position: number): void {
    const place = Math.max(1, Math.min(3, Math.round(position)));
    this.playUi('vittoria');

    if (place === 3) {
      this.playDrumroll(0.8, 0.45);
      this.playCelebration(1, 0.8);
      return;
    }

    if (place === 2) {
      this.playDrumroll(1.4, 0.7);
      this.playCelebration(2, 1.4);
      this.playFireworks(2, 1.5);
      return;
    }

    this.playDrumroll(2.6, 1);
    this.playCelebration(3, 2.6);
    this.playFireworks(3, 2.7);
  }

  private playCelebration(level: 1 | 2 | 3, delay: number): void {
    const notes = level === 1
      ? [523.25, 659.25, 783.99]
      : level === 2
        ? [392, 523.25, 659.25, 783.99]
        : [392, 523.25, 659.25, 783.99, 1046.5];
    const step = level === 1 ? 0.11 : level === 2 ? 0.12 : 0.14;
    const gain = level === 1 ? 0.022 : level === 2 ? 0.03 : 0.038;

    notes.forEach((freq, index) => {
      this.tone({
        freq,
        duration: level === 1 ? 0.18 : 0.24,
        type: 'triangle',
        gain,
        delay: delay + index * step,
      });
    });
    this.chord(notes.slice(-3), 0.7 + level * 0.15, delay + notes.length * step);
  }

  private playFireworks(level: 2 | 3, delay: number): void {
    const pops = level === 2 ? 6 : 12;
    for (let i = 0; i < pops; i++) {
      const at = delay + i * 0.09 + (i % 4) * 0.02;
      this.tone({
        freq: 620 + (i % 5) * 180,
        duration: 0.025,
        type: 'square',
        gain: 0.012 + (level === 3 ? 0.006 : 0),
        delay: at,
      });
      if (i % 3 === 0) {
        this.tone({
          freq: 90 - (i % 2) * 15,
          duration: 0.16,
          type: 'sine',
          gain: 0.018 + level * 0.004,
          delay: at,
        });
      }
    }

    if (level === 3) {
      this.tone({ freq: 1567.98, duration: 0.5, type: 'sine', gain: 0.03, delay: delay + 0.3 });
    }
  }

  /** Richiamo breve all'inizio di un gioco in suspense. */
  private playSuspenseSting(level: number): void {
    this.tone({
      freq: 110,
      duration: 0.7,
      type: 'sine',
      gain: 0.008 + level * 0.014,
      slideTo: 55,
    });
    this.tone({
      freq: 220,
      duration: 0.5,
      type: 'triangle',
      gain: 0.006 + level * 0.01,
      delay: 0.04,
      slideTo: 110,
    });
  }

  /**
   * Tappeto del pub: giro di venti minuti generato a ogni battuta, senza file
   * né tagli. Basso, spazzole e melodia entrano a sezioni, così la ripetizione
   * non si sente e non c'è nessun mp3 da scaricare.
   */
  startAmbient(): void {
    if (!this.audioEnabled() || this.ambientInterval) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.ambientBar = 0;
    this.ambientNextBarAt = ctx.currentTime + 0.12;
    this.startVinyl(ctx);
    this.ambientInterval = setInterval(() => this.scheduleAmbient(), 250);
    this.scheduleAmbient();
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

  /** Programma le battute con un piccolo anticipo, come un vero sequencer. */
  private scheduleAmbient(): void {
    const ctx = this.audioContext;
    if (!ctx || !this.ambientInterval || !this.audioEnabled()) return;

    // Scheda in background: il timer arranca. Si salta al punto giusto invece
    // di scaricare tutte le battute arretrate in un colpo.
    if (this.ambientNextBarAt < ctx.currentTime) {
      const skipped = Math.ceil((ctx.currentTime - this.ambientNextBarAt) / PUB_BED_SECONDS_PER_BAR);
      this.ambientBar = (this.ambientBar + skipped) % PUB_BED_TOTAL_BARS;
      this.ambientNextBarAt += skipped * PUB_BED_SECONDS_PER_BAR;
    }

    const horizon = ctx.currentTime + 1.2;
    while (this.ambientNextBarAt < horizon) {
      this.scheduleAmbientBar(this.ambientBar, this.ambientNextBarAt);
      this.ambientBar = (this.ambientBar + 1) % PUB_BED_TOTAL_BARS;
      this.ambientNextBarAt += PUB_BED_SECONDS_PER_BAR;
    }
  }

  private scheduleAmbientBar(barIndex: number, startAt: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const bar = pubBedBar(barIndex);
    for (const note of bar.notes) {
      this.tone({
        freq: midiToFrequency(note.midi),
        duration: note.duration,
        type: note.type,
        gain: note.gain,
        attack: note.attack,
        detune: note.detune,
        delay: Math.max(0, startAt + note.beat * PUB_BED_SECONDS_PER_BEAT - ctx.currentTime),
      });
    }

    for (const beat of bar.brushes) {
      this.noiseBurst(
        0.09,
        0.0035,
        Math.max(0, startAt + beat * PUB_BED_SECONDS_PER_BEAT - ctx.currentTime),
        3200,
      );
    }

    if (bar.clink) {
      this.tone({
        freq: midiToFrequency(96),
        duration: 0.09,
        type: 'sine',
        gain: 0.0025,
        attack: 0.005,
        delay: Math.max(0, startAt + 3.25 * PUB_BED_SECONDS_PER_BEAT - ctx.currentTime),
      });
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

    source.connect(filter).connect(gain).connect(this.master ?? ctx.destination);
    source.start();
    this.ambientNoise = source;
    this.ambientNoiseGain = gain;
  }

  /**
   * Chiude i suoni legati al round. Il tappeto del pub resta: deve suonare
   * anche sotto classifiche e bonus, per tutta la serata.
   */
  stopAll(): void {
    this.stopSuspense();
    this.stopClock();
  }

  toggleAudio(): void {
    this.audioEnabled.update((enabled) => !enabled);
    this.applyEnabled();
    this.muteUi(!this.audioEnabled());
    if (!this.audioEnabled()) {
      this.stopAll();
      this.stopAmbient();
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
   * Contesto condiviso: anche il Quiz musicale ci appende i suoi filtri, così
   * il mute della TV spegne davvero tutto e non solo gli effetti sintetizzati.
   */
  context(): AudioContext | undefined {
    return this.ensureContext();
  }

  /** Bus di uscita comune: ogni sorgente passa dal gain master. */
  output(): AudioNode | undefined {
    this.ensureContext();
    return this.master;
  }

  /** Riprende il contesto dopo un gesto utente o al ritorno sulla scheda. */
  async unlock(): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Il browser vuole un gesto: ci riprovano i listener globali.
      }
    }
    this.applyEnabled();
    // Il contesto di Foley è separato: si sblocca con lo stesso gesto.
    try {
      unlockFoley();
      setFoley({ volume: UI_VOLUME, muted: !this.audioEnabled() });
      this.uiReady = true;
    } catch {
      // Nessun Web Audio (browser vecchio o test): la serata resta silenziosa.
    }
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

  private muteUi(muted: boolean): void {
    try {
      setFoley({ muted });
    } catch {
      // Il muto principale resta comunque attivo.
    }
  }

  private ensureContext(): AudioContext | undefined {
    try {
      if (!this.audioContext) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return undefined;
        this.audioContext = new Ctx();
        this.master = this.audioContext.createGain();
        this.master.gain.value = this.audioEnabled() ? 1 : 0;
        this.master.connect(this.audioContext.destination);
      }
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume().catch(() => undefined);
      }
      return this.audioContext;
    } catch {
      return undefined;
    }
  }

  /** Primo gesto utile: sblocca il contesto una volta e poi si toglie. */
  private armUnlock(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!(window.AudioContext || (window as any).webkitAudioContext)) return;

    const unlock = () => {
      void this.unlock().then(() => {
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
        window.removeEventListener('touchstart', unlock, true);
      });
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('touchstart', unlock, true);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.unlock();
    });
  }

  /** Mute con ramp: zittisce anche i suoni già schedulati, senza click. */
  private applyEnabled(): void {
    const ctx = this.audioContext;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(this.audioEnabled() ? 1 : 0, now + 0.03);
  }

  /** Rumore filtrato con inviluppo: base dell'applauso sintetico. */
  private noiseBurst(duration: number, gain: number, delay = 0, frequency = 1600): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const envelope = Math.pow(1 - i / frames, 2);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    const level = ctx.createGain();
    level.gain.value = gain;
    source.connect(filter).connect(level).connect(this.master ?? ctx.destination);
    source.start(ctx.currentTime + delay);
  }

  private tone(options: ToneOptions): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const start = ctx.currentTime + (options.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(options.freq, start);
    if (options.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, options.slideTo), start + options.duration);
    }

    if (options.detune) {
      osc.detune.setValueAtTime(options.detune, start);
    }

    // Nessun effetto supera il tetto del catalogo: la voce resta davanti.
    const peak = Math.min(options.gain ?? 0.05, 0.09);
    const attack = Math.min(Math.max(options.attack ?? 0.015, 0.005), options.duration * 0.8);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);

    osc.connect(gain).connect(this.master ?? ctx.destination);
    osc.start(start);
    osc.stop(start + options.duration + 0.05);
  }

  private chord(freqs: number[], duration: number, delay = 0): void {
    freqs.forEach((freq) => this.tone({ freq, duration, type: 'sine', gain: 0.03, delay }));
  }
}
