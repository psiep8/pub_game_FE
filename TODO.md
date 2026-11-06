# Stato del progetto

Ultimo aggiornamento: 4 novembre 2026.

## ✅ Fatto (backend)

- [x] **Arena con domanda diversa per dispositivo**: `GET /games/{id}/arena-question?playerId=...`
      assegna la domanda al telefono e la segna come uscita.
- [x] **Nessuna domanda ripetuta**: deduplica per testo normalizzato e per risposta
      (`QuestionHistoryService`), sia in arena sia nei round normali.
- [x] **Esito deciso dal server**: `POST /games/{id}/arena-answer` valida la risposta,
      rifiuta la domanda di un altro giocatore, aggiorna il punteggio.
- [x] **Pool per round**: `GET /games/{id}/arena/prepare?category=&count=` riempie il pool,
      i telefoni pescano senza chiamare niente. `POST /games/{id}/arena/reset` azzera tutto.
- [x] **Groq eliminato dal runtime**: le domande vengono da `questions/questions-it.json`
      (`QuestionBankService`). Rimossi `QuestionGeneratorService` (tutto il codice AI) e
      `CelebrityImageService` (chiave Pexels hardcoded); `groq:` tolta dalle config.
- [x] **Round classico riparato**: `POST /games/{id}/round` rispondeva 500 perché la tabella
      `questions` nasce vuota; ora pesca dalla banca.
- [x] **9 tipi di gioco verificati**: QUIZ, TRUE_FALSE, CHRONO, IMAGE_BLUR, MUSIC, ROULETTE,
      WHEEL_OF_FORTUNE, SCREAM_RACE, ARENA.
- [x] **Gara di urla per partita**: stato e reset separati per `gameId` (prima due tavoli si
      mescolavano).
- [x] **WebSocket non rimbalza più l'esito del telefono**: passano solo `playerName`,
      `questionId`, `answerIndex`, `responseTimeMs`.
- [x] **CORS**: credenziali disattivate, così la wildcard non è un buco.
- [x] **Avvisi all'avvio**: log della banca + warning per categorie sotto le 8 domande
      giocabili in arena.

## ✅ Fatto (strumenti per l'altra macchina)

- [x] `scripts/generate-questions/generate.py` — genera la banca in JSON, valida, deduplica,
      `--merge` per aggiungere. Parla con Groq **o con un modello locale** (`--base-url`,
      Qwen su Ollama/LM Studio, nessuna chiave), tollera i recinti markdown, non azzera la
      banca se non raccoglie niente.
- [x] `scripts/generate-questions/generate_media.py` — scarica anteprime iTunes e foto dei
      personaggi (TMDB o Wikipedia) e le mette in `resources/static/media`.
- [x] `scripts/generate-questions/README.md` — procedura completa, incluse le sezioni per il
      modello locale (Qwen) e per la banca media.
- [x] `scripts/checks/arena_check.py` e `scripts/checks/rounds_check.py` — verifiche live.
- [x] `scripts/checks/simulate_arena.py` — simula N telefoni in parallelo (nessun telefono
      vero necessario): domande distinte sotto concorrenza, esiti e punteggi.
- [x] `GET /games/{id}/arena/scores` — punteggi dell'arena calcolati dal server.

## ✅ Fatto (frontend, minimo indispensabile)

- [x] `getArenaQuestion` passa `playerId` (prima tutti i telefoni erano `anonimo`).
- [x] La risposta passa da `POST /arena-answer` e l'esito dell'antenna è quello del server,
      non più calcolato sul telefono.
- [x] Rimossa la "domanda di riserva" locale: senza `questionId` non si può validare.

## ⏳ In corso / da fare

- [ ] **QA dei round nuovi**: Cavallo (atti 1 e 5), Scommessa (atto 4) e bonus Casino
      spalmato su quattro atti. Compilati, mai visti dal vivo.
- [ ] **Generare la banca vera sull'altra macchina** (Qwen locale, `--per-category 40`),
      copiare `questions-it.json`, controllare il log d'avvio
      che nessuna categoria abbia il warning, poi lanciare `arena_check.py` e
      `rounds_check.py` con 12 telefoni.
- [ ] **Banca media** sull'altra macchina: `python generate_media.py --count-music 24 --count-people 40`,
      poi copiare `static/media/` e `questions/media-it.json` sulla macchina che proietta.
- [ ] **Prova a più telefoni** in aria: 8-10 dispositivi, verificare che nessuno veda la
      domanda di un altro e che i punteggi in TV corrispondano.
- [ ] **Copertine album in locale**: `albumCover` punta ancora a un URL Apple.
- [ ] **Punteggio arena sulla TV letto dal server**: oggi la TV lo ricava dal messaggio del
      telefono (che ora riporta la verità del server, ma resta un dato del client).
- [ ] **Flag `--offline`** per vietare del tutto iTunes/TMDB quando la banca media c'è.

## Note utili

- Il database H2 in memoria basta: le domande non stanno più nel DB.
- `TMDB_API_KEY` serve solo a migliorare le foto di IMAGE_BLUR (e a generarle).
- Build backend: `cd apps/backend && ./mvnw -B clean package` (serve JDK 25).
- Build frontend: `cd apps/frontend && npm run build`.

## Come provare (tutto dall'altra macchina)

- Backend: `cd apps/backend && ./mvnw -B clean package` (serve JDK 25).
- N telefoni simulati in parallelo: `python scripts/checks/simulate_arena.py http://<ip>:8080 10 3 --prepare`
- Verifiche puntuali: `python scripts/checks/arena_check.py <url> <categoria> <n>` e `python scripts/checks/rounds_check.py <url>`.
- Con 10 dispositivi e 3 round servono almeno 30 domande giocabili (QUIZ + VERO/FALSO) nella banca.
