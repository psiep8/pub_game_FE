# Q-07 — Demo: difetti reali e modello unico

Catture fatte con `scripts/checks/screens.mjs` sulla TV vera (`/tv?demo=<gioco>&regia=1`), ai cinque formati richiesti: 1920×1080, 1600×900, 1366×768, 1280×720, 1024×768. Tutte le 19 demo per ogni formato: **95 catture**.

## Difetti trovati

| Elemento | Formato | Cosa non andava | Correzione |
|---|---|---|---|
| Riquadro `.demo-frame` | 1024×768 | Non era 16:9: con `height: 82vh` diventava **1,49:1**, quindi la scena veniva rimpicciolita dentro un riquadro sbagliato e il contenuto non occupava l’area dichiarata | Larghezza `min(1400px, 92vw, 82vh × 16/9)` e `aspect-ratio: 16/9`: la scena è sempre intera e scalata |
| Kick-off del telefono | tutti | Il modello diceva ancora `PUB GAME · TELEFONO` | Testo visibile passato a `quizzOne · TELEFONO` (Q-08) |
| Testi demo | tutti | Nessun testo sotto 20 px, nessun overflow, nessun elemento fuori dal 5% | Nessun intervento |

## Dopo la correzione

Il giro completo dà **95/95 demo catturate**, **0** elementi fuori dall’area sicura, **0** testi demo sotto 20 px, **0** scroll. Il modello di pagina è uno per tutti i giochi e i bonus: titolo, una riga di regola, scena, “come si vince / cosa si perde” letto da `scoring-rules.ts`, comandi demo.

## Prima / dopo

- Prima, 1024×768: `q07-prima-1024x768.png`
- Dopo, 1024×768: `q07-dopo-1024x768.png`
- Prima, 1920×1080: `q07-prima-1920x1080.png`
- Dopo, 1920×1080: `q07-dopo-1920x1080.png`

Il difetto è visibile nel rapporto del riquadro: prima a 4:3 il frame era più alto che largo rispetto al 16:9; dopo mantiene il 16:9 e resta dentro l’area sicura.
