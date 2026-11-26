# Sticker quizzOne

Due famiglie di adesivi, stesso linguaggio grafico (carta e inchiostro, Anton,
texture del tema, ombra offset, alone bianco):

- **8 sticker del marchio** — badge a 10 lati, 180 × 84 mm (viewBox 1200 × 560),
  wordmark `quizzOne` con parola in due colori. Sono quelli nati con il brand.
- **25 loghi dei giochi** — tondi, Ø 84 mm su tela 90 × 90 mm (viewBox
  1200 × 1200), un pittogramma solo tipo icona/emoji, nessun testo. Ognuno usa
  palette e texture di uno degli 8 temi.
- **8 facce** — Sorriso, Occhiolino, Risata, Innamorato, Stupito, Arrabbiato,
  Assonnato, Festa. Stessa costruzione di «Ultimi ma felici» (un oggetto con la
  faccia), un'emozione per sticker, una per tema: servono a commentare la
  partita sul tavolo e sul telefono.

Tutto nasce da un solo modello: `scripts/stickers/build.mjs` legge
`temi.json` (palette, texture, macchie, icone dei badge) e `sticker.json`
(soggetti) e scrive gli SVG, i PNG a 300 dpi e i PDF.

## Generare

Serve Node (il repo usa già Node 26) e una installazione locale delle
dipendenze del generatore, separate da quelle dell'app:

```bash
cd scripts/stickers
npm install
node build.mjs            # tappa 1: 8 badge + Bomba, Casino, Karaoke
node build.mjs --tappa 2  # tutto il pack + fogli A4 + PDF
```

Opzioni:

| Comando | Effetto |
| --- | --- |
| `node build.mjs --test` | esegue solo i test, non scrive niente |
| `node build.mjs --solo bomba` | genera un solo sticker (debug) |
| `node build.mjs --diff <cartella>` | confronto pixel con una cartella di SVG originali |

Output:

```
docs/stickers/quizzone-*.svg          33 SVG, testo in tracciati
docs/stickers/png/quizzone-*.png      33 PNG a 300 dpi (2126×992 badge, 1063×1063 loghi)
docs/stickers/pdf/quizzone-fogli-90x42.pdf     foglio A4, 12 sticker
docs/stickers/pdf/quizzone-fogli-180x84.pdf    fogli A4, 3 sticker per foglio
docs/stickers/pdf/quizzone-fogli-loghi.pdf     fogli A4, 4 loghi tondi per foglio (7 pagine)
docs/stickers/pdf/quizzone-pack-completo.pdf   prova colore + tutti i fogli
```

## Come è fatto un SVG

Stessi livelli per tutti, con gli id che servono allo stampatore:

| Livello | Contenuto |
| --- | --- |
| `Fondo` | ombra traslata di 18, alone bianco (tratto 48), corpo con filo scuro (7) |
| `Texture` | pattern del tema ritagliato sulla sagoma (`clip`), opacità 0,70–0,76 |
| `Icone` | le due icone d'angolo dei badge del marchio |
| `Logo` | il pittogramma dei giochi tondi |
| `Testo` | wordmark convertito in `<path>`: nessun font esterno nel file |
| `CutContour` | sagoma del taglio, tratto 0,25 pt (0,588 unità), magenta spot `#FF00FF` |

Il testo è in tracciati con opentype.js dallo stesso `anton-latin.woff2` del
repo: si apre identico ovunque, senza il webfont accanto. Il `CutContour` non
entra mai nei PNG (serve solo alla fustella).

## Test

`node build.mjs --test` controlla, per ogni sticker: XML renderizzabile
(resvg), `viewBox` e misure in mm invariati, presenza del `CutContour`,
nessun `<text>` residuo (loghi), tutti i caratteri convertiti in glifi
(badge), nessun elemento fuori dal badge o dal cerchio, tema presente in
`temi.json`.

I PNG sono a 300 dpi reali: 2126 × 992 px per i badge (180 × 84 mm) e
1063 × 1063 px per i tondi (tela 90 mm, cerchio Ø 84 mm = 993 px), con il
chunk `pHYs` che dichiara la densità: senza, molti programmi li leggerebbero
a 72 dpi.

Verifica di non regressione dei badge: `node build.mjs --diff <cartella>` con
gli SVG originali. Il confronto attuale dà 94–120 pixel diversi su 672.000
(0,014%, solo arrotondamenti di bordo).

## Stampare

1. Stampare i PDF **al 100%**, senza “adatta alla pagina”. Il foglio A4 è
   210 × 297 mm e i crocini sono a 2 mm dal vivo.
2. Carta adesiva A4 (bianca opaca o trasparente) oppure invio in tipografia.
3. Taglio a mano lungo i crocini; per la fustella, dare allo stampatore il
   livello `CutContour` come spot magenta (i PDF qui non lo contengono: è negli
   SVG).
4. L'abbondanza di 2 mm è dentro l'artboard: l'alone bianco arriva a circa
   3,6 mm oltre la linea di taglio dei badge e a 1,8 mm per i tondi. Nei fogli
   PDF l'abbondanza è anche disegnata come carta colorata sotto ogni sticker.

Formati: badge 180 × 84 mm (grande) o 90 × 42 mm (piccolo, stessa
proporzione); loghi tondi Ø 84 mm. Il `foglio di prova` in testa al pack
completo serve per controllare i colori prima di stampare.

## Aggiungere un soggetto

In `sticker.json`:

```json
{ "slug": "quizzone-nome", "titolo": "Nome", "tema": "deep-ocean",
  "tappa": 2, "formato": "logo", "logo": "biglia" }
```

Per un logo nuovo serve una voce in `LOGHI` dentro `build.mjs` (riquadro
locale 600 × 600, colori da `p.paper`, `p.ink`, `p.accent`, `p.second`,
`p.shadow`) oppure un pittogramma Phosphor. Il tema deve esistere in
`temi.json`. I test dicono subito se il disegno esce dal cerchio.

## Crediti e licenze

- **Anton** (font del wordmark) — SIL Open Font License 1.1, testo della
  licenza in `OFL.txt`. Il file `anton-latin.woff2` resta nel repo come
  sorgente per la conversione in tracciati; gli SVG finali non lo usano.
- **Phosphor Icons** (`@phosphor-icons/core`) — MIT. Usata come sagoma piena
  per il cavallo di battaglia; le altre icone dei badge sono disegnate a mano
  nello stesso stile (tratto 5, spigoli vivi).
- **Texture** — tutte ricavate dagli sticker originali del marchio e ridisegnate
  come `<pattern>`: nessun pattern di terze parti (Hero Patterns non è stato
  usato).
- **Strumenti** — opentype.js (MIT), svgo (MIT), @resvg/resvg-js (MPL 2.0),
  pdf-lib (MIT), pngjs (MIT), pixelmatch (ISC).
- Il logo e i nomi dei giochi sono del progetto quizzOne: gli sticker sono per
  la serata, non per la vendita.
