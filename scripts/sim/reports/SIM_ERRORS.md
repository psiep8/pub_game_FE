# PubGame — errori osservati nelle simulazioni

Data: **12 novembre 2026**  
Ambiente: backend `http://127.0.0.1:8080`, frontend `http://127.0.0.1:4200`, DB H2 file.  
Partite: **#97** (4 giocatori entrati via STOMP) e **#65** (run precedente, usata come confronto).

Fonti complete in `scripts/sim/reports/logs/`; dati strutturati in `game97_answers.json` e nei CSV della stessa cartella.

## Sintesi

| Gravità | Errore | Richieste | Effetto |
|---|---|---:|---|
| Alta | `UK_GAME_EVENT_SEQ` — due eventi con lo stesso `(game_id, seq)` | 2 | 2 × HTTP 500, `HHH000099` / `AssertionFailure`; evento duplicato rifiutato |
| Alta | `UK_STATE_BLOB_KEY` — tre scritture concorrenti di `arena-state` | 3 | 3 × HTTP 500 durante ARENA; stato arena non salvato per quelle richieste |
| Bassa | `Failed to send message to MessageChannel` (STOMP) | 5 | socket chiuse durante il boot; nessun impatto sulla partita |
| Media | Telefoni fermi in lobby/tutorial nella partita #65 | 3+ | nessun `JOIN_GAME`; risolto nella #97 con join automatico |
| — | `ROUND_CLOSED reason=skipped` | 12 | **non è un errore**: round chiusi senza risposte |

Totale HTTP 500 nella #97: **5** (2 seq + 3 blob). Assertion Hibernate: **2**.

## 1. Conflitto sulla sequenza eventi (`UK_GAME_EVENT_SEQ`)

**Quando:** `2026-11-12T00:14:05.557` e `00:14:05.572` (partita #97).  
**Cosa:** due `insert into game_event` con la stessa coppia `(game_id, seq)`; Hibernate segnala `HHH000099` e `AssertionFailure: Entry for instance of GameEventEntity has a null identifier`; la richiesta finisce in HTTP 500.  
**Contesto:** nello stesso secondo sono arrivate le due risposte TIMELINE di Carla e Anna (`00:14:05.454` e `.545`). Le due risposte **sono state salvate** (ricevute 65/66, eventi seq 10/11): i 500 riguardano richieste concorrenti/duplicate, non la perdita delle risposte.  
**Causa:** lettura di `state.seq`, incremento e insert non erano serializzati rispetto al commit della transazione esterna. Il primo lock Java non bastava perché il commit poteva avvenire dopo il rilascio del lock.  
**Fix applicato:** `GameStateRepository.findForUpdate` con `PESSIMISTIC_WRITE` su `game_state`, usato da `GameStateService.appendEvent`, più il lock per partita già presente. Il lock DB resta fino al commit e serializza le scritture anche con transazioni esterne.  
**Verifica:** `npm run test:backend` → **62/62 verdi**; backend riavviato, nuovo log **0 errori**, heartbeat `200`. Non è stato ripetuto un run completo dopo il fix.

## 2. Conflitto sullo state blob (`UK_STATE_BLOB_KEY`)

**Quando:** `2026-11-12T00:17:31.228` (tre tentativi), HTTP 500 alle `00:17:31.232` (partita #97).  
**Cosa:** tre richieste concorrenti hanno provato a inserire `state_blob (game_id=97, blob_key='arena-state')` durante il round ARENA. Due hanno trovato la riga assente e una l'ha inserita; le altre sono fallite sul vincolo unico.  
**Effetto:** stato arena non persistito per le richieste perdenti; la serata è comunque proseguita.  
**Causa:** `StateBlobService.save` faceva find-then-insert senza serializzare la chiave.  
**Fix applicato:** lock per `(gameId, blobKey)` in `StateBlobService.save`.  
**Verifica:** test **62/62**; backend riavviato con 0 errori. Anche questo fix non è ancora stato ri-provato con un run completo.

## 3. Errori STOMP durante il caricamento

**Quando:** `00:11:38.361`, `00:11:42.443`, `00:11:46.354`, `00:11:50.352`, `00:11:54.673` (partita #97); nella #65 tre analoghi tra `23:58:16` e `23:58:24`.  
**Messaggio:** `Failed to send message to MessageChannel in session …: Failed to send message to ExecutorSubscribableChannel[clientInboundChannel]`.  
**Causa:** socket di schede/iframe che si chiudevano durante il boot o un reload; il relay prova a scrivere su una sessione già chiusa.  
**Effetto:** nessuno sulla partita; sono cessati dopo il caricamento.  
**Stato:** non bloccante, non corretto (rumore di log).

## 4. Partita #65 — telefoni in lobby/tutorial

Nella run precedente Carla (e gli altri telefoni non visibili) restavano su “PRENOTA E RISPONDI!” / tutorial: mancava il messaggio `JOIN_GAME`. Non è un errore del backend, ma un limite dell'harness.  
**Fix:** `scripts/sim/match.mjs` ora apre un client STOMP per ogni telefono e invia `JOIN_GAME` dopo il caricamento della pagina. Nella #97 tutti e 4 sono entrati (log: “telefono Anna/Bruno/Carla/Dario entrato in partita”).  
Nella #65 si erano verificati anche 2 conflitti `UK_GAME_EVENT_SEQ` alle `00:00:35`, con gli stessi sintomi del punto 1.

## 5. Cose che sembrano errori ma non lo sono

- **`ROUND_CLOSED` con `reason: "skipped"` (12 volte):** il round è stato chiuso senza risposte; è il comportamento atteso quando nessun telefono risponde.
- **`⚠️ Azione sconosciuta: ADMIN_REQUEST_STATE / JOIN_GAME`:** warning del pannello admin che riceve azioni non gestite; non interrompe il flusso.
- **502 / WebSocket `CLOSING or CLOSED` nel browser:** comparsi durante i riavvii del backend; dopo il riavvio le chiamate tornano `200`.

## 6. Risposte dai remoti: cosa è arrivato davvero

La partita #97 ha prodotto **27 eventi**: 13 `ROUND_STARTED`, 12 `ROUND_CLOSED`, **2 `TIMELINE_ANSWER`**. Le ricevute (`answer_receipt`) sono le stesse 2.

| Round | Gioco | Risposte |
|---|---|---:|
| 1 | QUIZ | 0 |
| 2 | MUSIC | 0 |
| 3 | IMAGE_BLUR | 0 |
| 4 | WHEEL_OF_FORTUNE | 0 |
| 5 | TIMELINE | **2** |
| 6 | TIME_BUZZER | 0 |
| 7 | BOMBA | 0 |
| 8 | AIR_HOCKEY_BATTLE | 0 |
| 9 | ULTIMA_SPIAGGIA | 0 |
| 10 | AZZARDO | 0 |
| 11 | BLACKJACK | 0 |
| 12 | ARENA | 0 |
| 13 | SPEED_RUSH | 0 |

Dettaglio TIMELINE:
- **Carla** — score `-200`, coppie corrette `1/6`, ricevuta alle `00:14:05.454`.
- **Anna** — score `-200`, coppie corrette `1/6`, ricevuta alle `00:14:05.545`.
- Bruno e Dario: nessuna risposta.

**Verdetto:** le risposte dai remoti **arrivano** al backend (evento + ricevuta + ack), ma in questa run solo TIMELINE ne ha inviate due. Gli altri 12 round sono a 0 perché l'harness fa entrare i telefoni ma non simula click/risposte per ogni gioco. I punteggi di AIR HOCKEY visti in TV sono demo locali, non ricevute del backend.

Bonus registrati: CASINO, BASKET, CAVALLO, BIGLIE; nel log non ci sono risposte dei giocatori per i bonus.

## 7. File generati

- `scripts/sim/reports/game97_answers.json` — report completo: ogni round, domanda, eventi, risposte, motivi di chiusura, bonus, stato finale ed errori.
- `scripts/sim/reports/game97_events.csv` — eventi grezzi della partita.
- `scripts/sim/reports/game97_receipts.csv` — ricevute delle risposte.
- `scripts/sim/reports/game97_rounds.csv` — round e payload.
- `scripts/sim/reports/game97_state.csv` — stato finale.
- `scripts/sim/reports/logs/backend-game97.log`, `logs/sim-game97.log` — log della run #97.
- `scripts/sim/reports/logs/backend-game65.log`, `logs/sim-game65.log` — log della run #65.
- `scripts/sim/reports/build-game97-report.mjs` — generatore del JSON dai CSV/log.

## 8. Stato finale

- Fix `game_event` e `state_blob`: applicati, test **62/62**, backend riavviato, log di avvio **0 errori**, heartbeat `200`.
- Harness: join automatico di tutti e 4 i telefoni.
- Non è stato eseguito un secondo run completo con i fix attivi: è il controllo consigliato prima di considerare chiusa la race.
