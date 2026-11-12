# Changelog

Tutte le modifiche rilevanti di PubGame. Formato basato su Keep a Changelog,
versione SemVer.

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
