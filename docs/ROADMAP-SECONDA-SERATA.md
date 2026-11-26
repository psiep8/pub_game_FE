# quizzOne 3.2 — registro della seconda serata

Riferimento: `FIX-SECONDA-SERATA-2026-11-26.md` (allegato in chat, non presente
nella radice del repository). Base esaminata: `main` a `ccf257c`, release 3.1.1
del 25/11 più il lavoro sugli sticker. Nessun tag creato.

## Audit iniziale: cosa era già stato fatto

Al momento dell'apertura del cantiere **nessuna delle voci N-01…N-55 era
presente nel repository**. Il working tree conteneva inoltre, non committato,
un lavoro in corso su **Musica** (quattro round, cinque manche): non è stato
toccato né incluso nei commit di questo blocco.

- `git log` non contiene commit con riferimenti `N-xx`;
- `docs/ROADMAP-POST-PRIMA-SERATA.md` chiude alla 3.1.1 e al registro della
  prova serata del 25/11 (voci `F-xx`), senza la lista della seconda serata;
- non esisteva alcun test Playwright, né configurazione Playwright, nonostante
  la dipendenza `playwright` fosse già nel `package.json` della radice;
- il flusso di abbinamento regia esisteva ma richiedeva il segreto di regia in
  un `window.prompt` e un pulsante **GENERA CODICE** sulla TV.

Quindi il lavoro riparte da zero, con la sola eccezione dei meccanismi già
presenti (QR dei telefoni, token di sessione per ruolo, codice a 6 cifre con
scadenza e blocco dopo cinque errori).

## Cause trovate (blocco A)

| Voce | Causa trovata | Intervento |
| --- | --- | --- |
| **N-01** | Il codice di regia si generava **solo premendo GENERA CODICE** e la TV chiedeva il `CONTROL_SECRET` in un `window.prompt`. Con il database azzerato il token TV salvato non valeva più e senza segreto non si poteva generare nessun codice: stallo. Il codice non si rinnovava da solo e il pannello aveva un pulsante in più. | La TV si registra come schermo senza segreto (ADMIN resta protetto dal codice); il codice si chiede da solo appena la lobby è aperta, si rigenera alla scadenza e dopo l'uso; la TV mostra il **QR `/admin?pair=<codice>`**; il pannello ha un solo campo a 6 cifre con invio automatico e messaggi distinti per codice scaduto/bloccato. |
| **N-02** | La TV aveva una dock di comandi in alto a destra (audio, pausa, tema, AVANTI, reset) usata anche in serata; la regia aveva molti pulsanti equivalenti e nessun comando primario unico. | Dock TV visibile **solo con `?debug=1`**. In regia una barra fissa in basso con **un solo pulsante primario** che dice cosa farà: `AVVIA ROUND N · TIPO`, `PROSSIMA MANCHE · TIPO`, `CHIUDI RIEPILOGO · ROUND N`, `RIPRENDI`. |
| **N-03** | La finestra del round sul server per `IMAGE_BLUR` era **60 s + 30 s di tolleranza**, mentre il gioco ha **tre manche da 45 s** (135 s più i reveal). La manche 1 stava dentro, la 2 e la 3 cadevano fuori: il server considerava il round chiuso e i telefoni non potevano più prenotarsi. | `ROUND_SECONDS["IMAGE_BLUR"]` portato a **3 × (45 + 15) = 180 s**; test d'integrazione che verifica una finestra maggiore di 135 s. Il gioco resta a tre manche: la modifica a quattro manche è N-21 (blocco C). |
| **N-05** | `inputReady()` verificava solo «non in pausa / non in riallineamento / una sola scheda»: **non guardava se il round era aperto né la scadenza del server**. Dopo `ROUND_ENDED` i tasti restavano vivi fino al round successivo; alla scadenza assoluta non si chiudeva nulla se la TV non mandava l'evento. | `inputReady` richiede ora `roundActive` e `!roundClosed`; un watcher sulla **scadenza assoluta del server** chiude il round anche senza `ROUND_ENDED`; compare il timbro **ROUND FINITO · GUARDA LA TV**. Le risposte REST tardive restano rifiutate dal server con `409 round-closed`, senza errore a schermo; il buzzer WebSocket viene fermato dal client, non da un nuovo controllo sul relay (limite dichiarato). |

## Stato delle voci

| Voce | Stato | Note |
| --- | --- | --- |
| N-01 — Aggancio regia ↔ TV | **Fatto** | Codice automatico, QR regia, rinnovo, campo unico, memoria del dispositivo. |
| N-02 — Pulsante unico e barra TV | **Fatto** | Dock TV dietro `?debug=1`; barra primaria in regia. |
| N-03 — Indovina chi manche 2 e 3 | **Fatto (causa)** | Finestra server corretta; resta da fare N-21 (quattro manche) nel blocco C. |
| N-04 — Cavallo per squadra | **Da fare** | Refactor dello stato del bonus: domanda per squadra, non per bonus. |
| N-05 — Telefoni cliccabili a round chiuso | **Fatto** | Blocco su `ROUND_ENDED` e su scadenza server; timbro a schermo. |
| N-06 — Safari, reset e beep infiniti | **Da fare** | |
| N-07 — Tick infinito | **Da fare** | |
| N-08 — Vibrazione e fallback iPhone | **Da fare** | |
| N-09 — Karaoke: controlli e demo | **Da fare** | |
| N-10…N-15 (blocco B) | **Da fare** | |
| N-16…N-48 (blocco C) | **Da fare** | D2 (Timeline e gioco che la sostituisce nell'atto 1) **non toccata**: serve la scelta del committente. |
| N-49…N-51 (blocco D) | **Da fare** | |
| N-52…N-55 (blocco E) | **Da fare** | N-53 si ferma alla demo Quiz per approvazione. |

## Test eseguiti

| Cosa | Esito |
| --- | --- |
| `npm run build:frontend` | **OK** (solo warning preesistenti: budget CSS TV e moduli CommonJS `qrcode`/`matter-js`) |
| Test mirati frontend (`admin`, `remote`, `game`) | **274 passati** |
| `ReliabilityIntegrationTest#imageBlurRestaApertoPerTutteETreLeManche` | **1 passato** |
| `PairingCodeServiceTest`, `RoundWindowTest`, `SessionAuthenticationFilterTest` | **9 passati** |
| Suite frontend completa | **805 passati, 2 skip** (76 file su 77) |
| `npm run test:sim` (40 round + 5 bonus) | **4 passati** |
| `node scripts/audit-banche.mjs --ci` | **Fallito**: Musica 251 brani con **5 campi/file mancanti**. Il problema è nel lavoro Musica non committato presente nel working tree, non toccato da questo blocco. |

**Limite dichiarato:** non è stato scritto né eseguito un test Playwright
TV + 3 telefoni contro il backend reale. Le due voci [RIAPERTE] del blocco A
(N-03, N-05) sono coperte da test di unità/integrazione che riproducono la causa
(finestra server troppo corta, `inputReady` senza round aperto), non da una
serata simulata nel browser. La prova in sala resta obbligatoria.

**Nota di sicurezza su N-01.** Per far comparire il codice anche con il database
azzerato, la sessione **TV** si apre senza segreto: la TV è uno schermo, non un
comando. La regia (**ADMIN**) resta protetta dal codice a 6 cifre, che solo una
sessione TV valida può generare. Il relay WebSocket non distingue ancora il ruolo
per i comandi di avanzamento: è un limite **preesistente**, non introdotto qui,
da chiudere quando si affronterà l'autorizzazione dei comandi.

## Decisioni D1–D5

- **D1 (Quiz quattro manche)**: non ancora applicata; è N-17 nel blocco C.
- **D2 (Timeline in atto 2/4/5 e gioco che la sostituisce nell'atto 1)**:
  **sospesa in attesa della scelta del committente**, come richiesto. Nessuna
  modifica alla scaletta.
- **D3 (Arena ±10)**: non ancora applicata; N-48.
- **D4 (Azzardo copertura)**: non ancora applicata; N-38.
- **D5 (Indovina chi quattro manche)**: non ancora applicata; N-21.

## Tabella di consegna (blocco A)

| Voce | Stato | Causa | Commit | Test | Cosa provare in sala |
| --- | --- | --- | --- | --- | --- |
| N-01 | Fatto | Codice solo su pulsante + segreto in prompt; nessun rinnovo automatico | `edb782a` (con N-02) | Test mirati regia/TV; build | Aprire `/tv`: il QR REGIA e il codice compaiono da soli. Inquadrare il QR col telefono: `/admin` è già abbinato. Ricaricare la regia: resta abbinata. |
| N-02 | Fatto | Dock TV sempre visibile; nessun comando primario unico in regia | `edb782a` (con N-01) | Test `primaryAction` e dock nascosta | In TV non c'è la barra in alto a destra. In regia il pulsante in basso dice cosa farà; percorrere un round con quello. |
| N-03 | Fatto (causa) | Finestra server `IMAGE_BLUR` di 60 s contro tre manche da 45 s | `26a2c77` | Test d'integrazione e `RoundWindowTest` | Indovina chi: prenotarsi nella manche 1, 2 e 3 con tre telefoni. |
| N-05 | Fatto | `inputReady` ignorava round aperto e scadenza del server | `2ccd238` | Test unitari su `ROUND_ENDED` e scadenza | Speed Rush/Arena/Quiz: a round chiuso i tasti si spengono subito e compare ROUND FINITO. |

_Le voci non elencate restano da fare e non vanno considerate chiuse._
