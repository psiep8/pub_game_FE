// Proxy del dev-server: il frontend chiama la propria origine e il dev-server
// inoltra le richieste al backend locale. La porta arriva da BE_PORT, così non
// serve toccare il codice quando cambi porta.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Il `.env` della radice: si legge solo BE_PORT, non le chiavi dei servizi. */
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));

function bePortFromEnvFile() {
  if (!existsSync(envFile)) return undefined;
  const row = readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .find((line) => /^\s*BE_PORT\s*=/.test(line));
  return row?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
}

// L'ambiente vince sul file: `BE_PORT=8091 npx ng serve` resta possibile.
const backendPort = process.env.BE_PORT || bePortFromEnvFile() || process.env.SERVER_PORT || '8080';
const target = `http://127.0.0.1:${backendPort}`;

export default {
  '/categories': { target, secure: false, changeOrigin: true },
  '/games': { target, secure: false, changeOrigin: true },
  '/karaoke': { target, secure: false, changeOrigin: true },
  // Canzoni e foto della banca locale: il payload torna percorsi relativi e il
  // client li chiede alla propria origine (telefono compreso).
  '/media': { target, secure: false, changeOrigin: true },
  '/ws-pubgame': { target, secure: false, ws: true, changeOrigin: true }
};
