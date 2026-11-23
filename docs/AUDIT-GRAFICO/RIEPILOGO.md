# Riepilogo intervento grafico/audio/demo

**Data:** 23 novembre 2026 · **versione:** 2.4.0 · **stato:** parziale, per scelta
di consegnare solo ciò che è stato verificato.

La spec chiede sei fasi (screenshot di ogni schermata, misure di animazione,
ingressi bonus a sorpresa, matrice audio, classifiche, demo automatiche + manuali).
In questo giro è stata completata **una parte della fase 1** e il rialzo versione;
tutto il resto è **non fatto** e va pianificato in interventi separati.

## Fatto

| Voce | Stato | Prova |
|---|---|---|
| 1.4 Fiche dell'Azzardo come oggetti fisici | **fatto (TV)** | `azzardo.component.ts`: cerchio con bordo a tacche, valore, pila sull'opzione, contatore, esito verde/rosso; animazione solo `transform`/`opacity`, spenta con `prefers-reduced-motion`; 2 test nuovi (`azzardo.component.spec.ts`), 703 passati + 2 skip |
| 1.2/1.3 `prefers-reduced-motion` sull'Azzardo | **fatto** | media query nel componente |
| Inventario statico dello stile | **fatto** | `docs/AUDIT-GRAFICO/ELENCO.md`: 19 file con gradienti/glow, 498 `!important`, 79 radius larghi, 3.025 righe di `restyle.css`, 30 colori fuori palette |
| Rialzo versione | **fatto** | 2.3.1 → 2.4.0 in `VERSION`, `package.json`, frontend, pom, compose |

## Non fatto

| Voce | Perché / cosa manca |
|---|---|
| 1.1 Script Playwright e screenshot | `playwright` non è dipendenza del progetto né installato: servono browser e lockfile nuovi. La checklist è in `ELENCO.md` §4 |
| 1.2 Correzioni overflow, contrasti, bersagli, 720p | Richiedono le catture: senza schermate si correggerebbe alla cieca |
| 1.3 Opzioni esistenti (volume, vibrazione, movimento, tema, testo, schermo acceso) | Da censire e provare; oggi solo `prefers-reduced-motion` è verificato |
| 1.4 Fiche sul telefono (tocco, tocco lungo, volo, suono) | La TV disegna le fiche; l'interazione del telefono non è stata toccata |
| 2.1-2.4 Misura animazioni, CPU 4×, 10/20 squadre | Serve Chrome tracing via Playwright; nessuna misura registrata |
| 2.5 Ingressi bonus a sorpresa (pool 8, seme server, regia) | Feature intera, backend + stato + audio + test |
| 3 Audio (matrice, loudness, loop, ducking) | `docs/AUDIO-CATALOGO.md` esiste; la matrice evento × file × loop e i controlli automatici non sono stati prodotti |
| 4 Classifiche (ordine, finestra mobile, suoni, ripresa, 4–20 squadre) | Non iniziata |
| 5.2 Demo automatiche alla prima apparizione | Non iniziata |
| 5.1 Manuali, PDF e documenti al codice | Non aggiornati in questo giro |
| Rimozione skin legacy (`restyle.css`) e palette casino | Inventariata, non riscritta: è un intervento visivo da fare con TV e telefono davanti |

## Da provare in sala

- Fiche TV: leggibilità a 3–5 m, pila che non copre il numero dell'opzione,
  contrasto del gettone `--mustard` su `--paper-hi`.
- Fiche telefono: tocco e tocco lungo, vibrazione e suono al posto (quando
  verranno implementati).
- Tutte le schermate della checklist `ELENCO.md` §4 ai cinque viewport.

## Verifiche eseguite

- Frontend: **703 passati, 2 saltati** (705 dichiarati; i due skip sono loudness
  senza ffmpeg).
- Backend: **168/168** dopo il rialzo versione del pom.
- Build `ng build` con proxy verso porta chiusa (nessuna rete): verde, 9,1 s.
- `node scripts/audit-banche.mjs --ci`: OK.
- Nessuna cattura schermo: Playwright non è installato, vedi `ELENCO.md`.
