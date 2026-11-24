# PubGame FE — Frontend Angular

> **VERSIONE 2.5.0 — 24 novembre 2026.** Vince il codice; per il quadro completo
> del gioco e della scaletta vale il [`README.md`](../../README.md) della radice.

Frontend Angular 22 per TV, telefoni e regia. Vive in `apps/frontend` del
monorepo: `npm install` e gli script si lanciano dalla **radice** del repo.

## Schermate

| Route | Dispositivo | Descrizione |
|---|---|---|
| `/tv` | Desktop / TV | Tabellone, domande, Biglie, classifiche |
| `/play` | Telefono | Ingresso squadra, risposte, manuale dei giochi |
| `/admin` | Regia | Avvio e chiusura dei round, bonus, demo, diagnostica |
| `/audio` | Desktop | Banco di prova del catalogo audio |
| `/bonus-preview` | Desktop | Anteprima TV dei bonus con dati demo |

## Configurazione

Nessun IP e nessuna porta nel codice: `src/app/core/environment/` deriva API e
WebSocket dall'origine della pagina, e il dev server inoltra `/games`,
`/categories` e `/ws-pubgame` al backend indicato da `BE_PORT` in
`.env` (vedi `proxy.conf.mjs`).

## Avvio e build

Dalla radice del repository:

```bash
npm run dev              # frontend + backend
npm run dev:frontend     # solo frontend
npm run test:frontend    # Vitest + jsdom
npm run build:frontend   # ng build (produzione)
npm run build:test-night # build con environment.test-night
```

I caratteri Anton, Space Mono e Bricolage Grotesque sono serviti localmente da
`public/assets/fonts` e dichiarati in `src/styles.css`: la build e la serata non
dipendono da Google Fonts.

## Struttura

```text
src/app/
├── core/       environment, WebSocket, servizi condivisi, guardie
├── features/   tv/, remote/, admin/, games/, bonus/, audio/
└── shared/     modelli, enum, scaletta, manuale, doppi di test
public/assets/  audio registrato, font, icone, demo
```

Lo stile grafico è descritto in [`AGENTS.md`](../../AGENTS.md): prima di toccare
CSS o markup si leggono i token in `src/styles.css`.
