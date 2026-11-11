# PubGame #129 — partita vera a 8 giocatori: errori e bug

**Data:** 11 novembre 2026, 23:37–23:46  
**Partita:** `#129`  
**Giocatori:** Anna, Bruno, Carla, Dario, Elena, Fabio, Giulia, Luca (8 sessioni reali)  
**Formato:** 13 round + 4 bonus, telefoni via STOMP/HTTP, TV reale, fault injection  
**Azioni registrate:** 421  
**Risposte persistite dal server:** 73 (Speed Rush 48, Basket 21, Timeline 3, Arena 1)  
**File dati:** [`game129_answers.json`](./game129_answers.json), [`game129_actions.jsonl`](./game129_actions.jsonl), [`game129_receipts.csv`](./game129_receipts.csv), [`game129_events.csv`](./game129_events.csv), [`game129_rounds.csv`](./game129_rounds.csv), [`logs/`](./logs/)

---

## Esito in breve

La partita è arrivata in fondo: tutti gli 8 telefoni si sono connessi e hanno fatto join, tutti i 13 round e i 4 bonus sono partiti, e il server ha persistito risposte reali. I giochi “a risposta secca” hanno funzionato bene: **Speed Rush 48/48** e **Basket 21 tiri**. Non è tutto verde: il **Time Buzzer ha rifiutato 8/8 stop**, l’**Arena ha accettato 1 solo giocatore su 8**, il bot non ha risposto a Timeline per un round letto in ritardo, e **il conflitto `UK_GAME_EVENT_SEQ` si è ripresentato** nonostante il lock DB.

| Area | Inviate | Accettate/persistite | Esito |
|---|---:|---:|---|
| Quiz | 8 + 1 duplicato | 0 ricevute (solo TV) | TV mostra 6/8 nomi |
| Music | 16 (8 book + 8 answer) | 0 ricevute (solo TV) | gioco arrivato in TV |
| Image Blur | 16 | 0 ricevute (solo TV) | gioco arrivato in TV |
| Wheel | 16 | 0 ricevute (solo TV) | gioco arrivato in TV |
| Timeline | 8 tentativi del bot, 0 partiti | **3** | 3 risposte da telefoni browser, 5 giocatori mai risposti |
| Time Buzzer | 8 stop | **0** | tutti `422 tempo-non-plausibile` |
| Bomba | 24 pick | **6** | 18 `400` per turno/casella, comportamento server corretto |
| Air Hockey | 64 answer | 0 ricevute | solo STOMP, nessun ACK |
| Ultima Spiaggia | 16 | 0 ricevute | solo STOMP, nessun ACK |
| Azzardo | 8 bet + 1 invalida | 0 ricevute | solo STOMP, nessun ACK |
| Blackjack | 48 action | 0 ricevute | solo STOMP, nessun ACK |
| Arena | 8 question | **1** | 7 `409 round-closed`; 1 domanda `200`; 1 risposta `200`; 1 `403` cross-player atteso |
| Speed Rush | 48 task + 48 answer | **48** | 6 risposte per giocatore |
| Bonus Casino | 8 | 0 ricevute | nessun ACK |
| Bonus Basket | 24 state + 21 shot | **21** | 3 tiri non inviati |
| Bonus Cavallo | 16 | 0 ricevute | nessun ACK |
| Bonus Biglie | 8 | 0 ricevute | nessun ACK |

---

## Bug da risolvere

### P0 — `UK_GAME_EVENT_SEQ` si ripresenta nonostante il lock

**Cosa è successo:** alle `00:40:11` il server ha registrato:

```
WARN  HHH000247: ErrorCode: 23505, SQLState: 23505
WARN  Unique index or primary key violation: "PUBLIC.UK_GAME_EVENT_SEQ ..."
ERROR HHH000099: an assertion failure occurred
ERROR Servlet.service() ... threw exception
```

Una richiesta HTTP è finita in **500** e l’evento non è stato scritto. Il contatore indica **1 conflitto** e **0 conflitti `UK_STATE_BLOB_KEY`**.

**Perché è grave:** il fix con lock Java + `findForUpdate(PESSIMISTIC_WRITE)` non copre tutti i casi. Il conflitto è avvenuto durante il round Timeline, con più answer ravvicinate. Le cause probabili sono:

- `findForUpdate` restituisce un’entità già nel persistence context e non rilegge/rilocka la riga;
- due `appendEvent` nella stessa richiesta/transazione usano uno `state.seq` letto prima del commit;
- una scrittura concorrente passa da un path che non usa il lock.

**Fix consigliato:** rendere il seq atomico sul DB, non calcolato in Java. Per esempio:

```sql
update game_state
set seq = seq + 1, version = version + 1, updated_at = ?
where game_id = ?
returning seq;
```

oppure una tabella/sequence dedicata per `(game_id, seq)`, con insert dell’evento che usa direttamente il valore restituito. Aggiungere un test concorrente con 8 thread sullo stesso `gameId` e verificare che non ci siano 500. Il lock attuale può restare come ottimizzazione, ma non deve essere l’unica garanzia di unicità.

---

### P0 — Time Buzzer: un secondo `/start` azzera il cronometro e invalida tutti gli stop

**Cosa è successo:** il bot ha chiamato `/time-buzzer/start` alle `23:40:35.869`; la TV ha fatto un secondo start poco dopo. Tutti gli 8 stop sono stati rifiutati:

```json
{"error":"tempo-non-plausibile","clientMs":1800,"serverElapsedMs":1211}
{"error":"tempo-non-plausibile","clientMs":1840,"serverElapsedMs":1257}
...
{"error":"tempo-non-plausibile","clientMs":2040,"serverElapsedMs":1494}
{"error":"tempo-non-plausibile","clientMs":0,"serverElapsedMs":1542}
```

Il client dichiara 1,8–2,0 s, il server ha un elapsed di 1,2–1,5 s: il secondo start ha spostato `startedAt` in avanti e ha reso “impossibili” tutti gli stop già partiti.

**Perché è grave:** in una serata reale basta un doppio click, un retry di rete o un secondo dispositivo che chiama start per far perdere **tutti** gli stop del round. Non è solo un problema del bot: è una race sul ciclo di vita del round.

**Fix consigliato:**

- rendere `/time-buzzer/start` idempotente per `roundKey`: se esiste già uno start attivo, restituire quello e **non** resettare `startedAt`;
- rifiutare con `409 round-already-started` un secondo start, invece di sovrascrivere;
- salvare `startedAt` e `roundKey` insieme e validare lo stop contro quello;
- lato client usare il tempo del server (`elapsed`) e tollerare lo skew, non fidarsi solo del `performance.now()` del telefono;
- aggiungere un test: start → start duplicato → stop con `clientMs` coerente con il **primo** start.

---

### P1 — Arena: 7 domande su 8 rifiutate con `409 round-closed`

**Cosa è successo:** l’handler Arena ha chiesto 8 domande. Una sola ha ricevuto `200`:

```json
{"difficulty":"facile","questionId":"g129-q1","playerId":"Luca","deadlineAt":1794440915898,...}
```

Le altre 7:

```json
{"error":"round-closed","deadlineAt":1794440612882}
```

Lo stato `arena-state` contiene solo 3 assegnazioni (`g129-q2`, `g129-q3`, `g129-q4`) e una sola risposta persistita (`Luca`, -10 punti). Il `403` “Squadra diversa dalla sessione” è invece il controllo cross-player atteso.

**Perché è grave:** l’Arena non parte per 7 giocatori su 8. La causa sembra una race tra l’apertura del round e la preparazione delle domande: le prime richieste arrivano quando il server considera ancora chiuso il round precedente, l’ultima arriva dopo l’apertura. Un client reale che non fa retry resta fuori.

**Fix consigliato:**

- non pubblicare `ROUND_STARTED` per Arena finché `arena-state` non è pronto (o esporre `ready:false` e far attendere i client);
- restituire `409` con `retryAfterMs` e fare retry/backoff lato client;
- verificare che le 8 domande vengano assegnate a tutti gli 8 giocatori, non a 3;
- test: 8 richieste concorrenti subito dopo lo start → 8 domande, 8 risposte.

---

### P1 — Timeline: `/current-round` restituisce il round precedente e il bot salta il round

**Cosa è successo:** 3 secondi dopo l’avvio del round Timeline, la chiamata del bot ha restituito:

```json
{"roundId":"","count":0,"type":"WHEEL_OF_FORTUNE"}
```

Il bot quindi non ha inviato le risposte Timeline. I 3 record persistiti (`Anna` due volte, `Bruno` una) arrivano dai telefoni browser nascosti nella pagina TV, non dal bot:

```json
{"score":-200,"totalPairs":6,"correctPairs":1,"playerName":"Anna"}
```

Cinque giocatori non hanno mai risposto al round.

**Perché è grave:** un client che usa `/current-round` per decidere cosa renderizzare può mostrare il gioco precedente e perdere l’intero round. Inoltre **Anna ha due ricevute Timeline nello stesso round**, con due idempotency key diverse: il server accetta risposte multiple dello stesso giocatore.

**Fix consigliato:**

- allineare `/current-round` allo stato pubblicato su `/topic/game/{id}/status` (stesso `roundKey`/`roundIndex`), oppure far leggere il round dal payload dell’evento `ROUND_STARTED`;
- lato client: polling breve finché `type` non corrisponde al round atteso, con timeout;
- imporre **una sola risposta Timeline per giocatore per round** (unique `(game_id, round_key, player_id)` o idempotency key derivata dal round), e restituire la risposta già registrata in caso di retry;
- test: start Timeline → `/current-round` deve restituire `TIMELINE` entro 1 s; doppio submit dello stesso giocatore → una sola ricevuta.

---

### P1 — Quiz: la TV mostra 6 risposte su 8

**Cosa è successo:** gli 8 telefoni hanno inviato `quiz-answer`; la TV, nel primo snapshot del round 1, mostrava solo:

```
Luca 1.20s 0 (-147)
Giulia 1.20s 0 (0)
Fabio 1.20s 0 (0)
Elena 1.20s 0 (0)
Dario 1.20s 0 (0)
Carla 1.20s 0 (0)
```

Mancano **Anna** e **Bruno**. Il Quiz non produce ricevute backend (la risposta vive solo in TV), quindi non è possibile distinguere con certezza tra:

- limite UI a 6 risposte visualizzate;
- risposta di Anna persa perché il fault test ha aperto una seconda connessione con il suo token;
- risposta di Bruno arrivata ma non renderizzata.

**Perché è grave:** con 8 giocatori la TV deve mostrare tutti gli 8. Se il limite è 6, la modalità 8 giocatori è incompleta.

**Fix consigliato:**

- verificare il componente TV del Quiz e rimuovere eventuali `slice(0, 6)` / layout a 6 posti;
- non riusare il token di un giocatore per un secondo client: il test “Anna come Bruno” ha chiuso la connessione con `1002` e può aver espulso la sessione legittima;
- aggiungere una ricevuta/ack anche per Quiz, così il test può dimostrare quante risposte ha accettato il server;
- test: 8 join, 8 answer, la TV mostra 8 nomi.

---

### P1 — Una seconda connessione con lo stesso token chiude la prima

**Cosa è successo:** il fault “Anna come Bruno” ha aperto un secondo STOMP con il token di Anna e ha inviato un `JOIN_GAME` con player diverso. Il server ha risposto:

```
ERROR Failed to send message to ExecutorSubscribableChannel[clientInboundChannel]
socket fault-Anna-come-Bruno chiusa (1002)
```

La chiusura è corretta come rifiuto, ma il comportamento “secondo socket con lo stesso token” non è esplicito: se il server sostituisce la sessione precedente, un secondo tab/dispositivo può silenziosamente espellere il giocatore vero. È compatibile con la sparizione di Anna dal Quiz.

**Fix consigliato:** rifiutare il secondo `CONNECT` con lo stesso token con un errore applicativo chiaro (`SESSION_ALREADY_ACTIVE`) e **non** chiudere la sessione esistente; oppure supportare esplicitamente più connessioni per lo stesso device con un limite.

---

### P2 — Gli errori STOMP sporcano il log e non hanno un messaggio utile

**Cosa è successo:** 4 righe `Failed to send message to MessageChannel` tra `00:37:51` e `00:38:06`, durante boot/join e fault test. Non hanno fermato la partita, ma rendono difficile distinguere un fault voluto da un errore reale.

**Fix consigliato:** intercettare l’eccezione nel `StompSubProtocolHandler`/error handler, restituire un `ERROR` con codice e `receipt-id`, e loggare a `WARN` solo per frame malformati. I fault attesi non devono produrre stack trace a livello `ERROR`.

---

### P2 — Bonus senza ACK/ricevuta

**Cosa è successo:** Casino, Cavallo e Biglie hanno ricevuto 8 azioni STOMP ciascuno (`status: sent`), ma non esiste una ricevuta o un ACK equivalente a `BASKET_SHOT`. Non è dimostrabile dal DB che il server le abbia accettate. Basket invece ha 21 ricevute e uno stato completo con 8 giocatori.

**Fix consigliato:** aggiungere un ACK applicativo (o una ricevuta idempotente) anche per Casino/Cavallo/Biglie, e persistere l’esito. Test: 8 azioni → 8 ricevute, non solo “sent”.

---

### P2 — Bomba: 18 rifiuti su 24 (comportamento corretto, harness cieco)

I 18 `400` sono `Non è il tuo turno` e `Casella già scelta`; i 6 `200` sono i pick validi, con eliminazione di Dario ed Elena. **Non è un bug del server**: è il bot che tenta a caso senza rispettare il turno. Va però migliorato l’harness per simulare un gioco reale (un pick per turno) e verificare il timer di turno.

---

## Fault injection: cosa ha funzionato

| Fault | Risultato |
|---|---|
| Heartbeat con token invalido | `410` |
| Heartbeat senza body | `410` |
| Diagnostica con token giocatore | `403` |
| Quiz con player sbagliato | `ERROR` STOMP + chiusura `1002` (rifiuto corretto, ma vedi P1) |
| Risposta Quiz duplicata di Anna | inviata, nessun ACK |
| Elena disconnessa e riconnessa | riconnessione riuscita, poi ha continuato a ricevere/rispondere |
| Azzardo con chips invalide | inviata, nessun ACK |
| Speed Rush con task inesistente | inviata, nessun ACK |
| Arena cross-player | `403 “Squadra diversa dalla sessione”` (corretto) |

---

## Cosa funziona già bene

- **8 sessioni reali** e 8 join sulla stessa partita.
- **Speed Rush**: 48 task e 48 risposte, 6 per giocatore, tutte persistite.
- **Basket**: 21 tiri persistiti su 8 giocatori, stato con punteggi e `shotId`.
- **Bomba**: turni e caselle validati lato server; penalità ed eliminazioni corrette.
- **Arena cross-player**: il controllo di squadra rifiuta il giocatore sbagliato.
- **Riconnessione**: Elena è rientrata e ha continuato a giocare.
- **TV**: ha mostrato i round e i risultati; il problema è la completezza su Quiz (6/8) e i tempi di preparazione Arena/Timeline.

---

## Priorità consigliata

1. **Sistemare il seq atomico** e aggiungere il test concorrente a 8 thread: è l’unico errore che produce un **500** e può perdere eventi.
2. **Rendere Time Buzzer idempotente** e non resettare lo start: oggi un doppio start azzera tutti gli stop.
3. **Allineare `/current-round`** e la preparazione Arena allo `ROUND_STARTED` pubblicato; aggiungere retry/backoff ai client.
4. **Una risposta Timeline per giocatore** e verifica degli 8 posti in TV.
5. **ACK/ricevute per Quiz e bonus** e gestione esplicita del doppio token.

---

## Come riprodurre

```bash
# setup 8 telefoni + TV (partita nuova)
API=http://127.0.0.1:8080 WS_URL=ws://127.0.0.1:8080/ws-pubgame \
  node scripts/sim/full-match.mjs setup

# run
API=http://127.0.0.1:8080 WS_URL=ws://127.0.0.1:8080/ws-pubgame \
  RUN_DELAY_MS=15000 ROUND_MS=30000 BONUS_MS=18000 \
  node scripts/sim/full-match.mjs run

# rigenerare il JSON dagli artefatti
node scripts/sim/reports/build-game129-report.mjs
```

> Nota: il backend è stato fermato per esportare il DB H2 e viene riavviato subito dopo. I file CSV/JSON/MD sono artefatti della partita #129.
