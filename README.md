# PubGame — Monorepo

Un unico repository per il gioco da pub multigiocatore: **frontend Angular** e **backend Spring Boot** convivono qui dentro.

## Struttura

```
apps/
├── frontend/   Angular 21 + PWA — /tv (schermo), /admin (votante), /play (telefono)
└── backend/    Spring Boot 4 / Java 17 — REST, WebSocket STOMP/SockJS, AI Groq, H2 o MySQL
scripts/        Utility per avviare Maven in modo cross-platform
```

## Requisiti

- Node.js 18+ e npm 11
- JDK 17+ (il backend dichiara Java 17)
- `cloudflared` solo se usi i tunnel

## Installazione

```bash
npm install
```

Installa le dipendenze del frontend nel workspace `apps/frontend` (finiscono in `node_modules/` alla radice).
Le dipendenze Java le scarica Maven al primo avvio.

## Sviluppo

```bash
# Frontend + backend insieme
npm run dev

# Oppure separati
npm run dev:backend     # spring-boot:run dentro apps/backend  → http://localhost:8080
npm run dev:frontend    # ng serve --host 0.0.0.0             → http://localhost:4200
```

Accessi dal browser:

| Route | Dispositivo | Descrizione |
|---|---|---|
| `/tv` | Desktop | Schermata principale del gioco |
| `/play` | Mobile | Telefono dei concorrenti |
| `/admin` | Mobile | Pannello admin / votante |

## Build e test

```bash
npm run build:frontend    # ng build (produzione) → apps/frontend/dist
npm run build:backend     # mvnw package -DskipTests → apps/backend/target
npm run test:frontend
npm run test:backend
```

## Configurazione

**Frontend** — `apps/frontend/src/app/environment/`:

| File | Uso |
|---|---|
| `environment.ts` | Default / produzione |
| `environment.development.ts` | Sviluppo locale (`ng serve`) |
| `environment.tunnel.ts` | Tunnel Cloudflare (`ng serve -c tunnel`) |
| `environment.pwa.ts` | Build PWA (`ng build -c pwa`) |

**Backend** — `apps/backend/application.yml` (porta 8080, H2 in memoria di default).
Variabili opzionali: `GROQ_API_KEY` (domande AI), `TMDB_API_KEY` (immagini). Senza chiavi il backend usa i fallback locali.
Profilo MySQL: `node scripts/mvn.mjs spring-boot:run -Dspring-boot.run.profiles=mysql`.

## Tunnel Cloudflare

Espone frontend (4200) e backend (8080) su internet:

```bash
cd apps/frontend
./start-tunnel.sh          # Linux/WSL
.\start-tunnel.ps1         # Windows PowerShell
```

Lo script aggiorna `apps/frontend/src/app/environment/environment.tunnel.ts` con gli URL `.trycloudflare.com`.
Poi avvia il frontend in modalità tunnel:

```bash
cd apps/frontend && npx ng serve -c tunnel
```
