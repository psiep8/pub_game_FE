# Stato del progetto

Ultimo aggiornamento: 6 novembre 2026.

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
- [x] **Tipi di gioco allineati al frontend**: QUIZ, IMAGE_BLUR, MUSIC, WHEEL_OF_FORTUNE,
      TIMELINE, BOMBA, SPEED_RUSH, AIR_HOCKEY, ARENA, TIME_BUZZER, BLACKJACK, SCOMMESSA,
      QUOTA. Chrono, Vero/Falso e Roulette non sono più round; il Cavallo è tornato bonus.
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

## ✅ Fatto (6 novembre)

- [x] Cavallo: TV solo countdown e tabellone continuo; domande sul telefono, 8 × 15 s.
- [x] Biglie: quattro gare da 30 s su un unico tracciato a scorrimento laterale, con
      camera sul leader, curve, dossi e scie per fondo; punti 150 / 100 / 60 / 30 cumulativi.
- [x] Avatar di squadra: foto da fotocamera o galleria, compressa a 192 px e mostrata
      nelle classifiche in TV.
- [x] Roulette: tick della pallina che rallentano e accento all'atterraggio.

## ⏳ In corso / da fare

- [ ] **QA dei round nuovi**: Cavallo (bonus dopo l'atto 3, 8 domande da 15 s con TV a
      countdown e tabellone), Scommessa (atto 4), Quota (atto 2) e Casino (quattro manche
      in un solo bonus, dopo l'atto 1). Compilati, mai visti dal vivo.
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
