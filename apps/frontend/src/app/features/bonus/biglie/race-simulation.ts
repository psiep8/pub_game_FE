/**
 * Simulazione headless della corsa delle Biglie.
 *
 * Riproduce la stessa matematica della TV — pista da `track-geometry`, ostacoli
 * da `hazard-plan`, passo, ripresa e rimonta da `race-dynamics` — senza tela né
 * Matter. Serve a rispondere a due domande con numeri, non a occhio: quanto
 * dura una gara su ogni fondo, e quante volte le biglie si toccano.
 *
 * Le due cose che la simulazione non può dire: il rimbalzo vero di Matter (qui
 * le sovrapposizioni si separano a mano) e il suono. Tutto il resto è lo stesso
 * codice della TV.
 */

import { buildHazards } from './hazard-plan';
import { MARBLES } from './marbles';
import {
  createDrama,
  createLineCharacter,
  CLOSING_FROM,
  CLOSING_BOOST,
  dramaFactor,
  fieldProfile,
  HEAD_WIND,
  hazardPenalty,
  lineOffset,
  marbleRadiusFor,
  paceFor,
  resumeAccel,
  rubberBand,
  stepSpeed,
  trackWidthFor,
  wallPenalty,
  type DramaProfile,
  type LineCharacter,
} from './race-dynamics';
import { buildTrack, frameAtProgress, pointAtS, type TrackGeometry } from './track-geometry';
import { trackById, type TrackId } from './track-plan';

const STEP = 1 / 60;
const TRACK_WORLD_LENGTH = 12000;
const TRACK_START_X = 140;
/** Il muro sta 6 px fuori dal bordo disegnato, come `wallSegments(-6)`. */
const WALL_INSET = 6;

export interface SimMarbleResult {
  name: string;
  finish: number | null;
  hits: number;
  wallHits: number;
  contacts: number;
}

export interface SimResult {
  trackId: string;
  surface: string;
  width: number;
  radius: number;
  leaderTime: number;
  lastTime: number;
  marbles: SimMarbleResult[];
  /** Quota di tempo-biglia passata a contatto con un'altra biglia. */
  contactShare: number;
  /** Contatti al secondo, contati una volta per coppia e per incontro. */
  contactsPerSecond: number;
  hazardHits: number;
  wallHits: number;
  /** Cambi di prima posizione (il primo giro non conta). */
  leadChanges: number;
  /** Sorpassi veri: coppie che hanno invertito l ordine fra due campioni. */
  overtakes: number;
  /** Rimonta: chi era nella metà bassa a metà gara è finito sul podio. */
  comeback: boolean;
}

export interface SimOptions {
  trackId: TrackId;
  seed: number;
  count?: number;
  maxSeconds?: number;
}

interface SimMarble {
  name: string;
  speed: number;
  accel: number;
  grip: number;
  s: number;
  lateral: number;
  lateralSpeed: number;
  speedNow: number;
  line: LineCharacter;
  drama: DramaProfile;
  bumped: Set<string>;
  slowUntil: number;
  boostUntil: number;
  stunUntil: number;
  recoverUntil: number;
  bestS: number;
  stuckFor: number;
  finish: number | null;
  hits: number;
  wallHits: number;
  contacts: number;
  touching: Set<number>;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Una gara intera, dallo start al traguardo dell'ultima biglia. */
export function simulateRace(options: SimOptions): SimResult {
  const track = trackById(options.trackId);
  const count = Math.max(1, Math.min(MARBLES.length, options.count ?? 8));
  const rng = seededRandom(options.seed);
  const width = trackWidthFor(count);
  const radius = marbleRadiusFor(count, width);
  // Stessa pista della TV: il profilo del fondo viene dal catalogo.
  const geometry: TrackGeometry = buildTrack(options.seed, {
    width,
    length: TRACK_WORLD_LENGTH,
    startX: TRACK_START_X,
    profile: track.geometry,
  });
  const hazards = buildHazards(track.id, options.seed);
  const physics = track.physics;

  const marbles: SimMarble[] = MARBLES.slice(0, count).map((data, index) => {
    const cols = Math.min(4, count);
    const laneStep = cols <= 1 ? 0 : (width - radius * 2 - 14) / (cols - 1);
    const col = index % cols;
    const row = Math.floor(index / cols);
    const lateral = -width / 2 + radius + 8 + col * laneStep + (rng() - 0.5) * radius * 0.5;
    const along = 30 + row * (radius * 2 + 14) + (rng() - 0.5) * 12;
    return {
      name: data.name,
      speed: data.speed,
      accel: data.accel,
      grip: data.grip,
      s: along,
      lateral,
      lateralSpeed: 0,
      speedNow: 0,
      line: createLineCharacter(rng, index, count),
      drama: createDrama(rng),
      bumped: new Set<string>(),
      slowUntil: 0,
      boostUntil: 0,
      stunUntil: 0,
      recoverUntil: 0,
      bestS: 0,
      stuckFor: 0,
      finish: null,
      hits: 0,
      wallHits: 0,
      contacts: 0,
      touching: new Set<number>(),
    };
  });

  const profileMean =
    marbles.reduce(
      (sum, marble) =>
        sum
        + (marble.speed * track.weights.speed
          + marble.accel * track.weights.accel
          + marble.grip * track.weights.grip) / 10,
      0,
    ) / marbles.length;
  const finishS = geometry.totalLength - radius;
  let elapsed = 0;
  let touchPairSteps = 0;
  let contactRuns = 0;
  // Campioni di classifica ogni mezzo secondo: da qui escono cambi di prima
  // posizione, sorpassi e rimonte. È il termometro del drama.
  let sampleAcc = 0;
  let leadChanges = 0;
  let overtakes = 0;
  let lastLeader: number | null = null;
  let previousRanks: Map<number, number> | null = null;
  let halfRanks: Map<number, number> | null = null;

  const maxSeconds = options.maxSeconds ?? 120;
  while (elapsed < maxSeconds && marbles.some((marble) => marble.finish === null)) {
    elapsed += STEP;
    const running = marbles.filter((marble) => marble.finish === null);
    const leadS = running.reduce((lead, marble) => Math.max(lead, marble.s), 0);
    const fieldProgress = running.length
      ? running.reduce((sum, marble) => sum + Math.min(1, marble.s / geometry.totalLength), 0) /
        running.length
      : 0;

    // Posizioni del passo precedente, per capire chi si tocca.
    const before = marbles.map((marble) => ({ x: 0, y: 0 }));
    marbles.forEach((marble, index) => {
      const frame = pointAtS(geometry, marble.s);
      before[index] = {
        x: frame.x + frame.nx * marble.lateral,
        y: frame.y + frame.ny * marble.lateral,
      };
    });

    for (const marble of marbles) {
      if (marble.finish !== null) continue;

      const frame = pointAtS(geometry, marble.s);
      const profile = fieldProfile(
        (marble.speed * track.weights.speed
          + marble.accel * track.weights.accel
          + marble.grip * track.weights.grip) / 10,
        profileMean,
      );

      let target = paceFor(profile, physics.friction);
      if (marble.slowUntil > elapsed) target *= 0.45;
      if (marble.boostUntil > elapsed) target *= 1.12;
      const progress = Math.min(1, marble.s / geometry.totalLength);
      target *= rubberBand(progress, fieldProgress, progress > CLOSING_FROM ? CLOSING_BOOST : 1);
      target *= dramaFactor(marble.drama, elapsed);
      if (marble.s >= leadS) target *= HEAD_WIND;

      const stunned = marble.stunUntil > elapsed;
      const recovering = marble.recoverUntil > elapsed;
      marble.speedNow = stepSpeed(
        marble.speedNow,
        stunned ? target * 0.12 : target,
        resumeAccel(marble.accel, recovering),
        STEP,
      );
      marble.s += marble.speedNow;

      // Corsia personale, come in TV.
      const halfLane = Math.max(6, frame.width / 2 - radius - 6);
      const want = lineOffset(marble.line, elapsed, halfLane * 0.9);
      const steer = Math.max(-1.1, Math.min(1.1, (want - marble.lateral) * 0.07));
      const pull = physics.gravity * 0.012;
      const gripDamping = 1 - Math.min(0.6, physics.grip * 0.07);
      const bump = (rng() - 0.5) * physics.bumps * 0.32;
      const shove = rng() < 0.003 ? (rng() - 0.5) * 5 : 0;
      marble.lateralSpeed = Math.max(
        -4,
        Math.min(4, (marble.lateralSpeed * 0.86 + steer + pull + bump + shove) * gripDamping),
      );
      marble.lateral += marble.lateralSpeed;

      // Muro: la biglia non esce dalla corsia, e il colpo costa.
      const wallLimit = frame.width / 2 + WALL_INSET - radius;
      if (Math.abs(marble.lateral) > wallLimit) {
        marble.lateral = Math.sign(marble.lateral) * wallLimit;
        const hard = marble.speedNow > 1.6;
        const wall = wallPenalty(hard);
        marble.speedNow *= wall.factor;
        marble.stunUntil = Math.max(marble.stunUntil, elapsed + wall.stun);
        marble.recoverUntil = Math.max(marble.recoverUntil, elapsed + wall.recover);
        marble.lateralSpeed *= -0.5;
        marble.wallHits += 1;
      }

      // Ostacoli: cerchi sul fondo, una volta sola per biglia.
      const marbleX = frame.x + frame.nx * marble.lateral;
      const marbleY = frame.y + frame.ny * marble.lateral;
      for (const hazard of hazards) {
        if (marble.bumped.has(hazard.id)) continue;
        if (Math.abs(hazard.progress - marble.s / geometry.totalLength) > 0.02) continue;
        const spot = frameAtProgress(geometry, hazard.progress);
        const hx = spot.x + spot.nx * hazard.offset * width * 0.3;
        const hy = spot.y + spot.ny * hazard.offset * width * 0.3;
        if (Math.hypot(hx - marbleX, hy - marbleY) > radius + hazard.radius) continue;

        marble.bumped.add(hazard.id);
        marble.hits += 1;
        const penalty = hazardPenalty(hazard.kind);
        marble.speedNow *= penalty.factor;
        marble.stunUntil = Math.max(marble.stunUntil, elapsed + penalty.stun);
        marble.recoverUntil = Math.max(marble.recoverUntil, elapsed + penalty.recover);
        if (hazard.kind === 'fango' || hazard.kind === 'sabbia' || hazard.kind === 'pozzanghera') {
          marble.slowUntil = elapsed + (hazard.kind === 'fango' ? 0.9 : 0.6);
        }
        if (hazard.kind === 'ghiaccio') marble.boostUntil = elapsed + 0.9;
      }

      // Watchdog: se resta ferma, riparte più avanti (come in TV).
      if (marble.s > marble.bestS + 4) {
        marble.bestS = marble.s;
        marble.stuckFor = 0;
      } else {
        marble.stuckFor += STEP;
      }
      if (marble.stuckFor > 2) {
        marble.s = Math.min(finishS, marble.s + 70);
        marble.speedNow = 2;
        marble.stuckFor = 0;
        marble.bestS = marble.s;
      }

      if (marble.s >= finishS) {
        marble.s = finishS;
        marble.finish = elapsed;
      }
    }

    // Contatti: Matter li risolve con un rimbalzo, qui si separano a mano per
    // contare gli incontri senza far collassare il gruppo in un blocco unico.
    const positions = marbles.map((marble) => {
      const frame = pointAtS(geometry, marble.s);
      return {
        x: frame.x + frame.nx * marble.lateral,
        y: frame.y + frame.ny * marble.lateral,
      };
    });
    let touchingNow = 0;
    for (let a = 0; a < marbles.length; a++) {
      for (let b = a + 1; b < marbles.length; b++) {
        const first = marbles[a];
        const second = marbles[b];
        if (first.finish !== null || second.finish !== null) continue;
        const dx = positions[b].x - positions[a].x;
        const dy = positions[b].y - positions[a].y;
        const distance = Math.hypot(dx, dy);
        const wasTouching = Math.hypot(before[b].x - before[a].x, before[b].y - before[a].y) < radius * 2;
        if (distance >= radius * 2) {
          if (wasTouching) {
            first.touching.delete(b);
            second.touching.delete(a);
          }
          continue;
        }

        touchingNow += 1;
        if (!wasTouching) {
          contactRuns += 1;
          first.contacts += 1;
          second.contacts += 1;
        }
        first.touching.add(b);
        second.touching.add(a);

        // Separazione morbida: metà scarto per parte.
        const overlap = (radius * 2 - distance) / 2;
        const nx = distance > 0.001 ? dx / distance : 1;
        const ny = distance > 0.001 ? dy / distance : 0;
        const frameA = pointAtS(geometry, first.s);
        const frameB = pointAtS(geometry, second.s);
        first.lateral -= (nx * frameA.nx + ny * frameA.ny) * overlap;
        second.lateral += (nx * frameB.nx + ny * frameB.ny) * overlap;
        // Rimbalzo: come Matter, le due biglie si allontanano e non restano
        // incollate per tutta la curva.
        first.lateralSpeed -= 0.35;
        second.lateralSpeed += 0.35;
      }
    }
    touchPairSteps += touchingNow;
    if (elapsed % 1 < STEP) {
      marbles.forEach((marble) => marble.touching.clear());
    }

    // Classifica: chi ha già tagliato tiene la sua posizione d'arrivo, gli
    // altri ordinati per strada percorsa.
    sampleAcc += STEP;
    if (sampleAcc >= 0.5) {
      sampleAcc = 0;
      const ranks = new Map<number, number>();
      marbles
        .map((marble, index) => ({ index, marble }))
        .sort((a, b) => {
          const first = a.marble.finish;
          const second = b.marble.finish;
          if (first !== null && second !== null) return first - second;
          if (first !== null) return -1;
          if (second !== null) return 1;
          return b.marble.s - a.marble.s;
        })
        .forEach((entry, rank) => ranks.set(entry.index, rank));

      const leader = [...ranks.entries()].find(([, rank]) => rank === 0)?.[0] ?? null;
      if (lastLeader !== null && leader !== null && leader !== lastLeader) leadChanges += 1;
      lastLeader = leader;

      if (previousRanks) {
        for (let a = 0; a < count; a++) {
          for (let b = a + 1; b < count; b++) {
            const was = (previousRanks.get(a) ?? 0) - (previousRanks.get(b) ?? 0);
            const now = (ranks.get(a) ?? 0) - (ranks.get(b) ?? 0);
            if (was !== 0 && now !== 0 && was > 0 !== now > 0) overtakes += 1;
          }
        }
      }
      previousRanks = ranks;
      if (!halfRanks && marbles.some((marble) => marble.s >= finishS * 0.3)) {
        halfRanks = new Map(ranks);
      }
    }
  }

  const finishes = marbles.map((marble) => marble.finish ?? elapsed);
  const leaderTime = Math.min(...finishes);
  const lastTime = Math.max(...finishes);

  // Rimonta: chi a metà percorso era nella metà bassa della classifica, poi
  // finisce sul podio. È quello che deve poter succedere all'ultimo.
  let comeback = false;
  if (halfRanks && previousRanks) {
    for (const [index, rank] of halfRanks) {
      if (rank >= Math.ceil(count / 2) && (previousRanks.get(index) ?? count) <= 2) comeback = true;
    }
  }

  return {
    trackId: track.id,
    surface: track.surface,
    width,
    radius,
    leaderTime,
    lastTime,
    marbles: marbles.map((marble) => ({
      name: marble.name,
      finish: marble.finish,
      hits: marble.hits,
      wallHits: marble.wallHits,
      contacts: marble.contacts,
    })),
    contactShare: elapsed > 0 ? (touchPairSteps * 2) / ((elapsed / STEP) * count) : 0,
    contactsPerSecond: elapsed > 0 ? contactRuns / elapsed : 0,
    hazardHits: marbles.reduce((sum, marble) => sum + marble.hits, 0),
    wallHits: marbles.reduce((sum, marble) => sum + marble.wallHits, 0),
    leadChanges,
    overtakes,
    comeback,
  };
}
