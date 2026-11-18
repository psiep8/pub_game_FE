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
| `source` | `ui` (Foley), `sfx` (file registrato), `bed` (sottofondo registrato) |
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

## Un tappeto per gioco (16 novembre 2026)

**Aggiornamento 18 novembre 2026:** i tappeti generati non sono più in uso. I
sottofondi sono i **sei loop registrati** di `assets/audio/loop`, scelti da
`core/services/bed-loops.ts` (pub, tensione, sport, casino, leggero,
classifica); `AudioService.setGameBed()` fa la dissolvenza incrociata di 1,5 s e
`SoundPlayer.startBed()` tiene il file in onda. `bed-profiles.ts` resta nel
repository solo finché non si chiude il passo 4 della spec dei suoni veri; la
tabella che segue è il registro storico di come suonavano prima.

Non c'è un solo sottofondo: **ogni gioco ha il suo tappeto**, così la sala cambia
aria a ogni round invece di sentire lo stesso giro per tutta la serata. I tappeti
stanno in `core/services/bed-profiles.ts` e sono generati battuta per battuta:
nessun file audio, nessun taglio, nessun mp3 da scaricare.

Ogni profilo fissa tempo, swing, giro di accordi (due battute per accordo),
ruoli del basso (`walk`, `pulse`, `octave`, `drone`), del piano (`stabs`, `pad`,
`arpeggio`), della percussione (`brushes`, `shaker`, `rim`, `wood`, `tick`) e la
voce melodica che entra dopo la prima sezione (`vibes`, `marimba`, `glass`,
`bell`). La generazione è deterministica: la battuta N di un tappeto suona
sempre uguale, quindi si può provare in regia e ritrovare identica in sala.

| Gioco | Tappeto | BPM | Carattere |
|---|---|---|---|
| Lobby / fra i round | `lobby` | 64 | trio da pub, vibrafono e spazzole |
| Quiz | `quiz` | 96 | marimba, shaker, basso che cammina |
| Canzone | `music` | 76 | piano caldo, arpeggi |
| Immagine sfocata | `imageBlur` | 72 | bordone e vetro, nessuna percussione |
| Timeline | `timeline` | 88 | orologio e campana |
| Ruota | `wheel` | 84 | shuffle con cerchio |
| Time Buzzer | `timeBuzzer` | 104 | cronometro, legno e marimba |
| Bomba | `bomba` | 112 | pulsazione che stringe, pad |
| Speed Rush | `speed` | 132 | ottave in corsa |
| Tennis | `tennis` | 108 | rimbalzi di legno |
| Arena | `arena` | 100 | suspense, bordone e campana |
| Ultima Spiaggia | `spiaggia` | 112 | tropicale, shaker e ottave |
| Azzardo | `azzardo` | 92 | roulette e gettoni, shuffle |
| Blackjack | `blackjack` | 80 | tavolo tranquillo, spazzole |
| Biglie | `biglie` | 124 | arpeggi che rotolano |
| Cavallo | `cavallo` | 116 | galoppo di legno |
| Bonus Casino (colore, dozzina, numero) | `azzardo` | 92 | lo stesso tavolo del gioco |

Il cambio avviene alla battuta: la TV chiama `setGameBed(tipo)` all'avvio del
round (e all'ingresso di un bonus), `setGameBed(null)` quando torna fra i round.
La battuta in corso finisce com'era, la successiva parte col nuovo tempo: non
si sente uno stacco. In regia la pagina `/audio` ha una sezione **TAPPETI** con
un pulsante per profilo, per provarli a volume di sala.

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
| `tappeto` lobby | −17,3 (RMS −47,2) | `bonusEntrance` DOZZINA | −26,6 |
| `tappeto` quiz | −12,8 (RMS −45,2) | `tappeto` bomba | −24,6 (RMS −42,7) |
| `tappeto` speed | −27,5 (RMS −47,1) | `tappeto` spiaggia | −28,4 (RMS −47,2) |
| `tappeto` blackjack | −26,5 (RMS −46,9) | | |

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
- Sostituzione e varietà dei suoni e ducking. I sottofondi diversi per gioco
  ci sono dal 16 novembre 2026 (`bed-profiles.ts`), provabili dalla sezione
  **TAPPETI** di `/audio`.
- Silenzio in pausa e da admin secondo la specifica: `stopAll()` non ferma il
  tappeto, che è una scelta della prima serata da rivedere in A2.
- Ascolto reale in sala: nessun volume è stato giudicato all'orecchio, solo
  misurato nel codice.
