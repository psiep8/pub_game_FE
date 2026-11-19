/**
 * Ripresa e carattere delle biglie.
 *
 * La corsa è quella di sempre: velocità di punta dal profilo, ostacoli sulla
 * pista, 70 secondi di gara. Questo file decide tre cose sole:
 * 1. **come si riparte** dopo un fosso, un muro o uno scontro — con l'inerzia
 *    del profilo, non con un valore riscritto a ogni passo;
 * 2. **che strada tiene** ogni biglia — una corsia sua, che cambia piano nel
 *    tempo, invece della linea comune a tutte;
 * 3. **quanto il gruppo resta compatto** — chi è davanti paga la fuga, chi è
 *    dietro tiene qualche punto in più, così la gara non si decide al primo
 *    chilometro.
 *
 * Le velocità sono in px per passo di fisica, come le usa Matter; le
 * accelerazioni in px/passo al secondo.
 */

/** Quanto costa un colpo: velocità che resta, blocco e ripresa frenata. */
export interface HazardPenalty {
  /** Frazione di velocità che resta dopo l'urto. */
  factor: number;
  /** Secondi in cui la biglia striscia senza ripartire. */
  stun: number;
  /** Secondi in cui la ripresa è a metà gas. */
  recover: number;
}

/** Corsia personale della biglia: preferenza di lato e vagabondaggio. */
export interface LineCharacter {
  /** Lato preferito, −1 il muro basso, +1 quello alto. */
  bias: number;
  /** Fase e velocità del vagabondaggio: ognuna parte da un punto diverso. */
  phase: number;
  rate: number;
}

/**
 * Penalità per ostacolo. Fango, sabbia e paracarro sono i più cattivi: la
 * biglia quasi si ferma e ci mette secondi a ritrovare la velocità. Il
 * ghiaccio è l'unico che non toglie nulla.
 */
const PENALTIES: Record<string, HazardPenalty> = {
  fango: { factor: 0.22, stun: 0.35, recover: 0.7 },
  sabbia: { factor: 0.24, stun: 0.3, recover: 0.65 },
  pozzanghera: { factor: 0.34, stun: 0.25, recover: 0.65 },
  cumulo: { factor: 0.28, stun: 0.3, recover: 0.7 },
  paracarro: { factor: 0.24, stun: 0.35, recover: 0.7 },
  sasso: { factor: 0.42, stun: 0.2, recover: 0.55 },
  scoglio: { factor: 0.38, stun: 0.22, recover: 0.6 },
  meteorite: { factor: 0.36, stun: 0.22, recover: 0.6 },
  cordolo: { factor: 0.52, stun: 0.15, recover: 0.45 },
  onda: { factor: 0.4, stun: 0.2, recover: 0.6 },
  boa: { factor: 0.44, stun: 0.2, recover: 0.6 },
  magma: { factor: 0.3, stun: 0.3, recover: 0.7 },
  ghiaccio: { factor: 1, stun: 0, recover: 0 },
};

/** Penalità di un ostacolo, con un valore prudente per i tipi futuri. */
export function hazardPenalty(kind: string): HazardPenalty {
  return PENALTIES[kind] ?? { factor: 0.4, stun: 0.3, recover: 1.3 };
}

/**
 * Il muro costa come un ostacolo: chi sbaglia la traiettoria perde velocità,
 * resta appoggiato un attimo e riparte a metà gas. L'urto secco (frontale,
 * contro uno spigolo) pesa il doppio della strisciata.
 */
export function wallPenalty(hard: boolean): HazardPenalty {
  return hard
    ? { factor: 0.6, stun: 0.12, recover: 0.35 }
    : { factor: 0.82, stun: 0.05, recover: 0.25 };
}

/**
 * Accelerazione della ripresa, in px/passo al secondo. Il profilo della
 * biglia conta: chi ha più scatto (PIUMA, SCHEGGIA) rimette su la velocità
 * prima, il TANK ci mette il doppio. A metà gas dopo un ostacolo.
 */
export function resumeAccel(accel: number, recovering: boolean): number {
  const base = 1.4 + Math.max(0, accel) * 0.1;
  return recovering ? base * 0.45 : base;
}

/**
 * Un passo di velocità: si va verso il bersaglio al massimo di `accel` al
 * secondo. A regime il valore è esattamente il bersaglio; dopo un colpo la
 * differenza è tutta da recuperare.
 */
export function stepSpeed(
  current: number,
  target: number,
  accel: number,
  dtSeconds: number,
): number {
  const maxDelta = Math.max(0.001, Math.abs(accel) * dtSeconds);
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

/**
 * Corsia personale. Il lato non è del tutto casuale: le biglie si spartiscono
 * la corsia in `slots` fette e ognuna tiene la sua, con un po di jitter. Il
 * seme decide il resto (fase e ritmo del vagabondaggio), così i percorsi sono
 * diversi ma non finiscono tutti addosso allo stesso punto.
 */
export function createLineCharacter(rng: () => number, slot = 0, slots = 1): LineCharacter {
  const spread = slots > 1 ? (slot / (slots - 1)) * 2 - 1 : rng() * 2 - 1;
  return {
    bias: Math.max(-1, Math.min(1, spread + (rng() - 0.5) * 0.22)),
    phase: rng() * Math.PI * 2,
    rate: 0.28 + rng() * 0.5,
  };
}

/**
 * Dove vuole passare la biglia, in px dal centro della corsia. Due sinusoidi
 * di periodo diverso più la preferenza di lato: il percorso è suo, non
 * quello del vicino, e si sposta piano mentre la gara va avanti.
 */
export function lineOffset(line: LineCharacter, elapsed: number, halfLane: number): number {
  const wander =
    Math.sin(line.phase + elapsed * line.rate) * 0.6
    + Math.sin(line.phase * 1.9 + elapsed * line.rate * 2.4) * 0.28;
  const value = (wander * 0.55 + line.bias * 0.6) * halfLane;
  return Math.max(-halfLane, Math.min(halfLane, value));
}

/** Momenti della biglia: la spinta che la fa volare, la crisi che la spegne. */
export interface DramaProfile {
  surgeEvery: number;
  surgeLength: number;
  surgeOffset: number;
  surgePower: number;
  crisisEvery: number;
  crisisLength: number;
  crisisOffset: number;
  crisisPower: number;
  /** Onda lunga: la biglia ha il suo quarto d ora di gloria e il suo calo. */
  waveEvery: number;
  waveOffset: number;
  wavePower: number;
}

/**
 * Il carattere della gara di una biglia: ogni tanto trova la spinta e se ne va,
 * ogni tanto si spegne e la perde. Deciso dal seme una volta sola, quindi la
 * gara resta la stessa dopo un refresh.
 */
export function createDrama(rng: () => number): DramaProfile {
  return {
    surgeEvery: 6.5 + rng() * 4,
    surgeLength: 1.3 + rng() * 0.9,
    surgeOffset: rng() * 10,
    surgePower: 1.16 + rng() * 0.1,
    crisisEvery: 8 + rng() * 5,
    crisisLength: 1.7 + rng() * 1,
    crisisOffset: rng() * 12,
    crisisPower: 0.7 + rng() * 0.08,
    waveEvery: 16 + rng() * 14,
    waveOffset: rng() * 20,
    wavePower: 0.12 + rng() * 0.08,
  };
}

/**
 * Moltiplicatore del momento: spinta e crisi non si sovrappongono quasi mai
 * (periodi diversi), ma se capita la crisi vince, perché è quella che fa
 * scena: chi era davanti si vede sfilare accanto gli inseguitori.
 */
/** Vento in faccia di chi è davanti: la testa costa, sempre, anche di poco. */
export const HEAD_WIND = 0.95;

export function dramaFactor(drama: DramaProfile, elapsed: number): number {
  let factor = 1;
  const surge = (elapsed + drama.surgeOffset) % drama.surgeEvery;
  if (surge > drama.surgeEvery - drama.surgeLength) factor *= drama.surgePower;
  const crisis = (elapsed + drama.crisisOffset) % drama.crisisEvery;
  if (crisis > drama.crisisEvery - drama.crisisLength) factor *= drama.crisisPower;
  // Onda lunga: dieci secondi di gloria, dieci di calo. È questa che fa
  // cambiare il padrone della gara, non il singolo ticco.
  factor *= 1 + Math.sin(((elapsed + drama.waveOffset) / drama.waveEvery) * Math.PI * 2) * drama.wavePower;
  return factor;
}

/**
 * Il gruppo resta in un fazzoletto: chi è davanti paga la fuga, chi è dietro
 * tiene qualche punto in più. Non ribalta una gara, ma tiene la volata
 * aperta fino all'ultimo tratto.
 */
/** Velocità di punta in px/passo: costante di gara più profilo della biglia. */
export const PACE_BASE = 4.02;
export const PACE_PROFILE = 1.15;

/**
 * Bersaglio di velocità sul fondo: il profilo della biglia pesa, l'attrito
 * del fondo solo per un taglio leggero, così la sabbia non allunga la gara.
 * La usano la TV e la simulazione: un solo posto da tarare.
 */
export function paceFor(profile: number, friction: number): number {
  const surfacePace = 1 - Math.min(0.1, friction * 0.06);
  return (PACE_BASE + profile * PACE_PROFILE) * surfacePace;
}

/** Larghezza della corsia per un gruppo di `count` biglie. */
export function trackWidthFor(count: number): number {
  return Math.max(130, Math.min(260, Math.max(1, count) * 32));
}

/** Raggio della biglia: cresce con la corsia, mai sopra i 12 px. */
export function marbleRadiusFor(count: number, trackWidth: number): number {
  return Math.max(9, Math.min(12, trackWidth / Math.max(11, Math.max(1, count) * 1.9)));
}

/**
 * Quanto conta la rimonta sul rettilineo finale: gli ultimi metri sono gli
 * unici in cui un distacco si può ancora ribaltare, ed è lì che nasce il
 * sorpasso che fa urlare la sala.
 */
export const CLOSING_BOOST = 2.1;
export const CLOSING_FROM = 0.7;

/**
 * Le schede delle biglie restano, ma sulla pista si assottigliano: se un
 * punteggio vale venti punti di velocità il podio è deciso in partenza e la
 * gara non ha storia. Qui lo scarto fra una biglia e la media della griglia
 * resta un sussurro, e il resto lo fanno spinta, crisi e rimonta.
 */
export const STAT_SPREAD = 0.45;

export function fieldProfile(raw: number, mean: number): number {
  return mean + (raw - mean) * STAT_SPREAD;
}

export function rubberBand(progress: number, fieldProgress: number, closing = 1): number {
  const gap = (fieldProgress - progress) * closing;
  // Chi insegue guadagna molto (una biglia staccata deve poter rientrare),
  // chi è davanti paga poco: così il gruppo si ricompatta senza che il primo
  // sembri frenato a mano.
  if (gap >= 0) return Math.min(1.32, 1 + gap * 4);
  return Math.max(0.88, 1 + gap * 1.6);
}
