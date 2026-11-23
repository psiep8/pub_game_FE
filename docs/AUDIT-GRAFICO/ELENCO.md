# Audit grafico — inventario statico

**Data:** 23 novembre 2026 · **versione:** 2.3.2 · **metodo:** conteggio sul codice
(`grep` su `apps/frontend/src/app`, esclusi gli asset), nessuna cattura automatica.

**Screenshot prodotti.** `playwright` è ora una devDependency e `scripts/checks/screens.mjs`
ha catturato **14 schermate** in `docs/AUDIT-GRAFICO/screens/` (TV 1920×1080 e
1280×720; telefono 360×640, 390×844, 412×915), con il referto automatico
`screens/report.md`. Comando:

```bash
npx playwright install chromium
BASE_URL=http://127.0.0.1:4210 node scripts/checks/screens.mjs
```

## 1. Numeri

| Voce | Misura |
|---|---|
| File con gradiente, blur, glow, `text-shadow` o ombra morbida `rgba` | **19** |
| Occorrenze di `!important` | **498** |
| Occorrenze di `border-radius` fra 10 e 99 px | **79** |
| File `restyle.css` | **4**, per **3.025 righe** |
| File che rispettano `prefers-reduced-motion` | **9** |
| Colori fuori palette (`#0f172a`, `#111827`, `#fbbf24`, `#a3e635`, `#8b5cf6`, `#38bdf8`) | **30** |

## 2. File con stile legacy da rivedere

Gradiente, blur, glow o ombra morbida:

- `features/admin/admin.component.css`
- `features/bonus/bonus-entrance/bonus-entrance.component.ts`
- `features/bonus/casino/casino-bonus.component.ts`
- `features/bonus/preview/bonus-preview.component.ts`
- `features/games/arena/arena.component.css`
- `features/games/blackjack/blackjack.component.ts`
- `features/games/image-blur/image-blur.component.css`
- `features/games/quiz/quiz.component.css`
- `features/games/song/song.component.css`
- `features/games/tennis-battle/tennis-battle.component.ts`
- `features/games/wheel-fortune/wheel-fortune.component.css`
- `features/remote/manual.css`
- `features/remote/remote.component.css`
- `features/remote/restyle.css`
- `features/tv/game.component.css`
- `features/tv/leaderboard/leaderboard-detailed-component/leaderboard-detailed.component.css`
- `features/tv/leaderboard/leaderboard-detailed-component/restyle.css`
- `features/tv/leaderboard/leaderboard-quick-component/restyle.css`
- `features/tv/restyle.css`

`!important`, primi file: `features/tv/restyle.css` (171),
`leaderboard-quick/restyle.css` (124), `leaderboard-detailed/restyle.css` (82),
`features/remote/restyle.css` (73), `features/tv/game.component.css` (32),
`features/remote/manual.css` (12).

Skin che duplicano il componente (da assorbire nel componente, secondo la spec):

| File | Righe |
|---|---|
| `features/remote/restyle.css` | 1.473 |
| `features/tv/restyle.css` | 1.150 |
| `features/tv/leaderboard/leaderboard-quick-component/restyle.css` | 240 |
| `features/tv/leaderboard/leaderboard-detailed-component/restyle.css` | 162 |

## 3. Colori fuori palette

Concentrati in due punti:

- `features/bonus/casino/casino-bonus.component.ts` — 24 occorrenze: fondo
  blu-notte (`#0b1020`, `#0f172a`, `#111827`), oro (`#fbbf24`), lime (`#a3e635`)
  e due `linear-gradient`/`radial-gradient` nella roulette.
- `features/games/biglie/marbles.ts` — `#38bdf8` (Chiodo) e `#a3e635` (Piuma);
  `features/games/biglie/biglie.component.ts` — `#111827` nella scacchiera del
  canvas.

## 4. Schermate da catturare (checklist)

TV 1920×1080 e 1280×720; telefono 360×640, 390×844, 412×915:

1. Home/QR, ingresso, attesa, anteprima round.
2. Le 13 modalità, per fase: risposta, blocco, reveal, riepilogo.
3. I 5 bonus e i loro ingressi.
4. Classifica rapida e dettagliata, podio, pausa, errore, badge OFFLINE.
5. Manuale, demo, regia (verticale e orizzontale).
6. Casi limite: 4/6/10/20 squadre, nome da 20 caratteri con emoji, punteggi a
   cinque cifre e negativi, 720p.

Catturate: intro TV, lobby TV, anteprima bonus, admin, setup telefono, regia
audio. Restano da catturare le fasi di gioco (round, bonus, classifiche,
manuale, demo): servono una partita reale e un pilotaggio STOMP.
