/**
 * Peso dei sottofondi per la regia audio (`/audio`).
 *
 * <p>La pagina chiede a ogni file una `HEAD` e legge `Content-Length`: mostra
 * quello che il server consegna davvero, non una tabella compilata a mano che
 * invecchia al primo riascolto. Un file non ancora in cartella risponde 404 ed
 * è «manca»; una rete caduta è «n/d», perché non è la stessa cosa.</p>
 */
export type BedWeight = number | 'missing' | 'error';

/** Peso leggibile: MB con la virgola, KB sotto il mega, stati in chiaro. */
export function formatWeight(weight: BedWeight | undefined): string {
  if (weight === undefined) return '…';
  if (weight === 'missing') return 'manca';
  if (weight === 'error') return 'n/d';
  const mb = weight / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2).replace('.', ',')} MB`;
  return `${Math.round(weight / 1024)} KB`;
}

/**
 * Misura i file in parallelo. La funzione prende il `fetch` da fuori: nei test
 * non serve una rete, e nella pagina resta quello del browser.
 */
export async function measureBeds(
  files: readonly string[],
  doFetch: typeof fetch = fetch,
): Promise<Record<string, BedWeight>> {
  const weights: Record<string, BedWeight> = {};
  await Promise.all(
    files.map(async (file) => {
      try {
        const response = await doFetch(`assets/audio/${file}`, { method: 'HEAD' });
        if (!response.ok) {
          weights[file] = 'missing';
          return;
        }
        const length = Number(response.headers.get('content-length') ?? '');
        weights[file] = Number.isFinite(length) && length > 0 ? length : 'error';
      } catch {
        weights[file] = 'error';
      }
    }),
  );
  return weights;
}
