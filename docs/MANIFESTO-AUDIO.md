# Manifesto audio — suoni registrati

Fase 0 della sostituzione dell'audio sintetizzato (SPEC-SUONI-REALI.md).

**Stato:** i 48 file sono nelle cartelle, elaborati, e sono quelli che l'app
suona; i crediti sono in `docs/CREDITI-AUDIO.md`. Gli effetti marcati «Nostra»
(gong, bong del countdown, whoosh, gettoni, racchetta, scoppio della bomba,
miccia e i quattro urti delle Biglie) non sono registrazioni di libreria: sono
la nostra sintesi renderizzata in file con lo stesso script, e in manifesto e
crediti risultano «Nostra».

I valori misurati sono quelli veri, non quelli richiesti. Gli effetti stanno
entro circa 2 dB dal bersaglio di loudness: sui suoni con molta cresta (un
riser, un galoppo, un battito) entra una compressione leggera, e dove nemmeno
quella basta resta il valore misurato invece di schiacciare i transienti
(vedi `docs/CREDITI-AUDIO.md`).

## Regole dei file

- **Formato:** AAC in contenitore `.m4a` (Safari iOS lo suona senza problemi).
  Mai MP3 per i loop: il piccolo silenzio in fondo fa scattare la ripetizione.
- **Effetti:** mono, 44,1 kHz, AAC 96–128 kbps, normalizzati a **−16 LUFS**
  (picco massimo −1 dBTP), coda breve tagliata.
- **Sottofondi:** stereo, 44,1 kHz, AAC 112 kbps, **−23 LUFS**, 60–120 secondi,
  senza voce cantata, inizio e fine che si incrociano in loop.
- **Nome del file:** esattamente quello della tabella. Sostituire un suono =
  sostituire il file con lo stesso nome, senza toccare il codice.
- **Licenze ammesse:** CC0, Pixabay, Mixkit, royalty-free Sonniss, CC-BY **solo**
  con attribuzione scritta nei crediti. Mai CC-BY-NC, «solo uso personale»,
  estratti da film o da giochi.
- **Peso:** i venti sottofondi sotto **22 MB** e nessun atto oltre **6 MB** fra
  la sua base e i loop dei suoi giochi; gli effetti hanno un tetto loro,
  **4 MB** (oggi 3,01 MB), e restano fuori dai conti degli atti.
- **Se un file manca:** nessun suono e un avviso in console. Non si torna alla
  sintesi: così si vede subito cosa manca.

## Come consegnare i file

1. Metti i file grezzi in `apps/frontend/public/assets/audio/_src/<cartella>/<nome>.<ext>`,
   con il nome esatto della tabella e l'estensione che hai scaricato (`wav`,
   `mp3`, `ogg`, `flac`, `m4a`…). Un file messo direttamente nella cartella di
   destinazione va bene lo stesso: dopo l'elaborazione viene spostato in `_src/`.
   `_src/` è ignorata da git: i grezzi non finiscono nel repository.
2. Per ogni file aggiungi una riga in `apps/frontend/public/assets/audio/FONTI.txt`
   (formato descritto nel file stesso): titolo, autore, URL della pagina di
   provenienza, licenza. Senza questi dati il file non entra nei crediti e non
   si usa.
3. Dimmi che i file ci sono: eseguo lo script qui sotto, compilo
   `docs/CREDITI-AUDIO.md` e aggiorno `/audio`.

## Elaborazione (già pronta)

`scripts/audio/process-audio.mjs` fa tutto il lavoro meccanico. Legge la tabella
qui sopra (è l'unica fonte dei nomi), trova i grezzi, normalizza con `loudnorm`,
taglia il silenzio e la coda agli effetti, converte in AAC `.m4a` e misura il
risultato con `ebur128`.

```bash
node scripts/audio/process-audio.mjs            # elabora quel che trova
node scripts/audio/process-audio.mjs --check    # verifica file e metadati: esce 1 se manca qualcosa
node scripts/audio/process-audio.mjs --only gong
node scripts/audio/process-audio.mjs --force    # rifà anche gli m4a già pronti
node scripts/audio/process-audio.mjs --pending  # cosa consegnare, senza verifica
node scripts/audio/process-audio.mjs --credits  # rigenera docs/CREDITI-AUDIO.md
```

- **`--check --pending`** dice cosa consegnare e come: per ogni file in attesa
  riporta carattere, BPM e parole di ricerca (presi dalle tabelle di questo
  documento, non ricopiati a mano) e la riga di `FONTI.txt` già composta. Fra
  parentesi angolari restano solo i campi che sa chi scarica il brano: titolo,
  autore, URL e — quando la fonte suggerita lo dice — la licenza.

- Effetti: mono 44,1 kHz, AAC 96 kbps circa, **−16 LUFS**, picco ≤ −1 dBTP,
  durata massima della tabella.
- **Coda tagliata:** quando il file supera la durata massima, gli ultimi 0,18 s
  sfumano sul punto di taglio (prima si tagliava a secco e si sentiva lo scalino).
- **Normalizzazione:** il silenzio si toglie *dopo* il `loudnorm`, non prima: se
  il filtro riceve il file già tagliato, su molti campioni rinuncia al guadagno
  e il suono resta 10 dB sotto il bersaglio. Dopo il primo giro lo script misura
  il file finito e corregge il guadagno sulla misura vera, per un massimo di
  tre passate, perché la coda tagliata cambia la loudness rispetto alla misura
  sul file intero.
- **Compressione a gradini:** se dopo il giro pulito lo scarto supera 0,6 dB,
  il tentativo successivo entra con un `acompressor` leggero e, se non basta,
  con uno più deciso prima del limitatore. Ogni gradino si tiene solo se
  avvicina al bersaglio, così nessun file peggiora per colpa della compressione.
- Suoni sotto 1,2 s: normalizzati sul picco a −3 dBFS, non sul LUFS (misura
  integrata senza senso su 20–300 ms). Restano sul picco anche
  `interface/whoosh.m4a` (0,9 s, quasi tutta cresta: −18,5 LUFS, picco
  −4,2 dBFS) e `gioco/racket.m4a` (0,1 s, picco −9,1 dBFS).
- **Loop:** stereo 44,1 kHz, AAC 112 kbps, **−23 LUFS**, 60–120 s
  **obbligatori**; il massimo si taglia da solo, il minimo no: sotto i 60 s il
  file viene scartato e cancellato, non pubblicato «corto ma va bene». Il
  silenzio non si tocca, altrimenti si sentirebbe il buco a ogni giro.
- **Loop senza salto:** gli ultimi 1,5 s vengono incrociati sulla testa
  (dissolvenza coda→inizio) e l'incrocio è **garantito**, non un'abbreviazione
  facoltativa: lo script controlla che il giro sia più corto del grezzo
  esattamente di 1,5 s e, se non lo è, scarta il file. Poi misura il punto di
  giunzione (differenza fra ultimo e primo campione): sopra l'**8%** il file si
  scarta, perché il click si sentirebbe a ogni giro.
- **`--check` misura anche i loop già in casa:** durata nella finestra 60–120 s e
  salto sotto l'8% valgono per i file nuovi come per quelli già pubblicati. Il
  rotolamento `loop/biglie.m4a` è l'unica eccezione alla durata: non è musica,
  sono 24 s di biglie che scorrono.
- `ffmpeg` è **statico e locale al progetto**, niente sudo: `.tools/ffmpeg/ffmpeg`
  e `ffprobe` (build 7.0.2 arm64 da johnvansickle.com, ~19 MB scaricati, 102 MB
  estratti; su x86 usa `ffmpeg-release-amd64-static.tar.xz`). `.tools/` è già in
  `.gitignore`. `FFMPEG_PATH`/`FFPROBE_PATH` scavalcano il percorso.
- `--check` non elabora: elenca i file mancanti e controlla i crediti. Ogni
  file presente deve avere la sua riga in `FONTI.txt`; ogni riga deve citare un
  file che esiste davvero, previsto dal manifesto, con i cinque campi completi
  e un URL valido. Righe doppie, fuori manifesto o citazioni di file inesistenti
  fanno uscire con codice 1: così i crediti non si compilano a metà.
- Anche l'elaborazione normale segnala, alla fine, i file presenti senza riga in
  `FONTI.txt`.
- Alla fine stampa una tabella con durata, peso, LUFS misurati e picco di ogni
  file; i file mancanti restano elencati. La cartella temporanea viene pulita.
- Con un file mancante l'audio non suona e lo segnala in console: non si torna
  alla sintesi, così il buco si vede subito.

## Struttura delle cartelle

```
apps/frontend/public/assets/audio/
├── FONTI.txt          # metadati che scrivi tu, uno per file
├── interface/         # countdown, tick, conferme del telefono
├── gioco/             # esiti, gong, sirena, monete, racchetta
├── casino/            # roulette: giro e atterraggio
├── sala/              # applausi, rullo, fanfara, podio
├── bonus/             # i cinque ingressi bonus
├── attesa/            # battito, ticchettio (loop brevi)
└── loop/              # i venti sottofondi (5 atti + 14 giochi + rotolamento)
```

## Effetti: tabella evento → ricerca → file atteso

`bus` dice dove si sente: `TV` (sala), `telefono`, `entrambi`.
La durata è il **massimo** dopo il taglio; più corti vanno bene.

### `interface/` — interfaccia e conto alla rovescia

| Evento | File atteso | Bus | Max | Parole di ricerca (EN) | Fonte suggerita |
|---|---|---|---|---|---|
| `countdownTick` | `interface/countdownTick.m4a` | TV | 0,3 s | `wood block tick`, `metronome tick`, `clock tick single` | Kenney Interface / Freesound CC0 |
| `countdownBong` | `interface/countdownBong.m4a` | TV | 2 s | `low bell hit`, `timpani hit`, `gong low single` | Nostra (sintesi renderizzata) |
| `join` | `interface/join.m4a` | TV | 1 s | `wooden knock`, `ui pop short`, `marimba ding` | Kenney UI Audio |
| `tick` | `interface/tick.m4a` | TV | 0,25 s | `click tick single`, `ui tick`, `wooden click` | Kenney Interface |
| `rankReveal` (5°) | `interface/rankReveal-1.m4a` | TV | 1,5 s | `whoosh short`, `paper slide`, `drum fill short` | Pixabay / Freesound CC0 |
| `rankReveal` (4°) | `interface/rankReveal-2.m4a` | TV | 1,5 s | `cymbal swell short`, `riser short` | Pixabay |
| `whoosh` | `interface/whoosh.m4a` | TV | 1 s | `whoosh transition`, `air swoosh short` | Nostra (sintesi renderizzata) |
| `confirm` | `interface/confirm.m4a` | telefono | 0,4 s | `ui confirm beep`, `soft chime single`, `click confirm` | Kenney Interface |
| `error` | `interface/error.m4a` | telefono | 0,6 s | `low buzz short`, `error beep`, `wooden thud` | Kenney UI Audio |

### `gioco/` — esiti e momenti di gioco

| Evento | File atteso | Bus | Max | Parole di ricerca (EN) | Fonte suggerita |
|---|---|---|---|---|---|
| `gong` | `gioco/gong.m4a` | TV | 3 s | `gong`, `temple bell`, `soft mallet gong` | Nostra (sintesi renderizzata) |
| `correct` | `gioco/correct.m4a` | TV | 1,5 s | `soft chime`, `marimba ding`, `glass tap` | Freesound CC0 |
| `wrong` | `gioco/wrong.m4a` | TV | 1,5 s | `low buzz`, `wooden thud`, `sad trombone short` | Pixabay |
| `timeUp` | `gioco/timeUp.m4a` | TV | 2 s | `buzzer`, `alarm beep short`, `game show timeout` | Freesound CC0 |
| `reveal` | `gioco/reveal.m4a` | TV | 3 s | `riser whoosh`, `snare roll short`, `magic reveal` | Pixabay / Mixkit |
| `elimination` | `gioco/elimination.m4a` | TV | 2 s | `sad trombone`, `low thud`, `game over sting` | Pixabay |
| `uuuh` | `gioco/uuuh.m4a` | TV | 2 s | `crowd uuuh`, `crowd disappointed`, `boo short` | Freesound CC0 (folla) |
| `bombSiren` | `gioco/bombSiren.m4a` | entrambi | 4 s | `alarm siren short`, `police siren`, `bomb siren` | Freesound CC0 |
| `fuse` | `gioco/fuse.m4a` | TV | 2 s | `fuse burning`, `sizzle`, `spark` | Nostra (sintesi renderizzata) |
| `coins` | `gioco/coins.m4a` | TV | 2,5 s | `coins drop`, `casino chips stack`, `coin clink` | Nostra (sintesi renderizzata) |
| `explosion` | `gioco/explosion.m4a` | telefono | 2 s | `boom`, `detonation`, `debris` | Nostra (sintesi renderizzata) |
| `racket` | `gioco/racket.m4a` | telefono | 0,5 s | `ping pong hit`, `tennis ball hit`, `puck hit table` | Nostra (sintesi renderizzata) |
| `marbleHit` | `gioco/marbleHit.m4a` | TV | 0,4 s | `marble hit`, `glass marble clack`, `billiard ball click` | Nostra (sintesi renderizzata) |
| `marbleWall` | `gioco/marbleWall.m4a` | TV | 0,4 s | `wood knock short`, `marble against rail` | Nostra (sintesi renderizzata) |
| `marbleSurfaceHard` | `gioco/marbleSurfaceHard.m4a` | TV | 0,4 s | `hard tick`, `stone pebble click` | Nostra (sintesi renderizzata) |
| `marbleSurfaceSoft` | `gioco/marbleSurfaceSoft.m4a` | TV | 0,5 s | `soft thud`, `sand thump short` | Nostra (sintesi renderizzata) |
| `bell` | `gioco/bell.m4a` | TV | 2 s | `hand bell`, `service bell ding`, `bicycle bell single` | Freesound CC0 |

### `casino/` — roulette

| Evento | File atteso | Bus | Max | Parole di ricerca (EN) | Fonte suggerita |
|---|---|---|---|---|---|
| `rouletteTicks` | `casino/rouletteTicks.m4a` | TV | 8 s, loopabile | `roulette wheel spin`, `roulette ball bounce`, `casino ambience loop` | Freesound CC0 |
| `rouletteLanding` | `casino/rouletteLanding.m4a` | TV | 2 s | `roulette ball drop`, `ball settle pocket`, `chip drop` | Kenney Casino / Freesound CC0 |

### `sala/` — pubblico e premiazioni

| Evento | File atteso | Bus | Max | Parole di ricerca (EN) | Fonte suggerita |
|---|---|---|---|---|---|
| `applause` | `sala/applause.m4a` | TV | 5 s | `crowd applause`, `clapping crowd short` | Pixabay / Freesound CC0 |
| `drumroll` | `sala/drumroll.m4a` | TV | 10 s, loopabile | `drum roll`, `snare roll loop`, `timpani roll` | Pixabay / Sonniss |
| `podium` | `sala/podium.m4a` | TV | 4 s | `fanfare short`, `brass fanfare`, `victory sting` | Pixabay / Mixkit |
| `podiumReveal` 3° | `sala/podiumReveal-3.m4a` | TV | 2 s | `cymbal swell`, `drum hit accent`, `brass stab` | Pixabay |
| `podiumReveal` 2° | `sala/podiumReveal-2.m4a` | TV | 2 s | `cymbal swell`, `brass stab short` | Pixabay |
| `podiumReveal` 1° | `sala/podiumReveal-1.m4a` | TV | 2,5 s | `big finish`, `orchestra hit`, `confetti cannon` | Pixabay / Mixkit |

### `bonus/` — i cinque ingressi

L'indice segue l'ordine del catalogo: 1 Casino Nero e Rosso, 2 Blackjack,
3 Casino Dozzina, 4 Cavallo, 5 Casino Finale.

| Evento | File atteso | Bus | Max | Parole di ricerca (EN) | Fonte suggerita |
|---|---|---|---|---|---|
| `bonusEntrance` 1 | `bonus/bonusEntrance-1.m4a` | TV | 3,5 s | `casino lounge sting`, `roulette wheel flourish`, `lucky spin jingle` | Pixabay / Mixkit |
| `bonusEntrance` 2 | `bonus/bonusEntrance-2.m4a` | TV | 3,5 s | `card shuffle`, `card deal riffle`, `poker sting` | Kenney Casino |
| `bonusEntrance` 3 | `bonus/bonusEntrance-3.m4a` | TV | 3,5 s | `dice roll on table`, `casino chips`, `crap table sting` | Kenney Casino |
| `bonusEntrance` 4 | `bonus/bonusEntrance-4.m4a` | TV | 3,5 s | `horse gallop`, `race start bell`, `hoof beats short` | Freesound CC0 |
| `bonusEntrance` 5 | `bonus/bonusEntrance-5.m4a` | TV | 3,5 s | `slot machine win`, `jackpot jingle`, `big win fanfare` | Pixabay / Mixkit |

### `attesa/` — loop brevi

| Evento | File atteso | Bus | Max | Parole di ricerca (EN) | Fonte suggerita |
|---|---|---|---|---|---|
| `heartbeat` | `attesa/heartbeat.m4a` | TV | 2 s, loopabile | `heartbeat loop`, `heartbeat slow`, `sub thump` | Freesound CC0 |
| `clock` | `attesa/clock.m4a` | TV | 1 s, loopabile | `clock tick loop`, `wall clock tick`, `watch ticking` | Freesound CC0 |

## Sottofondi: venti loop, per atto e per gioco

Niente più generazione a ogni battuta: **venti file in cartella**, con
dissolvenza incrociata di 1,5 s a ogni cambio. Sette sono registrazioni scelte
dalle librerie, tredici sono resi in casa da `scripts/audio/generate-loops.mjs`.
Volume basso, sotto la voce del presentatore. Strumentali, loop pulito senza
finale, nessuna voce cantata, 60–120 s, −23 LUFS.

Regola di riproduzione (solo TV; il telefono non suona sottofondi):

1. **Base d'atto**: ogni atto ha il suo file e suona di default fra un round e
   l'altro, nella classifica e nei giochi senza sottofondo proprio.
2. **Sottofondo del gioco**: se il gioco ne ha uno, sostituisce la base d'atto
   con la dissolvenza; a fine gioco si torna alla base d'atto. Mai due brani
   insieme, mai uno stacco secco.
3. **Senza sottofondo proprio**: Musica suona nel silenzio; il Time Buzzer usa il loop dell'orologeria; i
   flash hanno sirene ed effetti loro; Quiz e Indovina chi tengono la base
   d'atto abbassata di altri 6 dB mentre c'è la domanda.
4. Il ducking sotto la voce resta com'è.

### Base d'atto (5 file)

| Atto | File atteso | Carattere | BPM | Parole di ricerca (EN) | Fonte suggerita |
|---|---|---|---|---|---|
| 1 | `loop/atto-1.m4a` | Aperitivo: caldo, leggero, accogliente | 95-110 | `light jazz`, `bossa nova`, `happy acoustic` | Mixkit / Pixabay |
| 2 | `loop/atto-2.m4a` | Si scalda: groove | 100-115 | `funky groove`, `soul instrumental`, `groovy` | Mixkit / Pixabay |
| 3 | `loop/atto-3.m4a` | Notte di sala: lounge elettronico | 105-120 | `chill electronic`, `deep lounge`, `nu-jazz` | Mixkit / Pixabay |
| 4 | `loop/atto-4.m4a` | Sale l'energia: pop-rock/disco | 118-128 | `upbeat indie`, `disco instrumental`, `feel good rock` | Mixkit / Pixabay |
| 5 | `loop/atto-5.m4a` | Finale: festoso e importante | 120-135 | `epic upbeat`, `big band energetic`, `celebration` | Mixkit / Pixabay |

### Giochi e bonus (14 file)

I sei file già arrivati hanno preso il nome nuovo: `casino.m4a` è
`gioco-casino`, `tensione.m4a` è `gioco-bomba`, `sport.m4a` è
`gioco-tennis`, `leggero.m4a` è `gioco-cavallo`, `pub.m4a` è `lobby`.

| Dove suona | File atteso | Carattere | BPM | Parole di ricerca (EN) | Fonte suggerita |
|---|---|---|---|---|---|
| Casinò (Ruota, Nero e Rosso, Dozzina) | `loop/gioco-casino.m4a` | casinò, ritmo medio | 100-115 | `vegas lounge`, `crime jazz`, `poker night` | Incompetech (CC-BY) / Pixabay |
| Bomba | `loop/gioco-bomba.m4a` | tensione che sale | 100-120 | `tension percussion loop`, `suspense pulse loop`, `rising tension bed` | Mixkit / Pixabay |
| Tennis | `loop/gioco-tennis.m4a` | scontro sportivo | 120-135 | `energetic sport loop`, `driving rock loop no vocals`, `uptempo drums bass` | Mixkit / Pixabay |
| Cavallo | `loop/gioco-cavallo.m4a` | leggero e curioso | 100-115 | `quirky marimba loop`, `playful pizzicato loop`, `curious light background` | Pixabay / Mixkit |
| Lobby e attesa fra i round | `loop/lobby.m4a` | allegro da pub | 95-110 | `upbeat pub jazz loop`, `swing small band loop`, `light jazz trio` | Mixkit / Pixabay |
| Classifiche, podio, attesa dei bonus | `loop/classifica.m4a` | festoso, cerimonia | 110-125 | `festive fanfare loop`, `celebration music loop`, `award ceremony loop` | Pixabay / Mixkit |
| Arena | `loop/gioco-arena.m4a` | scontro, percussioni cattive | 130-145 | `battle drums`, `aggressive electronic`, `fight` | Mixkit / Pixabay |
| Speed Rush | `loop/gioco-speed-rush.m4a` | corsa, sintetizzatori incalzanti | 135-150 | `fast arcade`, `chiptune race`, `drive electronic` | Mixkit / Pixabay |
| Biglie | `loop/gioco-biglie.m4a` | corsa allegra, cartoon | 120-135 | `fun racing`, `quirky playful`, `kids adventure` | Mixkit / Pixabay |
| Timeline | `loop/gioco-timeline.m4a` | concentrazione leggera, orologeria | 90-105 | `thinking music`, `light puzzle`, `quirky pizzicato` | Mixkit / Pixabay |
| Ultima Spiaggia | `loop/gioco-ultima-spiaggia.m4a` | ultima occasione, tensione che sale | 100-120 | `suspense light`, `heist`, `countdown tension` | Mixkit / Pixabay |
| Azzardo | `loop/gioco-azzardo.m4a` | casinò, ritmo medio | 100-115 | `vegas lounge`, `crime jazz`, `poker night` | Incompetech (CC-BY) / Pixabay |
| Blackjack | `loop/gioco-blackjack.m4a` | jazz lento da tavolo | 80-95 | `smoky jazz`, `late night piano`, `noir` | Incompetech (CC-BY) / Pixabay |
| Casino Finale | `loop/gioco-casino-finale.m4a` | l'ultimo giro: drammatico, solenne | 70-90 | `cinematic tension`, `high stakes`, `dramatic strings` | Mixkit / Pixabay |

### Rotolamento delle Biglie (nostro)

| Dove suona | File atteso | Carattere | BPM | Parole di ricerca (EN) | Fonte suggerita |
|---|---|---|---|---|---|
| Gara delle Biglie, sotto il tappeto | `loop/biglie.m4a` | biglie che rotolano, non è musica | — | `marbles rolling loop`, `glass bead roll`, `marble on concrete loop` | Nostra (sintesi renderizzata) |

Il rotolamento delle Biglie è un loop breve (24 s, `scripts/audio/render-marble-roll.mjs`):
corpo che scorre, fruscio del fondo e ticchi delle biglie. Un solo file, otto
ascolti: `marble-roll.ts` cambia passo e taglio delle alte per ogni pista —
la sabbia rallenta e chiude, l'asfalto corre e apre, il vetro resta brillante.

Ogni loop, con carattere, durata, peso e ruolo (dove suona oggi e cosa
gli tocca quando il file arriva), sta in `docs/SOTTOFONDI.md` (§4.7): è la
lettura dei file che ci sono, non un secondo elenco di desideri.

## Conto dei file

- 41 effetti (34 eventi con varianti: `rankReveal` ×2, `podiumReveal` ×3,
  `bonusEntrance` ×5)
- 20 loop: 5 basi d'atto, 14 giochi e bonus, il rotolamento delle Biglie
- **61 file** previsti, tutti in casa. I venti loop pesano **21,70 MB** sui
  22 MB del tetto; l'atto più carico (il 4) sta a 5,86 MB sui 6. Sette loop sono
  registrazioni scelte da librerie, tredici sono resi in casa da
  `scripts/audio/generate-loops.mjs` e nei crediti compaiono come «Nostra
  (sintesi renderizzata)». Se un file va rifatto, meglio accorciarlo che alzare
  il tetto.

## Cosa non si tocca

Ducking sotto la voce, volumi di regia, logica dei giochi, catalogo degli
eventi e pagina `/audio` restano quelli di oggi: cambia solo da dove arriva il
suono. La regia guadagna la sezione dei sottofondi per atto e per gioco con il
peso di ognuno (§4.5): è una lettura, non un cambio di suono. La sintesi è stata rimossa il 18 novembre 2026: niente `bed-profiles.ts`,
niente Foley, e di `audio-dsp.ts` resta solo la coda di stanza (`createRoom`).
