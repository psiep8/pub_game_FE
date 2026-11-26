// Avvia il backend per i test Playwright usando la porta passata da Playwright
// (SERVER_PORT), non quella del `.env` della serata.
import { spawn } from 'node:child_process';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveJavaHome } from '../java-home.mjs';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const isWindows = process.platform === 'win32';
const env = { ...process.env };

const javaHome = resolveJavaHome();
if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.PATH = `${join(javaHome, 'bin')}${delimiter}${env.PATH ?? ''}`;
}

const child = spawn(isWindows ? '.\\mvnw.cmd' : './mvnw', ['spring-boot:run'], {
  cwd: join(rootDir, 'apps', 'backend'),
  stdio: 'inherit',
  shell: isWindows,
  env,
});

child.on('error', (error) => {
  console.error('Impossibile avviare il backend E2E:', error.message);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
