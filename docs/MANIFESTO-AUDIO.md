# Manifesto audio — suoni registrati

Fase 0 della sostituzione dell'audio sintetizzato (SPEC-SUONI-REALI.md).

**Stato:** manifesto e cartelle pronti. I file **non** sono ancora nel repository e
il codice suona ancora la sintesi: si passa ai campioni un evento alla volta
(ordine della sezione 9) dopo che i file sono stati scelti e messi nelle cartelle.

## Regole dei file

- **Formato:** AAC in contenitore `.m4a` (Safari iOS lo suona senza problemi).
  Mai MP3 per i loop: il piccolo silenzio in fondo fa scattare la ripetizione.
- **Effetti:** mono, 44,1 kHz, AAC 96–128 kbps, normalizzati a **−16 LUFS**
  (picco massimo −1 dBTP), coda breve tagliata.
- **Sottofondi:** stereo, 44,1 kHz, AAC 128 kbps, **−23 LUFS**, 90–120 secondi,
  senza voce cantata, inizio e fine che si incrociano in loop.
- **Nome del file:** esattamente quello della tabella. Sostituire un suono =
  sostituire il file con lo stesso nome, senza toccare il codice.
- **Licenze ammesse:** CC0, Pixabay, Mixkit, royalty-free Sonniss, CC-BY **solo**
  con attribuzione scritta nei crediti. Mai CC-BY-NC, «solo uso personale»,
  estratti da film o da giochi.
- **Peso:** tutto `public/assets/audio/` sotto **15 MB**.
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
qui sopra (è l'unica fonte dei nomi), trova i grezzi, taglia il silenzio ai due
estremi **solo agli effetti**, normalizza a due passate con `loudnorm`, converte
in AAC `.m4a` e misura il risultato con `ebur128`.

```bash
node scripts/audio/process-audio.mjs            # elabora quel che trova
node scripts/audio/process-audio.mjs --check    # verifica file e metadati: esce 1 se manca qualcosa
node scripts/audio/process-audio.mjs --only gong
node scripts/audio/process-audio.mjs --force    # rifà anche gli m4a già pronti
```

- Effetti: mono 44,1 kHz, AAC 96 kbps circa, **−16 LUFS**, picco ≤ −1 dBTP,
  durata massima della tabella.
- Loop: stereo 44,1 kHz, AAC 128 kbps, **−23 LUFS**, massimo 120 s; il silenzio
  non viene toccato, altrimenti si sentirebbe il buco a ogni giro.
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
└── loop/              # i sei sottofondi (loop lunghi)
```

## Effetti: tabella evento → ricerca → file atteso

`bus` dice dove si sente: `TV` (sala), `telefono`, `entrambi`.
La durata è il **massimo** dopo il taglio; più corti vanno bene.

### `interface/` — interfaccia e conto alla rovescia

| Evento | File atteso | Bus | Max | Parole di ricerca (EN) | Fonte suggerita |
|---|---|---|---|---|---|
| `countdownTick` | `interface/countdownTick.m4a` | TV | 0,3 s | `wood block tick`, `metronome tick`, `clock tick single` | Kenney Interface / Freesound CC0 |
| `countdownBong` | `interface/countdownBong.m4a` | TV | 2 s | `low bell hit`, `timpani hit`, `gong low single` | Freesound CC0 |
| `join` | `interface/join.m4a` | TV | 1 s | `wooden knock`, `ui pop short`, `marimba ding` | Kenney UI Audio |
| `tick` | `interface/tick.m4a` | TV | 0,25 s | `click tick single`, `ui tick`, `wooden click` | Kenney Interface |
| `rankReveal` (5°) | `interface/rankReveal-1.m4a` | TV | 1,5 s | `whoosh short`, `paper slide`, `drum fill short` | Pixabay / Freesound CC0 |
| `rankReveal` (4°) | `interface/rankReveal-2.m4a` | TV | 1,5 s | `cymbal swell short`, `riser short` | Pixabay |
| `whoosh` | `interface/whoosh.m4a` | TV | 1 s | `whoosh transition`, `air swoosh short` | Pixabay / Mixkit |
| `confirm` | `interface/confirm.m4a` | telefono | 0,4 s | `ui confirm beep`, `soft chime single`, `click confirm` | Kenney Interface |
| `error` | `interface/error.m4a` | telefono | 0,6 s | `low buzz short`, `error beep`, `wooden thud` | Kenney UI Audio |

### `gioco/` — esiti e momenti di gioco

| Evento | File atteso | Bus | Max | Parole di ricerca (EN) | Fonte suggerita |
|---|---|---|---|---|---|
| `gong` | `gioco/gong.m4a` | TV | 3 s | `gong`, `temple bell`, `soft mallet gong` | Freesound CC0 |
| `correct` | `gioco/correct.m4a` | TV | 1,5 s | `soft chime`, `marimba ding`, `glass tap` | Freesound CC0 |
| `wrong` | `gioco/wrong.m4a` | TV | 1,5 s | `low buzz`, `wooden thud`, `sad trombone short` | Pixabay |
| `timeUp` | `gioco/timeUp.m4a` | TV | 2 s | `buzzer`, `alarm beep short`, `game show timeout` | Freesound CC0 |
| `reveal` | `gioco/reveal.m4a` | TV | 3 s | `riser whoosh`, `snare roll short`, `magic reveal` | Pixabay / Mixkit |
| `elimination` | `gioco/elimination.m4a` | TV | 2 s | `sad trombone`, `low thud`, `game over sting` | Pixabay |
| `uuuh` | `gioco/uuuh.m4a` | TV | 2 s | `crowd uuuh`, `crowd disappointed`, `boo short` | Freesound CC0 (folla) |
| `bombSiren` | `gioco/bombSiren.m4a` | entrambi | 4 s | `alarm siren short`, `police siren`, `bomb siren` | Freesound CC0 |
| `coins` | `gioco/coins.m4a` | TV | 2,5 s | `coins drop`, `casino chips stack`, `coin clink` | Kenney Casino |
| `racket` | `gioco/racket.m4a` | telefono | 0,5 s | `ping pong hit`, `tennis ball hit`, `puck hit table` | Kenney Impact / Freesound CC0 |
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

L'indice segue l'ordine del catalogo: 1 Casino Bianco e Nero, 2 Blackjack,
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

## Sottofondi: sei loop al posto dei sedici tappeti

Niente più generazione a ogni battuta: **sei famiglie** registrate, con
dissolvenza incrociata di 1,5 s al cambio gioco. Volume basso, sotto la voce
del presentatore. Durata 90–120 s, −23 LUFS, senza voce cantata.

| Famiglia | File atteso | Giochi | Parole di ricerca (EN) | Fonte suggerita |
|---|---|---|---|---|
| Pub allegro | `loop/pub.m4a` | Quiz, Canzone, Immagine sfocata, Timeline, Ultima Spiaggia, lobby | `upbeat pub jazz loop`, `swing small band loop`, `light jazz trio` | Incompetech (CC-BY) / Pixabay |
| Tensione | `loop/tensione.m4a` | Bomba, Arena, Time Buzzer, Speed Rush | `tension percussion loop`, `suspense pulse loop`, `rising tension bed` | Mixkit / Pixabay |
| Sport | `loop/sport.m4a` | Tennis, Biglie | `energetic sport loop`, `driving rock loop no vocals`, `uptempo drums bass` | Mixkit / Pixabay |
| Casino | `loop/casino.m4a` | Azzardo, Ruota, Blackjack, bonus Casino | `casino lounge loop`, `vintage lounge jazz`, `rat pack style loop` | Incompetech (CC-BY) / Pixabay |
| Leggero e curioso | `loop/leggero.m4a` | Cavallo, flash | `quirky marimba loop`, `playful pizzicato loop`, `curious light background` | Pixabay / Mixkit |
| Classifica e podio | `loop/classifica.m4a` | classifiche, podio, attesa dei bonus | `festive fanfare loop`, `celebration music loop`, `award ceremony loop` | Pixabay / Mixkit |

## Conto dei file

- 35 effetti (28 eventi con varianti: `rankReveal` ×2, `podiumReveal` ×3,
  `bonusEntrance` ×5)
- 6 loop
- **41 file** in tutto, dentro il limite di 15 MB (effetti ~2 MB, loop ~9 MB a
  128 kbps).

## Cosa non si tocca

Ducking sotto la voce, volumi di regia, logica dei giochi, catalogo degli
eventi e pagina `/audio` restano quelli di oggi: cambia solo da dove arriva il
suono. La sintesi (`audio-dsp.ts`, `bed-profiles.ts`, Foley) si rimuove alla
fine, dopo che tutti gli eventi suonano da file.
