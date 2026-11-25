# Budget dei fotogrammi — scena Quiz TV (R-03)

Misura eseguita con `node scripts/checks/frame-budget.mjs` il 25 novembre 2026.

- Viewport **1280×720**, device scale 1.
- Chromium headless, **CPU rallentata 4×** (`Emulation.setCPUThrottlingRate`).
- Pagina `scripts/checks/frame-harness.html`: stesso DOM e stesso CSS della TV
  (`styles.css`, `game.component.css`, `quiz.component.css`, `restyle.css`,
  `alive.css`), sequenza ingresso domanda → opzioni sfalsate → esito → uscita.
- Tre esecuzioni per variante, **mediana**.

| Variante | Fotogrammi | FPS | p50 | p95 | max | > 33 ms |
|---|---:|---:|---:|---:|---:|---:|
| **ora** (regola F-11 attiva) | 139 | **42,3** | 16,7 | 49,9 | 216,6 | 16 |
| **prima** (alive sempre in movimento) | 109 | **34,1** | 33,3 | 50,0 | 183,3 | 25 |
| senza alive (bolle e respiro tolti) | 135 | 41,8 | 16,7 | 50,0 | 199,9 | 15 |
| senza ombre offset | 110 | 34,6 | 33,3 | 50,0 | 183,3 | 20 |
| senza `will-change` | 129 | 40,3 | 16,7 | 50,0 | 150,1 | 16 |
| 8 bolle invece di 14 | 127 | 39,7 | 16,7 | 49,9 | 200 | 17 |
| `contain: strict` sulle bolle | 127 | 39,7 | 16,7 | 50,0 | 166,7 | 18 |
| bolle nascoste in entrata/uscita | 116 | 36,6 | 16,8 | 50,0 | 200 | 16 |

## Esito

- **L'elemento che costa è il livello `alive`** (14 bolle + respiro + deriva):
  con le animazioni in movimento la scena scende a **34,1 fps** e ha **25**
  fotogrammi oltre 33 ms; con la pausa di F-11 sale a **42,3 fps** e **16**
  fotogrammi oltre 33 ms (circa **+24%**).
- **Le ombre non sono la causa**: toglierle non migliora la mediana (34,6 fps,
  dentro il rumore della misura).
- Togliere del tutto `alive` non va oltre i 42 fps: il resto è il costo della
  scena e del foglio CSS completo, non un singolo elemento correggibile.
- Sotto CPU 4× la scena **non arriva a 50 fps** (42,3). Su un PC reale la CPU
  non è rallentata: la misura serve a confrontare le varianti, non a stimare
  gli fps della sala.

## Correzione applicata

La regola di F-11 (`alive` in pausa durante `stage-entrance` e `stage-exit`,
`components/tv/alive.css`) è la correzione dell'elemento che costa: è già nel
commit `775b496` e questa misura ne riporta il guadagno. Non sono state
aggiunte altre modifiche: nascondere le bolle o ridurle non ha dato un guadagno
fuori dal rumore.

## Q-03 — secondo giro (25 novembre 2026, dopo il merge)

Baseline rimisurata sullo stesso harness: **39,2 fps**, p95 50 ms, 19 fotogrammi
sopra 33 ms. Il colpevole trovato leggendo il CSS era `.question-area`: la skin
nuova aveva tolto sfondo e bordo del vetro legacy, ma non il
`backdrop-filter: blur(12px)`. La sfocatura restava attiva sopra le bolle in
movimento e veniva ricomposta a ogni fotogramma.

Correzione: `backdrop-filter: none` (e prefisso `-webkit-`) su `.question-area`,
in `features/tv/restyle.css`. Una modifica, un commit.

| Variante | FPS prima | FPS dopo | p95 dopo | >33 ms dopo |
|---|---:|---:|---:|---:|
| ora | 39,2 | **55,2** | 16,8 | 2 |
| prima (alive sempre in movimento) | 37,2 | 43,6 | 50,0 | 10 |
| senza alive | 42,2 | 52,3 | 16,8 | 2 |
| senza ombre | 38,5 | 49,2 | 33,3 | 5 |

Il bersaglio di **50 fps a 1280×720 con CPU 4×** è raggiunto. Le altre varianti
restano nel referto dello script (`node scripts/checks/frame-budget.mjs`).

**Limite dichiarato:** Timeline, Musica e classifica sono state ispezionate (in
particolare il `backdrop-filter: blur(10px)` legacy di `.stat-box` nella
dettagliata, oggi non coperto dalla skin), ma non esiste ancora un harness che le
misuri come il Quiz: non riporto quindi numeri che non ho misurato.
