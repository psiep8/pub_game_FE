import {
  type BasketCamera,
  type BasketWorld,
  type ProjectedPoint,
  type ShotState,
  type Vec3,
  projectPoint,
  SHOT_POWER_MAX,
  SHOT_POWER_MIN,
} from './basket-physics';
import type { NetState, NetVertex } from './basket-net';

const TAU = Math.PI * 2;
const PAPER = '#f1e4c9';
const PAPER_HI = '#fff8e8';
const PAPER_2 = '#e3d2ae';
const COAL = '#15150f';
const TOMATO = '#ff4d2e';
const MUSTARD = '#ffc53d';
const ACID = '#d9ff43';
const MINT = '#8be3c4';
const BG = '#111109';

const BALL = mix(TOMATO, COAL, 0.16);
const BALL_DARK = mix(TOMATO, COAL, 0.52);
const BALL_LIGHT = mix(TOMATO, PAPER_HI, 0.42);

export interface BasketRenderScene {
  camera: BasketCamera;
  world: BasketWorld;
  net: NetState;
  shot: ShotState;
  dragging: boolean;
  pull: number;
  trajectory: Vec3[];
  pointer: { x: number; y: number } | null;
  dragStart: { x: number; y: number } | null;
  time: number;
}

/** Disegna il frame completo. Nessun gradiente: il volume nasce da facce piene. */
export function drawBasketScene(ctx: CanvasRenderingContext2D, scene: BasketRenderScene): void {
  const { camera } = scene;
  ctx.clearRect(0, 0, camera.width, camera.height);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, camera.width, camera.height);

  drawArena(ctx, camera);
  drawCourt(ctx, camera);
  drawBackboard(ctx, scene);

  if (scene.dragging) drawTrajectory(ctx, scene);

  drawHoopAndBall(ctx, scene);

  if (scene.dragging) drawPowerMeter(ctx, scene);
}

function drawArena(ctx: CanvasRenderingContext2D, camera: BasketCamera): void {
  const wall = [
    projectPoint(camera, { x: -7, y: 0, z: 7.9 }),
    projectPoint(camera, { x: 7, y: 0, z: 7.9 }),
    projectPoint(camera, { x: 7, y: 7, z: 7.9 }),
    projectPoint(camera, { x: -7, y: 7, z: 7.9 }),
  ];
  fillPolygon(ctx, wall, '#191910');

  // Gradinate: strisce piene, poi teste del pubblico come punti stampati.
  for (let row = 0; row < 8; row++) {
    const y0 = 1.05 + row * 0.42;
    const y1 = y0 + 0.34;
    const strip = [
      projectPoint(camera, { x: -6.5, y: y0, z: 7.8 }),
      projectPoint(camera, { x: 6.5, y: y0, z: 7.8 }),
      projectPoint(camera, { x: 6.5, y: y1, z: 7.8 }),
      projectPoint(camera, { x: -6.5, y: y1, z: 7.8 }),
    ];
    fillPolygon(ctx, strip, row % 2 === 0 ? '#1d1d13' : '#222216');
    strokePolygon(ctx, strip, alpha(PAPER, 0.06), 1);
  }

  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 26; column++) {
      const point = projectPoint(camera, {
        x: -5.9 + column * 0.47,
        y: 1.22 + row * 0.42,
        z: 7.72,
      });
      if (!point.visible) continue;

      const radius = Math.max(0.8, point.scale * 0.028);
      ctx.fillStyle =
        column % 7 === 0
          ? alpha(TOMATO, 0.55)
          : column % 5 === 0
            ? alpha(MUSTARD, 0.48)
            : alpha(PAPER, 0.2);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Striscione dietro il tabellone: carta stampata dentro l'arena.
  const banner = [
    projectPoint(camera, { x: -2.4, y: 5.6, z: 7.65 }),
    projectPoint(camera, { x: 2.4, y: 5.6, z: 7.65 }),
    projectPoint(camera, { x: 2.4, y: 6.2, z: 7.65 }),
    projectPoint(camera, { x: -2.4, y: 6.2, z: 7.65 }),
  ];
  if (fillPolygon(ctx, banner, MUSTARD)) {
    strokePolygon(ctx, banner, COAL, 2);
    const center = projectPoint(camera, { x: 0, y: 5.9, z: 7.63 });
    if (center.visible) {
      ctx.fillStyle = COAL;
      ctx.font = `${Math.max(8, center.scale * 0.42)}px Anton, Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PUBGAME', center.x, center.y);
    }
  }

  // Faretti: cerchi pieni, nessun alone luminoso.
  for (const x of [-3.6, 3.6]) {
    const light = projectPoint(camera, { x, y: 6.1, z: 5.6 });
    if (!light.visible) continue;
    ctx.fillStyle = alpha(PAPER, 0.18);
    ctx.beginPath();
    ctx.arc(light.x, light.y, Math.max(3, light.scale * 0.16), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alpha(PAPER_HI, 0.72);
    ctx.beginPath();
    ctx.arc(light.x, light.y, Math.max(1.5, light.scale * 0.07), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCourt(ctx: CanvasRenderingContext2D, camera: BasketCamera): void {
  const floor = [
    projectPoint(camera, { x: -5.5, y: 0, z: 0.15 }),
    projectPoint(camera, { x: 5.5, y: 0, z: 0.15 }),
    projectPoint(camera, { x: 5.5, y: 0, z: 8 }),
    projectPoint(camera, { x: -5.5, y: 0, z: 8 }),
  ];
  fillPolygon(ctx, floor, mix(MUSTARD, COAL, 0.48));

  for (let index = 0, z = 0.15; z < 7.9; index++, z += 0.44) {
    const strip = [
      projectPoint(camera, { x: -5.5, y: 0, z }),
      projectPoint(camera, { x: 5.5, y: 0, z }),
      projectPoint(camera, { x: 5.5, y: 0, z: z + 0.44 }),
      projectPoint(camera, { x: -5.5, y: 0, z: z + 0.44 }),
    ];
    fillPolygon(
      ctx,
      strip,
      index % 2 === 0 ? mix(MUSTARD, COAL, 0.4) : mix(MUSTARD, COAL, 0.45),
    );
    strokePolygon(ctx, strip, alpha(COAL, 0.16), 1);
  }

  // Ombra del sostegno e del tabellone: ancora la struttura al parquet.
  const baseShadow = [
    projectPoint(camera, { x: -0.92, y: 0.006, z: 4.15 }),
    projectPoint(camera, { x: 0.92, y: 0.006, z: 4.15 }),
    projectPoint(camera, { x: 0.68, y: 0.006, z: 5.4 }),
    projectPoint(camera, { x: -0.68, y: 0.006, z: 5.4 }),
  ];
  fillPolygon(ctx, baseShadow, alpha(COAL, 0.3));

  const poleShadow = [
    projectPoint(camera, { x: -0.16, y: 0.004, z: 1.45 }),
    projectPoint(camera, { x: 0.16, y: 0.004, z: 1.45 }),
    projectPoint(camera, { x: 0.42, y: 0.004, z: 4.6 }),
    projectPoint(camera, { x: -0.42, y: 0.004, z: 4.6 }),
  ];
  fillPolygon(ctx, poleShadow, alpha(COAL, 0.14));

  const lane = [
    projectPoint(camera, { x: -2.45, y: 0.02, z: 0.2 }),
    projectPoint(camera, { x: 2.45, y: 0.02, z: 0.2 }),
    projectPoint(camera, { x: 2.45, y: 0.02, z: 4.35 }),
    projectPoint(camera, { x: -2.45, y: 0.02, z: 4.35 }),
  ];
  fillPolygon(ctx, lane, alpha(TOMATO, 0.14));

  strokeWorldLine(ctx, camera, { x: -2.45, y: 0.03, z: 0.2 }, { x: -2.45, y: 0.03, z: 4.35 }, alpha(PAPER_HI, 0.72), 2.2);
  strokeWorldLine(ctx, camera, { x: 2.45, y: 0.03, z: 0.2 }, { x: 2.45, y: 0.03, z: 4.35 }, alpha(PAPER_HI, 0.72), 2.2);
  strokeWorldLine(ctx, camera, { x: -2.45, y: 0.03, z: 0.32 }, { x: 2.45, y: 0.03, z: 0.32 }, alpha(PAPER_HI, 0.78), 2.2);
  strokeWorldLine(ctx, camera, { x: -3.2, y: 0.03, z: 4.43 }, { x: 3.2, y: 0.03, z: 4.43 }, alpha(PAPER_HI, 0.72), 2.2);

  drawFloorArc(ctx, camera, { x: 0, y: 0.03, z: 0.32 }, 1.8, 0, Math.PI, alpha(PAPER_HI, 0.62), 2);
  drawFloorArc(ctx, camera, { x: 0, y: 0.03, z: 4.35 }, 1.25, Math.PI, Math.PI * 2, alpha(PAPER_HI, 0.62), 2);
}

function drawBackboard(ctx: CanvasRenderingContext2D, scene: BasketRenderScene): void {
  const { camera, world } = scene;

  drawBox(ctx, camera, world.base, mix(COAL, PAPER_2, 0.34));
  drawBox(ctx, camera, world.pole, mix(COAL, PAPER_2, 0.38));

  drawBox(
    ctx,
    camera,
    { minX: -0.06, maxX: 0.06, minY: 3.1, maxY: 3.2, minZ: 4.54, maxZ: 4.76 },
    mix(COAL, PAPER_2, 0.42),
  );
  drawBox(
    ctx,
    camera,
    { minX: -0.06, maxX: 0.06, minY: 3.72, maxY: 3.82, minZ: 4.54, maxZ: 4.76 },
    mix(COAL, PAPER_2, 0.42),
  );

  const z = world.board.minZ - 0.004;
  const rearZ = world.board.maxZ + 0.004;
  const board = [
    projectPoint(camera, { x: world.board.minX, y: world.board.maxY, z }),
    projectPoint(camera, { x: world.board.maxX, y: world.board.maxY, z }),
    projectPoint(camera, { x: world.board.maxX, y: world.board.minY, z }),
    projectPoint(camera, { x: world.board.minX, y: world.board.minY, z }),
  ];

  if (!fillPolygon(ctx, board, alpha(PAPER, 0.14))) return;

  // Vetro: fasce di riflesso piatte, ritagliate sul tabellone. Niente blur.
  ctx.save();
  clipPolygon(ctx, board);

  const sheenLeft = [
    projectPoint(camera, { x: world.board.minX + 0.05, y: world.board.maxY - 0.05, z: z - 0.002 }),
    projectPoint(camera, { x: world.board.minX + 0.46, y: world.board.maxY - 0.05, z: z - 0.002 }),
    projectPoint(camera, { x: world.board.minX + 0.8, y: world.board.minY + 0.05, z: z - 0.002 }),
    projectPoint(camera, { x: world.board.minX + 0.28, y: world.board.minY + 0.05, z: z - 0.002 }),
  ];
  fillPolygon(ctx, sheenLeft, alpha(PAPER_HI, 0.075));

  const sheenRight = [
    projectPoint(camera, { x: world.board.maxX - 0.62, y: world.board.maxY - 0.05, z: z - 0.002 }),
    projectPoint(camera, { x: world.board.maxX - 0.16, y: world.board.maxY - 0.05, z: z - 0.002 }),
    projectPoint(camera, { x: world.board.maxX - 0.04, y: world.board.minY + 0.05, z: z - 0.002 }),
    projectPoint(camera, { x: world.board.maxX - 0.46, y: world.board.minY + 0.05, z: z - 0.002 }),
  ];
  fillPolygon(ctx, sheenRight, alpha(PAPER_HI, 0.035));

  ctx.strokeStyle = alpha(PAPER_HI, 0.08);
  ctx.lineWidth = Math.max(7, board[0].scale * 0.1);
  for (let x = world.board.minX - 0.9; x < world.board.maxX + 0.8; x += 0.4) {
    const a = projectPoint(camera, { x, y: world.board.minY, z: z - 0.002 });
    const b = projectPoint(camera, { x: x + 0.42, y: world.board.maxY, z: z - 0.002 });
    if (!a.visible || !b.visible) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Graffi brevi: segni di usura, non rumore casuale.
  const scratches = [
    { x: -0.66, y: 3.58, dx: 0.3, dy: 0.22 },
    { x: 0.25, y: 3.22, dx: 0.22, dy: 0.16 },
    { x: 0.56, y: 3.68, dx: 0.12, dy: 0.28 },
  ];
  ctx.strokeStyle = alpha(COAL, 0.18);
  ctx.lineWidth = 1;
  for (const scratch of scratches) {
    const a = projectPoint(camera, { x: scratch.x, y: scratch.y, z: z - 0.001 });
    const b = projectPoint(camera, {
      x: scratch.x + scratch.dx,
      y: scratch.y - scratch.dy,
      z: z - 0.001,
    });
    if (!a.visible || !b.visible) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();

  // Bordo inferiore: il vetro ha spessore anche dove appoggia sul telaio.
  strokeWorldLine(
    ctx,
    camera,
    { x: world.board.minX + 0.05, y: world.board.minY + 0.018, z },
    { x: world.board.maxX - 0.05, y: world.board.minY + 0.018, z },
    alpha(COAL, 0.36),
    1.4,
  );

  // Telaio in quattro barre: finalmente il tabellone ha spessore fisico.
  const frame = 0.052;
  const frameZ = z - 0.012;
  const rearFrameZ = rearZ + 0.004;
  const frameColor = mix(COAL, PAPER_2, 0.5);

  drawBox(
    ctx,
    camera,
    {
      minX: world.board.minX,
      maxX: world.board.maxX,
      minY: world.board.maxY - frame,
      maxY: world.board.maxY,
      minZ: frameZ,
      maxZ: rearFrameZ,
    },
    frameColor,
  );
  drawBox(
    ctx,
    camera,
    {
      minX: world.board.minX,
      maxX: world.board.maxX,
      minY: world.board.minY,
      maxY: world.board.minY + frame,
      minZ: frameZ,
      maxZ: rearFrameZ,
    },
    frameColor,
  );
  drawBox(
    ctx,
    camera,
    {
      minX: world.board.minX,
      maxX: world.board.minX + frame,
      minY: world.board.minY + frame,
      maxY: world.board.maxY - frame,
      minZ: frameZ,
      maxZ: rearFrameZ,
    },
    frameColor,
  );
  drawBox(
    ctx,
    camera,
    {
      minX: world.board.maxX - frame,
      maxX: world.board.maxX,
      minY: world.board.minY + frame,
      maxY: world.board.maxY - frame,
      minZ: frameZ,
      maxZ: rearFrameZ,
    },
    frameColor,
  );

  // Filo di luce sul bordo superiore e ombra su quello inferiore.
  strokeWorldLine(
    ctx,
    camera,
    { x: world.board.minX + 0.06, y: world.board.maxY - frame * 0.25, z: frameZ - 0.002 },
    { x: world.board.maxX - 0.06, y: world.board.maxY - frame * 0.25, z: frameZ - 0.002 },
    alpha(PAPER_HI, 0.34),
    1.3,
  );
  strokeWorldLine(
    ctx,
    camera,
    { x: world.board.minX + 0.06, y: world.board.minY + frame * 0.22, z: frameZ - 0.002 },
    { x: world.board.maxX - 0.06, y: world.board.minY + frame * 0.22, z: frameZ - 0.002 },
    alpha(COAL, 0.42),
    1.2,
  );

  // Fila interna di carta: separa il vetro dal telaio senza addolcire gli angoli.
  const inset = frame + 0.012;
  const innerBoard = [
    projectPoint(camera, { x: world.board.minX + inset, y: world.board.maxY - inset, z: z - 0.002 }),
    projectPoint(camera, { x: world.board.maxX - inset, y: world.board.maxY - inset, z: z - 0.002 }),
    projectPoint(camera, { x: world.board.maxX - inset, y: world.board.minY + inset, z: z - 0.002 }),
    projectPoint(camera, { x: world.board.minX + inset, y: world.board.minY + inset, z: z - 0.002 }),
  ];
  strokePolygon(ctx, innerBoard, alpha(PAPER_HI, 0.3), 1.1);

  // Riquadro esterno e quadrato di mira: due segni netti, entrambi stampati.
  const target = [
    projectPoint(camera, { x: -0.46, y: 3.52, z: z - 0.002 }),
    projectPoint(camera, { x: 0.46, y: 3.52, z: z - 0.002 }),
    projectPoint(camera, { x: 0.46, y: 2.96, z: z - 0.002 }),
    projectPoint(camera, { x: -0.46, y: 2.96, z: z - 0.002 }),
  ];
  strokePolygon(ctx, target, alpha(PAPER_HI, 0.42), 1.2);

  const square = [
    projectPoint(camera, { x: -0.29, y: 3.45, z: z - 0.003 }),
    projectPoint(camera, { x: 0.29, y: 3.45, z: z - 0.003 }),
    projectPoint(camera, { x: 0.29, y: 3.0, z: z - 0.003 }),
    projectPoint(camera, { x: -0.29, y: 3.0, z: z - 0.003 }),
  ];
  const targetWidth = Math.max(2.5, board[0].scale * 0.022);
  strokePolygon(ctx, square, alpha(COAL, 0.45), targetWidth + 2);
  strokePolygon(ctx, square, TOMATO, targetWidth);

  // Bordo posteriore: il telaio è una scatola, non una linea.
  for (const x of [world.board.minX, world.board.maxX]) {
    for (const y of [world.board.minY, world.board.maxY]) {
      const front = projectPoint(camera, { x, y, z: frameZ });
      const back = projectPoint(camera, { x, y, z: rearFrameZ });
      if (!front.visible || !back.visible) continue;
      ctx.strokeStyle = alpha(COAL, 0.54);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(front.x, front.y);
      ctx.lineTo(back.x, back.y);
      ctx.stroke();
    }
  }

  // Bulloni incassati agli angoli del vetro.
  for (const x of [world.board.minX + 0.09, world.board.maxX - 0.09]) {
    for (const y of [world.board.minY + 0.09, world.board.maxY - 0.09]) {
      const bolt = projectPoint(camera, { x, y, z: z - 0.002 });
      if (!bolt.visible) continue;
      const radius = Math.max(1.4, board[0].scale * 0.013);
      ctx.fillStyle = alpha(COAL, 0.62);
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = alpha(PAPER_HI, 0.62);
      ctx.beginPath();
      ctx.arc(bolt.x - radius * 0.24, bolt.y - radius * 0.24, radius * 0.34, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = alpha(PAPER_HI, 0.5);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(bolt.x - radius * 0.42, bolt.y);
      ctx.lineTo(bolt.x + radius * 0.42, bolt.y);
      ctx.stroke();
    }
  }
}

function drawHoopAndBall(ctx: CanvasRenderingContext2D, scene: BasketRenderScene): void {
  const rim = scene.world.rim;
  const ballZ = scene.shot.position.z;
  const frontZ = rim.z - rim.radius;
  const backZ = rim.z + rim.radius;

  if (ballZ < frontZ) {
    drawHoop(ctx, scene, 'all');
    drawBall(ctx, scene);
    return;
  }

  if (ballZ > backZ) {
    drawBall(ctx, scene);
    drawHoop(ctx, scene, 'all');
    return;
  }

  drawHoop(ctx, scene, 'back');
  drawBall(ctx, scene);
  drawHoop(ctx, scene, 'front');
}

function drawHoop(
  ctx: CanvasRenderingContext2D,
  scene: BasketRenderScene,
  part: 'all' | 'back' | 'front',
): void {
  if (part !== 'front') {
    drawRimSupports(ctx, scene);
    drawNet(ctx, scene, true);
    drawRimArc(ctx, scene, true);
  }
  if (part !== 'back') {
    drawNet(ctx, scene, false);
    drawRimArc(ctx, scene, false);
  }
}

function drawRimSupports(ctx: CanvasRenderingContext2D, scene: BasketRenderScene): void {
  const { camera, world } = scene;
  const rim = world.rim;
  const boardZ = world.board.minZ - 0.002;

  for (const side of [-1, 1]) {
    const anchor = { x: side * 0.34, y: rim.y, z: boardZ };
    const rimPoint = {
      x: rim.x + side * rim.radius * 0.55,
      y: rim.y,
      z: rim.z + rim.radius * 0.82,
    };
    const projected = projectPoint(camera, anchor);
    if (!projected.visible) continue;

    const width = Math.max(2.8, projected.scale * 0.034);
    strokeWorldLine(ctx, camera, anchor, rimPoint, alpha(COAL, 0.76), width + 2.4);
    strokeWorldLine(ctx, camera, anchor, rimPoint, mix(COAL, PAPER_2, 0.38), width);
    strokeWorldLine(ctx, camera, anchor, rimPoint, alpha(PAPER_HI, 0.28), Math.max(1, width * 0.28));

    drawBox(
      ctx,
      camera,
      {
        minX: side * 0.34 - 0.085,
        maxX: side * 0.34 + 0.085,
        minY: rim.y - 0.085,
        maxY: rim.y + 0.085,
        minZ: boardZ - 0.025,
        maxZ: boardZ + 0.055,
      },
      mix(COAL, PAPER_2, 0.4),
    );

    // Collare sul ferro: il braccio entra nel tubo, non ci si appoggia sopra.
    const tip = projectPoint(camera, rimPoint);
    if (tip.visible) {
      const tipRadius = Math.max(1.6, projected.scale * 0.016);
      ctx.fillStyle = alpha(COAL, 0.7);
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, tipRadius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = alpha(TOMATO, 0.55);
      ctx.beginPath();
      ctx.arc(tip.x - tipRadius * 0.16, tip.y - tipRadius * 0.18, tipRadius * 0.54, 0, TAU);
      ctx.fill();
      ctx.fillStyle = alpha(PAPER_HI, 0.32);
      ctx.beginPath();
      ctx.arc(tip.x - tipRadius * 0.34, tip.y - tipRadius * 0.36, tipRadius * 0.17, 0, TAU);
      ctx.fill();
    }

    // Piastra con due bulloni: più simile a un fissaggio meccanico reale.
    for (const dy of [-0.045, 0.045]) {
      const bolt = projectPoint(camera, { x: side * 0.34, y: rim.y + dy, z: boardZ - 0.03 });
      if (!bolt.visible) continue;
      const boltRadius = Math.max(1.1, projected.scale * 0.01);
      ctx.fillStyle = alpha(COAL, 0.74);
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, boltRadius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = alpha(PAPER_HI, 0.48);
      ctx.beginPath();
      ctx.arc(bolt.x - boltRadius * 0.25, bolt.y - boltRadius * 0.25, boltRadius * 0.32, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = alpha(PAPER_HI, 0.4);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(bolt.x - boltRadius * 0.4, bolt.y);
      ctx.lineTo(bolt.x + boltRadius * 0.4, bolt.y);
      ctx.stroke();
    }
  }
}

function drawRimArc(
  ctx: CanvasRenderingContext2D,
  scene: BasketRenderScene,
  back: boolean,
): void {
  const { camera, world } = scene;
  const rim = world.rim;
  const segments = 40;
  const points: ProjectedPoint[] = [];

  const start = back ? 0 : Math.PI;
  for (let index = 0; index <= segments; index++) {
    const angle = start + (Math.PI * index) / segments;
    points.push(
      projectPoint(camera, {
        x: rim.x + Math.cos(angle) * rim.radius,
        y: rim.y,
        z: rim.z + Math.sin(angle) * rim.radius,
      }),
    );
  }

  const visible = points.filter((point) => point.visible);
  if (visible.length < 2) return;

  const averageScale = visible.reduce((sum, point) => sum + point.scale, 0) / visible.length;
  const width = Math.max(3.1, 0.031 * averageScale);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  strokeScreenPath(ctx, points, alpha(COAL, 0.68), width + 3.7, 0, 2.0);
  strokeScreenPath(ctx, points, mix(TOMATO, COAL, 0.45), width + 1.8, 0, 1.1);
  strokeScreenPath(ctx, points, TOMATO, width);
  strokeScreenPath(ctx, points, mix(TOMATO, PAPER_HI, 0.36), Math.max(1, width * 0.34), 0, -1.4);

  // Ganci della rete: piccoli innesti regolari sotto il tubo.
  ctx.strokeStyle = alpha(COAL, 0.42);
  ctx.lineWidth = Math.max(0.8, width * 0.18);
  ctx.lineCap = 'round';
  for (let index = 3; index < points.length - 2; index += 5) {
    const point = points[index];
    if (!point?.visible) continue;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x, point.y + Math.max(1.8, width * 0.72));
    ctx.stroke();
  }

  // Bulloni sul bordo: quattro punti pieni danno lettura metallica.
  for (const index of [0, Math.floor(segments / 4), Math.floor(segments / 2), Math.floor((segments * 3) / 4)]) {
    const point = points[index];
    if (!point?.visible) continue;
    const boltRadius = Math.max(1.1, width * 0.31);
    ctx.fillStyle = alpha(COAL, 0.7);
    ctx.beginPath();
    ctx.arc(point.x, point.y, boltRadius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = alpha(PAPER_HI, 0.44);
    ctx.beginPath();
    ctx.arc(point.x - boltRadius * 0.28, point.y - boltRadius * 0.28, boltRadius * 0.3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = alpha(PAPER_HI, 0.38);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(point.x - boltRadius * 0.42, point.y);
    ctx.lineTo(point.x + boltRadius * 0.42, point.y);
    ctx.stroke();
  }
}

function drawNet(
  ctx: CanvasRenderingContext2D,
  scene: BasketRenderScene,
  back: boolean,
): void {
  const { camera, net } = scene;
  const width = netWidth(camera, net);

  // Fili portanti: la loro posizione viene dalla simulazione, non da un disegno fisso.
  for (let index = 0; index < net.strands; index++) {
    if (strandIsBack(net, index) !== back) continue;
    const points = netStrandPoints(camera, net, index);
    if (points.length < 2) continue;
    drawNetStroke(ctx, points, back, width);
  }

  // Diagonali incrociate: la rete si legge come maglia, non come tende parallele.
  for (let level = 0; level < net.levels - 1; level++) {
    for (let index = 0; index < net.strands; index++) {
      if (strandIsBack(net, index) !== back) continue;

      const from = netVertex(net, level, index);
      const to = netVertex(net, level + 1, (index + 1) % net.strands);
      if (!from || !to) continue;

      const start = projectPoint(camera, from.position);
      const end = projectPoint(camera, to.position);
      if (!start.visible || !end.visible) continue;

      drawNetStroke(ctx, [start, end], back, width * 0.72);
    }
  }

  drawNetRings(ctx, scene, back, width);

  // Nodi: piccoli punti sui vertici, soprattutto sul bordo inferiore.
  for (let level = 1; level < net.levels; level++) {
    for (let index = 0; index < net.strands; index++) {
      if (strandIsBack(net, index) !== back) continue;
      const vertex = netVertex(net, level, index);
      if (!vertex) continue;

      const point = projectPoint(camera, vertex.position);
      if (!point.visible) continue;

      ctx.fillStyle = back ? alpha(PAPER, 0.28) : alpha(PAPER_HI, 0.62);
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(0.55, width * 0.32), 0, TAU);
      ctx.fill();
    }
  }
}

function drawNetRings(
  ctx: CanvasRenderingContext2D,
  scene: BasketRenderScene,
  back: boolean,
  width: number,
): void {
  const { camera, net } = scene;

  for (let level = 1; level < net.levels; level++) {
    for (let index = 0; index < net.strands; index++) {
      const next = (index + 1) % net.strands;
      if (strandIsBack(net, index) !== back || strandIsBack(net, next) !== back) continue;

      const from = netVertex(net, level, index);
      const to = netVertex(net, level, next);
      if (!from || !to) continue;

      const start = projectPoint(camera, from.position);
      const end = projectPoint(camera, to.position);
      if (!start.visible || !end.visible) continue;

      drawNetStroke(ctx, [start, end], back, width * 0.86);
    }
  }
}

function drawNetStroke(
  ctx: CanvasRenderingContext2D,
  points: ProjectedPoint[],
  back: boolean,
  width: number,
): void {
  if (points.length < 2) return;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  strokeScreenPath(ctx, points, back ? alpha(COAL, 0.36) : alpha(COAL, 0.54), width + 1.15);
  strokeScreenPath(ctx, points, back ? alpha(PAPER, 0.36) : alpha(PAPER_HI, 0.8), width);
}

function netStrandPoints(
  camera: BasketCamera,
  net: NetState,
  index: number,
): ProjectedPoint[] {
  const points: ProjectedPoint[] = [];

  for (let level = 0; level < net.levels; level++) {
    const vertex = netVertex(net, level, index);
    if (!vertex) continue;
    const point = projectPoint(camera, vertex.position);
    if (point.visible) points.push(point);
  }

  return points;
}

function netVertex(net: NetState, level: number, index: number): NetVertex | undefined {
  return net.vertices[level * net.strands + index];
}

function strandIsBack(net: NetState, index: number): boolean {
  const top = net.vertices[index];
  return top ? Math.sin(top.angle) >= 0 : false;
}

function netWidth(camera: BasketCamera, net: NetState): number {
  const last = net.vertices[net.vertices.length - 1];
  if (!last) return 1;
  const point = projectPoint(camera, last.position);
  return Math.max(0.7, Math.min(2.6, point.scale * 0.0085));
}function drawBall(ctx: CanvasRenderingContext2D, scene: BasketRenderScene): void {
  const { camera, world, shot } = scene;
  const projected = projectPoint(camera, shot.position);
  if (!projected.visible) return;

  const radius = world.ballRadius * projected.scale;
  if (radius < 0.7) return;

  const shadow = projectPoint(camera, { x: shot.position.x, y: 0.012, z: shot.position.z });
  if (shadow.visible) {
    const heightFade = Math.max(0.1, 1 - shot.position.y / 7);
    ctx.fillStyle = alpha(COAL, 0.2 * heightFade);
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, radius * 1.42, radius * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = alpha(COAL, 0.28 * heightFade);
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, radius * 1.06, radius * 0.3, 0, 0, TAU);
    ctx.fill();
  }

  const x = projected.x;
  const y = projected.y;
  const seamWidth = Math.max(1, radius * 0.043);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.clip();

  ctx.fillStyle = BALL;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

  // Volume: ombra piena, tono caldo di rimbalzo, luce larga, riflesso piccolo.
  ctx.fillStyle = BALL_DARK;
  ctx.beginPath();
  ctx.arc(x + radius * 0.62, y + radius * 0.72, radius * 1.08, 0, TAU);
  ctx.fill();
  ctx.fillStyle = alpha(mix(TOMATO, MUSTARD, 0.22), 0.26);
  ctx.beginPath();
  ctx.arc(x + radius * 0.12, y + radius * 0.22, radius * 0.94, 0, TAU);
  ctx.fill();
  ctx.fillStyle = alpha(BALL_LIGHT, 0.2);
  ctx.beginPath();
  ctx.arc(x - radius * 0.26, y - radius * 0.34, radius * 0.88, 0, TAU);
  ctx.fill();
  ctx.fillStyle = alpha(BALL_LIGHT, 0.52);
  ctx.beginPath();
  ctx.arc(x - radius * 0.46, y - radius * 0.47, radius * 0.45, 0, TAU);
  ctx.fill();

  // Ombra di contatto sul bordo inferiore: stacca la sfera dal fondo.
  ctx.strokeStyle = alpha(COAL, 0.2);
  ctx.lineWidth = Math.max(1, radius * 0.075);
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.955, 0.18, Math.PI - 0.18);
  ctx.stroke();

  ctx.translate(x, y);
  ctx.rotate(shot.rotation.z * 0.7 + shot.rotation.y * 0.12);
  ctx.translate(0, Math.sin(shot.rotation.x) * radius * 0.1);

  const traceSeams = (): void => {
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.bezierCurveTo(radius * 0.56, -radius * 0.42, radius * 0.56, radius * 0.42, 0, radius);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.bezierCurveTo(-radius * 0.42, radius * 0.42, radius * 0.42, radius * 0.42, radius, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.94, -0.38, 0.38);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.94, Math.PI - 0.38, Math.PI + 0.38);
    ctx.stroke();
  };

  // Solco scuro spostato: la cucitura ha profondità, non è solo una linea.
  ctx.save();
  ctx.translate(radius * 0.03, radius * 0.035);
  ctx.strokeStyle = alpha(COAL, 0.28);
  ctx.lineWidth = seamWidth + 1.2;
  ctx.lineCap = 'round';
  traceSeams();
  ctx.restore();

  ctx.strokeStyle = alpha(COAL, 0.9);
  ctx.lineWidth = seamWidth;
  ctx.lineCap = 'round';
  traceSeams();

  // Pebble texture: punti scuri e luce rada solo sul lato illuminato.
  ctx.fillStyle = alpha(COAL, 0.22);
  for (let row = -4; row <= 4; row++) {
    for (let column = -4; column <= 4; column++) {
      const px = column * radius * 0.2 + (row % 2) * radius * 0.045;
      const py = row * radius * 0.2;
      if (Math.hypot(px, py) > radius * 0.82) continue;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.35, radius * 0.014), 0, TAU);
      ctx.fill();
    }
  }
  ctx.fillStyle = alpha(PAPER_HI, 0.12);
  for (let row = -3; row <= 3; row++) {
    for (let column = -3; column <= 3; column++) {
      const px = column * radius * 0.2 + (row % 2) * radius * 0.045;
      const py = row * radius * 0.2;
      if (Math.hypot(px, py) > radius * 0.72 || px + py > 0) continue;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.3, radius * 0.011), 0, TAU);
      ctx.fill();
    }
  }

  ctx.restore();

  ctx.strokeStyle = COAL;
  ctx.lineWidth = Math.max(1.3, radius * 0.04);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.stroke();

  // Riflesso netto in alto a sinistra, più un secondo punto di luce.
  ctx.fillStyle = alpha(PAPER_HI, 0.6);
  ctx.beginPath();
  ctx.arc(x - radius * 0.32, y - radius * 0.38, radius * 0.11, 0, TAU);
  ctx.fill();
  ctx.fillStyle = alpha(PAPER_HI, 0.3);
  ctx.beginPath();
  ctx.arc(x - radius * 0.52, y - radius * 0.2, radius * 0.04, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = alpha(PAPER_HI, 0.24);
  ctx.lineWidth = Math.max(1, radius * 0.018);
  ctx.beginPath();
  ctx.arc(x - radius * 0.22, y - radius * 0.28, radius * 0.66, Math.PI * 1.06, Math.PI * 1.42);
  ctx.stroke();
}

function drawTrajectory(ctx: CanvasRenderingContext2D, scene: BasketRenderScene): void {
  const { camera, trajectory } = scene;
  if (trajectory.length < 2) return;

  for (let index = 1; index < trajectory.length; index++) {
    const point = projectPoint(camera, trajectory[index]);
    if (!point.visible) continue;

    const fade = 0.72 - (index / trajectory.length) * 0.42;
    ctx.fillStyle = alpha(ACID, Math.max(0.12, fade));
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(1.3, point.scale * 0.022), 0, Math.PI * 2);
    ctx.fill();
  }

  const last = projectPoint(camera, trajectory[trajectory.length - 1]);
  if (last.visible) {
    ctx.strokeStyle = alpha(ACID, 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(last.x, last.y, Math.max(5, last.scale * 0.08), 0, Math.PI * 2);
    ctx.stroke();
  }

  if (scene.pointer) {
    const ball = projectPoint(camera, scene.shot.position);
    if (ball.visible) {
      ctx.strokeStyle = alpha(PAPER_HI, 0.42);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(scene.pointer.x, scene.pointer.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = alpha(PAPER_HI, 0.62);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(scene.pointer.x, scene.pointer.y, 12, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPowerMeter(ctx: CanvasRenderingContext2D, scene: BasketRenderScene): void {
  const { camera, pull } = scene;
  const width = 10;
  const height = Math.min(120, camera.height * 0.22);
  const x = camera.width - 36;
  const y = camera.height - height - 36;
  const fill = Math.max(0, Math.min(1, pull));

  ctx.fillStyle = alpha(COAL, 0.64);
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = alpha(PAPER, 0.8);
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  // Fascia canestro: un riferimento pieno, non una decorazione.
  const zoneTop = y + height - 2 - (height - 4) * SHOT_POWER_MAX;
  const zoneBottom = y + height - 2 - (height - 4) * SHOT_POWER_MIN;
  const zoneHeight = zoneBottom - zoneTop;
  ctx.fillStyle = alpha(ACID, 0.22);
  ctx.fillRect(x + width + 3, zoneTop, 4, zoneHeight);
  ctx.strokeStyle = alpha(ACID, 0.82);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + width + 3, zoneTop, 4, zoneHeight);
  ctx.beginPath();
  ctx.moveTo(x + width, zoneTop);
  ctx.lineTo(x + width + 8, zoneTop);
  ctx.moveTo(x + width, zoneBottom);
  ctx.lineTo(x + width + 8, zoneBottom);
  ctx.stroke();

  ctx.fillStyle = fill >= SHOT_POWER_MIN && fill <= SHOT_POWER_MAX ? ACID : TOMATO;
  ctx.fillRect(x + 2, y + height - 2 - (height - 4) * fill, width - 4, (height - 4) * fill);

  ctx.save();
  ctx.translate(x + width + 14, zoneTop + zoneHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = alpha(PAPER_HI, 0.82);
  ctx.font = '700 7px "Space Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CANESTRO', 0, 0);
  ctx.restore();

  ctx.save();
  ctx.translate(x - 10, y + height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = alpha(PAPER, 0.72);
  ctx.font = '700 9px "Space Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SPINTA', 0, 0);
  ctx.restore();
}

function drawFloorArc(
  ctx: CanvasRenderingContext2D,
  camera: BasketCamera,
  center: Vec3,
  radius: number,
  start: number,
  end: number,
  color: string,
  width: number,
): void {
  const points: ProjectedPoint[] = [];
  for (let index = 0; index <= 56; index++) {
    const angle = start + ((end - start) * index) / 56;
    points.push(
      projectPoint(camera, {
        x: center.x + Math.cos(angle) * radius,
        y: center.y,
        z: center.z + Math.sin(angle) * radius,
      }),
    );
  }
  strokeScreenPath(ctx, points, color, width);
}

function strokeWorldLine(
  ctx: CanvasRenderingContext2D,
  camera: BasketCamera,
  a: Vec3,
  b: Vec3,
  color: string,
  width: number,
): void {
  const start = projectPoint(camera, a);
  const end = projectPoint(camera, b);
  if (!start.visible || !end.visible) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  camera: BasketCamera,
  box: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
  color: string,
): void {
  const corners: Vec3[] = [
    { x: box.minX, y: box.minY, z: box.minZ },
    { x: box.maxX, y: box.minY, z: box.minZ },
    { x: box.maxX, y: box.maxY, z: box.minZ },
    { x: box.minX, y: box.maxY, z: box.minZ },
    { x: box.minX, y: box.minY, z: box.maxZ },
    { x: box.maxX, y: box.minY, z: box.maxZ },
    { x: box.maxX, y: box.maxY, z: box.maxZ },
    { x: box.minX, y: box.maxY, z: box.maxZ },
  ];
  const faces = [
    { indices: [0, 1, 2, 3], light: 0.08 },
    { indices: [5, 4, 7, 6], light: -0.2 },
    { indices: [4, 0, 3, 7], light: -0.12 },
    { indices: [1, 5, 6, 2], light: -0.04 },
    { indices: [3, 2, 6, 7], light: 0.16 },
  ];

  const projected = faces
    .map((face) => {
      const points = face.indices.map((index) => projectPoint(camera, corners[index]));
      const depth =
        points.reduce((sum, point) => sum + point.depth, 0) / Math.max(1, points.length);
      return { points, depth, light: face.light };
    })
    .sort((a, b) => b.depth - a.depth);

  for (const face of projected) {
    if (!fillPolygon(ctx, face.points, shade(color, face.light))) continue;
    strokePolygon(ctx, face.points, alpha(COAL, 0.48), 1);
  }
}

function fillPolygon(
  ctx: CanvasRenderingContext2D,
  points: ProjectedPoint[],
  color: string,
): boolean {
  if (points.length < 3 || points.some((point) => !point.visible)) return false;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index++) {
    ctx.lineTo(points[index].x, points[index].y);
  }
  ctx.closePath();
  ctx.fill();
  return true;
}

function strokePolygon(
  ctx: CanvasRenderingContext2D,
  points: ProjectedPoint[],
  color: string,
  width: number,
): void {
  if (points.length < 3 || points.some((point) => !point.visible)) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index++) {
    ctx.lineTo(points[index].x, points[index].y);
  }
  ctx.closePath();
  ctx.stroke();
}

function clipPolygon(ctx: CanvasRenderingContext2D, points: ProjectedPoint[]): void {
  if (points.length < 3 || points.some((point) => !point.visible)) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index++) {
    ctx.lineTo(points[index].x, points[index].y);
  }
  ctx.closePath();
  ctx.clip();
}

function strokeScreenPath(
  ctx: CanvasRenderingContext2D,
  points: ProjectedPoint[],
  color: string,
  width: number,
  offsetX = 0,
  offsetY = 0,
): void {
  const visible = points.filter((point) => point.visible);
  if (visible.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(visible[0].x + offsetX, visible[0].y + offsetY);
  for (let index = 1; index < visible.length; index++) {
    ctx.lineTo(visible[index].x + offsetX, visible[index].y + offsetY);
  }
  ctx.stroke();
}

function mix(a: string, b: string, amount: number): string {
  const first = parseColor(a);
  const second = parseColor(b);
  const t = Math.max(0, Math.min(1, amount));
  return rgb(
    first.r + (second.r - first.r) * t,
    first.g + (second.g - first.g) * t,
    first.b + (second.b - first.b) * t,
  );
}

function shade(colorValue: string, amount: number): string {
  const color = parseColor(colorValue);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return rgb(
    color.r + (target - color.r) * t,
    color.g + (target - color.g) * t,
    color.b + (target - color.b) * t,
  );
}

function alpha(colorValue: string, value: number): string {
  const color = parseColor(colorValue);
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${Math.max(0, Math.min(1, value))})`;
}

function parseColor(colorValue: string): { r: number; g: number; b: number } {
  if (colorValue.startsWith('#')) {
    const normalized = colorValue.slice(1);
    const hex =
      normalized.length === 3
        ? normalized
            .split('')
            .map((character) => character + character)
            .join('')
        : normalized;
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  // mix() e shade() possono restituire rgb(...); alpha() deve poterli rileggere.
  const match = colorValue.match(/rgba?\(([^)]+)\)/);
  if (!match) return { r: 0, g: 0, b: 0 };

  const parts = match[1].split(',').map((value) => Number.parseFloat(value));
  return {
    r: Number.isFinite(parts[0]) ? parts[0] : 0,
    g: Number.isFinite(parts[1]) ? parts[1] : 0,
    b: Number.isFinite(parts[2]) ? parts[2] : 0,
  };
}

function rgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}
