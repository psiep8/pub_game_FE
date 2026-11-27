/**
 * Riepilogo di fine round (N-11): modello puro.
 *
 * <p>Il round si racconta con i punti <em>fatti dentro il round</em>, non con il
 * totale in classifica: chi entra a metà o incassa un bonus fra due round non
 * deve falsare la pagina. L'ordine è dal peggiore al migliore, così l'ultima
 * pagina è il podio e la sala aspetta il nome che sale.</p>
 *
 * <p>Tabella dei giochi (N-11 punto 1). Il riepilogo non dipende dal tipo di
 * gioco ma da cosa è successo: serve quando almeno due squadre hanno mosso
 * punti. La durata è quella del round; la ripartenza è sempre la stessa.</p>
 *
 * | gioco            | riepilogo | durata            | riparte                          |
 * |------------------|-----------|-------------------|----------------------------------|
 * | Quiz             | sì        | 8 s + 3 s/pagina  | dopo il riepilogo, attesa 30 s   |
 * | Musica           | sì        | 8 s + 3 s/pagina  | dopo il riepilogo, attesa 30 s   |
 * | Indovina chi     | sì        | 8 s + 3 s/pagina  | dopo il riepilogo, attesa 30 s   |
 * | Ruota            | sì        | 8 s + 3 s/pagina  | dopo il riepilogo, attesa 30 s   |
 * | Azzardo          | sì        | 8 s + 3 s/pagina  | dopo il riepilogo, attesa 30 s   |
 * | Ultima spiaggia  | sì        | 8 s + 3 s/pagina  | dopo il riepilogo, attesa 30 s   |
 * | Timeline         | sì        | 8 s + 3 s/pagina  | dopo il riepilogo, attesa 30 s   |
 * | Arena            | sì        | 8 s + 3 s/pagina  | dopo il riepilogo, attesa 30 s   |
 * | Biglie           | sì        | 8 s + 3 s/pagina  | dopo il riepilogo, attesa 30 s   |
 * | Speed Rush       | sì        | 8 s + 3 s/pagina  | dopo il riepilogo, attesa 30 s   |
 * | Time Buzzer      | sì        | 8 s + 3 s/pagina  | dopo il riepilogo, attesa 30 s   |
 * | Tennis           | sì        | 8 s + 3 s/pagina  | dopo il riepilogo, attesa 30 s   |
 * | Bomba            | sì        | 8 s + 3 s/pagina  | dopo il riepilogo, attesa 30 s   |
 * | Blackjack        | sì        | 8 s + 3 s/pagina  | dopo il riepilogo, attesa 30 s   |
 *
 * <p>Fine atto: fra riepilogo e gioco dopo c'è la classifica dettagliata e la
 * pausa d'atto, che restano le uniche eccezioni alla ripartenza automatica.</p>
 */

import { TV_TIMING } from '../tv-timing';

/** Squadre in scena in un colpo solo: fino a dieci il tabellone sta in una pagina. */
export const RECAP_SINGLE_PAGE_MAX = 10;
/** Righe per pagina oltre le dieci squadre: sotto le otto, leggibili a 720p. */
export const RECAP_PAGE_SIZE = 7;
/** Una pagina resta ferma tre secondi, poi la dissolvenza (vedi `TV_TIMING`). */
export const RECAP_PAGE_MS = TV_TIMING.recapPageMs;
/** Sotto gli otto secondi il riepilogo non si legge. */
export const RECAP_MIN_MS = TV_TIMING.recapMinMs;

/** I giochi che possono aprire un riepilogo: tutti quelli della scaletta. */
export const RECAP_GAMES = [
  'QUIZ',
  'IMAGE_BLUR',
  'MUSIC',
  'WHEEL_OF_FORTUNE',
  'AZZARDO',
  'ULTIMA_SPIAGGIA',
  'TIMELINE',
  'ARENA',
  'BIGLIE',
  'SPEED_RUSH',
  'TIME_BUZZER',
  'TENNIS_BATTLE',
  'BOMBA',
  'BLACKJACK',
] as const;

export interface RecapRow {
  playerName: string;
  /** Punti guadagnati (o persi) nel round appena chiuso. */
  delta: number;
  /** Totale in classifica dopo il round. */
  total: number;
  /** Posizione in classifica (1 = prima), pari merito sulla stessa posizione. */
  position: number;
}

export interface RecapEntry {
  playerName: string;
  totalPoints: number;
}

/**
 * Righe del riepilogo dal peggiore al migliore.
 *
 * <p>`startTotals` è la fotografia dei totali all'apertura del round: il delta
 * è la differenza con i totali di adesso. Chi non era in tabella parte da zero.</p>
 */
export function recapRows(
  entries: ReadonlyArray<RecapEntry>,
  startTotals: ReadonlyMap<string, number>,
): RecapRow[] {
  const rows: RecapRow[] = [];

  for (const entry of entries ?? []) {
    const playerName = String(entry?.playerName ?? '').trim();
    if (!playerName) continue;
    const total = Number(entry?.totalPoints) || 0;
    const start = Number(startTotals?.get(playerName)) || 0;
    rows.push({ playerName, total, delta: total - start, position: 0 });
  }

  // Posizione: pari merito sullo stesso totale, il posto dopo salta.
  const ranked = [...rows].sort((a, b) => b.total - a.total || a.playerName.localeCompare(b.playerName));
  let position = 0;
  let previousTotal: number | null = null;
  ranked.forEach((row, index) => {
    if (previousTotal === null || row.total !== previousTotal) {
      position = index + 1;
      previousTotal = row.total;
    }
    row.position = position;
  });

  return rows.sort(
    (a, b) => a.delta - b.delta || a.total - b.total || a.playerName.localeCompare(b.playerName),
  );
}

/** Pagine del tabellone: una sola fino a dieci squadre, poi righe da sette. */
export function recapPages(
  rows: ReadonlyArray<RecapRow>,
  pageSize = RECAP_PAGE_SIZE,
): RecapRow[][] {
  const clean = (rows ?? []).filter((row) => String(row?.playerName ?? '').trim());
  if (!clean.length) return [];
  if (clean.length <= RECAP_SINGLE_PAGE_MAX) return [clean];

  const size = Math.max(1, Math.trunc(pageSize));
  const pages: RecapRow[][] = [];
  for (let index = 0; index < clean.length; index += size) {
    pages.push(clean.slice(index, index + size));
  }
  return pages;
}

/** Durata del riepilogo: almeno otto secondi, tre per ogni pagina in più. */
export function recapDurationMs(rows: ReadonlyArray<RecapRow>): number {
  const pages = recapPages(rows);
  return pages.length ? Math.max(RECAP_MIN_MS, pages.length * RECAP_PAGE_MS) : 0;
}

/**
 * Il riepilogo serve solo se c'è qualcosa da raccontare: un gioco della
 * scaletta, almeno due squadre e almeno una variazione di punti.
 */
export function shouldRecap(type: string, rows: ReadonlyArray<RecapRow>): boolean {
  if (!(RECAP_GAMES as readonly string[]).includes(type)) return false;
  if ((rows?.length ?? 0) < 2) return false;
  return rows.some((row) => Number(row.delta) !== 0);
}