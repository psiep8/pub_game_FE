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
| ACIDO (`editorial-acid`) | 3/3 | 4 | 8 |
| SABBIA (`desert-heritage`) | 3/3 | 3 | 5 |
| ARTICO (`arctic-noir`) | 3/3 | 9 | 13 |
| OCEANO (`deep-ocean`) | 3/3 | 5 | 6 |
| K-POP (`kpop-aesthetic`) | 3/3 | 4 | 8 |
| CYBER (`neon-cyberpunk`) | 3/3 | 6 | 9 |
| SUNSET (`sunset-pop`) | 3/3 | 4 | 8 |
| ORO (`premium-gold`) | 3/3 | 7 | 11 |

Scansioni riuscite: **24/24**.

## Contrasto (WCAG AA)

### ACIDO (`editorial-acid`)

| Superficie | Elemento | Testo su fondo | Esito |
|---|---|---|---|
| TV intro | `div.intro-kicker` | 3.1:1 (need 4.5:1) — text #fff8e8 on #ff4d2e | warning |
| TV lobby | `div.lobby-kicker.ng-tns-c1664707305-0` | 3.1:1 (need 4.5:1) — text #fff8e8 on #ff4d2e | warning |
| TV lobby | `div.qr-label.ng-tns-c1664707305-0` | 2.6:1 (need 4.5:1) — text #ff4d2e on #f1e4c9 | warning |
| Telefono setup | `#team-name` | placeholder "Nome della squadra" 2.6:1 (need 4.5:1) — text #a19d91 on #fff8e8 | advisory |

### SABBIA (`desert-heritage`)

| Superficie | Elemento | Testo su fondo | Esito |
|---|---|---|---|
| TV lobby | `div.qr-label.ng-tns-c1664707305-0` | 4.2:1 (need 4.5:1) — text #9b4f2d on #e8d6b8 | advisory |
| TV lobby | `p.lobby-url.ng-tns-c1664707305-0` | 4.3:1 (need 4.5:1) — text #6b6152 on #e8d6b8 | advisory |
| Telefono setup | `#team-name` | placeholder "Nome della squadra" 2.5:1 (need 4.5:1) — text #a1998c on #f8eedc | advisory |

### ARTICO (`arctic-noir`)

| Superficie | Elemento | Testo su fondo | Esito |
|---|---|---|---|
| TV intro | `span.intro-stamp` | 1.6:1 (need 4.5:1) — text #dce8f2 on #a9b9c9 | warning |
| TV intro | `div.intro-kicker` | 2.6:1 (need 4.5:1) — text #1b2b3d on #4169a8 | warning |
| TV intro | `h1.intro-logo` | 1.1:1 (need 3:1) — text #111e2d on #080f1a | warning |
| TV intro | `button.intro-start` | 1.7:1 (need 3:1) — text #dce8f2 on #54bceb | warning |
| TV lobby | `div.lobby-kicker.ng-tns-c1664707305-0` | 2.6:1 (need 4.5:1) — text #1b2b3d on #4169a8 | warning |
| TV lobby | `h1.lobby-title.ng-tns-c1664707305-0` | 1.1:1 (need 3:1) — text #111e2d on #080f1a (and 3 more) | warning |
| TV lobby | `div.qr-label.ng-tns-c1664707305-0` | 3.1:1 (need 4.5:1) — text #4169a8 on #111e2d | warning |
| TV lobby | `div.game-id-badge.ng-tns-c1664707305-0` | 1.7:1 (need 4.5:1) — text #54bceb on #dce8f2 | warning |
| Telefono setup | `#team-name` | placeholder "Nome della squadra" 3.1:1 (need 4.5:1) — text #687785 on #1b2b3d | advisory |

### OCEANO (`deep-ocean`)

| Superficie | Elemento | Testo su fondo | Esito |
|---|---|---|---|
| TV intro | `div.intro-kicker` | 4.49:1 (need 4.5:1) — text #f0fbf7 on #087f8c (and 1 more) | advisory |
| TV lobby | `span.label` | 4.49:1 (need 4.5:1) — text #f0fbf7 on #087f8c (and 1 more) | advisory |
| TV lobby | `div.qr-label.ng-tns-c1664707305-0` | 4.0:1 (need 4.5:1) — text #087f8c on #d9f0ea | warning |
| TV lobby | `p.lobby-url.ng-tns-c1664707305-0` | 4.3:1 (need 4.5:1) — text #597274 on #d9f0ea | advisory |
| Telefono setup | `#team-name` | placeholder "Nome della squadra" 2.4:1 (need 4.5:1) — text #94a5a5 on #f0fbf7 | advisory |

### K-POP (`kpop-aesthetic`)

| Superficie | Elemento | Testo su fondo | Esito |
|---|---|---|---|
| TV intro | `div.intro-kicker` | 2.6:1 (need 4.5:1) — text #fff8fc on #a98bff | warning |
| TV lobby | `div.lobby-kicker.ng-tns-c1664707305-0` | 2.6:1 (need 4.5:1) — text #fff8fc on #a98bff | warning |
| TV lobby | `div.qr-label.ng-tns-c1664707305-0` | 2.4:1 (need 4.5:1) — text #a98bff on #fff0f7 | warning |
| Telefono setup | `#team-name` | placeholder "Nome della squadra" 2.5:1 (need 4.5:1) — text #a79ea9 on #fff8fc | advisory |

### CYBER (`neon-cyberpunk`)

| Superficie | Elemento | Testo su fondo | Esito |
|---|---|---|---|
| TV intro | `span.intro-stamp` | 4.4:1 (need 4.5:1) — text #f0eafe on #8b35ff | advisory |
| TV intro | `h1.intro-logo` | 1.1:1 (need 3:1) — text #17112a on #090713 | warning |
| TV lobby | `h1.lobby-title.ng-tns-c1664707305-0` | 1.1:1 (need 3:1) — text #17112a on #090713 | warning |
| TV lobby | `div.game-id-badge.ng-tns-c1664707305-0` | 3.1:1 (need 4.5:1) — text #ff00a8 on #f0eafe | warning |
| TV lobby | `div.lobby-step.ng-tns-c1664707305-0:nth-of-type(1) > div.ng-tns-c1664707305-0 > b.ng-tns-c1664707305-0` | 1.0:1 (need 3:1) — text #17112a on #1a0c18 (gradient on div.game-container) (and 2 more) | warning |
| Telefono setup | `#team-name` | placeholder "Nome della squadra" 3.4:1 (need 4.5:1) — text #766c88 on #24183a | advisory |

### SUNSET (`sunset-pop`)

| Superficie | Elemento | Testo su fondo | Esito |
|---|---|---|---|
| TV intro | `div.intro-kicker` | 4.1:1 (need 4.5:1) — text #fff9f3 on #c64c91 (and 1 more) | warning |
| TV lobby | `span.label` | 4.1:1 (need 4.5:1) — text #fff9f3 on #c64c91 (and 1 more) | warning |
| TV lobby | `div.qr-label.ng-tns-c1664707305-0` | 3.9:1 (need 4.5:1) — text #c64c91 on #fff0e6 | warning |
| Telefono setup | `#team-name` | placeholder "Nome della squadra" 2.4:1 (need 4.5:1) — text #aa9fa4 on #fff9f3 | advisory |

### ORO (`premium-gold`)

| Superficie | Elemento | Testo su fondo | Esito |
|---|---|---|---|
| TV intro | `span.intro-stamp` | 1.4:1 (need 4.5:1) — text #f7e7ce on #e5c76b | warning |
| TV intro | `h1.intro-logo` | 1.0:1 (need 3:1) — text #101820 on #101820 | warning |
| TV intro | `button.intro-start` | 1.7:1 (need 3:1) — text #f7e7ce on #d4af37 | warning |
| TV lobby | `h1.lobby-title.ng-tns-c1664707305-0` | 1.0:1 (need 3:1) — text #101820 on #101820 | warning |
| TV lobby | `div.game-id-badge.ng-tns-c1664707305-0` | 1.7:1 (need 4.5:1) — text #d4af37 on #f7e7ce | warning |
| TV lobby | `div.lobby-step.ng-tns-c1664707305-0:nth-of-type(1) > div.ng-tns-c1664707305-0 > b.ng-tns-c1664707305-0` | 1.0:1 (need 3:1) — text #101820 on #101820 (gradient on div.game-container) (and 2 more) | warning |
| Telefono setup | `#team-name` | placeholder "Nome della squadra" 3.3:1 (need 4.5:1) — text #72716d on #1a222c | advisory |

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
