# Audio — fonti e licenze

Verificato il 14 novembre 2026 sul codice di `apps/frontend/src/app/core/services/`.

## Sintesi: nessun file audio nel repository

Tutti i suoni di gioco, della TV, del telefono e il tappeto musicale sono
**sintetizzati al volo con la Web Audio API**:

- `audio.service.ts` genera countdown, tick, eliminazione, podio, sirena Bomba,
  applausi, roulette, errori e conferme;
- `pub-bed.ts` genera il tappeto musicale (giro ii-V-I-vi in Do maggiore,
  64 BPM, ciclo di 20 minuti).

Non ci sono mp3, wav o campionamenti nel repository: la licenza di questi suoni
è del progetto, che li produce a runtime. L'uso resta subordinato allo sblocco
del contesto audio da parte del browser (un tocco dell'utente).

## Libreria di interfaccia

- **@foleyjs/core 2.9.0** — MIT License, Copyright (c) 2026 eakbulut e
  contributor di Foley. Repository: <https://github.com/eakbulut/foley>.
  Usata per i cue di interfaccia elencati in `UI_SOUNDS` (tocco, conferma,
  errore, tempo scaduto, prenotazione, ingresso, eliminazione, rivelazione,
  vittoria). I cue sono sintetizzati dalla libreria: nessun file incluso.
  Il volume è tenuto sotto quello della voce (0.45).

## Cosa non è stato verificato

- Bilanciamento e volume reali in sala, su TV e telefoni diversi.
- Latenza e comportamento con Bluetooth o casse esterne.
- Licenze di eventuali registrazioni future: vanno aggiunte qui prima dell'uso.

Le voci audio della roadmap restano quindi **parziali**: fonti e licenze sono
documentate, l'ascolto e il bilanciamento richiedono una prova reale.
