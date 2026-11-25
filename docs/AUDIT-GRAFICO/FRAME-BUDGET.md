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
