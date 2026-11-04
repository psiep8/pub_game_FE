# PubGame — Monorepo

Un unico repository per il gioco da pub multigiocatore: **frontend Angular** e **backend Spring Boot** convivono qui dentro.

## Struttura

```
apps/
├── frontend/   Angular 21 + PWA — /tv (schermo), /admin (votante), /play (telefono)
└── backend/    Spring Boot 4 / Java 17 — REST, WebSocket STOMP/SockJS, AI Groq, H2 o MySQL
scripts/        Avvio unificato (dev, Maven) e lettura di .env
.env            Configurazione locale: porte e host
```

## Requisiti

- Node.js 18+ e npm 11
- JDK 17+
- `cloudflared` solo se usi i tunnel

## Installazione

```bash
npm install
```

## Configurazione: un solo file

Tutta la configurazione locale sta in `.env` alla radice (copiato da `.env.example`):

| Variabile | Default | Uso |
|---|---|---|
| `FE_PORT` | `4200` | Porta del dev-server Angular |
| `BE_PORT` | `8080` | Porta del backend Spring Boot |
| `HOST` | `0.0.0.0` | Interfaccia di ascolto (`0.0.0.0` = visibile dal telefono) |

**Nel codice non esiste alcun IP.** Il frontend chiama sempre la propria origine e il dev-server inoltra `/games`, `/categories`, `/questions` e `/ws-pubgame` al backend tramite `apps/frontend/proxy.conf.mjs`, che legge `BE_PORT`. Quindi:

- funziona da `localhost`, dall'IP LAN di qualsiasi macchina e via tunnel;
- se cambi porta, cambi `.env` e riavvii: non ci sono file da rincorrere;
- il QR code di `/tv` usa l'host con cui hai aperto la pagina, quindi punta automaticamente all'IP giusto per i telefoni.

Lato backend `application.yml` legge `SERVER_PORT` e `SERVER_ADDRESS` (passati dagli script), con default 8080 e `0.0.0.0`.

## Sviluppo

```bash
npm run dev             # backend + frontend insieme
npm run dev:frontend    # solo ng serve
npm run dev:backend     # solo spring-boot:run
```

All'avvio viene stampato l'URL per il PC e quello per il telefono:

```
PC:       http://localhost:4200/tv
Telefono: http://192.168.1.3:4200/play
```

| Route | Dispositivo | Descrizione |
|---|---|---|
| `/tv` | Desktop | Schermata principale del gioco |
| `/play` | Mobile | Telefono dei concorrenti |
| `/admin` | Mobile | Pannello admin / votante |

## Build e test

```bash
npm run build:frontend    # ng build → apps/frontend/dist
npm run build:backend     # mvnw package -DskipTests → apps/backend/target
npm run test:frontend
npm run test:backend
```

I test del frontend girano con Vitest tramite `ng test` e usano `apps/frontend/vitest.config.ts`:
il pool è `vmThreads` perché i pool `forks`/`threads` di Vitest 4 hanno un timeout fisso
di 5s per l'avvio del worker, più corto del bootstrap di jsdom + TestBed su Windows.
Le spec dei componenti usano i doppi condivisi in `src/app/testing/` (nessuna WebSocket,
nessuna chiamata HTTP e nessun elemento `Audio` reale).

## Variabili del backend (opzionali)

`GROQ_API_KEY` per le domande AI, `TMDB_API_KEY` per le immagini. Senza chiavi il backend usa i fallback locali.
Profilo MySQL: `node scripts/mvn.mjs spring-boot:run -Dspring-boot.run.profiles=mysql`.

## Tunnel Cloudflare

```bash
cd apps/frontend
./start-tunnel.sh          # Linux/WSL
.\start-tunnel.ps1         # Windows PowerShell
```

Apre un tunnel per il frontend e uno per il backend e stampa gli URL pubblici. Il frontend continua a usare la propria origine, quindi non serve aggiornare nessun file di configurazione.

## Nota sul deploy statico

Con gli URL relativi, un deploy che serve solo i file statici (senza `ng serve`) richiede un reverse proxy che inoltri `/games`, `/categories`, `/questions` e `/ws-pubgame` al backend.
