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

## Come sono fatti i suoni (16 novembre 2026)

`core/services/audio-dsp.ts` è la cassetta degli strumenti; il catalogo dice
*cosa* suona, la DSP dice *come*:

| Strumento | Usato per |
|---|---|
| Risonatori modali (impulso + banchi di filtri) | gong, bong del countdown, campana, gettoni, pallina della roulette, zoccoli del Cavallo, dadi, bicchieri del tappeto |
| Campane FM | campana, pianoforte elettrico e vibrafono del tappeto |
| Corde pizzicate Karplus-Strong | basso del tappeto, arpeggi della rivelazione e del podio |
| Voci a formanti con vibrato e fiato | «uuuh» del pubblico |
| Pioggia di battimani filtrati (deterministica) | applausi, festa del podio |
| Soffi filtrati con banda in movimento | whoosh, riser della rivelazione, rulli, botti |
| Buzzer a onde quadre filtrate e tremolate | tempo scaduto (TV), errore (telefono) |
| Ottoni filtrati con attacco a banda larga | risposta sbagliata, eliminazione, fanfara del podio |
| Coda di stanza (risposta all'impulso generata) | tutti i suoni della TV, non quelli del telefono |

Il tappeto non è più un giro di pad: basso pizzicato che cammina, piano
elettrico in levare swing, spazzole, vibrafono e bicchieri, come un trio da pub.

## Livelli misurati dopo la rifattura (picco, dBFS)

Misurati il 16 novembre 2026 sulla pagina `/audio`, uscita master al 100%,
con un analizzatore collegato al bus master. Il bus Foley non è incluso.

| Evento | Picco | Evento | Picco |
|---|---|---|---|
| `podiumReveal` 1° | −12,4 | `podiumReveal` 2° | −14,1 |
| `podiumReveal` 3° | −17,7 | `wrong` | −18,6 |
| `podium` | −19,0 | `bombSiren` | −19,4 |
| `elimination` | −20,1 | `drumroll` | −20,5 |
| `bonusEntrance` BLACKJACK | −20,6 | `coins` | −20,8 |
| `timeUp` | −20,8 | `rouletteLanding` | −21,0 |
| `confirm` | −21,2 | `rouletteTicks` | −21,5 |
| `clock` | −21,6 | `bonusEntrance` NUMERO | −21,8 |
| `gong` | −22,2 | `reveal` | −22,6 |
| `countdownBong` | −22,8 | `heartbeat` | −22,8 |
| `tick` | −23,1 | `bonusEntrance` COLORE | −23,1 |
| `applause` | −23,5 | `bonusEntrance` CAVALLO | −23,7 |
| `countdownTick` | −23,8 | `bell` | −24,7 |
| `racket` | −24,8 | `uuuh` | −25,1 |
| `whoosh` | −25,9 | `error` | −25,9 |
| `tappeto` | −25,6 (RMS −45,9) | `bonusEntrance` DOZZINA | −26,6 |

Nessun evento satura: il margine sullo zero digitale è di almeno 12 dB.
La voce del presentatore non passa dall'app: il rapporto con la voce si fissa
in sala, tenendo i picchi degli effetti 10–14 dB sotto la parola più forte.

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
