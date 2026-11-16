# Changelog

## 16 novembre 2026 — Palette di default per squadra: il tema del vincitore si vede (F12)

- Ogni squadra che non sceglie il colore riceve una palette distinta all'ingresso: le sette palette della serata, con l'acido lasciato per l'ottava e il giro che riparte oltre. L'assegnazione resta in `localStorage`, quindi un refresh della TV non cambia i colori delle squadre.
- La scelta fatta dal telefono ha sempre la precedenza e prende il posto della palette assegnata, anche se arriva prima dell'ingresso in partita.
- Il round successivo adotta sempre il tema della squadra che ha vinto: prima, senza una scelta esplicita, la TV restava in acido e il cambio non si vedeva.
- Sui tre posti del podio il nome resta inchiostro: con il tema del round, il colore della squadra finiva sopra un fondo della sua stessa famiglia e spariva (tema OCEANO, contrasto sotto 2,5:1; ora tutti i nomi sopra 4,6:1).
- Le palette assegnate tornano libere quando una squadra viene espulsa **senza punti** e si azzerano del tutto aprendo una partita nuova o confermando il reset: molti rientri non esauriscono più i colori. Chi è espulso con punti resta in classifica e tiene il suo colore; la palette scelta dal telefono resta comunque della squadra.
- `forgetIfNoPoints` ora dice se la squadra è stata tolta: la TV usa quella risposta per liberare la palette, senza un secondo controllo sui punti.
- Verifiche: 17 test nuovi (9 sul servizio tema, 5 sul componente TV con reset confermato ed espulsione con punti, 3 sulla classifica per il valore restituito) e verifica a 1280×720 con dieci squadre e due vincitori diversi (`docs/screenshots/f12-tema-vincitore-720p.png`, `docs/screenshots/f12-tema-vincitore-anna-720p.png`).

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
