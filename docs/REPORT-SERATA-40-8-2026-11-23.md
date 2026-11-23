# Serata completa 40 round + 4 bonus — 23/11/2026

> **Correzione 23/11/2026:** la serata ha **cinque** bonus, non quattro.
> L'harness è stato corretto per eseguire anche `CASINO_NUMBER`; il run
> end-to-end registrato sotto resta la prova a quattro bonus perché il rerun
> a cinque non è partito per un blocco della distro WSL. I dati sui 40 round,
> sugli 8 telefoni e sulle banche restano validi.

## Esito

**PASS** sulla simulazione funzionale: 40 round della scaletta reale e 4 bonus
portati a termine con 8 partecipanti e 8 telefoni STOMP, senza errori 5xx e
senza handler in errore.

- Partita di prova: **gameId 4** sul backend Docker `127.0.0.1:8080`.
- Tavoli: **8** (Anna, Bruno, Carla, Dario, Elena, Fabio, Giulia, Luca).
- Round: **40/40**, nell'ordine di `apps/frontend/src/app/shared/schedule.ts`.
- Bonus: **4** — `CASINO_COLOR`, `BLACKJACK`, `CASINO_DOZEN`, `CAVALLO`.
- Azioni registrate: **1039**; HTTP 200: **519**; invii STOMP: **501**.
- Errori applicativi del backend (`ERROR`, `Exception`, `500`): **0**.

Il backend non è stato aperto a video: la regia TV è stata sostituita dal
pilota headless `scripts/sim/tv-pilot.mjs`, mentre i telefoni erano client
STOMP/HTTP reali dell'harness. La UI non è quindi parte di questa verifica.

## Copertura dei round

| Gioco | Round | Evidenza |
|---|---:|---|
| QUIZ | 5 | 40 risposte, duplicati e giocatore errato rifiutati |
| MUSIC | 4 | 32 prenotazioni + 32 risposte |
| TIME_BUZZER | 3 | 9 partenze, 72 stop; 3 tempi impossibili → 422 attesi |
| AZZARDO | 2 | 16 puntate; 2 puntate invalide rifiutate |
| TIMELINE | 3 | 24 risposte, duplicato e late answer → 409 attesi |
| SPEED_RUSH | 3 | 144 task + 144 risposte; 3 task invalidi → 409 attesi |
| ULTIMA_SPIAGGIA | 5 | 40 livelli + 40 risposte |
| WHEEL_OF_FORTUNE | 2 | 16 prenotazioni + 16 risposte |
| BIGLIE | 4 | 4 stati TV e 32 scelte biglia |
| TENNIS_BATTLE | 2 | 128 risposte |
| IMAGE_BLUR | 3 | 24 prenotazioni + 24 risposte |
| ARENA | 2 | 16 domande + 16 risposte |
| BOMBA | 2 | 2 partenze, 40 pick a turni |

I giochi a prenotazione (Musica, Ruota, Immagine sfocata) hanno ricevuto il
`JOIN_GAME` di tutti gli 8 telefoni prima delle risposte. Nei giochi
simultanei le risposte sono state inviate in parallelo dagli 8 client; quiz
duplicato, giocatore estraneo alla sessione, token heartbeat invalido, task
scaduto e Timeline tardiva sono stati rifiutati come previsto.

## Banche domande

`node scripts/audit-banche.mjs --ci` → **Audit banche: OK**.

- Quiz/Arena/Tennis/Cavallo: **1143** domande (394 difficili, 360 facili, 389 medie), 0 doppioni, 0 segnalazioni.
- Timeline: **222** eventi, 182 con anni vicini.
- Azzardo: **360** domande.
- Ultima spiaggia: **0** buchi categoria × livello; 0 celle sotto il minimo di 3.
- Indovina chi: **150** persone, 0 doppioni, 0 campi/file mancanti.
- Musica: **114** brani, 0 doppioni, 0 campi/file mancanti.
- Ruota: **62** frasi, 0 doppioni, 0 segnalazioni.
- Bomba: **110** affermazioni, 0 doppioni, 0 campi mancanti, 0 false da rivedere.

## Bonus

Il run registrato sotto ha eseguito quattro bonus; il quinto è stato aggiunto
all'harness ma non è stato eseguito end-to-end per il blocco WSL:

| Bonus | Stato TV | Azioni telefoni |
|---|---|---:|
| CASINO_COLOR | `CASINO_STATE` | 8 |
| BLACKJACK | `BLACKJACK_STATE` | 8 |
| CASINO_DOZEN | `CASINO_STATE` | 8 |
| CAVALLO | `CAVALLO_STATE` | 16 (8 categoria + 8 risposta) |
| CASINO_NUMBER | `CASINO_STATE` | configurato, rerun non eseguito |

La serata reale prevede **cinque** bonus (`BONUS_AFTER_ACT`), tutti supportati
dal pilota e dall'handler `CASINO_*`. Biglie non è un bonus: sono i quattro
round 11, 22, 28 e 37, tutti eseguiti.

## Stato finale autorevole

`GET /games/4/diagnostics`:

- `roundType=ARENA`, `roundIndex=39` (quarantesimo round), `roundOpen=false`.
- `lastEventType=ROUND_CLOSED`, `seq=124`.
- `questionsUsed=48`.
- `devices`: 10 registrati (TV, admin, 8 telefoni); a fine prova 0 connessi
  perché l'harness chiude tutte le socket.

La partita si ferma dopo il quarantesimo round e i quattro bonus registrati; la schermata
finale/classifica della TV non è stata renderizzata perché non c'era una TV
grafica. Il backend non ha round aperti né handler bloccati.

## Esiti attesi e unica differenza

Richieste non-200 osservate:

- **410** ×2: heartbeat con token inesistente e body assente → `re-register`.
- **422** ×3: tempo dichiarato 0 ms → `tempo-non-plausibile`.
- **409** ×3: task Speed Rush scaduto/non valido.
- **403** ×2: Arena con token di Anna e `playerId` Bruno. L'harness si
  aspettava 400, il filtro di sicurezza risponde 403; è un rifiuto più
  restrittivo, non un errore funzionale.

Nessun 500. Nei log Docker compaiono solo gli `ACCESS_DENIED` intenzionali
della fault injection.

## Limiti

- La prova è headless: non verifica rendering, animazioni o la schermata
  finale della TV.
- Il backend è l'istanza Docker già attiva su 8080, non un avvio pulito da
  sorgente nella stessa esecuzione.
- I check Python legacy (`rounds_check.py`, `party_games_check.py`,
  `arena_check.py`) non sono stati usati: chiamano `POST /games` senza
  sessione e ricevono 401. La verifica live è stata fatta con sessioni
  autenticate e azioni reali.
- `devices.reconnections=0` nelle diagnostics non riflette la riconnessione
  di Elena: la socket è stata chiusa e riaperta, il `JOIN_GAME` è riuscito
  (log `elena-rejoin`), ma il contatore del backend non è incrementato.
- I tempi sono stati compressi per il laboratorio: `ROUND_MS=9000`,
  `BONUS_MS=7000`. Il numero di round e partecipanti è quello reale; il
  rerun a cinque bonus è bloccato dal mancato avvio di nuove shell WSL.
- Il quinto bonus è coperto dal codice e dallo stesso percorso `CASINO_STATE`
  degli altri due Casino, ma non ha ancora un'esecuzione end-to-end registrata.

## Artefatti locali (non versionati)

- Log completo: `.freebuff/full-night-4.log`
- Azioni: `scripts/sim/reports/game-actions.jsonl`
- Riepilogo: `scripts/sim/reports/game-actions-summary.json`
- Audit: `.freebuff/audit-banche.log`

## Harness aggiornato per la prova

- `scripts/sim/schedule.mjs`: `ROUNDS_SERATA` ora è la scaletta reale a 40
  round (Biglie incluse, Blackjack fuori dai round).
- `scripts/sim/full-match.mjs`: handler `BIGLIE`, cinque bonus attuali,
  risposte casuali su indici/opzioni.
- `scripts/sim/tv-pilot.mjs`: stati `CASINO_*`, `BLACKJACK_STATE` e
  `BIGLIE_STATE` per i round Biglie.
