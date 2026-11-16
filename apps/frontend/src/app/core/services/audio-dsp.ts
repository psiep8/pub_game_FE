/**
 * Sintesi degli effetti della serata: strumenti piccoli e ripetibili per
 * costruire suoni «da sala» invece di bip da segnale orario.
 *
 * <p>Tutto nasce dalla Web Audio API, senza file audio nel repository: rumore
 * filtrato per i colpi, banchi di risonatori per legno/metallo/vetro, corde
 * pizzicate Karplus-Strong, campane FM, formanti per le voci del pubblico e
 * una piccola coda di stanza generata al volo. Le funzioni non conoscono il
 * gioco: ricevono il tempo assoluto del contesto e non tornano indietro.</p>
 */

/** Pan stereo, da -1 (sinistra) a 1 (destra). */
function panned(ctx: AudioContext, destination: AudioNode, pan = 0): AudioNode {
  if (pan === 0) return destination;
  const node = ctx.createStereoPanner();
  node.pan.value = Math.max(-1, Math.min(1, pan));
  node.connect(destination);
  return node;
}

const noiseCache = new WeakMap<AudioContext, Map<string, AudioBuffer>>();

/** Rumore bianco in cache: la stessa forma d'onda per tutti i soffi. */
export function noiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  let perContext = noiseCache.get(ctx);
  if (!perContext) {
    perContext = new Map();
    noiseCache.set(ctx, perContext);
  }
  const key = seconds.toFixed(2);
  const cached = perContext.get(key);
  if (cached) return cached;

  const frames = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Rumore con un filo di correlazione: più «materiale», meno sibilo digitale.
  let previous = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    previous = previous * 0.35 + white * 0.65;
    data[i] = previous;
  }
  perContext.set(key, buffer);
  return buffer;
}

export interface ClickOptions {
  at: number;
  gain: number;
  /** Centro di banda del colpo: legno 1200–2500, metallo 3000–6000. */
  freq: number;
  /** Quanto è risonante il colpo: alto = legno secco, basso = colpo sordo. */
  q?: number;
  /** Durata della coda del colpo, in secondi. */
  decay: number;
  pan?: number;
}

/** Colpo secco: impulso di rumore filtrato. Base di tick, biglie e biglie. */
export function click(ctx: AudioContext, destination: AudioNode, options: ClickOptions): void {
  const out = panned(ctx, destination, options.pan);
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, 0.12);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = options.freq;
  filter.Q.value = options.q ?? 6;
  const gain = ctx.createGain();
  const peak = Math.max(0.0002, options.gain);
  gain.gain.setValueAtTime(peak, options.at);
  gain.gain.exponentialRampToValueAtTime(0.0001, options.at + Math.max(0.01, options.decay));
  source.connect(filter).connect(gain).connect(out);
  source.start(options.at);
  source.stop(options.at + Math.min(0.12, options.decay + 0.02));
}

export interface ModalPartial {
  freq: number;
  /** Peso del parziale rispetto agli altri. */
  gain?: number;
  /** Coda, in secondi. */
  decay: number;
  /** Selettività del risonatore: 20–90 per legno e vetro, 8–20 per il metallo. */
  q?: number;
}

export interface ModalOptions {
  at: number;
  gain: number;
  partials: ModalPartial[];
  /** Rumore dell'impatto che «eccita» i risonatori. */
  strike?: { freq: number; q?: number; duration: number; gain: number };
  pan?: number;
}

/**
 * Corpo risonante: un impulso eccita un banco di filtri, come un oggetto
 * colpito. Con parziali armonici suona legno o vetro, con parziali inarmonici
 * suona campana o metallo.
 */
export function modal(ctx: AudioContext, destination: AudioNode, options: ModalOptions): void {
  const out = panned(ctx, destination, options.pan);
  const impulse = ctx.createBufferSource();
  impulse.buffer = noiseBuffer(ctx, 0.12);

  for (const partial of options.partials) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = partial.freq;
    filter.Q.value = partial.q ?? 45;
    const gain = ctx.createGain();
    const level = Math.max(0.0003, options.gain * (partial.gain ?? 1));
    gain.gain.setValueAtTime(0.0001, options.at);
    gain.gain.linearRampToValueAtTime(level, options.at + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, options.at + Math.max(0.02, partial.decay));
    impulse.connect(filter).connect(gain).connect(out);
  }

  const strike = options.strike;
  const strikeGain = ctx.createGain();
  if (strike) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = strike.freq;
    filter.Q.value = strike.q ?? 1.2;
    strikeGain.gain.setValueAtTime(Math.max(0.0002, strike.gain), options.at);
    strikeGain.gain.exponentialRampToValueAtTime(0.0001, options.at + strike.duration);
    impulse.connect(filter).connect(strikeGain).connect(out);
  }

  impulse.start(options.at);
  impulse.stop(options.at + 0.1);
}

export interface NoiseVoiceOptions {
  at: number;
  duration: number;
  gain: number;
  /** Banda del rumore; `to` fa scorrere il filtro durante il suono. */
  freq: number;
  to?: number;
  q?: number;
  type?: BiquadFilterType;
  attack?: number;
  release?: number;
  pan?: number;
}

/** Soffio filtrato con inviluppo: applausi, whoosh, riser, applausi singoli. */
export function noiseVoice(
  ctx: AudioContext,
  destination: AudioNode,
  options: NoiseVoiceOptions,
): void {
  const out = panned(ctx, destination, options.pan);
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, Math.max(0.25, options.duration + 0.1));
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = options.type ?? 'bandpass';
  filter.frequency.setValueAtTime(options.freq, options.at);
  if (options.to) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, options.to), options.at + options.duration);
  }
  filter.Q.value = options.q ?? 1.1;

  const gain = ctx.createGain();
  const attack = Math.min(Math.max(options.attack ?? 0.008, 0.002), options.duration * 0.9);
  const release = Math.min(Math.max(options.release ?? options.duration * 0.7, 0.01), options.duration);
  gain.gain.setValueAtTime(0.0001, options.at);
  gain.gain.linearRampToValueAtTime(Math.max(0.0002, options.gain), options.at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, options.at + attack + release);

  source.connect(filter).connect(gain).connect(out);
  source.start(options.at);
  source.stop(options.at + Math.min(options.duration + 0.05, attack + release + 0.05));
}

export interface PluckOptions {
  at: number;
  freq: number;
  duration: number;
  gain: number;
  /** Da 0 (corda smorzata) a 1 (corda brillante). */
  brightness?: number;
  pan?: number;
}

/**
 * Corda pizzicata Karplus-Strong: rumore in un ritardo di una lunghezza d'onda,
 * filtrato a ogni giro. Sembra una corda vera, non un oscillatore.
 */
export function pluck(ctx: AudioContext, destination: AudioNode, options: PluckOptions): void {
  const rate = ctx.sampleRate;
  const period = Math.max(2, Math.round(rate / options.freq));
  const frames = Math.max(period * 8, Math.floor(rate * Math.min(3, options.duration)));
  const buffer = ctx.createBuffer(1, frames, rate);
  const data = buffer.getChannelData(0);
  const brightness = Math.max(0, Math.min(1, options.brightness ?? 0.55));

  let previous = 0;
  for (let i = 0; i < period; i++) {
    const white = Math.random() * 2 - 1;
    previous = previous * (1 - brightness) + white * brightness;
    data[i] = previous;
  }
  const damping = 0.996 - (1 - brightness) * 0.008;
  for (let i = period; i < frames; i++) {
    data[i] = ((data[i - period] + data[i - period + 1]) * 0.5) * damping;
  }

  const out = panned(ctx, destination, options.pan);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  const level = Math.max(0.0002, options.gain);
  gain.gain.setValueAtTime(0.0001, options.at);
  gain.gain.linearRampToValueAtTime(level, options.at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, options.at + Math.max(0.08, options.duration));
  source.connect(gain).connect(out);
  source.start(options.at);
}

export interface BellOptions {
  at: number;
  freq: number;
  duration: number;
  gain: number;
  /** Rapporto modulante/carrier: 2 per campana, 3.5 per metallo. */
  ratio?: number;
  index?: number;
  pan?: number;
}

/** Campana FM: portante più modulante inarmonico, con coda esponenziale. */
export function bell(ctx: AudioContext, destination: AudioNode, options: BellOptions): void {
  const out = panned(ctx, destination, options.pan);
  const carrier = ctx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.value = options.freq;

  const modulator = ctx.createOscillator();
  modulator.type = 'sine';
  modulator.frequency.value = options.freq * (options.ratio ?? 2);

  const index = ctx.createGain();
  const depth = options.freq * (options.index ?? 2.2);
  index.gain.setValueAtTime(depth, options.at);
  index.gain.exponentialRampToValueAtTime(depth * 0.05, options.at + options.duration * 0.5);
  modulator.connect(index).connect(carrier.frequency);

  const gain = ctx.createGain();
  const level = Math.max(0.0002, options.gain);
  gain.gain.setValueAtTime(0.0001, options.at);
  gain.gain.linearRampToValueAtTime(level, options.at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, options.at + Math.max(0.1, options.duration));

  carrier.connect(gain).connect(out);
  carrier.start(options.at);
  modulator.start(options.at);
  carrier.stop(options.at + options.duration + 0.05);
  modulator.stop(options.at + options.duration + 0.05);
}

export interface BrassOptions {
  at: number;
  freq: number;
  duration: number;
  gain: number;
  /** Frequenza finale: una discesa dà la «pernacchia» dell'errore. */
  to?: number;
  /** Numero di voci: più voci, più corpo (accordo stretto). */
  voices?: number;
  pan?: number;
}

/** Ottoni di sala: denti di sega con filtro che apre, come una fanfara. */
export function brass(ctx: AudioContext, destination: AudioNode, options: BrassOptions): void {
  const out = panned(ctx, destination, options.pan);
  const voices = Math.max(1, options.voices ?? 2);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(420, options.at);
  filter.frequency.exponentialRampToValueAtTime(3200, options.at + 0.06);
  filter.frequency.exponentialRampToValueAtTime(900, options.at + options.duration);
  filter.Q.value = 0.9;

  const gain = ctx.createGain();
  const level = Math.max(0.0002, options.gain);
  gain.gain.setValueAtTime(0.0001, options.at);
  gain.gain.linearRampToValueAtTime(level, options.at + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, options.at + Math.max(0.08, options.duration));

  filter.connect(gain).connect(out);
  for (let i = 0; i < voices; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(options.freq, options.at);
    if (options.to) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, options.to),
        options.at + options.duration * 0.9,
      );
    }
    osc.detune.value = (i - (voices - 1) / 2) * 9;
    osc.connect(filter);
    osc.start(options.at);
    osc.stop(options.at + options.duration + 0.05);
  }
}

export interface FormantOptions {
  at: number;
  duration: number;
  /** Frequenza di base della voce. */
  freq: number;
  /** Frequenza finale: una discesa dà il «uuuh» del pubblico. */
  to?: number;
  gain: number;
  /** Formanti (Hz) della vocale: 300/870/2240 è una «u» scura. */
  formants?: Array<[number, number]>;
  vibrato?: number;
  pan?: number;
}

/** Voce del pubblico: dente di sega filtrato con formanti, vibrato e fiato. */
export function formant(ctx: AudioContext, destination: AudioNode, options: FormantOptions): void {
  const out = panned(ctx, destination, options.pan);
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  const f0 = Math.max(60, options.freq);
  osc.frequency.setValueAtTime(f0, options.at);
  if (options.to) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(50, options.to), options.at + options.duration);
  }

  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 4.6 + Math.random() * 0.8;
  const vibratoDepth = ctx.createGain();
  vibratoDepth.gain.value = (options.vibrato ?? 0.012) * f0;
  vibrato.connect(vibratoDepth).connect(osc.frequency);

  const gain = ctx.createGain();
  const level = Math.max(0.0002, options.gain);
  gain.gain.setValueAtTime(0.0001, options.at);
  gain.gain.linearRampToValueAtTime(level, options.at + 0.09);
  gain.gain.setValueAtTime(level, options.at + options.duration * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, options.at + options.duration);

  const formants = options.formants ?? [
    [320, 1],
    [860, 0.5],
    [2300, 0.22],
  ];
  for (const [frequency, weight] of formants) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = frequency;
    band.Q.value = 7;
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = weight;
    osc.connect(band).connect(voiceGain).connect(gain);
  }

  const breath = ctx.createBufferSource();
  breath.buffer = noiseBuffer(ctx, Math.max(0.4, options.duration + 0.1));
  const breathBand = ctx.createBiquadFilter();
  breathBand.type = 'bandpass';
  breathBand.frequency.value = 1200;
  breathBand.Q.value = 0.8;
  const breathGain = ctx.createGain();
  breathGain.gain.value = 0.12;
  breath.connect(breathBand).connect(breathGain).connect(gain);

  gain.connect(out);
  osc.start(options.at);
  vibrato.start(options.at);
  breath.start(options.at);
  osc.stop(options.at + options.duration + 0.05);
  vibrato.stop(options.at + options.duration + 0.05);
  breath.stop(options.at + options.duration + 0.05);
}

/**
 * Pseudo-casuale deterministico: due applausi uguali a parità di seme, così
 * una prova di sala si può ripetere.
 */
export function seeded(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

export interface CrowdOptions {
  at: number;
  duration: number;
  gain: number;
  /** Colpi al secondo: un applauso fitto sta intorno a 70–110. */
  density?: number;
  seed?: number;
}

/** Applauso: pioggia di battimani filtrati più un letto di rumore tiepido. */
export function crowd(ctx: AudioContext, destination: AudioNode, options: CrowdOptions): void {
  const random = seeded(options.seed ?? 7);
  const density = options.density ?? 85;
  const hits = Math.max(4, Math.round(options.duration * density));

  for (let i = 0; i < hits; i++) {
    const progress = i / hits;
    const at = options.at + progress * options.duration * 0.96 + random() * 0.012;
    // La folla entra e si assesta: prima rada, poi piena, poi coda.
    const envelope = Math.min(1, progress * 5) * Math.min(1, (1 - progress) * 4);
    const frequency = 900 + random() * 2600;
    click(ctx, destination, {
      at,
      gain: options.gain * (0.5 + random() * 0.8) * envelope,
      freq: frequency,
      q: 2.4 + random() * 2,
      decay: 0.03 + random() * 0.05,
      pan: random() * 1.6 - 0.8,
    });
  }

  noiseVoice(ctx, destination, {
    at: options.at,
    duration: options.duration,
    gain: options.gain * 1.5,
    freq: 1500,
    to: 2600,
    q: 0.5,
    type: 'bandpass',
    attack: options.duration * 0.18,
    release: options.duration * 0.8,
  });
}

export interface FireworkOptions {
  at: number;
  count: number;
  gain: number;
  /** Secondi fra un botto e l'altro. */
  spacing?: number;
  seed?: number;
}

/** Botti del podio: scoppio grave e crepitio di scintille. */
export function fireworks(ctx: AudioContext, destination: AudioNode, options: FireworkOptions): void {
  const random = seeded(options.seed ?? 31);
  const spacing = options.spacing ?? 0.16;
  for (let i = 0; i < options.count; i++) {
    const at = options.at + i * spacing + random() * 0.03;
    noiseVoice(ctx, destination, {
      at,
      duration: 0.22,
      gain: options.gain,
      freq: 520,
      to: 120,
      q: 0.7,
      type: 'lowpass',
      attack: 0.002,
      release: 0.2,
      pan: random() * 1.4 - 0.7,
    });
    for (let spark = 0; spark < 6; spark++) {
      click(ctx, destination, {
        at: at + 0.02 + spark * 0.014,
        gain: options.gain * 0.35,
        freq: 3200 + random() * 3200,
        q: 4,
        decay: 0.012,
        pan: random() * 1.6 - 0.8,
      });
    }
  }
}

/**
 * Cicalino da gioco: due onde quadre scordate, filtrate e tremolate come un
 * buzzer da studio. Non una nota, un segnale: serve a chiudere il round.
 */
export function buzzer(ctx: AudioContext, destination: AudioNode, options: {
  at: number;
  duration: number;
  gain: number;
  freq?: number;
}): void {
  const freq = options.freq ?? 196;
  const out = ctx.createGain();
  out.connect(destination);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1900;
  filter.Q.value = 1.4;

  const tremolo = ctx.createGain();
  tremolo.gain.value = 0.55;
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 21;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.45;
  lfo.connect(lfoDepth).connect(tremolo.gain);

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, options.at);
  envelope.gain.linearRampToValueAtTime(options.gain, options.at + 0.012);
  envelope.gain.setValueAtTime(options.gain, options.at + options.duration * 0.82);
  envelope.gain.exponentialRampToValueAtTime(0.0001, options.at + options.duration);

  filter.connect(tremolo).connect(envelope).connect(out);
  for (const detune of [-7, 0, 6]) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(options.at);
    osc.stop(options.at + options.duration + 0.05);
  }
  lfo.start(options.at);
  lfo.stop(options.at + options.duration + 0.05);
}

/** Rullo di tamburi: colpi di spazzola fitti, con crescendo finale. */
export function drumroll(ctx: AudioContext, destination: AudioNode, options: {
  at: number;
  duration: number;
  gain: number;
  /** Da 0 a 1: quando il rullo deve arrivare al massimo. */
  peakAt?: number;
}): void {
  const random = seeded(11);
  const peakAt = Math.min(1, Math.max(0.2, options.peakAt ?? 0.85));
  let at = options.at;
  let index = 0;
  while (at < options.at + options.duration) {
    const progress = (at - options.at) / options.duration;
    const level = options.gain * (0.35 + progress * 0.9) * (progress > peakAt ? 1 - (progress - peakAt) * 0.7 : 1);
    // Testa della spazzola sul rullante.
    click(ctx, destination, {
      at,
      gain: level,
      freq: 2200 + random() * 900,
      q: 1.6,
      decay: 0.035,
      pan: random() * 0.5 - 0.25,
    });
    // Corpo grave del tamburo.
    modal(ctx, destination, {
      at,
      gain: level * 0.5,
      partials: [
        { freq: 185, decay: 0.09, q: 8, gain: 1 },
        { freq: 330, decay: 0.06, q: 10, gain: 0.4 },
      ],
      strike: { freq: 900, q: 0.9, duration: 0.05, gain: level * 0.6 },
    });
    index++;
    const interval = 0.028 + Math.pow(progress, 2.2) * 0.05 + (index % 4 === 0 ? 0.012 : 0);
    at += interval;
  }
}

/**
 * Coda di stanza: risposta all'impulso generata al volo (rumore che decade più
 * qualche riflessione iniziale). Dà a tutto il suono della TV un «dove».
 */
export function createRoom(
  ctx: AudioContext,
  destination: AudioNode,
  options: { seconds?: number; mix?: number; tone?: number } = {},
): GainNode {
  const seconds = options.seconds ?? 1.3;
  const frames = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, frames, ctx.sampleRate);
  const decay = 3.2;
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let smoothed = 0;
    for (let i = 0; i < frames; i++) {
      const t = i / frames;
      const white = Math.random() * 2 - 1;
      // Il rumore si scurisce con la coda: le alte spariscono per prime.
      smoothed = smoothed * (0.55 + t * 0.35) + white * (0.45 - t * 0.3);
      data[i] = smoothed * Math.pow(1 - t, decay);
    }
    // Riflessioni iniziali: pareti vicine, più discrete della coda.
    const early = [0.012, 0.019, 0.031, 0.047, 0.063];
    early.forEach((delay, index) => {
      const at = Math.floor(delay * ctx.sampleRate) + channel * 7;
      if (at < frames) data[at] += (index % 2 ? -1 : 1) * (0.5 - index * 0.08);
    });
  }

  const convolver = ctx.createConvolver();
  convolver.buffer = buffer;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = options.tone ?? 5200;
  const wet = ctx.createGain();
  wet.gain.value = options.mix ?? 0.16;
  convolver.connect(tone).connect(wet).connect(destination);

  const send = ctx.createGain();
  send.gain.value = 1;
  send.connect(convolver);
  return send;
}
