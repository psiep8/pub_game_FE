// Avvia frontend (ng serve) e backend (spring-boot:run) insieme.
import { spawn } from 'node:child_process';

const children = [
  ['frontend', spawn('npm', ['run', 'start', '--workspace', 'pubgame-fe'], { stdio: 'inherit', shell: true })],
  ['backend', spawn(process.execPath, ['scripts/mvn.mjs', 'spring-boot:run'], { stdio: 'inherit' })]
];

let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const [, child] of children) {
    if (child.exitCode === null) child.kill();
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

for (const [name, child] of children) {
  child.on('error', (error) => {
    console.error(`[${name}] errore di avvio: ${error.message}`);
    shutdown(1);
  });
  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.error(`[${name}] terminato con codice ${code}`);
    shutdown(code ?? 1);
  });
}
