// Avvia frontend (ng serve) e backend (spring-boot:run) usando porte e host da .env.
// Uso: node scripts/dev.mjs [all|frontend|backend]
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { loadEnv, rootDir } from './env.mjs';

const env = loadEnv();
const target = (process.argv[2] || 'all').toLowerCase();
const runFrontend = target === 'all' || target === 'frontend';
const runBackend = target === 'all' || target === 'backend';

function lanAddress() {
  for (const nets of Object.values(networkInterfaces())) {
    for (const net of nets ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

const lan = lanAddress();
console.log('');
console.log('  PubGame — configurazione da .env');
console.log(`  Porte: frontend ${env.fePort}, backend ${env.bePort} (host ${env.host})`);
if (runFrontend) {
  console.log(`  PC:     http://localhost:${env.fePort}/tv`);
  if (lan) console.log(`  Telefono: http://${lan}:${env.fePort}/play`);
}
console.log('');

const children = [];

if (runFrontend) {
  // ng serve eredita BE_PORT: il proxy del dev-server inoltra al backend giusto.
  children.push([
    'frontend',
    spawn('npx', ['ng', 'serve', '--port', env.fePort, '--host', env.host], {
      cwd: join(rootDir, 'apps', 'frontend'),
      stdio: 'inherit',
      shell: process.platform === 'win32',
      // Angular usa PORT se presente: forziamo la porta del .env anche quando
      // la shell (o un runner) esporta PORT=0 per altre applicazioni.
      env: { ...process.env, BE_PORT: env.bePort, PORT: String(env.fePort) }
    })
  ]);
}

if (runBackend) {
  children.push([
    'backend',
    spawn(process.execPath, [join(rootDir, 'scripts', 'mvn.mjs'), 'spring-boot:run'], {
      stdio: 'inherit'
    })
  ]);
}

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
