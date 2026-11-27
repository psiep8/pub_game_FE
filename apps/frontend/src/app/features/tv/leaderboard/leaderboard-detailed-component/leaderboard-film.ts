/**
 * Statistiche della classifica «da film», calcolate dallo storico server dei
 * round. La TV riceve una riga per squadra e round; qui le storie diventano
 * leggibili senza inventare numeri lato client.
 */

export interface RoundScoreEntry {
  playerName: string;
  points: number;
  totalPoints: number;
}

export interface RoundScoreRound {
  roundIndex: number;
  type?: string | null;
  savedAt?: number;
  entries?: RoundScoreEntry[];
}

export interface RoundScoreHistory {
  gameId?: number;
  rounds?: RoundScoreRound[];
}

export interface FilmRoundMoment {
  roundIndex: number;
  type: string;
  points: number;
}

export interface FilmGameMoment {
  type: string;
  points: number;
  rounds: number;
}

export interface FilmStory {
  best: FilmRoundMoment;
  worst: FilmRoundMoment;
  strongestGame: FilmGameMoment;
  weakestGame: FilmGameMoment;
  /** Posizioni guadagnate dal punto più basso della serata alla fine. */
  comeback: number;
}

interface Performance {
  roundIndex: number;
  type: string;
  points: number;
  totalPoints: number;
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Tipo del gioco normalizzato: lo storico può arrivare con `type` assente. */
function gameType(value: unknown): string {
  const type = String(value ?? '').trim().toUpperCase();
  return type || 'ROUND';
}

/** Una storia per squadra; chi non ha righe nello storico resta fuori. */
export function buildFilmStories(rounds: RoundScoreRound[] | null | undefined): Map<string, FilmStory> {
  const ordered = [...(rounds ?? [])]
    .filter((round) => round && Array.isArray(round.entries) && round.entries.length > 0)
    .sort((a, b) => asNumber(a.roundIndex) - asNumber(b.roundIndex));

  const performances = new Map<string, Performance[]>();
  const positions = new Map<string, Map<number, number>>();

  for (const round of ordered) {
    const roundIndex = asNumber(round.roundIndex);
    const type = gameType(round.type);
    const entries = (round.entries ?? [])
      .map((entry) => ({
        playerName: String(entry?.playerName ?? '').trim(),
        points: asNumber(entry?.points),
        totalPoints: asNumber(entry?.totalPoints),
      }))
      .filter((entry) => entry.playerName.length > 0);

    const ranked = [...entries].sort((a, b) =>
      b.totalPoints - a.totalPoints || a.playerName.localeCompare(b.playerName));

    ranked.forEach((entry, index) => {
      const player = performances.get(entry.playerName) ?? [];
      player.push({
        roundIndex,
        type,
        points: entry.points,
        totalPoints: entry.totalPoints,
      });
      performances.set(entry.playerName, player);

      const playerPositions = positions.get(entry.playerName) ?? new Map<number, number>();
      playerPositions.set(roundIndex, index + 1);
      positions.set(entry.playerName, playerPositions);
    });
  }

  const stories = new Map<string, FilmStory>();
  for (const [playerName, player] of performances) {
    if (player.length === 0) continue;

    let best = player[0];
    let worst = player[0];
    const games = new Map<string, { points: number; rounds: number }>();

    for (const performance of player) {
      if (performance.points > best.points) best = performance;
      if (performance.points < worst.points) worst = performance;
      const game = games.get(performance.type) ?? { points: 0, rounds: 0 };
      game.points += performance.points;
      game.rounds += 1;
      games.set(performance.type, game);
    }

    let strongest = { type: '', points: Number.NEGATIVE_INFINITY, rounds: 0 };
    let weakest = { type: '', points: Number.POSITIVE_INFINITY, rounds: 0 };
    for (const [type, game] of games) {
      if (game.points > strongest.points) strongest = { type, ...game };
      if (game.points < weakest.points) weakest = { type, ...game };
    }

    const playerPositions = positions.get(playerName) ?? new Map<number, number>();
    const finalRank = playerPositions.get(player[player.length - 1].roundIndex) ?? 0;
    const worstRank = Math.max(...playerPositions.values());

    stories.set(playerName, {
      best: { roundIndex: best.roundIndex, type: best.type, points: best.points },
      worst: { roundIndex: worst.roundIndex, type: worst.type, points: worst.points },
      strongestGame: strongest,
      weakestGame: weakest,
      comeback: Math.max(0, worstRank - finalRank),
    });
  }

  return stories;
}

/** `+120` / `-40`: il segno serve a leggere subito una rimonta o una perdita. */
export function signedPoints(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** Etichetta compatta per un round dello storico. */
export function roundMomentLabel(moment: FilmRoundMoment | null | undefined): string {
  if (!moment) return '—';
  return `R${moment.roundIndex + 1} · ${moment.type} · ${signedPoints(moment.points)}`;
}

/** Etichetta compatta per un gioco aggregato. */
export function gameMomentLabel(moment: FilmGameMoment | null | undefined): string {
  if (!moment) return '—';
  return `${moment.type} · ${signedPoints(moment.points)}`;
}
