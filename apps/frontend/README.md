# PubGame FE — Frontend Angular

> **VERSIONE BETA — snapshot del 7 novembre 2026.**
> Descrive il frontend **così com'è adesso**, prima del refactoring della prossima
> versione. Le modifiche in arrivo verranno annotate dopo. Vince il codice.

Frontend Angular 22 per il gioco da pub multigiocatore con supporto AI, WebSocket e tunnel Cloudflare.

> Vive in `apps/frontend` del monorepo PubGame. `npm install` e gli script (`npm run dev`, `npm run build`) si lanciano dalla **radice** del repo.

## Accessi

| Route | Dispositivo | Descrizione |
|---|---|---|
| `/tv` | Desktop | Schermata principale del gioco |
| `/play` | Mobile | Telefono concorrenti (rispondono alle domande) |
| `/admin` | Mobile | Pannello admin / votante (conferma risposte) |

## Configurazione

Nessun IP e nessuna porta nel codice. `src/app/environment/environment.ts` deriva API e WebSocket dall'origine della pagina, e il dev-server inoltra `/games`, `/categories`, `/questions` e `/ws-pubgame` al backend indicato da `BE_PORT` in `.env` (vedi `proxy.conf.mjs`).

## Avvio

```bash
# dalla radice del repo
npm run dev            # frontend + backend
npm run dev:frontend   # solo frontend
```

## Build

```bash
npm run build:frontend                              # produzione
npm run build --workspace pubgame-fe -- --configuration pwa
```

## Tunnel Cloudflare

```bash
./start-tunnel.sh          # Linux/WSL
.\start-tunnel.ps1         # Windows PowerShell
```

Apre i tunnel per frontend e backend e stampa gli URL `.trycloudflare.com`. Non serve aggiornare file di configurazione: il frontend continua a usare la propria origine.

## Struttura

```
src/app/
├── components/   admin, game-component (+ games/*), leaderboard, remote-component
├── services/     WebSocket, Game, AI, Audio, RoundManager, Leaderboard
├── guard/        mobile/desktop
└── environment/  configurazione runtime
proxy.conf.mjs    proxy del dev-server verso il backend
start-tunnel.sh / start-tunnel.ps1
```
