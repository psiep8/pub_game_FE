# Partita #161 — 16 giocatori: risposte ed errori

Generato: 2026-11-12T13:00:29.693Z

## Esito in una riga

**16 giocatori, 13 round, 4 bonus, 719 azioni, 89 ricevute persistite.**
Il setup e i round sono partiti tutti; la concorrenza DB ha però fatto perdere risposte HTTP su Timeline, Arena e Speed Rush, e il pilota TV è caduto prima di BIGLIE.

## Cosa è arrivato

| Gioco | Azioni log | Stato/risposte | Persistite | Note |
|---|---:|---|---:|---|
| QUIZ | 18 | 18 inviate/ok, 0 rifiutate | 0 |  |
| MUSIC | 32 | 32 inviate/ok, 0 rifiutate | 0 |  |
| IMAGE_BLUR | 32 | 32 inviate/ok, 0 rifiutate | 0 |  |
| WHEEL_OF_FORTUNE | 32 | 32 inviate/ok, 0 rifiutate | 0 |  |
| TIMELINE | 4 | 1 inviate/ok, 2 rifiutate | 9 | 2 × 500; handler timeout |
| TIME_BUZZER | 54 | 18 inviate/ok, 33 rifiutate | 0 | 15/48 stop accettati; 33 × 422 (clientMs harness) |
| BOMBA | 49 | 10 inviate/ok, 39 rifiutate | 0 | 39 × 400 "Non è il tuo turno" (harness) |
| AIR_HOCKEY_BATTLE | 128 | 128 inviate/ok, 0 rifiutate | 0 |  |
| ULTIMA_SPIAGGIA | 32 | 32 inviate/ok, 0 rifiutate | 0 |  |
| AZZARDO | 17 | 17 inviate/ok, 0 rifiutate | 0 |  |
| BLACKJACK | 96 | 96 inviate/ok, 0 rifiutate | 0 |  |
| ARENA | 22 | 21 inviate/ok, 0 rifiutate | 14 | 16 domande; 5 answer 200 lato client; handler timeout |
| SPEED_RUSH | 37 | 37 inviate/ok, 0 rifiutate | 18 | 18 task/18 answer su 96 attese; handler timeout |
| BONUS CASINO | 16 | 16 inviate/da confermare | 0 | Azione STOMP inviata, nessuna ricevuta/ACK applicativo |
| BONUS BASKET | 97 | 49 inviate/da confermare | 48 | 48 risposte persistite |
| BONUS CAVALLO | 32 | 32 inviate/da confermare | 0 | Azione STOMP inviata, nessuna ricevuta/ACK applicativo |
| BONUS BIGLIE | 0 | 0 inviate/da confermare | 0 | Nessuna azione: bonus non eseguito |

### Dettaglio per round

#### 1. QUIZ

- Domanda: n/a
- Azioni: 18; inviate/ok: 18; rifiutate: 0
- Ricevute persistite: **0**
- Verdetto: Azioni inviate ma nessuna ricevuta persistita

#### 2. MUSIC

- Domanda: n/a
- Azioni: 32; inviate/ok: 32; rifiutate: 0
- Ricevute persistite: **0**
- Verdetto: Azioni inviate ma nessuna ricevuta persistita

#### 3. IMAGE_BLUR

- Domanda: n/a
- Azioni: 32; inviate/ok: 32; rifiutate: 0
- Ricevute persistite: **0**
- Verdetto: Azioni inviate ma nessuna ricevuta persistita

#### 4. WHEEL_OF_FORTUNE

- Domanda: n/a
- Azioni: 32; inviate/ok: 32; rifiutate: 0
- Ricevute persistite: **0**
- Verdetto: Azioni inviate ma nessuna ricevuta persistita

#### 5. TIMELINE

- Domanda: n/a
- Azioni: 4; inviate/ok: 1; rifiutate: 2
- Ricevute persistite: **9** (Paolo, Anna, Fabio, Matteo, Chiara, Sofia, Davide, Alice, Elena)
- Giocatori senza ricevuta: Bruno, Carla, Dario, Giulia, Luca, Marco, Sara
- Verdetto: 9 risposte persistite; 2 azioni rifiutate/in errore

#### 6. TIME_BUZZER

- Domanda: n/a
- Azioni: 54; inviate/ok: 18; rifiutate: 33
- Ricevute persistite: **0**
- Verdetto: Azioni inviate ma nessuna ricevuta persistita

#### 7. BOMBA

- Domanda: n/a
- Azioni: 49; inviate/ok: 10; rifiutate: 39
- Ricevute persistite: **0**
- Verdetto: Azioni inviate ma nessuna ricevuta persistita

#### 8. AIR_HOCKEY_BATTLE

- Domanda: n/a
- Azioni: 128; inviate/ok: 128; rifiutate: 0
- Ricevute persistite: **0**
- Verdetto: Azioni inviate ma nessuna ricevuta persistita

#### 9. ULTIMA_SPIAGGIA

- Domanda: n/a
- Azioni: 32; inviate/ok: 32; rifiutate: 0
- Ricevute persistite: **0**
- Verdetto: Azioni inviate ma nessuna ricevuta persistita

#### 10. AZZARDO

- Domanda: n/a
- Azioni: 17; inviate/ok: 17; rifiutate: 0
- Ricevute persistite: **0**
- Verdetto: Azioni inviate ma nessuna ricevuta persistita

#### 11. BLACKJACK

- Domanda: n/a
- Azioni: 96; inviate/ok: 96; rifiutate: 0
- Ricevute persistite: **0**
- Verdetto: Azioni inviate ma nessuna ricevuta persistita

#### 12. ARENA

- Domanda: n/a
- Azioni: 22; inviate/ok: 21; rifiutate: 0
- Ricevute persistite: **14** (Fabio, Sara, Dario, Elena, Chiara, Luca, Marco, Matteo, Bruno, Anna, Carla, Alice, Sofia, Giulia)
- Giocatori senza ricevuta: Paolo, Davide
- Verdetto: 14 risposte persistite dal server

#### 13. SPEED_RUSH

- Domanda: n/a
- Azioni: 37; inviate/ok: 37; rifiutate: 0
- Ricevute persistite: **18** (Chiara, Paolo, Dario)
- Giocatori senza ricevuta: Anna, Bruno, Carla, Elena, Fabio, Giulia, Luca, Marco, Sara, Matteo, Sofia, Davide, Alice
- Verdetto: 18 risposte persistite dal server

### Bonus

- **CASINO**: 16 azioni, 0 ricevute. Azione STOMP inviata, nessuna ricevuta/ACK applicativo
- **BASKET**: 97 azioni, 48 ricevute. 48 risposte persistite
- **CAVALLO**: 32 azioni, 0 ricevute. Azione STOMP inviata, nessuna ricevuta/ACK applicativo
- **BIGLIE**: 0 azioni, 0 ricevute. Nessuna azione: bonus non eseguito

## Errori e priorità

### E1 — P0 — STATE_BLOB / Hikari / Timeline-Arena-Speed

**Sintomo:** Timeout HTTP e 500 con 16 richieste concorrenti; Hikari saturo (10/10 connessioni).

**Prove:**
- 2 × "Timeout trying to lock table \"STATE_BLOB\""
- 3 × "HikariPool-1 - Connection is not available ... total=10, active=10, idle=0, waiting=1"
- 2 × 500 Servlet; 2 timeline-answer 500 lato client
- Timeline: 9/16 ricevute persistite; Arena: 14/16; Speed Rush: 18/96 risposte previste (18 task, 18 answer)

**Causa:** IdempotencyService.executeOnce apre una transazione e trattiene una connessione JDBC mentre l’azione chiama StateBlobService.save. Le scritture concorrenti sullo stesso STATE_BLOB si serializzano/aspettano il lock, il pool da 10 si esaurisce e il client va in timeout a 8 s.

**Impatto:** Timeline e Arena perdono parte delle risposte HTTP; Speed Rush si ferma dopo 18 task invece di 96; il server però persiste alcune risposte che il client non riceve.

**Prossimo passo:** Non tenere la connessione/transazione aperta durante l’azione; serializzare le scritture per partita prima di aprire la transazione, oppure usare una coda single-writer e un pool dimensionato per 20 giocatori.

### E2 — P1 — TV pilot / BIGLIE

**Sintomo:** Il pilota TV chiude il socket 1002 durante Basket; BIGLIE non viene mai aperto e non parte nessuna azione.

**Prove:**
- tv-game161.log: "socket pilota chiusa (1002)" alle 12:53:58
- tv-game161.log si ferma a "bonus: BASKET"; non compare "bonus: BIGLIE"
- summary byLabel non contiene biglie-pick; bonusReports.BIGLIE.actionCount = 0
- CAVALLO: 16 category + 16 answer inviate, ma il TV non ha loggato il bonus

**Causa:** Da verificare lato server/handshake: la TV viene disconnessa durante il bonus Basket; il pilota non riconnette e quindi non riceve ADMIN_START_BONUS BIGLIE.

**Impatto:** Il bonus BIGLIE non è stato esercitato; CAVALLO è stato inviato senza una TV attiva.

**Prossimo passo:** Riconnessione automatica del pilota TV e log del frame ERROR/closeReason; verificare se il token TV viene invalidato dal flusso Basket.

### E3 — P1 — Time Buzzer (harness)

**Sintomo:** 33 stop su 48 rifiutati con 422 "tempo-non-plausibile"; solo 15 accettati.

**Prove:**
- Per manche: {"1":{"total":16,"ok":8,"rejected":8},"2":{"total":16,"ok":5,"rejected":11},"3":{"total":16,"ok":2,"rejected":14}}
- Esempi: clientMs=1820/1860/2020/2060 contro serverElapsedMs≈1539-1543
- Il client usa 1500 + indice*40 ms, quindi i telefoni con indice alto dichiarano un tempo superiore al tempo reale del server e oltre la tolleranza.

**Causa:** Bug dell’harness: i 16 stop partono in parallelo ma il tempo dichiarato viene incrementato artificialmente per indice. Non è una race del server: gli start sono atomici e i 3 start hanno risposto 200 con replayed=false.

**Impatto:** Time Buzzer non ha 16 risposte valide per manche; i dati non sono utilizzabili per la validazione del gioco.

**Prossimo passo:** Usare un clientMs reale (misurato dallo start locale) o limitare tutti i valori a <= serverElapsed - tolleranza; poi rifare le 3 manche.

### E4 — P1 — Bomba (harness)

**Sintomo:** 39 pick su 48 rifiutati con 400 "Non è il tuo turno"; 9 accettati.

**Prove:**
- 39 × 400 "Non è il tuo turno"
- 9 × 200
- I 16 pick della stessa ondata sono inviati in Promise.all; il server accetta solo il turno corrente.

**Causa:** L’harness viola la regola a turni di Bomba. Il server si comporta correttamente rifiutando i pick fuori turno.

**Impatto:** Solo 9 pick validi su 48; il gioco non è stato esercitato da tutti i 16 giocatori in ogni ondata.

**Prossimo passo:** Serializzare i pick aspettando il turno (o leggere lo stato Bomba e inviare solo al giocatore corrente).

### E5 — P1 — Arena / Speed Rush / Timeline (risposte perse)

**Sintomo:** Il server persiste più risposte di quante ne restituisce al client; alcune mancano del tutto.

**Prove:**
- Timeline: 2 azioni answer nel log, 2 × 500, 9 ricevute persistite, 7 giocatori senza ricevuta
- Arena: 16 domande 200, 5 answer 200 lato client, 14 ricevute persistite, 2 giocatori senza ricevuta
- Speed Rush: 18 task e 18 answer, 18 ricevute; attese 96 answer (6 per 16 giocatori)

**Causa:** Conseguenza di E1: il timeout del client scade mentre il server è ancora in coda sul lock; il client registra 500/timeout ma il server può aver già scritto la ricevuta.

**Impatto:** Risposte valide ma non confermate al telefono; per Arena mancano 2 giocatori, per Timeline 7, per Speed Rush 78.

**Prossimo passo:** Correggere E1 e ripetere il run; non interpretare i 500 come “risposta non ricevuta dal server” senza leggere answer_receipt.

## Risposte mancanti / non confermate

- **Timeline:** 9 ricevute su 16; 7 giocatori senza ricevuta. Il client ha visto 2 × 500 e un timeout dell’handler.
- **Arena:** 14 ricevute su 16; 2 giocatori senza ricevuta. Il client ha visto solo 5 answer 200.
- **Speed Rush:** 18 risposte su 96 attese; il round si è fermato dopo 18 task/answer per timeout.
- **BIGLIE:** 0 azioni; il pilota TV si è chiuso con codice 1002 durante Basket.
- **Time Buzzer:** 15 stop accettati e 33 rifiutati 422 per il timing artificiale dell’harness, non per il server.
- **Bomba:** 9 pick accettati e 39 rifiutati “Non è il tuo turno”: l’harness manda i 16 pick in parallelo invece di rispettare il turno.

## File e prove

- `game161_answers.json`: tutte le azioni e le 89 ricevute, con risposte HTTP e stato per giocatore.
- `game161_answer_receipt.csv`: 89 ricevute dal DB.
- `game161_game_event.csv`: 51 eventi (13 ROUND_STARTED, 15 ROUND_CLOSED, 9 TIMELINE_ANSWER, 14 ARENA_ANSWER).
- `game161_game_round.csv`: 13 round.
- `game161_game_state.csv`, `game161_state_blob.csv`: stato finale e 7 blob.
- `logs/backend-game161.log`: lock `STATE_BLOB`, Hikari saturo e 500.
- `logs/tv-game161.log`: chiusura TV 1002 durante Basket e assenza di BIGLIE.
- `logs/full-game161.log`: sequenza dei 13 round e dei 4 bonus.

## Verdetto

Il progetto **accetta 16 giocatori** e li fa giocare tutti i 13 round; non è più vincolato a 8. Non è però ancora affidabile al 100% con 16 risposte simultanee: il collo di bottiglia è la transazione di idempotenza che tiene una connessione mentre serializza `STATE_BLOB`. Prima di considerare chiusa la prova a 16/20, va corretto E1 e rifatta la run; E3/E4 sono difetti dell’harness, non del server.
