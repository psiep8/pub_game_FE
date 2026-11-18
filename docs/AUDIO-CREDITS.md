# Audio — fonti e licenze

Verificato il 14 novembre 2026 sul codice di `apps/frontend/src/app/core/services/`.

## File registrati

Dal 17 novembre 2026 gli effetti sono **file registrati** in
`apps/frontend/public/assets/audio`; dal 18 novembre lo sono anche i sei
sottofondi di `loop/` (48 file `.m4a`, circa 11,6 MB). Fonte, autore, licenza e
URL di ogni file stanno in `FONTI.txt`, accanto agli asset, e sono riassunti in
`docs/CREDITI-AUDIO.md`; la pagina `/audio` suona esattamente quei file.

Restano nostri undici effetti, marcati «Nostra (sintesi renderizzata)»: gong,
bong del countdown, whoosh, gettoni, racchetta, scoppio e miccia della Bomba e i
quattro urti delle Biglie, più il rotolamento `loop/biglie.m4a`. Vanno
sostituiti con registrazioni scelte da una libreria prima della serata.

Nel codice non resta sintesi di eventi né librerie di cue: `audio-dsp.ts`
contiene solo la coda di stanza (`createRoom`), cioè un effetto di ambiente sul
bus della TV. `@foleyjs/core` è stato rimosso dalle dipendenze.

## Cosa non è stato verificato

- Bilanciamento e volume reali in sala, su TV e telefoni diversi.
- Latenza e comportamento con Bluetooth o casse esterne.
- Licenze di eventuali registrazioni future: vanno aggiunte qui prima dell'uso.

Le voci audio della roadmap restano quindi **parziali**: fonti e licenze sono
documentate, l'ascolto e il bilanciamento richiedono una prova reale.
