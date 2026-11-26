import { defineConfig } from 'playwright/test';

// Porte dedicate ai test: si possono spostare per non collidere con un'altra
// prova E2E aperta sulla stessa cartella. I valori predefiniti restano quelli
// della serata di prova.
const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT) || 4295;
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT) || 8095;

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node scripts/e2e/backend.mjs',
      url: `http://127.0.0.1:${BACKEND_PORT}/health`,
      timeout: 240_000,
      reuseExistingServer: false,
      env: {
        SERVER_PORT: String(BACKEND_PORT),
        SERVER_ADDRESS: '127.0.0.1',
        DB_URL: 'jdbc:h2:mem:pubgame-e2e;DB_CLOSE_DELAY=-1',
        CONTROL_SECRET: 'e2e-control-secret-0000000000000000',
        ALLOWED_ORIGINS: `http://127.0.0.1:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT}`,
        // Un'altra build Maven nella stessa cartella riscrive target/classes e
        // devtools riavvierebbe il backend a metà prova: l'H2 in memoria si
        // svuoterebbe e i telefoni riceverebbero 410 sulla sessione.
        SPRING_DEVTOOLS_RESTART_ENABLED: 'false',
      },
    },
    {
      command: `npx ng serve --port ${FRONTEND_PORT} --host 127.0.0.1`,
      cwd: 'apps/frontend',
      url: `http://127.0.0.1:${FRONTEND_PORT}/tv`,
      timeout: 240_000,
      reuseExistingServer: false,
      // La shell può esportare PORT=0: Angular lo preferisce a --port e
      // sceglierebbe una porta casuale, facendo scadere l'attesa di Playwright.
      env: { BE_PORT: String(BACKEND_PORT), PORT: String(FRONTEND_PORT) },
    },
  ],
});
