# PubGame — Monorepo

> **VERSIONE 1.0.0 — 9 novembre 2026.**
> Prima major: recupero di TV e classifica dopo refresh o cambio dispositivo,
> ambienti di prova e pub separati, QR generato in locale. Se una riga non
> combacia col codice, vince il codice.

Un unico repository per il gioco da pub multigiocatore: **frontend Angular** e **backend Spring Boot** convivono qui dentro.

## Struttura

```
apps/
├── frontend/   Angular 22 + PWA — /tv (schermo), /admin (votante), /play (telefono)
└── backend/    Spring Boot 4 / Java 25 — REST, WebSocket STOMP, AI Groq, H2 o MySQL
scripts/        Avvio unificato (dev, Maven) e lettura di .env
.env            Configurazione locale: porte e host
```

## Requisiti

- Node.js 22.22+ (oppure 24.15+ / 26+) e npm 11 — requisito di Angular 22
- JDK 25 obbligatorio (ultima LTS): `maven-enforcer` ferma la build con un messaggio esplicito se `JAVA_HOME` punta a una versione precedente
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
| `GROQ_API_KEY` | *(vuota)* | Domande AI; senza chiave si usano le domande di riserva locali |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Modello Groq (sostituto ufficiale di `llama-3.3-70b-versatile`, spento il 16/08/2026) |
| `TMDB_API_KEY` | *(vuota)* | Foto per “Indovina chi”; senza chiave la domanda resta senza immagine |

**Nel codice non esiste alcun IP.** Il frontend chiama sempre la propria origine e il dev-server inoltra `/games`, `/categories`, `/questions` e `/ws-pubgame` al backend tramite `apps/frontend/proxy.conf.mjs`, che legge `BE_PORT`. Quindi:

- funziona da `localhost`, dall'IP LAN di qualsiasi macchina e via tunnel;
- se cambi porta, cambi `.env` e riavvii: non ci sono file da rincorrere;
- il QR code di `/tv` usa l'host con cui hai aperto la pagina, quindi punta automaticamente all'IP giusto per i telefoni.

Lato backend `application.yml` legge `SERVER_PORT` e `SERVER_ADDRESS` (passati dagli script), con default 8080 e `0.0.0.0`.

### Accesso di regia e squadre

1. In `.env` imposta `CONTROL_SECRET` a un segreto casuale di almeno 32 caratteri; non condividerlo con i giocatori. Senza questa impostazione nuove sessioni TV/admin sono rifiutate. Genera il valore in locale, per esempio con un gestore di password, e non inserirlo nel repository.
2. Imposta `ALLOWED_ORIGINS` all'elenco, separato da virgole, delle origini esatte del frontend, incluso protocollo e porta. Il default consente solo `http://localhost:4200` e `http://127.0.0.1:4200`: per i telefoni occorre aggiungere l'origine LAN e, se usato, il tunnel HTTPS. Riavvia il backend dopo le modifiche.
3. Aprendo `/tv` o `/admin` viene richiesto il segreto di regia. Il browser conserva il token della sessione per le riconnessioni. I vecchi token, emessi prima della protezione, vengono rifiutati; riapri le pagine dopo l'aggiornamento.
4. Un telefono registra un nome squadra univoco nella partita; per riprendere quella squadra deve conservare il token nel browser. Chi perde o cancella il token non può riappropriarsi del nome senza un intervento della regia; non esiste ancora un recupero assistito. Non condividere il browser con altri giocatori.

**Limitazioni di sicurezza:** Speed Rush e Basket sono bloccati perché i risultati erano autocertificati dal telefono. La scaletta si ferma quando raggiunge Speed Rush: non utilizzare l'app per una serata completa finché non sia disponibile una modalità verificabile e un percorso di avanzamento. Mancano inoltre una prova multi-dispositivo in rete e una limitazione dei tentativi di autenticazione; la registrazione dei nomi è aperta e un partecipante può prenotare per primo il nome di un'altra squadra. Alcune modalità usano ancora tempi o stato dichiarati dal client, quindi i punteggi non sono interamente verificabili. Usare solo segreti casuali robusti e non esporre il tunnel pubblico per la prova. Le sessioni esistenti non vengono revocate automaticamente cambiando `CONTROL_SECRET`.

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

`GROQ_API_KEY` per le domande AI (modello in `GROQ_MODEL`, default `openai/gpt-oss-120b`) e `TMDB_API_KEY` per le immagini. Senza chiavi il backend usa i fallback locali. Con la banca media installata (`questions/media-it.json`) musica, copertine e foto vengono servite da `static/media` senza chiamare iTunes, TMDB o Wikipedia; senza banca la musica usa le anteprime da 30 secondi dell'iTunes Search API.
Profilo MySQL: `node scripts/mvn.mjs spring-boot:run -Dspring-boot.run.profiles=mysql`.

## Ambienti

| Ambiente | Build | Profilo backend | Uso |
|---|---|---|---|
| Locale | `npm run dev` | default | sviluppo e LAN |
| Serata di prova | `npm run build:test-night` | `test-night` | TV + telefoni con gli amici |
| Pub | `npm run build:prod` | `prod` | serata reale nel locale |

Le tre build usano lo stesso codice e cambiano solo configurazione, log e
pannelli diagnostici. La guida completa (LAN, tunnel HTTPS, Vercel, dominio,
PWA, backup) è in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Deploy in un container (variante A)

Il repo include un'immagine fullstack: Angular viene compilato e copiato dentro
il jar Spring Boot, quindi un solo container serve TV, telefoni, API e WebSocket.

| Configurazione | Accesso | Uso |
|---|---|---|
| Test tra amici | `http://<IP>:8080/tv` | senza dominio, nessuna installazione |
| Servizio | `https://<DOMAIN>/tv` | pub, HTTPS e dominio |

Dettagli, comandi, DNS, volumi e backup in [`deploy/README.md`](deploy/README.md).

## Tunnel Cloudflare

```bash
cd apps/frontend
./start-tunnel.sh          # Linux/WSL
.\start-tunnel.ps1         # Windows PowerShell
```

Apre un solo tunnel verso il frontend e stampa gli URL pubblici: `/tv`, `/admin` e `/play` per tutti i telefoni. Il dev-server inoltra API e WebSocket al backend, quindi non serve un secondo tunnel né aggiornare nessun file di configurazione.

## Nota sul deploy statico

Con gli URL relativi, un deploy che serve solo i file statici (senza `ng serve`) richiede un reverse proxy che inoltri `/games`, `/categories`, `/questions` e `/ws-pubgame` al backend.
