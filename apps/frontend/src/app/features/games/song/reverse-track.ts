/**
 * Il brano al contrario della seconda manche.
 *
 * <p>La preview arriva da un CDN con CORS (la TV la usa già come sorgente
 * `MediaElementAudioSource`): si scarica una volta, si decodifica e si rovescia
 * canale per canale. `REVERSE_RATE` la fa girare un filo più lenta, così al
 * contrario e scivolata la canzone resta un brivido e non un puzzle.</p>
 */
export const REVERSE_RATE = 0.94;

export interface ReversibleBuffer {
  readonly numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
}

/** Rovescia ogni canale in place e restituisce lo stesso buffer. */
export function reverseChannels<T extends ReversibleBuffer>(buffer: T): T {
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    buffer.getChannelData(channel).reverse();
  }
  return buffer;
}
