import {
  BALL_RADIUS,
  FIXED_STEP,
  createBasketWorld,
  createCamera,
  createShot,
  launchVelocity,
  previewTrajectory,
  projectPoint,
  stepShot,
  type ShotState,
  type Vec3,
} from './basket-physics';

function simulate(
  velocity: Vec3,
  seconds = 2,
  manche = 1,
  start?: Vec3,
): ShotState {
  const world = createBasketWorld(manche);
  const shot = createShot(world);
  if (start) shot.position = { ...start };
  shot.velocity = { ...velocity };

  const steps = Math.ceil(seconds / FIXED_STEP);
  for (let index = 0; index < steps; index++) {
    stepShot(shot, world, FIXED_STEP);
    if (shot.dead) break;
  }
  return shot;
}

describe('basket physics', () => {
  it('un tiro pulito passa dal cerchio ed è uno swish', () => {
    const world = createBasketWorld(1);
    const shot = createShot(world);
    shot.velocity = launchVelocity(world, 0.5, 0);

    let swish = false;
    for (let index = 0; index < 240 * 2 && !shot.scored; index++) {
      const events = stepShot(shot, world, FIXED_STEP);
      if (events.scored) swish = events.swish;
    }

    expect(shot.scored).toBe(true);
    expect(shot.hitRim).toBe(false);
    expect(shot.hitBoard).toBe(false);
    expect(swish).toBe(true);
  });

  it('la finestra di potenza premia il centro e lascia fuori gli estremi', () => {
    const world = createBasketWorld(1);
    const scoresAt = (pull: number): boolean => {
      const shot = createShot(world);
      shot.velocity = launchVelocity(world, pull, 0);
      for (let index = 0; index < 240 * 2; index++) {
        stepShot(shot, world, FIXED_STEP);
        if (shot.scored) return true;
        if (shot.hitFloor) return false;
      }
      return false;
    };

    expect(scoresAt(0.2)).toBe(true);
    expect(scoresAt(0.25)).toBe(true);
    expect(scoresAt(0.5)).toBe(true);
    expect(scoresAt(0.75)).toBe(true);
    expect(scoresAt(0.1)).toBe(false);
  });

  it('dopo il canestro la palla cade senza rimbalzare sul tabellone', () => {
    const world = createBasketWorld(1);
    const shot = createShot(world);
    shot.velocity = launchVelocity(world, 0.5, 0);

    let scored = false;
    for (let index = 0; index < 240 * 2 && !shot.dead; index++) {
      const events = stepShot(shot, world, FIXED_STEP);
      if (events.scored) scored = true;
    }

    expect(scored).toBe(true);
    expect(shot.hitBoard).toBe(false);
    expect(shot.hitRim).toBe(false);
    expect(shot.position.z).toBeLessThan(world.board.minZ);
  });

  it('il tabellone respinge il tiro e inverte la velocità frontale', () => {
    const world = createBasketWorld(1);
    const shot = createShot(world);
    // Punta sopra il ferro, sul lato destro del vetro.
    shot.velocity = { x: 0.57, y: 6.9, z: 4.0 };

    let hit = false;
    for (let index = 0; index < 240 * 1.2; index++) {
      const events = stepShot(shot, world, FIXED_STEP);
      if (events.hitBoard) hit = true;
      if (hit) break;
    }

    expect(hit).toBe(true);
    expect(shot.hitBoard).toBe(true);
    expect(shot.velocity.z).toBeLessThan(0);
  });

  it('il ferro laterale rimbalza e non concede il canestro', () => {
    const world = createBasketWorld(1);
    const shot = createShot(world);
    // Arriva sul bordo destro del cerchio, non al centro.
    shot.velocity = { x: 0.21, y: 6.6, z: 3.4 };

    let hit = false;
    for (let index = 0; index < 240 * 1.4; index++) {
      const events = stepShot(shot, world, FIXED_STEP);
      if (events.hitRim) hit = true;
      if (hit) break;
    }

    expect(hit).toBe(true);
    expect(shot.hitRim).toBe(true);
    expect(shot.scored).toBe(false);
  });

  it('il pavimento assorbe il rimbalzo e riporta la palla sopra il livello', () => {
    const shot = simulate({ x: 0, y: -2.4, z: 0 }, 0.35, 1, { x: 0, y: 1, z: 1.02 });

    expect(shot.hitFloor).toBe(true);
    expect(shot.position.y).toBeGreaterThanOrEqual(BALL_RADIUS - 0.001);
    expect(shot.velocity.y).toBeGreaterThan(0);
  });

  it('non si può segnare passando dal basso verso l’alto', () => {
    const shot = simulate(
      { x: 0, y: 2.4, z: 0 },
      0.5,
      1,
      { x: 0, y: 2.7, z: 4.35 },
    );

    expect(shot.scored).toBe(false);
  });

  it('la camera POV mette il ferro sopra la palla e al centro', () => {
    const world = createBasketWorld(1);
    const camera = createCamera(400, 800, world);
    const rim = projectPoint(camera, { x: 0, y: world.rim.y, z: world.rim.z });
    const ball = projectPoint(camera, world.start);
    const behind = projectPoint(camera, { x: 0, y: 1.5, z: -1 });

    expect(rim.visible).toBe(true);
    expect(rim.x).toBeCloseTo(200, 0);
    expect(rim.y).toBeLessThan(400);
    expect(ball.visible).toBe(true);
    expect(ball.y).toBeGreaterThan(400);
    expect(ball.y).toBeLessThan(800);
    expect(ball.y + BALL_RADIUS * ball.scale).toBeLessThan(800);
    expect(behind.visible).toBe(false);
  });

  it('la guida mostra una traiettoria che avanza verso il ferro', () => {
    const world = createBasketWorld(1);
    const points = previewTrajectory(world, 0.6, 0);
    const velocity = launchVelocity(world, 0.6, 0);

    expect(points.length).toBeGreaterThan(10);
    expect(velocity.z).toBeGreaterThan(0);
    expect(points.some((point) => point.z > world.start.z + 3)).toBe(true);
  });
});
