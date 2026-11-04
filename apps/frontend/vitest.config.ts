import { defineConfig } from 'vitest/config';

/**
 * Configurazione del runner usata da `ng test` (@angular/build:unit-test).
 *
 * `pool: 'vmThreads'` è obbligatorio in questo progetto: Vitest 4 include nel
 * pool un timeout fisso di 5 secondi per l'avvio del worker, mentre la sola
 * creazione dell'ambiente jsdom + il bootstrap di TestBed richiedono ~10 secondi
 * su Windows (disco/antivirus lenti). Con i pool `forks` o `threads` la suite
 * non parte mai e fallisce con "Timeout starting ... runner"; con i worker in
 * `node:vm` l'ambiente non pesa sul timeout di avvio.
 */
export default defineConfig({
  test: {
    pool: 'vmThreads',
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
