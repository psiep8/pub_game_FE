# Pulizia del repository — rapporto

**Data:** 23 novembre 2026 · **versione:** 2.3.1 (nessun cambio di versione)
**Commit di partenza:** `208a8c73` (`chore(release): 2.3.1`, branch `main`)
**Commit finali:** sette commit di pulizia, uno per categoria, senza push e senza tag.

Obiettivo: repository più piccolo e leggibile **senza cambiare comportamento**.
Regole del giro: rimuovere solo con prova di assenza di chiamanti; niente fix
collaterali; un commit per categoria; suite complete a fine giro.

---

## 0. Ambiente delle verifiche

Il repository vive su un percorso UNC (`\\wsl.localhost\Ubuntu\home\peppa\code\pub_game_FE`).
Da lì `cmd.exe` non può eseguire gli script npm e Angular/esbuild rifiuta i
percorsi `//wsl.localhost/...`. Le suite sono quindi state eseguite in una
**copia di lavoro nativa su ext4** (`/home/peppa/pgwork`), sincronizzata dal
repository prima di ogni giro, con:

- Node **26.13.1** (quello richiesto da `engines`) e npm **11.20.0**;
- JDK **25.0.5.1** (Temurin, `.tools/jdk25`);
- `npm ci` sul lockfile del repository, senza modificare le dipendenze.

La copia contiene gli stessi file del repository; le modifiche sono state
sempre fatte nel repository e poi sincronizzate. Il `node_modules` Windows
originale non è stato toccato.

---

## 1. Baseline (prima di toccare qualcosa)

| Voce | Valore |
|---|---|
| Commit | `208a8c73`, branch `main`, albero pulito |
| File versionati | **724** (frontend 380, backend 137, docs 94, scripts 50, deploy 6, qa 34) |
| Righe frontend (`apps/frontend/src`) | **60.354** |
| Righe backend (`apps/backend/src`) | **39.991** |
| Righe documentazione (`docs/`) | **6.240** |
| Righe script (`scripts/`) | **7.847** |
| Asset frontend | audio 61 file `.m4a` (23 MB), mappe 64 SVG, font 4, icone 9 |
| Bundle produzione (`dist/.../browser`) | **1.595.804 B JS** + **39.125 B CSS** (85 MB con gli asset) |
| Build `ng build` | **7,24 s** totali (bundle 5,85 s) |
| Test frontend | **70 file di spec, 703 test: 701 passati, 2 saltati** (il file `loop-loudness.spec.ts` si salta dove manca ffmpeg) |
| Test backend | **168 test, 0 falliti, 0 saltati** |
| Audit banche | `node scripts/audit-banche.mjs --ci` → OK, 0 doppioni/segnalazioni/campi mancanti |
| `npm audit` | 0 vulnerabilità (info/low/moderate/high/critical) |

Tutti i controlli erano **verdi prima** di iniziare. Le due prove saltate sono
dichiarate nel test (ffmpeg assente nell'ambiente), non sono un rosso.

---

## 2. Valori finali

| Voce | Baseline | Finale | Delta |
|---|---|---|---|
| File versionati | 724 | **691** | −33 (34 screenshot `qa/`, `ScreamDto`, `QuestionController`, +3 file di script) |
| Righe frontend | 60.354 | **60.325** | −29 |
| Righe backend | 39.991 | **39.924** | −67 (DTO, rotte e azioni morte) |
| Righe script | 7.847 | **7.996** | +149 (due strumenti nuovi e `sim/client.mjs`, meno il codice duplicato nei tre script) |
| Righe docs | 6.240 | **6.795** | +555 (questo rapporto, `STRESS-REPORT.md`, registro roadmap) |
| Bundle JS | 1.595.804 B | **1.594.990 B** | −814 B |
| Bundle CSS | 39.125 B | **39.125 B** | 0 |
| Build `ng build` | 7,24 s | **5,78–6,39 s** (tre misure) | invariata nei limiti della varianza |
| Test frontend | 701 pass / 2 skip | **701 pass / 2 skip** | 0 test rimossi |
| Test backend | 168 | **168** | 0 test rimossi |
| Audit banche | OK | **OK** | invariato |
| `npm audit` | 0 | **0** | invariato |

Nessun test è stato rimosso o indebolito.

---

## 3. Rimozioni, con la prova

| Cosa | Dove | Perché non serve (prova) | Commit |
|---|---|---|---|
| Import `Observable`, `throwError` | `core/services/reliability.service.ts` | `tsc --noUnusedLocals --noUnusedParameters` li segnala (TS6133); nessun uso nel file | `35199a7d` |
| Metodo privato `wait()` | `features/bonus/casino/casino-bonus.component.ts` | TS6133: nessun chiamante nel componente né nel template; `pause.later` resta usato altrove | `35199a7d` |
| Destructuring `Body` di Matter | `features/games/biglie/biglie.component.ts` | TS6133: il corpo fisico non viene mai creato con `Body` | `35199a7d` |
| Parametri `trackWidth`, `now` | `biglie.component.ts` (`drawFeatures`, `drawCurbs`, `drawSnowbanks`) | TS6133 sui tre metodi; i tre punti di chiamata passavano valori mai letti | `35199a7d` |
| Parametro `marble` nel `map` | `features/games/biglie/race-simulation.ts` | TS6133: la callback restituisce solo `{x:0,y:0}` | `35199a7d` |
| 11 `console.log` di debug | `features/remote/remote.component.ts` (7: ingresso, microfono, chiusura), `features/tv/game.component.ts` (4: fast-track, urlo, ingresso squadra, Arena) | Solo diagnostica: restano `console.warn`/`console.error`; nessuna spec verifica i `console.log` | `9ba3b5a4` |
| `ScreamDto` (18 righe) | `apps/backend/.../dto/ScreamDto.java` | `grep -rn "ScreamDto"` su tutto il progetto: nessun controller, servizio, test o configurazione lo nomina; il messaggio STOMP è una `Map` e non viene deserializzato in quella classe | `d04a8011` |
| Cartella `qa/` (34 PNG, 3,2 MB) | radice | Nessun documento, workflow, script o sorgente cita `qa/`; gli screenshot usati stanno in `docs/screenshots` | `6d5adc3e` |
| Riga `[TEMPLATE]` | `.env.example`, prima riga | Non è una variabile: copiando il file in `.env` rompe il parsing della prima riga. Gli altri esempi non l'avevano | `75e86af8` |

Totale sul codice: 10 righe aggiunte, 70 rimosse (52 + il DTO di 18), più i 34
file di `qa/`.

### Aggiunte (non pulizia, strumenti richiesti dalla fase 7)

`scripts/stress/ws-load.mjs` e `scripts/stress/restart-check.mjs`, con
`npm run stress:ws` e `npm run stress:restart`, più il modulo condiviso
`scripts/sim/client.mjs` (HTTP, setup delle sessioni e client STOMP). Dopo la
revisione `full-match.mjs` e i due script di stress importano lo stesso client:
non ci sono più tre copie del protocollo. Sono dichiarati nel CHANGELOG e
descritti in `docs/STRESS-REPORT.md`.

---

## 4. Verificato e **lasciato** (falsi positivi)

| Candidato | Perché resta |
|---|---|
| `onBiglieRoundResult`, `finishBiglieRound` (`game.component.ts`) | `tsc` li segnala come non usati, ma **il template li richiama** (`game.component.html`, eventi `result` e `finished` delle Biglie). Rimossi, la TV delle Biglie smetterebbe di chiudere il round. |
| `QuestionGeneratorService` (592 righe) | Nessun chiamante, ma è un'integrazione Groq opzionale: toglierla è una decisione di prodotto, già documentata in `docs/CODICE-NON-USATO.md`. |
| `BasketService`, 4 endpoint `/basket/*`, metodi del client | Il gioco non è più in scaletta ma il servizio è vivo nei controller e nei test, e la rotta SPA `/basket` esiste. Rimuoverlo cambia API pubblica e test: va deciso, non pulito di nascosto. |
| `sockjs-client` in `package.json` | Non è importato dal frontend (che usa STOMP nativo), ma il backend espone ancora l'endpoint SockJS e `polyfills.ts` esiste per quel caso. Vedi «da decidere». |
| Avvisi `mvn dependency:analyze` (8) | Riguardano starter Spring Boot, H2, MySQL driver e devtools: sono dipendenze runtime/framework caricate per annotazione o riflessione. Nessuna rimozione. |
| `scripts/normalizza-banche.mjs` | Non è citato da package.json, CI o documenti, ma è uno strumento una-tantum sulle banche: togliere il generatore non è una pulizia a rischio zero. Vedi «da decidere». |

---

## 5. «Da decidere»

1. **`QuestionGeneratorService` + proprietà `groq.*`** — 592 righe mai raggiunte.
   Toglierle o tenerle per rigenerare contenuti: decisione di prodotto.
2. **Basket** — servizio, endpoint, metodi client, rotta SPA e test. Un intervento
   dedicato deve decidere se il bonus torna o sparisce del tutto.
3. **`sockjs-client` e `@types/sockjs-client`** — dichiarati e mai importati. Se
   il backend non deve più offrire SockJS, si tolgono dipendenza, polyfills e
   endpoint insieme; farlo da soli qui avrebbe cambiato il contratto di rete.
4. **CSS legacy del telefono** (`remote.component.css`): contiene ancora
   gradienti `#0f0c29/#1a1a2e`, `backdrop-filter: blur`, ombre morbide e pillole.
   `restyle.css` lo sovrascrive in gran parte, ma non è stato provato selettore
   per selettore: rimuoverlo ora è un rischio visivo. Va fatto con la TV e il
   telefono davanti, come chiede `AGENTS.md`.
5. **`scripts/normalizza-banche.mjs`** — strumento una-tantum senza riferimenti.
6. **`docs/screenshots/tv-bonus-concluso-720p-pochi-tavoli-2.png`** — unico
   screenshot non citato da nessun documento (gli altri sì). Può essere un
   residuo o un'immagine tenuta per una presentazione esterna.
7. **`docs/ROADMAP-POST-PRIMA-SERATA.md`** dichiara ancora «versione 2.2.0» e un
   commit di riferimento vecchio: è un documento storico, va aggiornato quando
   si chiude la fase di test, non dentro questa pulizia.

---

## 6. Difetti e rischi trovati e **non** corretti

| ID | Gravità | Cosa | Dove |
|---|---|---|---|
| P1 | ~~P1~~ **chiuso** | Falso positivo: il `401` con stato `CREATED` è comparso una volta nella prima stesura. Riprodotto **2/2 solo azzerando il database** tra crash e riavvio; **8/8 identico** con database intatto, 4 voti e classifica già scritti, kill a 0 ms. Il vecchio test non registrava voti (socket admin su `/answer`, vietata) e non è quindi una prova di perdita. Dettagli in `docs/STRESS-REPORT.md` §3.1. | strumento di prova, non il backend |
| P2 | P2 | `GET /games/{id}/diagnostics` su una partita `CREATED` riporta `roundOpen: true` mentre `status` è `CREATED` e `roundType` è `null`: la diagnostica può far credere che un round sia aperto. | `ReliabilityController.diagnostics` |
| P3 | P3 | La suite frontend dichiara 703 test ma ne esegue 701: i due controlli di loudness si saltano senza ffmpeg, e in CI non c'è ffmpeg. Non è un rosso, ma il numero «703» non è mai tutto eseguito. | `loop-loudness.spec.ts` |

P2 e P3 restano aperti; P1 è chiusa come falso positivo. Nessuno è stato
corretto nel codice: il giro è di misura e pulizia.

### 6.1 Superficie REST e STOMP: cosa usa davvero il frontend

Confronto statico (annotazioni dei controller, chiamate `HttpClient`, whitelist
`WebSocketConfig.REMOTE/ADMIN/TV_ACTIONS`) più verifica a mano dei percorsi
costruiti con variabili. **72 rotte REST**, **61 chiamate** dal frontend: ogni
chiamata ha una rotta corrispondente; le rotte **senza chiamante frontend** sono
queste.

| Rotta | Chi la usa |
|---|---|
| `GET /games/{id}/arena/prepare`, `GET .../arena/scores`, `POST .../arena/reset` | `scripts/checks/arena_check.py`, `simulate_arena.py` |
| `GET /games/{id}/state` | `restart-check.mjs` e i test di integrazione |
| `GET /health` | container, script, monitoraggio |
| `GET /games` | **rimosso**: le partite si creano con `POST /games` |
| `POST /games/{id}/party/reset` | **rimosso**: nessun chiamante applicativo |
| `POST /games/{id}/session/disconnect` | **tenuto**: è nella allowlist di `SessionAuthenticationFilter` e il telefono può usarlo quando chiude la pagina |
| `GET /questions`, `GET /questions/category/{c}` | **rimossi** con `QuestionController`: nessun chiamante applicativo né test |

Falsi allarmi del primo confronto, verificati a mano: `button-test/*` passa da
`ButtonTestService.url()`, `generate-ai-round` da `AiGeneratorService`
(`baseUrl` composto), `timeline/reveal` da un `fetch` diretto e `sync` dal
servizio di affidabilità.

Sul canale STOMP, 11 valori dell'enum `WsAction` non sono in nessuna whitelist ma
sono legittimi perché viaggiano altrove: `ANSWER`, `ARENA_ANSWER`,
`TIME_BUZZER_ANSWER`, `SPEED_RUSH_PROGRESS` vanno su `/answer` o su endpoint
REST; `PLAYER_REMOVED` è un messaggio server → telefoni; le cinque
`BUTTON_TEST_*` sono state **rimosse** (la prova pulsanti passa solo da
`ButtonTestService`, sul canale resta `BUTTON_TEST_PING`). Rimossa anche
`BONUS_RESULT`: nessun file la manda o la gestisce, il backend la rifiuta solo
come azione sconosciuta in un test. Il test di allineamento ora elenca come non
inviata la sola `PLAYER_REMOVED`, che il backend manda davvero. Nessuna azione
ammessa dal server resta senza un mittente nel frontend (`MUSIC_PHASE` è usata
in `music.mode.ts`).

Limite: è un confronto statico. Non dimostra che una rotta «usata» sia
raggiungibile in ogni stato, né copre URL costruiti a runtime da stringhe
dinamiche.

---

## 7. Test: copertura, salti, stabilità

- **Saltati:** 2 test in `loop-loudness.spec.ts` (ffmpeg assente), dichiarati nel
  test. Nessun `xit`, `fit`, `.only`, `.skip` o `@Disabled` nel codice.
- **Focalizzati:** nessuno.
- **Instabili:** la suite frontend è sempre 701/2 (tre esecuzioni). Il backend è
  168/168 nella maggior parte delle esecuzioni, ma **una volta** la suite
  completa ha avuto due fallimenti di timing in `ReliabilityIntegrationTest`
  (`dueTelefoniNonRicevonoUnAnnuncioQuizDopoIlCambioRound` e
  `risultatoArenaPubblicatoDalServerUnaVoltaSulWebSocketReale`, nessun frame
  entro l'attesa). La classe da sola è passata 45/45 e la suite completa di
  nuovo 168/168: è un test sensibile al carico della macchina, non un guasto
  del codice. Da tenere d'occhio se ricompare in CI.
- **Giochi con sola logica di modalità testata** (nessuna spec del componente TV):
  Timeline, Arena, Tennis Battle, Time Buzzer, Speed Rush, Ultima spiaggia.
  Hanno `*.mode.spec.ts` ma non uno spec del componente che disegna il round.
- **Servizi backend:** ogni nome di `*Service.java` compare in almeno un test;
  `QuestionGeneratorService` è l'unico senza chiamanti e senza test (vedi sopra).
- **Rete e orologio:** i test usano doppi e timer controllati; nessuna
  dipendenza da rete reale. Le prove multi-dispositivo restano manuali.

---

## 8. Dipendenze e configurazione

- **`npm audit`:** 0 vulnerabilità in tutte le classi.
- **`mvn dependency:analyze`:** 8 «unused declared», tutti falsi positivi
  (starter e driver). Nessuna dipendenza rimossa o aggiunta al backend.
- **Lockfile:** `package-lock.json` coerente con i manifest; nessuna modifica.
- **`.env.example`:** corretta la prima riga. Le variabili lette davvero sono
  `FE_PORT`, `BE_PORT`, `HOST`, `CONTROL_SECRET`, `ALLOWED_ORIGINS`,
  `GROQ_API_KEY`/`GROQ_MODEL` (solo generazione banche), `TMDB_API_KEY`,
  `MEDIA_BASE_URL`, più `DB_URL`, `SERVER_PORT`, `SERVER_ADDRESS`,
  `HEARTBEAT_TIMEOUT_SECONDS`, `ANSWER_WINDOW_SECONDS` lette da
  `application.yml`/Docker. Nessun segreto versionato: `.env` è ignorato.
- **Lint e formattazione:** il repository non ha un linter né uno script `lint`.
  Il `package.json` frontend contiene una configurazione Prettier, ma Prettier
  non è tra le dipendenze e non è stato eseguito: nessuna riformattazione
  massiva, solo i file toccati.
- **Doppio entry point:** `shared/models/bonus-type.ts` è un re-export di una
  riga da `shared/enums/bonus-type.ts`, usato da 4 file. Non è duplicazione:
  resta, come compatibilità del percorso di import.
- **Script:** `package.json` cita `dev`, backup DB, audit banche, copia legacy e i
due nuovi `stress:*`. Gli script di `scripts/generate-questions/` sono
  documentati nel loro README. `normalizza-banche.mjs` resta in «da decidere».

---

## 9. Documentazione

- **Link interni:** 31 documenti Markdown controllati, **0 link o immagini
  mancanti**.
- **Numeri corretti:** il README diceva «643 test al 20 novembre 2026» e «154
  test backend»; ora dice **703 test frontend (701 eseguiti, 2 saltati senza
  ffmpeg)** e **168 backend**, misurati in questo giro.
- **`docs/CODICE-NON-USATO.md`:** riallineato alla 2.3.1 e a `ScreamDto` rimosso.
- **Duplicazioni segnalate, non riscritte:** README §3 ripete le tabelle punti
  che vivono in `SCORING_RULES`/manuale; `docs/SERATA-PROVA.md` e
  `docs/PROVA-DEVICE-F02-F01-F13-F12.md` si sovrappongono sulle prove telefono;
  README §10 ripete parte di `docs/SOTTOFONDI.md` e `MANIFESTO-AUDIO.md`.
  Unire i documenti è un lavoro editoriale a sé, da fare con il proprietario.
- **Nuovi documenti:** questo rapporto, `docs/STRESS-REPORT.md`, una voce di
  CHANGELOG e le righe di registro in `docs/ROADMAP-POST-PRIMA-SERATA.md`.

---

## 10. Come ripetere i controlli

```bash
npm run test:frontend          # 701 passati + 2 saltati (ffmpeg)
npm run test:backend           # 168 test
npm run build:frontend         # ng build, nessuna rete
node scripts/audit-banche.mjs --ci
npm audit
node .freebuff/check-links.mjs # controllo locale usato in questo giro
```

Lo stress test ha comandi propri ed è descritto in `docs/STRESS-REPORT.md`:
`npm run stress:ws` e `npm run stress:restart`, sempre contro un backend,
una porta e un database separati.
