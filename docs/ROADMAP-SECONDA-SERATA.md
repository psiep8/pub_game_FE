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
| **N-01** | Il codice di regia si generava **solo premendo GENERA CODICE** e la TV chiedeva il `CONTROL_SECRET` in un `window.prompt`. Con il database azzerato il token TV salvato non valeva più e senza segreto non si poteva generare nessun codice: stallo. Il codice non si rinnovava da solo e il pannello aveva un pulsante in più. In più la sessione TV si apriva con **un solo tentativo**: se il backend non era ancora pronto, la postazione restava «NON IN LINEA» fino al reload. | La TV si registra come schermo senza segreto (ADMIN resta protetto dal codice); il codice si chiede da solo appena la lobby è aperta, si rigenera alla scadenza e dopo l'uso; la TV mostra il **QR `/admin?pair=<codice>`**; il pannello ha un solo campo a 6 cifre con invio automatico e messaggi distinti per codice scaduto/bloccato. La sessione d'avvio si riprova con attese crescenti e poi si riapre da sola; il segreto di regia si applica prima di ogni attesa (`183b46e`). |
| **N-02** | La TV aveva una dock di comandi in alto a destra (audio, pausa, tema, AVANTI, reset) usata anche in serata; la regia aveva molti pulsanti equivalenti e nessun comando primario unico. | Dock TV visibile **solo con `?debug=1`**. In regia una barra fissa in basso con **un solo pulsante primario** che dice cosa farà: `AVVIA ROUND N · TIPO`, `PROSSIMA MANCHE · TIPO`, `CHIUDI RIEPILOGO · ROUND N`, `RIPRENDI`. |
| **N-03** | La finestra del round sul server per `IMAGE_BLUR` era **60 s + 30 s di tolleranza**, mentre il gioco ha **tre manche da 45 s** (135 s più i reveal). La manche 1 stava dentro, la 2 e la 3 cadevano fuori: il server considerava il round chiuso e i telefoni non potevano più prenotarsi. In più il filtro ADMIN del WebSocket scartava `PLAYER_PRENOTATO`: la regia non vedeva il buzz e non poteva confermarlo. Restava un terzo difetto: la TV annunciava le manche 2 e 3 con `SHOW_QUESTION`, quindi il telefono restava in `WAITING` (pulsante PRENOTATI assente) e la regia perdeva i pulsanti di giudizio; l'E2E, inoltre, cliccava il pulsante rimasto dal gioco precedente, che il server scartava perché il round era già chiuso. | `ROUND_SECONDS["IMAGE_BLUR"]` portato a **3 × (45 + 15) = 180 s**; test d'integrazione che verifica una finestra maggiore di 135 s. Il gioco resta a tre manche: la modifica a quattro manche è N-21 (blocco C). Ogni manche ora apre `START_VOTING` con la soluzione della manche corrente (`currentSolution`); la regia tratta i giochi a prenotazione come `ACTIVE` anche su `SHOW_QUESTION`; all'apertura di ogni manche il buzz rimasto senza conferma viene scartato (`b7dbff8`); l'E2E aspetta il pulsante `PRENOTATI!` di Indovina chi e non quello del gioco precedente. |
| **N-04** | Il bonus Cavallo teneva **una sola domanda e un solo indice** per tutte le squadre: il tabellone era già unico, ma la sfida era la stessa per tutti. | Stato del bonus rifatto per squadra: otto domande a testa da blocchi diversi della stessa categoria, stesso passo, un solo tabellone; il telefono legge solo la propria domanda e il reveal è per squadra. La banca restituisce fino a **60 domande** (otto a testa) e un checkpoint vecchio con una domanda condivisa resta riprendibile. Il tabellone, che parte dalla squadra peggiore, ora segna il primo posto sulla riga giusta e con il numero corretto (`eceaf2b`); l'E2E TV + 3 telefoni gioca tutte e otto le domande (`8105ea6`). Le posizioni erano ricavate dall'indice della riga: un pari merito mostrava 1 e 2. Ora la posizione è di gara, tutte le prime sono evidenziate e la successiva salta (1, 1, 3) (`8a95bd6`). |
| **N-05** | `inputReady()` verificava solo «non in pausa / non in riallineamento / una sola scheda»: **non guardava se il round era aperto né la scadenza del server**. Dopo `ROUND_ENDED` i tasti restavano vivi fino al round successivo; alla scadenza assoluta non si chiudeva nulla se la TV non mandava l'evento. | `inputReady` richiede ora `roundActive` e `!roundClosed`; un watcher sulla **scadenza assoluta del server** chiude il round anche senza `ROUND_ENDED`; compare il timbro **ROUND FINITO · GUARDA LA TV**. Le risposte REST tardive restano rifiutate dal server con `409 round-closed`, senza errore a schermo; il buzzer WebSocket viene fermato dal client, non da un nuovo controllo sul relay (limite dichiarato). La ripresa di un round ora riporta `deadlineAt` e la TV lo annuncia ai telefoni (`847f313`). |
| **N-06** | Reset ed espulsione ripulivano solo `nickname`: `playerName` e `activeGameId` restavano nello storage e il telefono rientrava nella partita vecchia; audio e watcher della scadenza continuavano a girare. | Il ritorno al setup rimuove tutte e tre le chiavi, azzera il segnale `playerName`, ferma `AudioService`, il watcher della scadenza e riporta il round chiuso. |
| **N-08** | Su iPhone/Safari `navigator.vibrate` non esiste (o è negata): il «via» restava senza feedback e `BONUS_STARTED` usava la chiamata diretta senza fallback. | Un solo percorso `vibrate()`: se la Vibration API non c'è, accende un flash a schermo e suona un colpo breve. `BONUS_STARTED` passa dallo stesso percorso. |

## Stato delle voci

| Voce | Stato | Note |
| --- | --- | --- |
| N-01 — Aggancio regia ↔ TV | **Fatto** | Codice automatico, QR regia, rinnovo, campo unico, memoria del dispositivo. La sessione d'avvio si riprova in un unico ciclo e si riapre da sola se il backend non è pronto; il codice di regia si chiede solo a sessione aperta (`183b46e`, `77ecd59`). |
| N-02 — Pulsante unico e barra TV | **Fatto** | Dock TV dietro `?debug=1`; barra primaria in regia. |
| N-03 — Indovina chi manche 2 e 3 | **Fatto** | Finestra server corretta (`26a2c77`); l'ADMIN ora riceve anche `PLAYER_PRENOTATO` (`8aa30f2`); ogni manche riapre `START_VOTING` con la soluzione corrente e la regia resta `ACTIVE` (`2eb729b`); il buzz non confermato non passa alla manche dopo (`b7dbff8`). E2E TV + 3 telefoni superato per tutte e tre le manche. Resta N-21 (quattro manche) nel blocco C. |
| N-04 — Cavallo per squadra | **Fatto** | `1995372`. Otto domande a testa, un tabellone unico, banca fino a 60 domande; tabellone corretto (`eceaf2b`), pari merito a **1, 1, 3** (`8a95bd6`, prova 2,2,1 in `7e66227`) ed E2E TV + 3 telefoni (`8105ea6`). |
| N-05 — Telefoni cliccabili a round chiuso | **Fatto** | Blocco su `ROUND_ENDED` e su scadenza server; timbro a schermo. La scadenza è ora propagata anche nella ripresa del round (`deadlineAt`) e negli annunci TV; quella modifica è finita nel commit Musica `847f313`, non in un commit dedicato N-05. E2E TV + 3 telefoni superato. |
| N-06 — Safari, reset e beep infiniti | **Fatto** | Reset ed espulsione ora rimuovono `nickname`, `playerName` e `activeGameId`, fermano audio, watcher della scadenza e riportano il round chiuso. |
| N-07 — Tick infinito | **Da fare** | Il controllo dei proprietari audio (`AudioChannels.setOwner`) spegne già i loop della scena uscente; non è stata trovata una causa riproducibile senza la serata. |
| N-08 — Vibrazione e fallback iPhone | **Fatto** | Se `navigator.vibrate` manca o è negata, il via accende un flash e un colpo breve; `BONUS_STARTED` usa lo stesso percorso. |
| N-09 — Karaoke: controlli e demo | **Parziale** | Aggiunto `npm run check:karaoke` (banca, clip, testi e almeno 5 manche complete). Restano banner di conteggio nella lobby e prova completa con `?karaoke-demo=1`. |
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
| Suite frontend completa (dopo il riesame N-03/N-04) | **818 passati, 2 skip** (76 file su 77) |
| Test mirati `remote.component` dopo N-06/N-08 | **134 passati** |
| `npm run build:frontend` dopo N-06/N-08 | **OK** (solo warning preesistenti) |
| Playwright N-05 (TV + 3 telefoni) | **Passato** (1,1 min) |
| Playwright N-03 (TV + 3 telefoni) | **Passato** (1,4 min): tre manche, tre telefoni, buzz confermato in regia a ogni giro |
| Playwright N-04 (Cavallo, TV + 3 telefoni) | **Passato** (39,9 s): categoria, 8 passi con domande distinte per squadra, tabellone unico, finale |
| Playwright completo (N-05 + N-03 + N-04), senza reload di soccorso | **3 passati** (3,4 min). Il primo avvio aveva chiuso N-05 con la sessione del telefono resettata: alle 21:32:52 un'altra build ha riscritto `ReliabilityController.java` e alle 21:33:12 tutte le classi; DevTools ha riavviato il backend E2E e l'H2 in memoria si è svuotato, così il telefono ha ricevuto `410 session-unknown` ed è tornato al setup. Non era un difetto del client (`d67df4b`). |
| Playwright completo su porte isolate (4297/8097) | **3 passati** (3,6 min): N-05, N-03, N-04, con DevTools fermo e cartella risultati separata |
| Test frontend dopo la semplificazione TV | **823 passati, 2 skip** (76 file su 77) |
| `npm run build:frontend` dopo la semplificazione TV | **OK** (solo warning preesistenti) |
| Test frontend dopo recupero sessione TV e pari merito | **822 passati, 2 skip** (76 file su 77) |
| `npm run build:frontend` dopo i due fix | **OK** (solo warning preesistenti) |
| Test mirati `cavallo`, `remote`, `admin` | **167 passati** (15 + 137 + 15) |
| `npm run test:backend` | **223 passati**, 0 errori |
| Compilazione backend (`-DskipTests compile`) | **OK** |
| `npm run check:karaoke` | **OK**: 64 brani, 29 con testi completi, almeno 5 manche |
| `npm run test:sim` (40 round + 5 bonus) | **4 passati** |
| `node scripts/audit-banche.mjs --ci` | **Fallito**: Musica 251 brani con **5 campi/file mancanti**. Il problema è nel lavoro Musica, non toccato da questo blocco. |

**Perché il primo E2E perse la sessione (401).** Non era il client: durante il
primo avvio un'altra build sulla stessa cartella ha modificato
`ReliabilityController.java` alle 21:32:52 e ricompilato tutte le classi alle
21:33:12. Il backend E2E girava con Spring DevTools, quindi è ripartito e l'H2
in memoria (`jdbc:h2:mem:pubgame-e2e`) si è svuotato; l'heartbeat del telefono
ha ricevuto `410 session-unknown` e il client è tornato al setup, come deve.
Il banco ora spegne il restart di DevTools e usa porte e cartella risultati
proprie (`d67df4b`), così una build esterna non può più azzerare la partita.

**Limite dichiarato:** il test Playwright TV + 3 telefoni contro il backend
reale esiste (`e2e/tv-telefoni.spec.ts`, backend H2 isolato sulla 8095 o sulle
porte scelte da `E2E_BACKEND_PORT`/`E2E_FRONTEND_PORT`).
**N-05 passa**: tre telefoni, scadenza server annunciata, clock avanzato di
10 minuti, timbro `ROUND FINITO` visibile e pulsanti spenti. **N-03 passa**:
Indovina chi, tre manche, tre telefoni, buzz visibile e confermato in regia a
ogni manche. **N-04 passa**: Cavallo con tre telefoni, categoria scelta dai
telefoni, otto domande per squadra, tabellone unico fino al finale. La prova in
sala resta obbligatoria per il ritmo reale e per le mani sui telefoni veri; il
banco apre la TV col segreto di regia, come la postazione di sala.

**Nota di sicurezza su N-01.** La TV si apre una volta con `?regia=<segreto>`
e lo conserva in locale: solo così è regia e può generare il codice o leggere le
soluzioni. Una TV aperta senza segreto resta una lobby schermo, con sola
sincronizzazione e diagnostica; il Cavallo richiede quindi la TV di sala aperta
col segreto. La regia (**ADMIN**) resta protetta dal codice a 6 cifre. Il relay
WebSocket non distingue ancora il ruolo per i comandi di avanzamento: è un limite
**preesistente**, non introdotto qui, da chiudere quando si affronterà
l'autorizzazione dei comandi.

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
| N-01 | Fatto | Codice solo su pulsante + segreto in prompt; nessun rinnovo automatico; sessione TV con un solo tentativo; due percorsi di recupero in corsa col codice | `edb782a` (con N-02), `183b46e`, `77ecd59`, `d67df4b` | Test mirati regia/TV; test TV su retry e segreto prima della sessione; E2E senza reload di soccorso, su porte isolate (3 passati) | Aprire `/tv` prima che il backend sia pronto: la lobby arriva e il codice compare da solo, senza ricaricare. Inquadrare il QR col telefono: `/admin` è già abbinato. Ricaricare la regia: resta abbinata. |
| N-02 | Fatto | Dock TV sempre visibile; nessun comando primario unico in regia | `edb782a` (con N-01) | Test `primaryAction` e dock nascosta | In TV non c'è la barra in alto a destra. In regia il pulsante in basso dice cosa farà; percorrere un round con quello. |
| N-03 | Fatto | Finestra server `IMAGE_BLUR` di 60 s contro tre manche da 45 s; l'ADMIN veniva filtrato su `PLAYER_PRENOTATO`; le manche 2 e 3 arrivavano come `SHOW_QUESTION` e spegnevano pulsante e regia; il buzz restava selezionato nella manche dopo | `26a2c77`, `8aa30f2`, `2eb729b`, `b7dbff8` | Integrazione `RoundWindowTest`; E2E TV + 3 telefoni per tutte e tre le manche; 152 test mirati (15 admin + 137 remote) | Indovina chi: prenotarsi nella manche 1, 2 e 3 con tre telefoni e confermare ogni buzz dalla regia; saltare un buzz e verificare che non resti selezionato. |
| N-04 | Fatto | Una domanda sola per tutte le squadre; tabellone con primo posto sulla riga sbagliata e posizione presa dall'indice | `1995372`, `eceaf2b`, `8105ea6`, `8a95bd6`, `7e66227` | Test `cavallo` (17, incluso il pari merito 2,2,1), `remote` (137), `admin` (15); E2E Cavallo TV + 3 telefoni (39,7 s); build frontend; backend 223 | Cavallo: tre telefoni scelgono la categoria e ricevono domande diverse; il tabellone somma le giuste di tutti e mette in fondo il primo posto. Portare due squadre a pari punti: entrambe in fondo evidenziate, posizione 1 e la successiva 3. |
| N-05 | Fatto | `inputReady` ignorava round aperto e scadenza del server; la ripresa non annunciava `deadlineAt` | `2ccd238` (scadenza in `847f313`) | E2E TV + 3 telefoni superato; test unitari | Speed Rush/Arena/Quiz: a round chiuso i tasti si spengono subito e compare ROUND FINITO. |
| N-06 | Fatto | Reset/espulsione lasciavano `playerName` e `activeGameId`, audio e watcher attivi | `fd0ceae` | Test `remote` (134 passati) | Espellere una squadra e resettare la TV: il telefono torna al setup senza rientrare nella partita vecchia. |
| N-08 | Fatto | Su iPhone manca `navigator.vibrate` e il via restava muto | `fd0ceae` | Test `remote` sul fallback visivo | Aprire il telefono su iPhone: al via del bonus si vede il flash oltre alla scena in TV. |
| N-09 | Parziale | Mancava un controllo automatico di testi e clip; restano banner e demo completa | `68ace56` | `npm run check:karaoke` | Karaoke: verificare in lobby il conteggio delle manche pronte e provare il banco demo. |

_Le voci non elencate restano da fare e non vanno considerate chiuse._

## Blocco M — Musica (verifiche e rifiniture)

### M-01 `audit-banche --ci` falliva sulla Musica — **Fatto**

**Causa trovata.** L'audit leggeva la banca sbagliata. Controllava
`questions/media-it.json`, che **non è versionato** e contiene l'indice media
completo (copertine, persone, 251 brani scaricati, compresi quelli fuori
catalogo e senza tag di tema/era). La banca che la Musica serve davvero è
`questions/music-themes.json`, prodotta da `scripts/banche/tagga-musica.mjs`:
236 brani con tema, era, decennio e difficoltà. Da qui i due sintomi opposti:
sulla macchina di sala l'audit falliva con «251 brani con 5 campi/file
mancanti»; in un checkout pulito il file non c'era e i controlli media
venivano **saltati in silenzio** (verde falso).

**Intervento.** `scripts/audit-banche.mjs` ora valida `music-themes.json` e la
fa bloccare la CI: campi obbligatori, tema fra i 10 dichiarati, era coerente
con l'anno (vuota solo per i brani anni '60, per scelta del generatore),
decennio uguale all'anno arrotondato, difficoltà hit/medium/hard, percorso
`/media/music/…` non ripetuto, nessun doppione titolo+artista, ogni tema con
almeno 5 brani e il mix **2 hit + 2 medi + 1 difficile con artisti distinti**.
La presenza dei file `.m4a` si controlla solo dove esiste la cartella statica
(la macchina della serata), perché l'audio non è versionato; se c'è l'indice
media, si verifica anche che ogni brano taggato vi sia ancora.

**Brani segnalati dall'audit vecchio.** I 6 brani anni '60 (Beatles ×4,
Rolling Stones, Morricone) non hanno era: è la regola di `tagga-musica.mjs`
(restano raggiungibili solo dalle famiglie) e non un campo mancante. I 15
brani di differenza fra 251 e 236 sono voci dell'indice media fuori catalogo:
non entrano in scaletta e non vanno corretti a mano.

**Test.** `scripts/checks/audit-musica.test.mjs` (7 casi: banca completa,
tema/decennio mancanti, decennio incoerente, era incoerente, artisti ripetuti,
tema corto, anni '60), agganciato a `npm run test:sim`. `node
scripts/audit-banche.mjs --ci` esce **0** con 236 brani e 0 problemi.
