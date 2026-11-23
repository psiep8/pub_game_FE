# Impeccable — che cos'è e come è integrato

[Impeccable](https://github.com/pbakaus/impeccable) (Apache 2.0, di Paul Bakaus,
nato dal skill `frontend-design` di Anthropic) è una **skill di design per agenti
di codice** con un motore di analisi: un vocabolario per progettare, criticare e
ripulire interfacce, più un **detector** che trova anti-pattern tipici delle UI
generate (gradienti decorativi, testi a gradiente, easing elastici, griglie
ornamentali, ecc.). Si usa come comando `/impeccable ...` negli agenti supportati
(Claude Code, Codex, Cursor, Copilot…) oppure da terminale con
`npx impeccable detect`.

## Cosa è stato integrato

| Pezzo | Dove | Ruolo |
|---|---|---|
| Skill compilata | `.claude/skills/impeccable/` (con `SKILL.md`, `reference/`, `scripts/`) | Playbook completo: init, document, critique, audit, polish, live |
| Sottogenti | `.claude/agents/` | Revisione e critica delegate |
| CLI | devDependency `impeccable` + binario del motore in `~/.impeccable/` | `npm run audit:design` |
| Contesto prodotto | `PRODUCT.md` | Utenti, scopo, vincoli, principi |
| Sistema visivo | `DESIGN.md` | Token reali da `styles.css` e regole carta/inchiostro |
| Istruzioni progetto | `AGENTS.md` § *Design review con Impeccable* | Precedenza dello stile Pub Game |

**La skill non sostituisce lo stile del progetto.** `AGENTS.md`, `DESIGN.md` e i
token in `apps/frontend/src/styles.css` vincono su qualunque suggerimento della
skill: Impeccable serve a trovare le mancanze *dentro* il linguaggio carta e
inchiostro, non a importare gradienti, vetro o card arrotondate.

## Comandi

```bash
npm run audit:design          # detector sui sorgenti frontend
npm run audit:design:screen   # detector sulla pagina renderizzata (serve dev server + Chrome)
npx impeccable detect --json apps/frontend/src
npx impeccable update         # aggiorna skill e motore
```

Per la scansione di una URL serve un browser Chromium: su questa macchina si può
puntare a quello di Playwright.

```bash
IMPECCABLE_BROWSER=$HOME/.cache/ms-playwright/chromium-1255/chrome-linux-arm64/chrome \
  npm run audit:design:screen
```

## Prima scansione (23 novembre 2026)

Senza `DESIGN.md` il detector trovava **31 segnalazioni**. Dopo aver aggiunto
`DESIGN.md` si attivano anche le regole di coerenza col sistema (colori, radius,
font) e il totale sale a **536**, quasi tutte advisory: sono l'inventario del
legacy che già conoscevamo, non errori nuovi.

| Regola | Quante | Gravità | Dove | Giudizio |
|---|---|---|---|---|
| `design-system-color` | 450 | advisory | skin legacy e varianti tema | Colori letterali fuori dai token: è la deriva già misurata in `ELENCO.md`. Da assorbire skin per skin |
| `design-system-radius` | 53 | advisory | card legacy (Quiz, Canzone, Arena, classifiche) | Radius 10–26 px fuori sistema: elencati anche in `ELENCO.md` |
| `bounce-easing` | 24 | advisory | admin, classifiche, `styles.css` (`--ease-spring`) | Le molle sono usate anche per oggetti fisici; valutare caso per caso |
| `design-system-font` | 2 | warning | `remote.component.css`, `tv/game.component.css` | Due `Roboto` non dichiarati: vanno ricondotti a Bricolage o dichiarati in `DESIGN.md` |
| `gradient-text` | 4 | warning | `leaderboard-detailed.component.css` | **Violazione reale** di AGENTS: testo a gradiente, da sostituire con colore pieno |
| `codex-grid-background` | 1 | warning | `arena.component.css` | Griglia a linee sottili: valutare se è la pista (legittima) o decorazione |
| `border-accent-on-rounded` | 1 | warning | `remote.component.css` | Bordo spesso su card arrotondata: va allineato a radius 0 o bordo pieno |
| `side-tab` | 1 | warning | `remote/restyle.css` (riga fiche Azzardo) | Striscia laterale sulla riga: sostituibile con fondo tinto o bordo pieno |

Nessuna di queste è stata corretta in questo intervento: la grafica si rivede al
test live, come richiesto. Restano però elencate qui e sono il punto di partenza
per la prossima passata.

Per vedere solo i warning: `npm run audit:design -- --no-advisory`.

## Note operative

- Il detector sui **sorgenti** vede solo regole di pattern: contrasto, testi
  piccoli e bersagli si vedono solo scansionando una **URL** renderizzata.
- Gli avvisi `bounce-easing` sono advisory e non bloccano: il progetto non li
  tratta come errori finché l'animazione ha un ruolo fisico.
- La cartella `.impeccable/` (stato, cache, screenshot) non è versionata; i file
  condivisibili sono `PRODUCT.md`, `DESIGN.md` e questo documento.
