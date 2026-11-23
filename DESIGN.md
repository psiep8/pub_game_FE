---
name: Pub Game
description: Il gioco del pub — quaranta round, una sola serata.
colors:
  bg-0: "#111109"
  paper: "#f1e4c9"
  paper-hi: "#fff8e8"
  paper-2: "#e3d2ae"
  coal: "#15150f"
  coal-2: "#23231a"
  acid: "#d9ff43"
  tomato: "#ff4d2e"
  cobalt: "#2f5bff"
  mustard: "#ffc53d"
  mint: "#8be3c4"
  ink: "#f4e8ce"
typography:
  display:
    fontFamily: "Anton, Impact, 'Arial Black', sans-serif"
    fontWeight: 400
    lineHeight: 0.85
    letterSpacing: "0.01em"
  body:
    fontFamily: "'Bricolage Grotesque', 'Trebuchet MS', Arial, sans-serif"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "'Space Mono', 'Courier New', monospace"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.acid}"
    textColor: "{colors.coal}"
    rounded: "{rounded.none}"
    padding: "14px 28px"
  button-secondary:
    backgroundColor: "{colors.paper-hi}"
    textColor: "{colors.coal}"
    rounded: "{rounded.none}"
    padding: "12px 22px"
  card:
    backgroundColor: "{colors.paper-hi}"
    textColor: "{colors.coal}"
    rounded: "{rounded.none}"
    padding: "16px"
---

# Design System: Pub Game

## Overview

**Creative North Star: "Il tabellone stampato del pub"**

Pub Game sembra un foglio di carta puntinata appena uscito da una fotocopiatrice
del pub: inchiostro nero pieno, timbri ruotati, etichette mono, tabelle con
righe sottili e ombre piene che sembrano carta sovrapposta. La TV è un tabellone
grande, il telefono è la scheda che ogni squadra tiene in mano.

Il colore è un gettone, non un decoro: acid segnala l'azione o lo stato attivo,
tomato l'errore o il pericolo, cobalt l'informazione, mustard il valore economico
(fiches, punti), mint la conferma. Il fondo è quasi sempre carta; il fondo scuro
`--bg-0` esiste per la scena TV e per i momenti di attesa, mai per "fare moderno".

**Key Characteristics:**
- Carta e inchiostro, con ombre offset piene e bordi neri spessi.
- Tipografia display enorme e compressa; dati sempre in mono.
- Radius 0 su ogni superficie; i cerchi solo per oggetti fisici.
- Nessun gradiente, vetro, blur o glow.

## Colors

Palette da stampa a due inchiostri più tre accenti semantici.

### Primary
- **Acid Lime** (#d9ff43): azione primaria, selezione, stato "pronto", fiches in
  gioco. Testo sopra: `--coal`.
- **Tomato Red** (#ff4d2e): errore, perdita, pericolo, timbri; mai come sfondo
  ampio.

### Secondary
- **Cobalt Blue** (#2f5bff): informazione neutra e link; testo sopra `--paper-hi`.
- **Mustard** (#ffc53d): denaro, punti, fiches a valore.
- **Mint** (#8be3c4): conferma e riuscita.

### Neutral
- **Coal** (#15150f): inchiostro, bordi, testo su carta.
- **Paper** (#f1e4c9) / **Paper Hi** (#fff8e8): superfici principali.
- **Bg 0** (#111109): scena TV e attese; testo `--paper`.
- **Ink** (#f4e8ce): testo chiaro sul fondo scuro.

### Named Rules
**The Gettone Rule.** Un accento alla volta su una schermata: acid per l'azione,
tomato per l'errore, mustard per il valore. Se due accenti competono, uno è di
troppo.

## Typography

**Display Font:** Anton (fallback Impact, Arial Black)
**Body Font:** Bricolage Grotesque (fallback Trebuchet MS, Arial)
**Label/Mono Font:** Space Mono (fallback Courier New)

**Character:** Anton urla i titoli come un manifesto; Bricolage tiene il testo
leggibile; Space Mono marca ogni numero, etichetta e dato come su un tabellone.

### Hierarchy
- **Display** (400, `clamp(4rem, 10vw, 10.5rem)`, 0.85): titoli TV e punteggi.
- **Headline** (700, `clamp(1.4rem, 2.4vw, 2.2rem)`, 1.1): titoli di pannello.
- **Title** (700, `1.05–1.3rem`, 1.2): nomi squadra e intestazioni.
- **Body** (500, `0.95–1.1rem`, 1.4): istruzioni e domande, max ~65ch.
- **Label** (700, `0.75–0.85rem`, 0.08em, uppercase): etichette, round, stati.

## Layout

La TV è una griglia a tutto schermo con contenuto centrato e dock in alto a
destra; il telefono è una colonna singola con margini di 16 px e comandi in fondo
al pollice. Le distanze seguono 4/8/16/24/40 px. A 1280×720 la gerarchia resta
identica, si riducono solo i corpi e si nasconde ciò che è decorativo.

## Elevation & Depth

Nessuna profondità morbida: le superfici sono carta piena e l'elevazione è
un'ombra offset netta, senza blur. Lo stato attivo aumenta l'offset o cambia
colore; non aggiunge alone.

### Shadow Vocabulary
- **Carta appoggiata** (`4px 4px 0 var(--coal)`): card e pulsanti.
- **Carta sollevata** (`6px 6px 0 var(--coal)`): pannelli e modali.
- **Timbro** (`5px 5px 0 var(--tomato)`): oggetti interattivi in evidenza.

### Named Rules
**The Flat-By-Default Rule.** A riposo tutto è piatto; l'ombra è carta, non
luce.

## Shapes

Radius 0 ovunque: card, pulsanti, campi, pannelli. I cerchi sono ammessi solo
quando rappresentano un oggetto fisico (fiche, palline, orologio, avatar). I
bordi sono pieni, 2–4 px, sempre `--coal` su carta o `--paper` su fondo scuro.

## Components

### Buttons
- **Shape:** rettangolo netto, radius 0, bordo 3 px.
- **Primary:** fondo `--acid`, testo `--coal`, ombra `4px 4px 0`.
- **Hover / Focus:** fondo `--tomato` o offset maggiore; focus visibile, mai glow.
- **Secondary:** fondo `--paper-hi`, bordo `--coal`; disabled con opacità 0.45.

### Chips (fiche)
- **Style:** cerchio 44 px, fondo `--mustard`, bordo 2 px `--coal`, anello
  tratteggiato interno, valore mono.
- **State:** pila sovrapposta con contatore; verde/acid se vinta, tomato se persa.

### Cards / Containers
- **Corner Style:** 0.
- **Background:** `--paper` o `--paper-hi`.
- **Shadow Strategy:** offset piena, vedi Elevation.
- **Border:** 2–4 px `--coal`.
- **Internal Padding:** 12–24 px.

### Inputs / Fields
- **Style:** fondo `--paper-hi`, bordo 3 px `--coal`, radius 0.
- **Focus:** bordo `--cobalt` e offset, nessun alone.
- **Error / Disabled:** bordo `--tomato`; disabled con testo attenuato.

### Navigation
Dock TV in alto a destra: pulsanti quadrati 44 px con bordo carta; etichette
mono. Sul telefono i comandi stanno in basso, a tutta larghezza, con area di
tocco ≥44 px.

## Do's and Don'ts

### Do:
- **Do** usare `var(--paper)`/`var(--paper-hi)` con testo `var(--coal)`.
- **Do** tenere bordi 2–4 px e ombre offset piene.
- **Do** usare `var(--font-mono)` per numeri, round e dati.
- **Do** verificare TV 1920×1080, 1280×720 e telefono 360–430 px.

### Don't:
- **Don't** usare gradienti, `backdrop-filter`, glow, neon o vetro.
- **Don't** arrotondare superfici (radius 10–26 px) o creare pillole.
- **Don't** usare colori fuori palette o emoji come decorazione animata.
- **Don't** copiare skin legacy (`restyle.css`) che usano il linguaggio vecchio.
