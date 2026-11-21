# PubGame — Brainstorming per la prossima serata

**Data:** 21 novembre 2026

**Punto di partenza:** versione 2.2.0, README aggiornato e pushato (`3c6d2b97`).

**Cosa è questo documento:** una raccolta di idee, non una roadmap approvata. Niente di ciò che segue è stato implementato.

## Come l'ho impostato

Ho letto il README aggiornato, il registro `docs/ROADMAP-POST-PRIMA-SERATA.md` (F01–F46), il report della prima serata e le regole di stile in `AGENTS.md`. Le idee provano a rispondere a tre domande:

1. **Cosa ha già funzionato** e merita di essere protetto.
2. **Dove la serata si inceppa** per il pubblico, per il presentatore o per il locale.
3. **Cosa può diventare un prodotto**, non solo una feature.

Ogni proposta grafica dovrà usare i token esistenti (`--paper`, `--coal`, `--acid`, `--tomato`, `--mustard`, `--cobalt`, `--mint`), Anton/Space Mono, radius 0, bordi pieni e ombre offset. Niente palette nuove, niente glass, niente neon.

## La bussola: cosa rende PubGame diverso

PubGame non è un quiz online con una TV appesa. È un **rituale da pub**: la TV è il tabellone condiviso, il telefono è la pulsantiera, il presentatore è il maestro di cerimonia. Il valore sta nel far giocare insieme persone allo stesso tavolo, non nel tempo passato sullo schermo.

**Cosa tenere stretto:**

- L'ingresso senza app e senza account, con QR e nickname.
- La divisione dei ruoli: TV = spettacolo, telefono = input, regia = conduzione.
- I momenti che la sala ha già premiato: **Speed Rush**, **Biglie**, **Casino**, **Blackjack**, **Ruota**.
- La grafica carta/inchiostro: rende il gioco riconoscibile e non sembra l'ennesima dashboard.
- Il fatto che i premi del bar restino fisici, consegnati da barista e presentatore.

**Dove si rompe l'incantesimo:**

- Turni lenti e attese senza suspense (Bomba, alcune manche di Arena).
- Regole che vanno spiegate due volte (Azzardo, Cavallo).
- Dispositivi fragili: iPhone/Safari, vibrazione assente, drag poco leggibile.
- Il presentatore che diventa un operatore di computer invece di uno showman.
- Una serata da 3–4 ore che per un pub normale è troppo lunga.

## Le cinque scommesse

### 1. Due formati, non uno: Classic e Sprint

Oggi la scaletta è una sola: **40 round, 5 atti, 3–4 ore**. È il formato giusto per una serata evento, ma taglia fuori i pub che vogliono un gioco da **90 minuti** tra cena e chiusura.

**Proposta:** lo stesso motore, due scalette.

| Formato | Durata | Round | Bonus | Uso |
|---|---|---|---|---|
| **Classic** | 3–4 ore | 40 (5 atti × 8) | 5 | Serata evento, festa, torneo |
| **Sprint** | 75–90 min | 25 (5 atti × 5) | 3 | Pub normale, dopo cena, prova |
| **Private** | 45–60 min | 15 (3 atti × 5) | 2 | Compleanni, aziende, addii |

La scaletta resta configurabile da `schedule.ts`, ma il formato diventa un parametro di partita. La TV mostra l'atto e il tempo previsto; la regia può saltare un gioco senza rompere le classifiche.

**Perché conta:** allarga il mercato senza toccare le regole dei giochi. È la feature con il miglior rapporto valore/rischio.

**Rischio:** cambiare la scaletta cambia il bilanciamento dei punti. Va deciso prima se i punti sono “per serata” o “per formato”.

### 2. La regia mobile: il presentatore deve poter condurre dal telefono

Il pannello `/admin` è potente ma desktop-oriented. In sala il presentatore vuole muoversi, guardare i tavoli, non stare dietro un laptop.

**Proposta:** una modalità **Regia Mobile** con quattro soli comandi grandi:

- **PARTI / AVANTI** (con conferma se il round è aperto).
- **PAUSA / RIPRENDI**.
- **CLASSIFICA**.
- **EMERGENZA**: salta round, assegna punti manuali, espelli squadra.

Sotto: stato del round, timer, numero di risposte ricevute, un indicatore “tutto ok / qualcosa non torna”. Il pannello completo resta su desktop per configurazione e diagnosi.

**Perché conta:** riduce il carico mentale e gli errori da tastiera. È anche il modo più semplice per far condurre la serata a un barista non tecnico.

**Da non fare:** un’app nativa. Una pagina `/regia` responsive con WebSocket e token admin è sufficiente.

### 3. Timer e punti sul server, per tutti i giochi

Il limite noto è che alcuni timer vivono sul client. In sala significa che un telefono lento, una scheda in background o un refresh possono cambiare l’esito.

**Proposta:** un **Round Clock Service** unico:

- Il server apre il round e fissa `startedAt`, `deadline`, `phase`.
- TV e telefoni leggono lo stesso orologio, con correzione del drift.
- Le risposte arrivano con timestamp server, non con `performance.now()` del telefono.
- Ogni fase (spin, countdown, running, reveal) è un evento persistito.
- La pausa sposta la deadline di tutti, non solo della TV.

**Perché conta:** è la precondizione per replay, undo, classifica affidabile e serate con dispositivi diversi. Rende anche possibile un “arbitro” automatico quando il presentatore è occupato.

**Costo:** alto. Tocca ogni modalità. Va fatto per gradi, partendo da Time Buzzer, Arena e Speed Rush, che sono i più sensibili.

### 4. Cavallo 2.0: da bonus rotto a gioco vero

Il Cavallo non ha funzionato: categoria non vista, voti scartati, domande a tutti. Ma l’idea è forte: un bonus collettivo, veloce, con una corsa simbolica.

**Proposta:** rifarlo come **gioco a squadre, non a voti**.

1. La TV estrae tre categorie; i telefoni votano con un tap (nomi normalizzati, niente match esatto).
2. La categoria più votata parte; in caso di pari, decide il presentatore.
3. Otto domande flash, **stesse per tutti**, una alla volta.
4. Ogni risposta giusta fa avanzare il cavallo della squadra su una pista a 8 caselle.
5. Vince chi arriva primo; a pari merito, chi ha risposto prima all’ultima domanda.
6. Premio del bar, nessun punto in classifica.

**Perché conta:** trasforma un fallimento in un momento spettacolare, senza inventare un nuovo motore: riusa domande, telefoni e pista.

### 5. La serata come prodotto: kit, sponsor, campionato

PubGame può restare un progetto personale, ma ha già la forma di un prodotto per locali.

**Tre livelli:**

- **Kit Serata:** mini PC, router, HDMI, cassa audio, tablet di regia, QR da tavolo, manuale stampato, telefono di scorta. Prezzo una tantum + assistenza.
- **Abbonamento Locale:** scalette illimitate, aggiornamenti, domande locali, logo del pub, supporto la sera.
- **Campionato:** sei serate, classifica cumulativa, finale con premio. Il locale riempie il martedì.

**Sponsor:** un round o un bonus può essere “offerto da” un marchio locale. La TV mostra il logo per 5 secondi, senza interrompere il gioco. Il report a fine serata dice quante persone hanno visto il round.

**Attenzione:** lo stile grafico non deve diventare una concessionaria di loghi. Lo sponsor vive in una **fascia dedicata**, con la stessa tipografia e gli stessi bordi, mai sopra il gioco.

## Idee per la serata

Queste non richiedono un nuovo motore di gioco. Sono rituali, pause e momenti di sala che possono essere aggiunti senza toccare i punteggi principali.

### Prima del primo round

- **L'apripista (90 secondi).** Ogni tavolo carica la foto e sceglie una previsione: "arriviamo nei primi tre", "vinciamo il bonus", "facciamo ridere il presentatore". La TV mostra i tavoli a rotazione, come un tabellone di benvenuto. Serve a rompere il ghiaccio e a testare le foto prima del gioco vero.
- **Il patto della serata.** Tre regole lette in 20 secondi, una per schermata: si può sbagliare, si può chiedere aiuto al tavolo, il telefono si tiene in mano solo quando la TV lo chiede. Riduce le domande durante i round.
- **La prova del pulsante, ma divertente.** Invece del tutorial tecnico, una mini-sfida di 15 secondi: "tocca il più veloce", "trascina la carta", "vota". Chi finisce entra in classifica di prova, che non conta. Il test resta obbligatorio solo per chi non lo completa.

### Durante la serata

- **Il Jolly del tavolo.** Una volta per serata, una squadra può dichiarare un Jolly prima di una domanda: se risponde giusto prende il doppio, se sbaglia paga il doppio. Va dichiarato a voce o con un tap prima che la TV mostri la domanda. Crea tensione senza cambiare le regole del gioco.
- **La missione segreta.** Ogni tavolo riceve una missione comica non obbligatoria: far dire al presentatore una parola, far ridere il tavolo accanto, usare tre volte "secondo me". Il presentatore assegna un gettone simbolico, non punti. Serve a tenere vivi i tavoli che stanno perdendo.
- **Il tavolo del pubblico.** Un QR separato per chi non gioca: il pubblico vota la risposta più divertente o pronostica il vincitore. Non entra in classifica; la TV mostra il risultato come curva. È un esperimento a basso rischio, ma richiede moderazione.
- **La rivincita degli eliminati.** Quando un gioco elimina presto metà sala (Bomba, Arena), i tavoli fuori gioco hanno una sfida lampo da 3 minuti: indovinelli, foto, "chi è?" con le foto dei tavoli. Non assegna punti alla classifica principale. Evita che chi perde smetta di guardare.
- **La pausa ordinazioni.** Un timer di 8 minuti in TV, con il menu del pub e un codice per ordinare. Non è pubblicità: è un respiro. Il presentatore annuncia il rientro con un conto alla rovescia. Da usare solo se il locale ha un sistema di ordinazione o personale sufficiente.
- **Il muro delle foto.** Le foto facoltative delle squadre diventano una galleria a fine serata, con la foto più votata. Moderazione obbligatoria e consenso esplicito: niente foto di minori senza autorizzazione.
- **I record del pub.** La TV mostra il record della serata e il record storico: punteggio più alto, Speed Rush più veloce, primo perfetto al Time Buzzer, tavolo che ha resistito più a lungo alla Bomba. I record storici richiedono una classifica persistente per locale.
- **La finale rubabandiera.** Se le prime due sono vicine, invece di chiudere con la classifica si gioca una sfida secca da 5 minuti: 5 domande, risposta più veloce, la prima che arriva a 3 punti. Solo per serate evento, non per il formato Classic standard.
- **La serata a tema.** Skin già previste (Natale) e altre possibili: Halloween, Sanremo, derby locale, festa del paese. Il tema cambia colori e suoni, non le regole. Va progettato come variante dei token, non come CSS parallelo.

### Dopo la serata

- **Il biglietto della serata.** Un QR a fine gioco porta alla classifica finale e alla foto del tavolo. Serve a far girare il locale sui social senza trasformare la serata in una gara di like.
- **Il prossimo appuntamento.** La TV chiude con la data della prossima serata e il formato (Classic, Sprint, Campionato). Chi ha giocato sa quando tornare.

## Idee per gioco

Queste sono modifiche o varianti dentro le modalità esistenti. Non tutte vanno fatte: servono a scegliere dove investire.

### Quiz

- **Rubata:** se la squadra sbaglia, la successiva può rubare la risposta a metà valore. Aggiunge suspense, ma allunga il round.
- **Domanda del pubblico:** una domanda su un fatto del locale o della serata, non sulla banca. Va preparata dal presentatore e validata.
- **Difficoltà dichiarata:** la TV mostra "facile / media / difficile" e il valore prima della risposta. Rende leggibile il rischio.

### Indovina la canzone

- **Duello di generi:** due squadre scelgono un genere, la TV pesca dal genere più votato. Richiede una banca per genere.
- **Testo o anno:** alternative al titolo, per chi non riconosce la voce. Aumenta l'accessibilità.
- **Manche a sorpresa:** la quarta manche è un frammento di 5 secondi, non 30. Crea un picco di difficoltà.

### Indovina chi

- **Indizi vocali:** oltre alla foto, un indizio letto dal presentatore. Richiede tempo e copione.
- **Volti locali:** il sindaco, il barista, la squadra del paese. Divertente, ma va gestito con consenso e diritti.
- **Sfocatura progressiva più rapida:** per il formato Sprint, 30 secondi invece di 60.

### Ruota della fortuna

- **Frase del pub:** il presentatore inserisce una frase personalizzata (nome del locale, motto, piatto del giorno). Va validata per lunghezza e caratteri.
- **Indovinello invece di frase:** per il pubblico più giovane. Stesso motore, contenuto diverso.

### Timeline

- **Eventi locali:** storia del paese, del pub, della squadra di calcio. Forte identità, ma richiede una banca locale.
- **Sei carte per Sprint:** meno lettura e meno drag, stesso formato.
- **Categoria dichiarata:** sapere se si ordina storia, musica o cinema aiuta a contestualizzare.

### Time Buzzer

- **VIA più chiaro:** un segnale TV + telefono + audio nello stesso istante. Il problema non è il timer, è la percezione del via.
- **Solo reazione:** una variante senza bersaglio, in cui si ferma il cronometro dopo un segnale luminoso. Più semplice per il pubblico.
- **Buzzer di squadra:** un solo telefono per tavolo, premuto a turno. Riduce i telefoni ma aumenta la discussione.

### Bomba

- **Esplosione immediata:** chi sceglie la bomba lo scopre subito, non a fine ondata. È già F25, ma è la modifica che cambia il ritmo.
- **Turni da 10 secondi:** un timer visibile sul telefono e in TV. Se scade, la bomba passa o esplode.
- **Passa la bomba:** una variante in cui la casella giusta passa il turno al tavolo successivo, quella sbagliata esplode. Più veloce del tabellone attuale.
- **Tabellone più piccolo:** 12 caselle invece di 15 per il formato Sprint.

### Tennis Battle

- **Prima la fix:** il round non è mai partito per il vincolo H2. Nessuna variante prima di F39.
- **2 contro 2:** due telefoni per lato, risposta alternata. Richiede gestione del turno.
- **Tie-break:** a 5–5, una sola domanda decide il set. Riduce la durata.

### Ultima spiaggia

- **Tabellone dei livelli in TV:** mostra quali livelli ha già consumato ogni squadra. Oggi il telefono lo sa, la sala no.
- **All-in:** una volta per serata, una squadra può giocare il livello 500 anche se l'ha già usato, ma paga doppio in caso di errore. Rischio puro, da bilanciare.
- **Tre livelli per Sprint:** 100/300/500, per ridurre la durata.

### Azzardo

- **Tutorial di 10 secondi:** "scegli risposta → aggiungi fiches → conferma", con un esempio animato. È il gioco che ha confuso di più.
- **Fiches prestabilite:** 1, 3, 5 fiches invece di un contatore. Un tap, non una decisione astratta.
- **Una sola manche:** per il formato Sprint, una manche con 10 fiches e quota ×2. Più leggibile.
- **Annulla prima della conferma:** si può tornare indietro finché non si conferma. Oggi il confine tra "sto puntando" e "ho puntato" non è chiaro.

### Arena

- **Cerchio più leggibile:** restringimento più lento e prima, con una fascia colorata che dice "zona sicura".
- **Recupero:** chi è fuori può tifare o scommettere su un finalista, senza rientrare. Richiede un ruolo per gli eliminati.
- **Round più corto:** 60 secondi per Sprint, 120 per Classic.
- **Spettatore mode:** la TV mostra la domanda anche a chi è eliminato, così il pubblico segue.

### Speed Rush

- **Nuovi microgiochi:** il gioco è piaciuto tantissimo; la varietà è il modo più sicuro per migliorarlo. Aggiungere 2–3 tipi, non 20.
- **Corsia a staffetta:** ogni squadra corre una frazione, poi passa il testimone a un altro telefono. Richiede più telefoni per tavolo.
- **Tracciato più lungo:** già F38; da calibrare con la durata di 90 secondi.
- **Commento del presentatore:** una riga di telecronaca generata dai dati ("Anna sorpassa Bruno all'ultima curva"). Divertente, ma va scritta a mano per evitare frasi sbagliate.

### Biglie

- **Scommessa degli eliminati:** chi è fuori dalla corsa può puntare su una biglia, con punti simbolici fuori classifica. Tiene viva l'attenzione.
- **Photo finish:** la TV mostra il distacco in pixel o millisecondi. Richiede dati dalla fisica.
- **Voto della pista:** i telefoni scelgono la pista della seconda gara. La scelta della biglia resta fissa.
- **Replay lento:** a fine gara, 5 secondi di replay sul sorpasso decisivo. Richiede registrazione della posizione.

### Blackjack

- **Torneo a tabelloni:** quattro tavoli, due semifinali, una finale. Più spettacolo, più durata.
- **Decisione a tempo:** 10 secondi per carta o stai, con countdown in TV. Oggi il turno può sembrare fermo.
- **Banco animato:** la carta coperta si apre con suspense, non con un flip istantaneo.

### Cavallo

- Vedi la scommessa 4: rifarlo come gioco a squadre con cavalli che avanzano. È l'unico bonus che oggi va ripensato, non solo corretto.

## Nuovi bonus e formati

Idee più sperimentali, da provare in una serata di test prima di metterle in scaletta. Ognuna deve dichiarare punti, durata e caso "non risposta".

- **L'asta.** Prima di una domanda, le squadre offrono punti per il diritto di rispondere. Chi offre di più rischia quei punti: giusto li vince, sbagliato li perde. È il meccanismo di rischio puro che oggi manca, ma va bilanciato con la classifica.
- **Il traditore.** Un tavolo riceve una missione segreta: far sbagliare una risposta a un altro tavolo o far dire una parola al presentatore. Non toglie punti; assegna un gettone. Richiede moderazione e attenzione a non creare conflitti.
- **La catena.** Ogni squadra deve dire una parola che inizia con l'ultima lettera della precedente, a tempo. Funziona meglio come intermezzo che come round.
- **Karaoke lampo.** Il telefono mostra 5 secondi di una canzone; la squadra canta il verso. Divertente, ma richiede diritti musicali e un microfono. Da fare solo con contenuti liberi.
- **Poker di risposte.** Ogni squadra distribuisce tre gettoni su tre possibili risposte, come una scommessa. È l'Azzardo semplificato, senza numeri.
- **Caccia al QR.** Codici sparsi nel locale da scansionare per ottenere indizi. Muove le persone, ma rompe il ritmo e richiede spazi grandi. Solo per serate private.
- **La sfida del barista.** Il barista prepara un cocktail o un piatto e la sala deve indovinare ingredienti o nome. Unisce il locale al gioco, ma richiede preparazione e tempi di servizio.
- **Il bonus dello sponsor.** Un round offerto da un marchio locale, con una domanda sul marchio e un premio fisico. Va trattato come contenuto pubblicitario: massimo 30 secondi, nessun punto in classifica.
- **Minigiochi tra i round.** L'idea è già in roadmap: 60 secondi, nessun punto, un solo telefono per tavolo. Servono a respirare tra due giochi pesanti, non a riempire.

## Regia e operazioni

La differenza tra una serata bella e una serata faticosa è quasi sempre la regia, non il gioco.

- **Run of show.** Una checklist con tempi previsti per ogni atto: apertura, 8 round, classifica, pausa, bonus, chiusura. La regia vede il tempo reale e il ritardo accumulato.
- **Regia mobile.** Quattro pulsanti grandi, stato sintetico, undo. Vedi la scommessa 2.
- **Pulsante panico.** Ferma tutto, salva lo stato, mostra "cosa fare ora" e un numero di telefono. Non deve cancellare la partita.
- **Salta e rimborsa.** Se un gioco si blocca, la regia può saltarlo e assegnare i punti "come se" fosse finito, con una nota nel report. Serve a non rovinare la serata per un bug.
- **Prova generale con i bot.** Otto telefoni simulati che giocano un round alla volta, a velocità 10×. Serve a scoprire blocchi, timer e stati mancanti prima della sala.
- **Health check prima delle porte.** Un pannello unico: TV raggiungibile, admin raggiungibile, WebSocket, DB, audio, telefoni connessi, batteria dei device, backup fatto.
- **Kit di emergenza.** Hotspot, HDMI di scorta, cavo audio, tablet di regia, telefono di scorta, batteria portatile, chiavetta con la serata. Non è software, ma salva la serata.
- **Regia a due.** Presentatore e tecnico con ruoli separati: il presentatore parla, il tecnico guarda lo stato. Il pannello dovrebbe avere una modalità "solo stato" per il tecnico.
- **Report di fine serata.** Durata per round, risposte ricevute, riconnessioni, domande saltate, punti assegnati, tavoli attivi. Serve a migliorare la scaletta, non a sorvegliare le persone.
- **Serata clone.** Una copia della serata in staging con gli stessi contenuti, per provare una modifica senza toccare il database vero. La roadmap lo chiede già per Tennis; vale per tutto.

## Tecnica: le scommesse che rendono il resto possibile

- **Round contract.** Ogni modalità dichiara fasi, durata, input ammessi, punti e casi di errore in un unico schema. La regia e la TV si adattano senza codice speciale per gioco.
- **Server clock.** Un solo orologio per round, con deadline e phase persistite. Vedi la scommessa 3.
- **Event log e replay.** Ogni round è una sequenza di eventi: apertura, risposta, reveal, chiusura, punti. Con il log si può ricostruire, annullare e spiegare una serata.
- **Idempotenza delle risposte.** Una risposta inviata due volte non deve contare due volte; una risposta arrivata dopo la deadline deve essere rifiutata con un messaggio chiaro.
- **Recupero sessione.** Oltre al token, un codice a 4 cifre o un link magico per rientrare se il browser perde lo storage. È il punto F02, ancora parziale.
- **E2E multi-dispositivo.** Playwright con 4 telefoni simulati, rete rallentata, refresh TV a metà round, perdita di connessione. Oggi la suite è quasi tutta jsdom.
- **Osservabilità.** Metriche per round: latenza, riconnessioni, risposte mancate, tempo di reveal, errori. Un cruscotto per la regia, non per il pubblico.
- **Load test.** 30 telefoni e 1 TV su una serata simulata, con memoria e CPU del container. Serve a capire se il formato 10 tavoli regge.
- **Qualità dei contenuti.** 447 domande mancanti per Ultima spiaggia e solo 3 eventi Timeline di difficoltà 5: la banca va completata prima di aggiungere giochi. Il calibratore può usare le risposte reali per ricalibrare la difficoltà, senza cambiare i testi.
- **Scaletta configurabile.** Formati Classic/Sprint/Private come dati, non come fork del codice. La regia sceglie il formato all'apertura della partita.
- **Accessibilità.** Contrasto, dimensione del testo, modalità senza vibrazione, nessun movimento indispensabile. Non è un tema estetico: è la differenza tra chi gioca e chi guarda.
- **Internazionalizzazione.** Italiano prima, inglese per turisti e serate aziendali. Le domande restano nella lingua della banca; l'interfaccia si traduce.
- **Sicurezza.** Rate limiting sulle sessioni, recupero nickname assistito, revoca delle sessioni, rotazione del segreto. Oggi un partecipante può prenotare il nickname di un altro.
- **Migrazioni di database.** Ogni modifica allo schema va provata su una copia nata prima del rename, non solo su un DB nuovo. Tennis è l'esempio da manuale.

## Prodotto e business

- **Kit Serata.** Hardware + software + materiali stampati. È il modo più semplice per vendere a un pub che non vuole pensare a un PC.
- **Abbonamento Locale.** Serate illimitate, aggiornamenti, domande locali, logo del pub, supporto serale. Prezzo mensile, non per giocatore.
- **Campionato.** Sei serate, classifica cumulativa, finale. Il locale riempie una serata fissa della settimana; PubGame diventa un appuntamento.
- **Serate private.** Compleanni, aziende, addii: domande personalizzate, logo, foto, formato breve. È il segmento con il prezzo per serata più alto.
- **Sponsor locale.** Un round offerto da un marchio, con logo in una fascia dedicata e report finale. Va venduto come visibilità, non come interruzione.
- **Formazione presentatore.** Un manuale operativo e una mezza giornata di prova. Riduce il rischio che la serata dipenda da una sola persona.
- **Franchising.** Più locali con lo stesso marchio, classifica di circuito, materiali comuni. Richiede un backend multi-tenant, non è un progetto da weekend.
- **Pricing.** Tre ipotesi da testare: 49–79 € per serata, 199–299 €/mese per locale, 1.500–3.000 € per il kit completo. Sono ipotesi, non prezzi validati.

## Priorità: cosa farei, in che ordine

| Orizzonte | Cosa | Perché |
|---|---|---|
| **Ora** | F01, F02, F13, F16, F31, F39; decisione Cavallo; tutorial Azzardo; esplosione Bomba | Sono i punti che hanno rotto o confuso la prima serata. Senza questi, ogni nuova idea parte su una base fragile. |
| **Prossimo** | Regia mobile; formato Sprint; timer server per Time Buzzer/Arena/Speed Rush; E2E multi-dispositivo; banca Ultima spiaggia | Riducono il carico del presentatore e allargano il mercato senza cambiare i giochi. |
| **Scommessa** | Cavallo 2.0; campionato; pubblico; kit commerciale; Biglie side bet | Sono prodotti o formati nuovi. Vanno prototipati, non costruiti tutti insieme. |
| **Non ora** | AI che genera domande in diretta; 20 nuovi giochi; app nativa; cripto/gettoni; buio forzato; tornei a eliminazione complessi | Costo alto, rischio alto, e nessuno risolve un problema urgente della serata. |

### I tre passi che sceglierei se avessi una settimana

1. **Chiudere i P0 e decidere il Cavallo.** Un giro di fix mirate, una copia del DB, una prova con 4 telefoni. Niente nuove feature finché la serata non regge.
2. **Prototipare il formato Sprint dietro un flag.** 25 round, 5 atti, 3 bonus. Provarlo con i bot e con un tavolo vero. Se funziona, diventa il formato commerciale.
3. **Costruire la Regia Mobile.** Una pagina, quattro pulsanti, undo e stato sintetico. È la feature che il presentatore usa per primo e che rende il prodotto vendibile.

## Come misurare se ha funzionato

- **Time to first question:** meno di 10 minuti dall'apertura delle porte.
- **Round completati:** almeno il 95% senza interventi manuali.
- **Riconnessioni:** meno del 5% dei telefoni per serata.
- **Interventi del presentatore:** meno di uno per round.
- **Durata reale:** Sprint sotto 90 minuti, Classic sotto 4 ore.
- **Distribuzione dei punti:** nessun tavolo a zero per tre atti; il divario massimo non supera il 40% a metà serata.
- **Soddisfazione:** un poll di 3 domande a fine serata, non un NPS lunga.
- **Bar:** incasso per partecipante rispetto a una serata senza gioco. È la metrica che convince il locale.

## Domande aperte per te

1. **Durata:** il formato Sprint è un prodotto separato o sostituisce il Classic?
2. **Cavallo:** lo correggiamo, lo sostituiamo o lo togliamo?
3. **Azzardo:** semplifichiamo o resta in pausa?
4. **Pubblico:** vale la pena far votare chi non gioca, o distrae?
5. **Sponsor:** il locale vuole vendere spazi o preferisce un gioco senza marchi?
6. **Contenuti locali:** quanto conta avere domande sul paese/pub rispetto alla banca nazionale?
7. **Hardware:** vendiamo un kit o lasciamo che il locale usi il suo PC?
8. **Campionato:** è un'idea commerciale o un esperimento da una serata?

## Cosa non ho fatto

Non ho modificato codice, scaletta, punteggi o database. Non ho implementato nessuna delle idee qui sopra. Il documento è materiale di lavoro: la prossima decisione è scegliere **due** cose da fare, non tutte.
