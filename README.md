# PubGame FE — Frontend Angular

Frontend Angular 21 per il gioco da pub multigiocatore con supporto AI, WebSocket e tunnel Cloudflare.

## Requisiti

- Node.js 18+
- Angular CLI 21 (`npm install -g @angular/cli`)
- Cloudflared (solo per tunnel)

## Sviluppo locale

```bash
# Installa dipendenze
npm install

# Avvia in sviluppo (backend locale su 192.168.1.20:8080)
ng serve --host 0.0.0.0
```

Apri `http://localhost:4200` dal browser sul PC, oppure dal telefono con `http://192.168.1.20:4200`.

## Accessi

| Route | Dispositivo | Descrizione |
|---|---|---|
| `/tv` | Desktop | Schermata principale del gioco |
| `/play` | Mobile | Telefono concorrenti (rispondono alle domande) |
| `/admin` | Mobile | Pannello admin / votante (conferma risposte) |

## Build

```bash
# Build produzione
ng build --configuration production

# Build PWA (rete locale)
ng build --configuration pwa

# Build tunnel
ng build --configuration tunnel
```

## Tunnel Cloudflare

Esponi frontend e backend su internet per test da dispositivi esterni:

### Windows
```powershell
.\start-tunnel.ps1
```

### Linux / WSL
```bash
chmod +x start-tunnel.sh
./start-tunnel.sh
```

Poi in un altro terminale:
```bash
ng serve -c tunnel
```

Lo script aggiorna automaticamente `environment.tunnel.ts` con gli URL pubblici `.trycloudflare.com`.
I 3 accessi diventano:
- `https://{fe-tunnel}.trycloudflare.com/tv`
- `https://{fe-tunnel}.trycloudflare.com/play`
- `https://{fe-tunnel}.trycloudflare.com/admin`

## Configurazioni ambiente

| File | Uso |
|---|---|
| `environment.ts` | Default / produzione |
| `environment.development.ts` | Sviluppo locale (`ng serve`) |
| `environment.tunnel.ts` | Tunnel Cloudflare (`ng serve -c tunnel`) |
| `environment.pwa.ts` | Build PWA (`ng build -c pwa`) |

## Struttura

```
src/
├── app/
│   ├── components/
│   │   ├── admin/          # Pannello admin/votante
│   │   ├── game-component/ # Schermata TV (tutti i giochi)
│   │   ├── leaderboard/    # Classifiche
│   │   └── remote-component/ # Telecomando concorrenti
│   ├── services/           # WebSocket, Game, AI, Audio, etc.
│   ├── guard/              # Route guards (mobile/desktop)
│   └── environment/        # Configurazioni ambiente
└── start-tunnel.ps1        # Script tunnel Windows
└── start-tunnel.sh         # Script tunnel Linux/WSL
```
