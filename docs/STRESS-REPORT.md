# Stress test — WebSocket, telefoni, riconnessione, salvataggi

**Data:** 23 novembre 2026 · **versione:** 2.3.1 · **nessuna correzione applicata**

Questo giro **trova e misura**, non corregge. L'unico codice nuovo sono i due
strumenti di carico (`scripts/stress/`), richiesti dal piano; i difetti trovati
restano aperti e sono elencati anche in `docs/ROADMAP-POST-PRIMA-SERATA.md`.

> **Revisione del 23 novembre 2026 (dopo la prima stesura).** Due errori di
> metodo sono stati corretti e le misure rifatte. `restart-check` rispondeva con
> la socket dell'admin, ma il server accetta `/answer` solo dal ruolo REMOTE e
> solo per il proprio giocatore: nessun voto veniva registrato e lo stato
> fotografato non conteneva punteggi. `ws-load` mandava `ROUND_ENDED`
> dall'admin (è un'azione TV), producendo un frame `ACCESS_DENIED` per round che
> la colonna «Errori» non contava. Ora entrambi usano il client STOMP e il setup
> condivisi di `scripts/sim/client.mjs`, e il crash test passa dalla sequenza
> vera `quiz/manche` → `quiz/answer` → `PUT leaderboard`. La P1 è stata
> declassata: vedi §3.1.

---

## 1. Ambiente

| Voce | Valore |
|---|---|
| Macchina | Windows 11 ARM64, backend in WSL2 Ubuntu 26.04 (aarch64) |
| Risorse | WSL su disco locale, 1 GB di heap JVM di default |
| Node | 26.13.1 (in `.tools/node26`, come `engines`) |
| Java | Temurin 25.0.5.1 |
| Backend | jar `pub_game_BE-2.3.1.jar`, porta **8091** |
| Database | H2 su file **separato** (`/home/peppa/stress-db`), mai quello della serata |
| Rete | loopback; `CONTROL_SECRET` di prova (34 caratteri); `ALLOWED_ORIGINS` solo loopback |
| Client | STOMP nativo su WebSocket, **codice condiviso** con `scripts/sim/client.mjs` |
| Simulatore | `scripts/sim/full-match.mjs` (20 telefonate max, scaletta vera `serata`) |
| Strumenti nuovi | `scripts/stress/ws-load.mjs`, `scripts/stress/restart-check.mjs` + modulo `scripts/sim/client.mjs` |

**Non disponibili in questo ambiente:** `tc netem` e `toxiproxy` (richiedono
privilegi di rete che non sono stati chiesti), Docker e la ricreazione di un
volume, un database MySQL. Le prove che li richiedono sono elencate in §6.

Nessun test ha toccato dati reali: ogni prova crea una partita nuova sul
database di prova e usa un segreto diverso da quello della serata.

---

## 2. WebSocket sotto carico

`npm run stress:ws` con `PLAYERS=4|10|20|40`, 3 round per misura. Ogni telefono
apre una socket reale, entra in partita, la regia apre il round via
`POST /games/{id}/round`, poi **tutti rispondono insieme** e si misura il tempo
tra l'invio e l'eco del server su `/topic/game/{id}/responses` (fan-out reale:
ogni socket riceve tutte le risposte, come in sala).

### 2.1 Latenza risposta → eco (ms)

| Telefoni | Round | p50 | p95 | p99 | max | Perse | Doppioni | Errori |
|---|---|---|---|---|---|---|---|---|
| 4 | 1 | 28,76 | 29,65 | 29,65 | 29,65 | 0 | 0 | 0 |
| 4 | 2 | 17,26 | 19,24 | 19,24 | 19,24 | 0 | 0 | 0 |
| 4 | 3 | 13,29 | 27,17 | 27,17 | 27,17 | 0 | 0 | 0 |
| 10 | 1 | 31,98 | 41,72 | 41,72 | 41,72 | 0 | 0 | 0 |
| 10 | 2 | 37,73 | 44,09 | 44,09 | 44,09 | 0 | 0 | 0 |
| 10 | 3 | 12,23 | 20,05 | 20,05 | 20,05 | 0 | 0 | 0 |
| 20 | 1 | 48,18 | 63,53 | 64,83 | 64,83 | 0 | 0 | 0 |
| 20 | 2 | 30,80 | 47,09 | 48,73 | 48,73 | 0 | 0 | 0 |
| 40 | 1 | 88,30 | 140,94 | 146,03 | 146,03 | 0 | 0 | 0 |
| 40 | 2 | 82,99 | 126,28 | 132,15 | 132,15 | 0 | 0 | 0 |
| 40 | 3 | 113,23 | 178,53 | 183,64 | 183,64 | 0 | 0 | 0 |
| 40 (JVM fredda, dopo riavvio) | 1 | 166,06 | **243,64** | 249,06 | 249,06 | 0 | 0 | 0 |
| 40 (JVM fredda) | 2 | 118,73 | 151,26 | 154,07 | 154,07 | 0 | 0 | 0 |
| 40 (JVM fredda) | 3 | 102,82 | 144,31 | 150,42 | 150,42 | 0 | 0 | 0 |

Nota di metodo: il «doppione» è lo **stesso messaggio** (stesso `receivedAt` del
server) consegnato due volte sulla stessa socket; il fan-out su socket diverse è
il comportamento atteso e non viene contato. Una prima versione dello strumento
lo contava per errore: i numeri qui sopra sono quelli corretti.

Rimisura dopo la revisione, con il client condiviso: **4 telefoni** 2 round,
p95 **29,17 ms**, 0 perse, 0 doppioni; **20 telefoni** 2 round, p95 **61,77 e
65,89 ms**, 0 perse, 0 doppioni, `errorFrames` 0 e `serverErrors` vuoto. La
colonna «Errori» della tabella sopra contava solo i frame con `action: ERROR`:
prima della correzione ogni round produceva anche un `ACCESS_DENIED`
(`ROUND_ENDED` inviato dall'admin), che non era un errore di carico ed è sparito
mandando l'azione dalla TV.

### 2.2 Raffiche, messaggi anomali, doppi invii

- **Doppio invio** dello stesso giocatore a raffica: nessun errore, nessun
  doppione sul canale; il server ha risposto con `409` alle risposte fuori
  finestra (nei 40 round dello soak: 407 `409`, attesi).
- **Sessione di Anna usata per giocare come Bruno**: `ACCESS_DENIED`, socket
  chiusa (`1002`) — rifiuto corretto, come previsto dal fault injection di
  `full-match`.
- **Heartbeat con token inesistente o body assente**: `410`, gestito.
- **Messaggi malformati/grandi**: coperti dai test di integrazione
  (`GameWebSocketControllerTest`, `WebSocketActionWhitelistTest`); non ripetuti
  a mano in questo giro.

### 2.3 Punteggi con 4 e 40 telefoni

Il server calcola Arena, Timeline, Bomba, Blackjack e valida le fiches
dell'Azzardo; con 40 socket non si sono visti doppi accrediti né risposte perse
(0 perse su 14 raffiche). Il confronto «punteggio identico a parità di risposte»
non è stato automatizzato per Speed Rush/Quiz: i punti di quei giochi li calcola
la TV, non il server, e il simulatore non replica il voto della TV. **Resta da
fare** un confronto dedicato (§6).

### 2.4 Risorse del backend durante il carico

| Telefoni | CPU % | RSS | Thread |
|---|---|---|---|
| 4 | 26,1 | 450 MB | 97 |
| 20 | 24,5 | 460 MB | 97 |
| 40 | 23,5 | 501 MB | 103 |

Crescita contenuta; i thread salgono con le connessioni e restano stabili.

---

## 3. Riconnessione e crash

### 3.1 Riavvio del backend (`kill -9` / `SIGTERM`)

Metodo rivisto: `npm run stress:restart start` crea la partita, apre un round
Quiz, annuncia la manche (`POST /quiz/manche`), fa votare i 4 telefoni via REST
(`POST /quiz/answer`: **4/4 accettati**) e salva la classifica come la TV
(`PUT /leaderboard`: **4 righe**). Poi fotografa `version`, `status`,
`roundIndex`, `paused`, `hasState`, `scores`, `leaderboard` e `seq`. Il backend
viene ucciso con `kill -9` **subito dopo** la fotografia (0 ms di attesa) e
riavviato sullo stesso database; `verify` rilegge gli stessi campi.

| Prova | Segnale | Attesa prima del kill | Esito |
|---|---|---|---|
| **8 prove, revisione** | `kill -9` | **0 ms** | **8/8 identiche**: classifica 4 righe, 4 voti accettati, `RUNNING`, `roundIndex 1`, `seq 1`; recupero 5,0–5,7 s |
| Controprova 1–2, **database azzerato** | `kill -9` | 0 ms | **2/2 fallite**: `GET /state` → `401`, lo stesso sintomo di P1 |
| 7 prove, prima stesura | `kill -9` / `SIGTERM` | 0–6 s | 6 identiche, 1 con `401` |

**P1 declassata (falso positivo).** Il sintomo (token `401`, heartbeat
`410 session-unknown`, `CREATED`, `stateVersion 0`) si riproduce **solo** quando
tra il crash e il riavvio il database di prova viene azzerato: la partita non
esiste più, quindi il token non è valido e lo stato riparte da zero. Con il
database intatto non è mai comparso: 14 prove su 14, comprese 8 con kill
immediato e 4 voti già scritti. La prova 1 della prima stesura è quindi
coerente con un database ricreato o perso dall'ambiente di prova, non con una
perdita del backend. Resta un rischio teorico non misurato (la finestra di
flush di H2), ma non ha prove a favore: **non è un difetto P1**.

### 3.2 Disconnessione e rientro

`full-match` chiude e riapre la socket di Elena a metà serata (`elena-rejoin`) e
invia una risposta Timeline nel round successivo: `409` atteso, nessun doppio
punteggio. Nello soak da 40 round il rientro è avvenuto una volta e non ha
prodotto errori.

### 3.3 Riconnessione di tutti insieme, cambio rete, orologi sfasati

Non eseguiti in modo dedicato: richiedono un client che simuli 20–40 riavvii
simultanei, jitter di backoff e offset di orologio. Lo strumento di carico
attuale non li copre. Vedi §6.

---

## 4. Durata (soak)

`ROUNDS_MODE=serata`, **40 round reali**, 20 telefoni, bonus inclusi. Per non
occupare ore la durata del round è stata accorciata (`ROUND_MS=6000`,
`BONUS_MS=6000`): la scaletta e le transizioni sono quelle vere, il tempo per
round no.

| Voce | Inizio | Fine |
|---|---|---|
| Round completati | — | **40/40** |
| Azioni simulate | 0 | **2.475** |
| Errori degli handler | 0 | **0** |
| `403` attesi (giocatore sbagliato) | — | 2 |
| `409` (risposte fuori finestra/duplicate) | — | 407 |
| RSS del backend | 394 MB | **481 MB** |
| Thread | 48 | **88–89** |
| Righe di log | — | 212 |

La memoria cresce nella prima metà (riscaldamento heap) e si ferma a 481 MB
nelle ultime tre letture; i thread si assestano. **Non** si può concludere che
non ci sia perdita: la prova dura sei minuti, non una serata.

---

## 5. Soglie

| Soglia del piano | Misura | Esito |
|---|---|---|
| LAN 20 telefoni: p95 < 300 ms | **63,5 ms** (peggiore) | **rispettata** |
| LAN 40 telefoni: p95 < 300 ms | **243,6 ms** (JVM fredda, primo round) / 178,5 ms a caldo | rispettata, con margine ridotto a freddo |
| Zero risposte perse | 0 su 14 raffiche (4–40 telefoni) | **rispettata** |
| Zero doppi punteggi | nessun doppio accredito osservato | rispettata nelle prove possibili |
| Disconnessione 30 s: ripresa entro 5 s | non misurata (serve il client dedicato) | **da fare** |
| Riavvio backend: stato recuperato al 100% | **8/8** crash identici con classifica e voti; 2/2 falliscono solo azzerando il database | **rispettata** (P1 declassata) |
| Memoria stabile per tutta la partita | 394 → 481 MB in 6 min, plateau finale | parziale: serve una prova più lunga |
| Nessun errore non gestito nei log | 0 errori handler, 0 frame `ERROR` | **rispettata** |

---

## 6. Cosa resta da provare (e cosa non si può fare da script)

**Da fare con strumenti dedicati**

1. **Rete degradata** (300/1000 ms, jitter, 5–20% di perdita, banda bassa, DNS
   lento): serve `tc netem` o un proxy che ritarda/scarta; in questo ambiente non
   erano disponibili. La TV deve mostrare lo stato di connessione corretto.
2. **Riconnessione di massa** (thundering herd): 20–40 socket chiuse e riaperte
   nello stesso istante, backoff con jitter, nessuna squadra espulsa.
3. **Offset di orologio** dei telefoni (±5 min, ±2 s) e correzione con
   `serverNow` per Time Buzzer e flash dei giochi a tempo.
4. **Ripresa di ogni gioco e bonus** con telefono offline 5 s / 30 s / 2 min,
   con confronto `sinceSeq` e idempotenza della risposta ripetuta.
5. **Confronto punteggi server 4 vs 40** per Speed Rush, Quiz, Bomba, Timeline a
   parità di risposte (richiede che il simulatore replichi il voto della TV).
6. **Persistenza vera:** ricreare il container mantenendo il volume, ripristino
   da `scripts/backup-db.mjs`, disco pieno, database bloccato, due backend sullo
   stesso database, scrittura interrotta a metà.
7. **Tempo di gioco perso nel caso peggiore:** con H2 il write delay predefinito
   è 0,5 s. Dopo la revisione nessuna delle 8 prove con kill immediato ha perso
   nulla, nemmeno con 4 voti e una classifica appena scritti; il caso della
   prima stesura è risultato un database azzerato. Serve comunque una misura
   dedicata che uccida il processo **durante scritture continue** (non a fine
   sequenza): per ora il dato onesto è «nessuna perdita osservata su 8 crash»,
   non «persistenza garantita».

**Da provare in sala** (nessuno script può farlo; passi e risultato atteso in
`docs/PROVA-DEVICE-F02-F01-F13-F12.md`)

- iPhone/Safari in background e con schermo bloccato: sospensione, `bfcache`,
  ritorno all'app e stato della socket.
- Installazione PWA e aggiornamento del service worker.
- Vibrazione e suono reali sui telefoni.
- Wi-Fi del locale, roaming fra access point, perdita di segnale in fondo alla
  sala, telefono in modalità risparmio energetico.
- Ingresso dal QR con 20 telefoni in 10 secondi, codice di abbinamento sbagliato,
  stessa squadra da due telefoni, nome già preso, origine non ammessa e IP LAN
  diverso da `localhost`, HTTP e HTTPS.

---

## 7. Difetti trovati

| ID | Gravità | Difetto | Riproduzione | File coinvolti |
|---|---|---|---|---|
| P1 | ~~P1~~ **chiuso** | Falso positivo: il `401` con stato `CREATED` è comparso una volta nella prima stesura. Riprodotto **2/2 solo azzerando il database** tra crash e riavvio; **8/8 identico** con database intatto (4 voti e classifica già scritti, kill a 0 ms). | Controprova: `crash-loop.sh` con `WIPE_AFTER_KILL=1`; 401 immediato su `/state`. | `crash-loop.sh` (strumento di prova), non il backend |
| P2 | P2 | `GET /games/{id}/diagnostics` su una partita `CREATED` riporta `roundOpen: true` con `roundType: null`. | Creare una partita e chiamare `/diagnostics` prima di aprire un round. | `ReliabilityController.diagnostics` |
| P3 | P3 | Due test di loudness si saltano senza ffmpeg: la suite dichiara 703 test ma ne esegue 701 (anche in CI). | `npm run test:frontend` su una macchina senza `ffmpeg`. | `loop-loudness.spec.ts` |

Estratto della controprova con database azzerato (non un difetto del backend):

```text
GET /games/35/state           -> 401 Unauthorized
GET /games/35/sync?sinceSeq=-1 -> 401 Unauthorized
POST /games/35/session/heartbeat -> 410 {"action":"re-register","error":"session-unknown"}
GET /games/35/diagnostics     -> 200 {"stateVersion":0,"seq":0,"status":"CREATED","roundIndex":0,"roundType":null}
```

P2 e P3 restano aperti e non corretti, come da mandato. P1 è chiusa come falso
positivo con la prova sopra. Le righe di registro sono in
`docs/ROADMAP-POST-PRIMA-SERATA.md`.

---

## 8. Comandi

```bash
# backend isolato (porta 8091, database separato) — esempio
SERVER_PORT=8091 \
DB_URL='jdbc:h2:file:/tmp/pubgame-stress;DB_CLOSE_DELAY=-1' \
CONTROL_SECRET='<32+ caratteri di prova>' \
ALLOWED_ORIGINS='http://127.0.0.1:4200' \
java -jar apps/backend/target/pub_game_BE-2.3.1.jar

# carico: 4, 10, 20, 40 telefoni
API=http://127.0.0.1:8091 WS_URL=ws://127.0.0.1:8091/ws-pubgame \
CONTROL_SECRET='<stesso segreto>' PLAYERS=20 ROUNDS=3 npm run stress:ws

# crash e ripresa
API=http://127.0.0.1:8091 CONTROL_SECRET='<stesso segreto>' PLAYERS=4 \
npm run stress:restart start
# kill -9 del processo, riavvio, poi:
API=http://127.0.0.1:8091 npm run stress:restart verify
```
