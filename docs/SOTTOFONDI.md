# Sottofondi — i venti loop, uno per uno

Punto **§4.7** della specifica audio: la lettura del catalogo dei sottofondi per
chi prova la sala. Il manifesto (`docs/MANIFESTO-AUDIO.md`) dice **cosa deve
arrivare** — carattere, BPM, parole di ricerca — e questo file dice **cosa c'è
davvero**, dove suona e quanto pesa.

Le durate e i pesi sono misurati sui file elaborati (`docs/CREDITI-AUDIO.md`),
non stimati. Chi decide cosa suona è il codice, non questo documento:
`core/services/bed-loops.ts` è il registro dei file e `core/services/bed-map.ts`
la mappa dei giochi. Se un numero qui non torna, ha ragione il codice.

**Stato al 19 novembre 2026:** 7 loop su 20 in cartella, 10,67 MB sui 22 MB del
tetto. I 13 mancanti sono le cinque basi d'atto e otto loop di gioco; finché non
arrivano, i giochi che li aspettano suonano il loop del vicino o la base d'atto,
come dice la colonna «ruolo».

## Basi d'atto (5 file)

La base suona nei giochi che non hanno un brano proprio (Quiz, Indovina chi,
Ruota, Timeline, Ultima Spiaggia) e in lobby, quando un atto è aperto. Senza
atto, o con il file non ancora in cartella, si torna alla lobby: la serata non
resta muta.

| Atto | File | Carattere | BPM | Ruolo | Durata | Peso |
|---|---|---|---|---|---|---|
| 1 | `loop/atto-1.m4a` | Aperitivo: caldo, leggero, accogliente | 95–110 | base dell'atto 1 | — | da consegnare |
| 2 | `loop/atto-2.m4a` | Si scalda: groove | 100–115 | base dell'atto 2 | — | da consegnare |
| 3 | `loop/atto-3.m4a` | Notte di sala: lounge elettronico | 105–120 | base dell'atto 3 | — | da consegnare |
| 4 | `loop/atto-4.m4a` | Sale l'energia: pop-rock/disco | 118–128 | base dell'atto 4 | — | da consegnare |
| 5 | `loop/atto-5.m4a` | Finale: festoso e importante | 120–135 | base dell'atto 5 | — | da consegnare |

Il file da solo non basta: un atto entra in gioco quando il suo numero compare in
`READY_ACTS` (`bed-map.ts`). Finché l'elenco è vuoto la base di ogni atto è
`lobby`, e un test confronta `READY_ACTS` con i file su disco — scordarsi la riga
fa fallire la suite.

## Giochi e bonus (14 file)

| File | Carattere | BPM | Ruolo (oggi) | Durata | Peso |
|---|---|---|---|---|---|
| `loop/lobby.m4a` | allegro da pub | 95–110 | lobby, attesa fra i round e **base di ripiego** di ogni atto senza file | 107,2 s | 1,65 MB |
| `loop/classifica.m4a` | festoso, cerimonia | 110–125 | classifiche, podio, attesa dei bonus (`setBedLoop('classifica')`) | 117,0 s | 1,85 MB |
| `loop/gioco-casino.m4a` | casinò, ritmo medio | 100–115 | Azzardo e Blackjack | 117,0 s | 1,84 MB |
| `loop/gioco-bomba.m4a` | tensione che sale | 100–120 | Bomba, Arena, Speed Rush | 102,9 s | 1,60 MB |
| `loop/gioco-tennis.m4a` | scontro sportivo | 120–135 | Tennis, Biglie | 98,8 s | 1,57 MB |
| `loop/gioco-cavallo.m4a` | leggero e curioso | 100–115 | in casa ma non assegnato: il bonus Cavallo non passa da `bedForGame` | 111,5 s | 1,78 MB |
| `loop/gioco-arena.m4a` | scontro, percussioni cattive | 130–145 | Arena — oggi suona `gioco-bomba` | — | da consegnare |
| `loop/gioco-speed-rush.m4a` | corsa, sintetizzatori incalzanti | 135–150 | Speed Rush — oggi `gioco-bomba` | — | da consegnare |
| `loop/gioco-biglie.m4a` | corsa allegra, cartoon | 120–135 | Biglie — oggi `gioco-tennis` | — | da consegnare |
| `loop/gioco-timeline.m4a` | concentrazione leggera, orologeria | 90–105 | Timeline — oggi base d'atto | — | da consegnare |
| `loop/gioco-ultima-spiaggia.m4a` | ultima occasione, tensione che sale | 100–120 | Ultima Spiaggia — oggi base d'atto | — | da consegnare |
| `loop/gioco-azzardo.m4a` | casinò, ritmo medio | 100–115 | Azzardo — oggi `gioco-casino` | — | da consegnare |
| `loop/gioco-blackjack.m4a` | jazz lento da tavolo | 80–95 | Blackjack — oggi `gioco-casino` | — | da consegnare |
| `loop/gioco-casino-finale.m4a` | l'ultimo giro: drammatico, solenne | 70–90 | nessun round della scaletta: è per il finale di serata, e non è ancora agganciato | — | da consegnare |

Sei nomi sono già quelli nuovi: `casino.m4a` è `gioco-casino`, `tensione.m4a` è
`gioco-bomba`, `sport.m4a` è `gioco-tennis`, `leggero.m4a` è `gioco-cavallo`,
`pub.m4a` è `lobby`. Il rinomino è già nel repository insieme ai file.

## Rotolamento delle Biglie (nostro)

| File | Carattere | Ruolo | Durata | Peso |
|---|---|---|---|---|
| `loop/biglie.m4a` | biglie che rotolano, non è musica | sotto il tappeto della gara; un file e otto ascolti, perché `marble-roll.ts` cambia passo e taglio delle alte per ogni pista | 24,0 s | 381 KB |

## Chi suona cosa

La tabella del §4.2 letta dal codice: `GAME_BEDS` in `bed-map.ts`. «Base
d'atto» significa la base dell'atto aperto — oggi la lobby, perché nessun atto
ha ancora il suo file.

| Modalità | Sottofondo | Quando arriva il file suo |
|---|---|---|
| Quiz | base d'atto | — |
| Musica | **silenzio** | il brano è la canzone, non un tappeto |
| Indovina chi (immagine) | base d'atto | — |
| Ruota della fortuna | base d'atto | — |
| Timeline | base d'atto | `gioco-timeline` |
| Ultima Spiaggia | base d'atto | `gioco-ultima-spiaggia` |
| Arena | `gioco-bomba` | `gioco-arena` |
| Tempo scaduto (Time Buzzer) | **silenzio** | il bong del countdown è un effetto |
| Bomba | `gioco-bomba` | — |
| Speed Rush | `gioco-bomba` | `gioco-speed-rush` |
| Tennis | `gioco-tennis` | — |
| Biglie | `gioco-tennis` | `gioco-biglie` |
| Azzardo | `gioco-casino` | `gioco-azzardo` |
| Blackjack | `gioco-casino` | `gioco-blackjack` |

Fuori dalla mappa: nessun round aperto e tipi sconosciuti prendono la base
d'atto; classifiche e podio chiamano `classifica` dalla regia. Con la
domanda aperta, Quiz e Indovina chi tengono la base 6 dB sotto il livello
normale (`bedDuckGain`) — è ducking, non un secondo file.

## Peso e margine

| Voce | Oggi | Tetto |
|---|---|---|
| Sette loop in casa | 10,67 MB | 22 MB per i venti |
| Tredici loop mancanti | — | 11,33 MB, cioè **0,87 MB a testa** (≈ 63 s a 112 kbps) |
| Effetti (fuori dal conto degli atti) | 3,01 MB | 4 MB |

Per atto, contando solo quello che suona davvero oggi (le basi mancano tutte):

| Atto | Loop | Peso oggi | Con la base a 60 s |
|---|---|---|---|
| 1 | casino, bomba | 3,44 MB | 4,24 MB |
| 2 | casino, tennis | 3,41 MB | 4,21 MB |
| 3 | bomba, tennis | 3,17 MB | 3,97 MB |
| 4 | bomba, tennis | 3,17 MB | 3,97 MB |
| 5 | bomba, tennis | 3,17 MB | 3,97 MB |

**L'atto 1, con i conti giusti.** Quando ogni gioco ha il suo loop, l'atto 1
mette insieme cinque file: base `atto-1`, `gioco-azzardo`, `gioco-timeline`,
`gioco-speed-rush`, `gioco-ultima-spiaggia`. A 60 s l'uno (0,80 MB) fa
**4,00 MB**, con quasi 2 MB di margine sul tetto dei 6: `gioco-casino` e
`gioco-bomba` escono dall'atto appena Azzardo e Speed Rush hanno il file loro, e
contarli insieme ai nuovi sarebbe un doppio conteggio dello stesso gioco.
L'atto più carico è il 3 (base, speed-rush, tennis, biglie, arena), **4,78 MB**.

Il vincolo vero è il **totale**: i venti loop a 60 s fanno **21,07 MB** sui 22 del
manifesto, 0,93 MB di margine. È quel numero da guardare quando arrivano i file:
se uno è più lungo, meglio rifilarlo che allungare il tetto. Il test
`bed-act-budget.spec.ts` rifà questi conti da `ACT_DECKS` e `bed-map.ts` a ogni
giro, così l'errore non ripassa.

## Quando arriva un file

1. Il grezzo in `apps/frontend/public/assets/audio/_src/loop/`, con il nome esatto
   di questo elenco, e la riga in `FONTI.txt` (titolo, autore, URL, licenza).
2. `node scripts/audio/process-audio.mjs`, poi `--credits` per i crediti.
3. Base d'atto: il numero in `READY_ACTS`. Loop di gioco: la riga in `GAME_BEDS`
   al posto dell'alias, più il file in `BED_LOOPS`.
4. `node scripts/audio/process-audio.mjs --check` deve uscire 0, e
   `npx tsc -p tsconfig.app.json --noEmit` più `npx ng test --watch=false`
   devono restare verdi: `audio-assets.spec.ts` controlla i tetti di peso e
   `bed-map.spec.ts` il rapporto fra `READY_ACTS` e i file su disco.
5. Aggiornare lo stato in testa a questo file e la nota di stato del manifesto.

## Cosa non cambia

Volumi di regia, ducking sotto la voce, regole dei giochi e catalogo degli
effetti restano quelli di oggi. Questo file è una lettura: non cambia un suono,
non sposta un volume, non tocca la pagina `/audio`.
