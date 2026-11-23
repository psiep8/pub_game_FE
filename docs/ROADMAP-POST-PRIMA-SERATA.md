# PubGame — rapporto della prima serata e percorso verso la prossima versione

## Scopo e metodo

Questa è la lista di lavoro nata dalla prima serata completa, con **6 partecipanti**, dalle valutazioni raccolte in sala e dalla specifica allegata `SPEC-BIGLIE-E-AUDIO.md`. Il file della specifica è stato fornito in chat: **non è presente nella radice del repository**. I suoi requisiti sono riepilogati qui per non perdere il lavoro.

La versione dichiarata nel progetto è **2.2.0**; riferimento del codice esaminato: commit `cee9f0f` del **22 novembre 2026**, aggiornato il **23 novembre 2026** con gli interventi A, B e D di `SPEC-RIMANENTE-2026-11-23.md`. La prossima versione **non è ancora fissata**: scegliere major/minor/patch solo in base ai cambiamenti effettivi e alla compatibilità. La 2.2.0 è già in `VERSION` e nel changelog; il tag `v2.2.0` non è stato creato.

**Regola concordata:** prima si concordano la lista e l'ordine; poi **un intervento alla volta**, senza fix collaterali. Una voce può comprendere codice, test e documentazione strettamente necessari alla stessa correzione. Verifica mirata e, quando richiesto dalla specifica o dal progetto, build e test pertinenti; un commit per intervento/blocco dopo le verifiche, su richiesta già concordata, senza push o tag automatici. I controlli visivi richiedono TV e telefoni anche a 720p e rispetto dello stile `AGENTS.md`. Nessuna voce va segnata chiusa finché non è verificata; segnalare esplicitamente ciò che richiede una prova reale.

**Legenda**: P0 = rischio che impedisce di entrare, proseguire o salva risultati errati; P1 = importante per la prossima serata; P2 = miglioria da pianificare. L'ordine entro ogni gruppo è proposto, non una priorità imposta. Stato iniziale: **da verificare / da fare** per tutte le voci, salvo indicazione diversa.

### Stato al 21 novembre 2026

| Gruppo | ID | Stato |
|---|---|---|
| Verificati in locale (test, 720p o 320×568) | F04, F05, F08, F09, F10, F12, F17, F20, F21, F22, F24, F25, F29, F30, F32, F34, F35, F37, F41, F43, F44, F45–F60 | Manca la prova in sala |
| Parziali: codice corretto o contenuti toccati, resta una prova reale o una revisione a mano | F01, F02, F03, F06, F11, F13, F15, F16, F18, F19, F23, F26, F27, F31, F33, F36, F38, F39, F42 | Vedi la riga del registro |
| In attesa di decisione | F07, F14, F28, F40 | Nessun cambio concordato |

### Stato al 23 novembre 2026 (2.2.0)

Tabella breve: ID, stato e l'unica prova che manca. Il dettaglio è nel registro sotto.

| ID / voce | Stato | Prova mancante |
| --- | --- | --- |
| Numero secco del Casino (A1) | **Fatto**: tre girate come colore e dozzina, nessun rigiro, nessuna fase RESPIN; 500 a girata | sala: tempi della ruota e lettura delle tre girate |
| Testo del Quiz (A2) | **Fatto e corretto il 23/11**: il round vale 1000 in tutto, la sbagliata toglie la quota scalata dal tempo (max +1000, min −1000) | nessuna: è documentazione |
| Audit esteso (B3) | **Fatto**: Indovina chi, Musica, Ruota e Bomba nell'audit e in CI | 1 anno mancante in Musica e 11 false della Bomba da leggere a mano |
| Ultima spiaggia (B1) | **Fatto**: cinque fasce reali, 0 buchi, nessun ripiego di fascia | sala: le 80 riclassificazioni |
| Campione del Quiz (B2) | **Fatto**: 30 domande per fascia con risposta e distrattori | giudizio umano, poi ricollocazioni a parte |
| Banca media (B4) | **Fatto**: documentata come locale, con i comandi di prova | niente da fare in CI, per scelta |
| Residui 2.1.0 (D1v) | **Fatto**: README, presentazione, deploy, avvio serata e script a 2.2.0 | nessuna |
| Registro e roadmap (D2v) | **Fatto**: questa sezione e il blocco del 23 novembre | nessuna |
| Pulizia del codice (D3v) | **Fatto**: scansione in `docs/CODICE-NON-USATO.md`, nessuna rimozione senza prova | revisione periodica |
| Manuale e PDF (D4v) | **Fatto**: manuale HTML aggiornato e PDF rigenerati | stampa di prova in sala |
| F01, F02, F06, F13, F16, F31 | Coperti da test; restano P0 | iPhone/Safari, bfcache e storage, refresh TV, rete di sala, due telefoni, latenze |
| F37 (pausa), F45 (Biglie), F59 (bonus) | Coperti da test | sala: pausa reale, quattro gare, ingressi dei bonus |
| F58 (punteggi) | Coperto da test | decisioni C: Quiz, Azzardo, Bomba, Time Buzzer, finestra bonus |
| F07, F14, F28, F40 | In attesa di decisione | nessun cambio concordato |

### F45–F55: voci chiuse come registro

Le voci F45–F55 erano nate per la 2.1.0 e non descrivono più lavoro aperto: il
loro esito è nel codice su `main` e le verifiche locali sono passate. Restano
chiuse come voci di registro; dove indicato, la prova in sala è ancora quella
delle righe F01/F02/F06/F37 e delle prove audio.

| ID | Esito | Nota |
| --- | --- | --- |
| F45 | Chiusa | Quattro Biglie come round separati; nessun lavoro aperto |
| F46 | Chiusa | Cinque bonus per atto; numeri aggiornati con F58/F59 |
| F47 | Chiusa | Audit di manuale, presentazione, README e PDF fatto |
| F48 | Chiusa | Basket rimosso da TV, regia e telefono |
| F49 | Chiusa | Bonus Cavallo riportato a carta/inchiostro |
| F50 | Chiusa | Casino colore con BIANCO/ROSSO |
| F51 | Chiusa | Numeri dei vani in inchiostro |
| F52 | Chiusa | Tabellone Cavallo a 720p |
| F53 | Chiusa | Numero secco verificato a 320×568; ora le girate sono tre |
| F54 | Chiusa | Errori di rete sul badge OFFLINE |
| F55 | Chiusa | Badge connessione in stile carta/inchiostro |



### P0 — stato dopo i commit del 21 novembre 2026

| ID | Cosa è corretto nel codice | Cosa richiede ancora una prova in sala |
|---|---|---|
| F01 | Ingresso mobile deciso una volta per sessione e redirect con `replaceUrl`; test sulle guardie. | iPhone/Safari reale: ingresso, uscita e rientro senza loop. |
| F02 | Rientro coperto in jsdom e backend; la ripresa Quiz con voti legacy ambigui è bloccata e il legacy viene archiviato prima di un nuovo Quiz (`283a05e5`, `5d4b76ad`). | bfcache iOS, storage sfrattato, socket dopo background, doppia scheda e ingresso iPhone. |
| F06 | Matrice di ripresa completa nel codice, Quiz compreso; annunci legati all'apertura effettiva e consegnati sotto lock (`3257054e`, `07169f9d`). | Refresh TV/regia in lobby, round, classifica e bonus; Quiz durante l'annuncio e dopo un cambio round. |
| F13 | CORS con wildcard e origini esplicite coperto da due test HTTP reali. | Collegamenti reali dal profilo di sala, anche con origini esplicite. |
| F16 | Annunci Quiz pubblicati dentro `withRoundLock`, `roundStartId`/`roundStartedAt` autorevoli e guardia sul telefono (`3257054e`, `07169f9d`). | TV e almeno due telefoni fisici: primo round, cambio round e refresh della TV. |
| F31 | Doppio tocco, risposte e domande tardive invalidate al cambio round, con test remoti. | Più telefoni reali con latenze e timer; ogni risposta alla domanda corretta. |
| F39 | Correzione H2 isolata sul vecchio vincolo Tennis; nessun dato rimosso. | Copia di un database precedente alla serata e apertura del round su TV/telefoni. |

Il registro sotto resta l'archivio: le righe sono in ordine di esecuzione, non di
priorità.

### Correzioni ai documenti e alle conclusioni precedenti

- `docs/FIX-PRE-SERATA.md` e `docs/SECONDA-SERATA.md` contengono affermazioni e scelte troppo sicure: **questo rapporto prevale come registro**, senza modificare retroattivamente ciò che è stato committato.
- Biglie e Casino sono stati proposti come round; sono una direzione da progettare, non ancora una scaletta o un sistema punti approvati. Il bonus-sorpresa è un'idea, non un progetto definitivo. La sorte di Cavallo è ancora da decidere: non assumere che rimanga un bonus-gara.
- La frase «Casino a una manche sola» era una nostra interpretazione: il feedback originale diceva **«sistemare una manche sola»**. Chiarire quale manche e se il numero totale debba davvero cambiare. Non presentare il cambiamento come deciso.
- Cavallo: la TV accetta i voti solo se il nome coincide con un giocatore presente e, senza voti, dopo 15 secondi sceglie una categoria casuale. **Non è dimostrato** che questa sia la causa del problema in sala; il formato attuale invia domande a tutti, ma questo non significa che soddisfi l'intento del gioco.
- Tennis: nei log del container della serata era presente un errore H2 che rifiutava `TENNIS_BATTLE` per un vincolo con i vecchi valori. Non è dimostrato che il fixer successivo sia fallito: l'immagine del container osservato è stata creata **prima** del file `StaleRoundTypeConstraintFixer`. Verificare su una copia di un database precedente al rename; non modificare il database della serata per la prova.
- La precedente affermazione «banca media locale assente/vuota» era errata: nel workspace sono presenti file sotto `static/media/music` e il file `questions/media-it.json`. Non sappiamo se fossero inclusi nell'immagine usata in sala o se coprissero tutte le domande. Non attribuire i problemi di musica/foto all'assenza di media senza verificarlo.
- Non attribuire a chi giocava preferenze non espresse: Speed Rush e Casino sono piaciuti tantissimo, Biglie è stato giudicato bellissimo, Basket bocciato; Cavallo non è stato realmente provato. Nessun dato raccolto dimostra che le squadre abbiano chiesto una ripetizione specifica o che nessuno guardasse un tabellone bonus.

## Direzione della serata e questioni di progetto

1. **Casino e Biglie come round:** proposta da integrare nella futura scaletta, con punti nella classifica principale e numero di apparizioni da definire. Nessun cambiamento oggi. Per Biglie la specifica chiede di **non cambiare scelta, punti e risultato**: un eventuale riscalamento dei punti per il passaggio a round è una decisione separata, non autorizzata implicitamente.
2. **Basket:** rimuovere dalla serata secondo il feedback; individuare separatamente i punti in cui compare (scaletta, avvio, manuale, demo) senza cancellare dati o codice non necessario alla rimozione. Destinazione dell'eventuale slot da decidere.
3. **Bonus-sorpresa:** momenti di sala alternativi alle gare, potenzialmente con luci spente e telefoni; proposta «costellazione» (telefoni colorati a sequenza e TV coordinatrice). È un concept, non una funzionalità già approvata nei dettagli. La luminosità non è forzabile, vibrazione e audio non sono garantiti su tutti i dispositivi, e la rete può introdurre ritardi o disconnessioni. La sicurezza in sala e un'alternativa senza buio vanno considerate.
4. **Cavallo:** decidere se correggerlo, sostituirlo, promuoverlo a round o eliminarlo; non assumere scelta della categoria condivisa o formato individuale come requisiti già approvati.
5. **Punti e rischio:** introdurre occasionalmente un meccanismo capace di far perdere anche molti punti; definire gioco, frequenza, importi, limiti ed equità prima di implementarli. Non confondere questa richiesta con i punti dei bonus-sorpresa.
6. **Scaletta:** considerare sostituzioni, aggiunte e rimozioni senza dimenticare durata e numerosità della serata; verificare conteggi, classifiche, ripresa e documentazione prima della release.

## Registro generale — un intervento per volta

| ID | Priorità | Richiesta / fatto osservato | Verifica di chiusura |
|---|---|---|---|
| F01 | P0 | **iPhone/Safari:** durante l'ingresso si è visto un loop. Riprodurre il percorso reale, isolare causa e correggerla. | Safari iPhone entra e rimane in partita; verificare su dispositivo e controllare nessun loop di navigazione. |
| F02 | P0 | **Rientro telefono:** dopo refresh o indietro/avanti due partecipanti hanno dovuto rifare il tutorial. Recuperare sessione e squadra; valutare un pulsante «Rientra». | Refresh e cronologia riportano alla stessa squadra senza rifare il tutorial, anche se entra durante un round; chiarire il comportamento se la sessione è scaduta. |
| F03 | P1 | **Tutorial/vibrazione:** su alcuni telefoni, anche Android diversi, non si sentiva. Distinguere impostazioni/supporto del dispositivo e problemi dell'app; non bloccare chi non può vibrare. | Su dispositivi disponibili indicare esito/fallback e permettere di proseguire; non promettere vibrazione universale o su iPhone. |
| F04 | P1 | **Prossimo round visibile sul telefono:** in alto a sinistra compare in anteprima; eliminarne la rivelazione prematura. | Prima dell'annuncio non compare su telefono, anche in ripresa/riallineamento. |
| F05 | P1 | **Espulsione dalla regia:** consentire all'admin di rimuovere chi è entrato erroneamente. | Solo regia autorizzata può espellere; il partecipante viene rimosso dall'interfaccia e non continua a giocare con la vecchia sessione; definire eventuale rientro. |
| F06 | P0 | **Refresh TV/regia:** controllare gestione e recupero dell'intera partita, non solo la schermata; identificare le modalità che non riprendono e il comportamento in corso di round/bonus. | Matrice per lobby, round, classifiche e bonus, TV e admin; snapshot, punti, timer e telefoni coerenti; riportare esplicitamente i casi non supportati. |
| F07 | P1 | **Avvii troppo rapidi e riepiloghi troppo brevi:** uniformare per quanto possibile, mantenendo le necessità dei singoli giochi; più suspense generale. | Tempi confrontati per gioco, lettura possibile in sala; nessuna partenza mentre l'istruzione non è fruibile. |
| F08 | P1 | **Classifica dettagliata:** aumentare suspense e accompagnamento sonoro dal quinto posto in avanti. | Reveal ordinato e comprensibile con suoni coerenti e controllabili. |
| F09 | P1 | **Classifica rapida:** con più di 5–6 concorrenti chi è in fondo non si vede. | Tutti visibili o raggiungibili in modo chiaramente leggibile su TV, anche a 720p e con più di sei concorrenti. |
| F10 | P1 | **Categorie:** in sala Storia è uscita troppo spesso; rendere la varietà più equilibrata durante la serata. | Verificare distribuzione su più scalette/semi, rispettare categorie disponibili e non promettere casualità perfettamente uniforme. |
| F11 | P1 | **Distrattori globali:** risposte più plausibili e fuorvianti, evitando opzioni manifestamente ovvie. | Revisione e controlli per gioco/categoria: una sola risposta corretta, niente ambiguità, falsità o doppioni. |
| F12 | P1 | **Tema TV:** il colore della squadra vincente il round precedente non era percepito in sala. | Riprodurre dalla chiusura del round al successivo, inclusi pari merito e assenza di vincitore; tema corretto TV/telefono secondo il comportamento concordato. Nel codice esistono `settleRoundWinner` e `applyRoundWinnerTheme`: la logica non è assente, va diagnosticata. |
| F13 | P0 | **CORS segnalato nei log:** errore con `ALLOWED_ORIGINS=*` e credenziali. | Riprodurre con il profilo usato in sala e correggere senza allargare indiscriminatamente gli accessi; verificare anche origini esplicite. |
| F14 | P2 | **Meccanismo di perdita consistente:** progettarlo e bilanciarlo come voce autonoma dopo la scelta delle regole. | Valori/frequenza documentati e approvati; calcolo e classifica verificati, anche per eventuali limiti sotto zero. |

## Giochi — feedback e correzioni separate

### Quiz — promosso, ma

- **F15 [P1] Tempo:** più tempo per rispondere; scegliere valori e aggiornare tutte le indicazioni. Verifica: tempo disponibile coerente su TV/telefono/server.
- **F16 [P0] Prima domanda:** nel primo round non sono uscite le risposte sui remoti. Riprodurre primo avvio e sincronizzazione dei telefoni; verificare con più dispositivi.
- **F17 [P1] Prenotazione:** compare erroneamente «SEI PRENOTATO» pur non essendo un gioco a prenotazione. Verifica: nessun messaggio o stato di prenotazione durante Quiz.

### Musica — promosso, da migliorare

- **F18 [P1] Prima manche:** era troppo irriconoscibile; ribilanciare il trattamento audio mantenendo sfida. Ascolto reale della manche.
- **F19 [P1] Seconda manche:** era già troppo chiara; graduare la difficoltà rispetto alla prima senza invertire l'effetto. Ascolto comparativo e controllo di qualità/volume con le successive.
- **F44 [P1] Conferma corretta in seconda manche:** dopo il «corretto» dell'admin si sentono ancora 3–4 secondi di musica filtrata prima del brano pulito. Il brano deve partire lindo appena la TV mostra il messaggio di vittoria, durare tutti i 30 secondi e sfumare negli ultimi 5, poi passare al round successivo.

### Celebrità / Indovina chi — promosso, da migliorare

- **F20 [P1] Ritmo indizi:** in 60 secondi servono più indizi, almeno uno ogni 6 secondi, lasciando un tempo leggibile per pubblico/presentatore. Verificare tempi, numero, timer, sincronizzazione e sovrapposizione con prenotazione.
- **F21 [P1] Qualità degli indizi:** un indizio ha rivelato il nome della celebrità. Analizzare banca/generazione backend; verificare nome, varianti e alias, qualità e sufficienza degli indizi senza inventare fatti. Test con casi reali e revisione dei contenuti.
- **F22 [P2] Sfocatura:** a inizio gioco risultava troppo lenta; rivalutare progressione con la nuova cadenza indizi, senza rivelare troppo presto.

### Ruota e Blackjack

- **Ruota della fortuna:** feedback positivo, nessun cambio richiesto.
- **Blackjack:** feedback molto positivo, nessun cambio richiesto. Non modificarlo salvo problemi generali documentati e verificati.

### Timeline — promosso, da sistemare

- **F23 [P1] Leggibilità carte remote:** su alcuni Android e iPhone le scritte non si leggono. Verificare contrasto, dimensioni, taglio e scorrimento su dispositivi reali; non sostituire il drag con tocchi né ridurre le date senza decisione specifica.

### Bomba — così così, da ripensare

- **F24 [P1] Scorrimento opzioni:** alcuni telefoni non riuscivano a scorrere. Riprodurre su Android/iPhone con molte opzioni; tutte devono essere selezionabili.
- **F25 [P1] Esplosione immediata:** chi sbaglia deve capire subito di aver perso, non a fine ondata. Aggiornare simultaneamente logica server, TV, telefono, esiti e punteggi senza doppia penalità; specificare cosa vedono gli altri.
- **F26 [P1] Feedback sul telefono:** esplosione, suono e vibrazione dove disponibili, con fallback visivo/accessibile se assenti o bloccati dal browser. Integrare con il lavoro audio, non dipendere dalla vibrazione.
- **F27 [P1] Domande:** troppo semplici, evitare il formato «cosa non appartiene a», creare una banca più varia e impegnativa. Verificare quantità, qualità, categorie e risposte corrette.

### Azzardo — in pausa

- **F28 [in attesa]** Puntata e fiches poco intuitive. Non modificare logica ora. Proposta da valutare: mostrare prima «scegli risposta → aggiungi fiches → conferma», con un esempio concreto e dettagli secondari progressivi; provare con giocatori prima di cambiare regole o punteggio.

### Arena — promosso, con problemi da correggere

- **F29 [P1] Cerchio:** iniziare il restringimento prima e renderlo più lento. Verificare durata e leggibilità dell'andamento.
- **F30 [P1] Movimento:** salire verso il centro molto più difficile; scendere leggermente più facile. Bilanciare passi e frequenza con regole e punti verificabili.
- **F31 [P0] Domande saltate:** sul remoto alcune sono avanzate mentre un giocatore rispondeva. Riprodurre con più telefoni, latenze e timer; una risposta va riferita alla domanda corretta.
- **F32 [P1] Inattività:** limite di tempo per rispondere, così chi resta fermo al centro non vince senza rispondere. Il server conserva totali cumulativi, recuperabili al tick successivo, e accredita la pausa alla ripresa anche senza polling. Restano la prova in sala e il recupero completo della TV dopo refresh (F06).
- **F43 [P0] Attesa tra domande:** a volte passavano 2–3 secondi prima della domanda successiva. Il retry quando il round non è ancora aperto è sceso da 1 s a 150 ms e la pausa dopo un errore da 1,5 s a 600 ms; la risposta corretta chiede già subito la domanda. Da provare con più telefoni reali.

### Ultima spiaggia — promosso, da controllare

- **F33 [P1] Difficoltà banca:** domande facili sono uscite negli slot da 400/500; verificare categorie e livelli, revisionare e testare i dati.
- **F34 [P1] Frequenza:** osservati sei round nella serata. La scaletta statica `schedule.ts` ne prevede **cinque** (8, 16, 23, 32, 39); questo non spiega da solo ciò che è successo. Ricostruire avanzamento, eventuale ripetizione/refresh e log, poi correggere la causa se riproducibile.

### Time Buzzer

- **F35 [P1] Via chiarissimo:** presentatore e gioco devono far capire quando iniziare a contare; segnali TV/telefono e audio coerenti con l'istante effettivo, verificati sui dispositivi. La TV già ha countdown e timbro «VIA»; il telefono passa da «ATTENDI» a «STOP»: migliorare il segnale effettivamente percepito.

### Speed Rush — piaciuto tantissimo

- **Situazione verificata nel codice:** undici tipi nel servizio server: **matematica**, **miscuglio di colori**, **bandiere**, **sinonimi/contrari**, **traduzione**, **proverbi**, **geografia**, **tap**, **intruso**, **ordine**, **reazione**. I quattro microgiochi storici sono stati recuperati dalla storia Git; il geografico ha pool di città divisi per difficoltà. Il server evita il tipo immediatamente precedente e tenta di evitare prove ripetute, ma dopo 60 tentativi può accettarne una ripetuta; la difficoltà è EASY sotto 35% di avanzamento, MEDIUM sotto 70%, HARD dal 70%. Non tutti i tipi sono necessariamente differenziati allo stesso modo per difficoltà. Esiste anche un mazzo frontend con gli stessi cinque tipi: non assumere che sia la fonte delle prove server.
- **F36 [P1] Varietà:** aggiungere microgiochi e contenuti realmente diversi, scegliendoli e bilanciandoli; evitare ripetizioni percepite, verificare generazione/validazione lato server e interfaccia telefono.
- **F37 [P1] Durata:** portata a 90 secondi nel timer TV, nel servizio server, nel payload e nelle indicazioni. La pausa TV ora sposta avanti anche la deadline server; resta la prova in sala.
- **F38 [P1] Tracciato più lungo:** ricalibrare l'avanzamento insieme alla nuova durata; difficoltà più alta a metà e fine percorso, senza fare arrivare tutti troppo presto o impedire arrivi. Provare con tempi reali di più giocatori.

### Tennis

- **F39 [P0] Avvio:** durante la serata non è partito; esiste un errore H2 sul vecchio vincolo del tipo. Verificare la migrazione esistente su copia di database con schema precedente e su database nuovo; nessuna rimozione indiscriminata di vincoli, nessun dato perso. Verificare apertura del round e gioco su TV e telefoni. Il fixer committato non equivale a una fix verificata.

### Casino

- **F40 [progettazione]** Giudizio ottimo; capire quale manche va sistemata e se la proposta «una manche» riflette l'intento. Progettare il passaggio a round e l'eventuale bilanciamento punti soltanto dopo la decisione, senza alterare il gioco apprezzato.

### Basket e Cavallo

- **F41 [P1] Basket fuori dalla serata:** rimuovere disponibilità in scaletta e regia, aggiornando indicazioni necessarie; non cancellare in blocco dati/codice senza necessità.
- **F42 [P1 / scelta formato] Cavallo:** non ha funzionato: scelta categoria non vista e domande per tutti. Prima riprodurre il flusso TV, voto telefono, scelta, domande e log; poi decidere come deve funzionare e se conservarlo. Non considerare provata la causa dei voti scartati.

## Biglie — specifica da implementare in blocchi isolati

**Feedback:** bellissimo. Non cambiare scelta unica delle biglie, regole dei punti o risultato senza una decisione separata. **Stato al 18 novembre 2026:** otto piste (rally, F1, neve, acqua, vetro, sabbia, spazio, magma), **due gare per round** scelte dal seme e numerate 1–8 nella serata, punti per gara **150/100/60/30** ai primi quattro e **−30/−60/−100/−150** agli ultimi quattro (penalità introdotta con la 2.1.0), pista da **12.000 px** con corsia stretta e tornanti. La gara **chiude all'arrivo dell'ultima biglia** (misurata 47–66 s), con **70 s** di conto alla rovescia in TV e **120 s** di sola rete di sicurezza: il vecchio taglio a 38 s non esiste più. Resta valido il resto: un limite a 45 s o una validazione che scarta chi non arriva sarebbero un requisito distinto da concordare, non un cambio nascosto.

### Diagnosi confrontata con il codice

- La geometria vive in `track-geometry.ts`: gambe a direzione fissa che alternano il verso, con un richiamo al centro quando il nastro si allontana. Il disegno e i muri Matter usano la stessa spezzata, quindi non c'è più la pista «finta» delle onde sinusoidali.
- `TRACK_WORLD_LENGTH = 12000`, corsia `clamp(130, 210, count*25)` (150 px con sei concorrenti) e raggio minimo pari a metà corsia più il muro: sotto quella soglia il bordo interno si ripiega e nascono le «mangiate». **I bivi non esistono più**: al loro posto 52 ostacoli piccoli spaziati per slot e seme, con paracarri solidi a ridosso del muro.
- Otto piste con fisica per fondo (rimbalzo, attrito, gravità, tenuta, dossi) e ostacoli propri; il sottofondo è un loop registrato riascoltato per pista da `marble-roll.ts`.
- Restano veri i limiti già noti: il seme da solo non dimostra un replay identico (contano input e tempi), alcuni effetti grafici usano `Math.random`, e oltre otto biglie `buildMarbleSet` crea ID aggiuntivi: una prova con dieci biglie va misurata.

### Blocchi, nell'ordine richiesto dalla specifica (dopo Audio A1–A3)

- **B1 — separazione senza cambiamento di comportamento:** estrarre geometria/generatore, fisica e disegno testabili; preservare l'aspetto e l'esito corrente nel limite verificabile. Nessuna modifica a scelta, punti e risultato.
- **B2 — geometria e fisica condivise:** profili differenti per le otto piste; curve, S, chicane e tornanti fisici; corsia stretta con larghezza fissa per round, senza bivi; utilizzare la stessa geometria per bordi Matter e renderer. Considerare spline e rumore solo se utili, preferendo Matter e casualità già presenti; librerie aggiuntive solo dopo valutazione.
- **B3 — pezzi e interazioni:** rettilinei, strozzature, imbuto, pendenze/rampe, perni, ostacoli mobili (barra, porta, altalena), zone d'attrito e correnti; profili coerenti per fondo. Statistiche delle biglie come proprietà fisiche, scontri e sorpassi verificabili. Non promettere esiti imprevedibili o equi senza prove.
- **B4 — validatore:** prima della corsa, geometria valida, larghezza minima 3,2 diametri, pezzi non sovrapposti; simulazione rapida non visibile, rilevazione blocchi oltre 1,5 s e scarto/correzione, durata target 45–70 s, controllo statistico di equità delle posizioni di partenza su più prove; poi riprodurre lo stesso risultato in TV. Definire come gestire semi non validi e indisponibilità di validazione senza bloccare la serata. Chiusura di sicurezza a 120 s, con posizione per distanza residua.
- **B5 — test e performance:** almeno **1.000 semi per ciascuna delle otto piste** per generatore/validatore; verificare geometria e arrivo riproducibili a parità di input, diversità misurabile con semi diversi, assenza di blocchi e durata. Dieci corse da osservare e prova prestazioni su TV 1080p con 10 biglie e obiettivo 60 fps: sono prove da eseguire e misurare, non risultati presunti.
- **B6 — integrazione audio:** solo dopo i blocchi audio e fisica, urti biglie e roulette collegati a collisioni con intensità proporzionata; evitare raffiche e sovrapposizioni.
- **Documentazione:** aggiornare demo e manuale per descrivere la pista nuova e il formato effettivo, senza dichiarare regole cambiate se non lo sono. UI allineata a `AGENTS.md`.

**Tensioni da risolvere prima di B4:** oggi la gara chiude all'arrivo dell'ultima biglia (47–66 s misurati) e i 70 s sono un conto alla rovescia, non un taglio. Validare in anticipo e poi riprodurre il risultato richiede determinismo degli input e gestione dei ritardi, non basta salvare un seme; una validazione che scarta chi non arriva cambierebbe il risultato. Nessuna prova di equità o prestazione discende dal solo test di geometria.

## Audio — stato al 19 novembre 2026

**Feedback della prima serata:** sottofondo inquietante da sostituire; musica e
atmosfera diversa per gioco; migliorare click, tick, countdown, bombe, successo,
errore. L'ascolto a volume reale resta indispensabile.

**Cosa c'è oggi.** La sintesi Web Audio è stata sostituita da file registrati:
**41 effetti e 20 loop** `.m4a` in `apps/frontend/public/assets/audio`, circa
23 MB. `audio.service.ts` suona il catalogo di `audio-catalog.ts`; del vecchio
motore resta solo la coda di stanza in `audio-dsp.ts`. La pagina `/audio` fa
ascoltare ogni evento, i sottofondi per atto e per gioco e i pesi.
`docs/MANIFESTO-AUDIO.md` è la fonte dei nomi dei file;
`node scripts/audio/process-audio.mjs` normalizza (effetti −16 LUFS, loop
−23 LUFS), taglia e converte i grezzi in `_src/`, e `--credits` rigenera
`docs/CREDITI-AUDIO.md`.

**Sottofondi.** I **20 loop** sono tutti in cartella: 5 basi d'atto, 14 giochi e
bonus e il rotolamento delle Biglie, per **21,70 MB** sui 22 MB del tetto. Ogni
brano dura 60 s con incrocio di 1,5 s; la mappa completa è in
`docs/SOTTOFONDI.md`. `bed-map.ts` non deve più ripiegare su un altro loop.

**Aperti.** Ascolto reale in sala (F18/F19 e F44: nessun suono è stato ascoltato a
volume vero), verifica del silenzio in pausa e della resa sui telefoni reali.

**Fonti e licenze.** Fonte, autore, URL e licenza di ogni file stanno in
`FONTI.txt` accanto agli asset e in `docs/CREDITI-AUDIO.md`, generato dallo
script. Gli undici effetti di sintesi renderizzata sono marcati «Nostra». Nessun
file va aggiunto senza registrare la licenza e verificare l'uso commerciale.

## Matrice di ripresa dopo un refresh (F06)

| Momento del refresh | Cosa torna | Esito |
|---|---|---|
| Lobby / TV appena aperta | `activeGameId`, presenza, classifica dal server | ✅ |
| Round Timeline aperto | Carte nel payload e timer dal server; overlay «RIPRENDI» | ✅ |
| Blackjack aperto | Mano salvata sul server (`blackjackState`) e timer | ✅ |
| Arena aperta | La TV salva il tabellone sul server a ogni risposta e penalità e riapre il round dal checkpoint con il tempo residuo; esiti e penalità non si applicano due volte e una risposta arrivata dopo la chiusura non fa punti | ✅ |
| Bomba aperta | Tabellone, turno e scadenza sono sul server: la TV si riaggancia dal checkpoint TV (`tvCheckpoint`) e riprende senza ripartire | ✅ |
| Quiz in corso | Manche/tempo nel checkpoint TV, voti sul server: la TV riapre la stessa manche, la riannuncia con il tempo che resta (anche se il backend è ripartito) e rilegge le risposte arrivate mentre era via | ✅ |
| Speed Rush in corso | Le corsie si rileggono dal server dopo il refresh, il tempo è quello che resta al round e la sessione resta quella aperta: nessun checkpoint TV da scrivere | ✅ |
| Ruota della fortuna | La TV salva lettere uscite e punto del mazzo: al ritorno rimette lo stesso mazzo (l'ordine è casuale, quindi va salvato) e le stesse lettere, con il tempo che resta | ✅ |
| Celebrità | Sfocatura e indizio raggiunto nel checkpoint TV; foto e indizi restano nel payload e il tempo passato si ricava da `savedAt` | ✅ |
| Time Buzzer | Il via della manche è già sul server (idempotente); bersaglio, tempi dei telefoni, eliminati e fase arrivano dal checkpoint TV. Una manche già rivelata non si ricalcola, quindi i punti restano pagati | ✅ |
| Azzardo | Fiches, puntate, salvadanaio e conversioni nel checkpoint TV: il tavolo è quello di prima, il tempo non riparte da capo e un reveal già avvenuto non ripaga i punti | ✅ |
| Tennis battle | Campi, punteggi, game, killer point, domanda corrente e sfide in attesa nel checkpoint TV; chi ha già chiuso il set non riprende i punti e il tempo di battuta tiene conto della pausa | ✅ |
| Ultima spiaggia | Livello scelto, risposte, esiti e livelli consumati nel checkpoint TV, con lo stesso id dell'occorrenza (i telefoni non azzerano la scelta); un reveal già avvenuto non ripaga i punti | ✅ |
| Bonus di fine atto | La TV scrive sul server se il bonus dell'atto è avviato o chiuso: dopo un refresh riapre quello ancora aperto e non ripete uno già pagato. Casino, Cavallo e Blackjack ripartono dalla fase salvata; gli atti già chiusi restano chiusi anche se uno snapshot arriva ancora con `STARTED` | ✅ |
| Bonus Casino | Colore, dozzina e numero secco salvano nel checkpoint TV voti, numero uscito, punti e istante del salvataggio: la TV riapre la manche con il tempo che resta e rigira verso lo stesso numero, se era già uscito | ✅ |
| Bonus Blackjack | La mano vive nello stato Blackjack del server: mazzo, carte, tavoli, fase e tempo residuo; al refresh riparte dov'era e i tavoli già chiusi tornano come punti, senza rigiocare l'esito | ✅ |
| Bonus Cavallo | Voti della categoria, domande già caricate, tabellone e fase nel checkpoint TV: al refresh la rush riprende con il tempo che resta, un reveal già calcolato non ridà i punti e il podio finale si paga una volta sola | ✅ |
| Canzone (MUSIC) | Manche, secondi rimasti, pausa fra due ascolti e prenotazione nel checkpoint TV: al refresh la TV riparte dalla manche giusta e un brano già rivelato resta pagato; l'audio riparte dall'inizio del brano, il conteggio no | ✅ |
| Round Biglie | Biglie assegnate, gare chiuse, classifica e tabellone nel checkpoint TV: la scelta della biglia, l'ordine d'arrivo e la finale riprendono senza ripagare nulla. La fisica di Matter non si riprende: solo la gara in corso si rigioca, e i suoi punti si pagano una volta sola alla sua fine | ✅ |
| Classifica a schermo | Punti e nomi tornano; l'animazione di reveal riparte da capo | ⚠️ |
| Telefono | Sessione e squadra tornano, tutorial saltato; Bomba riprende il polling, Arena chiede una nuova domanda | ✅/⚠️ |
| Regia | Snapshot e diagnostica disponibili; le azioni in corso non vengono ricostruite | ⚠️ |

La ripresa del Casino usa lo stesso `tvCheckpoint` dei round, con `mode` che inizia per `BONUS_`: il server non lo lega a un round aperto e lo restituisce nello snapshot con `bonus: true`. Il bonus dell'atto ha invece un blob suo (`bonus-act`, endpoint `/bonus-state`): dice se il bonus è avviato o chiuso, così un refresh durante la classifica di fine atto non lo salta più. Gli altri bonus richiederebbero di salvare lato server uno stato che oggi vive solo nella TV (domande del Cavallo, fisica e canvas di Biglie, mano del Blackjack) e restano un intervento separato.

## Ordine di lavoro proposto

1. Concordare la lista e le scelte di formato ancora aperte. Raccogliere, se disponibili, foto e casi riproducibili; non chiedere log segreti o pubblicare dati dei giocatori.
2. Riproducibilità e tenuta serata: F01–F06, F13, F16, F31 e F39 secondo gravità effettiva, **uno per volta**. Non cambiare DB della serata durante i test; usare copie.
3. Stabilire scaletta futura, destino dei giochi, rischio e tempi; poi affrontare singolarmente leggibilità, sincronizzazione e banca domande (F07–F38, F40–F42), rinviando Azzardo come richiesto.
4. Audio **A1 → A2 → A3**, poi Biglie **B1 → B2 → B3 → B4 → B5**, infine urti **B6/A4**, secondo l'ordine della specifica. I blocchi si possono scomporre ulteriormente, sempre con una verifica e un commit per intervento coerente. Non eseguire la sequenza intera in un unico cambiamento.
5. Prima di ogni eventuale release: riepilogare funzionalità completate e sospese, fonti/licenze audio, prove su TV e telefoni, esito test e build; poi decidere versione, changelog e tag in base al risultato.

## Registro esecuzione

**Aggiornamento 21 novembre 2026 — annunci Quiz e voti legacy.** Due correzioni separate, già su `main`; le banche non sono state toccate.

- `3257054e` + `07169f9d` — annunci Quiz: la consegna avveniva col valore di ritorno di un metodo `@MessageMapping`, fuori dal `withRoundLock` dell'apertura, e il framework la ripeteva anche senza `@SendTo`. Ora il controller pubblica esplicitamente dentro lo stesso lock, il metodo è `void`, e i messaggi Quiz portano `roundStartId` e `roundStartedAt` autorevoli. Il telefono scarta annunci di un'altra apertura o più vecchi. Verifiche: test WebSocket con due client reali (l'annuncio vecchio non arriva dopo il cambio round, il nuovo arriva una volta sola), 88 test remoti e 191 test frontend (remoto + TV). **Da provare in sala:** TV e due telefoni fisici, primo round, cambio round e refresh della TV durante l'annuncio.
- `283a05e5` + `5d4b76ad` — voti legacy: la ripresa di un Quiz con blob senza `roundStartId` resta bloccata (`legacy-quiz-state`) e un Quiz successivo non può più sovrascrivere quel blob; il primo legacy viene copiato in `quiz-legacy-archive` con test-and-set e l'archivio non viene mai sostituito. Verifiche: `QuizServiceTest` (11 test) e test d'integrazione H2 su apertura nuova, archivio e secondo legacy. **Da provare in sala:** copia di un database precedente all'aggiornamento, non il database della serata.

**Aggiornamento 23 novembre 2026 — Ruota a 62 frasi.** La banca dei proverbi di
`QuestionBankService.PROVERBS` passa da **32 a 62 frasi** senza doppioni: le 30
nuove sono proverbi e modi di dire di uso comune (dieci candidati sono stati
scartati in revisione e non sono stati riproposti). La scelta ora salta i proverbi già usati nella partita,
con la chiave del `QuestionHistoryService`: due round della stessa serata non
possono ripetere la frase e, a mazzo esaurito, si riparte da capo. Verifiche:
`node scripts/audit-banche.mjs --ci` → 0 doppioni, 0 segnalazioni;
`WheelProverbTest`; tabellone TV misurato a 1280×720 con la frase più lunga.
La skin TV della Ruota è passata ai token carta/inchiostro (tessere di carta con
bordo 3 px e ombra piena al pomodoro, lettere svelate in acido, timbro mono al
posto dell'emoji, timer nero su carta); il CSS legacy che viveva in
`tv/game.component.css` è stato rimosso. Schermata di verifica a 1280×720:
`docs/screenshots/ruota-skin-720p.png`.

**Aggiornamento 23 novembre 2026 — Bomba senza dubbi e Timeline a 222 eventi.**
Le otto coppie della Bomba segnalate dall'audit sono state allineate accorciando
i nomi troppo lunghi (Coppola, Leonardo, Berners-Lee, Lampedusa) e portando la
falsa a un solo dettaglio di distanza: **0 dubbi** su 110 affermazioni. La
Timeline è passata da **211** a **222** eventi con **11 eventi di difficoltà 5**
nuovi, uno per categoria: ora tutte le 14 categorie ne hanno almeno uno. Ogni
anno scelto era libero e ogni evento ha la fonte Wikipedia. Verifiche:
`node scripts/audit-banche.mjs --ci` → 0 doppioni, 0 segnalazioni, 0 campi
mancanti, 0 buchi di Ultima spiaggia, 0 dubbi Bomba.

**Aggiornamento 21 novembre 2026 — 2.2.0 e banche.** La versione corrente è la
**2.2.0** (nessun tag creato). Banche: **983 domande** Quiz/Arena/Tennis/Cavallo,
**360** Azzardo, **110** affermazioni Bomba e **211** eventi Timeline; l'audit dà
**0 doppioni**, **0 segnalazioni** e **0 campi mancanti**. Restano **69 buchi** di
Ultima spiaggia sotto la soglia di 12 per categoria e livello (circa **447
domande** da aggiungere) e solo **3** eventi Timeline di difficoltà 5; l'audit in
CI non blocca sui buchi. Verifiche: suite frontend 639/639, backend 154 test (1 saltato senza banca
media), run CI #155 verde prima di questo job, screenshot del README rifatti.

**Aggiornamento 15 novembre 2026 — F45/F46:** la scaletta è passata a 4 Biglie come round separati (allora 3, 5, 11, 22; dalla 2.1.0 sono 11, 22, 28, 37), Blackjack fuori dai round, Bomba 2, Tennis 2 e Speed Rush 3; Arena resta 24/40 e Ultima spiaggia 8/16/23/32/39. I cinque bonus sono Casino bianco/rosso, Blackjack, Casino dozzina, Cavallo e Casino numero secco, uno dopo ogni atto, con ingressi scenografici distinti e punti in classifica alla chiusura. Verifiche: **250 test frontend (39 file)** e **117 test backend**, tutti passati. Restano da provare in sala ingressi, tempi e resa della ruota/Blackjack su TV e telefoni reali.

| ID | Stato | Verifica | Commit | Note |
|---|---|---|---|---|
| F17 | Corretto, da verificare in sala | Test remoto: 22 passati | `daf9ae6` | Quiz mostra «RISPOSTA INVIATA»; prenotazione invariata negli altri giochi. |
| F02 | Parziale (coperto in jsdom e backend, verifica su device; ripresa legacy bloccata) | Test remoto: 24 passati + 16 test jsdom di rientro (round aperto, Quiz già votato con risposta lenta e due snapshot, sessione scaduta, espulsione, serata aperta, scheda doppia, Musica, Bomba, Timeline con risposta già inviata, senza risposta, con lettura fallita, con risposta arrivata dopo una modifica e con modifica annullata) + 3 test backend sull'ordine Timeline | `a487bc1` + `affc55a` + `c63d571` + `5e84d3c` + `4686b17` + `febca15` + `74806fe` + `c625a98` + `283a05e5` + `5d4b76ad` | Il refresh è simulato come nuova istanza del componente sullo stesso telefono. Rientro nel round aperto, Quiz già votato (i tasti si aprono subito e una sola richiesta per round e manche li blocca se serve), sessione scaduta con avviso invece di ingresso muto, espulsione senza invii, serata aperta adottata dal server, scheda doppia bloccata con i Web Locks. Timeline: la risposta sul server conserva l'ordine inviato e `GET /games/{id}/timeline-answer` lo restituisce, così alla ripresa il telefono ritrova la sua risposta; chi non ha ancora risposto manda l'ordine iniziale e non resta senza invio, mentre se la lettura fallisce non manda nulla da solo e aspetta un tocco; una risposta arrivata dopo una modifica viene ignorata e resta l'ordine appena scelto, anche se la modifica è stata annullata rimettendo le carte com'erano (conta il primo spostamento). Musica riprende la prenotazione e Bomba il polling. La ripresa Quiz con voti legacy privi di identità di apertura ora è bloccata (409 `legacy-quiz-state`) invece di riaprire voti non verificabili; quando un Quiz successivo cambia round, il primo legacy viene copiato in `quiz-legacy-archive` e l'archivio non viene mai sovrascritto. Verificato con `QuizServiceTest` e un test d'integrazione H2; la prova su una copia di un database realmente precedente all'aggiornamento resta da fare. Restano da provare su dispositivi: bfcache di Safari/iOS (`pageshow` con `persisted`), storage sfrattato dalle PWA iOS, socket morta dopo un background lungo, lock tra scheda in background e in primo piano, ingresso su iPhone (F01). `duplicateDisplay` del server vale solo per la TV. Foglio di prova: `docs/PROVA-DEVICE-F02-F01-F13-F12.md`, sezione F02. |
| F03 | Parziale | 6 test tutorial passati | `0703682` | Richiesta da un tocco e percorso NON VIBRA; da provare fisicamente su Android e iPhone. |
| F13 | Corretto nel test isolato | Due test HTTP reali per SockJS con wildcard e origini esplicite | `132158b` | Wildcard resta permissiva quando esplicitamente configurata; collegamenti reali da provare. Foglio di prova: `docs/PROVA-DEVICE-F02-F01-F13-F12.md`, sezione F13. |
| F41 | Corretto nel codice, da verificare in sala | 48 test frontend passati | `7a1f245` | Basket fuori da scaletta, regia, manuale e demo; dopo l'atto 2 nessun bonus sostitutivo. |
| F04 | Corretto nel codice, da verificare su telefono | **36 test remoti + 2 backend** | `dc97d3f` + `b6afb48` + `ba4dc04` | Nome rimosso dall'intestazione; ora la TV marca `START_VOTING` sul server e lo snapshot espone `announced`. Prima dell'annuncio il telefono resta in attesa, anche durante l'animazione. Il flag è in un blob e sopravvive al riavvio; manca la prova con un telefono reale. |
| F39 | Parziale | Due test H2 isolati passati | `42e74d4` | Il vecchio correttore eliminava CHECK estranei; aggiornato il solo CHECK riconoscibile, mantenendo valori storici. Restano copia del database della serata e prova TV/telefoni. |
| F29 | Parziale | Test temporizzato Arena passato | `7b54b43` | Restringimento dopo 20 s anziché 45, più graduale; da verificare con giocatori e TV. |
| F30 | Parziale | Due test Arena passati | `a63b7cd` | Movimento giusta −5 e sbagliata +12 anziché −10/+15; bilanciamento reale da verificare. |
| F31 | Corretto nel codice, da provare con più telefoni | **49 test remoti** | `cdbc2be` + `ae3d658` + `77fed6e` + `8454861` + `8b8bbc5` + `fd66b8a` + `c7bb024` + `5f23a2b` + `676baef` | Il doppio tocco non duplica l'invio; risposte e domande tardive sono invalidate al cambio round. Dopo una conferma persa il telefono conserva la scelta per ritentarla; il riallineamento e la sessione non attribuiscono domande al round o giocatore sbagliato, e attendono il via della TV. Resta la prova con latenze e più telefoni reali. |
| F15 | Parziale | 10 test Quiz/tempi e 2 backend passati | `92d2781` | Manche da 15 s anziché 10, con valore proporzionale al tempo e finestra server allineata; da provare in sala. |
| F16 | Corretto nel codice, da provare in sala con più telefoni | **88 test remoti, 10 test controller e test WebSocket a due telefoni** | `40c2767` + `b385571` + `3257054e` + `07169f9d` | I topic seguono l'ID iniziale e quello adottato; se il primo `START_VOTING` va perso, il solo `QUIZ_STATE` imposta Quiz, round attivo e votazione. Gli annunci Quiz ora vengono pubblicati dentro il `withRoundLock` dell'apertura, non più col valore di ritorno del metodo `@MessageMapping` (che il framework spediva fuori lock e una seconda volta); portano `roundStartId` e `roundStartedAt` autorevoli del server e il telefono scarta quelli di un'altra apertura o più vecchi. Il test a due client WebSocket reali verifica che dopo il cambio round non arrivi l'annuncio vecchio e che il nuovo arrivi una volta sola. Resta la prova in sala: TV reale, due telefoni fisici, primo round e refresh durante il round. |
| F05 | Corretto nel codice, da verificare in serata | 38 test backend (inclusa l'espulsione) e 53 frontend mirati | `c3d9bd3` | Solo la regia espelle: il token vecchio non vale più, il nome torna libero per un rientro volontario e il telefono torna al setup. I punti già presi restano in classifica; nessuna prova con telefoni reali. |
| F09 | Corretto, verificato a 720p in locale, da vedere in TV | 37 test mirati | `de0bcdd` + `78f0e32` | A fine reveal il tabellone si compatta; oltre dieci squadre passa a due colonne, oltre sedici a tre. Misurato a 1280×720 sul componente Angular vero, con avatar e palette delle squadre: con 12 squadre righe da 94px, con 16 da 69px, nomi a 21,6px, nessuna riga fuori dal riquadro e nessun nome troncato (`docs/screenshots/f09-classifica-rapida-12-squadre-720p.png` e `docs/screenshots/f09-classifica-rapida-16-squadre-720p.png`). Con 18 squadre le righe misurano 96px e con 20 misurano 81px, tutte dentro il riquadro; con 28 squadre la griglia stringe a dieci righe da 54px senza tagliare nessuna riga, e se cresce ancora la classifica scorre invece di tagliare (`docs/screenshots/f09-classifica-rapida-18-squadre-720p.png` e `docs/screenshots/f09-classifica-rapida-20-squadre-720p.png`). Fino a dieci resta la colonna singola. Da guardare su TV vera dal fondo sala: la misura locale non dice la percezione a distanza. |
| F35 | Corretto nel codice, da verificare in sala | 35 test mirati | `74e2ba3` | Il telefono mostra il timbro VIA e una vibrazione più netta quando parte il cronometro, oltre al cambio ATTENDI/STOP. |
| F33 | Verificato, nessun cambio di banca | 2 test payload | `d09da92` | Le fasce 100/200 facile, 300/400 media, 500 difficile sono rispettate in tutte e 16 le categorie; la difficoltà reale ora viaggia nel payload e un test la protegge. La percezione «facile» resta soggettiva. |
| F24 | Verificato su viewport telefono | Misura 320×568 + scroll | — | Con 16 caselle il contenuto scorre di 560 px e l'ultima casella è interamente visibile; nessuna casella resta irraggiungibile. Nessun cambio CSS necessario. |
| F25 | Corretto, verificato nei test | **55 test frontend + 5 backend mirati passati** | `1426613` | Il server emette l'evento `bomb` alla scelta: TV e telefono mostrano subito l'esplosione, la penalità si applica una volta sola e gli altri esiti restano nascosti fino a fine ondata. Anche il turno scaduto ora scala la penalità in TV. |
| F20 | Corretto, da provare in sala | **55 test frontend passati** (immagine, tempi/manuale, remoto, TV) | `9ff8aa6` | Un indizio ogni 6 s anziché 15 e fino a 8 indizi per biografia; manuale, demo e test allineati. Resta da provare in sala che il ritmo sia leggibile. |
| F10 | Corretto, verificato nei test | **22 test TV passati** (2 nuovi) | `e4b0e7e` | La categoria si sceglie tra quelle uscite meno nella serata: niente più Storia dominante per caso puro. Timeline resta sulle categorie con eventi. Da confermare su più scalette in sala. |
| F26 | Parziale | **31 test Bomba/remoto passati** | `e21276f` | Flash, vibrazione e sirena sul telefono di chi prende la bomba; la TV scrive bomba e tempo scaduto. Suono e vibrazione reali restano da provare su dispositivi; chi non può vibrare vede comunque il testo. |
| F32 | Parziale, da provare in sala | **8 test Arena frontend, 4 ArenaInactivity, 5 RoundPause e 46 remoti** | `fe2844d` + `fca9acd` + `45fb185` + `cb0b141` + `e145232` + `e470134` + `7aa5be0` | Dopo 15 s senza risposte la squadra viene spinta di +12; il server conserva nel blob i totali cumulativi, la TV applica gli incrementi e recupera una risposta del tick persa. La pausa è accreditata alla ripresa anche senza polling; una risposta non cancella penalità già maturate. Resta la prova in sala; la ripresa TV dell'Arena ora è collegata (F06), quindi i progressi non si perdono più al refresh. |
| F01 | Parziale | **5 test guardie passati** | `65ea3f2` | La decisione mobile si prende una volta per sessione e i redirect usano `replaceUrl`: il rimbalzo /tv ↔ /play dovuto a Safari che espone il touch in ritardo non può più accumulare navigazioni. Riproduzione su iPhone reale non eseguita. Foglio di prova: `docs/PROVA-DEVICE-F02-F01-F13-F12.md`, sezione F01. |
| F34 | Corretto, verificato nei test | **24 test TV passati** (2 nuovi) | `6157b69` | Il ripristino non fa regredire la scaletta quando il server conta meno round (round saltati con AVANTI): sparisce il meccanismo che poteva rigiocare una sesta Ultima spiaggia. La causa esatta in sala resta da confermare con i log. |
| F07 | Diagnosi fatta, nessun cambio | Lette tutte le sequenze di avvio | — | Quiz e Celebrità passano 10 s, Arena 5 s, Timeline 4 s, gli altri 3 s, Ultima spiaggia 1,2 s. `runPreGameSequence` ignora però il valore e avvia subito il timer (commento nel codice: scelta voluta). Per garantire «nessuna partenza prima che l'istruzione sia fruibile» serve una decisione: aggiungere una vera fase di lettura o accettare l'avvio immediato. Nessun test può dimostrare la leggibilità in sala. |
| F37 | Corretto nel codice, da provare in sala | **3 test RoundPause + 2 test TV + 119 backend** | `6dfa68b` + `10c6f6e` + `7e57c6a` + `7326aee` | La pausa TV chiama il server, sposta la deadline alla ripresa e Speed Rush rifiuta le risposte. È salvata nel blob di partita, quindi un riavvio non la perde. Lo snapshot espone anche `pausedAt`: una TV aggiornata durante la pausa vede il round fermo, calcola il tempo residuo dallo stop e toglie la pausa sul server prima di ricostruire il round. Resta la prova in sala. |
| F43 | Corretto nel codice, da provare con più telefoni | Suite remoti e backend | `e889b44` | Arena: il retry quando il round non è ancora aperto scende da 1 s a 150 ms e la pausa dopo un errore da 1,5 s a 600 ms. La risposta corretta chiede già subito la domanda successiva. |
| F44 | Corretto nel codice, da ascoltare in sala | **3 test nuovi (MusicMode, Song, TV)** | `bde3667` | La conferma corretta salta l'intro filtrata: brano pulito subito, 30 s con dissolvenza negli ultimi 5 e passaggio automatico al round dopo la fine. Se è in corso una classifica, resta il presentatore a chiuderla. |
| F36 | Parziale | **7 test backend Speed Rush + 36 test remoti** | `6dd97db` | Undici microgiochi: ai sei precedenti si aggiungono i quattro storici recuperati dalla storia (tap, intruso, ordine, reazione) e il geografico con 42 città divise per difficoltà. Varietà e bilanciamento restano da provare in sala. |
| F38 | Parziale | **7 test Speed Rush** (contratto minimo aggiornato) | `83c8759` | Il traguardo richiede **28** risposte corrette in 90 s: le prime sei valgono 2, dalla settima il raddoppio porta 4. La difficoltà sale a 35 e 70. Resta la prova con più giocatori per capire se il percorso è troppo corto o troppo duro. |
| F06 | Completo (Arena, Bomba, Quiz, Speed Rush, Timeline, Blackjack, Ruota, Celebrità, Time Buzzer, Azzardo, Tennis, Ultima spiaggia, Canzone, Biglie, bonus Casino, bonus Blackjack e bonus Cavallo riprendibili; punti del vincitore del round e coda di scrittura della classifica conservati al refresh) | **11 test Arena, 4 Bomba, 17 Quiz, 5 Speed Rush, 60 test TV, 3 test Casino, 5 test Blackjack bonus, 6 test Cavallo bonus, 7 test Canzone, 5 test Biglie, 4 test Ruota, 4 test Celebrità, 5 Time Buzzer, 5 Azzardo, 8 Tennis, 7 Ultima spiaggia, 9 RoundPause, 8 backend Speed Rush, 10 backend Quiz e 1 test WebSocket mirato** | `274ec74` + `4e00cb4` + `246cfe7` + `c2bc66f` + `e1557bf` + `8eda292` + `a281c2f` + `95eee1f` + `959dec1` + `f559811` + `876a754` + `97f924c` + `7734e15` + `d7790fa` + `14b4d21` + `b159d69` + `8154eda` + `929f399` + `4d1764e` + `786d32f` + `15f8475` + `23c24aa` + `0443156` + `20e6b0c` + `82fb485` + `a6ffb4c` + `6fab892` + `d96a28f` + `e0988d9` + `83b78e3` + `5cd3e78` + `db2d981` + `0932ee8` + `060054e` + `b16ec0b` + `50ed526` + `3257054e` + `283a05e5` + `07169f9d` + `5d4b76ad` | Ripresa di classifica, Timeline, Blackjack, Arena, Bomba, Quiz e Speed Rush; alla ripresa da pausa la TV avvisa anche i telefoni e il telefono riconosce il round aperto durante una pausa lunga. Arena: il tabellone è salvato sul server a ogni risposta e penalità, legato al round aperto e con revisione crescente; la TV lo riapre con il tempo residuo e un checkpoint di un altro round viene scartato. Un checkpoint corrotto riporta la TV al pannello invece di aprire un round vuoto. Bomba: il tabellone è già sul server e la TV salva la sequenza di eventi applicati, così al ritorno una bomba conta una volta sola. Un solo checkpoint per partita (`tvCheckpoint`), legato alla modalità del round: Arena, Bomba e Quiz condividono endpoint (`/tv-state`) e campo, senza rami per gioco; Speed Rush non ne ha bisogno, perché le corsie sono già sul server. Quiz: la TV salva manche, risposte, stadio (gioco, suspense, soluzione) e l'istante del salvataggio, e non il cronometro a ogni secondo: il tempo trascorso si ricava da `savedAt`, fermo in pausa. I voti sono autoritativi sul server: la TV annuncia la manche, il telefono manda solo l'indice e il server controlla tempo, soluzione e doppio voto, trasmettendo `QUIZ_ANSWER`; le risposte restano nel blob `quiz` e la TV le rilegge dopo un refresh. Alla ripresa la manche viene riannunciata con i secondi rimasti: se il backend è ripartito o la finestra si era chiusa, i telefoni possono votare di nuovo e i punti non ripartono pieni. Speed Rush: la TV non salva nulla; al ritorno rilegge le corsie dal server (`start` è idempotente sullo stesso round), riparte dal tempo che resta e non riavvia la corsa, quindi gli avanzamenti non si perdono. Bonus Casino (colore, dozzina, numero secco): la TV salva nel `tvCheckpoint` voti, numero uscito, punti e istante del salvataggio, senza legarlo a un round. Dopo un refresh il bonus riapre la manche con il tempo che resta; se la pallina era già uscita, rigira verso lo stesso numero (l'esito non cambia) e non ricalcola i punti. Alla chiusura il checkpoint viene cancellato (`state: null`), così un refresh successivo non riapre un bonus già pagato. Ruota: la TV salva lettere uscite e punto del mazzo, e alla ripresa rimette lo stesso mazzo salvato invece di ricostruirlo. Celebrità: sfocatura e indizio si ricostruiscono dal tempo trascorso dal salvataggio, senza salvare il cronometro a ogni secondo. Bonus di fine atto: la TV scrive `bonus-act` sul server all'avvio e alla chiusura; dopo un refresh riapre il bonus ancora avviato (Casino dalla manche, Cavallo e Blackjack dall'inizio) e non ripete uno già pagato. Gli atti chiusi restano chiusi anche con uno snapshot stantio, perché la TV li ricorda per partita in storage. Time Buzzer: il via è già sul server e la manche riparte dal checkpoint con tempi, eliminati e bersaglio; se era già rivelata i punti non si ricalcolano. Azzardo: fiches, puntate e conversioni nel checkpoint, reveal già pagato non ricalcolato. Tennis: campi, punteggi, killer point e domanda corrente nel checkpoint, set chiusi non ripagati; alla ripresa la banca domande si rilegge e le sfide già decise chiudono il round subito. Ultima spiaggia: livello scelto, risposte, esiti e livelli consumati nel checkpoint, con lo stesso id dell'occorrenza così i telefoni non azzerano la scelta; reveal già pagato non ricalcolato e stato rimandato ai telefoni anche quando il round era già chiuso. Bonus Blackjack: la mano (mazzo, carte, tavoli, fase, tempo) vive nello stato Blackjack del server, al refresh riparte dov'era senza ridistribuire e i tavoli chiusi tornano come punti. Bonus Cavallo: voti della categoria, domande caricate, tabellone e fase nel checkpoint TV, con la rush che riprende dal tempo rimasto e il podio pagato una volta sola. Canzone: manche, secondi rimasti, pausa fra gli ascolti e prenotazione nel checkpoint; al refresh il conteggio riparte dal tempo che resta (l'audio riparte dall'inizio del brano) e un brano già rivelato non si ripaga. Biglie: biglie assegnate, gare chiuse, classifica e tabellone nel checkpoint; la fisica di Matter non si riprende, quindi solo la gara in corso si rigioca e le gare già pagate non vengono rimandate. Punti del round e coda classifica: il conteggio che decide il tema del vincitore sta in storage con l'indice del round e si ricarica alla ripresa; la scrittura di classifica accodata (debounce 250 ms) è persistita e rimandata al server appena lo snapshot arriva, così un refresh non lascia il tabellone indietro. Cavallo e Blackjack non salvano l'avanzamento parziale; il round Biglie resta da chiudere. Quiz: l'annuncio è legato all'apertura effettiva e consegnato dentro il lock; la ripresa legacy ambigua resta bloccata e il primo blob legacy viene archiviato in `quiz-legacy-archive` prima di un nuovo Quiz. Restano la prova in sala di un refresh TV durante l'annuncio Quiz e la copia di un database precedente. |
| F08 | Corretto, da guardare in TV | **6 test classifica passati** (1 nuovo) | `5fde732` | Quinto e quarto posto hanno un richiamo sonoro a due note e pause più lunghe (2,4 s e 2,8 s); podio e tempi finali invariati. La resa in sala non è stata vista. |
| F22 | Corretto, da provare in sala | **3 test Celebrità passati** (1 nuovo) | `1aaea1a` | La sfocatura scende con curva non lineare: 40 → circa 25 dopo 10 s, ancora velata fino agli ultimi indizi, 0 a fine round. |
| F23 | Parziale | **1 test layout + verifica 320×568** | `ad8786c` + `75d5c9d` | Testo delle carte Timeline leggibile e contenuto nella riga: a 320×568 le sei etichette stanno su due righe, `scrollHeight` = `clientHeight`, nessun testo fuori dalla carta. Drag e contenuti invariati. Resta la prova su Android/iPhone reali. |
| F27 | Parziale | `ScossaBoardTest` verde | `76af6a4` | Il tabellone non si presenta più come «quale NON appartiene»: ora è un'istruzione di gioco. La banca più varia e impegnativa richiede una revisione dei contenuti, non automatizzabile. |
| F18 | Parziale | 4 test componente verdi | `d765e7f` | Prima manche meno filtrata (taglio 1900 Hz, drive 500) per renderla riconoscibile mantenendo la sfida. Nessun ascolto reale: il bilanciamento va provato in sala. |
| F19 | Parziale | 4 test componente verdi | `d765e7f` | Seconda manche leggermente meno nitida (taglio 2050 Hz, drive 450), così il salto dalla prima è graduale senza invertire l'ordine. Ascolto comparativo da fare. |
| F11 | Parziale | Audit su 991 domande + test banca | `1bf3655` | Nessun doppione tra le opzioni. Cinque domande contenevano la risposta nel testo (Colosseo/Roma, decompositori, Sherlock, Downton Abbey, GPT) e sono state riscritte. La plausibilità dei distrattori e le ambiguità sottili restano da rivedere a mano: non sono automatizzabili. |
| F12 | Corretto nel codice, verificato a 720p, da verificare in sala | **17 test sul servizio tema + 12 test TV + 7 test classifica + suite completa (434 test, 49 file)** | `7bef10e` + `5e6ae32` + `04d7576` | Ogni squadra senza scelta riceve una palette distinta all'ingresso (le sette palette della serata; l'acido resta per l'ottava e poi il giro riparte), salvata in `localStorage` così il refresh della TV non cambia i colori. La scelta dal telefono ha sempre la precedenza. Il round dopo adotta sempre il tema del vincitore: prima restava acido perché nessuno aveva scelto. Sui tre posti del podio il nome resta inchiostro, perché con il tema del round il colore della squadra finiva sopra un fondo della sua stessa famiglia (OCEANO: sotto 2,5:1; ora tutti sopra 4,6:1). Le palette assegnate si liberano quando la squadra viene espulsa senza punti e si azzerano con una partita nuova o il reset, così molti rientri non esauriscono i colori; chi è espulso con punti tiene il suo colore; anche la palette scelta dal telefono viene liberata all'espulsione senza punti. La TV ricorda l'ultima palette di ogni nome: al rientro la squadra la ritrova se è ancora libera, altrimenti ne riceve un'altra e quella resta la sua. Sia le assegnate sia le scelte si salvano su disco, quindi un refresh della TV non rimescola i colori. `JOIN_GAME` porta il `deviceId`: un telefono che rientra con un nome nuovo resta la stessa squadra (palette, memoria e punti seguono il nome, compresi i punti del round in corso), mentre un telefono diverso è una squadra nuova. In lobby le righe a zero punti delle squadre non più collegate spariscono e liberano la palette, ma solo dopo due fotografie consecutive senza e per chi era già stato visto: una rilevazione in ritardo non fa sparire chi è appena entrato. Chi ha punti resta. Verificato a 1280×720 con dieci squadre e due vincitori diversi (`docs/screenshots/f12-tema-vincitore-720p.png` e `docs/screenshots/f12-tema-vincitore-anna-720p.png`). Da guardare in sala: la percezione «di che colore era il tema?» non si misura in locale. Foglio di prova: `docs/PROVA-DEVICE-F02-F01-F13-F12.md`, sezione F12. |
| F21 | Corretto, verificato nei test | **5 test backend passati** (`CelebrityClueLeakTest`, inclusa tutta la banca locale) | `3555a61` + `ecdd396` | Gli indizi scartavano il nome intero ma non il solo cognome o nome; ora il filtro copre anche i nomi corti da tre lettere («Tom», «Bob», «Lee») e un test percorre tutte le 150 persone della banca locale. La qualità manuale dei contenuti resta da rivedere. |
| Suite complete | Verificate | **258 test frontend (40 file) e 119 backend passati** | — | Eseguite dopo F45/F46 e i fix del 15/11: includono scaletta, cinque bonus, Biglie, Casino bianco/rosso, Basket rimosso, Cavallo riallineato, Timeline telefono, recupero TV della pausa e avvisi di rete sul telefono. |
| F45 | Corretto nel codice, da provare in sala | **253 test frontend (40 file), 117 backend** | a0045c2 | Quattro Biglie come round separati; Blackjack fuori dai round; Bomba 2, Tennis 2, Speed Rush 3; Arena 24/40 e Ultima 8/16/23/32/39 invariate. I punti delle quattro gare Biglie entrano in classifica a ogni arrivo. |
| F46 | Corretto nel codice, da provare in sala | **8 test nuovi (bonus, BiglieMode, colori) + suite complete** | a0045c2 + 8789492 | Cinque bonus uno per atto: Casino bianco/rosso +100, Blackjack +150/+75, Casino dozzina +120, Cavallo podio +200/+100/+50, Casino numero secco +300. Ingressi con luce, buio, scossa e allarme, ridotti con `prefers-reduced-motion`. Punti bonus incassati una volta alla chiusura; dopo l’atto 5 torna la classifica finale aggiornata. |
| F47 | Corretto | Audit di manuale, presentazione, README e PDF; 7 pagine per entrambi i PDF, nessuna dicitura vecchia | `4e7bac0` | Rimossi Black Jack dai round, Basket dalle guide, vecchi punti bonus e la scaletta precedente. PDF colore e B/N rigenerati. |
| F48 | Corretto | **250 test frontend** | `e8e7fd8` | Rimossi rami BONUS_BASKET, punteggi canestri e variabili morte da TV, regia e telefono. |
| F49 | Corretto, verificato a 720p | 63 test TV/remoto | `3c184ce` | Bonus Cavallo riportato a carta/inchiostro; guardato a 1280×720 con otto giocatori. |
| F50 | Corretto, da provare in sala | **253 test frontend (40 file)** | `8789492` | Casino bianco/rosso: griglia e ruota ora usano BIANCO/ROSSO; 3 test sul mapping 0/rosso/bianco. |
| F51 | Corretto, verificato a 720p | **253 test frontend + build dev** | `fd45802` | I numeri dei vani bianchi erano carta su carta perché la skin globale forzava il fill. Ora sono inchiostro; controllo a 1280×720 e computed style `rgb(21,21,15)`. Telefono non interessato. |
| F56 | Corretto nel codice, da provare in sala | Audit banche + suite backend/frontend | `c07c5c4c` + `521028ea` + `e4ec59d4` | Difficoltà normalizzate in italiano, 11 doppioni rimossi, posizione delle risposte bilanciata, copertura categorie ripristinata. L'audit ora dà 0 doppioni, 0 segnalazioni e 0 campi mancanti; le 47 risposte più lunghe sono state riallineate e `C#`/`L'` non sono più falsi positivi. Restano 69 buchi di Ultima spiaggia (circa 447 domande alla soglia di 12) e 3 soli eventi Timeline di difficoltà 5, elencati in `docs/BANCHE-AUDIT.md`. |
| F57 | Corretto nel codice | Test Timeline, Scossa, RankPoints | `2883eea6` + `07e18f1d` | Timeline a 211 eventi con difficoltà e fonte, otto per round; Bomba con affermazioni vere/false e fonte. |
| F58 | Corretto nel codice, da provare in sala | Suite completa | `67577280` + `ef2172d0` | Nuovi punteggi di Musica, Timeline, Time Buzzer, Speed Rush, Biglie, Tennis e Bomba; rankPoints condiviso fra frontend e backend. Massimi e minimi vanno discussi con N = 6 e N = 10. |
| F59 | Corretto nel codice, da provare in sala | Test bonus e TV | `bbfd3426` | Casino a tre girate (100/200), numero secco da 500, finestra di scelta da 10 s; Blackjack e Cavallo con premio gestito da barista e presentatore, fuori dall'app. |
| F60 | Corretto | Suite completa | `17c70435` + `a6ff572a` | Manuale, demo, README, presentazione e descrizione allineati ai nuovi numeri; `SECONDA-SERATA.md` rimosso. PDF colore e B/N rigenerati. |
| F52 | Corretto, verificato a 720p | **253 test frontend + build dev** | `7193495` | A 720p il tabellone Cavallo tagliava gli ultimi due di otto giocatori. Passo riga ora fluido (`clamp(52px, 7.4vh, 84px)`), posizioni con `calc`; a 1281×721 tutte le otto righe sono dentro card e viewport. |
| F53 | Verificato su viewport telefono | CDP touch 320×568 + click reale | — | Casino numero secco: 37 caselle, griglia scrollabile fino a `scrollTop 332/332`; il 36 è visibile e selezionabile. Anche colore e regole entrano nella viewport. Nessun difetto di prodotto da correggere. |
| F54 | Corretto, verificato senza backend | **2 test retry + verifica 320×568** | `075bd23` | Il telefono mostrava «Sincronizzazione non riuscita» come testo grezzo sopra il gioco. Gli errori di rete ora restano sul badge OFFLINE; il sync iniziale viene ritentato al primo heartbeat riuscito. Gli errori d'azione restano visibili nel timbro carta/inchiostro. |
| F55 | Corretto, verificato a 320×568 e 1280×720 | **258 test frontend** | `8a25a48` + `ea54377` | Il badge connessione usava pillola, fondo scuro traslucido e colori fuori palette. Ora è un timbro carta/inchiostro con radius zero, ombra offset e stati mint/mustard/tomato; nessuna animazione decorativa. Sulla TV è stato abbassato sotto la dock, che prima lo copriva. |
| A1 | Fatto | 1 test Casino (una girata sola per manche) + suite completa 70 file / 701 test; build frontend | `7f44d583` | Numero secco a tre girate, `mustWin`, ciclo di rigiro e fase `RESPIN` rimossi; demo, manuale e tabella punteggi aggiornati. |
| A2 | Fatto | Suite completa 70 file / 701 test; build frontend | `ad9857d1` | Testo di `SCORING_RULES`, demo e manuale allineati a `QuizService`. |
| Quiz, punteggio (23/11) | Fatto | `QuizServiceTest`, `scoring-rules.spec`, suite completa | — | Il round vale 1000 in tutto e la penalità è la quota scalata dal tempo: niente più −1000 fissi, il round va da −1000 a +1000. |
| Banche, completamento (23/11) | Fatto | `node scripts/audit-banche.mjs --ci`: 0 doppioni, 0 campi mancanti, 0 buchi | — | Bomba da 95 a 110 affermazioni (4 coppie mancanti completate + 6 nuove), anno di «Boulevard of Broken Dreams» = 2004 nella banca locale, 8 coppie con nome lungo rivedute a mano. |
| B3 | Fatto | `npm run audit:banche`: 0 doppioni, 0 campi mancanti sulle nuove banche | `8bfd57a8` | Audit esteso a Indovina chi (150), Musica (114), Ruota (32 frasi) e Bomba (95); dubbi in `docs/DOMANDE-DA-REVISIONARE.md`. |
| B1 | Fatto | `UltimaSpiaggiaPayloadTest` (2 test) in H2; audit con 0 buchi | `99596d69` | Cinque fasce reali, 80 domande dedicate (16 categorie × 5), nessun ripiego di fascia. |
| B2 | Fatto | Campione riproducibile (seed 20261123) | `745c0f38` | 30 domande per fascia con risposta e distrattori, da giudicare a mano. |
| B4 | Fatto | Documentazione | `e008904a` | Banca media locale: generazione, audit e test documentati. |
| D1v | Fatto | Ricerca di «2.1.0» nei documenti di versione: 0 | `4f7865eb` | README, presentazione, deploy, avvio serata e `start-8090.cmd` a 2.2.0. |
| D2v | Fatto | Questo blocco | — | Intestazione, tabella breve di stato e chiusura F45–F55. |
| D3v | Fatto | Scansione con riferimenti | — | `docs/CODICE-NON-USATO.md`: nessun servizio rimosso, tutti hanno chiamanti o test. |
| D4v | Fatto | Manuale e PDF rigenerati | — | Testo Quiz e numero secco aggiornati; PDF colore e B/N rifatti. |
| Altre voci | Da fare o da verificare | — | — | F18/F19 sono stati ritoccati ma richiedono ascolto reale; F23 e F24 richiedono telefoni veri; F36/F38 sono contenuti e bilanciamento da provare in sala; F37 richiede una prova reale in sala; F39 una copia del database della serata; F21 una revisione manuale dei contenuti; F56 lascia 69 buchi di Ultima spiaggia e pochi eventi Timeline di difficoltà 5; F40/F42/F14 richiedono una decisione. F28 (Azzardo) resta in pausa. Nessuna prova su telefoni, audio o TV reali è stata eseguita. |

### Registro stress test (23 novembre 2026)

| ID | Stato | Prova | Commit | Note |
| --- | --- | --- | --- | --- |
| P1 (stress) | Aperto, P1 | `npm run stress:restart` + `kill -9`: 1 perdita su 7 prove | — | Dopo un crash il token admin ha risposto `401`, l'heartbeat `410 session-unknown` e lo stato è ripartito da `CREATED` (`stateVersion 0`): round e sessioni persi. Non riprodotto in 6 tentativi. Dettagli ed estratto di log in `docs/STRESS-REPORT.md` §3.1 e §7. |
| P2 (stress) | Aperto, P2 | `GET /games/{id}/diagnostics` su partita `CREATED` | — | Riporta `roundOpen: true` con `roundType: null`: la diagnostica può far credere che un round sia aperto. `ReliabilityController.diagnostics`. |
| P3 (stress) | Aperto, P3 | `npm run test:frontend` senza ffmpeg | — | Due test di loudness si saltano: la suite dichiara 703 test ma ne esegue 701, anche in CI. `loop-loudness.spec.ts`. |
