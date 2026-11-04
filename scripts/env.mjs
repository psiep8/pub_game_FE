// Legge le impostazioni locali da .env (se presente), senza sovrascrivere
// le variabili già impostate nel terminale.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

function readDotEnv(file) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

/** Carica .env e restituisce le impostazioni con i default. */
export function loadEnv() {
  const file = join(rootDir, '.env');
  if (existsSync(file)) readDotEnv(file);

  return {
    fePort: process.env.FE_PORT || '4200',
    bePort: process.env.BE_PORT || '8080',
    host: process.env.HOST || '0.0.0.0'
  };
}
