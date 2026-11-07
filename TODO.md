# Stato del progetto

> **VERSIONE BETA — snapshot del 7 novembre 2026.**
> Il file fotografa il progetto **così com'è adesso**, prima del refactoring della
> prossima versione. Le voci qui sotto sono lo stato attuale, non il piano della
> versione nuova.

Ultimo aggiornamento: 7 novembre 2026 (beta).

## Versione beta: cosa contiene

- Frontend Angular 22 (`/tv`, `/play`, `/admin`) + backend Spring Boot 4.1 in un monorepo.
- 40 round in 5 atti da 8; classifica rapida ai round 4/12/20/28/36, dettagliata a 8/16/24/32/40.
- Bonus dopo gli atti 1-4: Casino, Basket, Cavallo di Battaglia, Biglie.
- Banca domande pre-generata in JSON (`questions/questions-it.json`): nessuna chiamata AI a runtime.
- Database H2 su file: squadre, round, risposte e punteggi sopravvivono al riavvio.
- Configurazione locale in un solo `.env` (porte, host, chiavi opzionali); API e WebSocket
  sempre sulla propria origine, quindi localhost, LAN e tunnel funzionano senza toccare il codice.

## Prossima versione — modifiche da annotare

Il dettaglio sta in **`BRIEF-REFACTOR-GIOCHI.md`**: sezioni indipendenti, si procede un gioco
alla volta. Ordine indicato nel brief: prima la banca domande, poi il refactor del progetto,
poi i giochi.

### 0. Effetti sonori sulla TV
- [ ] Spostare i suoni di conferma dal telefono alla TV come effetti da bar: gettoni, applauso,
      "uuuh" sugli errori, rullo prima delle rivelazioni, sirena per le bombe.
- [ ] Sul telefono resta al massimo una vibrazione breve.

### 1. Refactor del progetto
- [x] Pulizia del codice morto: `CHRONO` e `TRUE_FALSE` non erano già più in `GameType`; tutte le
      modalità di `GameModeType` sono in uso. Rimosso il gioco dei prezzi (endpoint
      `/price-answer` e `/price/reveal`, logica nel servizio, banca `price-it.json`, UI e stili sul
      telefono): −782 righe.
- [x] Enum in `shared/enums/`: `GamePhase`, `GameModeType`, `BonusType`, `PlayerStatus`,
      `WsAction`. Sono oggetti `as const` (non `enum` TS) così i valori restano le stringhe che
      arrivano dal server e i confronti esistenti compilano senza cast.
- [x] Adozione completata: `WsAction` in TV, admin, telefono e modalità; `PlayerStatus` sul
      telefono; fasi locali come oggetti `as const` in cavallo, biglie, casino, scommessa, quota e
      blackjack, con le fasi comuni ereditate da `GamePhase`; confronti `REVEAL`/`FINALE` convertiti
      in `game-component`, nelle TV di quota/scommessa/blackjack e nel modello del round.
      Fuori da `shared/enums` non resta nessun letterale `'REVEAL'`/`'FINALE'`; i `'WAITING'` e
      `'PLAYING'` ancora presenti sono union di stato (admin, Blackjack, Scommessa, basket legacy),
      non fasi, e vanno convertiti con i rispettivi enum di stato in un passo a parte.
- [x] Nomi dei file: ogni componente in `*.component.ts` (26 componenti, con `html`/`css`/`spec`
      allineati) e route lazy con `loadComponent`: TV, telefono, admin, basket e bonus-preview
      arrivano in chunk separati.
- [x] `OnPush` su tutti i 26 componenti (prima 24 usavano `ChangeDetectionStrategy.Eager`, uno era
      già `OnPush`), con build verde e prova in locale: lobby TV, demo di un round, avvio di un round
      vero dall'admin, telefono `/play` e `/basket`.
- [x] `inject()` anche nelle due guard, in `AiGeneratorService` e in `ImageBlur` (gli altri
      costruttori non hanno dipendenze da iniettare). Ultimo `*ngIf` della TV convertito a `@if`:
      in `src/app` non restano `*ngIf`, `*ngFor` né `ngSwitch`.
- [x] Cartelle `core/` · `shared/` · `features/` (`tv`, `remote`, `admin`, `games/<gioco>`,
      `bonus/<bonus>`), con modalità e componente TV dello stesso gioco nella stessa cartella.
      Spostamenti fatti con `git mv` in tre blocchi (core/shared, features TV/telefono/admin,
      giochi/bonus) e import relativi riscritti a ogni blocco, con build verde alla fine di
      ciascuno. I nomi dei file non sono ancora allineati a `*.component.ts` (passo a parte).
- [ ] Un passo alla volta, con build e test verdi tra uno e l'altro.

### 2. Indovina chi
- [ ] Durata 90 s con schiarimento proporzionato a gradini lungo tutta la durata.
- [ ] Indizio in TV ogni ~15 s (film, carriera, curiosità), 5-6 per personaggio dal più vago al più facile.
- [ ] Banca da 6 a ≥ 60 personaggi, ciascuno con immagine e indizi.

### 3. Ruota della Fortuna
- [x] Estrazione guidata: il mazzo alterna lettere presenti nella frase e lettere casuali; nelle
      prime 3 uscite sempre una vocale e una lettera ripetuta; poi 1 su 3 tra le più presenti
      (`wheel-letter-deck.ts`, con test).

### 4. Time Buzzer
- [x] Partenza automatica per tutti: `TIME_BUZZER_START` dal server dopo il 3-2-1 in TV.
- [x] Tempo misurato con `performance.now()` dal segnale al tocco di STOP, validato dal server;
      3 manche in round (il brief ne prevedeva 5) con bersagli casuali sotto i 30 s, al centesimo.

### 5. Bomba (nuova logica, stile "Scossa")
- [x] Una domanda con `2n + n/2` opzioni quasi tutte vere e una bomba ogni tre squadre
      (10 opzioni/1 bomba con 4, 15/2 con 6, 20/3 con 8); telefono con la lista a pulsanti.
- [x] Turni in ordine, una squadra alla volta: la scelta passa al prossimo sia se la casella è
      vera sia se è una bomba.
- [x] −200 punti per bomba presa (mai sotto zero) e squadra fuori dal round; bombe mai scelte
      disarmate e mostrate a fine round.

### 6. Speed Rush — nuove microprove
- [x] Mazzo senza ripetizioni consecutive: matematica con 3 pulsanti, miscuglio colori (due primari
      da scegliere), bandiera con due nomi, sinonimi/contrari, traduzione (`speed-rush-deck.ts`,
      con test). Il telefono pesca dal mazzo e non ripete mai lo stesso tipo due volte di fila.

### 7. Blackjack
- [ ] Puntata 100/200/300 punti reali (mai sotto zero), naturale paga il doppio.
- [ ] Mano della squadra di turno in TV accanto al banco, con effetti da bar (gettoni, "CARTA!", "LASCIA!").
- [ ] Prima verificare dove vive il blackjack oggi (manche del bonus Casino o round) e uniformare `BonusType`.

### 8. Quota → "Azzardo"
- [ ] Tre volte in serata con difficoltà crescente (facile/media, media, difficile), 4 manche:
      celebrità, canzone, nazione, evento storico; 4 opzioni molto vicine.
- [ ] Puntata 100/200/300, vincita × quota (2 / 3 / 4), perdita con moltiplicatore 100 → 80 → 60 → 40%,
      mai sotto zero.
- [ ] Banca ≥ 30 domande per categoria e livello.

### 9. Scommessa → "Tutto o metà"
- [ ] 5 round, livelli 100-500 usabili una sola volta per squadra; domanda uguale per chi sceglie
      lo stesso livello; giusta +valore, sbagliata o scaduta −metà.
- [ ] Domande a 5 livelli per ogni categoria, almeno 4 per livello.

### 10. Biglie
- [ ] Percorso con più curve, tornanti e bivi doppi; la gara resta decisa dal seme e poi riprodotta.

### 11. Trasversale
- [ ] Banca domande prima di tutto: Vero/Falso, 3 opzioni per Bomba, numeriche per Azzardo,
      5 livelli per Tutto o metà, 60 personaggi, parole inglesi, bandiere.
- [ ] Un solo `scoring-rules.ts` per punteggi e durate.
- [ ] Prova completa con 8-10 telefoni prima di aggiungere altro.

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
