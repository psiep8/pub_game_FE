---
name: Pub Game
description: Il gioco del pub — quaranta round, una sola serata.
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
---

# Design System: Pub Game

## Overview

**Creative North Star: "Il tabellone stampato del pub"**

Pub Game sembra un foglio di carta puntinata appena uscito da una fotocopiatrice
del pub: inchiostro pieno, timbri ruotati, etichette mono, tabelle con righe
sottili e ombre piene che sembrano carta sovrapposta. La TV è un tabellone
grande, il telefono è la scheda che ogni squadra tiene in mano.

Il colore è un gettone, non un decoro: l'accento segnala l'azione o lo stato
attivo, il rosso l'errore, il blu l'informazione, il giallo il valore economico
(fiches, punti), il verde la conferma. La superficie è quasi sempre "carta"; il
fondo scuro esiste per la scena TV e per i momenti di attesa, mai per "fare
moderno".

**Key Characteristics:**
- Carta e inchiostro, con ombre offset piene e bordi spessi.
- Tipografia display enorme e compressa; dati sempre in mono.
- Radius 0 su ogni superficie; i cerchi solo per oggetti fisici.
- Nessun gradiente, vetro, blur o glow.
- Otto temi che cambiano **solo i colori**, mai forma, tipografia o movimento.

## Colors

Il sistema non fissa valori esadecimali: i colori vivono nei token di
`apps/frontend/src/styles.css` e ogni tema li ridefinisce. Un componente usa
sempre il **ruolo**, mai il colore letterale.

### Token semantici (contratto fisso)

- `--paper`, `--paper-hi`, `--paper-2`: superfici. Nei temi chiari sono carta;
  nei temi scuri sono superfici profonde.
- `--coal`, `--coal-2`: inchiostro e bordi sopra le superfici.
- `--ink`, `--ink-dim`, `--stroke`: testo e tratti sul fondo `--bg-0`.
- `--bg-0`, `--bg-1`, `--bg-2`: fondo della scena e degli strati.
- `--acid`: azione primaria, selezione, stato "pronto".
- `--tomato`: errore, perdita, pericolo.
- `--cobalt`: informazione e link.
- `--mustard`: denaro, punti, fiches.
- `--mint`: conferma e riuscita.
- `--acid-ink`, `--tomato-ink`, `--cobalt-ink`, `--mustard-ink`, `--mint-ink`:
  la versione leggibile dell'accento quando è testo su `--paper`.
- `--on-acid`, `--on-tomato`, `--on-cobalt`: inchiostro da usare **sopra** un
  fondo accento, deciso dal tema per restare leggibile.

**La regola del gettone.** Un accento alla volta su una schermata. Se due
accenti competono, uno è di troppo. Per il testo si usa la variante `-ink`, non
l'accento pieno.

### I temi

1. **Editorial Acid** (`editorial-acid`, predefinito): carta calda, inchiostro
   quasi nero, acid lime per l'azione, tomato per l'errore. È il riferimento
   visivo del progetto.
2. **Desert Heritage** (`desert-heritage`, nome storico `sabbia`): sabbia,
   terracotta e terra; accenti caldi e desaturati, sempre su superfici chiare.
3. **Arctic Noir** (`arctic-noir`): tema scuro; superfici navy, inchiostro
   ghiaccio, accento azzurro. `--paper` è scuro e `--coal` è chiaro: il
   contratto semantico resta, cambia la luminosità.
4. **Deep Ocean** (`deep-ocean`): fondo abissale, superfici verde-petrolio,
   accento teal luminoso.
5. **Kpop Aesthetic** (`kpop-aesthetic`): fondo prugna, carta rosa cipria,
   accento magenta.
6. **Neon Cyberpunk** (`neon-cyberpunk`): fondo quasi nero, accento magenta
   elettrico e ciano; il più aggressivo, da usare senza aggiungere glow.
7. **Sunset Pop** (`sunset-pop`): tramonto viola-arancio, carta pesca, accento
   corallo.
8. **Premium Gold** (`premium-gold`): fondo carbone, carta avorio, accento oro
   sobrio; l'alternativa "serale" ai temi pop.

I nomi storici `ink` (Editorial Acid) e `sabbia` (Desert Heritage) restano
accettati per compatibilità. Un tema non può introdurre radius, ombre, font o
animazioni diverse: cambia solo la palette.

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

Nessuna profondità morbida: le superfici sono piene e l'elevazione è un'ombra
offset netta, senza blur. Lo stato attivo aumenta l'offset o cambia colore; non
aggiunge alone.

### Shadow Vocabulary
- **Carta appoggiata** (`4px 4px 0`): card e pulsanti.
- **Carta sollevata** (`6px 6px 0`): pannelli e modali.
- **Timbro** (`5px 5px 0`): oggetti interattivi in evidenza.

L'ombra usa il token d'inchiostro del tema (`--coal`), non un nero fisso.

### Named Rules
**The Flat-By-Default Rule.** A riposo tutto è piatto; l'ombra è carta, non
luce.

## Shapes

Radius 0 ovunque: card, pulsanti, campi, pannelli. I cerchi sono ammessi solo
quando rappresentano un oggetto fisico (fiche, palline, orologio, avatar). I
bordi sono pieni, 2–4 px, sempre il token d'inchiostro del tema.

## Components

### Buttons
- **Shape:** rettangolo netto, radius 0, bordo 3 px.
- **Primary:** fondo `--acid`, testo `--on-acid`, ombra `4px 4px 0`.
- **Hover / Focus:** fondo `--tomato` o offset maggiore; focus visibile, mai glow.
- **Secondary:** fondo `--paper-hi`, testo `--coal`, bordo `--coal`; disabled con
  opacità 0.45.

### Chips (fiche)
- **Style:** cerchio 44 px, fondo `--mustard`, bordo d'inchiostro, anello
  tratteggiato interno, valore mono.
- **State:** pila sovrapposta con contatore; acid se vinta, tomato se persa.

### Cards / Containers
- **Corner Style:** 0.
- **Background:** `--paper` o `--paper-hi`.
- **Shadow Strategy:** offset piena, vedi Elevation.
- **Border:** 2–4 px nel token d'inchiostro.
- **Internal Padding:** 12–24 px.

### Inputs / Fields
- **Style:** fondo `--paper-hi`, testo `--coal`, bordo 3 px `--coal`, radius 0.
- **Focus:** bordo `--cobalt` e offset, nessun alone.
- **Error / Disabled:** bordo `--tomato`; disabled con testo attenuato.

### Navigation
Dock TV in alto a destra: pulsanti quadrati 44 px con bordo nel token `--paper`;
etichette mono. Sul telefono i comandi stanno in basso, a tutta larghezza, con
area di tocco ≥44 px.

## Do's and Don'ts

### Do:
- **Do** usare i token semantici (`--paper`, `--coal`, `--acid`, `--on-acid`,
  `--on-tomato`, `--on-cobalt`) invece di colori letterali, così gli otto temi
  restano coerenti.
- **Do** tenere bordi 2–4 px e ombre offset piene.
- **Do** usare `var(--font-mono)` per numeri, round e dati.
- **Do** verificare TV 1920×1080, 1280×720 e telefono 360–430 px, e almeno un
  tema scuro oltre a Editorial Acid.

### Don't:
- **Don't** fissare un hex in un componente o in questo documento: il valore vive
  nel tema.
- **Don't** usare gradienti, `backdrop-filter`, glow, neon o vetro.
- **Don't** arrotondare superfici (radius 10–26 px) o creare pillole.
- **Don't** usare emoji come decorazione animata o copiare skin legacy
  (`restyle.css`) con il linguaggio vecchio.
