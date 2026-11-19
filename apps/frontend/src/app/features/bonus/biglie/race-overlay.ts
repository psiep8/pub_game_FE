/**
 * Sovrapposizioni della gara delle Biglie disegnate direttamente sulla tela.
 *
 * <p>B1 della specifica: il disegno esce dal componente e diventa una funzione
 * provabile. Qui c'è la griglia del conto alla rovescia — la stessa di prima,
 * pixel per pixel: timbro di carta ruotato, strisce diagonali sul bordo alto e
 * numero in Anton. Senza stato interno da finto: prende i cinque numeri che le
 * servono in `CountdownView`.</p>
 */
import { ACID, INK, PAPER, TOMATO } from './race-theme';

/** Ciò che il conto alla rovescia mostra: tutto il resto è fisso nel disegno. */
export interface CountdownView {
  /** Secondi rimasti al via; a zero o sotto il numero non si legge più. */
  readonly secondsLeft: number;
  /** Secondi di permanenza del timbro «VIA!» dopo il via. */
  readonly flash: number;
  /** Numero della gara in corso, da 1 in su. */
  readonly raceNumber: number;
  /** Gare del round: il conto è «GARA n / totali». */
  readonly totalRaces: number;
  /** Fondo della pista in chiaro: neve, sabbia, vetro… */
  readonly surface: string;
}

/**
 * Vero quando c'è qualcosa da disegnare: il countdown sta correndo oppure è
 * appena scattato il «VIA!». Serve anche ai test per dire quando la tela
 * resta pulita.
 */
export function countdownVisible(view: CountdownView): boolean {
  return view.secondsLeft > 0 || view.flash > 0;
}

/** Via in grande, leggibile dal fondo della sala: 3 · 2 · 1 · VIA! */
export function drawCountdown(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  view: CountdownView,
): void {
  if (!countdownVisible(view)) return;

  const live = view.secondsLeft > 0;
  const label = live ? String(Math.ceil(view.secondsLeft)) : 'VIA!';
  const stamp = live ? TOMATO : ACID;
  const width = Math.min(340, w * 0.32);
  const height = width * 0.86;
  const cx = w / 2;
  const cy = h / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(8, 6, 4, .42)';
  ctx.fillRect(0, 0, w, h);

  ctx.translate(cx, cy);
  ctx.rotate(-0.035);
  ctx.fillStyle = stamp;
  ctx.fillRect(-width / 2 + 12, -height / 2 + 12, width, height);
  ctx.fillStyle = PAPER;
  ctx.fillRect(-width / 2, -height / 2, width, height);
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.strokeRect(-width / 2, -height / 2, width, height);

  // Strisce diagonali timbrate sul bordo alto, come sui tabelloni.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-width / 2, -height / 2, width, 22);
  ctx.clip();
  ctx.fillStyle = stamp;
  ctx.fillRect(-width / 2, -height / 2, width, 22);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  for (let x = -width; x < width; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, height / 2);
    ctx.lineTo(x + height, -height / 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.round(width * 0.06)}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(live ? 'PRONTI' : 'SI PARTE', 0, -height * 0.36);

  ctx.font = `900 ${Math.round(width * 0.4)}px Anton, Impact, system-ui, sans-serif`;
  ctx.fillStyle = live ? TOMATO : INK;
  ctx.fillText(label, 0, height * 0.04);

  ctx.fillStyle = 'rgba(21, 21, 15, .62)';
  ctx.font = `700 ${Math.round(width * 0.052)}px ui-monospace, monospace`;
  ctx.fillText(
    `GARA ${view.raceNumber} / ${view.totalRaces} · ${view.surface}`,
    0,
    height * 0.36,
  );
  ctx.restore();
}
