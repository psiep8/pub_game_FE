#!/usr/bin/env node
/**
 * Backup del database della serata.
 *
 * Copia il file H2 in `backups/` con data e ora nel nome. Va lanciato **prima**
 * di aprire la TV e **dopo** aver chiuso il backend, così il file non è in
 * scrittura.
 *
 *   npm run db:backup            # backup con timestamp
 *   npm run db:backup -- --list  # elenca i backup presenti
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const dataDir = resolve('apps/backend/data');
const backupDir = resolve('backups');
const candidates = [
  join(dataDir, 'pubgame.mv.db'),
  join(dataDir, 'sim-run.mv.db'),
];

if (process.argv.includes('--list')) {
  if (!existsSync(backupDir)) {
    console.log('nessun backup');
    process.exit(0);
  }
  for (const name of readdirSync(backupDir).sort()) {
    const { size } = statSync(join(backupDir, name));
    console.log(`${name}  ${(size / 1024 / 1024).toFixed(1)} MB`);
  }
  process.exit(0);
}

const source = candidates.find((path) => existsSync(path));
if (!source) {
  console.error(`nessun database in ${dataDir} (cercato: ${candidates.map(basename).join(', ')})`);
  process.exit(1);
}

mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const target = join(backupDir, `pubgame-${stamp}.mv.db`);
copyFileSync(source, target);

const size = statSync(target).size;
console.log(`backup: ${target} (${(size / 1024 / 1024).toFixed(1)} MB)`);
