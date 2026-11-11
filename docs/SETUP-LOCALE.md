# PubGame: installazione e configurazione in locale

Guida per far girare il gioco su un computer, per una serata tra amici (PC collegato alla TV con HDMI, oppure browser della TV) o per un locale. I comandi sono quelli del repository (versione 1.0.0). I numeri su hardware e telefoni sono **indicazioni prudenti**, non limiti verificati: la prova con i telefoni veri resta il controllo finale.

## 1. Quale modo scegliere

| Modo | Cosa serve sul computer | Quando |
|---|---|---|
| **A. Docker** (consigliato) | Solo Docker | Serata tra amici o locale: un solo comando, nessuna installazione di Node o Java |
| **B. Sviluppo** (`npm run dev`) | Node.js, JDK 25, npm | Per chi modifica il codice |

Nel modo A frontend, API e WebSocket stanno in un solo container sulla porta 8080: la TV e i telefoni aprono lo stesso indirizzo.

## 2. Cosa serve (requisiti)

**Il computer che fa da server e da TV** (un solo PC può fare tutto: server, TV e pannello di regia)

- Windows 10/11, macOS o Linux, 64 bit.
- 4 GB di RAM liberi (il server ne usa circa 1–2) e un processore di 4 anni o meno: indicazione, il gioco usa animazioni e fisica sulla TV.
- Uscita HDMI (o USB-C con video) per la TV, e **cavo di rete** al router se possibile.
- Alimentatore collegato per tutta la serata; sospensione e salvaschermo disattivati.
- Browser aggiornato: Chrome o Edge consigliati. Per la TV: schermo intero (tasto F11).

**La TV**

- Qualunque TV con ingresso HDMI collegata al PC: è la soluzione più sicura.
- Il browser integrato di una smart TV o di una chiavetta (Android TV, Fire Stick) può funzionare, ma le animazioni e la fisica possono andare a scatti: provarlo prima. In quel caso il PC resta il server e la TV apre l'indirizzo `/tv`.
- Per l'audio: dall'uscita HDMI della TV o da casse collegate al PC.

**I telefoni** (uno per squadra, 4–10 squadre consigliate)

- iPhone con Safari o Android con Chrome, usciti negli ultimi 5–6 anni (indicazione).
- Browser aggiornato, fotocamera permessa se si vuole la foto della squadra, volume non necessario.
- Alcuni giochi usano la vibrazione: su iPhone Safari non è supportata e la prova dei pulsanti lo segnala.

**La rete**

- Il PC e tutti i telefoni devono stare **nella stessa rete locale** (stesso Wi-Fi).
- Il Wi-Fi di un locale pubblico spesso blocca la comunicazione tra dispositivi (isolamento client) o chiede un accesso: in quel caso serve un router tuo (anche economico) oppure il tunnel (sezione 8).
- Per una serata tra amici va bene il Wi-Fi di casa, con il PC su cavo.
- Internet non è necessario per le domande, ma senza la banca media locale il backend usa iTunes per la musica e TMDB/Wikipedia per le foto: per una serata offline completa genera o copia prima la banca media. In alternativa servono internet e le chiavi opzionali, altrimenti audio e immagini possono restare vuoti.

## 3. Modo A: Docker

### 3.1 Installare Docker

- **Windows e macOS:** installare Docker Desktop (con WSL 2 su Windows) e avviarlo.
- **Linux:** installare Docker Engine con Compose v2.

### 3.2 Configurare

Dalla cartella del progetto:

```bash
cp deploy/.env.test.example deploy/.env
```

Genera un segreto di regia di almeno 32 caratteri casuali (serve per entrare in `/tv` e `/admin`; non darlo ai giocatori):

```bash
openssl rand -hex 32
```

Se non hai `openssl` (Windows): `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

Apri `deploy/.env` e incolla il valore in `CONTROL_SECRET=`. Il compose di prova imposta `ALLOWED_ORIGINS=*`, quindi i telefoni della rete locale possono collegarsi senza elencare ogni IP; è una configurazione da prova, non da pub.

Se la porta 8080 è occupata aggiungi `TEST_PORT=18080` e usa quel numero negli indirizzi.

### 3.3 Avviare

```bash
docker compose -f deploy/docker-compose.test.yml --env-file deploy/.env up -d --build
```

La prima volta può impiegare alcuni minuti. Poi:

- TV (sul PC): `http://localhost:8080/tv`
- Regia: `http://localhost:8080/admin` (dal PC o da un telefono con il segreto)
- Telefoni: inquadrano il QR della TV, oppure `http://<IP-del-PC>:8080/play`

Fermare: `docker compose -f deploy/docker-compose.test.yml --env-file deploy/.env down`. I dati (squadre, punteggi) restano nel volume Docker e sopravvivono al riavvio.

### 3.4 Trovare l'IP del PC

- **Windows:** `ipconfig` → “Indirizzo IPv4” della rete in uso.
- **macOS:** `ipconfig getifaddr en0` (o `en1`).
- **Linux:** `hostname -I`.

Usa l'indirizzo con **il browser della TV aperto sull'IP e non su `localhost`**, altrimenti il QR punterebbe a `localhost` e i telefoni non si collegherebbero.

## 4. Modo B: sviluppo con npm

Requisiti: **Node.js 22.22 o superiore** (o 24.15+) con **npm 11**, e **JDK 25**.

```bash
npm install
cp .env.example .env      # compila CONTROL_SECRET (almeno 32 caratteri casuali)
npm run dev
```

In `.env` imposta anche `ALLOWED_ORIGINS` con l'origine esatta con cui apri il gioco dai telefoni (per esempio `http://192.168.1.20:4200`, con protocollo e porta), oltre a localhost. Senza questa voce i telefoni possono essere rifiutati.

All'avvio lo script stampa l'indirizzo del PC e quello del telefono. Porte predefinite: frontend 4200, backend 8080 (`FE_PORT`, `BE_PORT`, `HOST` in `.env`).

## 5. Serata tra amici: scenari

**Scenario 1: PC con cavo HDMI alla TV (il più semplice)**

1. Collega il PC alla TV con l'HDMI; imposta la TV sull'ingresso giusto e il PC su “Estendi” o “Duplica”.
2. Avvia il gioco (modo A) e apri `http://<IP-del-PC>:8080/tv` nel browser, a schermo intero.
3. Inserisci il segreto di regia quando richiesto.
4. I telefoni inquadrano il QR.
5. L'admin si può usare da un secondo schermo o da un telefono (`/admin`).

**Scenario 2: PC in un'altra stanza, TV con browser**

1. Il PC resta il server (modo A).
2. Il browser della TV apre `http://<IP-del-PC>:8080/tv`.
3. Se la TV va a scatti, passare allo scenario 1 o usare “Trasmetti” da Chrome (ritardo possibile).

**Scenario 3: solo un portatile**

Il portatile fa server, TV (con HDMI) e admin; i telefoni sul tuo Wi-Fi.

## 6. Prima della serata: prova di 10 minuti

1. Avvia tutto e apri la TV a schermo intero: la home mostra il QR grande.
2. Collega almeno 2–3 telefoni (meglio quanti sarete) e fai la prova dei pulsanti.
3. Avvia un round di Quiz e uno di un gioco con trascinamento (Timeline).
4. Chiudi un telefono e riaprilo a metà round: deve ritrovare lo stato.
5. Controlla volume, schermo intero e disattivazione della sospensione.
6. Annota l'indirizzo e il segreto di regia.

## 7. Problemi frequenti

| Sintomo | Causa probabile | Cosa fare |
|---|---|---|
| Il telefono non apre la pagina | Rete diversa o isolamento client | Stesso Wi-Fi; provare con router proprio o hotspot |
| Il QR porta a `localhost` | La TV è aperta su `localhost` | Aprire la TV sull'IP del PC |
| Il telefono dice “non autorizzato” | `ALLOWED_ORIGINS` non include l'indirizzo (modo B) | Aggiungere l'origine e riavviare |
| `/tv` o `/admin` chiedono il segreto e non entrano | `CONTROL_SECRET` mancante o troppo corto | Almeno 32 caratteri, riavviare |
| Porta occupata | Un altro programma usa la 8080 | `TEST_PORT` (Docker) o `BE_PORT` (npm) |
| Windows non risponde ai telefoni | Firewall | Consentire la porta 8080 (reti private) |
| Animazioni a scatti sulla TV | Hardware debole | Usare il PC con HDMI, chiudere altri programmi |
| Telefono si “spegne” e perde il gioco | Schermo bloccato | Disattivare il blocco automatico; al ritorno si riallinea da solo |

## 8. Limiti e alternative

- Senza HTTPS (rete locale in HTTP) i telefoni **non possono installare la scorciatoia PWA** e alcune funzioni del browser (per esempio il blocco dello spegnimento) non sono disponibili. Il gioco funziona lo stesso.
- Per HTTPS: tunnel Cloudflare (`apps/frontend/start-tunnel.sh` o `.ps1`) o servizio con dominio (`deploy/README.md`). Il tunnel dipende da internet.
- Sicurezza: non esporre `/admin` a internet senza il segreto di regia; non condividere il segreto con i giocatori.
- **Speed Rush** è bloccato in serata reale: `startNewRound()` mostra un avviso e la scaletta si ferma quando raggiunge quel round, perché il punteggio non è ancora verificato dal server. È disponibile solo in simulazione (`?sim=1`).
- **Bonus Basket** è bloccato fuori da simulazione e anteprima: il tabellone si può vedere in demo, ma il punteggio non è ancora verificato dal server.
- I bonus mostrano una classifica propria ma **non assegnano punti alla classifica della serata**.
- **Banca media locale**: musica, copertine e volti non sono nel repository (`.gitignore` esclude `static/media/` e `questions/media-it.json`). Per giocare offline vanno generati con `python scripts/generate-questions/generate_media.py --from-azzardo` o copiati prima della build; senza, il backend usa iTunes/TMDB/Wikipedia e, se manca la rete, audio e immagini possono restare vuoti.
- Per una serata completa in locale servono le correzioni descritte nella roadmap del README; non forzare l'avanzamento oltre Speed Rush per aggirare il blocco.

## 9. Dove trovare il resto

- Panoramica, giochi, architettura e stato del progetto: [`README.md`](../README.md).
- Tunnel, dominio, Vercel, PWA e backup: [`DEPLOYMENT.md`](DEPLOYMENT.md).
- Container unico e varianti di deploy: [`deploy/README.md`](../deploy/README.md).
