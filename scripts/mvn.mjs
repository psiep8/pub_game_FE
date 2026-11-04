// Esegue il Maven wrapper del backend dalla sua cartella, così `npm run dev:backend`
// funziona sia da bash (./mvnw) sia da PowerShell/cmd (mvnw.cmd).
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'backend');
const isWindows = process.platform === 'win32';

const child = spawn(isWindows ? 'mvnw.cmd' : './mvnw', process.argv.slice(2), {
  cwd: backendDir,
  stdio: 'inherit',
  shell: isWindows
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
