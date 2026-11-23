# Changelog

## 23 novembre 2026 — Pulizia totale e stress test in laboratorio, 2.3.1

Nessun cambio di regole, punteggi, banche, media o azioni WebSocket. La
versione resta **2.3.1**.

- **Rimosso (frontend):** due import rxjs mai usati in `reliability.service`, il
  metodo privato `wait` del Casino, il parametro `Body` di Matter e i parametri
  `trackWidth`/`now` di tre routine di disegno delle Biglie; undici
  `console.log` di debug su TV e telefono. Nessun `warn`/`error` toccato.
- **Rimosso (backend):** `ScreamDto`, DTO senza chiamanti.
- **Rimosso (repo):** la cartella `qa/` con 34 screenshot mai citati (3,2 MB);
  l'intestazione `[TEMPLATE]` da `.env.example`, che rompeva il parsing della
  prima riga di una copia in `.env`.
- **Strumenti:** `npm run stress:ws` (4–48 telefoni, latenza risposta → eco) e
  `npm run stress:restart` (stato a metà round prima/dopo un riavvio), in
  `scripts/stress/`. Usano un backend, una porta e un database separati.
- **Numeri:** 701 test frontend eseguiti + 2 saltati (manca ffmpeg), 168 test
  backend, `ng build` 7,2 s, bundle JS 1,52 MiB, audit banche e `npm audit` a
  zero. I dettagli, le prove di ogni rimozione e le voci «da decidere» sono in
  [`docs/PULIZIA-REPORT.md`](docs/PULIZIA-REPORT.md); le misure di carico, i
  difetti trovati e le prove da fare in sala in
  [`docs/STRESS-REPORT.md`](docs/STRESS-REPORT.md).

## 23 novembre 2026 — Strumenti e CI, 2.3.1

- **Versione:** 2.3.1 in `VERSION`, `package.json`, `package-lock.json`, pom del
  backend, README, presentazione, deploy, avvio e Docker.
- **Maven:** la scelta del JDK non guarda più solo se `bin/java` esiste: ogni
  candidato viene avviato con `-version` e si prende il primo che risponde, così
  un pacchetto per un'altra architettura in `.tools` non blocca più i comandi.
- **Test Quiz:** nuovo `QuizManchePointsTest` sui cinque mix di difficoltà e
  sulla somma a 1000 del round.
- **CI:** l'audit salta i controlli media quando la banca non è versionata; se i
  test backend falliscono il job stampa i report di surefire invece del solo
  `BUILD FAILURE`.
- Verifiche: suite backend 168/168 su clone pulito (Linux, JDK 25), test Quiz
  2/2, build frontend e audit verdi; CI #205 con i quattro job a successo.

## 23 novembre 2026 — Quiz e Bomba con le regole nuove, 2.3.0

- **Versione:** 2.3.0 in `VERSION`, `package.json`, `package-lock.json`, pom del
  backend, README, presentazione, deploy, script di avvio e Docker. La 2.2.0
  resta nella storia dei documenti che raccontano quelle serate.
- **Quiz:** ogni manche dura **20 secondi** (prima 15) e i 1000 punti del round
  si dividono per mix di difficoltà invece che col peso 1/2/3: tre diverse pagano
  **200 / 350 / 450**, due uguali più una lasciano **250** alle più facili e il
  resto alle altre (250/375/375 oppure 250/250/500), tre uguali **333 / 333 /
  334**. La tabella vive in un solo posto (`QuizService.manchePoints`) e la usano
  generatore del round e voto del server.
- **Bomba:** solo malus, a scalare per ordine di scoperta: **−500, −300, −150,
  −50**. La prima bomba fa uscire dal round e costa più delle successive; il
  malus non dipende più da quante bombe ha il tabellone.
- **Documenti:** manuale sera (entrambe le versioni), `PUNTEGGI-MASSIMI-MINIMI`,
  demo TV, README e schede `SCORING_RULES` allineati ai nuovi numeri.
- Verifiche: build frontend `EXIT=0`; suite frontend 702/703 (l'unico rosso è il
  controllo LUFS che si salta dove manca ffmpeg, come in CI); backend compilato
  (81 sorgenti) con `QuizServiceTest` 11/11, `BombaScoringTest` 3/3 e
  `QuizControllerTest` 1/1 verdi.

## 23 novembre 2026 — Ruota a 62 frasi, senza ripetizioni in serata

- **Ruota della fortuna:** `QuestionBankService.PROVERBS` passa da **32 a 62
  frasi**, tutte italiane e adatte a un pub, senza doppioni (l'audit confronta
  il testo normalizzato). Le 30 nuove vanno da «Chi non muore si rivede» a «Le
  disgrazie non vengono mai sole» e non includono nessuno dei dieci candidati
  scartati in revisione; così le due occorrenze a serata non ripetono la frase e
  la banca regge più serate di fila.
- **Niente ripetizioni nella stessa partita:** `pickRandomProverb` riceveva
  sempre il mazzo intero e ignorava la deduplica della serata; ora pesca solo
  fra i proverbi non ancora usati, con la stessa chiave che il controller
  prenota nel `QuestionHistoryService`. Se il mazzo si esaurisce riparte da
  capo invece di far fallire il round. Test: `WheelProverbTest`.
- **Documenti:** audit rigenerato, tabella di revisione aggiornata.
- **Grafica TV:** la skin della Ruota passa ai token carta/inchiostro — tessere
  di carta con bordo 3 px e ombra piena al pomodoro, lettere svelate in acido,
  titolo Anton con ombra piena, timbro mono «PROVERBI E MODI DI DIRE», timer
  nero con bordo carta. Spariti gradienti blu/viola, glow, radius e l'emoji nel
  titolo; rimosso il CSS legacy duplicato in `tv/game.component.css` (selettori
  del componente figlio, mai applicati) e le pulsazioni decorative.
- Verifiche: `node scripts/audit-banche.mjs --ci` → 0 doppioni, 0 segnalazioni,
  0 campi mancanti, 0 dubbi Bomba; `WheelProverbTest`; build frontend e 11 test
  Ruota; tabellone TV guardato a 1280×720 con la frase più lunga (3 righe
  misurate, nessun taglio).

## 23 novembre 2026 — Bomba senza dubbi, Timeline a 222 eventi

- **Bomba:** risolte le otto coppie segnalate dall'audit accorciando i nomi
  troppo lunghi («Francis Ford Coppola» → «Francis Coppola», «Leonardo da
  Vinci» → «Leonardo», «Tim Berners-Lee» → «Berners-Lee», «Giuseppe Tomasi di
  Lampedusa» → «Lampedusa») e portando la falsa a un solo dettaglio di distanza
  dove le due frasi non erano la stessa affermazione. Restano **110
  affermazioni** (62 vere, 48 false) e l'audit dà **0 dubbi**.
- **Timeline:** 211 → **222 eventi**, con **11 eventi di difficoltà 5** nuovi,
  uno per ciascuna categoria che ne era priva: Pace di Aquisgrana 1748, Perry
  1854, primo campionato italiano di calcio 1898, La corazzata Potëmkin 1925,
  Eurovision 1956, Requiem di Verdi 1874, Statuto di Roma 1998, Ferrari 1947,
  Barilla 1877, Capitan Harlock 1978, Doom 1993. Anni non usati da altri eventi
  e fonte Wikipedia per ognuno; ora tutte le 14 categorie hanno un evento
  difficile.
- **Documenti:** audit rigenerato, revisione aggiornata, README e roadmap
  allineati ai nuovi conteggi.
- Verifiche: `node scripts/audit-banche.mjs --ci` → 0 doppioni, 0 segnalazioni,
  0 campi mancanti, 0 buchi di Ultima spiaggia, 0 dubbi Bomba.

## 23 novembre 2026 — Banche: Bomba a 110 affermazioni, Musica con gli anni

- **Bomba:** 95 → **110 affermazioni** (62 vere, 48 false). Aggiunte le vere che
  mancavano alle quattro coppie segnalate (Torre Eiffel 1889, i ragni non sono
  insetti, il violino ha quattro corde, Titanic di Cameron) e sei affermazioni
  nuove per portare ogni categoria ad almeno nove righe; ogni riga ha la fonte.
- **Musica:** completato l'anno di «Boulevard of Broken Dreams» (2004) nella
  banca locale `media-it.json`, che non è tracciata da git.
- **Revisione:** le otto coppie in cui il nome cambiato ha tre o più parole sono
  state confrontate a mano e restano valide; l'elenco è in
  `docs/DOMANDE-DA-REVISIONARE.md`, il report in `docs/BANCHE-AUDIT.md`.
- Verifiche: `node scripts/audit-banche.mjs --ci` → 0 doppioni, 0 segnalazioni,
  0 campi mancanti, 0 buchi di Ultima spiaggia; suite backend 163 test.

## 23 novembre 2026 — Quiz: 1000 per round, penalità scalata dal tempo

- **Regola unica:** il round Quiz vale **1000 punti in tutto**, divisi fra le tre
  manches dalla difficoltà (facile ×1, media ×2, difficile ×3). La quota scala
  col tempo: rispondere subito vale il tetto, all'ultimo secondo zero. La
  risposta sbagliata toglie **la stessa quota scalata**, non più 1000 punti
  fissi: il round va da −1000 a +1000 e chi non risponde prende 0.
- **Server allineato al client:** `QuizService` non usa più `WRONG_PENALTY`;
  `QuizServiceTest` verifica che una sbagliata alla prima domanda costi la sua
  quota (400), non mille.
- **Testi:** `SCORING_RULES`, manuale telefono, demo TV, README, presentazione,
  `PUNTEGGI-MASSIMI-MINIMI.md` e manuale HTML color/B/N dicono la stessa cosa;
  PDF rigenerati.
- Verifiche: suite frontend 701 test e backend 163 test.

## 20 novembre 2026 — Punteggi nuovi, banche riviste, niente buoni in app

- **Banche dati:** audit riproducibile (`scripts/audit-banche.mjs`), 30
  difficoltà normalizzate in italiano, 11 doppioni tolti e risposte bilanciate
  (134/132/133/132); Timeline portata a **211 eventi** con difficoltà 1–5 e
  fonte; la Bomba usa una banca di **affermazioni vere e false** con fonte al
  posto del «quale non appartiene»; ripristinata la copertura minima delle
  categorie con tre domande verificate.
- **Una sola tabella:** `rankPoints` (frontend e backend, stessi esempi) e
  `SCORING_RULES`/`BONUS_SCORING` con costanti numeriche lette da motori,
  manuale, demo e README; un test controlla la coerenza.
- **Giochi:** Musica paga 1000/750/500/250 secondo la manche; Timeline sempre
  8 eventi con +400…−200; Time Buzzer senza eliminazioni, +300/−200 e +600
  col tempo perfetto; Speed Rush +800/−400; Biglie +500/−400; Tennis +500/0;
  Bomba solo malus decrescente da −500.
- **Bonus:** Casino colore e dozzina tre girate (100/200 a girata), numero
  secco una girata da 500, scelta in dieci secondi; Blackjack e Cavallo
  assegnano solo il premio concordato con il bar, non punti.
- **Niente buoni in app:** il premio di Blackjack e Cavallo lo consegnano
  barista e presentatore. Rimossi codice, schermata «HAI VINTO», elenco della
  regia, endpoint e stato persistente: l'app mostra solo l'esito del bonus.
- **Banche:** 47 risposte più lunghe dei distrattori riallineate, doppione
  `quiz-viaggi-40` sostituito, `C#` e l'articolo `L'` non sono più falsi
  positivi dell'audit; segnalazioni e doppioni a **0**. Ultima spiaggia dichiara
  il ripiego di fascia quando le domande dedicate finiscono.
- **Manuale:** HTML color e B/N riallineati ai nuovi punteggi; PDF rigenerati
  con Edge headless.
- **Rimosso:** generatore Bomba a quiz senza chiamanti, voce `BLACKJACK` dei
  punteggi di gioco, vecchie tabelle (Musica a secondi, Timeline a 6 carte,
  Biglie 150/100, Tennis 1000/200, Time Buzzer a tagli, Bomba −200),
  `SECONDA-SERATA.md` (superato dal registro).
- **Da provare in sala:** tempi della finestra bonus, premio gestito da
  barista e presentatore, equilibrio dei nuovi massimi/minimi.
- Verifiche: suite frontend 639/639 e backend 154/154; versione 2.2.0.

## 20 novembre 2026 — Sottofondi in casa, finale con il suo tappeto, 2.2.0

- **Tredici sottofondi nuovi:** cinque basi d'atto, i quattordici tappeti dei
giochi e i file già presenti rigenerati dalla pipeline di casa: 60 s, −23
LUFS, seam controllato. `bed-map` e `bed-loops` li conoscono, i crediti sono
rigenerati e i venti loop stanno in 21,70 MB sui 22 del manifesto.
- **Ultima spiaggia a volume:** l'ostinato era un sub a 27 Hz, che non si sente
ma riempie la forma d'onda: RMS a −16,6 dB contro i −23…−25 degli altri. Ora il
sub sta a 55 Hz con il basso in banda media: −21,7 dB, sempre −23 LUFS.
- **Test di loudness:** `loop-loudness.spec.ts` misura i venti file con ffmpeg e
ferma chi esce da −23 LUFS ±0,5, da un RMS ≤ −19 dB o da un picco vero
≤ −1,5 dBTP; dove ffmpeg manca il blocco si salta dichiaratamente.
- **Finale di serata:** l'ultima classifica, automatica o forzata dalla regia,
passa al loop `gioco-casino-finale`; le classifiche di metà serata restano su
`classifica`.
- **Pulizia:** rimosso il modello `game-round.model.ts` (doppione di quello in
`game.service`), i metodi mai chiamati (`getDeviceType`, `getCurrentMode`,
`getTimelineReveal`, `resetPartyGames`, `isSimulation`, `getCurrentAct`,
`marbleColor`, `timerSignal`).
- Verifiche: suite completa, build di produzione; versione 2.2.0.

## 19 novembre 2026 — La roulette torna nera e i numeri tornano al centro

- **Vani neri:** i numeri non rossi erano dipinti con il gradiente `pocketWhite`
  e la puntata si chiamava BIANCO. Ora il gradiente è `pocketBlack` (con i toni
  del foglio globale), la puntata è NERO e `rouletteColorLabel` restituisce
  NERO: aggiornati l'etichetta del bonus, il manuale, la demo TV, l'ingresso
  scenografico, l'admin, la nota dei punteggi, il README e i manuali HTML.
- **Numeri centrati:** `text-anchor`, `dominant-baseline` e il font stavano solo
  nella regola `.pocket-label-light`, quindi sui vani rossi il numero partiva
  dal bordo del vano. Ora sono nella regola base e l'etichetta sta a metà del
  vano (`LABEL_R` = (240 + 148) / 2 = 194): scarto misurato fra ancora e centro
  del testo **0,38 px** su tutte e 37 le caselle.
- Verifiche: suite completa **581 test su 65 file**, build di produzione; ruota
  guardata a 720p.

## 19 novembre 2026 — Banco di prova: il timer demo e la verifica a 720p

- **Il timer non taglia le scelte demo:** nel blackjack del banco di prova non
  parte più il conto alla rovescia dei 15 secondi. La mano la chiude il tavolo
  demo (carta finché è sotto 17, poi stai) e l'esito resta 2 secondi.
- **Due test nuovi:** la modalità preview gioca i due tavoli da sola senza input
  dai telefoni, senza `clock` di decisione e con un solo `finished`; il secondo
  controlla che l'esito duri 2 secondi e non 4.
- **720p:** guardata `/bonus-preview` a 1280×720. L'indice non era scorrevole
  (il body globale è `overflow: hidden`): le schede 4 e 5 restavano sotto il
  bordo. Ora `.bp-index` è alto 100dvh con scroll interno. Il blackjack demo era
  coperto dalla barra: `.bjb-shell` è ancorato a `.bp-live` come casino e
  cavallo, quindi la kicker resta leggibile.
- Verifiche: suite completa **581 test su 65 file**, build di produzione.

## 19 novembre 2026 — Il banco di prova copre tutti i bonus

- **Cinque schede:** `/bonus-preview` elenca casino bianco/rosso, blackjack,
  casino dozzina, cavallo e casino numero secco, nell'ordine degli atti. Le tre
  varianti del casino sono lo stesso componente con `variant` COLOR/DOZEN/NUMBER:
  nella barra c'è il selettore `BIANCO/ROSSO · DOZZINA · NUMERO SECCO` che le
  gira senza tornare all'indice.
- **Blackjack giocabile:** il bonus non aveva una modalità demo e restava 15
  secondi per tavolo in attesa dei telefoni. Ora un input `preview` accorcia la
  mano (4 s per decidere, 2 s di esito, 3 s di finale) e fa giocare il tavolo da
  solo con la regola del banco a 17; la TV non passa l'input, quindi la serata
  resta identica.
- **Spec nuovo:** `bonus-preview.component.spec.ts` copre l'ordine delle cinque
  schede, i link dell'indice, la route sconosciuta che torna all'indice, la
  variante passata al componente per casino/dozzina/numero, blackjack e cavallo,
  il selettore delle varianti, `?giocatori` e `?capture`.
- Verifiche: suite completa **579 test su 65 file**, build di produzione.

## 19 novembre 2026 — I residui del banco di prova Biglie

- **Foglio globale:** spariscono `app-bonus-preview .bp-live .bg-overlay` (la
  scheda Biglie non esiste più) e `.bbs-overlay`, che puntava a una scena basket
  non presente nel codice.
- **Anteprima:** via le ombre per la terza e quarta scheda, lo stile `.bp-phone`
  senza elementi e la colonna ridondante nella media query dei 900 px.
- **`roundMode` eliminato:** il componente delle Biglie non ha più il ramo
  «bonus»: la kicker è sempre `BIGLIE · ROUND`, la frase sulla classifica resta
  in pagina e la TV non passa più l'input.
- Verifiche: suite Biglie + TV **152 test su 9 file**, build di produzione.

## 19 novembre 2026 — Le Biglie escono dal reparto bonus

- **Cartella e nome giusti:** il componente passa da `features/bonus/biglie/` a
  `features/games/biglie/biglie.component.ts`, con classe `Biglie` e selettore
  `app-biglie`; gli altri file della pista lo seguono accanto a `biglie.mode.ts`.
  Le Biglie sono un gioco di round (`GameModeType.BIGLIE`, quattro round in
  scaletta), non uno dei cinque bonus (`BonusType`): il nome non le confonde più.
- **Niente URL dedicato:** le Biglie non hanno più una scheda in
  `/bonus-preview` né un caso nella route dell'anteprima. Sono un round come gli
  altri: si vedono in TV quando la scaletta le chiama. Spariscono con la scheda
  anche `?traccia=` e gli input `preview`/`trackOverride` del componente, che
  esistevano solo per quel banco di prova (intro da 1 s, scelta automatica,
  pista forzata).
- **Anteprima tornata a due bonus:** timbro «BONUS PREVIEW», titolo «DUE BONUS,
  UN SOLO BANCO DI PROVA» e griglia a due schede, larga 920 px.
- Verifiche: suite Biglie + TV, build di produzione, tutti passati.

## 19 novembre 2026 — F1 rimonta, e la TV guardata a 720p (Biglie B3)

- **F1 all'85% di rimonte** (era 65%, la pista più indietro della tabella qui
  sotto): il tracciato guadagna un esse al posto di un dritto e il piano
  dell'asfalto passa da 4 a 8 chiazze di ghiaccio, con meno paracarri. Nessuna
  soglia toccata: **34/40** gare con rimonta, **8/8** sugli otto semi del test
  largo, contatti 4,24/s, ultima 51,3 s, prima mai sotto i 43,7 s, sei cambi di
  testa.
- **Controllo visivo a 720p** (1280×720, banco di prova delle Biglie con otto
  biglie sull'orbita; allora si apriva da `/bonus-preview/biglie`, oggi non più
  esistente perché le Biglie sono un round e si guardano in TV): le biglie da
  12 px restano leggibili col loro emoji
  e la scia; i meteoriti cadono dentro le righe della corsia e non più
  appoggiati al muro; l'ostacolo mobile resta visibile. Nessun problema di
  impaginazione né di gerarchia nella classifica a sinistra.
  La scheda del browser era in secondo piano (la TV sospende la corsa), quindi
  la gara è stata avanzata a passi da 1/60 chiamando il passo della TV e
  ridisegnata: i fotogrammi sono render veri del componente, non una
  registrazione in tempo reale.
- Verifiche: suite Biglie **64 test su 7 file**, suite completa **568 test su 64
  file**, tutti passati.

## 19 novembre 2026 — La taratura regge su più semi (Biglie B3)

- **Le soglie vere su più semi:** oltre ai 24 semi fissi (tre per pista) c'è ora
  un gate da **otto semi per pista, 64 gare**, con le stesse soglie della gara
  vera: ultima sotto 70 s, prima sopra 40 s, almeno 3 cambi di testa e 12
  sorpassi, distacco sotto 25 s, contatti sotto 5 al secondo e 30% di tempo in
  contatto, rimonte all'80% complessivo e almeno una per pista. Gli otto semi
  vengono dalla misura di fragilità (`1000003 + i · 7919`), gli stessi per tutte
  le piste e non scelti a mano: quando una pista scivola, il test dice pista e
  seme. Il gate da 24 resta come prova rapida.
- **Sabbia sistemata:** il piano del deserto aveva **12 macchie di sabbia su 24
  ostacoli** (il rally ne ha 6 di fango), e la pista più lenta del catalogo
  sforava i 70 s in 17 gare su 100. Ora sono **5 su 24**, con più sassi e
  paracarri: la sabbia resta il fondo più lento (**61,6 s di media**) ma la coda
  sta sotto i 66 s.
- **Spazio sistemata:** i meteoriti erano trattati come i paracarri, tutti a
  ridosso del muro; sulla pista larga e liscia non cambiava mai niente e nello
  spazio rimontava solo il **54%** delle gare. Ora cadono in corsia (posizione
  libera, come le macchie): **93% di rimonte**, e la pista resta la più veloce
  dopo F1 e vetro.
- **Contatti sotto la soglia:** con il gruppo da otto la corsia era satura,
  fino a 6,3 contatti al secondo nei semi peggiori contro i 5 ammessi. Il
  raggio massimo scende da 14 a 12 px, la velocità di punta sale dell'1%
  (`PACE_BASE` 3,98 → 4,02) e la chiusura finale passa da 1,7 a 2,1: **massimo
  4,8 contatti/s** su 320 gare, tutte sotto i 68,6 s e **85% di rimonte**.
- **Il test di confronto non si può più aggirare:** il passo condiviso tiene un
  contatore (`interactionStepCount`) che il test azzera e poi fa salire
  facendo passare la TV da `applyFeatures` e la simulazione da una gara intera:
  se una delle due smette di passare di lì, resta a zero. In più controlla i
  punti di chiamata nel sorgente — il giro di fisica della TV deve usare
  `applyFeatures`, il ciclo della simulazione `simulationInteractions`, mai
  `applyInteractions` per conto proprio — così una corsa che si rifà i conti in
  casa fa fallire il test invece di confrontare due funzioni che nessuno usa.
- **Fragilità rimisurata su 40 semi per pista** (320 gare):

  | pista | media | max | contatti max | rimonte |
  |---|---|---|---|---|
  | rally | 61,6 s | 67,3 s | 4,6/s | 93% |
  | f1 | 49,4 s | 52,4 s | 3,3/s | 65% |
  | neve | 53,4 s | 56,8 s | 4,6/s | 88% |
  | acqua | 56,4 s | 59,5 s | 3,6/s | 88% |
  | vetro | 47,7 s | 50,9 s | 4,8/s | 85% |
  | sabbia | 61,6 s | 65,8 s | 4,0/s | 88% |
  | spazio | 57,0 s | 60,2 s | 4,2/s | 93% |
  | magma | 63,1 s | 68,6 s | 4,3/s | 85% |

  Le 24 gare fisse stanno in **46,6–67,3 s** con **22/24 rimonte**. Resta F1 la
  pista che rimonta meno (65%): è la più corta e la più liscia, e il margine
  d'arrivo è di sei secondi.
- Verifiche: suite Biglie **64 test su 7 file**, tutti passati.

## 19 novembre 2026 — Un passo solo per le interazioni (Biglie B3)

- **Una funzione, due corse:** `stepInteractions` decide tutto e in un ordine
  fissato — attrito e correnti, poi rampa e perni, poi barra, porta e altalena.
  `applyInteractions` è l'unico punto che tocca velocità e timer, e TV e
  simulazione lo chiamano nello stesso momento: il colpo si sente dopo il passo
  di accelerazione, non prima. La corsa headless espone `simulationInteractions`
  come suo ingresso, così il confronto nei test guarda il codice che gira.
- **Test di confronto:** 480 passi (8 secondi di gara) sul passaggio di perni e
  barra, con la biglia che punta sempre al centro dell'ostacolo: bersaglio,
  spinta di lato, colpo, ostacolo preso, velocità, timer e insieme delle
  interazioni prese devono coincidere fra TV e simulazione a ogni passo.
- **Taratura ritarata per il nuovo ordine:** perni a 0,15 s di blocco e 0,55 s
  di ripresa, ostacoli a 0,9. Le 24 gare fisse stanno in **48,2–69,5 s**, con
  **21/24 rimonte**.
- **Fragilità misurata su 100 semi per pista** (stessi semi per tutte le piste):

  | pista | media | max | gare ≥70 s | contatti max | cambi min | rimonte |
  |---|---|---|---|---|---|---|
  | rally | 63,0 s | 69,6 s | 0/100 | 5,4/s | 4 | 88% |
  | f1 | 50,8 s | 54,8 s | 0/100 | 5,2/s | 4 | 74% |
  | neve | 54,8 s | 59,9 s | 0/100 | 5,6/s | 2 | 86% |
  | acqua | 58,3 s | 63,0 s | 0/100 | 5,4/s | 4 | 86% |
  | vetro | 48,5 s | 51,7 s | 0/100 | 6,3/s | 4 | 81% |
  | sabbia | 67,7 s | 72,7 s | 17/100 | 5,2/s | 3 | 83% |
  | spazio | 55,7 s | 59,4 s | 0/100 | 4,9/s | 5 | 54% |
  | magma | 64,8 s | 69,9 s | 0/100 | 5,0/s | 3 | 86% |

  Lettura: la taratura è solida sulla durata tranne che sulla **sabbia**, che è
  il fondo più lento e sfora i 70 s in circa un sesto dei semi; **magma** resta
  sul filo (69,9 s). I contatti al secondo superano i 5 su rally, neve e vetro
  nei semi peggiori, e **spazio** rimonta solo nel 54% delle gare contro l'80%
  richiesto dal test fisso: sono i tre punti da guardare prima di allargare i
  margini.
- Verifiche: suite Biglie **58 test su 7 file**, suite completa **562 test su 64
  file**, tutti passati.

## 19 novembre 2026 — Barra, porta e altalena: la pista si muove (Biglie B3)

- **Ostacoli mobili deterministici:** uno per pista, sempre allo stesso punto
  (progresso 0,52), tipo scelto dal nome del fondo e sfasamento dal seme. La
  barra spazza la corsia, l'altalena oscilla più larga e lenta, la porta si
  chiude al centro e si riapre. `movingObstacle` / `movingObstacleHit` sono le
  stesse funzioni per Matter (TV) e per la corsa headless.
- **Effetti:** chi prende l'ostacolo perde il 10% di velocità con 0,12 s di
  blocco; il colpo conta una volta ogni due secondi per ostacolo, non a ogni
  fotogramma. Sono disegnati con barra e tacche e si muovono col tempo di gara,
  quindi si vede dove stanno prima di arrivarci.
- **Il test che mancava sulla TV:** il componente ha ora `applyFeatures`, il
  punto in cui applica davvero attrito, correnti, rampe e perni, e un test lo
  verifica direttamente: bersaglio abbassato dalla corrente, spinta di lato,
  rampa che alza il bersaglio e dà il momento di gloria, perni che tolgono
  velocità una volta sola.
- **Birilli:** tolta l'oscillazione decorativa, restano fermi dove la fisica li
  mette.
- **Taratura:** fattore 0,9 con coperture 0,20 / 0,26 / 0,40 tiene i contatti
  sotto 5 al secondo e le gare sotto i 70 s: **21/24 rimonte**, **48,8–68,8 s**.
- Verifiche: suite Biglie **57 test su 7 file**, suite completa **561 test su 64
  file**, tutti passati.

## 19 novembre 2026 — La pista spinge, frena e lancia (Biglie B3)

- **Pezzi nuovi:** imbuto (la corsia si chiude a una gola e si riapre), rampa
  (dritto che lancia) e perni (dritto con i birilli in mezzo). Ogni fondo li usa
  a modo suo: imbuto su terra, acqua e sabbia; rampa su asfalto; perni su deserto
  e fucina. La gola dell'imbuto resta dentro il limite dei tre diametri.
- **`track-features.ts`, le interazioni condivise:** dal seme e dai pezzi nascono
  zone d'attrito (sulle strettoie e negli imbuti), due correnti per gara che
  spingono verso un muro, rampe e perni. `alongFactor`, `lateralPush` e
  `oneShotAt` sono le stesse funzioni per Matter (TV) e per la corsa headless:
  quello che si vede è quello che pesa.
- **Disegnate dove agiscono:** rampe a galloni, correnti a frecce, perni come
  birilli, attrito a tratteggio, lette dallo stesso elenco della fisica.
- **Ampiezza fuori dal profilo:** era 250 su tutte e otto le piste, quindi non
  diceva nulla; `buildTrack` torna a usare la fascia di sempre.
- **Taratura:** con le prime intensità (attrito 18%, corrente 0,42) le gare
  sforavano i 70 s e le rimonte scendevano a 16/24. Ora attrito 6%, corrente
  0,22, rampa 1,06, perni 0,72: **21/24 rimonte**, gare fra **48,9 s e 68,8 s**.
- Verifiche: suite Biglie **53 test su 7 file**, suite completa **557 test su 64
  file**, tutti passati.

## 19 novembre 2026 — Ogni fondo ha la sua pista

- **B2 — profili di geometria per le otto piste:** `track-plan.ts` porta ora, accanto
  a fisica e pesi, un profilo di tracciato (quali pezzi escono, ampiezza della
  fascia, quanto stringono le strettoie) e `buildTrack` lo legge. Terra con
  tornanti e due strettoie, asfalto di curvoni e dritti, neve morbida, acqua di
  esse, vetro di chicane, deserto tecnico, orbita con dritti lunghi e fucina di
  tornanti secchi: stesso seme, otto piste diverse. Senza profilo il generatore
  resta quello di prima, così il comportamento vecchio resta verificabile.
- **Una sola linea per disegno e fisica:** bordi disegnati (`edgePoints`), muri
  Matter (`wallSegments`, con lo stesso `inset` di −6) e proiezione della biglia
  (`projectOnTrack`) nascono dai nodi del profilo, quindi la pista che si vede è
  quella su cui rotolano le biglie. La corsia resta larga quanto il numero di
  concorrenti e non scende mai sotto i tre diametri (`MIN_LANE` 96), nemmeno
  nelle strettoie.
- **Taratura con la simulazione, non a occhio:** la bozza dei profili faceva
  scendere le rimonte sotto la soglia dei test (17/24) e allungava il deserto
  oltre i 70 s. Ho misurato i profili uno per uno sulla corsa headless e tenuto
  quelli che rispettano i vincoli già promessi: ora **20/24 rimonte**, gare fra
  48,1 s e 66,4 s, nessuna biglia fuori dal traguardo.
- Verifiche: `ng test` sui sei file delle Biglie, **47 test passati**.

## 19 novembre 2026 — La bilanciatura della sala e il silenzio della regia

- **A2 — bilanciatura:** ogni evento del catalogo ha un livello pensato per il
  suo ruolo, non per correggere la registrazione (i file sono già normalizzati:
  −16 LUFS gli effetti, −23 LUFS i loop). Tick e ingressi ripetuti stanno a
  0,5–0,7, i momenti forti a 0,85–0,9, il ticchettio continuo del timer a 0,35;
  il battito di suspense moltiplica per 0,85 il proprio crescendo. Prima erano
  a 1 il gong, il countdown, il tick di classifica, gli applausi, i gettoni, la
  pallina, il rullo, la campana, le conferme del telefono e gli ingressi bonus.
- **La cifra si legge in regia:** ogni scheda di `/audio` porta `VOL …`, così il
  numero che si ascolta è quello che si vede.
- **A3 — «FERMA TUTTO» è un silenzio:** `AudioService.stopAll()` fermava solo
  battito e orologio, lasciando acceso sottofondo, rotolamento e gli applausi
  lunghi che finivano da soli. Ora ferma loop, tappeto e anche gli effetti già
  partiti, con `SoundPlayer.stopOneShots()`.
- Verifiche: **24 test** su tre file (`audio.service.spec.ts` 12,
  `audio-catalog.spec.ts` 10, `audio-lab.component.spec.ts` 2), tutti passati.
  **Non fatto:** l'ascolto in sala — la bilanciatura è per ruolo sonoro, non
  giudicata all'orecchio.

## 19 novembre 2026 — Il peso di un atto si conta una volta sola

- **§4.7, l'atto 1 corretto:** il documento diceva 6,64 MB perché sommava
  `gioco-casino` e `gioco-bomba` (gli alias di oggi) ai file futuri di Azzardo e
  Speed Rush: lo stesso gioco contato due volte. Con ogni gioco sul suo loop
  l'atto 1 pesa **4,00 MB**; il più carico è l'atto 3, **4,78 MB**. Il vincolo
  vero è il totale: i venti loop a 60 s fanno **21,07 MB** sui 22 del manifesto.
- **Il test che lo tiene fermo:** `bed-act-budget.spec.ts` rifà il conto da
  `ACT_DECKS` e `bed-map.ts`. Per ogni atto prende la base e **uno slot per
  gioco** — il loop che il manifesto gli riserva, altrimenti quello che suona
  oggi: così l'alias e il file futuro non possono finire nello stesso conto.
  Un file in cartella pesa i suoi byte, uno che manca pesa il minimo di 60 s a
  112 kbps, quindi il giorno della consegna non si aggiorna un numero a mano.
  Controlla i 6 MB per atto, i venti loop sotto i 22 MB, che nessun `.m4a` di
  `loop/` resti fuori dal conto e che un loop arrivato sia quello che la mappa
  fa suonare. Gli alias non si nominano più per nome.
- Verifiche: `tsc` pulito, **537 test su 64 file**.

## 19 novembre 2026 — I venti sottofondi hanno il loro documento

- **§4.7 — `docs/SOTTOFONDI.md`:** i venti loop uno per uno, con carattere,
  BPM, durata e peso misurati e il ruolo di ognuno: dove suona oggi e cosa gli
  tocca quando il file arriva. Una tabella per le cinque basi d'atto, una per i
  quattordici giochi e bonus, il rotolamento delle Biglie a parte, più «chi
  suona cosa» letto da `GAME_BEDS` e la lista di cosa fare appena un file entra
  in cartella.
- **Il conto del peso alla luce del sole:** 7 loop su 20 in casa per 10,67 MB
  sui 22 del tetto; i 13 mancanti hanno 0,87 MB a testa, cioè ~63 s a 112 kbps.
  Il documento segnala il nodo dell'atto 1: con tutti i file a 60 s arriva a
  **6,64 MB** e sfonda di 0,64 il tetto dei 6 MB per atto. Va deciso prima della
  consegna: o loop da ~46 s, o accorciare `gioco-casino` e `gioco-bomba`.
- Il manifesto punta al nuovo file dalla sezione dei sottofondi (§4.7). Nel
  suono non cambia niente: è una lettura, non una regola nuova.
- **La manche 2 al contrario, provata su una preview vera:** dev server del
  frontend e backend vero con la banca locale, preview
  `/media/music/abba-dancing-queen.m4a` (1,1 MB, `audio/mp4`,
  `Access-Control-Allow-Origin` riflesso alla propria origine, quindi il
  `fetch` in `mode: cors` passa). In Chromium il componente ha decodificato la
  preview e rovesciato i due canali: il buffer rovesciato combacia campione per
  campione con il file vero letto al contrario, la manche 2 ha suonato il buffer
  a 0,94 dentro la catena di filtri (RMS 0,06 misurato all'analizzatore,
  elemento audio in pausa a 0 s) e la manche 4 è tornata al file (elemento in
  riproduzione, guadagno 1, reverse spento). **Nessun fallback.**
- Verifiche: `tsc` pulito, **532 test su 63 file**. Il banco di prova della
  preview era temporaneo (rotta `/dev-song` e componente) ed è stato rimosso:
  nel commit restano il documento, il manifesto e questa voce.

## 18 novembre 2026 — La seconda manche della Canzone va al contrario

- **Manche 2 al contrario:** quando la Canzone entra nella seconda manche, la TV
  smette il file e suona la preview rovesciata, un filo più lenta
  (`REVERSE_RATE` 0,94) e dentro la stessa catena di filtri della manche
  (banda stretta, drive e fruscio radio). Il buffer rovesciato si scarica e si
  decodifica già nella manche 1: all'ascolto non c'è attesa. Se il CDN non
  concede il CORS o la rete cade, resta il brano filtrato e il round va avanti.
- **Il file torna al suo posto:** appena la manche 2 finisce il reverse si ferma
  e riparte l'elemento audio; il reveal a tutto volume, la prenotazione e la
  pausa fra due ascolti spengono comunque il buffer. Un brano nuovo azzera il
  reverse del precedente.
- Test: `reverse-track.spec.ts` (canali rovesciati, velocità sotto 1) e in
  `song.component.spec.ts` la manche 2 che suona il buffer senza il file, e il
  ritorno al file quando la manche finisce.
- Documentazione: i due manuali della serata e `SERATA-PROVA.md` dicono della
  manche 2 al contrario.
- Verifiche: **532 test su 63 file**, `tsc` pulito, `ng build` verde.
  **Non fatto:** nessun ascolto reale: la preview rovesciata non è stata
  sentita, né provata contro un CDN vero.

## 18 novembre 2026 — La regia audio mostra i sottofondi con il loro peso

- **§4.5 — `/audio` legge il catalogo:** due sezioni nuove. «SOTTOFONDI PER
  ATTO» mostra per ogni atto la base e i giochi che la scaletta ci mette, con il
  file, il peso e il totale dell'atto (più quanti file mancano alla consegna).
  «SOTTOFONDI PER GIOCO» elenca le quattordici modalità con il loop che le
  tocca, la base d'atto o il silenzio. I tappeti restano in fondo, ora con il
  peso accanto al file.
- **Peso vero, non una tabella a mano:** `bed-weights.ts` chiede una `HEAD` a
  ogni file e legge `Content-Length` — MB e KB con la virgola, «manca» per un
  404, «n/d» se la rete cade. La pagina non scarica un byte di audio per pesare
  i file.
- Test: `bed-weights.spec.ts` (formato, 404, rete caduta) e
  `audio-lab.component.spec.ts` (atti, giochi, base mancante, totale dell'atto
  contato sui soli file presenti).
- Verifiche: **528 test su 62 file**, `tsc` pulito, `ng build` verde in 30 s.
  **Non fatto:** la pagina non è stata aperta in un browser vero, quindi il peso
  non è stato visto arrivare da un server: le `HEAD` le prova solo la rete
  finta dei test.

## 18 novembre 2026 — Solo un 404 resta assente, e gli effetti tornano sotto un tetto

- **Il precaricamento distingue i guasti:** `warmBed()` segna come assente solo
  un **404 vero**, cioè il file non ancora in cartella che non deve tornare a
  bussare a ogni round. Un errore di rete, un 5xx o una decodifica fallita non
  sono una risposta «questo file non c'è»: si lascia il file da riprovare al
  giro dopo, perché un Wi-Fi che cade per un istante non deve zittire quel loop
  per tutta la serata.
- **Tetto degli effetti:** il vecchio test dei 15 MB copriva anche gli effetti,
  quello del §4.4 no. Nuovo tetto esplicito: gli effetti sotto **4 MB** (oggi
  3,01 MB), separato dai 22 MB dei sottofondi e dai 6 MB dell'atto. Manifesto
  aggiornato.
- Test: `sound-player.spec.ts` prova che un 404 viene chiesto una volta sola,
  che un errore di rete viene ritentato al giro dopo e che un 500 non vale come
  file assente; `audio-assets.spec.ts` misura gli effetti sotto il tetto.
- Verifiche: **523 test su 60 file**, `tsc` pulito. **Non fatto:** nessun
  ascolto; `ng build` non rifatta, perché non tocca service worker né
  configurazione di build.

## 18 novembre 2026 — Un 404 si ricorda, e i sottofondi hanno il loro tetto di peso

- **Il precaricamento non bussa due volte:** `SoundPlayer.warmBed()` segna il
  file fallito come assente, quindi l'atto non ancora consegnato prende un solo
  404 invece di uno a ogni round. Un ricaricamento della pagina riapre i
  tentativi, così il file arriva con il nuovo deploy; quando il sottofondo
  servirà davvero, `startBed` lo segnala in console senza riscaricarlo.
- **§4.4 — tetto di peso:** i venti sottofondi stanno sotto **22 MB** (oggi
  10,66 MB con 7 file su 20) e nessun atto sfonda i **6 MB** fra la sua base e i
  loop dei giochi della scaletta. I file non ancora in cartella non pesano
  finché non arrivano: il conto è su quelli veri, e il manifesto ora dice la
  stessa cosa.
- Test: `sound-player.spec.ts` (due `warmBed` sullo stesso 404 → una sola
  fetch), in `audio-assets.spec.ts` il tetto dei 22 MB e il budget per atto al
  posto del vecchio limite di 15 MB.
- Verifiche: **520 test su 60 file**, `tsc` pulito. **Non fatto:** nessun
  ascolto; `ng build` non rifatta, perché questa volta non tocca il service
  worker né la configurazione di build.

## 18 novembre 2026 — I sottofondi arrivano con l'atto, e il service worker li tiene

- **Caricamento per atto:** `bedsForAct(atto)` dice cosa serve in memoria — la
  base d'atto e i loop dei giochi che la scaletta mette in quell'atto, una volta
  ciascuno, senza i giochi muti. `AudioService.setActBed()` chiama
  `preloadAct()`, che passa i file a `SoundPlayer.warmBed()`; la TV apre l'atto
  a ogni round (`setActBed(currentActNumber())`, anche alla ripresa), così i
  file sono già decodificati al primo Quiz, senza il vuoto della prima fetch.
- `warmBed` è best-effort: un file non ancora in cartella non ferma niente,
  non sporca la console e non viene segnato come assente, così quando servirà
  si riprova.
- **Cache del service worker:** nuova data group `audio-loop`
  (`/assets/audio/loop/*`, strategia `performance`, 40 voci, 30 giorni). Prima
  i loop non cadevano sotto nessun gruppo — quello degli asset copre solo icone
  e immagini — quindi il browser li riscaricava a ogni cambio gioco.
- Test: `bed-map.spec.ts` controlla che ogni atto chieda la sua base e i loop
  della propria scaletta; `audio-act-load.spec.ts` segue l'atto 3 fino ai tre
  file chiesti al player e ripete su tutti e cinque gli atti, senza doppioni;
  `audio-assets.spec.ts` controlla che ogni sottofondo cada sotto una regola di
  cache di `ngsw-config.json`.
- Verifiche: **517 test su 59 file**, `tsc` pulito, `ng build` di produzione in
  42 s (la build valida anche `ngsw-config.json`). **Non fatto:** i cinque file
  d'atto non ci sono ancora, quindi il precaricamento della base oggi prende un
  404 silenzioso finché non arrivano; nessun ascolto.

## 18 novembre 2026 — La base d'atto ha la sua mappa, e la domanda abbassa la musica

- **`bed-map.ts`** è il file unico dei sottofondi: la base dei cinque atti
  (`loop/atto-1…5.m4a`), il brano di ogni gioco, i giochi muti e la regola dei
  −6 dB. `bed-loops.ts` resta il registro dei file già arrivati; la mappa gioco →
  sottofondo non vive più in due posti.
- I giochi senza brano proprio (Quiz, Indovina chi, Ruota, Timeline, Ultima
  Spiaggia) ora chiedono `ACT_BASE`: è la base d'atto, non la lobby. I cinque file
  d'atto non sono ancora in cartella, quindi `READY_ACTS` è vuoto e la base
  resta la lobby: **un test confronta `READY_ACTS` con i file su disco**, così
  scordarsi di dichiarare un atto arrivato fa fallire la suite invece di lasciare
  la serata sul jazz della lobby.
- `AudioService`: arrivano `setActBed(atto)` e `setQuestionActive(aperta)`; il
  sottofondo si abbassa di 6 dB senza riavviarsi (`SoundPlayer.setBedLevel`),
  torna su alla chiusura e riparte pieno a ogni cambio gioco. `setGameBed` ora
  conosce l'atto in corso. Il gancio della TV a `setQuestionActive` non c'è
  ancora in questo commit: arriva con la voce successiva.
- Test: nuovo `bed-map.spec.ts` (atti, giochi, −6 dB, READY_ACTS contro il disco)
  e `audio-question-bed.spec.ts` (0,451 a domanda aperta, 0,900 alla chiusura,
  nessun abbassamento sui giochi con loop proprio, nessuna rampa doppia).
- Verifiche: `tsc` pulito, **509 test su 58 file**, `ng build` di produzione
  completato in 65 s. Gli avvisi sono quelli già noti, non introdotti qui:
  `game.component.css` supera il budget di 1,15 kB (37,15 kB su 36 kB) e
  `qrcode`/`matter-js` non sono ESM. Nessun ascolto dei loop.

## 18 novembre 2026 — La TV abbassa la musica quando la domanda è aperta

- **Il gancio c'è:** `GameModeConfig.onQuestionOpenChange` è collegato in
  `buildModeConfig` a `AudioService.setQuestionActive`, quindi la regola dei
  −6 dB adesso arriva dai momenti veri del round e non solo dai test del
  servizio.
- **Quiz:** la domanda si apre all'inizio di ogni manche e si chiude quando il
  tempo scade, quando la TV riprende una manche già in suspense o in soluzione
  e alla chiusura del round. La manche successiva la riapre.
- **Indovina chi:** si apre con la foto, si chiude al buzz (da lì si risponde) e
  si riapre se il presentatore dà la risposta per sbagliata, perché il round
  riprende. Pausa, chiusura e uscita dal round la riportano su.
- Test: `game.component.spec.ts` fa partire un Quiz vero sulla configurazione
  della TV e vede `question-open` → `question-closed` sul doppio audio;
  `image-blur.mode.spec.ts` segue apertura, buzz e riapertura dopo lo sbaglio.
- Verifiche: **511 test su 58 file**, `tsc` pulito, `ng build` di produzione in
  60 s con gli stessi avvisi già noti. **Non fatto:** nessun ascolto, quindi non
  so se i −6 dB si sentono giusti in sala.

## 18 novembre 2026 — La pipeline dei loop rifiuta quello che non va, e dice cosa consegnare

- **Incrocio garantito:** i 1,5 s di dissolvenza coda→testa non si accorciano più
  quando il brano è corto. Lo script verifica che il giro misuri quanto il grezzo
  meno 1,5 s e, se il conto non torna, scarta il file invece di pubblicarlo con
  il buco.
- **60–120 s obbligatori:** sotto i 60 s il file viene cancellato e la consegna
  segnalata come errore (prima era un avviso e il giro corto passava). Sopra i
  120 s il taglio resta automatico. Eccezione dichiarata: il rotolamento
  `loop/biglie.m4a`, 24 s perché non è musica.
- **AAC 112 kbps** per i sottofondi, dentro la forbice 96–112 della spec (era
  128). Effetti invariati a 96 kbps.
- **Soglia sul salto di loop:** 8%, e non è più un avviso. Il file che supera la
  soglia viene scartato sia in lavorazione sia in `--check`, che ora misura
  durata e giunzione anche dei loop già pubblicati.
- **Nuovo report `--check --pending`** (da solo: `--pending`): i 13 file mancanti
  con carattere, BPM, parole di ricerca — letti dalle tabelle del manifesto, non
  ricopiati — la cartella `_src` dove posarli e la riga di `FONTI.txt` già
  composta, con solo titolo, autore e URL da riempire.
- Verifiche: `--check --pending` elenca i 13 file e i 7 loop in casa passano
  durata e salto; `node --check` pulito. **Non fatto:** nessun file nuovo
  elaborato, perché i 13 grezzi non ci sono ancora.

## 18 novembre 2026 — Ogni gioco ha il suo sottofondo, o il silenzio

- La mappa dei sottofondi è tipata su `GameModeType`: aggiungere un gioco senza
  assegnargli un loop **non compila**. Niente più id scritti a mano che possono
  invecchiare in silenzio.
- Un test enumera `GAME_MODE_TYPES` (i tipi veri, non una lista scritta a mano)
  e fallisce se un gioco non ha né un loop né il silenzio dichiarato, se la mappa
  contiene un tipo che il gioco non conosce o se un gioco è insieme mappato e
  muto.
- **Musica e Time Buzzer suonano nel silenzio**: `bedForGame` torna `null`,
  `applyBed` spegne il loop in onda e `startAmbient` non ne accende un altro.
  Prima ereditavano il jazz della lobby.
- Quattro test nuovi in `audio.service.spec.ts` (Musica, Time Buzzer, pausa di un
  gioco muto, ritorno del sottofondo uscendo dalla Musica) e tre in
  `bed-loops.spec.ts`.
- Verifiche: **495 test su 56 file**, `tsc` pulito, build di produzione.
  **Non fatto:** la regola dei −6 dB per Quiz e Indovina chi durante la domanda
  arriva con `bed-map.ts`; il file `gioco-cavallo` resta pronto per il bonus.

## 18 novembre 2026 — I venti sottofondi hanno un nome, e sei file ce l'hanno già

- Il manifesto elenca i **20 loop** della spec: cinque basi d'atto
  (`atto-1…atto-5`), quattordici giochi e bonus (`gioco-casino`,
  `gioco-bomba`, `gioco-tennis`, `gioco-cavallo`, `lobby`, `classifica`,
  `gioco-arena`, `gioco-speed-rush`, `gioco-biglie`, `gioco-timeline`,
  `gioco-ultima-spiaggia`, `gioco-azzardo`, `gioco-blackjack`,
  `gioco-casino-finale`) e il rotolamento `biglie`. C'è anche la regola di
  riproduzione: base d'atto, sottofondo di gioco al suo posto, Musica e Time
  Buzzer in silenzio, Quiz e Indovina chi abbassati di 6 dB.
- I **sei file già in casa** hanno preso il nome nuovo: `pub` → `lobby`,
  `tensione` → `gioco-bomba`, `sport` → `gioco-tennis`, `leggero` →
  `gioco-cavallo`, `casino` → `gioco-casino`; `classifica` resta com'era.
  Rinomina con `git mv`, `FONTI.txt` e `CREDITI-AUDIO.md` rigenerati: 48 file,
  11,61 MB.
- `process-audio.mjs`: attesi 20 loop, i conteggi in `--check` sono calcolati
  dal manifesto e `--credits` salta i file non ancora consegnati invece di
  fermarsi.
- `--check` dice oggi **13 file mancanti**: i 5 atti e gli 8 giochi nuovi.
- `bed-loops.ts` usa gli id nuovi con le stesse famiglie; prossimo passo
  `bed-map.ts` con le basi d'atto.
- Verifiche: **488 test su 56 file**, `tsc` pulito, build di produzione.
  **Non fatto:** nessun ascolto dei sei file rinominati (sono gli stessi di
  prima) e i 13 file nuovi non ci sono ancora.

## 18 novembre 2026 — In pausa tace anche il rotolamento delle Biglie

- `AudioService.pauseBeds()` ferma musica **e** rotolamento: ricorda se il loop
  `marbleRoll` era in onda (`SoundPlayer.isLooping`) e `resumeBeds()` lo
  riaccende con la pista dell'ultima gara, ma solo in quel caso. La corsa non
  viene toccata: si spegne soltanto quello che si sente.
- `togglePause()` usa i due nuovi ingressi al posto di `stopAmbient()` e
  `startAmbient()`, così pausa e ripresa restano una riga per stato.
- **3 test nuovi** in `audio.service.spec.ts` (pausa con gara in corso, ripresa
  con gara, ripresa senza gara) e il test della TV aggiornato a
  `pause-beds`/`resume-beds`.
- Verifiche: **488 test su 56 file**, `tsc` pulito, build di produzione. **Non
  fatto:** la pausa non è stata ascoltata su una TV vera.

## 18 novembre 2026 — In pausa la TV tace davvero

- `togglePause()` ferma anche il sottofondo oltre a clock e suspense: durante la
  pausa non resta la musica del gioco a girare a sala ferma. Alla ripresa
  `startAmbient()` rimette in onda la famiglia del round in corso.
- **1 test nuovo** in `game.component.spec.ts`: pausa → `stop-ambient`,
  ripresa → `ambient`, con `pause()`/`resume()` del modo chiamati.
- `docs/ROADMAP-POST-PRIMA-SERATA.md` allineato alle Biglie di oggi: otto piste,
  due gare per round, 12.000 px di pista, chiusura all'arrivo dell'ultima biglia
  (47–66 s), 70 s di conto alla rovescia e 120 s di rete di sicurezza. Via i
  riferimenti a quattro fondi, quattro gare, bivi e taglio a 38/45 s.
- Verifiche: **485 test su 55 file**, `tsc` pulito, build di produzione. **Non
  fatto:** la pausa non è stata provata su una TV vera né ascoltata.

## 18 novembre 2026 — armUnlock senza callback, via gli ultimi metodi morti

- `armUnlock()` non accetta più `onUnlock`: nessun chiamante lo passava dopo
  l'uscita di Foley. Il gesto che sblocca il contesto fa una cosa sola.
- Tolti i metodi di `AudioService` che nessuno chiama: `playCoins`,
  `playUuuh`, `playConfirm`, `playError`, `currentBed` e `event()`, con le
  rispettive voci in `AUDIO_EVENT_FOR_METHOD` e nei doppi di test. Gli eventi
  restano nel catalogo: sono i metodi a non servire, non i suoni.
- `SoundPlayer.stopAllLoops()` eliminato (nessun chiamante) e `LoopStyle` non è
  più esportato: è un tipo interno di `startLoop`.
- Verifiche: **484 test su 55 file**, `tsc` pulito, build di produzione.

## 18 novembre 2026 — Via la sintesi: resta solo la coda di stanza

- **Cancellati `bed-profiles.ts` e la sua spec** (572 righe): i sedici tappeti
  generati non esistono più, al loro posto ci sono i sei loop registrati.
- **Foley fuori**: via `UI_SOUNDS`, `playUi`, `unlockFoley` e `muteUi` da
  `audio.service.ts`, via la dipendenza `@foleyjs/core` da `package.json` e dal
  lock. Gli eventi di interfaccia suonano già i file del catalogo (`tick`,
  `confirm`, `error`, `join`, `rankReveal`, …).
- **`audio-dsp.ts` ridotto a `createRoom`** (615 → 55 righe): la coda di stanza
  è l'unico effetto di sintesi che serve ancora, perché dà spazio ai file sul bus
  della TV. Via i generatori di campane, corde, voci, ottoni, rulli e buzz.
- **Test:** eliminata la spec dei cue Foley; `audio-catalog.spec.ts` non esenta
  più metodi che non esistono. Documentazione e crediti aggiornati
  (`docs/AUDIO-CREDITS.md` descriveva ancora un repository senza file audio):
  ora dice quali file ci sono e quali undici sono ancora nostri.
- Verifiche: **484 test su 55 file**, `tsc` pulito, build di produzione.
  **Non fatto:** ascolto reale; gli undici effetti marcati «Nostra (sintesi
  renderizzata)» restano da sostituire con registrazioni.

## 18 novembre 2026 — La classifica ha il suo ingresso, non un finto gioco

- **`AudioService.setBedLoop(id)`**: classifica e podio non sono giochi, quindi
  non passano più da `setGameBed('LEADERBOARD')`. La TV chiama
  `setBedLoop('classifica')` e `GAME_BEDS` torna a contenere solo tipi che
  esistono davvero; `setGameBed` delega a un unico `applyBed`, così la
  dissolvenza sta in un posto solo.
- **Corretto un bug della regia audio:** la pagina `/audio` passava l'id della
  famiglia a `setGameBed`, che lo trattava come tipo di gioco e ripiegava
  sempre sul pub. Ora usa `setBedLoop`, quindi il pulsante fa sentire davvero
  il loop scelto.
- `closeLeaderboard()` perde la variabile temporanea: una riga sola con
  `isGameOver()` che sceglie fra lobby e musica del round.
- Verifiche: suite frontend **493 test su 57 file**, build di produzione,
  `tsc` pulito. **Non fatto:** ascolto reale.

## 18 novembre 2026 — La classifica suona la sua fanfara

- **Il sesto loop non resta mai muto.** La TV chiede `LEADERBOARD` quando
  mostra la classifica rapida, quella dettagliata, il podio e la classifica
  finale (anche forzata dalla regia): parte la famiglia `classifica` con la
  stessa dissolvenza di 1,5 s. `closeLeaderboard()` riporta il sottofondo al
  gioco aperto; a serata finita, cioè alla classifica finale, va in lobby e non
  sulla musica dell'ultimo gioco.
- **Ripulito il sottofondo del giro precedente:** via il campo `games` (non lo
  leggeva nessuno) e le tre chiavi `LEADERBOARD_QUICK`, `LEADERBOARD_DETAILED`,
  `PODIUM`, ridotte alla sola `LEADERBOARD`; `startAmbient()` non accetta più un
  tipo che nessun chiamante passava; `showPendingLeaderboard()` non duplica più
  i due rami.
- Verifiche: **1 test nuovo** che segue l'ordine delle chiamate (classifica →
  gioco, classifica finale → lobby) e suite frontend **493 test su 57 file**,
  build di produzione. Il test è stato eseguito anche contro il codice vecchio:
  fallisce, quindi copre davvero il ritorno in lobby. **Non fatto:** l'ascolto della fanfara e
  della dissolvenza in sala.

## 18 novembre 2026 — I giochi suonano i sei loop registrati

- **Via i tappeti generati dal vivo.** Il sottofondo non si costruisce più
  battuta per battuta: `bed-loops.ts` mappa ogni gioco su una delle sei
  famiglie registrate (pub, tensione, sport, casino, leggero, classifica) e
  `SoundPlayer.startBed()` mette in onda il file `.m4a` con **dissolvenza
  incrociata di 1,5 s** al cambio gioco. Due round della stessa famiglia non
  staccano: il file continua a girare.
- Il sottofondo si spegne in 0,6 s quando la TV va in pausa o si mette muto. Il
  rotolamento delle Biglie resta un loop a parte, sopra il tappeto sport.
- `/audio` elenca le sei famiglie con il file usato al posto dei sedici profili
  con BPM; il catalogo descrive `ambient` come loop registrato.
- **Test del §7 della spec dei suoni veri** (`audio-assets.spec.ts`): ogni evento
  del catalogo ha almeno un file, ogni file suonato esiste su disco e ha la riga
  in `FONTI.txt`, il peso resta sotto i 15 MB (misurato **11,6 MB** su 48 file) e
  nessun file è in un formato che Safari non legge. Un secondo spec copre la
  mappa gioco → famiglia.
- Verifiche: build di produzione verde, suite frontend **492 test su 57 file**.
  **Non fatto:** l'ascolto dei sei loop a volume di sala, la prova della
  dissolvenza su una TV vera e la verifica su Safari iOS/Chrome Android.
  `bed-profiles.ts` e `audio-dsp.ts` restano in repository: si tolgono al passo
  4 della spec, insieme a Foley.

## 17 novembre 2026 — Biglie: telefono in gara, applausi al traguardo, TV che si ferma

- **Il telefono racconta la corsa.** Durante la fase RACE non c'è più il solo cartello «Gara in corso in TV»: lo stato `BIGLIE_STATE` portava già `lanes` (sedici aggiornamenti al secondo) e il telefono ora li usa. Barra della propria biglia, frazione di percorso, **posizione live** e classifica di gara ordinata per piazzamento (chi è arrivato) e poi per strada fatta, con la propria riga evidenziata. Quando il cartello dei 70 s arriva a zero compare «volata finale»: la gara chiude all'arrivo dell'ultima biglia, non allo scadere.
- **La gara non finisce più in silenzio.** All'arrivo suona `playApplause()` sopra la fine del rotolamento; alla classifica finale applausi più `playPodiumReveal(1)`, la fanfara del vincitore. Erano suoni già in catalogo, mai chiamati dalle Biglie.
- **TV in secondo piano = gara ferma davvero.** `visibilitychange` chiude il loop della corsa (`cancelAnimationFrame`) e spegne il sottofondo, invece di lasciare che il rotolamento continui a suonare mentre i frame sono sospesi. Al ritorno `lastFrame` e l'accumulatore fisico tornano a zero — primo frame a dt 0, nessun salto di tempo — e il sottofondo riparte solo se il via era già stato dato.
- Verifiche: `npm run build:frontend` e suite frontend (482 test su 55 file). **Non verificati:** la resa del telefono in gara e la pausa su una TV vera (l'anteprima con la scheda in secondo piano non avanza), e l'ascolto di applausi e fanfara in sala.

## 17 novembre 2026 — Biglie: corsia personale, rimonte e gara che cambia padrone

- Nuovo sottofondo `loop/biglie.m4a` (24 s, −23 LUFS, coda cucita sulla testa): corpo che scorre, fruscio del fondo e ticchi delle biglie. Non è un campione comprato — lo rende `scripts/audio/render-marble-roll.mjs`, quindi si rifà identico. Riga in `FONTI.txt`, tabella in `docs/MANIFESTO-AUDIO.md`, crediti aggiornati (48 file: 41 effetti, 7 loop).
- Un solo file, otto ascolti: `marble-roll.ts` dà passo e taglio delle alte per ogni pista (la sabbia rallenta e chiude, l'asfalto corre e apre, il vetro resta brillante). `AudioService.startMarbleBed(trackId)` lo accende al VIA, `stopMarbleBed()` lo spegne all'arrivo e fra una gara e l'altra; `SoundPlayer.startLoop` accetta ora `rate` e `lowpass`.
- **Ogni biglia ha la sua corsia**: `createLineCharacter` assegna a ognuna una fetta della pista e `lineOffset` la fa vagare con due sinusoidi di periodo diverso. I percorsi sono diversi, non più la linea della pista seguita da tutte.
- **La velocità non si riscrive più a ogni passo**: ogni biglia ha la sua e si avvicina al bersaglio con l'accelerazione del profilo (`stepSpeed`, `resumeAccel`). A regime il valore è quello di sempre; dopo un fosso o uno scontro è scesa e risalire costa secondi, con la ripresa a metà gas.
- **Il muro costa come un ostacolo** (`wallPenalty`): resta l'82% della velocità su una strisciata, il 60% su un urto secco, con blocco e ripresa frenata.
- **La testa della gara è un posto scomodo.** Chi è davanti non ha scia (`HEAD_WIND`, 5% in meno), la rincorsa pesa più della frenata (`rubberBand` asimmetrica: fino a +32% a chi insegue, −12% a chi scappa) e sull'ultimo tratto (`CLOSING_FROM` 70% di pista, `CLOSING_BOOST` 1,7) il distacco si può ancora ribaltare.
- **Ogni biglia ha spinte e crisi** (`createDrama`): una spinta di 1,2 secondi ogni 6–10, una crisi di 2 secondi ogni 8–13, più un'**onda lunga** di 16–30 secondi che le dà il suo quarto d'ora di gloria e il suo calo. È l'onda che fa cambiare il padrone della gara: nessuna biglia corre più forte in media, ma nessuna è al sicuro.
- **Le schede contano poco sulla pista** (`fieldProfile`, `STAT_SPREAD` 0,45): lo scarto fra una biglia e la media della griglia si assottiglia, così il podio non è scritto alla partenza e anche l'ultimo può vincerla.
- **Simulazione headless** (`race-simulation.ts` + `race-simulation.spec.ts`): stessa pista, stessi ostacoli (`hazard-plan.ts`), stesso passo, stessa rimonta. Otto piste × tre semi × otto biglie, misurate a ogni giro di taratura. Numeri finali: gara più lunga **65,8 s** (sabbia), più corta 47,4 s (vetro); **7–24 cambi di prima posizione** a gara; **92–195 sorpassi**; contatti **1,6–4,4 al secondo** e biglie in contatto per il **10–24%** del tempo — si sentono, non sono la corsa; **21 gare su 24** con una rimonta dalla metà bassa al podio, e almeno una su ogni pista.
- La gara chiude **quando arriva l'ultima biglia**, non allo scadere del tempo: i **70 s** sono il conto alla rovescia sul cartello (misurati 47–66 s) e i **120 s** solo la rete di sicurezza se un bug fermasse una biglia. Crisi e rimonte rallentano, ma non tagliano il traguardo a nessuno.
- Verifiche: build di produzione, suite frontend (481 test su 55 file). **Non fatto:** l'ascolto del loop, la prova in sala, il rimbalzo vero di Matter (la simulazione separa le sovrapposizioni a mano) e la visione della gara in movimento nel browser di anteprima, che con la scheda in secondo piano non avanza.


## 17 novembre 2026 — Biglie: due gare per round, otto piste e suoni d'urto

- Il round Biglie non gioca più quattro gare sulle quattro piste storiche: ogni round corre **due gare** su due delle **otto piste** del catalogo — rally (terra), F1 (asfalto), neve, acqua, **vetro**, sabbia, spazio, magma. La coppia la sceglie il seme della serata: quattro coppie, tutte e otto le piste sui quattro round, nessuna ripetizione. Il piano (seme, coppie, indice del round) è nel checkpoint TV, quindi un refresh rigioca le stesse piste.
- Le gare sono numerate **1–8 nella serata** (1–2 all'atto 2, 3–4 all'atto 3, 5–6 all'atto 4, 7–8 all'atto 5): la TV mostra «GARA 3 / 8» e il telefono legge lo stesso numero dallo stato pubblicato, non più il solo indice di round.
- **Fisica per fondo, non solo colore:** la restitution dei muri viene da `bounce`, l'attrito pesa sulla velocità target e sull'attrito del corpo, la gravità tira la componente verticale della pista e la tenuta la trattiene, i dossi aggiungono jitter deterministico. Prima erano 0,42 e zero gravità per tutte le piste.
- **Ostacoli nuovi** per i quattro fondi nuovi: patche ghiacciate sul vetro, sabbia mobile che rallenta e sbanda, meteoriti solidi che deviano, getti di magma che rallentano e spingono in alto. Palette, cielo e scia seguono il fondo.
- L'ottava pista è **VETRO** e non più ghiaccio: con la neve già in catalogo i due fondi si confondevano. Attrito quasi nullo e rimbalzo alto restano.
- **Suoni d'urto:** quattro campioni nuovi (`marbleHit`, `marbleWall`, `marbleSurfaceHard`, `marbleSurfaceSoft`) passati dallo stesso `scripts/audio/process-audio.mjs` degli altri file; catalogo, mappa file e servizio hanno i nuovi eventi. In `collisionStart` suonano biglia-biglia, biglia-muro/bivio e biglia-superficie, col campione duro su F1 e vetro e morbido sugli altri fondi; sotto la soglia di velocità il contatto resta muto, e le distanze minime evitano le raffiche. Manifesto e crediti passano a 41 effetti e 47 file.
- Testi allineati in `DESCRIZIONE-GIOCO.md`, nei due manuali HTML, nel manuale sul telefono, nelle demo TV, nella nota dei punteggi e nel titolo del round del backend: due gare per round, otto piste col vetro, massimo 300 punti per round di un tavolo.
- Verifiche: build di produzione e suite completa frontend (459 test su 52 file), `process-audio.mjs --check` verde (47 file, tutti con la riga in `FONTI.txt`). **Non fatti:** l'ascolto dei quattro campioni e la prova delle piste su una TV vera a 720p.

## 16 novembre 2026 — Un tappeto musicale per ogni gioco

- Nuovo `bed-profiles.ts`: sedici tappeti, uno per gioco, con tempo, swing, giro di accordi e ruoli strumentali propri — lobby 64 BPM col trio da pub, quiz 96 con marimba e shaker, Bomba 112 che pulsa, Speed Rush 132 con le ottave, Cavallo 116 a galoppo, Casino e Blackjack in shuffle, e gli altri. Generazione deterministica battuta per battuta, nessun file audio.
- `AudioService.setGameBed(tipo)` cambia tappeto al confine di battuta: la battuta in corso finisce com'era, la successiva parte col nuovo tempo, senza stacco. La TV lo chiama all'avvio del round e all'ingresso dei bonus, e torna alla lobby fra i round.
- Nuove voci sintetizzate per i tappeti: marimba a risonatori, shaker, pad detunato, legno; basso, piano elettrico, vibrafono, vetro e spazzole già c'erano.
- La pagina `/audio` ha la sezione **TAPPETI**: un pulsante per profilo, con BPM e durata del giro, per provarli a volume di sala.
- Eliminati `pub-bed.ts` e la sua spec; nuovo `bed-profiles.spec.ts` (7 test su mappatura, determinismo, accordi, gamma e dinamica).
- Misure sul bus master: RMS fra −42,7 e −47,2 dBFS per tutti i tappeti; picchi da −12,8 (quiz) a −28,4 (spiaggia). Nessuna saturazione.
- Verifiche: 451 test su 51 file, build di produzione, sei tappeti suonati su `/audio` senza errori in console. **Nessun ascolto**: la resa in sala resta da giudicare all'orecchio.

## 16 novembre 2026 — Tutti i suoni rifatti con materiali veri

- Nuovo `audio-dsp.ts`: risonatori modali (impulso che eccita banchi di filtri) per gong, campane, gettoni, pallina della roulette, zoccoli, dadi e bicchieri; campane FM; corde pizzicate Karplus-Strong; voci a formanti con vibrato e fiato per il pubblico; pioggia di battimani deterministica; buzzer a onde quadre filtrate e tremolate; ottoni filtrati; coda di stanza generata come risposta all'impulso.
- Rifatti: gong, tick e bong del countdown, tick di classifica, tempo scaduto (ora cicalino vero, sul bus della TV), risposta sbagliata, eliminazione, rivelazione, applauso, gettoni, «uuuh», campana, sirena della Bomba, pallina e atterraggio della roulette, rullo, fanfara e podio, i cinque ingressi bonus, whoosh, conferma ed errore del telefono, battito. **Risposta giusta e ingresso squadra restano com'erano.**
- Il tappeto non è più un giro di pad: trio da pub con basso pizzicato che cammina, piano elettrico in levare swing, spazzole, vibrafono e bicchieri; ciclo sempre di venti minuti, nessun file audio.
- `volume` del catalogo ora agisce davvero su tutte le voci dell'evento (bus per riproduzione, code comprese) ed è usato per bilanciare tempo scaduto, errore, eliminazione, sbagliato, fanfara, podio e battito.
- Livelli misurati sul bus master e riportati in `docs/AUDIO-CATALOGO.md`; nessun evento satura, margine minimo 12 dB.
- Verifiche: 450 test su 51 file, build di produzione, 32 eventi suonati sulla pagina `/audio` senza errori in console. **Nessun ascolto**: timbro e resa in sala restano da giudicare all'orecchio.

## 16 novembre 2026 — Catalogo audio e regia di prova

- `audio-catalog.ts`: 29 eventi con id stabile, etichetta italiana, momento d'uso, fonte (Foley, sintesi, tappeto), bus (TV, telefono, entrambi), volume, distanza minima e varianti. La mappa metodo → evento tiene la compatibilità con tutti i chiamanti esistenti.
- `AudioService.play(evento, variante)` è il punto d'ingresso unico: rispetta il muto, salta i doppioni troppo ravvicinati, applica la rifinitura di volume e dice se ha suonato. Aggiunti anche `setMasterVolume` e `masterVolume`.
- Nuova pagina `/audio` (pulsante **AUDIO** nel pannello admin): un pulsante per evento, varianti per ingressi bonus e posti del podio, muto, volume generale, ferma tutto.
- Inventario dei chiamanti e limiti noti in `docs/AUDIO-CATALOGO.md`.
- Verifiche: 10 test nuovi sul catalogo e sul servizio, suite completa (450 test su 51 file), build di produzione, pagina `/audio` aperta a 1280×720 (29 schede, nessun overflow; clic su «Gong» registrato, nessun errore in console). L'**ascolto** dei suoni non è stato fatto.

## 16 novembre 2026 — Rifiniture del rientro rinominato

- L'avatar segue il nuovo nome: prima la squadra rinominata perdeva la faccia in classifica fino al prossimo invio del telefono.
- L'espulsione cancella la mappa telefono→nome, così lo stesso telefono che rientra con un nome nuovo non trascina i punti rimasti alla squadra espulsa.
- La griglia a tre colonne lascia scorrere il tabellone quando non ci sta più: a 28 squadre le righe si stringono a dieci righe da 54px senza tagli, oltre il tabellone scorre invece di nascondere le ultime righe.
- Verifiche: 6 test nuovi (3 sul servizio avatar, 3 sul componente TV) e suite completa (440 test su 50 file); misura a 1280×720 con 28 squadre sul componente vero.

## 16 novembre 2026 — Rientro con nome diverso e righe fantasma (F12)

- `JOIN_GAME` porta anche il `deviceId`, lo stesso identificativo stabile già usato per la sessione: la TV riconosce il telefono che rientra con un nome nuovo e sposta la squadra invece di crearne una seconda. Palette scelta, palette assegnata, memoria del colore, presenze e punti in classifica seguono il nuovo nome; i punti del round in corso passano al nuovo nome, così il verdetto del round resta corretto.
- Un nome nuovo da un **altro** telefono resta una squadra nuova, con una palette libera e distinta.
- Nella lobby la TV toglie dalla classifica le squadre a zero punti che non risultano più collegate e ne libera le palette: un telefono chiuso non lascia più righe fantasma né colori occupati. Chi ha già punti resta in tabella. La pulizia è tollerante: serve una fotografia che abbia visto la squadra e poi due assenze consecutive, quindi una rilevazione in ritardo non fa sparire chi è appena entrato.
- Verifiche: 10 test nuovi (4 sulla classifica, 2 sul servizio tema, 4 sul componente TV) e suite completa (434 test su 49 file).

## 16 novembre 2026 — Palette di default per squadra: il tema del vincitore si vede (F12)

- Ogni squadra che non sceglie il colore riceve una palette distinta all'ingresso: le sette palette della serata, con l'acido lasciato per l'ottava e il giro che riparte oltre. L'assegnazione resta in `localStorage`, quindi un refresh della TV non cambia i colori delle squadre.
- La scelta fatta dal telefono ha sempre la precedenza e prende il posto della palette assegnata, anche se arriva prima dell'ingresso in partita.
- Il round successivo adotta sempre il tema della squadra che ha vinto: prima, senza una scelta esplicita, la TV restava in acido e il cambio non si vedeva.
- Sui tre posti del podio il nome resta inchiostro: con il tema del round, il colore della squadra finiva sopra un fondo della sua stessa famiglia e spariva (tema OCEANO, contrasto sotto 2,5:1; ora tutti i nomi sopra 4,6:1).
- Le palette assegnate tornano libere quando una squadra viene espulsa **senza punti** e si azzerano del tutto aprendo una partita nuova o confermando il reset: molti rientri non esauriscono più i colori. Chi è espulso con punti resta in classifica e tiene il suo colore. Anche la palette scelta dal telefono viene liberata all'espulsione senza punti, così i colori non si esauriscono mai; la TV ricorda l'ultima palette di ogni nome, anche dopo l'espulsione: al rientro la squadra ritrova il suo colore, e ne riceve uno libero solo se nel frattempo l'ha preso un'altra. La memoria resta in `localStorage` e sparisce con una partita nuova.
- Anche le palette scelte dal telefono si salvano su disco (`pubgame.team-themes`): dopo un refresh della TV le squadre ritrovano il colore senza aspettare che il telefono lo rimandi. Una partita nuova o il reset le cancellano insieme alle altre.
- `forgetIfNoPoints` ora dice se la squadra è stata tolta: la TV usa quella risposta per liberare la palette, senza un secondo controllo sui punti.
- Un rientro con un nome diverso vale come squadra nuova: palette libera e distinta, riga a zero punti, nessuna eredità dal vecchio nome (il messaggio di ingresso non porta un identificativo del telefono).
- Verifiche: 28 test nuovi (17 sul servizio tema, 8 sul componente TV con reset confermato, espulsione con punti e rientro con la stessa palette anche scelta, 3 sulla classifica per il valore restituito) e verifica a 1280×720 con dieci squadre e due vincitori diversi (`docs/screenshots/f12-tema-vincitore-720p.png`, `docs/screenshots/f12-tema-vincitore-anna-720p.png`).

## 16 novembre 2026 — Classifica rapida a due colonne oltre dieci squadre (F09)

- Con più di dieci squadre su TV 720p la classifica rapida comprimeva tutto in una colonna: a 16 nomi ogni riga scendeva a ~34px mentre il testo restava a 16,6px, illeggibile dal fondo della sala.
- A reveal concluso, oltre dieci squadre, il tabellone passa a due colonne: righe da ~94px con 12 squadre e ~69px con 16, nomi e punti a 21,6/23px. L'ordine si legge da sinistra a destra, dal peggiore in alto a sinistra al migliore in basso a destra. Oltre sedici squadre le colonne diventano tre: a 720p diciotto nomi stanno in sei righe da 96px e venti in sette da 81px, mentre a due colonne sarebbero dieci righe da ~55px con l'avatar che sfonda la riga. Fino a dieci resta la colonna singola, che prima funzionava.
- Verifiche: 2 test nuovi (soglia a dieci e classi a reveal concluso) e misura a schermo sul componente Angular vero, con avatar e palette delle squadre, a 1280×720: righe da 94px con 12 squadre, 69px con 16 in due colonne e 96px con 18 / 81px con 20 in tre colonne, nessuna riga fuori dal riquadro, nessun nome troncato. Screenshot in `docs/screenshots/f09-classifica-rapida-12-squadre-720p.png` e `docs/screenshots/f09-classifica-rapida-16-squadre-720p.png`. Suite completa frontend (394 test su 48 file).

## 16 novembre 2026 — Rientro del telefono dopo un refresh (F02)

- Il refresh è una nuova istanza del telefono: sedici test in jsdom simulano il riavvio sullo stesso dispositivo (round aperto, Quiz già votato con risposta lenta e doppio snapshot, sessione scaduta, espulsione, serata aperta, seconda scheda, Musica, Bomba, Timeline con risposta già inviata, senza risposta, con lettura fallita, con risposta arrivata dopo una modifica e con modifica annullata) e sei descrivevano comportamenti che mancavano.
- Timeline: al rientro il telefono non rimanda più l'ordine iniziale, che cancellava quello già scelto e salvato sul server. L'invio automatico resta solo all'avvio del round, dove vale come risposta anche per chi non tocca nulla. Musica e Bomba riaprono il round già bene: la prenotazione e il polling riprendono da soli, e ora hanno un test che lo tiene fermo.
- Timeline dopo un refresh: la risposta sul server conserva anche l'ordine inviato e `GET /games/{id}/timeline-answer` lo restituisce al telefono, che ritrova la sua risposta senza sovrascriverla. Chi non ha ancora risposto riceve `answered: false` e manda l'ordine iniziale, quindi non resta senza invio; le risposte salvate prima di questo campo restano valide, senza ordine da rileggere. Se invece la lettura fallisce il telefono non manda nulla da solo: i tasti restano aperti e si invia solo al primo tocco, perché senza sapere se l'ordine è già sul server l'invio automatico lo sovrascriverebbe. E se la risposta arriva dopo che il giocatore ha già spostato una carta, quella del server è vecchia e viene ignorata: resta l'ordine scelto ora, già inviato dalla modifica. La modifica si segna al primo spostamento, non confrontando gli ordini: chi sposta e rimette le carte come stavano ha comunque scelto, e il server non glielo sovrascrive.
- Quiz: al rientro i tasti si aprono subito, senza aspettare il server. In parallelo una sola richiesta per round e manche legge `/quiz/answers`: se la manche ha già il voto di questa squadra il telefono si blocca con la risposta scelta. Con un server lento si continua a giocare, e un doppio voto resta comunque rifiutato con `already-answered`.
- Sessione scaduta: se il server non riprende la sessione il nome resta pronto ma compare l'avviso. Prima il telefono restava muto e non si capiva se era un'espulsione, una serata chiusa o un problema di rete.
- Espulsione: `sendVote` e `sendBuzz` non partono senza un nome, quindi un tocco residuo su una scheda appena espulsa non arriva più al server come voto anonimo.
- Scheda doppia: risponde solo la prima scheda aperta sullo stesso telefono. Il blocco usa i Web Locks del browser (`ifAvailable`), che si liberano alla chiusura della scheda e vengono ritentati al ritorno in primo piano; il flag `duplicateDisplay` del server (oggi assegnato solo alla TV) alimenta lo stesso avviso. Senza l'API dei lock non si blocca nulla.
- Verifiche: 16 test nuovi sul telefono (suite completa frontend, 392 test su 48 file) e 3 test backend sull'ordine Timeline (suite completa backend, 133 test).

## 16 novembre 2026 — Punti del round e coda classifica al refresh (F06 completo)

- Il verdetto del vincitore del round viveva in memoria: dopo un refresh il tema della TV andava a chi aveva fatto punti solo nella seconda parte. Ora il conteggio sta in storage legato alla partita e all'indice del round, si ricarica quando la TV riprende il round e si cancella quando il verdetto è assegnato (o il round è abbandonato), così non passa a un round successivo.
- La scrittura della classifica è accodata con un debounce di 250 ms: se la TV si ricaricava prima, i punti restavano solo sul dispositivo. Ora la coda viene salvata appena accodata, e al primo stato autorevole la TV la rimanda subito al server; i punti in coda non vengono sovrascritti dalla classifica vecchia dello snapshot.
- Verifiche: 3 test TV nuovi (round recuperato con tema corretto, conteggio di un altro round ignorato, coda rimandata al server) e suite completa frontend (371 test su 48 file).

**F06 è completo**: tutti i round, i bonus, i punti del vincitore e la coda della classifica sopravvivono a un refresh della TV.

### Corretto

- Conteggio del vincitore del round: l'indice viene dalla scaletta (`currentRound - 1`), non più da `round().roundIndex`, che dopo un refresh poteva essere quello della fotografia precedente e faceva salvare o rileggere i punti sul round sbagliato.
- Coda di classifica salvata prima di conoscere la partita: un `gameId` assente non viene più trattato come «partita 0», quindi la coda vale per la partita corrente e viene rimandata al server; una coda di un'altra partita resta in attesa invece di spostare punti su un tavolo diverso.
- Ripresa del conteggio del round: salvataggio e ripresa usano lo stesso indice, quello della scaletta. Se l'avanzamento locale è avanti rispetto al server (round saltati con AVANTI), l'indice dello snapshot è più basso e i punti salvati restavano sotto un altro round.
- Checkpoint TV: anche `tvRoundIndex` prende l'indice dalla scaletta invece che da `round()`, che dopo un refresh è la fotografia precedente. Resta una sola eccezione: se la scaletta è avanti e il server è indietro, si usa l'indice del server, perché un checkpoint con un altro indice viene rifiutato ed era comunque irraggiungibile.

## 16 novembre 2026 — Round Biglie riprendibile (F06 chiuso)

- Il round Biglie salva nel checkpoint TV le biglie assegnate, l'ordine di scelta raggiunto, le gare già chiuse con il tabellone, la classifica cumulata e la fase.
- Al refresh la TV riprende la scelta della biglia dal giocatore giusto, l'ordine d'arrivo già pagato o la classifica finale, senza ripagare nulla: i punti delle gare chiuse sono già in classifica e non vengono rimandati.
- La fisica di Matter.js non è serializzabile a costi ragionevoli: se la TV cade durante una gara, quella gara si rigioca da capo. I suoi punti si pagano una volta sola alla nuova fine, quindi il round resta corretto; cambia solo il risultato di quella gara, che non era ancora stato pagato.
- Round chiuso: il checkpoint viene azzerato, così una nuova Biglie non riapre la finale della precedente.
- Verifiche: 5 test del round e 1 test TV, suite completa frontend (368 test su 48 file).

**F06 si chiude qui**: tutti i round e i bonus sono riprendibili. Restano fuori solo i punti del vincitore del round e la coda di scrittura della classifica, che non sono round.

## 16 novembre 2026 — Canzone riprendibile

- Il round Canzone salva nel checkpoint TV la manche, i secondi rimasti, la pausa fra due ascolti e l'eventuale prenotazione di un tavolo.
- Al refresh la TV riparte dalla manche giusta con il tempo che resta; se la manche era scaduta mentre era via, l'ascolto si chiude e parte la pausa, invece di restare appesa.
- La pausa fra due ascolti riprende dai secondi che mancavano e poi passa alla manche successiva.
- Un brano già rivelato resta pagato: si rivede il brano pulito senza ridare i punti. L'audio riparte dall'inizio della traccia, il conteggio no.
- Con una prenotazione aperta non riparte il cronometro: si aspetta la conferma del presentatore.
- Verifiche: 7 test nuovi sul round e suite completa frontend (362 test su 47 file).

## 16 novembre 2026 — Bonus Cavallo riprendibile

- Il bonus Cavallo salva nel checkpoint TV i voti della categoria, le domande già caricate, il tabellone con le giuste, le risposte della domanda in corso, la fase e il tempo residuo.
- Al refresh la TV riapre il bonus sulla fase salvata: votazione (con i voti già dati), domanda in corso (con la rush che riparte dal tempo rimasto) o reveal già calcolato, che non ridà i punti.
- Se il refresh cade durante il caricamento delle domande, la categoria scelta resta e le domande si richiedono: non si rivota.
- Il finale ricalcola il podio dal tabellone salvato, così i punti si pagano una volta sola alla chiusura del bonus.
- Verifiche: 6 test del bonus e 1 test TV, suite completa frontend (355 test su 47 file).

## 16 novembre 2026 — Blackjack bonus riprendibile

- Il bonus Blackjack salva nello stato Blackjack del server (lo stesso del round) mazzo, carte in mano, banco, tavoli, fase e tempo residuo, a ogni cambio di stato.
- Al refresh la TV riapre il bonus e la mano riparte dov'era: durante la decisione il banco resta coperto, nel reveal si vede l'esito già calcolato senza rigiocarlo.
- I tavoli chiusi prima del refresh tornano alla TV come punti, così la chiusura del bonus paga il totale invece di dimenticare le mani precedenti.
- Chiudere (o pagare) il bonus cancella la mano salvata, così non torna sul tavolo.
- Verifiche: 5 test del bonus e 2 test TV, suite completa frontend (348 test su 46 file).

### Corretto

- Ultima spiaggia: quando il round era già rivelato, dopo il refresh la TV non rimandava lo stato ai telefoni; ora li sincronizza.

## 16 novembre 2026 — Ultima spiaggia riprendibile

- La TV salva nel checkpoint il livello scelto da ogni squadra, le risposte, gli esiti e i livelli consumati, insieme all'id dell'occorrenza: al refresh i telefoni non azzerano la scelta appena fatta.
- Alla ripresa si riparte dalla fase giusta con il tempo che resta: scelta del livello, domanda o reveal.
- Un reveal già avvenuto non ricalcola i punti; se la domanda era scaduta o tutti avevano già risposto, il reveal parte una volta sola.
- Verifiche: 7 test Ultima spiaggia e suite completa frontend (341 test su 45 file).

## 16 novembre 2026 — Azzardo e Tennis battle riprendibili

- Azzardo: fiches, puntate, salvadanaio e conversioni finiscono nel checkpoint TV. Alla ripresa il tavolo è quello di prima, il tempo non riparte da capo e un reveal già avvenuto non ricalcola i punti.
- Tennis battle: campi, punteggi, game, killer point, domanda corrente e sfide in attesa sono nel checkpoint. Chi ha già chiuso il set non riprende i punti e il tempo di battuta scala i secondi passati durante il refresh.
- Tennis battle: alla ripresa la banca delle domande viene riletta dal server, così i tiri non tornano alle sole domande di riserva scritte nel codice.
- Tennis battle: se le sfide erano già tutte decise, il round si chiude subito invece di aspettare il timer generale; se restavano sfide in coda, partono loro senza ripagare quelle chiuse.
- Entrambi riusano il `tvCheckpoint` di Arena, Bomba e Quiz, senza endpoint nuovi.
- Verifiche: 5 test Azzardo, 5 test Tennis e suite completa frontend (333 test su 45 file).

## 16 novembre 2026 — Time Buzzer e guardia sul bonus dell'atto

- Time Buzzer: la TV riprende la manche dal checkpoint (bersaglio, tempi dei telefoni, eliminati, fase) e il via resta quello già salvato sul server, che è idempotente; il cronometro riparte dal tempo che resta.
- Una manche già rivelata non viene ricalcolata dopo un refresh: i punti sono già pagati e restano tali.
- La preparazione interrotta (slot, bersaglio, countdown) riparte dallo stesso bersaglio salvato, senza cambiare il numero ai telefoni.
- Bonus dell'atto: la TV ricorda per partita quali atti ha chiuso e pagato, in storage; uno snapshot ancora `STARTED` non riapre più un bonus già accreditato.
- Verifiche: 5 test Time Buzzer, 1 test TV sulla guardia del bonus, suite completa frontend (335 test su 45 file).

## 16 novembre 2026 — Ruota, Celebrità e bonus dell'atto riprendibili

- Il bonus di fine atto è sul server (`bonus-act`, endpoint `/games/{id}/bonus-state`): la TV segna quando parte e quando si chiude, così un refresh durante la classifica non lo salta più.
- Alla ripresa il bonus ancora avviato si riapre: il Casino dalla manche salvata, Cavallo e Blackjack dall'inizio (l'avanzamento parziale non è salvato); un bonus già chiuso non si ripete.
- Ruota della fortuna: la TV salva lettere uscite e punto del mazzo nel checkpoint. Alla ripresa rimette lo stesso mazzo salvato — l'ordine è casuale, quindi non va ricostruito — e le stesse lettere, poi continua con il tempo che resta.
- Celebrità: il checkpoint tiene sfocatura e indizio raggiunto; foto e indizi restano nel payload, il tempo passato dal salvataggio si ricava da `savedAt` e la soluzione resta nascosta.
- I due round ora risultano riprendibili nella matrice F06, senza un ramo dedicato sul server: usano lo stesso `tvCheckpoint` di Arena, Bomba e Quiz.
- Verifiche: 4 test Ruota, 4 test Celebrità, 3 test TV sul bonus dell'atto, 9 RoundPause e suite complete (329 test frontend su 44 file, backend verde).

## 16 novembre 2026 — bonus Casino riprendibile dopo un refresh

- Il checkpoint TV accetta anche uno stato di bonus, senza round aperto: `mode` che inizia per `BONUS_` viene salvato con `roundKey` dedicata e restituito nello snapshot con `bonus: true`.
- Casino bianco/rosso, dozzina e numero secco salvano voti, punti, tempo del voto e numero uscito: una TV aggiornata riapre la manche invece di offrire solo la chiusura.
- Il numero esce prima dell'animazione e finisce subito nel checkpoint: un refresh non cambia l'esito e non ricalcola i punti.
- Se al refresh il voto era già chiuso, la ruota rigira verso lo stesso numero; se il tempo era scaduto si va diretti alla ruota.
- Alla chiusura del bonus il checkpoint viene cancellato, così un refresh successivo non riapre un bonus già pagato.
- Cavallo, Biglie e Blackjack restano non riprendibili: il loro stato vive solo nella TV.
- Verifiche: 44 test TV (2 nuovi sul checkpoint bonus), 3 test Casino, 8 RoundPause, 47 test frontend sui file toccati.

## 16 novembre 2026 — recupero Arena, Bomba, Quiz e Speed Rush

- La TV salva il tabellone Arena sul server a ogni risposta e penalità, legato al round aperto e con revisione crescente; il reset dimentica il blob.
- Una TV aggiornata durante Arena riapre il round dal checkpoint con il tempo residuo, invece di offrire solo la chiusura.
- Checkpoint di un altro round o con revisione vecchia vengono scartati dal server; un checkpoint non valido riporta la TV al pannello invece di aprire un round vuoto.
- Le risposte Arena arrivate dopo la chiusura del round non assegnano più punti.
- Bomba: il tabellone è già sul server, quindi la TV salva solo la sequenza di eventi applicati; dopo un refresh riprende il round invece di ripartire da zero e non addebita due volte la stessa bomba.
- Un solo checkpoint TV per partita (`tvCheckpoint`, endpoint `/tv-state`), legato alla modalità del round: Arena, Bomba e Quiz usano lo stesso meccanismo invece di campi separati.
- Quiz: la TV riprende la manche in corso con tempo residuo, risposte già date e stadio (gioco, suspense, soluzione), invece di tornare alla prima domanda.
- Il checkpoint Quiz si scrive ai cambi di stato (manche, risposta, scadenza, soluzione, pausa) e non più a ogni secondo: il tempo trascorso si ricava da `savedAt`, e in pausa resta fermo.
- Speed Rush: niente checkpoint TV. Dopo un refresh le corsie si rileggono dal server (`start` è idempotente sullo stesso round), la corsa non viene riavviata e il cronometro riparte dal tempo che resta al round.
- Quiz: i voti sono arbitrati dal server. La TV annuncia la manche, il telefono manda solo l'indice scelto e il server controlla tempo, soluzione e doppio voto, poi trasmette `QUIZ_ANSWER` con i punti; una risposta in ritardo o un doppio voto vengono rifiutati e il telefono resta aperto finché il server non conferma.
- Quiz: le risposte restano sul server (`/quiz/answers`), quindi un refresh della TV non perde quelle arrivate nel frattempo e la TV le rilegge invece di fidarsi solo del checkpoint.
- Quiz: alla ripresa la TV riannuncia la manche con i secondi rimasti, quindi anche dopo un riavvio del backend o a finestra già chiusa i telefoni possono votare; il cronometro non riparte da capo e i punti restano proporzionati al tempo vero.
- Verifiche: 11 test Arena, 4 test Bomba, 17 test Quiz, 5 test Speed Rush, 42 test TV, 7 RoundPause, 8 backend Speed Rush, 10 backend Quiz, 109 test frontend sui file toccati.

## 15 novembre 2026 — scaletta 2.2 e cinque bonus

- Biglie promosse a quattro round separati (3, 5, 11, 22); Blackjack fuori dai round.
- Bomba ridotta a 2, Tennis a 2, Speed Rush a 3; Arena 24/40 e Ultima spiaggia 8/16/23/32/39 invariate.
- Cinque bonus uno per atto: Casino bianco/rosso +100, Blackjack +150/+75, Casino dozzina +120, Cavallo +200/+100/+50, Casino numero secco +300.
- Punti bonus accreditati alla chiusura e classifica finale aggiornata dopo l'atto 5.
- Ingressi TV scenografici dedicati, con `prefers-reduced-motion`.
- Rimosso il flusso Basket residuo da TV, regia e telefono; eliminati punteggi canestri e campi morti.
- Bonus Cavallo riportato a carta e inchiostro: via vetro scuro, gradienti, radius e glow.
- Casino bianco/rosso: i numeri non rossi sono ora bianchi anche su griglia e ruota, con test dedicati.
- La pausa del round è salvata su database: un riavvio del server non perde più l'istante né la deadline spostata.
- Una TV aggiornata durante la pausa ritrova il round fermo e lo riprende con il tempo che era rimasto, senza ripartire contro il server.
- Il telefono non mostra più «Sincronizzazione non riuscita» come testo tecnico: la rete resta sul badge OFFLINE e il primo heartbeat riprova lo snapshot.
- Il badge di connessione usa carta e inchiostro, con mint/mustard/tomato per gli stati, al posto della vecchia pillola scura.
- Timeline sul telefono: le etichette restano dentro le carte anche su schermi da 320×568, senza coprire la riga successiva.
- Arena: il server conserva le penalità cumulative per recuperare una risposta HTTP del tick persa; la TV applica gli incrementi e conserva le penalità ricevute durante la pausa. Il tempo in pausa è accreditato alla ripresa anche senza polling, e una risposta non cancella penalità già maturate. Il refresh della TV durante Arena non ripristina ancora il round (F06).
- Telefono: il riallineamento riconosce un round ancora aperto durante una pausa lunga; in Arena ignora richieste tardive, sospende i tentativi di domanda in pausa e mantiene la stessa risposta per un ritentativo dopo mancata conferma.

Tutte le modifiche rilevanti di PubGame. Formato basato su Keep a Changelog,
versione SemVer.

## [2.1.0] — 2026-11-13

Minor: il gioco Air Hockey Battle diventa **Tennis Battle**, con punteggio da tennis
(0, 15, 30, 40, vantaggio) e killer point dopo tre ritorni dal vantaggio. Il colpo
segue il tempo di risposta dell'avversario. Aggiornate le dipendenze di frontend e
backend all'ultima versione stabile disponibile; TypeScript resta alla 6.x e Spring
Boot alla 4.1.x GA. Documentazione, manuale e guida per l'avvio a casa.

### Aggiunto

- Guida `docs/AVVIO-SERATA-ADMIN.md` per avviare la serata a casa con gli amici.

### Cambiato

- Air Hockey Battle rinominato Tennis Battle (tipo `TENNIS_BATTLE`).
- Dipendenze aggiornate; `jsdom` alla 31.
- Manuale, demo e manuale telefono allineati al Tennis.

---

## [2.0.1] — 2026-11-12

Patch: codice di abbinamento per la regia, ripresa del Blackjack dopo il refresh
della TV e aggiornamento minor delle dipendenze Angular. Documentazione del pannello
admin e del telefono.

### Aggiunto

- Codice di abbinamento regia a 6 cifre: scade dopo 5 minuti, si usa una volta sola
  e blocca il tentativo per 1 minuto dopo 5 errori.
- Ripresa del Blackjack: la TV salva la mano sul server a ogni cambio fase e, dopo
  un refresh nella stessa fase, la riprende.
- `docs/PANNELLO-ADMIN.md`: guida ai pulsanti e alle decisioni del pannello admin.
- `docs/MANUALE-TELEFONO.md`: guida per le squadre.
- `docs/PRESENTATORE.md`: guida operativa di chi conduce — schermi, abbinamento
  della regia, pre-volo, un round passo per passo, giochi simultanei,
  imprevisti e chiusura.

### Modificato

- Dipendenze Angular aggiornate alle ultime minor 22.2.x (CLI e build 22.2.7,
  TypeScript 6.0.3). Nessun cambio di major. `npm audit`: 0 vulnerabilità.
- `PRESENTAZIONE-PUBGAME.md`: etichette dei pulsanti admin allineate al pannello
  reale (PARTI, PROSSIMA MANCHE, DEMO, CHIUDI BONUS).
- Punteggi del copione allineati a `SCORING_RULES` (Quiz, Musica, Timeline,
  Bomba, Speed Rush, Cavallo) e nota esplicita che Speed Rush e Bonus Basket
  sono bloccati in serata reale e che i bonus non entrano in classifica.
- `MANUALE-TELEFONO.md` corretto sul flusso vero: niente codice a 6 cifre sul
  telefono (è della regia), ingresso con QR e nome squadra.

### Corretto

- Pannello admin senza codice TV: l'avvio si fermava e sembrava il backend spento.
  Ora compare il riquadro **🔒 REGIA NON ABBINATA** con campo a 6 cifre e pulsante
  **ABBINA REGIA**, mentre diagnostica e categorie si caricano lo stesso.
- La View Transition del primo caricamento non viene più avviata: spariva un
  `InvalidStateError` in console a ogni apertura di TV, admin e telefono.
- Skin carta e inchiostro per categorie, diagnostica e comandi del pannello
  admin: via i riquadri blu/viola, i raggi 8–14px e le pillole del vecchio tema.
- Telefono: i tasti di Speed Rush non sono più bianco su bianco, la mano di
  Blackjack e il goal di Air Hockey usano i token della palette.
- Versione **2.0.1** su `VERSION`, root, frontend e backend; README allineato a
  29 spec frontend e 18 classi di test backend.

## [2.0.0] — 2026-11-12

Seconda major: la serata si prepara e si controlla prima di accendere la TV. Il
audio non lascia più code accese, i telefoni si riagganciano appena tornano
visibili e il repository tiene solo il codice.

### Aggiunto

- `GET /health`: sonda di salute senza autenticazione, per Docker e per il
  controllo a freddo prima di una serata.
- `docs/SERATA-PROVA.md`: programma della prima serata con telefoni veri (ruoli,
  tempi, prove di caduta, cosa annotare, emergenze).
- `docs/FIX-PRE-SERATA.md`: ordine delle fix prima e dopo la serata, con criteri
  di accettazione.
- Riconnessione immediata su `visibilitychange` e `online`: telefono sbloccato o
  Wi-Fi tornato, la socket riparte senza aspettare il backoff.
- Prima CI (`.github/workflows/ci.yml`): build e test frontend, test backend e
  simulazione corta con 8 giocatori, su ogni push.
- `HEALTHCHECK` nel `docker-compose.yml` e tag immagine da `PUBGAME_TAG`, per
  tornare alla versione precedente con un comando.
- `npm run db:backup`: copia il database in `backups/` con data e ora (cartella
  fuori dal repository).
- `ROUNDS_MODE=serata` nel pilota di simulazione: gioca i 40 round nell'ordine
  vero di `ACT_DECKS`, non più i 13 di esercitazione.
- Se `ALLOWED_ORIGINS` contiene `*` il backend lo segnala a `WARN` all'avvio.

### Corretto

- Il clock della TV non somma più intervalli: `startClock()` spegne il tick
  precedente, quindi il ticchettio non resta acceso per tutta la serata.
- La pausa ferma davvero clock e battito; la ripresa li riapre nella stessa
  fase.
- Rimossi sette file mp3 identici e mai referenziati (600 KB di doppioni):
  l'audio resta interamente sintetizzato.

### Cambiato

- I report e i log delle simulazioni (`scripts/sim/reports/`) **escono dal
  repository** (~13 MB): restano su disco, la history passata non è riscritta.
- Versione **2.0.0** su root, frontend e backend; README aggiornato con le
  sezioni Audio e Serata di prova.

## [1.0.0] — 2026-11-09

Prima major: la serata si recupera dopo un refresh e gli ambienti di prova e
pub sono separati.

### Aggiunto

- Recupero della TV dopo refresh o cambio dispositivo: `GET /games/active`,
  snapshot autorevole della classifica (`PUT /games/{id}/leaderboard`) e
  pannello "Round ripristinabile" con ripresa per Timeline e chiusura esplicita
  per gli altri giochi.
- Persistenza della classifica con debounce, retry e `keepalive` alla chiusura
  della scheda.
- Ambienti `test-night` e `production`: build Angular con file replacement,
  profili Spring Boot dedicati e modelli `.env.*.example`.
- QR di aggancio generato in locale e legato all'ID della partita. Il telefono
  legge `?game=` e, senza QR, chiede al server la partita attiva.
- PWA installabile su iPhone e Android: manifest con `id`, orientamento
  verticale e service worker attivo anche nella build di produzione.
- `docs/DEPLOYMENT.md`: flusso serata di prova, produzione, hosting, dominio,
  PWA, backup e checklist.

### Corretto

- La TV non sovrascrive più i punti locali non ancora confermati dal server.
- Il QR non dipende più da `api.qrserver.com`: funziona senza internet.
- Speed Rush resta bloccato finché il punteggio non è verificato dal server.

### Note

- Richiede `CONTROL_SECRET` (almeno 32 caratteri) e `ALLOWED_ORIGINS` esatte.
- Backup di `apps/backend/data` prima di aggiornare una serata in corso.
