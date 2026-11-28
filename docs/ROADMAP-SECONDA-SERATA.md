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
| N-10…N-15 (blocco B) | **Fatto / N-10b** | N-10 **chiuso sul layout**: CLS 0 e shift 0 in tutte le misure; il passaggio a sole dissolvenze ha chiuso le ultime cause (stage, scena Musica). Resta **N-10b**, il budget frame (`framesOver50 === 0` in `e2e/ingressi.spec.ts`, 100 ms/1 in isolamento, 433 ms/27 nel flusso reale): è tracciato nello STATUS, non riapre N-10. N-11…N-14 fatti; N-15 fatto. |
| N-16…N-48 (blocco C) | **Parziale** | N-16 fatto: riepilogo a punti e TV con le sole risposte esatte. Bonus: Sette e Mezzo 1v1 al posto del Blackjack in scaletta, telefoni e regia; il codice Blackjack resta ma è fuori dal flusso. Restano N-17…N-48; D2 (Timeline e gioco che la sostituisce nell'atto 1) **non toccata**: serve la scelta del committente. |
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

### N-07 ticchettio infinito — **Fatto**

**Causa trovata (misurata, non dedotta).** Il tic del timer non aveva un
proprietario: `openRound()` chiamava `audioService.startClock()` con *qualsiasi*
modalità con `timerDuration > 0`, quindi anche nella Musica — che deve stare in
silenzio — e la ripresa dalla pausa lo riaccendeva anche su un round già chiuso
(timer a zero, soluzione a schermo), dove nessun `onTimerEnd` sarebbe più
arrivato a fermarlo. Il canale `loop-gioco` restava acceso fino al cambio di
scena successivo: per tutta la classifica, il bonus o la pausa d'atto.

Il banco `e2e/tv-telefoni.spec.ts` (TV + 3 telefoni, backend reale) campiona
`channelSnapshot()` ogni 5 s. Prima del fix, nella Musica:

```
owner: "round:2:MUSIC", event: "clock"   (4 campioni su 4)
```

**Intervento.** Un solo predicato, `roundClockApplies(mode)`: timer vivo, non
MUSIC, non rivelato, non in pausa e `timer() > 0`. Lo usano i tre punti che
accendevano il tic (apertura round, ripresa dalla pausa, restore dopo refresh).
Dopo il fix lo stesso campione è vuoto e il Quiz continua ad avere il suo tic.

**Test.** `e2e/tv-telefoni.spec.ts` → «N-07: il tick del timer ha un
proprietario»: Quiz con clock, Musica senza, dopo pausa/ripresa senza, dopo
reload + Riprendi senza. Rosso prima, verde dopo.

### N-09 banner Karaoke in lobby — **Codice e test fatti, giro in sala da fare**

**Causa.** La lobby non diceva se il Karaoke era cantabile: la regia scopriva i
testi mancanti solo quando il bonus entrava in scena con «TESTO NON
DISPONIBILE». La scaletta, intanto, non aveva modo di sapere che il bonus
andava saltato, e la serata si fermava.

**Intervento.** `GET /karaoke/pronostico` (pubblico, come il resto della lobby)
restituisce `{canzoni, pronte, minimo, ok}`; la TV lo legge in `bootLobby()`,
mostra `.lobby-karaoke` («29 canzoni pronte su 5», verde/rosso) e
`startScheduledBonus()` salta il Karaoke quando `ok` è falso, registrando
«KARAOKE saltato» nello stato della regia. Se il conteggio non è ancora
arrivato si lascia partire: meglio un bonus che un round perso per una rete
lenta. `?karaoke-demo=1` riusa `preview` e le manche finte già presenti nel
componente Karaoke.

**Test.** `KaraokeControllerTest` (pronostico con e senza testi),
`game.component.spec.ts` (skip del bonus, avvio quando i testi ci sono, banner
acceso/spento). **Da fare in sala:** il giro completo `?karaoke-demo=1` (stop,
silenzio, prenotazione, CORRETTO, SBAGLIATO, riapertura, pausa, ricarica).

### M-02 i brani del Karaoke non escono in Musica — **Fatto**

**Causa.** Le due banche si sovrappongono: 41 dei 64 titoli del Karaoke sono
anche in `music-themes.json`. Una serata poteva chiedere in Musica la stessa
canzone che il Karaoke dell'atto 1 avrebbe fatto cantare. La disgiunzione
statica non è possibile (escludendo tutti i 64 brani il tema «Italiano» resta
con 1 hit e il mix 2+2+1 non si chiude), quindi l'esclusione è **per partita**.

**Intervento.** `MusicRoundService` riceve `KaraokeService`, calcola
`bonusReserved(gameId)` (le cinque manche deterministiche del Karaoke di quella
partita) e le toglie dalla pesca dei quattro round Musica, in tutti i round e
in tutte le manche. La banca non cambia: nessun brano viene scartato in
generale, solo da quella serata.

**Test.** `MusicRoundTest.quarantaPartiteNonUsanoMaiIBraniDelKaraoke`: 40
partite × 4 round × 5 manche, nessun titolo del Karaoke, nessuna ripetizione.

### M-05 `startAt` per i primi quattro secondi — **Fatto (misure da fare in sala)**

**Causa.** Le clip partivano sempre da `0`: un brano con intro muta o
strumentale lunga consumava la finestra da 4 s del primo ascolto senza far
sentire niente, e la difficoltà diventava casuale.

**Intervento.** `music-themes.json` accetta un `startAt` opzionale (secondi,
default 0) che `TaggedTrack` porta nel payload e la TV usa come punto di
partenza della clip; l'offset di ripresa si somma a quel punto. Lo script
`scripts/banche/start-at-musica.mjs` misura il silenzio iniziale con
`ffmpeg silencedetect`, propone un `startAt` e scrive la lista da ascoltare a
mano in `docs/DOMANDE-DA-REVISIONARE.md` (`--write`). Nessun valore è stato
inventato: i file audio non sono versionati, quindi le misure si fanno sulla
macchina della serata.

### M-06 rifiniture — **Verificato**

- (a) La TV mostra già il contatore mono «MANCA n/5» e il tema del round; il
  pacchetto completo di etichette (round, ascolto, punti) è N-06, ancora
  aperto nel blocco B.
- (b) Riepilogo del round: N-11, ancora aperto.
- (c) Nome del prodotto: manuali, demo e PDF dicono già **quizzOne**; «PubGame»
  resta solo dove è il nome tecnico del repository (`README`, `DEPLOYMENT`).

### M-03 la soluzione non è nei telefoni — **Fatto**

**Causa.** `getSafeDisplayData()` azzerava `correctAnswer`, ma nella Musica la
soluzione non è quel campo: titolo, artista, anno, copertina e `previewUrl`
(anche dentro `songs[]` e nella banca grezza `rawPayload`) partivano verso i
telefoni con lo stato del round. Chi apriva gli strumenti del browser
riconosceva il brano senza ascoltarlo.

**Intervento.** Un solo filtro, `phoneSafeState()`, ripulisce lo stato, gli
eventi di fase (`MUSIC_PHASE`) e la banca grezza prima della trasmissione; la
scene della TV continuano a leggere lo stato del componente, quindi non
perdono né copertina né clip.

**Test.** `game.component.spec.ts` → «non manda mai la soluzione della Musica ai
telefoni»: nessun campo vietato, `songs[]` vuoto di titoli, nessun
`/media/music/` nel JSON.

**Classifica rapida (trovato dal banco elenchi).** Con più di otto squadre il
tabellone mostrava solo le ultime otto righe: il template usava sempre
`windowPlayers()`, la finestra del reveal, e le varianti `dense` e `triple` non
entravano mai in gioco. A reveal finito ora mostra `allPlayers()`; il test del
componente verifica la finestra di otto durante il reveal e tutte le venti righe
alla fine. Nel layout compatto le righe erano anche schiacciate sotto il proprio
contenuto (`grid-auto-rows: 1fr` con `min-height: 0`) e a quattordici squadre si
accavallavano: la riga minima ora è quella del suo testo
(`grid-auto-rows: minmax(min-content, 1fr)`).

**Banco elenchi.** `e2e/liste-squadre.spec.ts` apre una partita vera con 4, 8,
10, 14 e 20 telefoni (backend vero, telefoni a gruppi di sei) e misura lobby e
classifica rapida a scena ferma, perché le animazioni in volo falsano i
rettangoli: una riga per squadra, nomi veri nella lobby, varianti `dense` oltre
dieci e `triple` oltre sedici, nessuna riga fuori dal riquadro, nessuna coppia di
righe sovrapposta. Le cinque taglie sono verdi in 12,6 minuti (venti squadre
3,9 minuti). Restano fuori due schermate: il riepilogo delle risposte si popola
solo dalle risposte accettate dal server e nel banco restava vuoto, e la
classifica dettagliata mostra una squadra alla volta, quindi non è un elenco.

### M-04 tempi per atto — **Fatto**

**Causa.** I tempi dei round erano sparsi: sei giochi in `game-timings.ts`, gli
altri dentro i propri mode come costanti private. Nessuno poteva sommare gli
atti, e il presentatore non aveva un numero da dare alla sala.

**Intervento.** Ogni gioco espone la propria durata accanto ai tempi che la
compongono (`QUIZ_ROUND_SECONDS`, `MUSIC_ROUND_SECONDS`, `AZZARDO_ROUND_SECONDS`,
`BIGLIE_ROUND_SECONDS`, …). `shared/models/round-durations.ts` li somma:
`roundSeconds(mode, squadre)`, `actSeconds(atto, squadre)`, `serataSeconds(squadre)`.
La Bomba è l'unica che dipende dalla sala (20 s per squadra, due volte nella
serata); il Black Jack resta fuori perché non è in scaletta.
`docs/TEMPI-SERATA.md` riporta la tabella e `round-durations.spec.ts` la
ricalcola dal codice: se un timer cambia e il documento no, il test fallisce.

**Numeri (solo tempo di gioco dei 40 round).** Atti con otto squadre: 12'00",
17'09", 17'11", 15'04", 19'26". Serata: 78'10" con 4 squadre, 80'50" con 8,
82'10" con 10, 84'50" con 14, 88'50" con 20. Classifiche, bonus e pause stanno
fuori e restano a carico della regia. I numeri sono cresciuti di 75" in tutto
rispetto alla prima stesura perché Quiz e Azzardo ora contano il respiro fra le
manche (N-12).

### N-12 respiro fra le manche — **Fatto per il Quiz**

**Causa.** Nel Quiz `scheduleAdvance()` chiamava `startManche()` tre secondi
dopo la soluzione: la domanda successiva compariva nello stesso istante in cui
partiva il cronometro, senza respiro, e la durata dichiarata del round (54 s)
non contava nessuna pausa.

**Intervento.** `TV_TIMING.mancheBreathMs = 4500`: fra due manche il Quiz apre
una fase di lettura (`isReading`) e la domanda successiva resta a schermo con il
cronometro fermo; la manche si apre sul server solo alla fine del respiro,
quindi chi risponde durante la lettura non prende punti. Nessun 3-2-1: la
sequenza scenica resta solo all'inizio del round. `QUIZ_ROUND_SECONDS` ora
include i due respiri (63 s) e `docs/TEMPI-SERATA.md` è stato ricalcolato.

**Test.** `quiz.mode.spec.ts` → «fra una manche e l'altra la domanda dopo è a
schermo con il timer fermo»: a metà respiro `isReading` è vero, il timer è pieno
e la manche non è annunciata al server; alla fine la manche parte e il cronometro
scende. `tv-timing.spec.ts` blinda la durata 4–5 s.

**Checkpoint durante il respiro.** Il checkpoint salvava la manche nuova come
`stage: 'play'` con il tempo pieno: un refresh nei 4,5 s di lettura riapriva
subito la manche, saltando il respiro. Ora salva `stage: 'reading'` con
`readingLeftMs`, e `restore()` richiama `startManche(index, tempoRimasto)`: la
manche si apre solo quando il respiro finisce. Test: «durante il respiro il
checkpoint dice reading con il tempo che resta» e «un refresh durante il respiro
riapre la manche solo a respiro finito» (nessun annuncio al server prima della
fine).

**Azzardo, stesso giro.** Anche lì il passaggio era automatico: finiti i 7 s di
reveal partiva la puntata della manche dopo, con il cronometro già a 30 s. Ora
c'è una fase `READ` di 5 s (`READ_SECONDS` da `TV_TIMING.mancheBreathMs`): la
domanda dopo è a schermo, le fiches non si possono mettere (`handlePartyEvent`
accetta solo in `BET`) e la TV dice «SI PUNTA FRA POCO», il telefono mostra la
stessa domanda. Il round passa da 2'33" a 2'48" e la tabella degli atti è
ricalcolata. Test in `azzardo.mode.spec.ts` → «dopo il reveal la domanda dopo è
a schermo con la puntata chiusa»: fase `READ`, domanda della manche 2, fiche
rifiutate, poi `BET` da 30 s. Anche `restore()` riconosce la fase di lettura.

**Gli altri giochi.** Indovina chi, Time Buzzer e Biglie hanno le manche
comandate dalla regia, quindi il presentatore ha già il tempo di leggere; la
Ruota ha un round unico. Con questo, N-12 è chiuso per tutti i giochi con
passaggio automatico fra le manche.

### N-14 barra del tempo del Quiz — **Fatto**

**Causa.** Il Quiz aveva un cronometro locale che partiva prima dell'annuncio al
server: la barra della TV poteva finire dopo la scadenza vera della manche,
mentre il server rifiutava già i voti. Il telefono non aveva la stessa scadenza
e i suoi tasti restavano vivi fino al reveal.

**Intervento.** `QuizMode` apre la manche prima e usa il `deadlineAt` che
restituisce `startQuizManche`; il tick è a 100 ms e calcola il tempo da
`serverNow()` (orologio corretto dallo scarto), non da un contatore locale. La
pausa sposta la scadenza del tempo passato in pausa. Il `deadlineAt` viaggia nel
`QUIZ_STATE`: il telefono disegna la sua barra Quiz e spegne i tasti sulla
stessa scadenza assoluta, con `serverNow()`, anche se il reveal non è ancora
arrivato. La barra va da 100 a 0 con tick a 100 ms; a zero i tasti sono spenti.

**Test.** `quiz.mode.spec.ts` → «la barra chiude alla scadenza del server, non
al timer locale [N-14]»: a 200 ms dalla scadenza la barra è aperta, a 200 ms dopo
è chiusa. `remote.component.spec.ts` → «barra e tasti Quiz seguono la scadenza
della manche del server»: a 200 ms prima barra > 0 e tasti vivi, a 200 ms dopo
barra 0 e tasti spenti. In pausa la barra si congela e la scadenza del round
si sposta del tempo fermo; alla ripresa i tasti non restano spenti. Test:
«in pausa la barra Quiz si ferma e alla ripresa non lascia i tasti spenti».
Verifiche: quiz 26/26, remote 143/143, TV 148/148, build frontend verde.
**Da fare in sala:** TV + telefoni reali, manche Quiz, scarto d'orologio e pausa.

### N-13 classifica dopo il bonus e primo round — **Fatto**

**Causa.** `continueAfterRound()` dà la precedenza al bonus dello slot e torna
senza valutare `shouldShowLeaderboard()`. Alla chiusura, `finishBonus()` chiamava
`startAutoAdvance()`: la coda del round non ripartiva e la classifica rapida del
round 4 (e la dettagliata dell'8) non veniva mai mostrata. Il sintomo dipendeva
dal seme dei bonus: capitava solo quando lo slot cadeva sul round 4.

**Intervento.** Chiuso il riepilogo del bonus, si torna a `continueAfterRound()`:
il bonus appena pagato è già in `bonusClosed`, quindi la coda non lo riapre e
valuta la classifica; se il round non è uno slot, parte il conto alla rovescia
come prima. La correzione vale anche per la dettagliata di fine atto.

**Test.** `game.component.spec.ts` → «chiuso un bonus, la classifica rapida del
round resta in coda [N-13]»: round 4, bonus chiuso, la rapida è a schermo e la
scaletta resta sul 4. **Da fare in sala:** TV + 3 telefoni, bonus nel round 4 e
verifica della rapida; il banco Playwright con backend reale qui non gira (manca
Java).

**Primo round.** `startNewRoundNow()` apriva il round appena arrivava il
comando, anche con i telefoni ancora in ingresso: chi entrava dopo perdeva
l'annuncio e la prima domanda. Ora, solo al round 1 e solo con almeno una
presenza, la TV aspetta che il conteggio dei telefoni collegati resti fermo per
1,2 s (tetto 4 s) prima di uscire dalla lobby. La simulazione `?sim=1` salta
l'attesa; i tempi delle manche restano quelli del server (N-14 per il Quiz).

**Test primo round.** `game.component.spec.ts` → «N-13: il primo round aspetta
che le presenze si stabilizzino» e «senza telefoni il primo round non aspetta».
Verifiche: TV 150/150, build frontend verde. **Da fare in sala:** aprire il
primo round mentre un ultimo telefono sta entrando.

### N-15 classifiche — **Fatto (flash, storico, film, statistiche)**

**Causa.** La classifica rapida entrava a 300 ms per riga, senza stacco prima
del podio: con dodici squadre era finita in circa dieci secondi e il podio non
si sentiva arrivare.

**Intervento (punto 1).** Le righe normali ora respirano 450 ms; prima del terzo
posto c'è un sospiro di 1,6 s con il timbro «E ORA IL PODIO», poi il podio si
prende 1,3 / 1,5 / 2 s. La flash chiude intorno ai 15 s (tetto), con almeno 4 s
di tabellone fermo. Oltre dieci squadre: durante il reveal resta la finestra
delle ultime otto, alla fine il tabellone compatto usa due colonne fino a 16
squadre e tre colonne oltre. Niente pagine: con 14 e 20 squadre la finestra più
il tabellone denso mostra tutte le righe senza tagliarle.

**Test.** `leaderboard-quick.component.spec.ts` → sospiro prima del podio,
finestra da otto con 14/20, tabellone finale a 14 righe in due colonne (tre con
20). Verifiche: quick 9/9, remote 143/143, build frontend verde. **Da fare in
sala:** round 4 con 14 e 20 telefoni.

**Storico server.** La TV ora manda i punti del round prima di azzerarli:
`PUT /games/{id}/round-scores/{roundIndex}` con `{type, entries:
[{playerName, points, totalPoints}]}`. La stessa chiave sostituisce la riga,
quindi un retry non somma due volte; la lettura è
`GET /games/{id}/round-scores`, e lo stesso elenco arriva nello snapshot
`/sync` come `roundScores`. Lo storico è diviso in blocchi da quattro round
(chiavi `round-scores-<chunk>`) per non superare il limite `TEXT` di MySQL
con molte squadre; il vecchio blob unico resta leggibile. Restano salvati tipo di gioco, punti del round,
totale dopo il round e istante di salvataggio: bastano per miglior/peggior
round, rimonta e gioco più forte/debole. `RoundScoreServiceTest` copre
sostituzione, ordine e reset; `RoundScoreEndpointTest` copre il contratto HTTP
(PUT, GET, retry idempotente, 401 senza sessione e 400 sull'indice). Eseguiti
con JDK 25 Temurin locale: 3/3 e 2/2. Suite backend completa: 235/235 (da
copia locale del repo, perché il test della whitelist WebSocket cerca
`../frontend` rispetto alla cwd).

**Classifica «da film».** La dettagliata riceve ora lo storico dal server
(`GET /games/{id}/round-scores`), con le righe scritte localmente in coda come
copertura se il PUT non è ancora tornato. Per ogni squadra mostra miglior e
peggior round con punti, rimonta in posizioni, gioco più forte e più debole
(aggregati per tipo). Prima del podio compare il cartello «TRA POCO»; lo
storico resta la fonte dei numeri, la TV non li ricalcola dal vivo.
`leaderboard-film.spec.ts` copre calcolo, formattazione e dati mancanti;
`leaderboard-detailed.component.spec.ts` copre resa e preavviso. Verifiche:
film 5/5, dettagliata 8/8, TV 152/152, build frontend verde. Il test
Playwright `e2e/classifica-film.spec.ts` monta la TV a 1280×720, 1366×768 e
1366×768 a zoom 125% (viewport CSS efficace 1093×614) con 14 e 20 squadre.
Lascia scorrere il reveal e misura tutti e tre i preannunci naturali — prima
del terzo, del secondo e del vincitore — poi si ferma su ultimo/terzo/primo
posto. Controlla che statistiche e timbro restino dentro la copertina, senza
sovrapposizioni e senza testo tagliato: 6/6. Il caso zoom ha trovato un
overflow reale della copertina del vincitore, corretto con una media query per
schermi bassi. Timbro, podio e vincitore hanno anche baseline screenshot
stabili (`e2e/__screenshots__`) per 1366×768 e zoom, 14 e 20 squadre: 12
immagini. È incluso nel job CI `reproducibility` insieme agli altri banchi
Playwright. **Da fare in sala:** guardare il reveal con 14 e 20 squadre, non
solo il fotogramma congelato del test.

**N-15 chiuso:** pagina statistiche in regia e colpi di scena dal 5° posto
sono in `0b5a8088`; selfie/poster restano in N-33.

### N-16 riepilogo Quiz — **Fatto**

Il riepilogo comune (N-11) mostra i punti effettivamente vinti/persi nel round
per squadra, non risposta per risposta. In TV il pannello «RISPOSTE ESATTE»
filtra le sole risposte corrette: le errate non vanno più in onda e l'elenco
resta leggibile con più di cinque squadre.

### Bonus Sette e Mezzo al posto del Blackjack — **Fatto**

Lo slot bonus dell'atto 2 non è più il Blackjack: `BONUS_TYPES` e
`BONUS_AFTER_ACT` usano `SETTE_E_MEZZO`, la regia mostra «BONUS SETTE E MEZZO»,
la TV usa il nuovo `SetteEMezzoBonus` e il telefono ha il caso
`SETTE_E_MEZZO` con CARTA/STAI. La mano è 1v1: un tavolo alla volta, dal fondo
della classifica, contro il banco che pesca fino a 7,25 e vince i pareggi; il
Re di denari è la matta. Il bonus non assegna punti: premio del bar, sconfitte
e pareggi a zero. Ingresso scenografico, manuale, punteggi, demo, anteprima e
checkpoint di ripresa sono allineati.

**Blackjack.** Il gioco (`features/games/blackjack`, `GameType.BLACKJACK`) e il
vecchio `BlackjackBonus` restano in codice, con i loro test, ma non sono più
raggiungibili dalla scaletta, dalla regia, dai telefoni o dall'anteprima. I
canali `BLACKJACK_STATE`/`BLACKJACK_ACTION` e il blob `blackjack-hand` sono
riusati internamente dal Sette e Mezzo per non cambiare il protocollo dei
telefoni.

**Nota.** `SPEC-SETTE-E-MEZZO-BONUS.md` non è presente nel repository: la
sostituzione è stata fatta sulla specifica implicita del vecchio bonus 1v1 e
sulle regole `sette-e-mezzo-rules.ts` già testate.

**Test.** `sette-e-mezzo-rules.spec.ts` (14), `sette-e-mezzo-game.spec.ts`
(8), nuovo `sette-e-mezzo-bonus.component.spec.ts` (ripresa, STAND da
telefono, esito salvato), `game.component.spec.ts` e `remote.component.spec.ts`
aggiornati. `ng build` verde.

### N-10 ingressi a scatti — **Misurato, correzioni da fare**

**Banco.** `e2e/ingressi.spec.ts`: un gioco per caricamento, non un giro di
scaletta. Il round manager viene portato sull'indice di quel gioco
(`roundManager.restoreRound`), il primo AVANTI apre la scena e si misura per
6,5 s l'ingresso con TV a **1280×720, CPU 4×** e tre telefoni veri. Si sommano i
`layout-shift` e si contano i `longtask`, **registrando anche i nodi** che si
spostano (`entry.sources`). Il progresso seminato in `localStorage` non basta:
la TV lo riallinea allo stato del server, che su una partita nuova è il round 0.

**Tabella (prima delle correzioni).**

| Gioco | CLS | shift | long task | task più lungo | nodi che si spostano |
| --- | --- | --- | --- | --- | --- |
| Quiz | 0,038 | 25 | 9 | 266 ms | `div.slot-row.chosen` (0,035 ×37), `div.lobby-steps` |
| Ruota della fortuna | 0,001 | 0 | 6 | 132 ms | `div.conn-shell` (0,001) |
| Time Buzzer | 0,001 | 0 | 11 | 490 ms | `div.conn-shell` (0,001) |
| Indovina chi | 0,031 | 1 | 25 | 337 ms | `div.clue-card`, `h1.blur-title`, `div.blur-main-container.portrait` (0,03) |
| Timeline | 0,032 | 22 | 24 | **1480 ms** | `div.slot-row.chosen` (0,032 ×28) |
| Speed Rush | 0,001 | 0 | 17 | 463 ms | `div.conn-shell` (0,001) |
| Ultima spiaggia | 0,044 | 28 | 10 | 679 ms | `div.slot-row.chosen` (0,044 ×39), `div.conn-shell` (0,005) |
| Azzardo | 0,004 | 1 | 15 | 165 ms | `div.lobby-steps` (0,003), `div.conn-shell` |
| Biglie | 0,011 | 1 | 14 | 264 ms | `div.bg-card` (0,01), `div.conn-shell` |
| Bomba | 0,001 | 0 | 13 | 342 ms | `div.conn-shell` (0,001) |

**Cosa dicono i numeri.** Il criterio di N-10 è zero shift e nessun task oltre
50 ms: **nessun gioco lo rispetta**. Gli shift veri sono tre famiglie:

1. **Il rullo delle categorie che si allarga** (`div.slot-row.chosen`): è il
   nodo dominante di Quiz (0,035, 37 spostamenti), Timeline (0,032, 28) e
   Ultima spiaggia (0,044, 39). Non è la lobby: è la scatola del rullo, che
   aveva solo `min-width` e cresceva a misura del nome, mentre il nome cambia
   ogni 90 ms; il rullo, centrato, si spostava a ogni tick. **Corretto** con una
   scatola fissa (larghezza 560 px, altezza di due righe riservate): il nastro
   gira dentro un riquadro che non cambia mai misura.
2. **Foto e card che si assestano** (Indovina chi: `clue-card`, `blur-title`,
   `blur-main-container`, un solo shift da 0,034; Biglie: `bg-card`, 0,010).
   Indovina chi: la cornice seguiva la foto (`width/height: auto`), quindi al
   caricamento dell'immagine la colonna centrata cresceva di colpo e titolo,
   foto e indizio saltavano insieme. **Corretto** in due passate: prima con un
   riquadro a misura fissa (760×46vh), che però a 720p lasciava 270 px di nero
   per lato su una foto verticale (foto 219×302 dentro 760×302, verificato con
   uno scatto). Poi, siccome il nero era troppo, **le misure arrivano dai dati
   del round**: il backend porta `imageWidth`/`imageHeight` nel payload (le dà
   Wikipedia insieme alla foto) e la TV lega `aspect-ratio`, così la cornice
   nasce già 204×302 e la foto la riempie. Senza misure resta il 4/3.
   Biglie: la card si allargava passando dall'intro alla griglia delle biglie.
   **Corretto** con un'altezza minima riservata (`clamp(420px, 64vh, 600px)`).
3. **`div.conn-shell`** (0,001 in tutti): lo shell di connessione che cambia
   altezza quando arriva lo stato del round.

Sui long task non c'è un gioco pulito: il peggiore è **Timeline a 1480 ms** (un
frame e mezzo di attesa), poi Ultima spiaggia 679, Time Buzzer 490, Speed Rush
463, Bomba 342, Indovina chi 337.

**Tabella (dopo la correzione del rullo).** Rimisurati gli stessi tre giochi con
lo stesso banco (`N10_GAMES=QUIZ,TIMELINE,ULTIMA_SPIAGGIA`), CPU 4×, 1280×720:

| Gioco | CLS prima | CLS dopo | shift prima | shift dopo | nodi rimasti |
| --- | --- | --- | --- | --- | --- |
| Quiz | 0,038 | **0,002** | 25 | 1 | `div.lobby-steps` (0,001), `div.conn-shell` (0,001) |
| Timeline | 0,032 | **0,001** | 22 | 0 | `div.conn-shell` (0,001) |
| Ultima spiaggia | 0,044 | **0,000** | 28 | 0 | nessuno |

Il rullo non compare più fra i nodi in nessuno dei tre. Restano i long task
(Quiz 615, Timeline 557, Ultima 330 ms) e il `div.conn-shell` da 0,001, che sono
le altre due famiglie, non ancora toccate.

**Guardia.** `N-10: rullo categorie › il rullo non sposta la scena` apre il Quiz
con tre telefoni, aspetta che il nastro parta, conta i nomi diversi visti (11 in
5,5 s: senza questo il test potrebbe passare su un rullo mai partito) e
pretende zero shift da `slot-row` e CLS < 0,005.

**Tabella (dopo foto e card).** Stesso banco, stessi due giochi a 1280×720 e
CPU 4×:

| Gioco | CLS prima | CLS dopo | shift prima | shift dopo | nodi rimasti |
| --- | --- | --- | --- | --- | --- |
| Indovina chi | 0,031 | **0,001** | 1 | 0 | `div.conn-shell` (0,001) |
| Biglie | 0,011 | **0,001** | 1 | 0 | `div.conn-shell` (0,001) |

Né `div.blur-main-container` né `div.bg-card` compaiono più fra i nodi, e la
cornice di Indovina chi ha ora la proporzione della foto (204×302 su una foto
330×488). Nelle prove
dei due guard, misurate separatamente, Indovina chi stava a 0,004 (lobby che si
smonta) e Biglie a 0,000; qui restano i 0,001 di `div.conn-shell` in entrambi.

**Da fare.** Resta `div.conn-shell` a misura fissa (0,001 su quasi tutti i giochi)
e i long task, che nessuna delle due correzioni tocca.

### N-10 terza famiglia: `div.conn-shell`

La badge di connessione era larga quanto il testo: passando da `TV` a
`Sincronizzo` (o mostrando il chip `SYNC`) l'angolo in alto a destra si spostava
a ogni cambio di stato — 0,001 in quasi tutti i giochi, due shift minimi da
0,0005. Ora `.conn-badge` ha misura fissa (168 px, contenuto centrato, `nowrap`),
così cambiare stato non cambia la scatola.

Guard: `N-10: foto e card › la badge di connessione non sposta la scena`
(Quiz, nessun nodo `conn-shell` fra i responsabili). **Aggiunto ma non ancora
eseguito** al momento del commit: va lanciato prima di considerare chiusa la
famiglia.

### N-10 quarta famiglia: la scena che si ri-centra (entrata, opzioni, riga del tempo)

**Causa 1 — l'entrata cancellava il centraggio.** `.question-area` sta in
`top: 50%` + `transform: translateY(-50%)`. `@keyframes stageIn` scriveva
`transform: translateY(26px) scale(...)` e finiva con `transform: none`: per
tutta l'entrata la domanda era disegnata mezzo pannello più in basso, e al
passaggio alla fase `title` (classe tolta) tornava al centro con uno scatto.
Era il «salto» che si vedeva su Quiz, Indovina chi, Ruota, Timeline, Ultima
spiaggia, Azzardo, Blackjack — tutti i giochi con la domanda, non un difetto di
un singolo tabellone. `stageOut` aveva lo stesso problema (l'uscita partiva dal
punto sbagliato). Ora le due animazioni usano `translate` e `scale`, proprietà
indipendenti che convivono con il `transform` di centraggio.

**Causa 2 — la fase `options` rientrava mezza scena.** La regola
`.stage-options-on .question-area > *` colpiva **tutti** i figli diretti:
categoria (ritardo 0), barra del tempo (300 ms) e l'intero componente del gioco
(600 ms). A ogni passaggio in `options` il timer spariva per 300 ms e la
domanda per 600 ms, poi rientravano sfalsate: la «domanda che si stringe e
riappare». Le opzioni vere hanno già la loro entrata accanto alla skin del
gioco (`quiz.component.css`); la fase `options` è un tempo di regia, non un
secondo ingresso della scena. La regola è stata tolta, con i suoi ritardi
e `stageOptionIn` (rimasto senza uso).

**Causa 3 — la riga del tempo spostava la domanda di 15 px.** Il wrapper della
barra era dentro `@if (… && timerVisible())` e `timerVisible()` è falso finché
la fase non è `live`: al via comparivano 29 px (14 di barra + 15 di margine) e
la domanda, centrata, saliva di 15 px; al reveal succedeva il contrario. Ora
la riga resta sempre nel layout e si spegne con `.is-idle`
(`visibility: hidden`), come il riquadro audio della Musica.

**Misura a 1280×720 (Chromium, DPR 1, scena reale iniettata sui signal).**
Quiz, top di `.question-area`: `entrance 119 · title 119 · reading 119 ·
options 119 · live 119 · reveal 119`, altezza 482 costante, `app-quiz` a
opacity 1 in tutte le fasi. Prima della correzione: 134 → 119 al via e
`app-quiz` a opacity 0 per 600 ms nella fase `options`.

**Test.** `apps/frontend/src/app/features/tv/stage-motion.spec.ts` (3 casi:
`stageIn`/`stageOut` senza `transform`, nessuna regola su
`stage-options-on … question-area > *`, riga del tempo con misura riservata).
Suite frontend 850 passati (2 casi di `version.spec` non eseguibili solo nel
checkout di verifica, perché mancavano `apps/backend` e `README.md`),
`ng build` verde.

### N-10 quinta famiglia: la scena Musica era ritagliata dentro la domanda

**Causa 1 — `position: fixed` dentro un antenato trasformato.** `app-song`
stava dentro `.question-area`, che ha `transform: translateY(-50%)` e
`overflow: hidden`. Un elemento `fixed` con un antenato trasformato si posiziona
su quell'antenato, non sulla finestra: la scena Musica finiva in un riquadro
**920×57** al centro, con tabellone, striscia delle fasi e riquadro audio
tagliati fuori. Misura a 1280×720 prima: header a 348, tabellone 493→805,
fasi 820→879, audio 886→944, contro un viewport di 720. Il banco E2E non lo
vedeva perché `toBeVisible()` guarda la scatola, non il ritaglio dell'antenato.
Ora la Musica è una scena a schermo intero, montata fuori da `.question-area`
(ramo dedicato nel template della TV): header 58, tabellone 203→516, fasi
530→589, audio 596→655, tutto dentro i 720 px.

**Causa 2 — il riquadro «BRANO IN ASCOLTO» spostava il tabellone.** Era dentro
`@if (isPlaying())`: comparire e sparire aggiungeva e toglieva ~90 px sotto il
disco e, con `.song-container` centrato in verticale, il tabellone saltava su e
giù due volte per manca, cinque manche per round. Ora il riquadro resta sempre
nel layout (`visibility: hidden` a brano fermo, `.playing` per mostrarlo) e il
cursore si anima solo mentre suona. Misura: tabellone fermo a 203 sia a brano
fermo sia in ascolto.

**Causa 3 — il reveal scalava tutto lo schermo.** Il velo a schermo intero
entrava con `scale(0.5)`: si stringeva il fondo, non la card. Ora il velo fa
solo dissolvenza e si muove la card (`m-pop`). La copertina sfocata passa da 26
a 14 px e a 0 in 220 ms, non in due secondi di filtro su un disco che gira.

**Test.** `song.component.spec.ts` → «il riquadro audio riserva la sua misura
anche a brano fermo» e «il riquadro audio resta nel layout anche a brano
fermo». Verifica visiva e misurata a 1280×720 su Chromium (scena reale iniettata
sui signal, non un mock statico).

**Resta aperto in N-10b:** i long task d'ingresso (Quiz 615 ms, Timeline 557 ms
misurati a CPU 4×) e il componente unico `FeedbackCard` per
esito corretto/sbagliato: oggi ogni gioco disegna la propria card.

### N-10 sesta famiglia: il disco di Musica non era su un layer composito

**Misura pulita (host stabile).** `N10_GAMES=MUSIC`: `cls=0 shift=0 long=6
max=347ms frame=383ms/23`. Il criterio di N-10 ha due metà: il layout shift è
zero (rispettata in tutte le misure), il budget dei frame **non** lo è: 23 frame
oltre 50 ms in 6,5 s, non solo il primo paint.

**Causa.** `.vinyl-disc.spinning` ruota con `box-shadow`, bordo e solchi dentro
`overflow: hidden`; senza un layer composito il browser ridisegna il cerchio a
ogni frame. A CPU 4× ogni ridisegno supera i 50 ms. `decoding="async"` sulle
copertine toglie la decodifica sincrona dell'immagine, ma non il repaint del
disco.

**Correzione.** `.vinyl-disc` ha `will-change: transform` e
`transform: translateZ(0)`: il layer si crea al primo paint, la rotazione la fa
il compositor e ombre/solchi non si ridisegnano. Le due copertine hanno
`decoding="async"`.

**Misura dopo la correzione — non affidabile su questo host.** Le misure a 4×
hanno prodotto stalli del host, non dell'ingresso: `generate-ai-round` da 3051 ms,
long task da 2211 ms a 20 s, `frame=4433ms/36`, con la finestra di misura ferma a
6,5 s. I long task da 9 a 20 s sono la macchina che si ferma (la finestra è
6,5 s), non la scena. Il banco resta **non chiuso**: il numero pulito da battere
è 273 ms / 16 frame (prima della correzione), da rimisurare su una macchina
scarica o in CI. Non si dichiara chiuso un criterio che non è stato misurato.

**Cosa resta fuori dall'ingresso.** `generate-ai-round` (payload del round) e il
caricamento delle clip `atto-*.m4a`/`gioco-*.m4a` avvengono prima che la scena
sia visibile; i long task da payload/rete non sono frame dell'ingresso.

**N-10 chiuso sul layout; N-10b aperto.** Il layout shift è 0 in tutte le misure:
la metà «niente scatti di layout» è chiusa. Resta il budget frame **N-10b**
(100 ms/1 in isolamento, 433 ms/27 nel flusso reale sulla macchina carica).
L'asserzione dura `expect(metrics.framesOver50).toBe(0)` resta in
`e2e/ingressi.spec.ts` per N-10b: il banco è rosso finché il budget non scende,
non si chiude togliendo il controllo.

**Isolamento (round finto, senza audio né payload).** `N-10 MUSIC isolata`, tre
misure: `cls=0 long=0 frame=67ms/2`, `cls=0 long=1 max=168ms frame=167ms/2`
(long task a t=61 ms, il primo render) e, dopo `contain: layout paint` sulla
scena, `cls=0 long=0 frame=100ms/1`. La scena da sola non ha rete; resta **un
frame sopra 50 ms** e il primo render è il costo: il budget non è chiuso
nemmeno in isolamento, ma non viene dal payload. Senza ledger, striscia fasi e
riquadro audio la scena sta in **50 ms/0**: il costo è tutto in quelle tre
parti.

**Tentativo di split.** `content-visibility` a stadi su ledger/fasi/audio con
misura intrinseca a 720p: `cls=0,004` (uno shift) e `frame=233ms/7`, quindi
peggio del render unico. Tolto: le parti non critiche non si possono rimandare
senza una misura riservata esatta, e il loro layout costa comunque. Resta
`contain: layout paint` sul contenitore, che ha portato l'isolamento da 117 a
100 ms.

**Flusso reale, stesso host.** `N-10 MUSIC`: `cls=0 shift=0 long=5 max=367ms
frame=433ms/27`; `generate-ai-round` 218 ms, scena montata a ~6,3 s. L'host non
era scarico (load average 24,6 prima della misura): il numero è un limite
superiore, ma non ci sono gli stalli da 20 s delle misure precedenti. I 25
frame in più rispetto all'isolamento arrivano dal payload/audio reali
(copertina sfocata e grafo audio), non dal disco: il `will-change` ha tolto il
repaint continuo. **Budget aperto:** per chiuderlo resta da togliere il costo
della copertina sfocata (pre-blur fuori dal paint) e dell'audio al primo
mount.

**Rimisura reale dopo `contain`.** Invalida: `generate-ai-round` 29,5 s, long
task 6941 ms a 66 s, heartbeat da 2,5 s. È il host/backend che si ferma, non la
scena; l'ultima misura valida resta 433 ms/27.

### N-11 riepilogo di fine round condiviso — **Fatto (misurato a 1280×720)**

**Causa.** Chiuso un round, la TV passava subito al bonus, alla classifica di
fine atto o all'attesa di trenta secondi: i punti fatti e persi in quel round
non si vedevano mai. Il riepilogo era previsto per ogni gioco ma nessuno lo
disegnava, e i giochi che pagano a manche (Musica, Indovina chi, Biglie,
Arena) chiudevano senza una pagina che dicesse chi era salito e chi era
sceso.

**Intervento.** Un solo componente `RoundRecap`
(`tv/round-recap/`), aperto da `checkLeaderboardDisplay()` per tutti i giochi:

- **Cosa conta:** il delta fra i totali all'apertura del round (fotografia in
  `beginRoundScoring`) e i totali alla chiusura. Non il totale di serata e non
  i punti del vincitore: chi entra a metà o incassa un bonus fra due round
  resta fuori dai conti.
- **Ordine:** dal peggiore al migliore, pari merito sullo stesso delta rotto
  dal totale più basso. L'ultima pagina è il podio (oro, argento, bronzo).
- **Pagine:** una sola fino a dieci squadre; oltre, righe da sette. Ognuna
  resta ferma tre secondi con dissolvenza (`recap-page-in`, solo opacità).
- **Durate:** minimo 8 s, più 3 s per ogni pagina oltre la prima
  (`TV_TIMING.recapPageMs` / `recapMinMs`): 4–20 squadre stanno fra 8 e 9 s.
- **Ripartenza:** il riepilogo non chiude il round da solo. Solo al suo
  `onComplete` la regia prosegue con la coda di sempre — bonus, classifica
  d'atto, altrimenti attesa di 30 s (F-12). I trenta secondi quindi partono
  dopo il riepilogo, mai durante. Con il foglio in scena AVANTI lo chiude e
  imbocca la stessa coda: saltare direttamente al gioco dopo si mangerebbe il
  bonus programmato per quel giro.
- **Refresh:** la base dei totali viaggia con `ROUND_POINTS_KEY` (campo
  `start`), così un refresh a metà round non gonfia i delta. Se la base non
  c'è (salvataggio vecchio) il riepilogo si salta invece di mostrare numeri
  falsi. `reset()`, AVANTI e pausa lo chiudono: non resta mai appeso.
- **Quando non c'è:** meno di due squadre o nessuna variazione di punti. Il
  tabellone a 14 giochi (riepilogo sì/no, durata, quando riparte) sta in testa
  a `round-recap-model.ts`.
- **Pausa (ESC):** il riepilogo ha un orologio suo, con tempi rimasti invece di
  un intervallo: la pausa congela pagina e chiusura, la ripresa riparte dal
  millisecondo in cui si era fermata. Sul riepilogo la modalità del round non
  si tocca (è già chiusa: `resume()` farebbe ripartire il suo timer), e la
  testata mostra il timbro **PAUSA**; fuori dal riepilogo ESC resta il «salta
  attesa» di F-12.

**Test.** `round-recap-model.spec.ts` (8 casi: ordine, pari merito, pagine a
4/8/10/14/20 squadre, durate, giochi esclusi), `round-recap.component.spec.ts`
(8 casi: pagina unica, pagine da sette con podio in fondo, chiusura una volta
sola, pausa e ripresa a metà scena e sull'ultima pagina, timbro PAUSA, delta
firmati, variante poche righe), `game.component.spec.ts` (6 casi: il riepilogo si apre con i delta e
l'attesa resta a zero; chiuso il riepilogo partono i 30 s; AVANTI con il foglio
in scena lo chiude e passa dalla coda senza aprire il gioco dopo; ESC mette in
pausa senza saltare il round e senza toccare la modalità; fuori dal riepilogo
resta il salto; dock sopra il riepilogo e fascia della testata). 163 test verdi
sui tre file, `ng build` verde (restano gli avvisi di budget CSS e i due moduli
CommonJS già presenti). Il banco reso `e2e/riepilogo.spec.ts` misura la matrice
4/8/10/14/20 a 1280×720 con la dock a schermo (righe, ombre, testata, nessuno
scroll), la pausa ESC con tempo congelato e il ritorno allo stesso secondo, e
l'AVANTI che chiude il foglio passando dalla coda del round. Controlla anche la
variante poche righe: a quattro squadre le righe riempiono il foglio (121,3 px),
con due o tre si fermano al tetto di 17vh (122,4 px) e con cinque stanno a 95,6;
da otto in su la misura resta quella di sempre. A 1920×1080 controlla il foglio
da 1680 px e le righe 183,6 / 151,4 / 90,9 / 70,7 / 96, senza scroll. A 1100 e
1366 controlla che il foglio resti 92vw sotto i 1280 (1012) e cresca sopra
(1195,3). A 4K a 200% il CSS è 1920×1080: è il caso 1080, già coperto dal banco;
a 3840 CSS il formato non è supportato.

**Misura a 1280×720 (Chromium, DPR 1, banco con 4/8/10/14/20 squadre).** Il
foglio sta in 1120×640.7 (80→1200), testata 62→127, piede a 680.4, nessuno
scroll di pagina (1280×720). Righe: 4 squadre 66.2 px (255→542, prima della
variante poche righe), 8 squadre
60.1 px (133→664), 10 squadre 46.7 px (133→664), 14 e 20 squadre 66.2 px a
pagina (145→652). Ombre tutte dentro: bordo destro delle righe 1192, ombra
normale 1196, ombra del podio 1200 (la regola di testata), ultima ombra a 672
contro il piede a 680.4. Nessuna riga sotto i 30 px, nessun nome tagliato.

**Misura nella scena TV vera** (`/tv?debug=1`, stato iniettato sui signal, dock
della regia a schermo e pausa attiva). La dock va da 920.9→1264 e 16→80 con
z-index 13000: con il riepilogo a 19000 il click su pausa finiva su
`section.recap`, non sul pulsante. Ora la dock prende `above-recap` (z 19500),
`elementFromPoint` sul pulsante pausa restituisce `button.dock-btn`, un click
vero del mouse mette la sala in pausa e un secondo click la riprende. La testata
scende a 86.4→151.4 (dock sotto 80) e il foglio a 86.4→702.7: nessuna
sovrapposizione. I nomi sono a filo e il timbro PAUSA lascia il contatore a
destra. Matrice a 1280×720 (DPR 1, 4/8/10/14/20 squadre), ombre comprese:

| Squadre | Pagine | Righe | Altezza | Prima riga | Ultima riga | Ombra destra | Ultima ombra | Piede |
| --: | --: | --: | --: | --: | --: | --: | --: | --: |
| 4 | 1 | 4 | 121.3 | 157.4 | 664.3 | 1200 | 668.3 | 680.4 |
| 8 | 1 | 8 | 57.1 | 157.4 | 664.3 | 1196 | 672.3 | 680.4 |
| 10 | 1 | 10 | 44.2 | 157.4 | 664.3 | 1196 | 672.3 | 680.4 |
| 14 | 2 | 7 | 66.2 | 157.5 | 664.3 | 1196 | 668.3 | 680.4 |
| 20 | 3 | 7 | 66.2 | 157.5 | 664.3 | 1196 | 668.3 | 680.4 |
| 20, podio | 3 | 6 | 66.2 | 194.2 | 627.5 | 1200 | 635.5 | 680.4 |

La riga da quattro è la variante poche righe: le righe prendono lo spazio del
foglio e il testo sale di un gradino. Con due o tre squadre le righe si fermano
al tetto di 17vh (122,4 px a 720p) invece di crescere a 249,9 e 164,2; con
cinque righe stanno a 95,6. L'ombra del podio (1200) può cadere su una riga
qualsiasi, non solo sull'ultima. Nessuna ombra oltre il foglio, sotto il
piede o fuori dallo schermo (le righe normali si fermano a 1196, il podio a
1200); nessuna riga sotto i 30 px, nessun nome tagliato, nessuno scroll di
pagina (1280×720).

**Misura a 1920×1080.** A 1080p il foglio restava 1120 px (400 px di margine per
lato) mentre le righe crescevano in `vh`: la scena sembrava una colonna stretta.
Ora il foglio prende `clamp(1120px, 87.5vw, 1680px)` con `max-width: 92vw`:
1680 su 1920 (120 px per lato), 1120 su 1280, 92vw sotto i 1280 (a 1100 →
1012, come prima). Testata 104→192,
piede a 1029.1, dock 16→80, nessuno scroll (1920×1080). Matrice a 1920×1080
(DPR 1, dock e pausa):

| Squadre | Righe | Altezza | Prima riga | Ultima riga | Ombra destra | Ultima ombra | Piede |
| --: | --: | --: | --: | --: | --: | --: | --: |
| 2 | 2 | 183.6 | 414.9 | 792.1 | 1800 | 797.1 | 1029.1 |
| 3 | 3 | 183.6 | 318.1 | 888.9 | 1800 | 893.9 | 1029.1 |
| 4 | 4 | 183.6 | 221.3 | 985.7 | 1800 | 990.7 | 1029.1 |
| 5 | 5 | 151.4 | 204.9 | 1002.1 | 1800 | 1007.1 | 1029.1 |
| 8 | 8 | 90.9 | 204.9 | 1002.1 | 1800 | 1007.1 | 1029.1 |
| 10 | 10 | 70.7 | 204.9 | 1002.1 | 1800 | 1007.1 | 1029.1 |
| 14 | 7 | 96 | 237.5 | 969.5 | 1797 | 974.5 | 1029.1 |
| 20 | 7 | 96 | 237.5 | 969.5 | 1797 | 974.5 | 1029.1 |

Con due o tre squadre il tetto di 17vh vale 183,6 px e il blocco resta centrato
(carta sopra e sotto); a quattro il tetto lascia 16 px di margine (le righe
sarebbero 191,8), a cinque scendono a 151,4, a otto a 90,9, a dieci a 70,7, a
quattordici e venti restano 96. Ombre tutte dentro: 1797 normali, 1800 il podio,
contro il bordo del foglio a 1800; ultima ombra al massimo 1007,1 contro il piede
a 1029,1. Nessun nome tagliato.

**Sotto i 1280.** La prima stesura usava `min(87.5vw, 1680px)` e stringeva anche
i pannelli più piccoli: a 1100 il foglio scendeva a 962,5 invece dei 1012 di
prima. Ora il minimo è 1120 con `max-width: 92vw`: a 1100 il foglio è 1012, a
1366 1195,3, a 1280 1120, a 1920 1680. Il banco misura 1100×768 e 1366×768 con
4 e 10 squadre: righe 130,1 e 47,4, ombre dentro, nessun nome tagliato, nessuno
scroll. A 1024 il `/tv` non si apre: il guard desktop manda su `/play` (≤1024 è
mobile), quindi il caso più stretto misurabile è 1025; il banco usa 1100.

**Scelta: 200%.** A 3840 CSS il riepilogo sarebbe 2× contro una dock e un resto
della TV a 1×: non è una scala coerente. A 4K il TV va portato al 200% (zoom
del browser o scaling di sistema): il CSS torna 1920×1080 e tutto il layout
1080 — riepilogo, dock, giochi — scala insieme. Il foglio è 1680 CSS = 3360
device px (87,5%), righe 183,6/70,7 e dock 128 device. 720/1080 restano quelli
di sempre. Se il TV resta a 3840 CSS, il riepilogo è 1680 (43,75%) e tutto è a
1×: non è un formato supportato; servirebbe un refactor globale delle unità
(vh/px), non un tetto.

**ESC, pausa e ripresa** (tastiera vera, otto secondi di pausa per caso). Il
tempo fermo non scende, la pagina non cambia e la scena resta aperta; alla
ripresa l'orologio riparte dai millisecondi rimasti, non da capo:

| Squadre | Alla pausa | Dopo 8 s | Alla ripresa | Dopo 1 s | Pagina |
| --: | --: | --: | --: | --: | --: |
| 4 | 7127 | 7127 | 7002 | 5989 | 1, chiusa a fine tempo |
| 8 | 7221 | 7221 | 7099 | 6085 | 1, chiusa a fine tempo |
| 10 | 7252 | 7252 | 7142 | 6119 | 1, chiusa a fine tempo |
| 14 | 7246 (pagina 2128) | 7246 | 7129 | 6112 | 0 → 1 dopo 2.1 s |
| 20 | 8251 (pagina 2135) | 8251 | 8108 | 7093 | 0 → 1 dopo 2.1 s |

Con quattordici e venti squadre il timer di pagina riparte dai 2128/2135 ms
rimasti, quindi la pagina avanza dopo 2.1 s e non dopo 3; il totale resta
7246/8251 e il podio (2/2 e 3/3) chiude a fine tempo, anche dopo una pausa
sull'ultima pagina. Con una pagina sola la scena si chiude dopo il residuo
esatto. Il secondo perso alla ripresa è quello del comando (~120 ms), poi
l'orologio scala un secondo pieno (1013–1023 ms).

**Corretto dopo le misure.** La testata metteva kicker e titolo ai due estremi
e il contatore pagine spostava il titolo al centro: ora kicker e titolo sono
una colonna sola (`recap-titles`) e il contatore è l'unico altro figlio. Le
ombre erano tagliate dal `overflow: hidden` del contenitore (4 px sul bordo
destro, 8 px sull'ultima riga): il contenitore non ritaglia più, riserva 8 px
a destra e la fascia sotto, e con poche righe il foglio si riempie: a 720p la
pagina da quattro passa da 66,2 a 121,3 px per riga (il tetto di 9,2vh la
fermava a metà foglio; da otto in su la misura resta quella di sempre). Con due
o tre squadre il tetto di 17vh ferma le righe a 122,4 px, perché senza
crescerebbero a 249,9 e 164,2. A 1080p il foglio restava 1120 px su 1920: ora
`clamp(1120px, 87.5vw, 1680px)` con `max-width: 92vw` lo porta a 1680 (120 px
di margine per lato), mentre a 1280 resta 1120 e sotto i 1280 resta 92vw. A 4K si lavora al 200%
(CSS 1920): il foglio 1680 CSS = 3360 device e il layout 1080 scala tutto;
a 3840 CSS il formato non è supportato. La scena vera
ha aggiunto tre difetti che il banco isolato non poteva vedere: dock coperta
dallo z-index, testata sotto la dock (mancava la fascia) e nomi centrati dal
`text-align: center` legacy di `.game-container`.

**Non eseguito.** `npm run audit:design` (Impeccable) non parte su questo
computer: manca il binario verificato per windows-arm64 (`no checksum for
engine 0.1.31`). Resta da decidere in sala se 8 s per round siano sostenibili
su quaranta round.
