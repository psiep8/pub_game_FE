# Lavori in corso — pub_game_FE

> **VERSIONE BETA — snapshot del 7 novembre 2026.**
> Il file racconta lo stato del progetto **così com'è ora**, prima del refactoring della
> prossima versione: le modifiche in arrivo sono in `BRIEF-REFACTOR-GIOCHI.md` e annotate
> in `TODO.md`. Se una riga non combacia col codice, vince il codice.

Ultimo aggiornamento: 7 novembre 2026 (beta)
Ultimo commit: 6 novembre — scaletta a 5 atti, Cavallo tornato bonus, Scommessa e Quota round veri, pulizia di Chrono/Vero-Falso/Roulette. I commit precedenti sono del 5 novembre.

---

## Cosa è cambiato il 6 novembre

### Scaletta: il Cavallo torna bonus, dentro Quiz e Time Buzzer
- `ACT_DECKS` aggiornata come da descrizione: il Cavallo non è più un round, al suo posto l'atto 1 chiude con un Quiz e l'atto 5 usa il Time Buzzer.
- Quota non è ancora implementata: il sesto round dell'atto 2 resta la Bomba finché la modalità non esiste.
- `BonusType` contiene `CASINO` (atto 1), `CAVALLO` (atto 3) e `BIGLIE` (atto 4), più `BASKET`. Il Black Jack non è più un bonus: è diventato un round a turni.

| Atto | Round | Sequenza |
| --- | --- | --- |
| 1 | 1–8 | Quiz · Musica · Bomba · Indovina chi · Timeline · Ruota · Quiz · Speed Rush |
| 2 | 9–16 | Quiz · Indovina chi · Timeline · Arena · Musica · Quota · Time Buzzer · Air Hockey |
| 3 | 17–24 | Quiz · Bomba · Timeline · Speed Rush · Musica · Air Hockey · Ruota · Arena |
| 4 | 25–32 | Indovina chi · Quiz · Bomba · Musica · Time Buzzer · Timeline · Scommessa · Speed Rush |
| 5 | 33–40 | Ruota · Quiz · Bomba · Time Buzzer · Timeline · Air Hockey · Musica · Arena |

### Casino: quattro manche in un solo bonus

| Dopo l'atto | Bonus |
| --- | --- |
| 1 | Casino (colore, dozzina, sestina, numero secco) |
| 2 | Basket |
| 3 | Cavallo di Battaglia |
| 4 | Biglie |
| 5 | nessuno, classifica finale |

`CasinoBonus` fa girare **quattro manche a difficoltà crescente**: colore (2 caselle, 100 punti), dozzina (3, 150), sestina (6, 200), numero secco (37, 300). Ogni manche si chiude con un giro della **roulette vera in TV**: ruota europea a 37 caselle nell'ordine reale, pallina lanciata sul bordo, orbita, discesa, rimbalzi sui vani e atterraggio. Il numero esce sul componente TV quando chiudono le puntate e l'animazione è calcolata per atterrare lì: il punto pagato è sempre il numero che si vede. Sullo zero il banco incassa e nessuno prende punti. Sul **numero secco** la manche deve avere almeno un vincitore: se il numero uscito non è stato puntato da nessun tavolo, la ruota rigira (dopo quindici giri senza fortuna il numero viene scelto tra quelli giocati, per garantire la regola). TV e telefono usano **una sola griglia**: cambia solo l'elenco delle caselle. Niente più Black Jack nel bonus: è un round.

### Bonus biglie (atto 4)
- Nuovo `bonus/biglie-bonus/biglie-bonus.ts` (classe `BiglieBonus`, selector `app-biglie-bonus`): quattro gare da 30 secondi su un unico tracciato a scorrimento laterale, con curve, dossi e camera agganciata al leader; i fondi sono terra, asfalto, neve e acqua.
- Una biglia per tavolo, tutte diverse. La scelta si fa una volta sola in ordine sorteggiato, 10 s per tavolo; allo scadere il sistema assegna la prima biglia libera.
- Punti cumulativi 150 / 100 / 60 / 30 a gara (massimo 600). Ogni biglia ha un profilo velocità / accelerazione / tenuta e ogni fondo ne premia uno diverso, quindi nessuna biglia domina tutte e quattro le gare.
- TV su `BIGLIE_STATE`, telefono su `BIGLIE_ACTION`. Parte da solo dopo l'atto 4 o dal pulsante `BONUS BIGLIE` in admin.

### Cavallo di Battaglia torna bonus
- Ripristinato `bonus/cavallo-bonus/cavallo-bonus.ts` (classe `CavalloBonus`, selector `app-cavallo-bonus`): categoria votata dai telefoni, otto domande, podio bonus.
- Eliminati `mode/cavallo.mode.ts` e `games/cavallo/cavallo.ts`; il Cavallo non è più in `GameModeType`, nella factory né in `GameType`.
- Si lancia dall'admin (`BONUS CAVALLO`) e parte da solo dopo l'atto 3; il backend non ha più un tipo di round dedicato.

### Codice ripulito: via Chrono, Vero/Falso e Roulette round
- Rimossa la modalità singola Chrono e Vero/Falso da frontend e backend (`GameModeType`, `GameType`, `QuestionGeneratorService`). Il Vero/Falso resta solo come tipo di domanda della banca usato da Arena e Cavallo, che non sono state toccate.
- La Roulette non è più un round vero: eliminati `mode/roulette.mode.ts`, `games/roulette/*`, i rami in TV/remote/admin, i punti in `scoring-rules.ts`, la demo e tutti gli stili (`app-roulette`, `roulette-grid`, `color-btn`). Restano i bonus Roulette Colorata e Numerata dentro `CasinoBonus`.
- Rimosso `startBonusRound()` da `RoundManagerService`: non aveva più chiamanti.
- Il Cavallo è tornato nel file bonus: `bonus/cavallo-bonus/cavallo-bonus.ts` (classe `CavalloBonus`). Il giro come round (`mode/cavallo.mode.ts`, `games/cavallo/cavallo.ts`) è stato rimosso con import, template e tipo backend.
- Script allineati: `rounds_check.py`, `live_devices_check.js`, `generate.py` e `merge_domande.py` non gestiscono più Chrono e Roulette.

### La Scommessa (tre domande con incasso)
- Struttura: puntata 10 s → 3 domande da 12 s con reveal 6 s → dopo la prima e la seconda, 8 s per INCASSARE o RISCHIARE → finale 7 s.
- La banca parte dalla puntata e raddoppia a ogni risposta esatta: 100 → 200 → 400 → 800. Una risposta sbagliata (o mancata) brucia la banca.
- Chi incassa esce dal round con i punti della banca; chi non sceglie entro 8 s incassa d'ufficio, così un telefono in tasca non costa nulla.
- Backend: `scommessaPayload` serve tre domande QUIZ distinte della stessa categoria, con risposte incluse perché è la TV a condurre il round.
- TV `games/scommessa/scommessa.ts`: banca, moltiplicatore (×2, ×4, ×8), reveal e stato di ogni squadra.
- Remote: gettoni, tre domande e i due pulsanti INCASSA / RISCHIA; la banca corrente arriva con `SCOMMESSA_STATE`.
- `scoring-rules.ts` e demo aggiornati: non ci sono più punti negativi, si rischia solo la banca potenziale.

### Quota (quattro domande numeriche)
- Quattro domande con risposta numerica, ognuna con quattro fasce e una quota: più stretta è la fascia, più alta è la quota.
- Ogni squadra distribuisce 100 gettoni dal telefono; solo la fascia che contiene il valore paga i gettoni × quota, con tetto di 500 per domanda. Chi non invia gioca 25 gettoni per fascia.
- La banca numerica (34 domande) e il calcolo di fasce e quote vivono in `QuestionBankService`: le risposte non arrivano ai telefoni prima del reveal.
- La TV mostra valore, distribuzione del pubblico e il “cecchino” della domanda; il remote ha +/−, TUTTO, 50-50 e SPALMA.
- Il round occupa il sesto posto dell'atto 2 al posto della Bomba, che resta quattro volte in scaletta.

---

## Cosa è già fatto

### Speed Rush
- Pool minigiochi: `tap`, `odd`, `order`, `math`, `stroop`, `memory`, `flip`, `count`.
- Boost a catena: ×2 a 2 risposte giuste di fila, ×3 a 5, ×4 a 10.
- Badge combo e fiamma in TV.
- `reaction` e `mole` rimosse: la talpa è motoria, non adatta a una speed race.

### Time Buzzer (al posto di Price)
- 3 manche, target casuale 5–30 secondi.
- TV: cronometro grande `00:19:23`.
- Remote: solo pulsante verde START/STOP, nessun cronometro.
- Eliminazioni circa 1/3 per manche; la TV mostra `FUORI` e `PASSANO`.
- Gli eliminati restano bloccati.

### Air Hockey Battle
- Enum `AIR_HOCKEY_BATTLE` allineato tra frontend e backend.
- Il tempo di risposta decide il tempo dell'avversario e la "secchezza" del tiro:
  - risposta veloce → avversario ~4s, tiro ~0,58s dritto;
  - risposta lenta → fino a ~12s, tiro ~2,6s a zig-zag.
- Portieri laser colorati e disco in campo.

### Flusso controllato dall'admin (fatto, da testare dal vivo)
Pannello **CONTROLLO FLUSSO** in `admin.html`:
- **PROSSIMO ROUND** → `ADMIN_NEXT_ROUND`
- **MOSTRA CLASSIFICA** → `ADMIN_SHOW_LEADERBOARD`
- **PAUSA / RIPRENDI** → `ADMIN_TOGGLE_PAUSE`
- **DEMO GIOCO** → `ADMIN_SHOW_DEMO`
- **CHIUDI DEMO** → `ADMIN_HIDE_DEMO`
- **PARTITA #** → campo numerico per targettare la TV anche da un altro dispositivo.

Rimosso:
- i timeout automatici che mostravano la classifica dopo il round;
- i pulsanti TV "PROSSIMO ROUND" e "CLASSIFICA";
- il pulsante TV "GIOCA ORA" (sostituito da **APRI LOBBY**, che crea solo la partita);
- la chiusura automatica della classifica: resta in TV finché l'admin non avanza.

La pausa ha un overlay a schermo intero: il gioco non è visibile dietro.

### Flusso serata a 40 round (P0, 5 novembre — scaletta riscritta il 6)
- Scaletta fissa in 5 atti da 8 round; l'Arena chiude solo l'ultimo round. La tabella aggiornata è nella sezione “Cosa è cambiato il 6 novembre”.
- `ACT_DECKS` in `round-manager.service.ts`: Ruota 3 volte su 40 (atti 1, 3, 5), mai adiacente a Indovina chi.
- Bonus Roulette e Basket lanciabili dall'admin: non consumano un round.
  - `BONUS_RESULT` dal telefono; premi +300 / +150 / +75 ai primi tre.
  - Basket: pagina `/basket?player=...`, 30 s di gioco e 40 s di countdown in TV (margine per l'ultimo tiro).
- Time Buzzer: chi non preme entra con errore massimo ed è eliminato per primo.
- Ruota della Fortuna: lettere deterministiche (prima le più rare), timer 75 s, 3/40.
- Air Hockey: domande dalla banca (`GET /games/{id}/air-hockey/questions`), hardcoded solo come fallback.
- Avanzamento automatico dopo 10 s, annullato da pausa, classifica, demo o Prossimo round.

### Air Hockey Battle: rename completo (5 novembre)
- File rinominati: `mode/air-hockey-battle.mode.ts` e `games/air-hockey-battle/air-hockey-battle.ts`.
- Classi e interfacce `AirHockeyQuestion`/`AirHockeyBattle`; CSS TV `ahb-*` e remote `hockey-*`.
- Aggiornati import, script di QA, backend e documentazione: nel sorgente non resta nessun residuo del vecchio nome.

### Punti e aiuto al presentatore (5 novembre)
- Tabella unica in `interfaces/scoring-rules.ts`: corretto, sbagliato e non risposta per ogni gioco.
- Admin: al buzz mostra i punti che il giocatore sta per guadagnare o perdere, la soluzione e la tabella punti della modalità.
- Arena: i punti di piazzamento (1000/500/−300) vengono versati in classifica; prima restavano solo in TV.
- Timeline: una submission vale come corretta solo se ha almeno una coppia giusta.
- Roulette: colore giusto +1000, sbagliato 0 (nessun malus, è il gioco di fortuna).

### Demo animate (5 novembre)
- L’overlay demo non dipende più da un mp4: tre scene animate (TV, remote, punteggio) per tutti i 10 giochi e per i bonus Roulette/Basket.
- Il presentatore commenta dal vivo; i pulsanti admin `DEMO BONUS ROULETTE` e `DEMO BONUS BASKET` aprono le demo dei bonus.
- Gli mp4 restano opzionali: se un giorno vengono caricati, si può rimettere il tag `<video>`.

### Audio dei countdown (5 novembre)
- Tick sintetico a basso volume sui countdown (timer di gioco, pre-start, pausa tra le manche, bonus basket, auto-avanzamento).
- Bong grave alla fine del countdown; non ferma la musica e non usa asset esterni.

### Audio del podio e suspense (5 novembre)
- Classifica rapida e dettagliata: quando si scoprono i top 3 parte il rullo, poi il festeggiamento.
  - 3° posto: rullo lieve e festeggiamento lieve.
  - 2° posto: rullo medio, festeggiamento medio e botticelle.
  - 1° posto: rullo prolungato e forte, festeggiamento pieno e botti.
- I suoni del podio sono sintetizzati con Web Audio; non servono nuovi mp3.
- Nei giochi a conto alla rovescia (tranne Time Buzzer, che va in avanti) il round ≥ 20 avvia un heartbeat di suspense, con intensità che sale gradualmente dal round 20 al round 40.
- L'heartbeat si ferma a fine round, timeout, fine Arena, risposta corretta, pausa, classifica, reset e uscita dalla TV; riprende se il round viene ripreso.

### Fluidità delle animazioni (5 novembre)
- Nessun cambiamento di stile o tema: carta, inchiostro, colori, tipografia e ombre restano quelli di ieri sera.
- Ogni `transition: all` è stata sostituita dalla lista esatta delle proprietà che cambiano davvero (trasformazioni, ombre, colori): niente più transizioni su proprietà di layout non volute.
- L'equalizzatore della canzone anima `transform: scaleY()` invece di `height`, così non forza il ricalcolo del layout a ogni fotogramma.
- Dove una proprietà di layout è voluta (il padding delle righe del podio) la transizione resta, ma dichiarata una per una.

### Sistema di motion (5 novembre)
Stile e tema restano quelli di ieri: cambia solo il movimento. Tutto vive in
`styles.css`, così TV, remote e admin condividono lo stesso linguaggio.

- **Token** in `:root`: `--motion-micro/fast/base/cinema/special` e le curve
  `--ease-out`, `--ease-in-out`, `--ease-spring`, `--ease-snap`.
- **Utility**: `.m-fade-in`, `.m-rise`, `.m-drop-in`, `.m-slide-right/left`,
  `.m-zoom-in/out`, `.m-pop` (tutte con fill-mode `backwards`, così hover e
  `:active` esistenti non vengono sovrascritti a fine animazione).
- **Transizioni di pagina**: `withViewTransitions()` nel router, con
  `::view-transition-old/new(root)` e il fallback `router-outlet + *`.
- **TV**: ingresso lobby con titolo e card progressivi, badge round, overlay
  modalità estratta, area domanda, comparsa sfalsata delle opzioni di quiz e
  vero/falso, popup risultato (pop + shake sull'errore), righe delle risposte
  recenti, bonus, demo, modale di reset, pausa, titolo Arena.
- **Remote**: ingresso del setup sfalsato, cambio di stato del round, testata
  del gioco, comparsa sfalsata delle griglie (quiz, colori, emoji, bomba,
  cavallo, hockey, casinò, timeline), overlay di eliminazione e goal.
- Solo `transform` e `opacity`; `prefers-reduced-motion` continua a spegnere
  tutto tramite la regola globale con `!important`.
- Nessuna modifica a logica di gioco, punteggi, API o WebSocket: le animazioni
  partono dallo stato che il server ha già reso visibile.

---

## Da fare domani

1. **QA dal vivo con backend acceso** (`127.0.0.1:8080`):
   - Cavallo bonus: voto categoria, otto domande, podio +300/+150/+75;
   - Quota: fasce, gettoni, quote e cecchino;
   - Scommessa: gettoni, tre domande, banca che raddoppia e scelta INCASSA/RISCHIA;
   - Casino: quattro manche in un solo bonus, dopo l'atto 1;
   - pausa, classifica, demo e auto-avanzamento come prima.
2. **Ruota**: separare la fase di lancio dalla rivelazione (oggi le lettere si aprono durante il timer).
3. **Altri 2 giochi bonus** (Memory, Tap/Swipe) se i quattro bonus non bastano.
4. **Quota**: QA dal vivo di fasce, gettoni e quote.

---

## Come provarlo

```bash
# backend
cd apps/backend && ./mvnw spring-boot:run

# frontend
cd apps/frontend && npm start
```

- TV: pagina del gioco.
- Admin: pagina admin, stesso numero di **PARTITA #** mostrato sulla lobby TV.
- Se l'admin è su un altro dispositivo, inserire il numero a mano nel campo **PARTITA #**.

Limiti noti:
- Backend WS spento = niente test dal vivo.
- `MobileOnlyGuard` su `/play` limita il QA del remote; le schede nate su `/tv` restano redirette.
- Il flusso admin/TV è compilato ma **non ancora osservato in esecuzione**.

---

## Bonus basket (codificato)

Pagina `/basket?player=...`, canvas 2D, 30 s di gioco e 40 s di countdown in TV.

- **Telefono**: canvas 2D con palla, canestro, backboard e due ferri.
- **Controllo**: si trascina indietro la palla e si rilascia (o swipe) per il tiro.
- **Fisica**: gravità, rimbalzo su ferro/backboard, detezione del canestro.
- **Durata**: 20–30 secondi, tiri illimitati; ogni canestro vale punti bonus.
- **Premio**: +300 / +150 / +75 ai primi tre; il "gettone birra" resta opzionale e richiede una tabella di riscatto.
- **Integrazione**: mode `BONUS_BASKET` o evento `BONUS_GAME` lanciato dall'admin; il risultato entra con `onAnswerReceived` e non consuma un round della scaletta.

### 4 bonus game in rotazione
1. Roulette
2. Basket (fisica)
3. Memory
4. Tap/Swipe

Stato: canvas, canestro, punteggio e premi sono implementati; il gettone birra resta opzionale.

---

## File toccati (P0 e questa tornata)

- `apps/frontend/src/app/services/round-manager.service.ts` (+ spec)
- `apps/frontend/src/app/components/game-component/game-component.ts/.html/.css`
- `apps/frontend/src/app/components/game-component/mode/time-buzzer.mode.ts`
- `apps/frontend/src/app/components/game-component/mode/wheel-fortune.mode.ts`
- `apps/frontend/src/app/components/game-component/mode/air-hockey-battle.mode.ts`
- `apps/frontend/src/app/components/game-component/games/air-hockey-battle/air-hockey-battle.ts`
- `apps/frontend/src/app/components/game-component/demo-scripts.ts`
- `apps/frontend/src/app/components/game-component/interfaces/scoring-rules.ts`
- `apps/frontend/src/app/components/game-component/mode/music.mode.ts`
- `apps/frontend/src/app/components/game-component/interfaces/game-mode-type.ts`
- `apps/frontend/src/app/services/audio.service.ts`
- `apps/frontend/src/app/components/leaderboard/leaderboard-quick-component/leaderboard-quick-component.ts`
- `apps/frontend/src/app/components/leaderboard/leaderboard-detailed-component/leaderboard-detailed-component.ts`
- `apps/frontend/src/styles.css`
- `apps/frontend/src/app/components/admin/admin.ts/.html/.css`
- `apps/frontend/src/app/components/game-component/mode/cavallo.mode.ts` (nuovo)
- `apps/frontend/src/app/components/game-component/mode/scommessa.mode.ts` (nuovo)
- `apps/frontend/src/app/components/game-component/games/scommessa/scommessa.ts` (nuovo)
- `apps/frontend/src/app/components/basket-bonus/basket-bonus.ts`
- `apps/frontend/src/app/components/remote-component/remote-component.ts/.html`
- `apps/frontend/src/app/services/game.service.ts`
- `apps/frontend/src/app/services/game-mode-factory.service.ts`
- `apps/frontend/src/app/components/remote-component/restyle.css`
- `apps/frontend/src/app/testing/test-doubles.ts`
- `apps/backend/src/main/java/com/pub_game_be/service/QuestionBankService.java`
- `apps/backend/src/main/java/com/pub_game_be/controller/PartyGamesController.java`
- `apps/backend/src/main/java/com/pub_game_be/controller/GameController.java`
- `apps/backend/src/main/java/com/pub_game_be/service/PartyGameService.java`
- `scripts/checks/live_devices_check.js`
- `scripts/checks/party_games_check.py`
- `apps/frontend/public/assets/demos/README.md`
- `BRIEF-GIOCHI-MANCANTI.md`
- `README_LAVORI.md` (questo file)

Verifiche del 5 novembre:
- Build FE `npm run build` → exit 0.
- Build BE `./mvnw -B -DskipTests package` (JDK 25) → exit 0.
- Test FE: 62/64. Restano 2 fallimenti preesistenti e non collegati a queste modifiche:
  `LeaderboardDetailed` (spotlight dopo 9 s) e `Song` (etichetta fase 1).
- Dopo le ultime modifiche audio: build FE → exit 0; test FE → 62/64, stessi due fallimenti.
- Le spec di `RoundManagerService`, `GameComponent` e `RemoteComponent` passano.
- `git diff --check` pulito; nessun residuo del vecchio nome nel sorgente.
- Nessun test dal vivo: backend/WebSocket non avviati in questa sessione.

Verifiche del 6 novembre:
- Build FE `npm run build` → exit 0.
- Build BE `./mvnw -B -DskipTests package` → exit 0.
- Test FE: 64 passati, 2 falliti. I fallimenti sono gli stessi due preesistenti e non collegati
  (`LeaderboardDetailed` spotlight dopo 9 s, `Song` etichetta fase 1); i test Roulette sono
  stati rimossi insieme al round.
- `RoundManagerService`: 13 test verdi, inclusi scaletta variata, Cavallo fuori dai round
  con bonus dopo l'atto 3, Scommessa e Quota una volta, Casino in quattro manche dopo l'atto 1.
- Quota: build e test verdi; la banca numerica ha 34 domande in `QuestionBankService`.
- Nessun test dal vivo: Cavallo bonus e Scommessa sono compilati ma **non osservati in esecuzione**.

### Nota sulla Scommessa
Il formato attuale è a **tre domande con incasso**: puntata (10 s), poi per ogni
domanda 12 s di risposta e 6 s di reveal; dopo la prima e la seconda ci sono 8 s
per INCASSARE o RISCHIARE, infine 7 s di finale. La banca parte dalla puntata e
raddoppia a ogni esatta (100 → 200 → 400 → 800); una risposta sbagliata o mancata
la brucia. Chi non sceglie entro gli 8 s incassa d'ufficio, così un telefono in
tasca non penalizza la squadra. Non ci sono punti negativi: si rischia solo la
banca potenziale.

L'idea alternativa (parimutuel con quote che si muovono sulle puntate delle
squadre) resta sul tavolo, ma richiede una vera asta tra tavoli e non serve per
questa serata.
