# PubGame — rapporto della prima serata e percorso verso la prossima versione

## Scopo e metodo

Questa è la lista di lavoro nata dalla prima serata completa, con **6 partecipanti**, dalle valutazioni raccolte in sala e dalla specifica allegata `SPEC-BIGLIE-E-AUDIO.md`. Il file della specifica è stato fornito in chat: **non è presente nella radice del repository**. I suoi requisiti sono riepilogati qui per non perdere il lavoro.

La versione dichiarata nel progetto è **2.1.0**; riferimento del codice esaminato: commit `7bb9c6f`. La successiva versione **non è ancora fissata**: una minor, ad esempio 2.2.0, è una possibilità se si aggiungono funzionalità compatibili; scegliere major/minor/patch solo in base ai cambiamenti effettivi e alla compatibilità. Non modificare `VERSION`, changelog o tag prima di definire la release.

**Regola concordata:** prima si concordano la lista e l'ordine; poi **un intervento alla volta**, senza fix collaterali. Una voce può comprendere codice, test e documentazione strettamente necessari alla stessa correzione. Verifica mirata e, quando richiesto dalla specifica o dal progetto, build e test pertinenti; un commit per intervento/blocco dopo le verifiche, su richiesta già concordata, senza push o tag automatici. I controlli visivi richiedono TV e telefoni anche a 720p e rispetto dello stile `AGENTS.md`. Nessuna voce va segnata chiusa finché non è verificata; segnalare esplicitamente ciò che richiede una prova reale.

**Legenda**: P0 = rischio che impedisce di entrare, proseguire o salva risultati errati; P1 = importante per la prossima serata; P2 = miglioria da pianificare. L'ordine entro ogni gruppo è proposto, non una priorità imposta. Stato iniziale: **da verificare / da fare** per tutte le voci, salvo indicazione diversa.

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
- **F32 [P1] Inattività:** limite di tempo per rispondere, così chi resta fermo al centro non vince senza rispondere. Definire penalità e sincronizzazione, applicarle anche dopo riconnessione.

### Ultima spiaggia — promosso, da controllare

- **F33 [P1] Difficoltà banca:** domande facili sono uscite negli slot da 400/500; verificare categorie e livelli, revisionare e testare i dati.
- **F34 [P1] Frequenza:** osservati sei round nella serata. La scaletta statica `schedule.ts` ne prevede **cinque** (8, 16, 23, 32, 39); questo non spiega da solo ciò che è successo. Ricostruire avanzamento, eventuale ripetizione/refresh e log, poi correggere la causa se riproducibile.

### Time Buzzer

- **F35 [P1] Via chiarissimo:** presentatore e gioco devono far capire quando iniziare a contare; segnali TV/telefono e audio coerenti con l'istante effettivo, verificati sui dispositivi. La TV già ha countdown e timbro «VIA»; il telefono passa da «ATTENDI» a «STOP»: migliorare il segnale effettivamente percepito.

### Speed Rush — piaciuto tantissimo

- **Situazione verificata nel codice:** cinque tipi nel servizio server: **matematica**, **miscuglio di colori**, **bandiere**, **sinonimi/contrari**, **traduzione**. Il server evita il tipo immediatamente precedente e tenta di evitare prove ripetute, ma dopo 60 tentativi può accettarne una ripetuta; la difficoltà è EASY sotto 35% di avanzamento, MEDIUM sotto 70%, HARD dal 70%. Non tutti i tipi sono necessariamente differenziati allo stesso modo per difficoltà. Esiste anche un mazzo frontend con gli stessi cinque tipi: non assumere che sia la fonte delle prove server.
- **F36 [P1] Varietà:** aggiungere microgiochi e contenuti realmente diversi, scegliendoli e bilanciandoli; evitare ripetizioni percepite, verificare generazione/validazione lato server e interfaccia telefono.
- **F37 [P1] Durata:** portata nominalmente a 90 secondi nel timer TV, nel servizio server, nel payload e nelle indicazioni. Resta da sincronizzare la pausa con la deadline e da verificare in sala.
- **F38 [P1] Tracciato più lungo:** ricalibrare l'avanzamento insieme alla nuova durata; difficoltà più alta a metà e fine percorso, senza fare arrivare tutti troppo presto o impedire arrivi. Provare con tempi reali di più giocatori.

### Tennis

- **F39 [P0] Avvio:** durante la serata non è partito; esiste un errore H2 sul vecchio vincolo del tipo. Verificare la migrazione esistente su copia di database con schema precedente e su database nuovo; nessuna rimozione indiscriminata di vincoli, nessun dato perso. Verificare apertura del round e gioco su TV e telefoni. Il fixer committato non equivale a una fix verificata.

### Casino

- **F40 [progettazione]** Giudizio ottimo; capire quale manche va sistemata e se la proposta «una manche» riflette l'intento. Progettare il passaggio a round e l'eventuale bilanciamento punti soltanto dopo la decisione, senza alterare il gioco apprezzato.

### Basket e Cavallo

- **F41 [P1] Basket fuori dalla serata:** rimuovere disponibilità in scaletta e regia, aggiornando indicazioni necessarie; non cancellare in blocco dati/codice senza necessità.
- **F42 [P1 / scelta formato] Cavallo:** non ha funzionato: scelta categoria non vista e domande per tutti. Prima riprodurre il flusso TV, voto telefono, scelta, domande e log; poi decidere come deve funzionare e se conservarlo. Non considerare provata la causa dei voti scartati.

## Biglie — specifica da implementare in blocchi isolati

**Feedback:** bellissimo. Non cambiare scelta unica delle biglie, regole dei punti o risultato senza una decisione separata. Ora ci sono quattro fondi (Rally, F1, Neve, Acqua), quattro gare, punti per gara **150/100/60/30**, e chiusura a **38 secondi** con ordinamento per posizione/distanza residua. La specifica richiede 30–45 secondi e limite a 45 secondi: questo tocca un comportamento temporale esistente e va verificato come requisito distinto, senza alterare la classifica o introdurre un cambio di regola nascosto.

### Diagnosi confrontata con il codice

- `biglie-bonus.component.ts`, `layoutTrack` / `createPhysics`: **confermato** che la pista disegnata usa onde sinusoidali mentre le pareti fisiche delimitano un corridoio rettilineo. Non significa che tutta la fisica sia finta: Matter gestisce scontri tra biglie, due isole fisiche per i bivi, sensori e ostacoli solidi (sassi/scogli).
- **Confermati** `TRACK_WORLD_LENGTH = 3600`, due bivi fissi `BIFURCATIONS`, piani ostacoli `HAZARD_PLANS` con sequenze fisse per fondo e posizionamento variato dal seme. I fondi modificano pesi e ostacoli, alcuni dei quali hanno effetti fisici.
- C'è un generatore con seme e un passo fisso Matter, **ma il seme da solo non dimostra replay identico**: contano anche input iniziali, ordine e tempi della simulazione. La fisica usa `raceElapsed` e l'aggiornamento per frame ha un limite di passi: riproducibilità e durata devono essere misurate. Alcuni effetti grafici usano `Math.random`, distinti dalla logica di gara.
- `MARBLES` contiene otto profili base, ma `buildMarbleSet` crea ID distinti aggiuntivi se i partecipanti superano otto. La prova con dieci biglie non può essere data per passata senza misurarla.

### Blocchi, nell'ordine richiesto dalla specifica (dopo Audio A1–A3)

- **B1 — separazione senza cambiamento di comportamento:** estrarre geometria/generatore, fisica e disegno testabili; preservare l'aspetto e l'esito corrente nel limite verificabile. Nessuna modifica a scelta, punti e risultato.
- **B2 — geometria e fisica condivise:** profili differenti per i quattro fondi; curve, S, chicane e tornanti fisici; larghezza variabile, bivi con ricongiungimento; utilizzare la stessa geometria per bordi Matter e renderer. Considerare spline e rumore solo se utili, preferendo Matter e casualità già presenti; librerie aggiuntive solo dopo valutazione.
- **B3 — pezzi e interazioni:** rettilinei, strozzature, imbuto, pendenze/rampe, perni, ostacoli mobili (barra, porta, altalena), zone d'attrito e correnti; profili coerenti per fondo. Statistiche delle biglie come proprietà fisiche, scontri e sorpassi verificabili. Non promettere esiti imprevedibili o equi senza prove.
- **B4 — validatore:** prima della corsa, geometria valida, larghezza minima 3,2 diametri, pezzi non sovrapposti e ingressi bivi liberi; simulazione rapida non visibile, rilevazione blocchi oltre 1,5 s e scarto/correzione, durata target 30–45 s, controllo statistico di equità delle posizioni di partenza su più prove; poi riprodurre lo stesso risultato in TV. Definire come gestire semi non validi e indisponibilità di validazione senza bloccare la serata. Chiusura di sicurezza a 45 s e posizione per distanza residua secondo la specifica.
- **B5 — test e performance:** almeno **1.000 semi per ciascuno dei quattro fondi** per generatore/validatore; verificare geometria e arrivo riproducibili a parità di input, diversità misurabile con semi diversi, assenza di blocchi e durata. Dieci corse da osservare e prova prestazioni su TV 1080p con 10 biglie e obiettivo 60 fps: sono prove da eseguire e misurare, non risultati presunti.
- **B6 — integrazione audio:** solo dopo i blocchi audio e fisica, urti biglie e roulette collegati a collisioni con intensità proporzionata; evitare raffiche e sovrapposizioni.
- **Documentazione:** aggiornare demo e manuale per descrivere la pista nuova e il formato effettivo, senza dichiarare regole cambiate se non lo sono. UI allineata a `AGENTS.md`.

**Tensioni da risolvere prima di B4:** un limite a 45 s e una validazione che scarta chi non arriva possono cambiare comportamento rispetto agli attuali 38 s; validare in anticipo e poi riprodurre il risultato richiede determinismo degli input e gestione dei ritardi, non basta salvare un seme. Nessuna prova di equità o prestazione discende dal solo test di geometria.

## Audio — specifica da implementare in blocchi isolati

**Feedback:** sottofondo inquietante da sostituire; musica/atmosfera diversa per gioco; migliorare ovunque click, tick, countdown, bombe, successo, errore e suoni dedicati. Ascolto a volume reale indispensabile.

### Diagnosi confrontata con il codice

- `@foleyjs/core` è già una dipendenza. `audio.service.ts` usa Foley per `UI_SOUNDS`, ma lo combina con sintesi Web Audio per diversi eventi; battito, clock, roulette, applausi, rullo e tappeto `pub-bed.ts` sono sintetizzati.
- La diagnosi «solo l'anteprima delle canzoni usa `new Audio(url)`» è incompleta: anche `features/games/azzardo/azzardo.component.ts` usa `new Audio(url)`. L'eventuale motore unico va progettato verificando anche questi percorsi e il mute.
- Non risultano file audio tra `apps/frontend/src` e `apps/frontend/public` nell'ispezione fatta; il backend contiene invece file musicali locali e un indice media. Non confondere musica delle domande con campioni degli effetti. Il commento in `audio.service.ts` sugli MP3 del countdown non prova che esistano.
- `startClock()` arresta il clock precedente, ma battito e clock sono gestiti separatamente: la regola «mai sovrapposti» non è automaticamente garantita. `stopAll()` non ferma il tappeto; la specifica richiede silenzio in pausa, in contrasto col comportamento attuale. `ensureContext()` tenta anche `resume()` quando sospeso: il requisito «solo dopo gesto» va verificato, non dato per acquisito.
- La specifica consiglia Foley per interfaccia e campioni per gli effetti non coperti, ma la compatibilità, le licenze e il bilanciamento vanno verificati caso per caso.

### Blocchi nell'ordine richiesto

- **A1 — catalogo e servizio unico, comportamento attuale invariato:** inventario delle chiamate e degli eventi (UI, risposta, prenotazione, giusto/sbagliato, timeout, rullo, reveal, applauso/uuuh, monete, esplosione/sirena, roulette, biglie, racchetta, classifica/podio, ingresso, avvio/chiusura, attesa, tensione, ambiente). Catalogo con fonte, bus, volume, varianti, intervallo minimo e possibile variazione d'intonazione; test copertura e muto/sblocco. Prima garantire compatibilità dei chiamanti e riproduzione precedente; la migrazione dai vecchi metodi si chiude in un blocco successivo, non rompere i chiamanti a metà.
- **A2 — sostituzione e varietà:** nuova identità coerente pub, sottofondi differenziati per gioco, bilanciamento UI/SFX/musica/ambiente, ducking per voce, un solo clock, niente sovrapposizione col battito; audio TV e conferme discrete telefono. Usare Foley dove appropriato e campioni con licenze verificate per gli altri effetti; decidere Web Audio o Howler dopo verifica necessità, senza installare librerie per automatismo. Silenzio totale da admin e in pausa, secondo specifica; verificare anche effetti già programmati e audio delle canzoni. Sbloccare rispettando le limitazioni del browser.
- **A3 — prova audio regia:** sezione con pulsante per ogni evento e controlli dei volumi per ascolto di sala, coerente con lo stile del progetto. Test di catalogo, presenza risorse ed eventi; ascolto reale di almeno 10 minuti a volume di sala.
- **A4 / B6 — urti Biglie e roulette:** collegamento alle collisioni una volta disponibili catalogo ed eventi fisici; volume dipendente dall'urto, limiti e prevenzione sovrapposizioni.

**Fonti e licenze:** non è stato ancora selezionato o scaricato alcun nuovo suono. Per ogni futuro file registrare fonte, autore, licenza e obblighi in `docs/AUDIO-CREDITI.md`; verificare uso commerciale e attribuzione effettivi. Preferire campioni brevi, mono per effetti, formati compatibili con iOS e peso complessivo indicativo 3–4 MB, misurato. Evitare affermazioni su licenze non verificate.

## Ordine di lavoro proposto

1. Concordare la lista e le scelte di formato ancora aperte. Raccogliere, se disponibili, foto e casi riproducibili; non chiedere log segreti o pubblicare dati dei giocatori.
2. Riproducibilità e tenuta serata: F01–F06, F13, F16, F31 e F39 secondo gravità effettiva, **uno per volta**. Non cambiare DB della serata durante i test; usare copie.
3. Stabilire scaletta futura, destino dei giochi, rischio e tempi; poi affrontare singolarmente leggibilità, sincronizzazione e banca domande (F07–F38, F40–F42), rinviando Azzardo come richiesto.
4. Audio **A1 → A2 → A3**, poi Biglie **B1 → B2 → B3 → B4 → B5**, infine urti **B6/A4**, secondo l'ordine della specifica. I blocchi si possono scomporre ulteriormente, sempre con una verifica e un commit per intervento coerente. Non eseguire la sequenza intera in un unico cambiamento.
5. Prima di ogni eventuale release: riepilogare funzionalità completate e sospese, fonti/licenze audio, prove su TV e telefoni, esito test e build; poi decidere versione, changelog e tag in base al risultato.

## Registro esecuzione

| ID | Stato | Verifica | Commit | Note |
|---|---|---|---|---|
| F17 | Corretto, da verificare in sala | Test remoto: 22 passati | `daf9ae6` | Quiz mostra «RISPOSTA INVIATA»; prenotazione invariata negli altri giochi. |
| F02 | Parziale | Test remoto: 24 passati | `a487bc1` | Tutorial saltato solo quando la sessione è effettivamente ripresa; refresh, cronologia e rientro durante un round restano da provare su dispositivi. |
| F03 | Parziale | 6 test tutorial passati | `0703682` | Richiesta da un tocco e percorso NON VIBRA; da provare fisicamente su Android e iPhone. |
| F37 | Parziale | 7 test backend e 3 frontend passati | `580dbd4` | Durata nominale 90 s; pausa TV non sospende la deadline server, da correggere e provare in sala. |
| F13 | Corretto nel test isolato | Due test HTTP reali per SockJS con wildcard e origini esplicite | `132158b` | Wildcard resta permissiva quando esplicitamente configurata; collegamenti reali da provare. |
| F41 | Corretto nel codice, da verificare in sala | 48 test frontend passati | `7a1f245` | Basket fuori da scaletta, regia, manuale e demo; dopo l'atto 2 nessun bonus sostitutivo. |
| F04 | Parziale | 25 test remoto passati | `dc97d3f` | Nome rimosso dall'intestazione; lo snapshot può ancora aprire il contenuto del prossimo round durante l'animazione TV. |
| F39 | Parziale | Due test H2 isolati passati | `42e74d4` | Il vecchio correttore eliminava CHECK estranei; aggiornato il solo CHECK riconoscibile, mantenendo valori storici. Restano copia del database della serata e prova TV/telefoni. |
| F29 | Parziale | Test temporizzato Arena passato | `7b54b43` | Restringimento dopo 20 s anziché 45, più graduale; da verificare con giocatori e TV. |
| F30 | Parziale | Due test Arena passati | `a63b7cd` | Movimento giusta −5 e sbagliata +12 anziché −10/+15; bilanciamento reale da verificare. |
| F31 | Parziale | 26 test remoto passati | `cdbc2be` | Una risposta HTTP superata non sostituisce la domanda a schermo; resta da riprodurre il salto con più telefoni e latenze reali. |
| F15 | Parziale | 10 test Quiz/tempi e 2 backend passati | `92d2781` | Manche da 15 s anziché 10, con valore proporzionale al tempo e finestra server allineata; da provare in sala. |
| F16 | Parziale | 28 test remoti e 2 backend whitelist passati | `40c2767` | Il telefono ascoltava sempre la partita di default mentre rispondeva su quella reale: ora i topic seguono l'ID iniziale e quello adottato. La causa esatta del primo round in sala non è provata senza più dispositivi. |
| F05 | Corretto nel codice, da verificare in serata | 38 test backend (inclusa l'espulsione) e 53 frontend mirati | `c3d9bd3` | Solo la regia espelle: il token vecchio non vale più, il nome torna libero per un rientro volontario e il telefono torna al setup. I punti già presi restano in classifica; nessuna prova con telefoni reali. |
| F09 | Corretto nel codice, da verificare in TV | 35 test mirati | `de0bcdd` | A fine reveal il tabellone si compatta e mostra tutte le squadre, anche oltre sei; con 16 righe resta scorrevole durante la sequenza. Da guardare a 720p con molti nomi. |
| F35 | Corretto nel codice, da verificare in sala | 35 test mirati | `74e2ba3` | Il telefono mostra il timbro VIA e una vibrazione più netta quando parte il cronometro, oltre al cambio ATTENDI/STOP. |
| F33 | Verificato, nessun cambio di banca | 2 test payload | `d09da92` | Le fasce 100/200 facile, 300/400 media, 500 difficile sono rispettate in tutte e 16 le categorie; la difficoltà reale ora viaggia nel payload e un test la protegge. La percezione «facile» resta soggettiva. |
| F24 | Verificato nel codice, resta prova su telefono | — | — | Le caselle Bomba hanno già lista verticale scorrevole (`overflow-y: auto`); nessun cambio CSS senza una prova reale. |
| F25 | Corretto, verificato nei test | **55 test frontend + 5 backend mirati passati** | `1426613` | Il server emette l'evento `bomb` alla scelta: TV e telefono mostrano subito l'esplosione, la penalità si applica una volta sola e gli altri esiti restano nascosti fino a fine ondata. Anche il turno scaduto ora scala la penalità in TV. |
| F20 | Corretto, da provare in sala | **55 test frontend passati** (immagine, tempi/manuale, remoto, TV) | `9ff8aa6` | Un indizio ogni 6 s anziché 15 e fino a 8 indizi per biografia; manuale, demo e test allineati. Resta da provare in sala che il ritmo sia leggibile. |
| F12 | Diagnosi fatta, serve una decisione | Letti `settleRoundWinner` e `applyRoundWinnerTheme`; cinque test esistenti coprono i casi | — | Il tema del vincitore si applica all'inizio del round successivo, ma solo se quella squadra ha scelto una palette: senza scelta il tema è l'acido di default e il cambio non si vede. Inoltre la classifica fra i round torna sempre all'acido. Per rendere il colore percepibile serve una decisione: assegnare palette diverse di default alle squadre (o un segnaposto visibile del vincitore). |
| F21 | Corretto, verificato nei test | **3 test backend passati** (`CelebrityClueLeakTest`) | `3555a61` | Gli indizi scartavano il nome intero ma non il solo cognome o nome: ora ogni frase che contiene un token identificativo della celebrità viene scartata, anche con accenti e maiuscole diverse. La revisione della banca resta da fare. |
| Altre voci | Da fare o da verificare | — | — | Azzardo rimane in pausa; nessuna prova su telefoni, audio o TV reali è stata eseguita. |
