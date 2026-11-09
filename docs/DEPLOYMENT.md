# PubGame — ambienti e rilascio (v1.0.0)

Questa guida copre due scenari:

1. **serata di prova** con gli amici, TV + telefoni, senza rischiare la partita vera;
2. **produzione nel pub**, con dominio, HTTPS e dati che sopravvivono ai riavvii.

Le due configurazioni usano lo stesso codice: cambiano solo build, profilo backend
e variabili d'ambiente.

## 1. Ambienti

| Ambiente | Build frontend | Profilo backend | Diagnostica | Database |
|---|---|---|---|---|
| Locale | `npm run dev` | default | accesa | `apps/backend/data/pubgame` |
| Serata di prova | `npm run build:test-night` | `test-night` | accesa | `data/pubgame-test-night` |
| Pub | `npm run build:prod` | `prod` | spenta | `data/pubgame-prod` |
| Test amici (container) | `deploy/docker-compose.test.yml` | `test-night` | accesa | volume Docker |
| Servizio (container) | `deploy/docker-compose.service.yml` | `prod` | spenta | volume Docker |

Le build sono definite in `apps/frontend/angular.json` con `fileReplacements`:

- `environment.ts` → sviluppo locale;
- `environment.test-night.ts` → serata con amici;
- `environment.prod.ts` → pub.

I profili backend sono `application-test-night.yml` e `application-prod.yml`.
Tutti gli URL restano **relativi alla propria origine**: non esistono IP o domini
scritti nel codice.

## 2. Variabili d'ambiente

Copia il modello giusto in `.env` (il file è ignorato da git):

```bash
cp .env.test-night.example .env   # serata di prova
cp .env.prod.example .env         # pub
```

Minimo indispensabile:

| Variabile | Perché |
|---|---|
| `CONTROL_SECRET` | segreto di regia, almeno 32 caratteri casuali; senza, TV e admin non aprono sessioni |
| `ALLOWED_ORIGINS` | origini esatte separate da virgola (schema + host + porta); CORS e WebSocket rifiutano il resto |
| `BE_PORT` / `FE_PORT` | porte locali |
| `HOST` | `0.0.0.0` in prova (telefoni in LAN), `127.0.0.1` in produzione dietro reverse proxy |
| `MEDIA_BASE_URL` | solo produzione: URL pubblico per canzoni e foto locali |
| `DB_URL` | percorso del database H2 su disco persistente |

`CONTROL_SECRET` va generato con un gestore di password e **non** incollato nel
repository, nei messaggi o nelle chat.

## 3. Serata di prova in LAN

```bash
npm install
npm run dev
```

All'avvio viene stampato:

```
PC:       http://localhost:4200/tv
Telefono: http://192.168.1.10:4200/play
```

Aggiungi l'IP LAN a `ALLOWED_ORIGINS` **prima** di avviare:

```
ALLOWED_ORIGINS=http://localhost:4200,http://127.0.0.1:4200,http://192.168.1.10:4200
```

Poi:

1. apri `/tv` sul computer collegato alla TV, inserisci il segreto di regia;
2. inquadra il QR con i telefoni: punta a `/play?game=<id>` sullo stesso host;
3. verifica con 2-3 telefoni prima di far entrare tutti;
4. controlla che il router non abbia l'isolamento client attivo e che i DHCP
   lease bastino per il numero di dispositivi.

Per una serata più "vera" serve HTTPS, perché il service worker e l'installazione
PWA richiedono un contesto sicuro (`https://` o `localhost`).

## 4. Serata di prova via tunnel HTTPS

```bash
npm run dev
# in un altro terminale
cd apps/frontend && ./start-tunnel.sh
```

Lo script stampa un URL `https://xxx.trycloudflare.com`. **Problema noto:** il
tunnel viene creato dopo il backend, quindi `ALLOWED_ORIGINS` non contiene ancora
quell'URL. Procedura corretta:

1. avvia `npm run dev` una prima volta per vedere l'URL del tunnel;
2. copia l'URL in `ALLOWED_ORIGINS` nel `.env`;
3. riavvia `npm run dev`;
4. riavvia il tunnel (l'URL cambia a ogni avvio con `trycloudflare`).

Il QR mostrato dalla TV usa l'host con cui hai aperto la pagina: se apri la TV
dall'URL del tunnel, i telefoni ricevono lo stesso URL HTTPS e possono installare
la PWA.

Per una soluzione stabile usa un **tunnel con nome** Cloudflare e un dominio tuo:
l'URL non cambia più e `ALLOWED_ORIGINS` resta fisso.

## 5. Produzione nel pub

Architettura consigliata: **una sola origine**.

```
Internet / LAN
      │
   Caddy (HTTPS)  ── /            → file statici Angular
      │            ── /games, /categories, /questions, /media
      │            ── /ws-pubgame → Spring Boot :8080
      ▼
  Spring Boot + H2 su disco
```

### Build

```bash
npm ci
npm run build:prod
node scripts/mvn.mjs -DskipTests package
```

Risultati:

- frontend: `apps/frontend/dist/pubgameFE/browser`
- backend: `apps/backend/target/pub_game_BE-1.0.0.jar`

### Avvio backend

```bash
SPRING_PROFILES_ACTIVE=prod \
CONTROL_SECRET='...' \
ALLOWED_ORIGINS='https://play.example.it' \
MEDIA_BASE_URL='https://play.example.it' \
DB_URL='jdbc:h2:file:/srv/pubgame/data/pubgame;DB_CLOSE_DELAY=-1' \
java -jar apps/backend/target/pub_game_BE-1.0.0.jar
```

In produzione `ddl-auto` resta `update`: il database H2 su file conserva partite,
round e punteggi. Fai un backup di `data/` prima di ogni aggiornamento.

### Caddy

```caddyfile
play.example.it {
    encode gzip zstd
    root * /srv/pubgame/browser

    @api path /games/* /categories/* /questions/* /media/*
    handle @api {
        reverse_proxy 127.0.0.1:8080
    }

    @ws path /ws-pubgame /ws-pubgame/*
    handle @ws {
        reverse_proxy 127.0.0.1:8080
    }

    handle {
        try_files {path} /index.html
        file_server
    }
}
```

Con nginx l'equivalente richiede `location /games/`, `/categories/`, `/questions/`,
`/media/` e `/ws-pubgame` con `proxy_pass http://127.0.0.1:8080;` e
`proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`
per il WebSocket.

### Servizio systemd (esempio)

```ini
[Unit]
Description=PubGame backend
After=network.target

[Service]
WorkingDirectory=/srv/pubgame
EnvironmentFile=/srv/pubgame/.env
ExecStart=/usr/bin/java -jar /srv/pubgame/pub_game_BE-1.0.0.jar
Restart=always
User=pubgame

[Install]
WantedBy=multi-user.target
```

## 5b. Variante A: un solo container

L'immagine fullstack compila Angular e lo copia dentro il jar Spring Boot:
`/tv`, `/play`, `/admin`, le API e `/ws-pubgame` stanno sulla stessa origine.
Non serve Caddy per il routing: serve solo per HTTPS quando c'è un dominio.

### Test tra amici, senza dominio

```bash
cp deploy/.env.test.example deploy/.env
# genera il segreto con: openssl rand -hex 32
# incolla il valore in CONTROL_SECRET
docker compose -f deploy/docker-compose.test.yml --env-file deploy/.env up -d --build
```

Apri `http://<IP-del-server>:8080/tv`. Il QR mostrato dalla TV punta
automaticamente allo stesso host e alla partita corrente. Non c'è HTTPS:
il gioco funziona, ma la scorciatoia PWA non è installabile.

Apri la porta 8080 nel firewall del provider. I telefoni possono usare
qualunque rete (Wi-Fi del locale, hotspot o dati mobili): devono solo
raggiungere il server.

### Servizio con dominio

```bash
cp deploy/.env.service.example deploy/.env
# genera il segreto con: openssl rand -hex 32
# imposta DOMAIN e incolla il valore in CONTROL_SECRET
# crea un record DNS A: DOMAIN -> IP del server
docker compose -f deploy/docker-compose.service.yml --env-file deploy/.env up -d --build
```

Apri `https://<DOMAIN>/tv`. Caddy ottiene il certificato da solo; il backend
resta su una rete interna e non espone la 8080. `ALLOWED_ORIGINS` e
`MEDIA_BASE_URL` vengono compilati dal valore di `DOMAIN`.

### Dati e aggiornamenti

I database sono in volumi Docker dedicati, quindi sopravvivono alla
ricostruzione del container. Per aggiornare:

```bash
git pull
docker compose -f deploy/docker-compose.service.yml --env-file deploy/.env up -d --build
```

La guida operativa completa, con backup e media locali, è in
[`deploy/README.md`](../deploy/README.md).

## 6. Hosting: Vercel, dominio, alternative

### Vercel va bene?

**Per il frontend sì, per PubGame intero no.** Vercel serve file statici e funzioni
serverless; qui il backend è Spring Boot con WebSocket STOMP e database H2 su file.
Non può girare su Vercel. Servirebbero due deploy separati, URL assoluti nel
frontend, CORS con origini multiple e un hosting persistente per il backend:
complessità inutile per una serata in un pub.

**Consiglio:** un solo server con Caddy davanti a frontend e backend.

### Opzioni concrete

| Soluzione | Costo | Adatta? |
|---|---|---|
| Mini PC / Raspberry Pi 5 nel pub + Caddy | ~80-150 € una volta | **Sì**: funziona anche senza internet, latenza minima, dati in casa |
| VPS piccolo (Hetzner, Contabo) + Caddy | ~4-6 €/mese | **Sì**: raggiungibile da fuori, backup facile |
| Cloudflare Tunnel con nome da mini PC | gratuito | **Sì** per iniziare: HTTPS e dominio senza aprire porte |
| `trycloudflare` (tunnel rapido) | gratuito | Solo prove: l'URL cambia a ogni avvio |
| Vercel / Netlify / Cloudflare Pages da soli | gratuito | Solo frontend: manca il backend |
| Render / Railway / Fly.io free | gratuito con limiti | Sconsigliato: sleep, volumi effimeri, WebSocket a singhiozzo |

### Dominio

Un dominio costa 10-15 €/anno (Cloudflare Registrar, Porkbun, Namecheap). Esempio:
`play.example.it` con DNS su Cloudflare. Punta al server o al tunnel; Caddy gestisce
il certificato HTTPS da solo. Per la serata in LAN puoi anche usare un nome locale
(`pubgame.local`) con DNS del router, ma HTTPS richiede comunque un certificato.

## 7. PWA e scorciatoia sul telefono

La PWA è la scelta consigliata: stessa base di codice, aggiornamenti immediati,
nessuno store. Non è un framework con "LTS": è uno standard web stabile.

- **iPhone (Safari):** Condividi → *Aggiungi a Home*. Si apre a schermo intero con
  l'icona scelta. Non esiste un prompt automatico: va spiegato ai giocatori.
- **Android (Chrome):** menu → *Installa app* (o *Aggiungi a schermata Home*).
  Compare solo con HTTPS, manifest valido e service worker attivo.
- **iOS 16.4+** supporta le notifiche push per le app aggiunte alla Home; non sono
  usate in questa versione.
- Il service worker è attivo nelle build `test-night` e `production`; in `ng serve`
  è spento per non nascondere gli aggiornamenti in sviluppo.

Se in futuro servissero presenza negli store o push native, **Capacitor** incapsula
la stessa app Angular senza riscrivere l'interfaccia. Non serve per il 1.0.0.

## 8. QR di aggancio

- La TV genera il QR **in locale** con la libreria `qrcode`: nessun servizio
  esterno, funziona anche senza internet.
- Il link è `https://<host>/play?game=<idPartita>`.
- Il telefono, in ordine: legge `?game=`, poi `localStorage.activeGameId`, poi
  chiede `GET /games/active`, infine ripiega su 1.
- Se il canvas non è disponibile, la TV mostra l'URL in chiaro sotto il riquadro.
- Il QR non contiene segreti: solo l'URL pubblico della partita.

Attenzione: un QR stampato o una TV rimasta su una partita vecchia porta i telefoni
alla partita sbagliata. Il link contiene l'ID, quindi basta rigenerare il QR
riaprendo la TV sulla serata corrente.

## 9. Checklist prima di aprire

- [ ] `CONTROL_SECRET` impostato, ≥ 32 caratteri, diverso da quello di prova
- [ ] `ALLOWED_ORIGINS` contiene **esattamente** l'URL usato da TV e telefoni
- [ ] `npm run build:prod` e `node scripts/mvn.mjs -DskipTests package` verdi
- [ ] database su disco persistente e backup recente
- [ ] orologio del server sincronizzato (NTP): i timer dei round usano l'ora server
- [ ] TV a schermo intero, zoom 100%, sospensione disattivata
- [ ] 2-3 telefoni di prova entrano, rispondono e si riconnettono
- [ ] router senza isolamento client; lease DHCP sufficienti
- [ ] pagina aperta in HTTPS se vuoi l'icona PWA

## 10. Aggiornamento e backup

```bash
# con il server fermo
cp -a apps/backend/data /srv/backup/pubgame-$(date +%F)
git pull
npm ci
npm run build:prod
node scripts/mvn.mjs -DskipTests package
# riavvia il servizio
```

Se aggiorni durante una serata, chiudi prima il round dalla TV e verifica che il
pannello di recupero non sia visibile. Un database H2 copiato mentre il processo
scrive può risultare incoerente: ferma il backend prima del backup.

## 11. Sicurezza

- Non esporre mai la console H2 (`spring.h2.console.enabled=false`, già così).
- Non condividere `CONTROL_SECRET` con i giocatori: serve solo a TV e admin.
- Il tunnel pubblico è una porta aperta su internet: usalo per la prova, non
  lasciarlo attivo per giorni.
- Chi perde il token di squadra non può riprendere il nome senza la regia: è una
  limitazione nota del 1.0.0.
- Speed Rush resta bloccato finché il punteggio non è verificato dal server.
