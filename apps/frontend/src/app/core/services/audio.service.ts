import { Injectable, signal } from '@angular/core';
import { play as playFoley, set as setFoley, unlock as unlockFoley, type CueName } from '@foleyjs/core';
import {
  AUDIO_EVENTS,
  BONUS_ENTRANCE_TYPES,
  type AudioEventId,
} from './audio-catalog';
import { AUDIO_FILES } from './audio-files';
import {
  bell,
  brass,
  buzzer,
  click,
  createRoom,
  crowd,
  drumroll,
  fireworks,
  formant,
  modal,
  noiseVoice,
  pluck,
} from './audio-dsp';
import {
  bedBar,
  bedForGame,
  bedSecondsPerBar,
  bedSecondsPerBeat,
  midiToFrequency,
  type BedProfile,
} from './bed-profiles';

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

/** Quattro partenze dello stesso applauso: offset in secondi e velocità. */
const APPLAUSE_VARIATIONS = [
  { offset: 0, rate: 1 },
  { offset: 1.15, rate: 0.97 },
  { offset: 2.3, rate: 1.03 },
  { offset: 3.4, rate: 0.99 },
];

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
  /** Tappeto attivo: uno per gioco, deciso da `setGameBed`. */
  private bedProfile: BedProfile = bedForGame(null);
  private ambientNoise?: AudioBufferSourceNode;
  private ambientNoiseGain?: GainNode;
  private master?: GainNode;
  /** Bus della TV: entra nel master e manda una copia nella coda di stanza. */
  private tvBus?: GainNode;
  private roomSend?: GainNode;

  /** Foley ha il suo contesto: si configura una volta sola. */
  private uiReady = false;

  /** Volume generale della TV, 0–1. Il muto resta il suo interruttore. */
  readonly masterVolume = signal(1);
  /** Ultima riproduzione per evento: serve alla distanza minima del catalogo. */
  private readonly lastEventAt = new Map<string, number>();
  /** File già decodificati; `null` = assente, si resta sulla sintesi. */
  private readonly recorded = new Map<string, AudioBuffer | null>();
  /** File in caricamento: evita doppie fetch sullo stesso evento. */
  private readonly recording = new Set<string>();
  /** Bus dell'evento in corso: applica la rifinitura di volume del catalogo. */
  private wetBus?: GainNode;
  private dryBus?: GainNode;

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
    // Lub-dub: due colpi, il secondo più debole e più chiuso del primo.
    const beat = () => {
      const level = 0.05 + this.heartbeatIntensity * 0.03;
      this.tone({ freq: 76, duration: 0.19, type: 'sine', gain: level, slideTo: 44 });
      this.tone({ freq: 152, duration: 0.06, type: 'triangle', gain: level * 0.22, slideTo: 92 });
      window.setTimeout(() => {
        if (!this.audioEnabled()) return;
        this.tone({ freq: 68, duration: 0.24, type: 'sine', gain: level * 0.62, slideTo: 40 });
        this.tone({ freq: 136, duration: 0.05, type: 'triangle', gain: level * 0.14, slideTo: 84 });
      }, Math.round(250 - this.heartbeatIntensity * 70));
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
    // Orologio da parete: scatto secco di legno, più corpo grave appena percettibile.
    const tick = () => {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const at = this.at;
      click(ctx, this.out(ctx), { at, gain: 0.33, freq: 2600, q: 10, decay: 0.028 });
      modal(ctx, this.out(ctx), {
        at,
        gain: 0.18,
        partials: [
          { freq: 1240, decay: 0.05, q: 28 },
          { freq: 1980, decay: 0.032, q: 22, gain: 0.45 },
        ],
      });
      this.tone({ freq: 98, duration: 0.06, type: 'sine', gain: 0.09, slideTo: 72 });
    };
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
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    // Campana di ottone: parziali inarmonici, non due sinusoidi pure.
    bell(ctx, this.out(ctx), { at, freq: 1046.5, duration: 1.9, ratio: 2.76, index: 2.6, gain: 0.05 });
    bell(ctx, this.out(ctx), { at: at + 0.008, freq: 2093, duration: 1.2, ratio: 1.4, index: 1.1, gain: 0.014, pan: 0.25 });
    click(ctx, this.out(ctx), { at, gain: 0.05, freq: 4200, q: 2, decay: 0.02 });
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
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    this.playUi('sbagliato');
    // Ottoni che scendono: la faccia del presentatore, non un bip discendente.
    brass(ctx, this.out(ctx), { at, freq: 233, to: 138, duration: 0.5, gain: 0.055, voices: 3 });
    brass(ctx, this.out(ctx), { at: at + 0.06, freq: 175, to: 104, duration: 0.55, gain: 0.038, voices: 2 });
    modal(ctx, this.out(ctx), {
      at,
      gain: 0.05,
      partials: [
        { freq: 110, decay: 0.35, q: 12 },
        { freq: 220, decay: 0.25, q: 16, gain: 0.4 },
      ],
    });
    this.playUuuh();
  }

  /** Tintinnio di gettoni: pioggia di ping metallici, effetto da bar. */
  playCoins(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    // Gettoni sul banco: metallo piccolo, ognuno con la sua coda e la sua posizione.
    // Pioggia fitta: più gettoni, più brillanti, sparsi fino a mezzo secondo
    // e mezzo — il tintinnio deve sembrare una manciata, non due monete.
    const pings: Array<[number, number]> = [
      [2350, 0], [2820, 0.04], [2100, 0.09], [3200, 0.12], [2650, 0.17],
      [2450, 0.21], [3050, 0.25], [2200, 0.29], [2900, 0.33], [2550, 0.37],
      [3400, 0.41], [2000, 0.45], [2750, 0.49], [3150, 0.53], [2300, 0.57],
      [2950, 0.61], [2520, 0.65], [3300, 0.69],
    ];
    for (const [freq, delay] of pings) {
      modal(ctx, this.out(ctx), {
        at: at + delay,
        gain: 0.2,
        partials: [
          { freq, decay: 0.18, q: 60, gain: 1 },
          { freq: freq * 2.41, decay: 0.1, q: 70, gain: 0.55 },
        ],
        strike: { freq: 5200, q: 1.4, duration: 0.02, gain: 0.42 },
        pan: delay * 1.4 - 0.35,
      });
    }
    click(ctx, this.out(ctx), { at, gain: 0.12, freq: 900, q: 1.2, decay: 0.06 });
  }

  /** Applauso sintetico: folate di rumore filtrato, senza asset esterni. */
  playApplause(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    // Battimani veri: tanti colpi brevi in stereo, non un soffio unico.
    crowd(ctx, this.out(ctx), { at: this.at, duration: 1.9, gain: 0.06, density: 95, seed: 21 });
  }

  /**
   * «PUAH»: colpo di racchetta sulla pallina da tennis, quando la risposta è
   * giusta e il punto è tuo. Impulso di rumore filtrato più una nota corta.
   */
  playRacketHit(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    // Palla sulla corda: schiocco di rumore corto e corda che vibra subito dopo.
    // «Poc» secco della palla sulle corde: attacco brevissimo, corpo basso
    // della racchetta e corda che vibra appena. Prima era un fruscio.
    noiseVoice(ctx, this.out(ctx, false), {
      at,
      duration: 0.045,
      gain: 0.26,
      freq: 1650,
      q: 0.9,
      attack: 0.001,
      release: 0.04,
    });
    modal(ctx, this.out(ctx, false), {
      at,
      gain: 0.12,
      partials: [
        { freq: 175, decay: 0.1, q: 8 },
        { freq: 330, decay: 0.07, q: 10, gain: 0.6 },
      ],
    });
    pluck(ctx, this.out(ctx, false), { at: at + 0.006, freq: 320, duration: 0.14, gain: 0.06, brightness: 0.85 });
  }

  /** «Uuuh» del pubblico quando una squadra sbaglia. */
  playUuuh(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    // «Uuuh» di sala: tre voci con formanti, ognuna leggermente scordata.
    const voices: Array<[number, number, number]> = [
      [118, -0.4, 0.13],
      [126, 0.35, 0.1],
      [134, 0.7, 0.08],
    ];
    for (const [freq, pan, gain] of voices) {
      formant(ctx, this.out(ctx), {
        at: at + Math.abs(pan) * 0.02,
        duration: 1.15,
        freq,
        to: freq * 0.78,
        gain,
        formants: [[330, 1], [820, 0.55], [2300, 0.2]],
        vibrato: 0.018,
        pan,
      });
    }
    noiseVoice(ctx, this.out(ctx), {
      at,
      duration: 1.1,
      gain: 0.06,
      freq: 700,
      q: 0.7,
      attack: 0.25,
      release: 0.8,
    });
  }

  /** Sirena della Bomba: due toni alternati, da allarme da bar. */
  playBombSiren(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    // Sirena d'allarme: ottoni che salgono e scendono a fiato alternato.
    for (let i = 0; i < 5; i++) {
      const from = i % 2 === 0 ? 392 : 523.25;
      brass(ctx, this.out(ctx), {
        at: at + i * 0.26,
        freq: from,
        to: i % 2 === 0 ? 523.25 : 392,
        duration: 0.28,
        gain: 0.1,
        voices: 3,
      });
    }
    noiseVoice(ctx, this.out(ctx), {
      at,
      duration: 1.35,
      gain: 0.05,
      freq: 900,
      to: 1600,
      q: 1.2,
      attack: 0.05,
      release: 1.2,
    });
  }

  /**
   * Ingresso dei cinque bonus: cinque richiami diversi, non un jingle unico.
   * Restano brevi e non coprono la voce del presentatore.
   */
  playBonusEntrance(type: string): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    const room = this.out(ctx);

    switch (type) {
      case 'CASINO_COLOR': {
        // Gettone appoggiato sul panno, pallina che si posa, sala che mormora.
        modal(ctx, room, {
          at,
          gain: 0.3,
          partials: [
            { freq: 2650, decay: 0.16, q: 60 },
            { freq: 3980, decay: 0.1, q: 70, gain: 0.4 },
          ],
          strike: { freq: 5400, q: 1.4, duration: 0.02, gain: 0.1 },
        });
        modal(ctx, room, { at: at + 0.26, gain: 0.14, partials: [{ freq: 2920, decay: 0.12, q: 60 }], pan: 0.3 });
        crowd(ctx, room, { at: at + 0.46, duration: 0.9, gain: 0.07, density: 55, seed: 12 });
        break;
      }
      case 'BLACKJACK':
        // Carta che sfila dal mazzo, poi il colpo del mazzo che si chiude.
        noiseVoice(ctx, room, {
          at,
          duration: 0.14,
          gain: 0.2,
          freq: 2400,
          to: 5200,
          q: 1.2,
          attack: 0.02,
          release: 0.1,
        });
        click(ctx, room, { at: at + 0.16, gain: 0.18, freq: 1500, q: 2.2, decay: 0.05 });
        modal(ctx, room, {
          at: at + 0.16,
          gain: 0.14,
          partials: [
            { freq: 220, decay: 0.14, q: 14 },
            { freq: 440, decay: 0.1, q: 18, gain: 0.5 },
          ],
        });
        break;
      case 'CASINO_DOZEN':
        // Dadi nel bicchiere: cinque rimbalzi di plastica, poi si fermano.
        for (let i = 0; i < 6; i++) {
          const hit = 0.02 + i * 0.09 + (i % 2) * 0.03;
          modal(ctx, room, {
            at: at + hit,
            gain: 0.5 * (1 - i * 0.12),
            partials: [
              { freq: 1180 + i * 90, decay: 0.05, q: 26 },
              { freq: 2140 + i * 120, decay: 0.03, q: 30, gain: 0.5 },
            ],
            strike: { freq: 3200, q: 1.5, duration: 0.012, gain: 0.3 },
            pan: i % 2 === 0 ? -0.35 : 0.35,
          });
        }
        break;
      case 'CAVALLO':
        // Zoccoli sul legno: quattro battute di galoppo, mai uguali fra loro.
        for (let i = 0; i < 4; i++) {
          const hit = i * 0.22 + (i % 2) * 0.03;
          modal(ctx, room, {
            at: at + hit,
            gain: 0.9 - i * 0.09,
            partials: [
              { freq: 150, decay: 0.1, q: 12 },
              { freq: 320, decay: 0.07, q: 16, gain: 0.6 },
              { freq: 760, decay: 0.04, q: 20, gain: 0.25 },
            ],
            strike: { freq: 900, q: 1.3, duration: 0.02, gain: 0.35 },
            pan: i % 2 === 0 ? -0.2 : 0.25,
          });
        }
        break;
      case 'CASINO_NUMBER':
        // Leva della slot che scende, rullo che si ferma, gettoni che escono.
        noiseVoice(ctx, room, {
          at,
          duration: 0.3,
          gain: 0.08,
          freq: 700,
          to: 200,
          q: 1.1,
          attack: 0.01,
          release: 0.28,
        });
        for (let i = 0; i < 3; i++) {
          click(ctx, room, {
            at: at + 0.08 + i * 0.07,
            gain: 0.09,
            freq: 1700 + i * 500,
            q: 9,
            decay: 0.02,
          });
        }
        this.playCoins();
        break;
    }
  }

  /**
   * Conferma globale: risposta registrata o azione accettata dal server.
   * Suono breve, due note in salita, pensato per il telefono.
   */
  playConfirm(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    this.playUi('prenotazione');
    // Conferma da telefono: colpo di legno piccolo, appena percettibile.
    click(ctx, this.out(ctx, false), { at, gain: 0.6, freq: 2600, q: 8, decay: 0.03 });
    modal(ctx, this.out(ctx, false), {
      at,
      gain: 0.45,
      partials: [
        { freq: 1120, decay: 0.06, q: 30 },
        { freq: 1660, decay: 0.04, q: 26, gain: 0.4 },
      ],
    });
  }

  /**
   * Errore globale: risposta rifiutata, azione non valida o tempo scaduto.
   * Suono corto e grave, distinto dal «sbagliato» della TV.
   */
  playError(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    this.playUi('sbagliato');
    // Errore da telefono: ronzio corto e chiuso, senza invadenza.
    buzzer(ctx, this.out(ctx, false), { at, duration: 0.2, gain: 0.05, freq: 148 });
  }

  /**
   * Gong del via: fondamentale grave con parziali inarmoniche, coda lunga e
   * un attacco metallico. È il segnale che fa partire il conteggio dei telefoni.
   */
  playGong(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    const base = 79;
    // Tam-tam: parziali inarmonici che si spengono uno dopo l'altro e
    // continuano a battere fra loro. Niente nota, solo metallo.
    // Colpo di via, non campana: code corte e poche parziali alte, così non
    // sembra il rintocco di una chiesa.
    modal(ctx, this.out(ctx), {
      at,
      gain: 1.3,
      partials: [
        { freq: base, decay: 1.9, q: 18, gain: 1 },
        { freq: base * 2.03, decay: 1.5, q: 22, gain: 0.5 },
        { freq: base * 2.91, decay: 1.1, q: 26, gain: 0.3 },
        { freq: base * 4.12, decay: 0.7, q: 30, gain: 0.16 },
      ],
      strike: { freq: 620, q: 1, duration: 0.16, gain: 0.12 },
    });
    // Seconda campana appena scordata: il battimento tiene vivo il suono.
    modal(ctx, this.out(ctx), {
      at: at + 0.006,
      gain: 0.3,
      partials: [
        { freq: base * 1.0045, decay: 1.4, q: 20 },
        { freq: base * 2.046, decay: 1.1, q: 24, gain: 0.4 },
      ],
      pan: -0.2,
    });
    noiseVoice(ctx, this.out(ctx), {
      at,
      duration: 0.3,
      gain: 0.2,
      freq: 420,
      to: 140,
      q: 0.8,
      type: 'lowpass',
      attack: 0.004,
      release: 0.28,
    });
  }

  /** Tempo scaduto: la conferma che il round non accetta più risposte. */
  playTimeUp(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    // Cicalino vero, tutto sul bus della TV: così il volume della regia lo
    // controlla (il cue Foley da solo restava fuori dal cursore).
    buzzer(ctx, this.out(ctx), { at, duration: 0.95, gain: 0.075, freq: 208 });
    modal(ctx, this.out(ctx), {
      at,
      gain: 0.03,
      partials: [{ freq: 104, decay: 0.9, q: 14 }],
    });
  }

  playReveal(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.stopClock();
    this.playUi('rivelazione');
    const at = this.at;
    // Il pubblico trattiene il fiato, poi l'arpa svela la soluzione.
    noiseVoice(ctx, this.out(ctx), {
      at,
      duration: 0.7,
      gain: 0.05,
      freq: 500,
      to: 2800,
      q: 0.9,
      attack: 0.5,
      release: 0.2,
    });
    const arpeggio = [523.25, 659.25, 783.99, 1046.5];
    arpeggio.forEach((freq, index) => {
      pluck(ctx, this.out(ctx), {
        at: at + 0.5 + index * 0.055,
        freq,
        duration: 1.6,
        gain: 0.12,
        brightness: 0.62,
        pan: index * 0.14 - 0.2,
      });
    });
    bell(ctx, this.out(ctx), { at: at + 0.72, freq: 2093, duration: 1.4, ratio: 2.4, index: 1.6, gain: 0.06 });
  }

  /**
   * Tick della pallina sui separatori della roulette: partono fitti e
   * rallentano fino al fermo, con un tonfo quando la pallina scende sul rotore.
   */
  playRouletteTicks(durationMs = 6750): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    const seconds = durationMs / 1000;

    // Rotore che gira: ronzio basso e sordo, sempre in sottofondo.
    noiseVoice(ctx, this.out(ctx), {
      at,
      duration: seconds * 0.95,
      gain: 0.016,
      freq: 220,
      to: 160,
      q: 1.6,
      type: 'lowpass',
      attack: 0.15,
      release: seconds * 0.9,
    });

    // La pallina salta di vano in vano: colpi di legno veri, sempre più radi.
    const random = () => Math.random();
    let elapsed = 0;
    while (elapsed < seconds - 0.15) {
      const progress = elapsed / seconds;
      const atHit = at + elapsed;
      const speed = 1 - progress * 0.55;
      modal(ctx, this.out(ctx), {
        at: atHit,
        gain: 0.2 * speed,
        partials: [
          { freq: 1850 - progress * 420 + random() * 120, decay: 0.05, q: 30, gain: 1 },
          { freq: 2960 - progress * 700, decay: 0.03, q: 34, gain: 0.4 },
          { freq: 420, decay: 0.07, q: 14, gain: 0.5 },
        ],
        strike: { freq: 4600, q: 1.2, duration: 0.012, gain: 0.3 },
        pan: random() * 0.7 - 0.35,
      });
      elapsed += 0.028 + Math.pow(progress, 2.4) * 0.36 + random() * 0.01;
    }
  }

  /** Atterraggio della roulette: tonfo grave e accento luminoso. */
  playRouletteLanding(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    // La pallina cade nel vano: tonfo di legno, poi il rimbalzo che si spegne.
    modal(ctx, this.out(ctx), {
      at,
      gain: 0.11,
      partials: [
        { freq: 168, decay: 0.3, q: 18 },
        { freq: 352, decay: 0.22, q: 22, gain: 0.6 },
        { freq: 640, decay: 0.15, q: 26, gain: 0.28 },
      ],
      strike: { freq: 1400, q: 1.1, duration: 0.05, gain: 0.2 },
    });
    modal(ctx, this.out(ctx), {
      at: at + 0.09,
      gain: 0.04,
      partials: [{ freq: 2050, decay: 0.14, q: 34 }],
      pan: 0.25,
    });
    modal(ctx, this.out(ctx), {
      at: at + 0.2,
      gain: 0.02,
      partials: [{ freq: 2260, decay: 0.1, q: 34 }],
      pan: -0.3,
    });
    this.playCoins();
  }

  /** Nuova squadra collegata: bip luminoso a due note. */
  playJoin(): void {
    this.playUi('ingresso');
    this.tone({ freq: 659.25, duration: 0.12, type: 'sine', gain: 0.06 });
    this.tone({ freq: 987.77, duration: 0.16, type: 'sine', gain: 0.05, delay: 0.1 });
  }

  /** Tick delle classifiche e dei countdown. */
  playTick(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    this.playUi('tocco');
    // Timbro da tabellone stampato: colpo di legno e punta di penna, sempre
    // uguale a se stesso (niente nota casuale che sembra sbagliata).
    click(ctx, this.out(ctx), { at, gain: 0.3, freq: 2100, q: 7, decay: 0.035 });
    modal(ctx, this.out(ctx), {
      at,
      gain: 0.22,
      partials: [
        { freq: 880, decay: 0.07, q: 24 },
        { freq: 1320, decay: 0.05, q: 26, gain: 0.5 },
      ],
    });
    this.tone({ freq: 190, duration: 0.06, type: 'sine', gain: 0.07, slideTo: 140 });
  }

  /** Tick del countdown: legno secco e bassissimo, sotto la musica. */
  playCountdownTick(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    // Scatto di orologio meccanico: rumore strettissimo che eccita un corpo
    // di legno, più il sordo del meccanismo.
    click(ctx, this.out(ctx), { at, gain: 0.45, freq: 2900, q: 11, decay: 0.024 });
    modal(ctx, this.out(ctx), {
      at,
      gain: 0.3,
      partials: [
        { freq: 1620, decay: 0.05, q: 34, gain: 1 },
        { freq: 2480, decay: 0.034, q: 30, gain: 0.5 },
      ],
    });
    this.tone({ freq: 140, duration: 0.05, type: 'sine', gain: 0.1, slideTo: 96 });
  }

  /**
   * Miccia della Bomba: frizione che sfrigola con qualche scoppiettio secco.
   * Suona in TV mentre il turno scorre, sotto la sirena.
   */
  playFuse(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    noiseVoice(ctx, this.out(ctx), {
      at,
      duration: 1.8,
      gain: 0.12,
      freq: 3200,
      to: 5200,
      q: 0.7,
      type: 'highpass',
      attack: 0.02,
      release: 1.4,
    });
    const crackles: Array<[number, number]> = [
      [0.12, 0.05], [0.31, 0.04], [0.47, 0.06], [0.7, 0.05],
      [0.95, 0.07], [1.2, 0.05], [1.45, 0.06], [1.62, 0.04],
    ];
    for (const [delay, duration] of crackles) {
      noiseVoice(ctx, this.out(ctx), {
        at: at + delay,
        duration,
        gain: 0.1,
        freq: 2600,
        q: 2.2,
        attack: 0.001,
        release: duration,
      });
    }
  }

  /**
   * Scoppio vero della Bomba: colpo grave che si apre, schegge e coda bassa.
   * È il suono del telefono di chi teneva la bomba.
   */
  playExplosion(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    noiseVoice(ctx, this.out(ctx, false), {
      at,
      duration: 0.9,
      gain: 0.42,
      freq: 320,
      to: 60,
      q: 0.6,
      type: 'lowpass',
      attack: 0.001,
      release: 0.85,
    });
    this.tone({ freq: 58, duration: 0.5, type: 'sine', gain: 0.09, slideTo: 32 });
    for (const delay of [0.06, 0.14, 0.23, 0.35]) {
      noiseVoice(ctx, this.out(ctx, false), {
        at: at + delay,
        duration: 0.08,
        gain: 0.09,
        freq: 2400,
        q: 1.4,
        attack: 0.001,
        release: 0.07,
      });
    }
  }

  /** Bong di fine countdown: campana grave con coda breve. */
  playCountdownBong(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    // Grosso gong da studio: colpo basso, coda di metallo che si apre.
    // Deve bucare il conteggio: più presenza, fondamentale lunga e un sub
    // che si sente anche sui telefoni piccoli.
    modal(ctx, this.out(ctx), {
      at,
      gain: 0.45,
      partials: [
        { freq: 172, decay: 3.4, q: 30 },
        { freq: 348, decay: 2.6, q: 34, gain: 0.6 },
        { freq: 517, decay: 1.9, q: 38, gain: 0.34 },
        { freq: 903, decay: 1.2, q: 44, gain: 0.18 },
      ],
      strike: { freq: 1100, q: 1.1, duration: 0.09, gain: 0.2 },
    });
    this.tone({ freq: 96, duration: 0.5, type: 'sine', gain: 0.16, slideTo: 64 });
  }

  /** Transizione tra schermate. */
  playWhoosh(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    // Aria che passa: rumore con la banda che sale e si richiude.
    // Transizione leggera: niente corpo grave, solo aria che passa e si
    // chiude in fretta, per non pesare fra una schermata e l'altra.
    noiseVoice(ctx, this.out(ctx), {
      at: this.at,
      duration: 0.3,
      gain: 0.15,
      freq: 900,
      to: 3200,
      q: 1.1,
      attack: 0.05,
      release: 0.22,
    });
  }

  /** Eliminazione dall'Arena. */
  playElimination(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    this.playUi('eliminazione');
    // «Fuori»: ottoni che cascano, aria che si chiude, tonfo finale.
    brass(ctx, this.out(ctx), { at, freq: 294, to: 86, duration: 0.7, gain: 0.06, voices: 3 });
    noiseVoice(ctx, this.out(ctx), {
      at,
      duration: 0.5,
      gain: 0.04,
      freq: 1800,
      to: 220,
      q: 0.9,
      attack: 0.01,
      release: 0.45,
    });
    modal(ctx, this.out(ctx), {
      at: at + 0.42,
      gain: 0.07,
      partials: [
        { freq: 84, decay: 0.55, q: 12 },
        { freq: 168, decay: 0.35, q: 16, gain: 0.45 },
      ],
      strike: { freq: 600, q: 1, duration: 0.06, gain: 0.15 },
    });
  }

  /** Fanfara del podio: arpeggio ascendente e accordo finale. */
  playPodium(): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at;
    // Fanfara d'ottone: tre slanci (I, V, I) con il rullante sotto.
    const stabs: Array<[number, number]> = [
      [261.63, 0],
      [392, 0.22],
      [523.25, 0.44],
    ];
    for (const [freq, delay] of stabs) {
      brass(ctx, this.out(ctx), { at: at + delay, freq, duration: 0.2, gain: 0.055, voices: 3 });
      brass(ctx, this.out(ctx), { at: at + delay, freq: freq * 1.26, duration: 0.18, gain: 0.04, voices: 2 });
    }
    drumroll(ctx, this.out(ctx), { at: at + 0.6, duration: 0.5, gain: 0.03, peakAt: 0.9 });
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, index) => {
      pluck(ctx, this.out(ctx), {
        at: at + 1.05 + index * 0.03,
        freq,
        duration: 1.6,
        gain: 0.05,
        brightness: 0.6,
        pan: index * 0.12 - 0.18,
      });
    });
  }

  /** Rullo di tamburi sintetico; `strength` regola volume e presenza. */
  playDrumroll(seconds = 2, strength = 0.6): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const level = 0.08 + Math.max(0, Math.min(1, strength)) * 0.15;
    drumroll(ctx, this.out(ctx), {
      at: this.at,
      duration: Math.max(0.3, seconds),
      gain: level,
      peakAt: 0.9,
    });
  }

  /**
   * Ultimi due gradini fuori dal podio: due note che salgono, più tese del
   * tick semplice, per far capire che sta per iniziare il podio vero.
   */
  playRankReveal(position: number): void {
    if (!this.audioEnabled()) return;
    this.playUi('tocco');
    const step = position === 5 ? 0 : 1;
    this.tone({ freq: 392 + step * 98, duration: 0.12, type: 'triangle', gain: 0.045 });
    this.tone({ freq: 523.25 + step * 98, duration: 0.16, type: 'triangle', gain: 0.04, delay: 0.1 });
  }

  /**
   * Podio della classifica: il rullo sale dal terzo al primo posto e lascia
   * spazio al festeggiamento. Al secondo si aggiungono le botticelle, al
   * primo i botti pieni.
   */
  playPodiumReveal(position: number): void {
    if (!this.audioEnabled()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const place = Math.max(1, Math.min(3, Math.round(position)));
    const at = this.at;
    this.playUi('vittoria');

    // Il rullo sale sempre; il resto cresce col posto che si svela.
    const rollSeconds = place === 3 ? 0.7 : place === 2 ? 1.3 : 2.4;
    drumroll(ctx, this.out(ctx), {
      at,
      duration: rollSeconds,
      gain: 0.02 + place * 0.012,
      peakAt: 0.92,
    });

    this.playCelebration(place as 1 | 2 | 3, rollSeconds * 0.92);
    if (place >= 2) {
      fireworks(ctx, this.out(ctx), {
        at: at + rollSeconds + 0.1,
        count: place === 2 ? 4 : 9,
        gain: 0.05,
        spacing: place === 2 ? 0.22 : 0.16,
      });
    }
    if (place === 3) {
      crowd(ctx, this.out(ctx), { at: at + rollSeconds, duration: 1.4, gain: 0.028, density: 70, seed: 9 });
    }
  }

  private playCelebration(level: 1 | 2 | 3, delay: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const at = this.at + delay;
    const notes = level === 1
      ? [523.25, 659.25, 783.99]
      : level === 2
        ? [392, 523.25, 659.25, 783.99]
        : [392, 523.25, 659.25, 783.99, 1046.5];
    const step = level === 1 ? 0.09 : level === 2 ? 0.1 : 0.11;
    const gain = level === 1 ? 0.035 : level === 2 ? 0.045 : 0.055;

    // Arpa e ottoni insieme: la festa ha corpo, non è un arpeggio di bip.
    notes.forEach((freq, index) => {
      pluck(ctx, this.out(ctx), {
        at: at + index * step,
        freq,
        duration: 1.2,
        gain,
        brightness: 0.66,
        pan: index * 0.12 - 0.2,
      });
    });
    const chordAt = at + notes.length * step;
    brass(ctx, this.out(ctx), {
      at: chordAt,
      freq: notes[0] / 2,
      duration: 0.5 + level * 0.12,
      gain: 0.03 + level * 0.008,
      voices: 3,
    });
    brass(ctx, this.out(ctx), {
      at: chordAt,
      freq: notes[1] / 2,
      duration: 0.45 + level * 0.1,
      gain: 0.022 + level * 0.006,
      voices: 3,
    });
    if (level >= 2) {
      crowd(ctx, this.out(ctx), {
        at: chordAt,
        duration: level === 2 ? 1.5 : 2.2,
        gain: level === 2 ? 0.03 : 0.04,
        density: 80,
        seed: 4 + level,
      });
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
   * Tappeto musicale della serata, generato a ogni battuta: nessun file, nessun
   * taglio. `gameType` sceglie il tappeto del gioco; senza argomento resta
   * quello del gioco in corso (o la lobby).
   */
  startAmbient(gameType?: string | null): void {
    if (!this.audioEnabled()) return;
    if (gameType !== undefined) this.setGameBed(gameType);
    if (this.ambientInterval) return;
    const ctx = this.ensureContext();
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
    // Se il tappeto sta suonando, la prossima battuta usa già il nuovo giro.
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

  /** Programma le battute con un piccolo anticipo, come un vero sequencer. */
  private scheduleAmbient(): void {
    const ctx = this.audioContext;
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
    const ctx = this.audioContext;
    if (!ctx) return;

    const profile = this.bedProfile;
    const bar = bedBar(profile, barIndex);
    // Il tappeto non passa dal bus dell'evento: suona sempre al suo volume.
    const bus = this.room(ctx);
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
   * Suona un evento del catalogo, con la sua distanza minima e la sua
   * rifinitura di volume. È il punto d'ingresso della regia audio: i metodi
   * storici restano per i chiamanti esistenti.
   *
   * <p>Restituisce `false` quando l'evento viene saltato — muto spento o
   * troppo ravvicinato — così la regia può dirlo invece di fingere.</p>
   */
  play(event: AudioEventId, variant = 0): boolean {
    if (!this.audioEnabled()) return false;
    const definition = AUDIO_EVENTS[event];
    if (!definition) return false;

    const now = Date.now();
    const last = this.lastEventAt.get(event) ?? -Infinity;
    if (now - last < definition.minIntervalMs) return false;
    this.lastEventAt.set(event, now);

    this.beginEventBus(definition.volume);
    this.runEvent(event, variant);
    return true;
  }

  /** Volume generale 0–1, applicato al bus master senza click. */
  setMasterVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
    this.masterVolume.set(clamped);
    this.applyEnabled();
  }

  /** Un evento del catalogo per id, con etichetta e regole: lo usa la regia. */
  event(id: AudioEventId) {
    return AUDIO_EVENTS[id];
  }

  private runEvent(event: AudioEventId, variant: number): void {
    // Prima il file registrato: è il suono della serata. Se manca o non si
    // carica, `playRecorded` lo dice e si passa alla sintesi qui sotto.
    if (this.playRecorded(event, variant)) return;
    this.runSynth(event, variant);
  }

  /**
   * Riproduce il file dell'evento. Torna `false` quando non c'è nulla da
   * caricare (evento sintetico o file già fallito), così il chiamante sa che
   * deve suonare la sintesi; se il caricamento fallisce, la sintesi parte da
   * sola dal `catch`.
   */
  private playRecorded(event: AudioEventId, variant: number): boolean {
    const files = AUDIO_FILES[event];
    if (!files || files.length === 0) return false;
    const ctx = this.ensureContext();
    if (!ctx) return false;
    const file = files[Math.abs(variant) % files.length];
    const style = event === 'applause'
      ? APPLAUSE_VARIATIONS[Math.abs(variant) % APPLAUSE_VARIATIONS.length]
      : undefined;
    const url = `assets/audio/${file}`;
    const cached = this.recorded.get(url);
    if (cached === null) return false;
    if (cached) {
      this.startBuffer(ctx, cached, style);
      return true;
    }
    if (this.recording.has(url)) return true;
    this.recording.add(url);
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} su ${url}`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.recorded.set(url, buffer);
        this.recording.delete(url);
        this.startBuffer(ctx, buffer, style);
      })
      .catch(() => {
        // File assente in questa build: si segna e si usa la sintesi.
        this.recorded.set(url, null);
        this.recording.delete(url);
        this.runSynth(event, variant);
      });
    return true;
  }

  /**
   * Riproduce un buffer sul bus dell'evento. `offset` e `rate` servono agli
   * applausi: dalla stessa registrazione partono quattro attacchi diversi.
   */
  private startBuffer(
    ctx: AudioContext,
    buffer: AudioBuffer,
    style?: { offset?: number; rate?: number },
  ): void {
    if (!this.audioEnabled()) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (style?.rate) source.playbackRate.value = style.rate;
    source.connect(this.out(ctx));
    const offset = Math.max(0, Math.min(style?.offset ?? 0, Math.max(0, buffer.duration - 0.3)));
    source.start(0, offset);
  }

  private runSynth(event: AudioEventId, variant: number): void {
    switch (event) {
      case 'gong': this.playGong(); break;
      case 'countdownTick': this.playCountdownTick(); break;
      case 'countdownBong': this.playCountdownBong(); break;
      case 'join': this.playJoin(); break;
      case 'tick': this.playTick(); break;
      case 'rankReveal': this.playRankReveal(variant % 2 === 0 ? 5 : 4); break;
      case 'whoosh': this.playWhoosh(); break;
      case 'elimination': this.playElimination(); break;
      case 'correct': this.playCorrect(); break;
      case 'wrong': this.playWrong(); break;
      case 'timeUp': this.playTimeUp(); break;
      case 'reveal': this.playReveal(); break;
      case 'applause': this.playApplause(); break;
      case 'coins': this.playCoins(); break;
      case 'racket': this.playRacketHit(); break;
      case 'uuuh': this.playUuuh(); break;
      case 'bombSiren': this.playBombSiren(); break;
      case 'fuse': this.playFuse(); break;
      case 'explosion': this.playExplosion(); break;
      case 'rouletteTicks': this.playRouletteTicks(); break;
      case 'rouletteLanding': this.playRouletteLanding(); break;
      case 'drumroll': this.playDrumroll(1.6, 0.8); break;
      case 'bell': this.playBell(); break;
      case 'confirm': this.playConfirm(); break;
      case 'error': this.playError(); break;
      case 'podium': this.playPodium(); break;
      case 'podiumReveal': this.playPodiumReveal((variant % 3) + 1); break;
      case 'bonusEntrance':
        this.playBonusEntrance(BONUS_ENTRANCE_TYPES[Math.abs(variant) % BONUS_ENTRANCE_TYPES.length]);
        break;
      case 'heartbeat': this.startHeartbeat(0.6); break;
      case 'clock': this.startClock(); break;
      case 'ambient': this.startAmbient(); break;
    }
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
        this.master.gain.value = this.audioEnabled() ? this.masterVolume() : 0;
        this.master.connect(this.audioContext.destination);
        // La TV suona in una stanza: coda discreta, il telefono resta asciutto.
        this.roomSend = createRoom(this.audioContext, this.master, {
          seconds: 1.25,
          mix: 0.14,
          tone: 4800,
        });
        this.tvBus = this.audioContext.createGain();
        this.tvBus.connect(this.master);
        this.tvBus.connect(this.roomSend);
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
    master.gain.linearRampToValueAtTime(this.audioEnabled() ? this.masterVolume() : 0, now + 0.03);
  }

  /** Destinazione dei suoni di sala: master più coda di stanza. */
  private room(ctx: AudioContext): AudioNode {
    return this.tvBus ?? ctx.destination;
  }

  /**
   * Bus di un singolo evento: porta il volume del catalogo su tutte le voci
   * dell'evento, coda compresa. Un bus per riproduzione, così le code già
   * programmate non cambiano volume quando l'evento successivo comincia.
   */
  private beginEventBus(volume: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const wet = ctx.createGain();
    wet.gain.value = Math.max(0, Math.min(2, volume));
    wet.connect(this.room(ctx));
    const dry = ctx.createGain();
    dry.gain.value = Math.max(0, Math.min(2, volume));
    dry.connect(this.master);
    this.wetBus = wet;
    this.dryBus = dry;
    // Le code più lunghe del catalogo non superano i venti secondi.
    window.setTimeout(() => {
      try {
        wet.disconnect();
        dry.disconnect();
      } catch {
        // già scollegati
      }
    }, 25000);
  }

  /** Uscita dell'evento in corso: bagnata (sala) o asciutta (telefono). */
  private out(ctx: AudioContext, wet = true): AudioNode {
    const bus = wet ? this.wetBus : this.dryBus;
    if (bus) return bus;
    return wet ? this.room(ctx) : this.master ?? ctx.destination;
  }

  /** Momento di partenza delle sequenze: adesso, con un filo di margine. */
  private get at(): number {
    return (this.audioContext?.currentTime ?? 0) + 0.005;
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
