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
| CLI | devDependency `impeccable` + binario del motore in `~/.impeccable/` | `npm run audit:design` |
| Contesto prodotto | `PRODUCT.md` | Utenti, scopo, vincoli, principi |
| Sistema visivo | `DESIGN.md` | Token reali da `styles.css` e regole carta/inchiostro |
| Istruzioni progetto | `AGENTS.md` § *Design review con Impeccable* | Precedenza dello stile Pub Game |

**La skill non sostituisce lo stile del progetto.** `AGENTS.md`, `DESIGN.md` e i
token in `apps/frontend/src/styles.css` vincono su qualunque suggerimento della
skill: Impeccable serve a trovare le mancanze *dentro* il linguaggio carta e
inchiostro, non a importare gradienti, vetro o card arrotondate.

`DESIGN.md` non fissa hex: descrive il contratto dei token e gli **otto temi**
(`editorial-acid` è il predefinito). I valori vivono solo in `styles.css`, così
cambiare palette non richiede di riscrivere la doc.

## Comandi

```bash
npm run audit:design                    # detector sui sorgenti frontend
npm run audit:design -- --no-advisory   # solo i warning
npx impeccable detect --json apps/frontend/src
npx impeccable update                   # aggiorna skill e motore
```

Per la scansione di una pagina renderizzata (contrasto, testi piccoli, bersagli)
serve un browser Chromium e il dev server attivo:

```bash
IMPECCABLE_BROWSER=$HOME/.cache/ms-playwright/chromium-1255/chrome-linux-arm64/chrome \
  npx impeccable detect http://127.0.0.1:4200
```

## Prima scansione (23 novembre 2026)

Con `DESIGN.md` senza hex il detector confronta i componenti con i token, non con
una palette fissata: **86 segnalazioni**, di cui 78 advisory e 8 warning.

| Regola | Quante | Gravità | Dove | Giudizio |
|---|---|---|---|---|
| `design-system-radius` | 53 | advisory | card legacy (Quiz, Canzone, Arena, classifiche) | Radius 10–26 px fuori sistema: gli stessi elencati in `ELENCO.md` |
| `bounce-easing` | 24 | advisory | admin, classifiche, `styles.css` (`--ease-spring`) | Le molle sono usate anche per oggetti fisici; valutare caso per caso |
| `codex-grid-background` | 1 | advisory | `arena.component.css` | Griglia a linee sottili: valutare se è la pista (legittima) o decorazione |
| `gradient-text` | 4 | warning | `leaderboard-detailed.component.css` | **Violazione reale** di AGENTS: testo a gradiente, da sostituire con colore pieno |
| `design-system-font` | 2 | warning | `remote.component.css`, `tv/game.component.css` | Due `Roboto` non dichiarati: vanno ricondotti a Bricolage o dichiarati in `DESIGN.md` |
| `border-accent-on-rounded` | 1 | warning | `remote.component.css` | Bordo spesso su card arrotondata: va allineato a radius 0 o bordo pieno |
| `side-tab` | 1 | warning | `remote/restyle.css` (riga fiche Azzardo) | Striscia laterale sulla riga: sostituibile con fondo tinto o bordo pieno |

Nessuna di queste è stata corretta in questo intervento: la grafica si rivede al
test live, come richiesto. Restano però elencate qui e sono il punto di partenza
per la prossima passata.

## Note operative

- Il detector sui **sorgenti** vede solo regole di pattern: contrasto, testi
  piccoli e bersagli si vedono solo scansionando una **URL** renderizzata.
- Gli avvisi `bounce-easing` sono advisory e non bloccano: il progetto non li
  tratta come errori finché l'animazione ha un ruolo fisico.
- La cartella `.impeccable/` (stato, cache, screenshot) non è versionata; i file
  condivisibili sono `PRODUCT.md`, `DESIGN.md` e questo documento.
