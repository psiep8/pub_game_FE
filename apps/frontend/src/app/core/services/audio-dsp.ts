/**
 * Coda di stanza: risposta all'impulso generata al volo (rumore che decade più
 * qualche riflessione iniziale). Dà a tutto il suono della TV un «dove».
 *
 * <p>È l'unico pezzo di sintesi rimasto: gli eventi e i sottofondi suonano file
 * registrati. Senza questo i file sarebbero tutti secchi, appoggiati al centro
 * dello schermo.</p>
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
