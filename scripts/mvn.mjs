// Esegue il Maven wrapper del backend dalla sua cartella, così i comandi
// funzionano sia da bash (./mvnw) sia da PowerShell/cmd (mvnw.cmd).
// Passa SERVER_PORT da .env, così il backend ascolta sulla porta configurata.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, rootDir } from './env.mjs';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'backend');
const isWindows = process.platform === 'win32';
const { bePort } = loadEnv();

/**
 * JAVA_HOME può mancare, o puntare a una cartella che non esiste più: in quei
 * casi si usa il JDK dentro `.tools`, dove lo mette il setup senza admin. Così
 * `npm run dev` e `npm run test:backend` funzionano da qualsiasi terminale.
 */
function resolveJavaHome() {
  const java = process.platform === 'win32' ? 'java.exe' : 'java';
  const candidates = [process.env.JAVA_HOME].filter(Boolean);
  const tools = join(rootDir, '.tools');

  if (existsSync(tools)) {
    const jdks = readdirSync(tools)
      .filter((entry) => entry.toLowerCase().startsWith('jdk'))
      .sort()
      .reverse();
    for (const entry of jdks) candidates.push(join(tools, entry));
  }

  return candidates.find((dir) => existsSync(join(dir, 'bin', java))) ?? null;
}

const javaHome = resolveJavaHome();
if (javaHome) {
  if (javaHome !== process.env.JAVA_HOME) {
    console.log(`  JDK: ${javaHome}`);
  }
  process.env.JAVA_HOME = javaHome;
  process.env.PATH = `${join(javaHome, 'bin')}${delimiter}${process.env.PATH ?? ''}`;
} else {
  console.warn('  ⚠️  Nessun JDK trovato: imposta JAVA_HOME o installa il JDK in .tools.');
}

// Su Windows il wrapper va invocato con il percorso relativo: `mvnw.cmd`
// nudo non viene risolto da cmd quando la cwd del figlio è apps/backend.
const child = spawn(isWindows ? '.\\mvnw.cmd' : './mvnw', process.argv.slice(2), {
  cwd: backendDir,
  stdio: 'inherit',
  shell: isWindows,
  env: { ...process.env, SERVER_PORT: bePort }
});

child.on('error', (error) => {
  console.error('Impossibile avviare Maven:', error.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
