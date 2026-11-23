// Scelta del JDK per Maven.
//
// In `.tools` può restare un pacchetto per un'altra architettura (per esempio
// aarch64 su una macchina x86_64): controllare solo che `bin/java` esista
// sceglierebbe quello e Maven morirebbe con "Exec format error". Qui ogni
// candidato viene avviato davvero con `-version` e si prende il primo che
// risponde.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { rootDir } from './env.mjs';

const isWindows = process.platform === 'win32';

/** Vero solo se il java di questa cartella parte su questa macchina. */
export function javaWorks(dir) {
  if (!dir) return false;
  const java = join(dir, 'bin', isWindows ? 'java.exe' : 'java');
  if (!existsSync(java)) return false;
  const probe = spawnSync(java, ['-version'], { encoding: 'utf8', timeout: 15_000 });
  return probe.status === 0;
}

/**
 * JDK da usare: prima `JAVA_HOME`, poi i pacchetti in `.tools` dal più recente.
 * Restituisce null se nessuno parte.
 */
export function resolveJavaHome() {
  const candidates = [process.env.JAVA_HOME].filter(Boolean);
  const tools = join(rootDir, '.tools');

  if (existsSync(tools)) {
    const jdks = readdirSync(tools)
      .filter((entry) => entry.toLowerCase().startsWith('jdk'))
      .sort()
      .reverse();
    for (const entry of jdks) candidates.push(join(tools, entry));
  }

  return candidates.find(javaWorks) ?? null;
}
