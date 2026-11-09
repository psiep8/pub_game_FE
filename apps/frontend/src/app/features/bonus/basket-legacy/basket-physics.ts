/**
 * Fisica 3D del bonus basket.
 *
 * Coordinate in metri: x a destra, y in alto, z verso il canestro. La camera è
 * all'altezza degli occhi del tiratore, quindi il mondo è già pronto per una
 * proiezione prospettica. Il passo è fisso: il risultato non dipende dal frame
 * rate del telefono.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Box3 {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface Rim {
  x: number;
  y: number;
  z: number;
  /** Raggio del cerchio, misurato al centro del tubo. */
  radius: number;
  /** Raggio del tubo d'acciaio. */
  tube: number;
}

export interface BasketWorld {
  start: Vec3;
  ballRadius: number;
  gravity: number;
  floorY: number;
  rim: Rim;
  board: Box3;
  pole: Box3;
  base: Box3;
  backWallZ: number;
}

export interface ShotState {
  position: Vec3;
  velocity: Vec3;
  rotation: Vec3;
  spin: Vec3;
  scored: boolean;
  hitRim: boolean;
  hitBoard: boolean;
  hitFloor: boolean;
  dead: boolean;
  elapsed: number;
}

export interface ShotEvents {
  scored: boolean;
  swish: boolean;
  hitRim: boolean;
  hitBoard: boolean;
  hitFloor: boolean;
}

export interface BasketCamera {
  eye: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  focal: number;
  width: number;
  height: number;
  near: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  scale: number;
  depth: number;
  visible: boolean;
}

export const FIXED_STEP = 1 / 240;
export const BALL_RADIUS = 0.12;
export const MANCHE_POINTS = [2, 3, 5] as const;
export const MANCHE_LABELS = ['CANESTRO GRANDE', 'CANESTRO MEDIO', 'CANESTRO PICCOLO'] as const;

/** Fascia di potenza in cui il tiro arriva al ferro: usata anche dal meter. */
export const SHOT_POWER_MIN = 0.22;
export const SHOT_POWER_MAX = 0.88;

const RIM_RADII = [0.275, 0.235, 0.198] as const;
const RIM_TUBE = 0.014;
const FLOOR_RESTITUTION = 0.56;
const BOARD_RESTITUTION = 0.58;
const RIM_RESTITUTION = 0.68;

export function createBasketWorld(manche: number): BasketWorld {
  const index = Math.max(0, Math.min(RIM_RADII.length - 1, Math.floor(manche)));
  const rimRadius = RIM_RADII[index] ?? 0.235;

  return {
    start: { x: 0, y: 1.3, z: 1.02 },
    ballRadius: BALL_RADIUS,
    gravity: 9.81,
    floorY: 0,
    rim: { x: 0, y: 3.05, z: 4.35, radius: rimRadius, tube: RIM_TUBE },
    // Tabellone: vetro da 1,8 m per 1,05 m, appena dietro il ferro.
    board: { minX: -0.9, maxX: 0.9, minY: 2.9, maxY: 3.95, minZ: 4.56, maxZ: 4.62 },
    // Palo e base dietro il tabellone: si vedono in prospettiva e fermano i tiri lunghi.
    pole: { minX: -0.075, maxX: 0.075, minY: 0, maxY: 3.5, minZ: 4.72, maxZ: 4.9 },
    base: { minX: -0.55, maxX: 0.55, minY: 0, maxY: 0.18, minZ: 4.62, maxZ: 5.2 },
    backWallZ: 8,
  };
}

export function createShot(world: BasketWorld): ShotState {
  return {
    position: { ...world.start },
    velocity: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    spin: { x: 0, y: 0, z: 0 },
    scored: false,
    hitRim: false,
    hitBoard: false,
    hitFloor: false,
    dead: false,
    elapsed: 0,
  };
}

/**
 * Il gesto è uno swipe verso l'alto: `pull` è la potenza (0..1), `side` la
 * direzione orizzontale (-1 sinistra, 1 destra). La velocità è già in m/s.
 */
export function launchVelocity(world: BasketWorld, pull: number, side: number): Vec3 {
  const power = clamp(pull, 0, 1);
  const lateral = clamp(side, -1, 1);

  // Arco alto: la palla deve scendere nel ferro, non arrivare piatta sul
  // tabellone. La potenza regola soprattutto la distanza; il laterale ha una
  // curva non lineare per dare precisione vicino al centro.
  return {
    x: Math.sign(lateral) * Math.pow(Math.abs(lateral), 1.7) * 0.95,
    y: 6.6,
    // Curva continua e centrata: il 50% resta lo swish pulito e la finestra
    // utile copre circa il 20–90%, senza il buco sul ferro basso.
    z: 3.36 + (power - 0.25) * 0.22,
  };
}

export function launchShot(shot: ShotState, world: BasketWorld, pull: number, side: number): void {
  shot.velocity = launchVelocity(world, pull, side);
  shot.spin = {
    x: -shot.velocity.z * 2.2,
    y: clamp(side, -1, 1) * 2.4,
    z: shot.velocity.x * 2.2,
  };
  shot.rotation = { x: 0, y: 0, z: 0 };
  shot.scored = false;
  shot.hitRim = false;
  shot.hitBoard = false;
  shot.hitFloor = false;
  shot.dead = false;
  shot.elapsed = 0;
}

/**
 * Avanza il tiro. Il frame può essere lungo, ma la fisica lavora sempre a
 * 1/240 s: niente tunnel attraverso il tabellone o il tubo del ferro.
 */
export function stepShot(shot: ShotState, world: BasketWorld, dt: number): ShotEvents {
  const events = emptyEvents();
  let remaining = Math.min(Math.max(dt, 0), 0.05);

  while (remaining > 1e-6 && !shot.dead) {
    const h = Math.min(FIXED_STEP, remaining);
    stepOnce(shot, world, h, events);
    remaining -= h;
  }

  return events;
}

export function isShotResting(shot: ShotState, world: BasketWorld): boolean {
  if (!shot.hitFloor || shot.position.y > world.ballRadius + 0.025) return false;
  return Math.hypot(shot.velocity.x, shot.velocity.y, shot.velocity.z) < 0.38;
}

/** Traiettoria prevista dal punto di rilascio, con rimbalzi compresi. */
export function previewTrajectory(world: BasketWorld, pull: number, side: number): Vec3[] {
  const ghost = createShot(world);
  launchShot(ghost, world, pull, side);
  return traceShot(ghost, world, 1.8);
}

export function traceShot(start: ShotState, world: BasketWorld, seconds: number): Vec3[] {
  const ghost = cloneShot(start);
  const points: Vec3[] = [{ ...ghost.position }];
  const steps = Math.max(1, Math.ceil(seconds / FIXED_STEP));

  for (let index = 0; index < steps; index++) {
    const events = stepShot(ghost, world, FIXED_STEP);
    if (index % 4 === 0 || events.scored) points.push({ ...ghost.position });
    if (ghost.dead || ghost.scored) break;
  }

  return points;
}

export function createCamera(width: number, height: number, world: BasketWorld): BasketCamera {
  // Occhio all'altezza del telefono: la palla resta in basso nell'inquadratura
  // e il ferro occupa la parte alta, come in un tiro libero in soggettiva.
  const eye: Vec3 = { x: 0, y: 1.55, z: 0 };
  const target: Vec3 = { x: 0, y: 2.1, z: world.rim.z };
  const forward = normalize(sub(target, eye));
  const right = normalize(cross({ x: 0, y: 1, z: 0 }, forward));
  const up = cross(forward, right);
  const verticalFov = (58 * Math.PI) / 180;

  return {
    eye,
    forward,
    right,
    up,
    focal: height / (2 * Math.tan(verticalFov / 2)),
    width,
    height,
    near: 0.08,
  };
}

export function projectPoint(camera: BasketCamera, point: Vec3): ProjectedPoint {
  const relative = sub(point, camera.eye);
  const depth = dot(relative, camera.forward);

  if (depth <= camera.near) {
    return { x: 0, y: 0, scale: 0, depth, visible: false };
  }

  const x = dot(relative, camera.right);
  const y = dot(relative, camera.up);
  const scale = camera.focal / depth;

  return {
    x: camera.width / 2 + (x / depth) * camera.focal,
    y: camera.height / 2 - (y / depth) * camera.focal,
    scale,
    depth,
    visible: true,
  };
}

function stepOnce(shot: ShotState, world: BasketWorld, h: number, events: ShotEvents): void {
  const previous = { ...shot.position };
  const velocity = shot.velocity;

  velocity.y -= world.gravity * h;
  applyNetDrag(shot, world);

  shot.position.x += velocity.x * h;
  shot.position.y += velocity.y * h;
  shot.position.z += velocity.z * h;

  const scoredThisStep = checkScore(previous, shot, world, events);

  resolveFloor(shot, world, events);

  // Dopo il canestro la palla deve cadere nella rete: tabellone e ferro non
  // possono più respingerla alle spalle del tiro.
  if (!shot.scored) {
    resolveBox(shot, world, world.board, BOARD_RESTITUTION, 0.14, true, previous, events);
    resolveBox(shot, world, world.pole, 0.4, 0.35, false, previous, events);
    resolveBox(shot, world, world.base, 0.42, 0.45, false, previous, events);
    resolveRim(shot, world, events);
  }

  if (scoredThisStep) {
    events.swish = !shot.hitRim && !shot.hitBoard;
  }

  shot.rotation.x += shot.spin.x * h;
  shot.rotation.y += shot.spin.y * h;
  shot.rotation.z += shot.spin.z * h;
  shot.spin.x *= Math.max(0, 1 - 0.7 * h);
  shot.spin.y *= Math.max(0, 1 - 0.7 * h);
  shot.spin.z *= Math.max(0, 1 - 0.7 * h);

  shot.elapsed += h;

  if (
    shot.position.y < -0.8 ||
    shot.position.z < -0.7 ||
    shot.position.z > world.backWallZ + 0.6 ||
    Math.abs(shot.position.x) > 4.2
  ) {
    shot.dead = true;
  }
}

function checkScore(
  previous: Vec3,
  shot: ShotState,
  world: BasketWorld,
  events: ShotEvents,
): boolean {
  if (shot.scored || shot.velocity.y >= 0) return false;

  const rim = world.rim;
  if (!(previous.y >= rim.y && shot.position.y < rim.y)) return false;

  const total = previous.y - shot.position.y;
  if (total <= 1e-9) return false;

  const t = (previous.y - rim.y) / total;
  const x = previous.x + (shot.position.x - previous.x) * t;
  const z = previous.z + (shot.position.z - previous.z) * t;
  const clearance = rim.radius - world.ballRadius * 0.92;

  if (Math.hypot(x - rim.x, z - rim.z) > clearance) return false;

  shot.scored = true;
  events.scored = true;

  // La rete assorbe l'inerzia frontale: la palla cade davanti al tabellone,
  // non lo attraversa dopo aver segnato.
  shot.velocity.z = 0;
  shot.velocity.x *= 0.3;
  const safeZ = world.board.minZ - world.ballRadius - 0.01;
  if (shot.position.z > safeZ) shot.position.z = safeZ;
  return true;
}

function resolveFloor(shot: ShotState, world: BasketWorld, events: ShotEvents): void {
  const radius = world.ballRadius;
  if (shot.position.y - radius >= world.floorY) return;

  shot.position.y = world.floorY + radius;
  if (shot.velocity.y < 0) {
    const impact = -shot.velocity.y;
    shot.velocity.y = impact > 0.45 ? impact * FLOOR_RESTITUTION : 0;
    shot.velocity.x *= 0.86;
    shot.velocity.z *= 0.86;
  } else {
    shot.velocity.x *= 0.94;
    shot.velocity.z *= 0.94;
  }

  shot.spin.x += shot.velocity.z * 2.8;
  shot.spin.z -= shot.velocity.x * 2.8;
  shot.hitFloor = true;
  events.hitFloor = true;
}

function resolveBox(
  shot: ShotState,
  world: BasketWorld,
  box: Box3,
  restitution: number,
  friction: number,
  markBoard: boolean,
  previous: Vec3,
  events: ShotEvents,
): void {
  const radius = world.ballRadius;
  const p = shot.position;

  // Il tabellone è sottile: se la palla arriva ad alta velocità, il solo
  // closest-point dopo lo spostamento potrebbe leggerlo dal lato sbagliato.
  // Il controllo del fronte intercetta il passaggio prima che lo attraversi.
  if (
    markBoard &&
    previous.z + radius <= box.minZ &&
    p.z + radius > box.minZ &&
    shot.velocity.z > 0 &&
    p.x > box.minX - radius &&
    p.x < box.maxX + radius &&
    p.y > box.minY - radius &&
    p.y < box.maxY + radius
  ) {
    p.z = box.minZ - radius;
    applyImpulse(shot, { x: 0, y: 0, z: -1 }, restitution, friction);
    shot.hitBoard = true;
    events.hitBoard = true;
    return;
  }

  const closestX = clamp(p.x, box.minX, box.maxX);
  const closestY = clamp(p.y, box.minY, box.maxY);
  const closestZ = clamp(p.z, box.minZ, box.maxZ);
  const dx = p.x - closestX;
  const dy = p.y - closestY;
  const dz = p.z - closestZ;
  const distance = Math.hypot(dx, dy, dz);

  if (distance >= radius) return;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let penetration = radius - distance;

  if (distance > 1e-6) {
    nx = dx / distance;
    ny = dy / distance;
    nz = dz / distance;
  } else {
    // Centro dentro il volume: esce dalla faccia più vicina.
    const faces = [
      { d: p.x - box.minX, nx: -1, ny: 0, nz: 0 },
      { d: box.maxX - p.x, nx: 1, ny: 0, nz: 0 },
      { d: p.y - box.minY, nx: 0, ny: -1, nz: 0 },
      { d: box.maxY - p.y, nx: 0, ny: 1, nz: 0 },
      { d: p.z - box.minZ, nx: 0, ny: 0, nz: -1 },
      { d: box.maxZ - p.z, nx: 0, ny: 0, nz: 1 },
    ];
    const nearest = faces.reduce((best, face) => (face.d < best.d ? face : best), faces[0]);
    nx = nearest.nx;
    ny = nearest.ny;
    nz = nearest.nz;
    penetration = radius + Math.max(0, nearest.d);
  }

  p.x += nx * (penetration + 1e-4);
  p.y += ny * (penetration + 1e-4);
  p.z += nz * (penetration + 1e-4);
  applyImpulse(shot, { x: nx, y: ny, z: nz }, restitution, friction);

  if (markBoard) {
    shot.hitBoard = true;
    events.hitBoard = true;
  }
}

function resolveRim(shot: ShotState, world: BasketWorld, events: ShotEvents): void {
  const rim = world.rim;
  const p = shot.position;
  const dx = p.x - rim.x;
  const dz = p.z - rim.z;
  const planar = Math.hypot(dx, dz);
  const ux = planar > 1e-6 ? dx / planar : 1;
  const uz = planar > 1e-6 ? dz / planar : 0;

  // Punto più vicino sul cerchio del ferro, poi distanza dal tubo.
  const closestX = rim.x + ux * rim.radius;
  const closestZ = rim.z + uz * rim.radius;
  const nx0 = p.x - closestX;
  const ny0 = p.y - rim.y;
  const nz0 = p.z - closestZ;
  const distance = Math.hypot(nx0, ny0, nz0);
  const minDistance = world.ballRadius + rim.tube;

  if (distance >= minDistance) return;

  const nx = distance > 1e-6 ? nx0 / distance : ux;
  const ny = distance > 1e-6 ? ny0 / distance : 0;
  const nz = distance > 1e-6 ? nz0 / distance : uz;
  const penetration = minDistance - distance;

  p.x += nx * (penetration + 1e-4);
  p.y += ny * (penetration + 1e-4);
  p.z += nz * (penetration + 1e-4);
  applyImpulse(shot, { x: nx, y: ny, z: nz }, RIM_RESTITUTION, 0.16);

  shot.hitRim = true;
  events.hitRim = true;
}

function applyImpulse(
  shot: ShotState,
  normal: Vec3,
  restitution: number,
  friction: number,
): void {
  const velocity = shot.velocity;
  const normalSpeed = dot(velocity, normal);
  if (normalSpeed >= 0) return;

  velocity.x -= (1 + restitution) * normalSpeed * normal.x;
  velocity.y -= (1 + restitution) * normalSpeed * normal.y;
  velocity.z -= (1 + restitution) * normalSpeed * normal.z;

  const after = dot(velocity, normal);
  const tangentX = velocity.x - after * normal.x;
  const tangentY = velocity.y - after * normal.y;
  const tangentZ = velocity.z - after * normal.z;

  velocity.x -= tangentX * clamp(friction, 0, 1);
  velocity.y -= tangentY * clamp(friction, 0, 1);
  velocity.z -= tangentZ * clamp(friction, 0, 1);

  shot.spin.x += tangentZ * 3.2;
  shot.spin.z -= tangentX * 3.2;
}

function applyNetDrag(shot: ShotState, world: BasketWorld): void {
  const rim = world.rim;
  if (shot.position.y > rim.y || shot.position.y < rim.y - 0.5) return;

  const dx = shot.position.x - rim.x;
  const dz = shot.position.z - rim.z;
  if (Math.hypot(dx, dz) > rim.radius * 0.95) return;

  shot.velocity.x *= 0.994;
  shot.velocity.y *= 0.994;
  shot.velocity.z *= 0.994;
}

function cloneShot(shot: ShotState): ShotState {
  return {
    position: { ...shot.position },
    velocity: { ...shot.velocity },
    rotation: { ...shot.rotation },
    spin: { ...shot.spin },
    scored: shot.scored,
    hitRim: shot.hitRim,
    hitBoard: shot.hitBoard,
    hitFloor: shot.hitFloor,
    dead: shot.dead,
    elapsed: shot.elapsed,
  };
}

function emptyEvents(): ShotEvents {
  return { scored: false, swish: false, hitRim: false, hitBoard: false, hitFloor: false };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(value: Vec3): Vec3 {
  const length = Math.hypot(value.x, value.y, value.z);
  if (length < 1e-9) return { x: 0, y: 0, z: 0 };
  return { x: value.x / length, y: value.y / length, z: value.z / length };
}
