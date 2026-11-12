# Partita #164 — 16 giocatori: risposte ed errori (game_id 3)

Generato: 2026-11-12T14:20:42.774Z

## Esito in una riga

**16 giocatori, 13 round, 4 bonus, 950 azioni, 178 ricevute persistite.**
Tutti i round e i bonus hanno prodotto le risposte attese, senza timeout del pool né conflitti.

## Cosa è arrivato

| Gioco | Azioni log | Inviate/ok | Rifiutate | Persistite |
|---|---:|---:|---:|---:|
| QUIZ | 18 | 18 | 0 | 0 |
| MUSIC | 32 | 32 | 0 | 0 |
| IMAGE_BLUR | 32 | 32 | 0 | 0 |
| WHEEL_OF_FORTUNE | 32 | 32 | 0 | 0 |
| TIMELINE | 19 | 19 | 0 | 18 |
| TIME_BUZZER | 54 | 50 | 1 | 0 |
| BOMBA | 82 | 82 | 0 | 0 |
| AIR_HOCKEY_BATTLE | 128 | 128 | 0 | 0 |
| ULTIMA_SPIAGGIA | 32 | 32 | 0 | 0 |
| AZZARDO | 17 | 17 | 0 | 0 |
| BLACKJACK | 96 | 96 | 0 | 0 |
| ARENA | 33 | 32 | 1 | 16 |
| SPEED_RUSH | 194 | 193 | 1 | 96 |
| BONUS CASINO | 16 | 16 | 0 | 0 |
| BONUS BASKET | 97 | 97 | 0 | 48 |
| BONUS CAVALLO | 32 | 32 | 0 | 0 |
| BONUS BIGLIE | 16 | 16 | 0 | 0 |

## Time Buzzer per manche

| Manche | Stop | Accettati | Rifiutati |
|---|---:|---:|---:|
| 1 | 16 | 15 | 1 |
| 2 | 16 | 16 | 0 |
| 3 | 16 | 16 | 0 |

## Bomba

40 pick accettati su 40, tutti a turno.

## Errori e priorità

Nessun errore aperto: nessun timeout del pool, nessun conflitto su eventi o blob.
## Numeri del server

- Ricevute: 178; eventi: 62; round persistiti: 13; blob: 7.
- Timeout lock STATE_BLOB: 0; timeout Hikari: 0; 500: 0.
- Conflitti seq: 0; conflitti blob: 0; righe ERROR nel log: 0.
- Invii STOMP falliti (ora a WARN, non ERROR): 2.

## File e prove

- `game164_answers.json`: azioni e ricevute con stato per giocatore.
- `game164_answer_receipt.csv`, `game164_game_event.csv`, `game164_game_round.csv`, `game164_game_state.csv`, `game164_state_blob.csv`: export dal DB.
- `logs/backend-game164.log`, `logs/tv-game164.log`, `logs/full-game164.log`.

## Verdetto

La partita a 16 giocatori regge: 178 risposte persistite, nessun timeout del pool, nessun conflitto su eventi o blob.

