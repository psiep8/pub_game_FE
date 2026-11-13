/**
 * Punti con il segno giusto: “+200”, “−200”, “0”.
 *
 * Un solo posto per la formattazione: prima la TV aggiungeva un “+” a un
 * valore già negativo (“+-200”) e il numero finiva fuori dalla colonna.
 */
export function formatPoints(value: number | null | undefined): string {
  const points = Number(value) || 0;
  return new Intl.NumberFormat('it-IT', { signDisplay: 'exceptZero' }).format(points);
}
