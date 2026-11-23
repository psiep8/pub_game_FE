# Impeccable sulle pagine renderizzate

**Data:** 23 novembre 2026 · **motore:** Impeccable 4.10.0 · **browser:** Chromium
di Playwright (`chromium-1255/chrome-linux-arm64/chrome`) · **grafica non
modificata**.

## Metodo

Scansione eseguita con il detector di Impeccable sulle pagine **renderizzate**,
non sui sorgenti, a due viewport e due temi:

| Pagina | Viewport | Tema |
|---|---|---|
| TV intro | 1920×1080 | Editorial Acid (chiaro) |
| TV lobby | 1920×1080 | Editorial Acid |
| TV intro | 1920×1080 | Arctic Noir (scuro) |
| TV lobby | 1920×1080 | Arctic Noir |
| Telefono setup | 390×844 | Editorial Acid |
| Telefono setup | 390×844 | Arctic Noir |

Il tema è stato impostato via `localStorage` (`pubgame-theme`) prima del
caricamento. Poiché `/tv` non raggiunge mai `networkidle` (WebSocket sempre
aperto), il detector andava in timeout sulla pagina viva: ho salvato il DOM
renderizzato **dopo** aver chiuso l'intro e l'ho servito come pagina statica sullo
stesso dev server, poi l'ho scansionato con `npx impeccable detect <URL>
--viewport …`. Restano gli stili calcolati reali (fogli globali + `<style>` dei
componenti); spariscono solo gli script.

I temi sono **otto**; qui ne sono stati provati due, uno chiaro e uno scuro.

## Contrasto (WCAG AA)

### Editorial Acid

| Pagina | Elemento | Testo su fondo | Rapporto | Esito |
|---|---|---|---|---|
| TV intro | `.intro-kicker` | `#fff8e8` su `#ff4d2e` | **3.1:1** | warning (serve 4.5) |
| TV lobby | `.lobby-kicker` | `#fff8e8` su `#ff4d2e` | **3.1:1** | warning |
| TV lobby | `.qr-label` | `#ff4d2e` su `#f1e4c9` | **2.6:1** | warning |
| Telefono | placeholder `#team-name` | `#a19d91` su `#fff8e8` | **2.6:1** | advisory |

### Arctic Noir (scuro)

| Pagina | Elemento | Testo su fondo | Rapporto | Esito |
|---|---|---|---|---|
| TV intro | `h1.intro-logo` («PUB») | `#111e2d` su `#080f1a` | **1.1:1** | warning: il logo chiaro scompare |
| TV intro | `.intro-stamp` | `#dce8f2` su `#a9b9c9` | **1.6:1** | warning |
| TV intro | `.intro-kicker` | `#1b2b3d` su `#4169a8` | **2.6:1** | warning |
| TV intro | `button.intro-start` | `#dce8f2` su `#54bceb` | **1.7:1** | warning |
| TV lobby | `h1.lobby-title` | `#111e2d` su `#080f1a` | **1.1:1** | warning (+3 elementi) |
| TV lobby | `.lobby-kicker` | `#1b2b3d` su `#4169a8` | **2.6:1** | warning |
| TV lobby | `.qr-label` | `#4169a8` su `#111e2d` | **3.1:1** | warning |
| TV lobby | `.game-id-badge` | `#54bceb` su `#dce8f2` | **1.7:1** | warning |
| Telefono | placeholder `#team-name` | `#687785` su `#1b2b3d` | **3.1:1** | advisory |

**Lettura.** Il tema scuro non è pronto per la TV: il logo perde la parola
«PUB», il pulsante di avvio ha testo chiaro su accento chiaro e lo stamp in alto
si scioglie nel fondo. Anche il tema chiaro ha due punti ricorrenti: le etichette
bianche sul timbro tomato (3.1:1) e il QR label tomato su carta (2.6:1). Il
telefono se la cava con il solo placeholder del nome.

## Testi piccoli

Il detector segnala una sola voce sotto la soglia funzionale di 11 px su ogni
schermata TV:

- `button.dock-btn.advance` — **9,28 px**, testo «AVANTI», in tutte e quattro le
  catture TV (intro e lobby, entrambi i temi).

Misura indipendente su tutti i nodi di testo visibili (soglia 12 px):

| Schermata | Sotto 12 px | Dettaglio |
|---|---|---|
| TV intro (entrambi i temi) | **13** | le 8 etichette dentro le icone (`QUIZ`, `MUSICA`, `IMMAGINI`, `TEMPO`, `CARTE`, `AZZARDO`…) a **6,72 px**; `EDIZIONE 26` 11,5 px; `UNA TV · SQUADRE · 40 ROUND` 11,2 px; il resto sono micro-etichette del footer |
| TV lobby (entrambi i temi) | **3** | `PARTITA #1` 11,2 px, URL del telefono 10,88 px, «AVANTI» 9,28 px |
| Telefono setup (entrambi i temi) | **0** | — |

## Bersagli sotto 44 px

| Schermata | Elemento | Misura |
|---|---|---|
| TV lobby (entrambi i temi) | `button.pairing-btn` «GENERA CODICE» | 161×**38 px** |

Sul telefono nessun bersaglio sotto 44 px nel setup, in nessuno dei due temi.

## Altro dal detector

- `hard-offset-shadow`: 12 sulla intro e 7 sulla lobby, per entrambi i temi.
  È l'ombra piena voluta dal progetto, non un difetto.
- `hero-eyebrow-chip` (intro), `kicker-above-heading` e `nested-cards` (lobby):
  scelte di composizione coerenti con il linguaggio stampato, da rivalutare solo
  se si ridisegna la schermata.
- Nessun testo a gradiente, vetro o glow nelle pagine scansionate.

## Cosa resta aperto

1. **Tema scuro TV**: logo, stamp, kicker e pulsante di avvio sotto AA. È il
   punto più grave emerso.
2. **Tema chiaro TV**: etichette bianche su tomato (3.1:1) e QR label tomato su
   carta (2.6:1).
3. **Testi**: «AVANTI» a 9,28 px e le etichette delle icone a 6,72 px.
4. **Bersaglio**: «GENERA CODICE» alto 38 px.
5. **Telefono**: solo il placeholder del nome, e solo come advisory.

Nessuna correzione applicata: come richiesto, la grafica si tocca al test live.
