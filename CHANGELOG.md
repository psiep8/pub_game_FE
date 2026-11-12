# Changelog

Tutte le modifiche rilevanti di PubGame. Formato basato su Keep a Changelog,
versione SemVer.

## [2.0.1] — 2026-11-12

Patch: codice di abbinamento per la regia, ripresa del Blackjack dopo il refresh
della TV e aggiornamento minor delle dipendenze Angular. Documentazione del pannello
admin e del telefono.

### Aggiunto

- Codice di abbinamento regia a 6 cifre: scade dopo 5 minuti, si usa una volta sola
  e blocca il tentativo per 1 minuto dopo 5 errori.
- Ripresa del Blackjack: la TV salva la mano sul server a ogni cambio fase e, dopo
  un refresh nella stessa fase, la riprende.
- `docs/PANNELLO-ADMIN.md`: guida ai pulsanti e alle decisioni del pannello admin.
- `docs/MANUALE-TELEFONO.md`: guida per le squadre.
- `docs/PRESENTATORE.md`: guida operativa di chi conduce — schermi, abbinamento
  della regia, pre-volo, un round passo per passo, giochi simultanei,
  imprevisti e chiusura.

### Modificato

- Dipendenze Angular aggiornate alle ultime minor 22.2.x (CLI e build 22.2.7,
  TypeScript 6.0.3). Nessun cambio di major. `npm audit`: 0 vulnerabilità.
- `PRESENTAZIONE-PUBGAME.md`: etichette dei pulsanti admin allineate al pannello
  reale (PARTI, PROSSIMA MANCHE, DEMO, CHIUDI BONUS).
- Punteggi del copione allineati a `SCORING_RULES` (Quiz, Musica, Timeline,
  Bomba, Speed Rush, Cavallo) e nota esplicita che Speed Rush e Bonus Basket
  sono bloccati in serata reale e che i bonus non entrano in classifica.
- `MANUALE-TELEFONO.md` corretto sul flusso vero: niente codice a 6 cifre sul
  telefono (è della regia), ingresso con QR e nome squadra.

### Corretto

- Pannello admin senza codice TV: l'avvio si fermava e sembrava il backend spento.
  Ora compare il riquadro **🔒 REGIA NON ABBINATA** con campo a 6 cifre e pulsante
  **ABBINA REGIA**, mentre diagnostica e categorie si caricano lo stesso.
- La View Transition del primo caricamento non viene più avviata: spariva un
  `InvalidStateError` in console a ogni apertura di TV, admin e telefono.
- Skin carta e inchiostro per categorie, diagnostica e comandi del pannello
  admin: via i riquadri blu/viola, i raggi 8–14px e le pillole del vecchio tema.
- Telefono: i tasti di Speed Rush non sono più bianco su bianco, la mano di
  Blackjack e il goal di Air Hockey usano i token della palette.
- Versione **2.0.1** su `VERSION`, root, frontend e backend; README allineato a
  29 spec frontend e 18 classi di test backend.

## [2.0.0] — 2026-11-12

Seconda major: la serata si prepara e si controlla prima di accendere la TV. Il
audio non lascia più code accese, i telefoni si riagganciano appena tornano
visibili e il repository tiene solo il codice.

### Aggiunto

- `GET /health`: sonda di salute senza autenticazione, per Docker e per il
  controllo a freddo prima di una serata.
- `docs/SERATA-PROVA.md`: programma della prima serata con telefoni veri (ruoli,
  tempi, prove di caduta, cosa annotare, emergenze).
- `docs/FIX-PRE-SERATA.md`: ordine delle fix prima e dopo la serata, con criteri
  di accettazione.
- Riconnessione immediata su `visibilitychange` e `online`: telefono sbloccato o
  Wi-Fi tornato, la socket riparte senza aspettare il backoff.
- Prima CI (`.github/workflows/ci.yml`): build e test frontend, test backend e
  simulazione corta con 8 giocatori, su ogni push.
- `HEALTHCHECK` nel `docker-compose.yml` e tag immagine da `PUBGAME_TAG`, per
  tornare alla versione precedente con un comando.
- `npm run db:backup`: copia il database in `backups/` con data e ora (cartella
  fuori dal repository).
- `ROUNDS_MODE=serata` nel pilota di simulazione: gioca i 40 round nell'ordine
  vero di `ACT_DECKS`, non più i 13 di esercitazione.
- Se `ALLOWED_ORIGINS` contiene `*` il backend lo segnala a `WARN` all'avvio.

### Corretto

- Il clock della TV non somma più intervalli: `startClock()` spegne il tick
  precedente, quindi il ticchettio non resta acceso per tutta la serata.
- La pausa ferma davvero clock e battito; la ripresa li riapre nella stessa
  fase.
- Rimossi sette file mp3 identici e mai referenziati (600 KB di doppioni):
  l'audio resta interamente sintetizzato.

### Cambiato

- I report e i log delle simulazioni (`scripts/sim/reports/`) **escono dal
  repository** (~13 MB): restano su disco, la history passata non è riscritta.
- Versione **2.0.0** su root, frontend e backend; README aggiornato con le
  sezioni Audio e Serata di prova.

## [1.0.0] — 2026-11-09

Prima major: la serata si recupera dopo un refresh e gli ambienti di prova e
pub sono separati.

### Aggiunto

- Recupero della TV dopo refresh o cambio dispositivo: `GET /games/active`,
  snapshot autorevole della classifica (`PUT /games/{id}/leaderboard`) e
  pannello "Round ripristinabile" con ripresa per Timeline e chiusura esplicita
  per gli altri giochi.
- Persistenza della classifica con debounce, retry e `keepalive` alla chiusura
  della scheda.
- Ambienti `test-night` e `production`: build Angular con file replacement,
  profili Spring Boot dedicati e modelli `.env.*.example`.
- QR di aggancio generato in locale e legato all'ID della partita. Il telefono
  legge `?game=` e, senza QR, chiede al server la partita attiva.
- PWA installabile su iPhone e Android: manifest con `id`, orientamento
  verticale e service worker attivo anche nella build di produzione.
- `docs/DEPLOYMENT.md`: flusso serata di prova, produzione, hosting, dominio,
  PWA, backup e checklist.

### Corretto

- La TV non sovrascrive più i punti locali non ancora confermati dal server.
- Il QR non dipende più da `api.qrserver.com`: funziona senza internet.
- Speed Rush resta bloccato finché il punteggio non è verificato dal server.

### Note

- Richiede `CONTROL_SECRET` (almeno 32 caratteri) e `ALLOWED_ORIGINS` esatte.
- Backup di `apps/backend/data` prima di aggiornare una serata in corso.
