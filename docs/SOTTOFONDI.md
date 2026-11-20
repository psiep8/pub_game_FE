# Sottofondi — i venti loop, uno per uno

Punto **§4.7** della specifica audio: la lettura del catalogo dei sottofondi per
chi prova la sala. Il manifesto (`docs/MANIFESTO-AUDIO.md`) dice **cosa deve
arrivare** — carattere, BPM, parole di ricerca — e questo file dice **cosa c'è
davvero**, dove suona e quanto pesa.

Le durate e i pesi sono misurati sui file elaborati (`docs/CREDITI-AUDIO.md`),
non stimati. Chi decide cosa suona è il codice, non questo documento:
`core/services/bed-loops.ts` è il registro dei file e `core/services/bed-map.ts`
la mappa dei giochi. Se un numero qui non torna, ha ragione il codice.

**Stato al 20 novembre 2026:** 20 loop su 20 in cartella, 21,69 MB sui 22 MB del
tetto. I tredici arrivati — cinque basi d'atto e otto loop di gioco — sono resi
in casa da `scripts/audio/generate-loops.mjs` e nei crediti compaiono come
«Nostra (sintesi renderizzata)». Un brano registrato che li sostituisce prende lo
stesso nome e passa dalla stessa pipeline.

## Basi d'atto (5 file)

La base suona nei giochi che non hanno un brano proprio (Quiz, Indovina chi,
Ruota) e in lobby, quando un atto è aperto. Senza atto si torna alla lobby: la
serata non resta muta.

| Atto | File | Carattere | BPM | Ruolo | Durata | Peso |
|---|---|---|---|---|---|---|
| 1 | `loop/atto-1.m4a` | Aperitivo: caldo, leggero, accogliente | 95–110 | base dell'atto 1 | 60,0 s | 0,86 MB |
| 2 | `loop/atto-2.m4a` | Si scalda: groove | 100–115 | base dell'atto 2 | 60,0 s | 0,96 MB |
| 3 | `loop/atto-3.m4a` | Notte di sala: lounge elettronico | 105–120 | base dell'atto 3 | 60,0 s | 0,83 MB |
| 4 | `loop/atto-4.m4a` | Sale l'energia: pop-rock/disco | 118–128 | base dell'atto 4 | 60,0 s | 0,86 MB |
| 5 | `loop/atto-5.m4a` | Finale: festoso e importante | 120–135 | base dell'atto 5 | 60,0 s | 0,85 MB |

Il file da solo non basta: un atto entra in gioco quando il suo numero compare in
`READY_ACTS` (`bed-map.ts`). Oggi ci sono tutti e cinque, e un test confronta
l'elenco con i file su disco — scordarsi la riga fa fallire la suite.

## Giochi e bonus (14 file)

| File | Carattere | BPM | Ruolo (oggi) | Durata | Peso |
|---|---|---|---|---|---|
| `loop/lobby.m4a` | allegro da pub | 95–110 | lobby, attesa fra i round e **base di ripiego** di ogni atto senza file | 107,2 s | 1,65 MB |
| `loop/classifica.m4a` | festoso, cerimonia | 110–125 | classifiche, podio, attesa dei bonus (`setBedLoop('classifica')`) | 117,0 s | 1,85 MB |
| `loop/gioco-casino.m4a` | casinò, ritmo medio | 100–115 | in casa, non assegnato: Azzardo e Blackjack hanno il file loro | 117,0 s | 1,84 MB |
| `loop/gioco-bomba.m4a` | tensione che sale | 100–120 | Bomba | 102,9 s | 1,60 MB |
| `loop/gioco-tennis.m4a` | scontro sportivo | 120–135 | Tennis | 98,8 s | 1,57 MB |
| `loop/gioco-cavallo.m4a` | leggero e curioso | 100–115 | in casa ma non assegnato: il bonus Cavallo non passa da `bedForGame` | 111,5 s | 1,78 MB |
| `loop/gioco-arena.m4a` | scontro, percussioni cattive | 130–145 | Arena | 60,0 s | 0,81 MB |
| `loop/gioco-speed-rush.m4a` | corsa, sintetizzatori incalzanti | 135–150 | Speed Rush | 60,0 s | 0,88 MB |
| `loop/gioco-biglie.m4a` | corsa allegra, cartoon | 120–135 | Biglie | 60,0 s | 0,84 MB |
| `loop/gioco-timeline.m4a` | concentrazione leggera, orologeria | 90–105 | Timeline | 60,0 s | 0,85 MB |
| `loop/gioco-ultima-spiaggia.m4a` | ultima occasione, tensione che sale | 100–120 | Ultima Spiaggia | 60,0 s | 0,84 MB |
| `loop/gioco-azzardo.m4a` | casinò, ritmo medio | 100–115 | Azzardo | 60,0 s | 0,81 MB |
| `loop/gioco-blackjack.m4a` | jazz lento da tavolo | 80–95 | Blackjack | 60,0 s | 0,83 MB |
| `loop/gioco-casino-finale.m4a` | l'ultimo giro: drammatico, solenne | 70–90 | nessun round della scaletta: è per il finale di serata, non ancora agganciato | 60,0 s | 0,83 MB |

Sei nomi sono già quelli nuovi: `casino.m4a` è `gioco-casino`, `tensione.m4a` è
`gioco-bomba`, `sport.m4a` è `gioco-tennis`, `leggero.m4a` è `gioco-cavallo`,
`pub.m4a` è `lobby`. Il rinomino è già nel repository insieme ai file.

## Rotolamento delle Biglie (nostro)

| File | Carattere | Ruolo | Durata | Peso |
|---|---|---|---|---|
| `loop/biglie.m4a` | biglie che rotolano, non è musica | sotto il tappeto della gara; un file e otto ascolti, perché `marble-roll.ts` cambia passo e taglio delle alte per ogni pista | 24,0 s | 381 KB |

## Chi suona cosa

La tabella del §4.2 letta dal codice: `GAME_BEDS` in `bed-map.ts`. «Base
d'atto» significa la base dell'atto aperto — oggi il suo file, non più la lobby.

| Modalità | Sottofondo |
|---|---|
| Quiz | base d'atto |
| Musica | **silenzio**: il brano è la canzone, non un tappeto |
| Indovina chi (immagine) | base d'atto |
| Ruota della fortuna | base d'atto |
| Timeline | `gioco-timeline` |
| Ultima Spiaggia | `gioco-ultima-spiaggia` |
| Arena | `gioco-arena` |
| Tempo scaduto (Time Buzzer) | **silenzio**: il bong del countdown è un effetto |
| Bomba | `gioco-bomba` |
| Speed Rush | `gioco-speed-rush` |
| Tennis | `gioco-tennis` |
| Biglie | `gioco-biglie` |
| Azzardo | `gioco-azzardo` |
| Blackjack | `gioco-blackjack` |

Fuori dalla mappa: nessun round aperto e tipi sconosciuti prendono la base
d'atto; classifiche e podio chiamano `classifica` dalla regia. Con la
domanda aperta, Quiz e Indovina chi tengono la base 6 dB sotto il livello
normale (`bedDuckGain`) — è ducking, non un secondo file.

## Peso e margine

| Voce | Oggi | Tetto |
|---|---|---|
| Venti loop in casa | 21,69 MB | 22 MB |
| Effetti (fuori dal conto degli atti) | 0,95 MB | 4 MB |

Per atto, contando la base e un file per gioco della scaletta:

| Atto | Loop | Peso |
|---|---|---|
| 1 | atto-1, azzardo, timeline, speed-rush, ultima | 4,24 MB |
| 2 | atto-2, azzardo, biglie, tennis, ultima | 5,03 MB |
| 3 | atto-3, speed-rush, tennis, biglie, ultima, arena | 5,77 MB |
| 4 | atto-4, bomba, biglie, timeline, speed-rush, ultima | 5,86 MB |
| 5 | atto-5, bomba, biglie, timeline, ultima, arena | 5,79 MB |

L'atto più carico è il 4, **5,86 MB**, sotto il tetto dei 6. I sei brani
arrivati con la finestra 60–120 s restano al loro tetto: `lobby`, `classifica`,
`gioco-casino`, `gioco-bomba`, `gioco-tennis` e `gioco-cavallo` pesano più dei
nuovi perché durano ancora 99–117 s.

Il vincolo vero è il **totale**: i venti loop fanno **21,69 MB** sui 22 del
manifesto, **0,31 MB di margine**. È quel numero da guardare quando si rifà un
file: se uno è più lungo, meglio rifilarlo che allungare il tetto. Il test
`bed-act-budget.spec.ts` rifà questi conti da `ACT_DECKS` e `bed-map.ts` a ogni
giro, e controlla anche che nessun loop superi i 60 s (i sei storici e il
rotolamento delle Biglie sono dichiarati come eccezioni).

## Quando arriva un file

1. Il grezzo in `apps/frontend/public/assets/audio/_src/loop/`, con il nome esatto
   di questo elenco, e la riga in `FONTI.txt` (titolo, autore, URL, licenza).
2. `node scripts/audio/process-audio.mjs`, poi `--credits` per i crediti.
3. I file sono già agganciati: base d'atto in `READY_ACTS`, loop in `BED_LOOPS`
   e in `GAME_BEDS`. Per sostituirne uno basta il file con lo stesso nome.
4. `node scripts/audio/process-audio.mjs --check` deve uscire 0, e
   `npx tsc -p tsconfig.app.json --noEmit` più `npx ng test --watch=false`
   devono restare verdi: `audio-assets.spec.ts` controlla i tetti di peso e
   `bed-map.spec.ts` il rapporto fra `READY_ACTS` e i file su disco.
5. Aggiornare lo stato in testa a questo file e la nota di stato del manifesto.

## Cosa non cambia

Volumi di regia, ducking sotto la voce, regole dei giochi e catalogo degli
effetti restano quelli di oggi. Questo file è una lettura: non cambia un suono,
non sposta un volume, non tocca la pagina `/audio`.
