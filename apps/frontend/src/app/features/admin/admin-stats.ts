import type {
  RoundScoreHistory,
  RoundScoreRound,
} from '../tv/leaderboard/leaderboard-detailed-component/leaderboard-film';

/**
 * Statistiche per la regia, lette dallo storico server dei round.
 *
 * <p>La TV ha già le storie «da film» per ogni squadra; qui servono i numeri
 * che il presentatore può leggere ad alta voce durante la serata: il round più
 * ricco, la mano migliore, la rimonta più grande e chi è stato più costante.
 * Nessun dato inventato: se lo storico è vuoto, la pagina lo dice.</p>
 */

export interface AdminStats {
  rounds: number;
  teams: number;
  totalPoints: number;
  averageRound: number;
  curiosities: string[];
}

interface TeamHistory {
  points: number[];
  firstTotal: number;
  lastTotal: number;
  lowestTotal: number;
}

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundLabel(index: number): string {
  return `round ${index + 1}`;
}

/**
 * Costruisce i numeri della regia. I round senza righe (per esempio un round
 * aperto e mai chiuso) non entrano nelle medie.
 */
export function buildAdminStats(history: RoundScoreHistory | null | undefined): AdminStats {
  const rounds = [...(history?.rounds ?? [])]
    .filter((round): round is RoundScoreRound =>
      Boolean(round) && Array.isArray(round.entries) && round.entries!.length > 0)
    .sort((a, b) => asNumber(a.roundIndex) - asNumber(b.roundIndex));

  if (rounds.length === 0) {
    return { rounds: 0, teams: 0, totalPoints: 0, averageRound: 0, curiosities: [] };
  }

  const teams = new Map<string, TeamHistory>();
  let totalPoints = 0;
  let richest = { roundIndex: rounds[0].roundIndex, points: -Infinity };
  let bestHand = { playerName: '', points: -Infinity, roundIndex: rounds[0].roundIndex };

  for (const round of rounds) {
    let roundPoints = 0;

    for (const entry of round.entries ?? []) {
      const playerName = String(entry?.playerName ?? '').trim();
      if (!playerName) continue;
      const points = asNumber(entry.points);
      const total = asNumber(entry.totalPoints);
      roundPoints += points;

      const team = teams.get(playerName) ?? {
        points: [],
        firstTotal: total,
        lastTotal: total,
        lowestTotal: total,
      };
      team.points.push(points);
      team.lastTotal = total;
      team.lowestTotal = Math.min(team.lowestTotal, total);
      teams.set(playerName, team);

      if (points > bestHand.points) {
        bestHand = { playerName, points, roundIndex: round.roundIndex };
      }
    }

    totalPoints += roundPoints;
    if (roundPoints > richest.points) {
      richest = { roundIndex: round.roundIndex, points: roundPoints };
    }
  }

  const curiosities: string[] = [];
  if (Number.isFinite(richest.points)) {
    curiosities.push(
      `Round più ricco: ${roundLabel(richest.roundIndex)} con ${richest.points} punti.`,
    );
  }
  if (bestHand.playerName && Number.isFinite(bestHand.points)) {
    curiosities.push(
      `Miglior mano: ${bestHand.playerName} (+${bestHand.points}) al ${roundLabel(bestHand.roundIndex)}.`,
    );
  }

  let comeback: { playerName: string; delta: number } | null = null;
  let consistent: { playerName: string; spread: number } | null = null;

  for (const [playerName, team] of teams) {
    const delta = team.lastTotal - team.lowestTotal;
    if (!comeback || delta > comeback.delta) comeback = { playerName, delta };

    if (team.points.length >= 2) {
      const spread = Math.max(...team.points) - Math.min(...team.points);
      if (!consistent || spread < consistent.spread) consistent = { playerName, spread };
    }
  }

  if (comeback && comeback.delta > 0) {
    curiosities.push(
      `Rimonta più grande: ${comeback.playerName} (+${comeback.delta} punti dal minimo).`,
    );
  }
  if (consistent) {
    curiosities.push(
      `Squadra più costante: ${consistent.playerName} (scarto ${consistent.spread} punti fra round).`,
    );
  }

  return {
    rounds: rounds.length,
    teams: teams.size,
    totalPoints,
    averageRound: Math.round((totalPoints / rounds.length) * 10) / 10,
    curiosities,
  };
}
