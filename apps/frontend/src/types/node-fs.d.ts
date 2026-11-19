/**
 * Il progetto non dipende da `@types/node`: i test girano in Node e serve solo
 * `readFileSync` per leggere il sorgente dei file che si vogliono controllare
 * (per esempio il punto in cui le due corse chiamano il passo condiviso).
 */
declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: 'utf8'): string;
}
