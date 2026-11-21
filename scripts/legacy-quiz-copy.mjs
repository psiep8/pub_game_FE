#!/usr/bin/env node
/**
 * Prepara una copia H2 sacrificabile con un Quiz legacy non verificabile.
 *
 * Serve a R14: la TV deve rifiutare la ripresa e il telefono non deve offrire
 * voti. Il file sorgente viene solo copiato, mai aperto in scrittura.
 *
 *   npm run db:legacy-copy -- --source backups/pubgame-....mv.db
 *   npm run db:legacy-copy -- --source ... --target /tmp/pubgame-prova-legacy.mv.db
 *
 * La copia deve contenere un Quiz aperto (game_state con round_type QUIZ) e il
 * relativo evento ROUND_STARTED. Se il backup non ne ha uno, usare --game-id
 * su una copia che lo contiene; non inventare un round sul database della
 * serata.
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const javaExe = isWindows ? 'java.exe' : 'java';

function fail(message) {
  console.error(`legacy-quiz-copy: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { force: false, help: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--force') out.force = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const value = argv[++index];
      if (!value || value.startsWith('--')) fail(`manca il valore per ${arg}`);
      out[key] = value;
    } else {
      fail(`argomento non riconosciuto: ${arg}`);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Uso: npm run db:legacy-copy -- [opzioni]

  --source <file.mv.db>   copia di partenza (default: pubgame-test-night.mv.db,
                          poi pubgame.mv.db in apps/backend/data)
  --target <file.mv.db>   copia da creare (default: ${join(tmpdir(), 'pubgame-prova-legacy.mv.db')})
  --game-id <id>          partita Quiz da rendere legacy (default: ultimo Quiz aperto)
  --java <path>           eseguibile Java (default: JAVA_HOME, .tools/jdk*, PATH)
  --h2-jar <path>         jar H2 (default: ~/.m2 o BOOT-INF/lib del backend)
  --force                 sovrascrive una copia già esistente
`);
  process.exit(0);
}

function findSource() {
  if (args.source) return resolve(args.source);
  const dataDir = join(rootDir, 'apps', 'backend', 'data');
  for (const name of ['pubgame-test-night.mv.db', 'pubgame.mv.db']) {
    const candidate = join(dataDir, name);
    if (existsSync(candidate)) return candidate;
  }
  fail(`nessun database in ${dataDir}: passa --source`);
}

const source = findSource();
if (!existsSync(source)) fail(`sorgente non trovato: ${source}`);
const target = resolve(args.target ?? join(tmpdir(), 'pubgame-prova-legacy.mv.db'));
if (source.toLowerCase() === target.toLowerCase()) fail('sorgente e destinazione coincidono');
if (existsSync(target) && !args.force) {
  fail(`esiste già ${target}: usa --force per ricrearla`);
}

mkdirSync(dirname(target), { recursive: true });
for (const suffix of ['', '.trace.db', '.lock.db']) {
  const stale = suffix ? target.replace(/\.mv\.db$/i, suffix) : target;
  if (suffix && existsSync(stale)) rmSync(stale, { force: true });
}
copyFileSync(source, target);
console.log(`copia: ${basename(source)} -> ${target}`);

function resolveJava() {
  const candidates = [];
  if (args.java) candidates.push(resolve(args.java));
  if (process.env.JAVA_HOME) candidates.push(join(process.env.JAVA_HOME, 'bin', javaExe));
  const tools = join(rootDir, '.tools');
  if (existsSync(tools)) {
    for (const entry of readdirSync(tools).filter((name) => /^jdk/i.test(name)).sort().reverse()) {
      candidates.push(join(tools, entry, 'bin', javaExe));
    }
  }
  candidates.push(javaExe);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-version'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) return candidate;
  }
  fail('Java non trovato: passa --java o imposta JAVA_HOME');
}

function findInM2() {
  const base = join(homedir(), '.m2', 'repository', 'com', 'h2database', 'h2');
  if (!existsSync(base)) return null;
  for (const version of readdirSync(base).sort().reverse()) {
    const jar = join(base, version, `h2-${version}.jar`);
    if (existsSync(jar)) return jar;
  }
  return null;
}

function findBackendJar() {
  const dir = join(rootDir, 'apps', 'backend', 'target');
  if (!existsSync(dir)) return null;
  const jars = readdirSync(dir)
    .filter((name) => name.endsWith('.jar') && !name.endsWith('-sources.jar'))
    .map((name) => join(dir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return jars[0] ?? null;
}

function extractFromBackendJar(backendJar) {
  const output = join(tmpdir(), `pubgame-h2-${process.pid}.jar`);
  let result = spawnSync('unzip', ['-p', backendJar, 'BOOT-INF/lib/h2-*.jar'],
    { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  if (!result.error && result.status === 0 && result.stdout.length > 0) {
    writeFileSync(output, result.stdout);
    return output;
  }
  result = spawnSync('python3', ['-c', `import zipfile,sys
z=zipfile.ZipFile(sys.argv[1])
n=[n for n in z.namelist() if n.startswith('BOOT-INF/lib/h2-')][0]
open(sys.argv[2],'wb').write(z.read(n))`, backendJar, output], { encoding: 'utf8' });
  if (!result.error && result.status === 0 && existsSync(output)) return output;

  // Ultimo ripiego: il jar del JDK, disponibile ovunque giri il backend.
  const jarTool = javaExe.endsWith('.exe') ? 'jar.exe' : 'jar';
  const listing = spawnSync(jarTool, ['tf', backendJar], { encoding: 'utf8' });
  const entry = (listing.stdout ?? '').split(/\r?\n/)
    .find((name) => /^BOOT-INF\/lib\/h2-.*\.jar$/.test(name));
  if (!listing.error && listing.status === 0 && entry) {
    const dir = mkdtempSync(join(tmpdir(), 'pubgame-h2-'));
    const extracted = spawnSync(jarTool, ['xf', backendJar, entry], { cwd: dir });
    if (!extracted.error && extracted.status === 0) return join(dir, entry);
  }
  return null;
}

function resolveH2Jar() {
  if (args.h2Jar) {
    const jar = resolve(args.h2Jar);
    if (!existsSync(jar)) fail(`jar H2 non trovato: ${jar}`);
    return jar;
  }
  if (process.env.H2_JAR && existsSync(process.env.H2_JAR)) return resolve(process.env.H2_JAR);
  const fromM2 = findInM2();
  if (fromM2) return fromM2;
  const backendJar = findBackendJar();
  if (backendJar) {
    const extracted = extractFromBackendJar(backendJar);
    if (extracted) return extracted;
  }
  fail('H2 non trovato: esegui npm run test:backend una volta o passa --h2-jar');
}

const java = resolveJava();
const h2Jar = resolveH2Jar();
const dbUrl = `jdbc:h2:file:${target.replace(/\\/g, '/').replace(/\.mv\.db$/i, '')}`;

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runSql(sql) {
  const result = spawnSync(java, [
    '-cp', h2Jar, 'org.h2.tools.Shell',
    '-url', dbUrl, '-user', 'sa', '-password', '', '-sql', sql,
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) fail(result.error.message);
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status !== 0 || /\bSyntax error\b|\bException\b|\bError\b/.test(output)) {
    fail(`H2 ha rifiutato lo script:\n${output.trim()}`);
  }
  return output;
}

function firstInteger(output) {
  for (const line of output.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d+)$/);
    if (match) return Number(match[1]);
  }
  return null;
}

function firstCell(output) {
  for (const line of output.split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith('(') || /^[A-Z0-9_]+$/.test(value)) continue;
    return value;
  }
  return '';
}

let gameId = args.gameId ? Number(args.gameId) : null;
if (!gameId) {
  gameId = firstInteger(runSql(
    "SELECT game_id FROM game_state WHERE round_type='QUIZ' AND round_key IS NOT NULL ORDER BY updated_at DESC LIMIT 1;"));
}
if (!gameId) {
  fail('la copia non contiene un Quiz aperto: usa un backup preso durante un Quiz o --game-id');
}

const roundKey = firstCell(runSql(`SELECT round_key FROM game_state WHERE game_id=${gameId};`));
if (!roundKey) fail(`la partita ${gameId} non ha un round aperto`);
const roundStartId = firstCell(runSql(
  `SELECT event_id FROM game_event WHERE game_id=${gameId} AND type='ROUND_STARTED' AND round_key=${sqlString(roundKey)} ORDER BY seq DESC LIMIT 1;`));
if (!roundStartId) fail(`la partita ${gameId} non ha un evento ROUND_STARTED per ${roundKey}`);

const now = Date.now();
const legacy = {
  roundKey,
  mancheIndex: 0,
  startedAt: now - 5_000,
  deadlineAt: now + 15_000,
  answers: [{ playerName: 'Legacy', manche: 0, points: 200 }],
};
const announced = { roundKey, roundStartId, at: now };

runSql(`UPDATE game_state
  SET status='RUNNING', round_started_at=${now - 5_000}, round_deadline_at=${now + 60_000},
      updated_at=${now}, version=version+1
  WHERE game_id=${gameId};
MERGE INTO state_blob (game_id, blob_key, payload, updated_at) KEY (game_id, blob_key)
  VALUES (${gameId}, 'quiz', ${sqlString(JSON.stringify(legacy))}, ${now});
MERGE INTO state_blob (game_id, blob_key, payload, updated_at) KEY (game_id, blob_key)
  VALUES (${gameId}, 'round-announced', ${sqlString(JSON.stringify(announced))}, ${now});`);

console.log(`legacy pronta: partita ${gameId}, round ${roundKey}, apertura ${roundStartId}`);
console.log(`  quiz: nessun roundStartId; round-announced coerente`);
console.log('');
console.log('Avvia il backend sulla copia (mai sul database originale):');
console.log(`  DB_URL='${dbUrl};DB_CLOSE_DELAY=-1' npm run dev:backend`);
console.log('');
console.log(`File di prova: ${target}`);
console.log(`Sorgente intatto: ${source}`);
