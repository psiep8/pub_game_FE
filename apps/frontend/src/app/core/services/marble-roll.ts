/**
 * Rotolamento delle Biglie: il fondo decide come suona il sottofondo.
 *
 * Il file (`loop/biglie.m4a`) è un rotolamento di biglie su un piano duro —
 * ticchi cristallini sopra un corpo che scorre — e ogni pista lo riascolta a
 * modo suo: la sabbia rallenta il nastro e chiude le alte, l'asfalto lo fa
 * correre e lo apre, il vetro resta brillante, la neve smorza tutto.
 *
 * Stessa registrazione, superficie diversa: nessun file in più da tenere.
 */
export interface MarbleRollStyle {
  /** Velocità del nastro (1 = il file com'è). */
  rate: number;
  /** Taglio delle alte frequenze, in Hz. */
  lowpass: number;
  /** Volume del sottofondo, 0–1. */
  level: number;
}

const DEFAULT_STYLE: MarbleRollStyle = { rate: 1, lowpass: 7200, level: 0.7 };

const STYLES: Record<string, MarbleRollStyle> = {
  rally: { rate: 0.94, lowpass: 4800, level: 0.72 },
  f1: { rate: 1.08, lowpass: 9200, level: 0.74 },
  neve: { rate: 0.86, lowpass: 3200, level: 0.68 },
  acqua: { rate: 0.9, lowpass: 3800, level: 0.66 },
  vetro: { rate: 1.06, lowpass: 11000, level: 0.72 },
  sabbia: { rate: 0.8, lowpass: 2600, level: 0.66 },
  spazio: { rate: 0.88, lowpass: 5200, level: 0.6 },
  magma: { rate: 1.02, lowpass: 6400, level: 0.7 },
};

/** Stile del rotolamento per la pista in corso (id della pista). */
export function marbleRollStyle(trackId: string | null | undefined): MarbleRollStyle {
  const key = String(trackId ?? '').trim().toLowerCase();
  return STYLES[key] ?? DEFAULT_STYLE;
}
