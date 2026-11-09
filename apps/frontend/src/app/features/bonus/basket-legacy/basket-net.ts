import type { BasketWorld, Vec3 } from './basket-physics';

export const NET_STRANDS = 14;
export const NET_LEVELS = 4;

const TAU = Math.PI * 2;
const NET_STEP = 1 / 120;
const NET_CONTACT = 0.026;

const LEVEL_STIFFNESS = [0, 24, 14, 8] as const;
const LEVEL_DAMPING = [0, 7, 4.6, 3.2] as const;
const LEVEL_RADIUS = [0.94, 0.82, 0.67, 0.52] as const;
const LEVEL_DROP = [0.005, 0.16, 0.31, 0.46] as const;
const LEVEL_TWIST = [0, 0.06, 0.12, 0.18] as const;

export interface NetVertex {
  angle: number;
  angleIndex: number;
  level: number;
  position: Vec3;
  velocity: Vec3;
  rest: Vec3;
}

export interface NetState {
  vertices: NetVertex[];
  strands: number;
  levels: number;
  time: number;
}

/**
 * Mesh della rete: ogni vertice sotto il ferro è una massa collegata alla
 * posizione di riposo da una molla. La palla e il colpo sul ferro spostano i
 * vertici, poi la rete oscilla e si assesta.
 */
export function createNetState(world: BasketWorld): NetState {
  const vertices: NetVertex[] = [];

  for (let level = 0; level < NET_LEVELS; level++) {
    const radius = world.rim.radius * LEVEL_RADIUS[level];
    const twist = LEVEL_TWIST[level];

    for (let index = 0; index < NET_STRANDS; index++) {
      const angle = (index / NET_STRANDS) * TAU + 0.1 + twist;
      const rest: Vec3 = {
        x: world.rim.x + Math.cos(angle) * radius,
        y: world.rim.y - LEVEL_DROP[level],
        z: world.rim.z + Math.sin(angle) * radius,
      };

      vertices.push({
        angle,
        angleIndex: index,
        level,
        position: { ...rest },
        velocity: { x: 0, y: 0, z: 0 },
        rest,
      });
    }
  }

  return { vertices, strands: NET_STRANDS, levels: NET_LEVELS, time: 0 };
}

export function stepNet(
  net: NetState,
  world: BasketWorld,
  ball: Vec3 | null,
  dt: number,
): void {
  let remaining = Math.min(Math.max(dt, 0), 0.05);

  while (remaining > 1e-6) {
    const h = Math.min(NET_STEP, remaining);
    integrateNet(net, world, ball, h);
    remaining -= h;
  }
}

function integrateNet(net: NetState, world: BasketWorld, ball: Vec3 | null, h: number): void {
  net.time += h;
  const ballInside = ball ? isBallInsideNet(ball, world) : false;

  for (const vertex of net.vertices) {
    if (vertex.level === 0) {
      vertex.position.x = vertex.rest.x;
      vertex.position.y = vertex.rest.y;
      vertex.position.z = vertex.rest.z;
      vertex.velocity.x = 0;
      vertex.velocity.y = 0;
      vertex.velocity.z = 0;
      continue;
    }

    const stiffness = LEVEL_STIFFNESS[vertex.level];
    const damping = LEVEL_DAMPING[vertex.level];

    vertex.velocity.x += (vertex.rest.x - vertex.position.x) * stiffness * h;
    vertex.velocity.y += (vertex.rest.y - vertex.position.y) * stiffness * h;
    vertex.velocity.z += (vertex.rest.z - vertex.position.z) * stiffness * h;

    const decay = Math.max(0, 1 - damping * h);
    vertex.velocity.x *= decay;
    vertex.velocity.y *= decay;
    vertex.velocity.z *= decay;

    if (ballInside && ball) pushVertex(vertex, ball, world, h);

    vertex.position.x += vertex.velocity.x * h;
    vertex.position.y += vertex.velocity.y * h;
    vertex.position.z += vertex.velocity.z * h;
  }
}

function isBallInsideNet(ball: Vec3, world: BasketWorld): boolean {
  if (ball.y > world.rim.y + 0.06 || ball.y < world.rim.y - 0.62) return false;

  const radial = Math.hypot(ball.x - world.rim.x, ball.z - world.rim.z);
  return radial < world.rim.radius * 1.08 + world.ballRadius;
}

function pushVertex(vertex: NetVertex, ball: Vec3, world: BasketWorld, h: number): void {
  const dx = vertex.position.x - ball.x;
  const dy = vertex.position.y - ball.y;
  const dz = vertex.position.z - ball.z;
  const distance = Math.hypot(dx, dy, dz);
  const contact = world.ballRadius + NET_CONTACT;

  if (distance >= contact) return;

  let nx = 0;
  let ny = 0;
  let nz = 0;

  if (distance > 1e-5) {
    nx = dx / distance;
    ny = dy / distance;
    nz = dz / distance;
  } else {
    nx = Math.cos(vertex.angle);
    nz = Math.sin(vertex.angle);
  }

  const penetration = contact - distance;
  vertex.position.x += nx * penetration * 0.7;
  vertex.position.y += ny * penetration * 0.7;
  vertex.position.z += nz * penetration * 0.7;

  const push = 2.6 + h * 20;
  vertex.velocity.x += nx * push;
  vertex.velocity.y += ny * push - 0.35;
  vertex.velocity.z += nz * push;
}

/** Colpo della palla che entra: la rete scende e si allarga. */
export function kickNet(net: NetState, world: BasketWorld, strength = 1): void {
  const force = Math.max(0, strength);

  for (const vertex of net.vertices) {
    if (vertex.level === 0) continue;

    const levelFactor = vertex.level / (net.levels - 1);
    const radialX = Math.cos(vertex.angle);
    const radialZ = Math.sin(vertex.angle);

    vertex.velocity.x += radialX * force * levelFactor * 0.82;
    vertex.velocity.y -= force * levelFactor * 1.55;
    vertex.velocity.z += radialZ * force * levelFactor * 0.82;
  }
}

export function maxNetDisplacement(net: NetState): number {
  let max = 0;

  for (const vertex of net.vertices) {
    const distance = Math.hypot(
      vertex.position.x - vertex.rest.x,
      vertex.position.y - vertex.rest.y,
      vertex.position.z - vertex.rest.z,
    );
    if (distance > max) max = distance;
  }

  return max;
}
