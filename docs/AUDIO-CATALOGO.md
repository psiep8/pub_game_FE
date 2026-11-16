# Catalogo audio — eventi, fonti, chiamanti

Creato il 16 novembre 2026 per il blocco **A1** della specifica audio (vedi
`docs/ROADMAP-POST-PRIMA-SERATA.md`). Il catalogo vive nel codice, in
`apps/frontend/src/app/core/services/audio-catalog.ts`: questo documento ne è
la lettura per chi prova la sala.

## Come è fatto

Ogni evento del catalogo ha:

| Campo | Significato |
|---|---|
| `id` | Nome stabile: catalogo, regia audio e test usano questo |
| `label` | Etichetta in italiano, quella che si legge in regia |
| `when` | In una riga, quando suona |
| `source` | `ui` (Foley), `sfx` (sintesi Web Audio), `bed` (tappeto del pub) |
| `bus` | `tv`, `phone` o `both` |
| `volume` | Rifinitura dell'evento, 0–1. Oggi 1 per tutti: la bilanciatura è A2 |
| `minIntervalMs` | Distanza minima fra due riproduzioni dello stesso evento |
| `variants` | Quante varianti esistono (ingressi bonus, posti del podio) |

`AudioService.play(id, variante)` è il punto d'ingresso unico: rispetta il muto,
salta l'evento troppo ravvicinato e restituisce `false` quando lo salta. I
metodi storici (`playCorrect()`, `startClock()`, …) restano e fanno capo agli
stessi suoni: nessun chiamante è stato toccato in A1.

## Inventario dei chiamanti

Mappa `AUDIO_EVENT_FOR_METHOD` in `audio-catalog.ts`; i punti di chiamata sono
quelli effettivamente presenti nel codice al 16 novembre 2026.

| Evento | Metodo | Chi lo chiama |
|---|---|---|
| `gong` | `playGong()` | `features/games/time-buzzer/time-buzzer.component.ts` |
| `countdownTick` | `playCountdownTick()` | `features/tv/game.component.ts` |
| `countdownBong` | `playCountdownBong()` | `features/tv/game.component.ts` |
| `join` | `playJoin()` | `features/tv/game.component.ts` |
| `tick` | `playTick()` | `leaderboard-detailed`, `leaderboard-quick`, regia audio |
| `rankReveal` | `playRankReveal()` | `leaderboard-detailed` |
| `whoosh` | `playWhoosh()` | `leaderboard-quick` |
| `elimination` | `playElimination()` | `features/tv/game.component.ts` |
| `correct` | `playCorrect()` | `features/tv/game.component.ts` (conferme del presentatore) |
| `wrong` | `playWrong()` | `features/tv/game.component.ts` |
| `timeUp` | `playTimeUp()` | `features/games/*` tramite la modalità |
| `reveal` | `playReveal()` | `features/tv/game.component.ts` |
| `applause` | `playApplause()` | `playCorrect()`, podio |
| `coins` | `playCoins()` | `playCorrect()` |
| `racket` | `playRacketHit()` | `features/remote/remote.component.ts` |
| `uuuh` | `playUuuh()` | `playWrong()` |
| `bombSiren` | `playBombSiren()` | `features/tv/game.component.ts`, `features/remote/remote.component.ts` |
| `rouletteTicks` | `playRouletteTicks()` | `features/bonus/casino/casino-bonus.component.ts` |
| `rouletteLanding` | `playRouletteLanding()` | `features/bonus/casino/casino-bonus.component.ts` |
| `drumroll` | `playDrumroll()` | `features/games/quiz/quiz.component.ts`, `playReveal()` |
| `bell` | `playBell()` | nessun chiamante in produzione (resta in catalogo per la regia) |
| `confirm` | `playConfirm()` | telefono: conferme di risposta |
| `error` | `playError()` | telefono: azioni rifiutate |
| `podium` | `playPodium()` | `features/tv/game.component.ts` |
| `podiumReveal` | `playPodiumReveal()` | `leaderboard-detailed`, `leaderboard-quick` |
| `bonusEntrance` | `playBonusEntrance()` | `features/tv/game.component.ts` |
| `heartbeat` | `startHeartbeat()`, `startSuspense()` | `features/tv/game.component.ts` |
| `clock` | `startClock()` | `features/tv/game.component.ts`, modalità a timer |
| `ambient` | `startAmbient()` | `features/tv/game.component.ts` |

## Regia audio (A3)

`/audio` è la pagina di prova: un pulsante per ogni evento, la variante
selezionabile dove esiste, il muto, il volume generale e «ferma tutto». È
raggiungibile anche dal pulsante **AUDIO** in testa al pannello admin.

## Cosa manca (A2 e oltre)

- La bilanciatura vera fra interfaccia, effetti, tappeto e voce: oggi `volume`
  è 1 per tutti e il volume generale parte al 100%.
- Sostituzione e varietà dei suoni, sottofondi diversi per gioco, ducking.
- Silenzio in pausa e da admin secondo la specifica: `stopAll()` non ferma il
  tappeto, che è una scelta della prima serata da rivedere in A2.
- Ascolto reale in sala: nessun volume è stato giudicato all'orecchio, solo
  misurato nel codice.
