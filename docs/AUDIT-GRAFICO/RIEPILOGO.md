# Riepilogo intervento grafico/audio/demo

**Data:** 23 novembre 2026 · **versione:** 2.3.2 · **stato:** parziale, con
schermate vere e correzioni misurate.

La spec chiede sei fasi (schermate di ogni fase, misure di animazione, ingressi
bonus a sorpresa, matrice audio, classifiche, demo automatiche + manuali).
In questo giro sono state fatte la fase 1 e le fiche del telefono; il resto è
**non fatto** e va pianificato in interventi separati.

## Fatto

| Voce | Stato | Prova |
|---|---|---|
| 1.1 Screenshot ai cinque viewport | **fatto** | `scripts/checks/screens.mjs` con Playwright; 14 PNG in `docs/AUDIT-GRAFICO/screens/`: TV 1920×1080 e 1280×720 (intro, lobby, bonus preview, admin), telefono 360×640, 390×844, 412×915 (setup, regia audio) |
| 1.2 Overflow, bersagli, testi piccoli | **fatto** | referto `screens/report.md`: 0 scroll orizzontale, 0 bersagli <44 px, 0 testi <12 px dopo le correzioni; restano solo i bagliori decorativi della lobby, ritagliati e senza scroll |
| 1.3 `prefers-reduced-motion` | **parziale** | rispettato da Azzardo (TV e fiche telefono); le altre opzioni non sono state censite |
| 1.4 Fiche Azzardo TV | **fatto** | cerchio con bordo a tacche, valore, pila sull'opzione, contatore, esito verde/rosso; animazione solo `transform`/`opacity` |
| 1.4 Fiche Azzardo telefono | **fatto** | pila circolare con tacche e contatore, tocco e **tocco lungo** che aggiunge fiche ogni 160 ms, vibrazione e tick `coins`, tetto del server invariato; test dedicato in `remote.component.spec.ts` |
| Rialzo versione | **fatto** | 2.3.1 → **2.3.2** in `VERSION`, `package.json`, lockfile, frontend, pom, compose, README, comando di avvio Windows |
| Inventario statico | **fatto** | `docs/AUDIT-GRAFICO/ELENCO.md`: 19 file con gradienti/glow, 498 `!important`, 79 radius larghi, 3.025 righe di `restyle.css`, 30 colori fuori palette |

## Correzioni fatte grazie alle schermate

- Regia audio: fondo e testi erano scuri su scuro; ora carta con inchiostro,
  descrizioni leggibili, etichette a 12 px minimi.
- Slider volume e pulsante variante: area di tocco portata a 44 px.
- Setup telefono: pulsanti foto e suggerimenti sotto i 12 px corretti;
  bersagli a 44 px anche a 360 px di larghezza.
- Dock TV: pulsanti 42 → 44 px; badge OFFLINE spostato sotto la dock senza
  sovrapposizioni.

## Non fatto

| Voce | Perché / cosa manca |
|---|---|
| Schermate di round, bonus, classifiche, manuale e demo | Servono una partita reale e un pilotaggio STOMP; le catture attuali coprono ingresso, lobby, setup, audio, anteprima bonus e admin |
| 2.1-2.4 Misura animazioni, CPU 4×, 10/20 squadre | Serve Chrome tracing via Playwright; nessuna misura registrata |
| 2.5 Ingressi bonus a sorpresa (pool 8, seme server, regia) | Feature intera, backend + stato + audio + test |
| 3 Audio (matrice, loudness, loop, ducking) | `docs/AUDIO-CATALOGO.md` esiste; la matrice evento × file × loop e i controlli automatici non sono stati prodotti |
| 4 Classifiche (ordine, finestra mobile, suoni, ripresa, 4–20 squadre) | Non iniziata |
| 5.2 Demo automatiche alla prima apparizione | Non iniziata |
| 5.1 Manuali, PDF e documenti al codice | Non aggiornati in questo giro |
| Rimozione skin legacy (`restyle.css`) e palette casino | Inventariata, non riscritta: è un intervento visivo da fare con TV e telefono davanti |

## Da provare in sala

- Fiche TV e telefono: leggibilità a 3–5 m, pila che non copre il numero,
  tocco lungo che non sborda oltre il tetto della manche.
- Lobby a 1280×720: QR e colonna istruzioni reggono, badge OFFLINE libero.
- Schermate non catturate: round veri, bonus, classifiche, manuale, demo.

## Verifiche eseguite

- `node scripts/checks/screens.mjs`: **14/14** catture, 0 errori di console
  bloccanti; referto in `docs/AUDIT-GRAFICO/screens/report.md`.
- Frontend: suite completa (esito nel log del turno).
- Build `ng build` e audit banche restano da rilanciare dopo le ultime modifiche.

## Come rifare le schermate

```bash
npx playwright install chromium   # una volta sola
BASE_URL=http://127.0.0.1:4210 node scripts/checks/screens.mjs
```
