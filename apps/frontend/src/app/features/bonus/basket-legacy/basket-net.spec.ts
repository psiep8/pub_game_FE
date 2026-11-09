import { FIXED_STEP, createBasketWorld } from './basket-physics';
import { createNetState, kickNet, maxNetDisplacement, stepNet } from './basket-net';

describe('basket net', () => {
  it('si muove quando la palla attraversa il canestro', () => {
    const world = createBasketWorld(1);
    const net = createNetState(world);
    const ball = { x: world.rim.x, y: world.rim.y - 0.46, z: world.rim.z };

    for (let index = 0; index < 18; index++) {
      stepNet(net, world, ball, FIXED_STEP);
    }

    expect(maxNetDisplacement(net)).toBeGreaterThan(0.004);
  });

  it('oscilla dopo il colpo e torna verso il riposo', () => {
    const world = createBasketWorld(1);
    const net = createNetState(world);

    kickNet(net, world, 1.25);
    for (let index = 0; index < 12; index++) {
      stepNet(net, world, null, FIXED_STEP);
    }

    const peak = maxNetDisplacement(net);
    expect(peak).toBeGreaterThan(0.05);

    for (let index = 0; index < 240 * 3; index++) {
      stepNet(net, world, null, FIXED_STEP);
    }

    expect(maxNetDisplacement(net)).toBeLessThan(peak * 0.55);
  });

  it('resta ferma senza palla e senza impulso', () => {
    const world = createBasketWorld(1);
    const net = createNetState(world);

    for (let index = 0; index < 120; index++) {
      stepNet(net, world, null, FIXED_STEP);
    }

    expect(maxNetDisplacement(net)).toBeLessThan(0.001);
  });
});
