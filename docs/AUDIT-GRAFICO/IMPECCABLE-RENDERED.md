# Impeccable sulle pagine renderizzate — tutti i temi

**Data:** 2026-11-23 · **motore:** Impeccable 4.10.0 · **browser:** Chromium di Playwright · **grafica non modificata**.

Generato da `scripts/checks/audit-design.mjs`. Per rifarlo:

```bash
BASE_URL=http://127.0.0.1:4210 node scripts/checks/audit-design.mjs
```

## Copertura

Scansionate per **tutti gli 8 temi** dichiarati in `theme.service.ts`:
- **TV intro** (1920×1080)
- **TV lobby** (1920×1080, dopo la chiusura dell'intro)
- **Telefono setup** (390×844, `?quad=1`)

**Non** scansionate: round di gioco, bonus, classifiche, manuale, demo, regia/admin, regia audio, stati di errore/offline.

## Temi

| Tema | Superfici | Contrasti | Warning |
|---|---|---|---|
| ACIDO (`editorial-acid`) | 3/3 | 0 | 5 |
| SABBIA (`desert-heritage`) | 3/3 | 1 | 5 |
| ARTICO (`arctic-noir`) | 3/3 | 0 | 5 |
| OCEANO (`deep-ocean`) | 3/3 | 3 | 5 |
| K-POP (`kpop-aesthetic`) | 3/3 | 0 | 5 |
| CYBER (`neon-cyberpunk`) | 3/3 | 0 | 5 |
| SUNSET (`sunset-pop`) | 3/3 | 2 | 7 |
| ORO (`premium-gold`) | 3/3 | 0 | 5 |

Scansioni riuscite: **24/24**.

## Contrasto (WCAG AA)

### ACIDO (`editorial-acid`)

Nessun contrasto sotto soglia.

### SABBIA (`desert-heritage`)

| Superficie | Elemento | Testo su fondo | Esito |
|---|---|---|---|
| TV lobby | `p.lobby-url.ng-tns-c1664707305-0` | 4.3:1 (need 4.5:1) — text #6b6152 on #e8d6b8 | advisory |

### ARTICO (`arctic-noir`)

Nessun contrasto sotto soglia.

### OCEANO (`deep-ocean`)

| Superficie | Elemento | Testo su fondo | Esito |
|---|---|---|---|
| TV intro | `div.intro-kicker` | 4.49:1 (need 4.5:1) — text #f0fbf7 on #087f8c (and 1 more) | advisory |
| TV lobby | `span.label` | 4.49:1 (need 4.5:1) — text #f0fbf7 on #087f8c (and 1 more) | advisory |
| TV lobby | `p.lobby-url.ng-tns-c1664707305-0` | 4.3:1 (need 4.5:1) — text #597274 on #d9f0ea | advisory |

### K-POP (`kpop-aesthetic`)

Nessun contrasto sotto soglia.

### CYBER (`neon-cyberpunk`)

Nessun contrasto sotto soglia.

### SUNSET (`sunset-pop`)

| Superficie | Elemento | Testo su fondo | Esito |
|---|---|---|---|
| TV intro | `div.intro-kicker` | 4.1:1 (need 4.5:1) — text #fff9f3 on #c64c91 (and 1 more) | warning |
| TV lobby | `span.label` | 4.1:1 (need 4.5:1) — text #fff9f3 on #c64c91 (and 1 more) | warning |

### ORO (`premium-gold`)

Nessun contrasto sotto soglia.

## Testi piccoli

| Superficie | Elemento | Testo | Dimensione |
|---|---|---|---|
| TV intro | `span.intro-stamp` | EDIZIONE 26 | 11.52 px |
| TV intro | `span.intro-meta` | UNA TV · SQUADRE · 40 ROUND | 11.2 px |
| TV intro | `small` | QUIZ | 6.72 px |
| TV intro | `span` | TOCCA O PREMI INVIO PER SALTARE | 11.2 px |
| TV intro | `span.intro-edition` | PUB GAME / 26 | 11.2 px |
| TV intro | `button.dock-btn.advance` | AVANTI | 9.28 px |
| TV lobby | `div.game-id-badge.ng-tns-c1664707305-0` | PARTITA #1 | 11.2 px |
| TV lobby | `p.lobby-url.ng-tns-c1664707305-0` | http://127.0.0.1:4211/play?game=1 | 10.88 px |
| TV lobby | `button.dock-btn.advance` | AVANTI | 9.28 px |

Segnalazioni del detector (`undersized-ui-text`):

- TV intro: `button.dock-btn.advance` — 9.28px functional text "AVANTI" (below 11px floor)
- TV lobby: `button.dock-btn.advance` — 9.28px functional text "AVANTI" (below 11px floor)

## Bersagli sotto 44 px

| Superficie | Elemento | Testo | Misura |
|---|---|---|---|
| TV lobby | `button.pairing-btn.ng-tns-c1664707305-0` | GENERA CODICE | 161×38 px |

## Note

- Le ombre piene offset (`hard-offset-shadow`) sono il linguaggio voluto: compaiono come advisory e non vanno rimosse.
- Le etichette mono in maiuscolo con tracking largo sono segnalate come `wide-tracking`, ma sono etichette, non body text.
- Il tema è impostato via `localStorage` prima del caricamento; il DOM viene salvato dopo l'eventuale chiusura dell'intro e servito da un proxy locale per il detector.
