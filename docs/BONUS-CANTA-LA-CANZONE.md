# Bonus «Canta la canzone» — canzoni candidate e testi

> **Sostituito dal Karaoke.** Il bonus in scaletta ora è `KARAOKE`: banca di 12
> canzoni, cinque manche estratte dal seed, clip da 30 secondi tagliate su un
> inizio riga e verdetto della regia. Questo documento resta come storia del
> contratto dei testi; i comandi operativi sono in `scripts/bonus/` e la banca
> sta in `questions/karaoke-bank.json`.

Stato: **fase 1**. La struttura tecnica dei testi è pronta e il bonus non è
ancora nel codice: le cinque canzoni le sceglie chi conduce la serata, non
l'agente. Questo documento raccoglie la proposta, la fattibilità dei testi e il
contratto dei file. Riferimento: `SPEC-CELEBRITA-3-MANCHE-E-BONUS.md` §2.

## Regole della manche (dalla specifica)

1. Parte la clip da 30 secondi e la TV mostra il testo in stile karaoke.
2. La musica si ferma all'improvviso, in un punto **casuale scelto dal server**:
   mai nei primi 5 secondi, mai negli ultimi 5, sempre a **fine riga**.
3. Silenzio: la TV tiene l'ultima riga e nasconde la successiva, compare
   «CHI CANTA?».
4. La prima squadra prenotata canta le due righe successive; la regia,
   **solo sul suo schermo**, vede le righe giuste e decide CORRETTO o SBAGLIATO.
5. SBAGLIATO non toglie punti, blocca quella squadra e **riapre le
   prenotazioni**; CORRETTO paga la manche e la chiude.
6. Trenta secondi dall'ultimo silenzio senza risposta, o RIVELA: nessun punto.
7. Pausa e refresh rientrano nello stato esatto (clip ferma, riga, bloccate).

Punti: 100 / 150 / 200 / 250 / 300, massimo **1000**, nessun malus.

## Testi: cosa sta nel repository e cosa no (D4)

| File | Dove | Cosa contiene |
| --- | --- | --- |
| `questions/lyrics-bonus-it.example.json` | **tracciato** | struttura completa con testi **inventati** |
| `questions/bonus-scelte.json` | locale, ignorato | le canzoni scelte, l'offset della clip e l'indice della riga di stop |
| `questions/lyrics-bonus-it.json` | locale, ignorato | righe della clip, tempi, punto di stop e due righe da cantare |

`scripts/bonus/scarica-testi.mjs` legge le scelte, chiede il testo sincronizzato
a **LRCLIB** (LRC, licenza aperta per i dati) e scrive il file locale. Se una
canzone non ha testo sincronizzato **non entra**: niente testi inventati.

Comandi:

```
cp apps/backend/src/main/resources/questions/lyrics-bonus-it.example.json \
   apps/backend/src/main/resources/questions/bonus-scelte.json   # poi si mettono i brani veri
node scripts/bonus/scarica-testi.mjs --check   # controlla senza scrivere
node scripts/bonus/scarica-testi.mjs           # scrive lyrics-bonus-it.json (locale)
```

Controlli bloccanti dello script: almeno 4 righe prima dello stop, almeno 2
righe da cantare dopo, stop a fine riga fra 5 e 25 secondi, tempi crescenti.

## Candidati (8) — scelta finale a chi conduce

Tutte le clip sono già nella banca locale (`/media/music/...`). «Testo» dice se
LRCLIB ha i tempi di riga: la risoluzione LRC è il centesimo di secondo
(**10 ms**); lo scarto vero rispetto all'audio dipende dall'offset della clip.

| # | Manche | Punti | Brano | Anno | Testo LRCLIB | Righe | Trappola (righe/4-grammi ripetuti) | Perché sta in quella fascia |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | 100 | **La solitudine** — Laura Pausini | 1993 | sì, 54 righe | 53 | 9 righe, 12 4-grammi | Ritornello che conosce chiunque, testo semplice e lento |
| 2 | 2 | 150 | **Certe notti** — Ligabue | 1995 | sì, 42 righe | 42 | 5 righe, 21 4-grammi | Notissima, ma le strofe sono lunghe: serve averla ascoltata |
| 3 | 3 | 200 | **Sere nere** — Tiziano Ferro | 2003 | sì, 34 righe | 32 | 6 righe, 27 4-grammi | Molto nota, attacco parlato: più difficile da intonare |
| 4 | 4 | 250 | **Bellissima** — Annalisa | 2022 | sì, 48 righe | 47 | **12 righe, 30 4-grammi** | Il ritornello torna spesso: la riga dopo lo stop non è una sola |
| 5 | 5 | 300 | **Luce (tramonti a nord est)** — Elisa | 2000 | sì, 55 righe | 54 | **una riga ripetuta 9 volte**, 16 4-grammi | Testo denso e ripetuto: il passaggio successivo si confonde con altri uguali |
| R1 | riserva | 150/200 | Più bella cosa — Eros Ramazzotti | 1996 | sì, 54 righe | 49 | 9 righe (max 5 volte), 12 4-grammi | Ritornello ripetuto, comodo per una manche centrale |
| R2 | riserva | 200/250 | L'essenziale — Marco Mengoni | 2013 | sì, 40 righe | 36 | 6 righe (max 5), 18 4-grammi | Sanremo, testo corto e ripetuto |
| R3 | riserva | 250/300 | Il regalo più grande — Tiziano Ferro | 2008 | sì, 52 righe | 51 | 9 righe, **49 4-grammi** | Molto ricco di ripetizioni: buona trappola per l'ultima manche |

Anche **Sally** (Vasco Rossi, 1996) e **Ti scatterò una foto** (Tiziano Ferro,
2006) hanno i testi sincronizzati (60 e 44 righe) e restano papabili: Sally è la
trappola più pulita del lotto, perché la stessa strofa torna con «senza nemmeno
guardare per terra» e poi con «sicura, senza pensare a niente».

**Escluso:** «Vita spericolata» (Vasco Rossi, 1982) — LRCLIB non ha il testo
sincronizzato, solo quello semplice. Per regola non entra nel bonus finché i
tempi non si scrivono a mano.

## Il punto aperto da tarare: l'offset della clip

I tempi di LRCLIB sono riferiti al brano intero (180–350 s), la clip è di 30
secondi presa a metà brano: l'offset (`offsetMs`) va misurato una volta per
canzone, ascoltando dove parte la clip. Lo script lo usa per portare le righe
sul tempo della clip; con l'offset sbagliato il karaoke va fuori sincrono anche
se i tempi LRC sono perfetti. Non è un dato che si può dedurre dal file audio
senza ascoltarlo: va fatto a mano, canzone per canzone, e resta locale.

## Cosa resta dopo la scelta delle cinque

- Mettere le cinque in `bonus-scelte.json`, tarare l'offset, lanciare lo script
  e verificare le righe con `--check`.
- Marcare le stesse cinque `riservata_bonus: true` nella banca canzoni e fare in
  modo che i round Musica le escludano sempre (test su 40 round).
- Tipo `SING_SONG`, primo slot di `BONUS_AFTER_ACT`, `BONUS_SCORING`, entrata,
  anteprima, regia, telefono, audio proprietario dei canali, stato della manche.
- Manuale, PDF, demo, README, registro, simulazione 40+5 e audit.
