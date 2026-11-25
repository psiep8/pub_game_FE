# quizzOne

**La serata di quiz da pub, con la TV come tabellone e il telefono come pulsantiera.**
quizzOne è un gioco multigiocatore per locali e feste: la TV mostra domande, tabelloni e classifiche, ogni squadra risponde dal proprio telefono e il presentatore conduce la serata da `/admin`. Frontend Angular e backend Spring Boot vivono in questo monorepo.

![TV: la classifica rapida con 18 squadre](docs/screenshots/f09-classifica-rapida-18-squadre-720p.png)

![TV: la pista rally delle Biglie](docs/screenshots/biglie-tracciato-rally-720p.png)

![Telefono: scelta del tema di squadra](docs/screenshots/phone-tema-pagina2b-390.png)

> **Indice:** [Cos'è](#1-cosè) · [Come si gioca](#2-come-si-gioca) · [I giochi e i flussi](#3-i-giochi-e-i-flussi) · [Tecnologie](#4-tecnologie) · [Architettura](#5-architettura) · [Avvio rapido](#6-avvio-rapido) · [Cartelle](#7-struttura-delle-cartelle) · [Aggiungere un gioco](#8-come-aggiungere-un-gioco) · [Test](#9-test-e-qualità) · [Audio](#10-audio) · [Serata di prova](#11-serata-di-prova) · [Stato e roadmap](#12-stato-e-roadmap) · [Contenuti e licenze](#13-contenuti-e-licenze) · [Licenza e contatti](#14-licenza-e-contatti) · [Documentazione](#15-mappa-della-documentazione)

## 1. Cos'è

quizzOne porta in sala un quiz a squadre in stile pub: nessuna app da installare, nessun account, un QR code sulla TV e il browser del telefono. La regia decide quando parte un round e quando si passa al successivo; il backend tiene sessioni, stato e recupero dopo un refresh.

La versione è **3.0.0**. Il codice è la fonte di verità: se una frase di questo README non combacia con il comportamento, vale il codice.

## 2. Come si gioca

- **TV (`/tv`)**: mostra il QR di ingresso, le domande, i tabelloni, i timer e le classifiche. È lo schermo condiviso.
- **Telefoni (`/play`)**: ogni squadra entra con un nickname e gioca dal browser. In attesa può aprire il **Manuale dei giochi**; durante un round il manuale si chiude e il pulsante sparisce.
- **Regia (`/admin`)**: il presentatore avvia e chiude i round, mette in pausa, mostra le classifiche, lancia i bonus e apre le demo. Non è un pannello di voto: le risposte arrivano dai telefoni.

La serata è una scaletta fissa di **40 round divisi in 5 atti da 8** (`shared/schedule.ts`). Dopo i round **4, 12, 20, 28 e 36** compare la classifica rapida; dopo **8, 16, 24, 32 e 40** quella dettagliata. Le **Biglie sono quattro round separati** (11, 22, 28, 38), ognuno con due gare su due delle otto piste (rally, F1, neve, acqua, vetro, sabbia, spazio, magma); il **Blackjack non è più in scaletta** e resta solo come bonus. In **un round interno di ognuno** dei cinque atti (mai il primo, mai l'ultimo, scelto dal seme all'inizio della serata) parte un bonus diverso: **Karaoke**, **Blackjack**, **Casino 5 manche** (colore, dozzina, parità, alto/basso, numero), **Cavallo** e **Casino numero secco**. I punti del bonus entrano in classifica alla chiusura e nessun bonus toglie punti; i premi di Blackjack e Cavallo li consegnano barista e presentatore, fuori dall'app. Il primo bonus di ogni tipo entra con una scena a sorpresa scelta dal seme della partita: dodici ingressi diversi, nessuno dei quali è annunciato in regia o nel manuale.

**La TV detta il ritmo.** Ogni gioco entra con una dissolvenza breve ed esce con uno scorrimento, mai un taglio secco. La prima volta che un gioco compare nella serata la TV ne mostra la scheda demo — titolo, regola, esempio, tabella punti e i comandi indietro/avanti/ripeti/salta — poi va dritta al round. La domanda resta a schermo senza timer per una pausa di lettura (almeno 3 secondi, più 1 secondo ogni 8 parole), le opzioni entrano sfalsate, seguono 1–2 secondi di respiro e il 3-2-1: cronometro e telefoni partono solo dopo. La riga per il presentatore compare soltanto con `?regia=1`.

Una serata completa dura indicativamente **3–4 ore**: è una stima, non un dato misurato, e dipende da quanto il presentatore allunga i tempi tra un round e l'altro. Il numero di telefoni consigliato è **4–10 squadre**; il codice non impone un limite rigido.

## 3. I giochi e i flussi

I punteggi della tabella vengono da `apps/frontend/src/app/shared/models/scoring-rules.ts`; la scaletta e le occorrenze da `shared/schedule.ts`.

| Gioco | Tipo | Come funziona | Punti |
|---|---|---|---|
| **Quiz** | Sapere | Tre manche da **15 secondi** a scelta multipla; il tempo decide quanto vale una risposta esatta. | Fino a **+1000** in 3 manches; errore = **la quota della manche scalata dal tempo** (minimo **−1000** nel round); nessun malus se non si risponde. |
| **Indovina la canzone** | Sapere | Quattro ascolti da 30 secondi; ci si prenota e si sceglie titolo o artista. Le prime due manche sono hybrid: nastro analogico instabile, poi mutazione elettronica con pitch shifter granulare (senza cambiare velocità). | **+1000 / +750 / +500 / +250** secondo la manche; sbagliata lo stesso valore in negativo. |
| **Indovina chi** | Sapere | La foto si schiarisce con il tempo; ci si prenota e si risponde a voce. | **+1000 × tempo rimasto**; errore **−1000 × tempo rimasto**. |
| **Ruota della fortuna** | Sapere | Una frase a lettere coperte, timer lungo, prenotazione e risposta. | **+1000 × tempo rimasto**; errore **−1000 × tempo rimasto**. |
| **Timeline** | Sapere | Otto date da ordinare dal passato al presente, tutti sulla stessa scala. | Posti giusti: 8 **+400**, 7 **+300**, 6 **+200**, 5 **+100**, 4 **0**, 3 **−50**, 2 **−100**, 1 o 0 **−200**. |
| **Time Buzzer** | Riflessi | Tre manche da **20 secondi** per fermare il cronometro su un bersaglio di 5–20 secondi; tutte le squadre giocano sempre. | **+300** al primo, **−200** all'ultimo, 0 a metà se N è dispari; **+600** a chi centra il bersaglio entro 50 ms. I punti si sommano fra le manche. |
| **Bomba** | Rischio | Un tabellone, un turno per squadra; quasi tutte le caselle sono vere, circa due ogni cinque squadre sono false. | Casella vera: **0** e si passa il turno; falsa scelta: fuori dal round con malus **−round10(500 × bombe rimaste / bombe iniziali)** — con 4 bombe **−500, −380, −250, −130** — scalato dal totale anche sotto zero. Chi non sceglie in tempo è fuori come se avesse preso una bomba. Durante l'ondata le caselle restano coperte. |
| **Speed Rush** | Riflessi | 90 secondi di risposte lampo; la corsia avanza a ogni risposta giusta. | **+800** al primo, **−400** all'ultimo, 0 a metà se N è dispari; chi non arriva è ultimo a pari merito. Punti calcolati dal server; le prove non si ripetono e salgono di difficoltà. |
| **Tennis Battle** | Riflessi | Duello a coppie su un campo con le linee regolamentari (doppio, corridoi, riquadri di servizio): ogni risposta rimanda la palla; punteggio da tennis (15, 30, 40) e killer point diretto sul 40-40, senza vantaggi. Le domande salgono da facili a difficili e il disco arriva dritto, a zig-zag, a giro o a salto. | **+500** a chi vince la partita, **0** a chi perde; ogni gol subito è un gol per l'avversario. |
| **Biglie** | Fortuna / spettacolo | Corsa di biglie su una pista con curve e ostacoli, disegnata e simulata dalla TV con la stessa geometria. Ogni tavolo sceglie una biglia una sola volta e la porta nelle due gare del round; non si gioca dal telefono durante la corsa. | **+500** al primo di ogni gara, **−400** all'ultimo, 0 a metà se N è dispari; i punti si sommano fra le due gare e fra i quattro round. |
| **Azzardo** | Rischio | Quattro manche numeriche; dieci **fiche da poker** da 20 punti da distribuire sulle quattro risposte. | Fiche giusta: **+20 × quota** (×2 facile, ×3 media, ×4 difficile); fiche sbagliate: **−20 × fiche × 100/80/60/40%**; mai sotto zero. La puntata parte solo con **CONFERMA PUNTATA** e almeno una fiche; le fiches avanzate si sommano alle dieci nuove e alzano il tetto di una fiche ogni due risparmiate (max **15**). Tetti: **+500 / −250** a manche, **+1500 / −1000** nel round. |
| **Ultima spiaggia** | Rischio / sapere | Cinque livelli da 100 a 500, una volta per squadra in tutta la serata; una categoria per occorrenza. | **+100 / +200 / +300 / +400 / +500**; errore **−50 / −100 / −150 / −200 / −250**; chi non risponde perde metà del livello scelto. |
| **Arena Battle Royale** | Sapere + riflessi | Battle royale a domande rapide dentro un cerchio che si chiude. | **+10 / −10** per risposta; piazzamento **+1000 / +500 / −300**. |

### Galleria TV: i giochi

Le schede qui sotto sono le demo della TV **all’ultima versione**, catturate dall’app vera a 1280×720 con `/tv?demo=<gioco>`: ogni gioco mostra regola, esempio, tabella punti e i quattro comandi (indietro, avanti, ripeti, salta). Le schermate di partita in corso restano in [`docs/AUDIT-GRAFICO/screens/`](docs/AUDIT-GRAFICO/screens/). Biglie mantiene la sua pista illustrata; Blackjack compare perché resta un bonus giocabile, anche se non fa più parte dei quaranta round.

| TV | TV |
|---|---|
| **Quiz**<br>![TV Quiz](docs/screenshots/readme/tv-gioco-quiz-720p.png) | **Indovina la canzone**<br>![TV Indovina la canzone](docs/screenshots/readme/tv-gioco-musica-720p.png) |
| **Indovina chi**<br>![TV Indovina chi](docs/screenshots/readme/tv-gioco-indovina-chi-720p.png) | **Ruota della fortuna**<br>![TV Ruota della fortuna](docs/screenshots/readme/tv-gioco-ruota-720p.png) |
| **Timeline**<br>![TV Timeline](docs/screenshots/readme/tv-gioco-timeline-720p.png) | **Time Buzzer**<br>![TV Time Buzzer](docs/screenshots/readme/tv-gioco-time-buzzer-720p.png) |
| **Bomba**<br>![TV Bomba](docs/screenshots/readme/tv-gioco-bomba-720p.png) | **Tennis Battle**<br>![TV Tennis Battle](docs/screenshots/readme/tv-gioco-tennis-720p.png) |
| **Ultima spiaggia**<br>![TV Ultima spiaggia](docs/screenshots/readme/tv-gioco-ultima-spiaggia-720p.png) | **Azzardo**<br>![TV Azzardo](docs/screenshots/readme/tv-gioco-azzardo-720p.png) |
| **Arena Battle Royale**<br>![TV Arena](docs/screenshots/readme/tv-gioco-arena-720p.png) | **Speed Rush**<br>![TV Speed Rush](docs/screenshots/readme/tv-gioco-speed-rush-720p.png) |
| **Biglie**<br>![TV Biglie](docs/screenshots/readme/tv-gioco-biglie-720p.png) | **Blackjack (bonus)**<br>![TV Blackjack](docs/screenshots/readme/tv-gioco-blackjack-720p.png) |

### I bonus della serata

| Bonus | Quando | Come funziona | Punti |
|---|---|---|---|
| **Karaoke** | in un round dell'atto 1 | Clip di 30 s con testo sincronizzato; la musica si ferma a fine riga e il primo tavolo che prenota prende il microfono fisico e canta le frasi successive. La regia dice CORRETTO o SBAGLIATO. | **+100 / +150 / +200 / +250 / +300** secondo la manche (5 manche pescate senza ripetizioni da una banca di 64 canzoni; entrano nella scaletta solo quelle con il testo sincronizzato locale, 29 su questa macchina). Sbagliare non toglie punti: blocca il tavolo per la manche e riapre le prenotazioni. |
| **Blackjack** | in un round dell'atto 2 | Un turno per tavolo, 15 s, carta o stai; il banco si ferma a 17. | Chi batte il banco riceve il **premio concordato con il bar**, non punti; premio e consegna li gestiscono barista e presentatore. |
| **Casino 5 manche** | in un round dell'atto 3 | Cinque manche, una girata ciascuna: colore, dozzina, parità, alto/basso, numero secco. | **+100** colore, **+200** dozzina, **+100** parità, **+100** alto/basso, **+1000** numero: massimo **+1500**. Sullo zero il banco incassa. |
| **Cavallo di battaglia** | in un round dell'atto 4 | Categoria votata dai telefoni, otto domande flash. | Il vincitore riceve il **premio concordato con il bar**; a pari merito vince chi ha finito prima. Premio e consegna li gestiscono barista e presentatore. |
| **Casino numero secco** | in un round dell'atto 5 | Un numero da 0 a 36 scelto una volta, poi tre girate con lo stesso numero. | Numero beccato **+1000 una volta sola**; se esce di nuovo non paga il doppio, e chi non lo becca prende 0. |

**Karaoke e Casino pagano punti, che entrano nella classifica della serata una sola volta, alla chiusura del bonus; i premi di Blackjack e Cavallo li gestiscono barista e presentatore, non l'app.** Dopo il bonus dell’atto 5 la TV mostra la classifica finale aggiornata.

### Galleria TV: i bonus

Le schermate dei bonus vengono dalle route reali dei componenti (`/bonus-preview/{karaoke|blackjack|casino5|cavallo|numero}`). Nessun mockup.

| Bonus | Bonus |
|---|---|
| **Casino nero/rosso**<br>![Bonus Casino nero/rosso](docs/screenshots/readme/bonus-casino-720p.png) | **Blackjack**<br>![Bonus Blackjack](docs/screenshots/readme/bonus-blackjack-720p.png) |
| **Casino dozzina**<br>![Bonus Casino dozzina](docs/screenshots/readme/bonus-dozzina-720p.png) | **Cavallo di battaglia**<br>![Bonus Cavallo](docs/screenshots/readme/bonus-cavallo-720p.png) |
| **Casino numero secco**<br>![Bonus Casino numero secco](docs/screenshots/readme/bonus-numero-720p.png) | |

### Galleria: telefoni e regia

| Telefono | Telefono |
|---|---|
| **Ingresso: nome e foto**<br>![Telefono: ingresso](docs/screenshots/readme/phone-setup-390.png) | **Scelta del tema**<br>![Telefono: tema](docs/screenshots/readme/phone-tema-390.png) |
| **Quiz: scelta multipla A–D**<br>![Telefono: Quiz](docs/screenshots/readme/phone-quiz-390.png) | **Azzardo: fiches sulle risposte**<br>![Telefono: Azzardo](docs/screenshots/readme/phone-azzardo-390.png) |

![Regia: pannello admin a 1280×800](docs/screenshots/readme/admin-panel-1280.png)

*Regia (`/admin`): stato partita, dispositivi online, prova dei pulsanti, categorie, demo di giochi e bonus e controlli di conduzione.*

### Il flusso di un round

```mermaid
flowchart LR
  A["Regia: PARTI"] --> B["TV: estrazione categoria"]
  B --> C["TV: gioco e timer"]
  C --> D["Telefoni: tocco, prenotazione, drag o puntata"]
  D --> E["TV: reveal e soluzione"]
  E --> F["Punti e classifica"]
  F --> G{"Round 4, 12, 20, 28 o 36?"}
  G -->|sì| H["Classifica rapida"]
  G -->|no| I{"Round 8, 16, 24, 32 o 40?"}
  I -->|sì| J["Classifica dettagliata"]
  I -->|no| K["Prossimo round"]
  F --> L{"Slot bonus dell'atto?"}
  L -->|sì| M["Bonus"]
  M --> N["Punti bonus alla chiusura"]
```

1. **Apertura.** La regia preme **PARTI** (o **AVANTI** in TV). Se la TV è in lobby parte il primo round; altrimenti il round corrente si chiude e parte il successivo. La slot estrae la categoria; la modalità è già fissata dalla scaletta.
2. **Gioco.** La TV monta il componente della modalità e mostra tabellone, domanda e timer. I telefoni ricevono lo stato e cambiano pulsantiera: A–D, PRENOTA, trascinamento, scelta livello o fiches.
3. **Chiusura.** Allo scadere del timer o alla fine delle manche la TV mostra il reveal; nei giochi a voce la regia conferma **giusto** o **sbagliato**. Le risposte non date seguono la regola della modalità, non un default unico.
4. **Punti.** La TV calcola e salva la classifica; per Arena, Timeline, Bomba, Blackjack e per la validazione delle fiches dell’Azzardo il calcolo o il controllo è del server. Il tabellone viene salvato dopo ogni variazione.
5. **Classifiche.** Dopo i round **4, 12, 20, 28 e 36** compare la classifica rapida; dopo **8, 16, 24, 32 e 40** quella dettagliata. La classifica finale arriva dopo l’atto 5.
6. **Bonus.** In un round interno di ogni atto (slot **2, 3, 5, 6 o 7**, mai il primo e mai l’ultimo) la TV apre il bonus dell’atto. I suoi punti entrano una sola volta alla chiusura; il round riprende dopo.

### Flusso per gioco

- **Quiz** — TV: tre domande a scelta multipla, una per manche da **15 secondi**, con countdown che parte dopo l’introduzione. Telefono: un tocco su **A–D**, poi la pulsantiera si blocca. Chiusura: reveal con soluzione; fino a **+1000** in tre manches, errore **la quota della manche scalata dal tempo** (minimo **−1000** nel round), nessuna risposta **0**. Il punteggio lo registra il server.
- **Indovina la canzone** — TV: quattro ascolti da 30 secondi, sempre più riconoscibili. Manche 1 e 2 usano due catene Web Audio dedicate (`hybrid`): nastro analogico con wow/flutter e fruscio, poi mutazione elettronica con ring modulation, pitch shifter granulare in AudioWorklet, tremolo e micro-chop. La velocità del brano resta 1: l'intonazione non passa dal `playbackRate`. Dry/wet e compressore tengono il volume stabile; dalla manche 3 si torna al brano pulito e al reveal senza filtri. Telefono: **PRENOTA E RISPONDI**; titolo e artista si dicono a voce, la regia conferma. Punti **+1000 / +750 / +500 / +250** secondo la manche; errore lo stesso valore in negativo; chi non prenota resta a 0.
- **Indovina chi** — TV: foto sfocata che si schiarisce per 60 secondi, un indizio ogni 6 secondi. Telefono: **PRENOTATI**, poi risposta a voce. Punti **±1000 × tempo rimasto**; errore in negativo; nessuna prenotazione 0.
- **Ruota della fortuna** — TV: frase a lettere coperte per 75 secondi, lettere aperte con estrazione guidata. Telefono: **PRENOTA E RISPONDI**, soluzione a voce. Punti **±1000 × tempo rimasto**; errore in negativo; nessuna prenotazione 0.
- **Timeline** — TV: otto eventi da ordinare dal passato al presente. Telefono: si trascinano le carte; l’ordine iniziale è già una risposta e l’invio è automatico, si corregge fino allo scadere. Punti per posti esatti: 8 **+400**, 7 **+300**, 6 **+200**, 5 **+100**, 4 **0**, 3 **−50**, 2 **−100**, 1 o 0 **−200**.
- **Time Buzzer** — TV: tre manche da **20 secondi**, bersaglio segreto da 5 a 20 secondi, countdown 5-4-3-2-1. Il server arma i telefoni e dà l’istante ufficiale di partenza; telefono: **STOP** il più vicino possibile. Piazzamento **+300 / … / −200**, **+600** se l’errore è entro 50 ms; nessun taglio, i punti si sommano fra le manche.
- **Bomba** — TV: tabellone da **2n + n/2** caselle, circa **due bombe ogni cinque tavoli**, un turno alla volta. Telefono: si sceglie una casella solo al proprio turno. Casella vera **0** e turno passa; bomba **fuori** con malus **−round10(500 × bombe rimaste / bombe iniziali)** — 4 bombe: **−500, −380, −250, −130** — scalato anche sotto zero; chi non sceglie in tempo è fuori. Le caselle restano coperte durante l’ondata e le bombe non scelte si disarmano a fine round.
- **Tennis Battle** — TV: duello a coppie, palla che passa, punteggio 15-30-40 e killer point diretto sul 40-40, senza vantaggi; le domande non compaiono in TV. Telefono: risposta quando arriva la palla; giusta rimanda, sbagliata o scaduta è punto per l’avversario. Vince la partita **+500**, perde **0**.
- **Ultima spiaggia** — TV: una categoria per occorrenza e cinque livelli. Telefono: si sceglie un livello **100–500** non ancora consumato, poi si risponde. Giusta **+livello**, sbagliata o scaduta **−metà**; il livello resta consumato anche in caso di errore.
- **Azzardo** — TV: quattro manche numeriche (celebrità, canzoni, paesi, storia), quattro risposte vicine, quota ×2/×3/×4. Telefono: dieci **fiche da poker** da **20** da distribuire, almeno una, poi **CONFERMA PUNTATA**; le fiches risparmiate si sommano alle nuove e alzano il tetto di una ogni due, fino a **15**. Fiche giusta **+20 × quota**; sbagliata **−20 × fiche × 100/80/60/40%**; mai sotto zero. Tetti: **+500** e **−250** a manche, **+1500** e **−1000** nel round.
- **Arena Battle Royale** — TV: cerchio che si chiude, domande rapide, classifica in tempo reale. Telefono: vero/falso o quattro opzioni; giusta **+10**, sbagliata **−10**; chi resta fuori o inattivo è eliminato. Piazzamento **+1000 / +500 / −300**.
- **Speed Rush** — TV: 90 secondi, solo le corsie; le domande arrivano sul telefono. Risposta giusta fa avanzare, sbagliata arretra; le prove non si ripetono e salgono di difficoltà. Piazzamento **+800 / … / −400**, calcolato dal server; chi non arriva è ultimo a pari merito.
- **Biglie** — TV: quattro round separati, due gare per round su due delle otto piste (rally, F1, neve, acqua, vetro, sabbia, spazio, magma). Telefono: si sceglie una biglia una volta per round, quando la TV chiama il tavolo; durante la corsa non si gioca. Piazzamento **+500 / … / −400** per gara, sommato fra le due gare e fra i quattro round.

### Vita della scena

- **Respiro e deriva.** Tutte le schermate TV hanno un micro-movimento continuo: respiro (`scale 1 → 1,012`), deriva (±4 px) e bolle di sfondo. Le fasi sono casuali ma stabili, si calcolano al montaggio e usano solo `transform`/`opacity`; la pausa rallenta il movimento invece di fermarlo. Con `?perf=1` la TV mostra gli fps e, se scendono sotto 50 per tre secondi, riduce le bolle da sola. Con `prefers-reduced-motion` resta un movimento minimo, non spento.
- **Telefoni.** Gli stessi tasti respirano di 1,5 px con cicli sfasati; l’animazione usa `translate` e non `transform`, così il feedback alla pressione resta intatto.
- **Ingressi a sorpresa.** I cinque bonus pescano da un pool di dodici ingressi (movimento e suono propri, dal catalogo audio). Il piano della partita nasce da un seme che decide il server (`GET /games/{id}/bonus-entrance`), quindi due TV e un refresh vedono la stessa scena; l’ingresso già visto non si rigioca nella stessa scheda, la pausa lo ferma e i telefoni vibrano quando il bonus parte.

### Flusso dei bonus

1. **Quando.** Il seme della serata sceglie uno slot interno per ogni atto (2, 3, 5, 6 o 7). Il bonus non è un round della scaletta: si apre dopo il round scelto e non consuma un numero.
2. **Introduzione.** La TV annuncia il bonus dell’atto; i telefoni mostrano la pulsantiera dedicata. Il presentatore può lanciarlo anche a mano dalla regia.
3. **Gioco.** Casino, dozzina e numero secco fanno tre girate con scelta entro dieci secondi; Blackjack dà un turno per tavolo; il Cavallo fa votare la categoria e pone otto domande flash.
4. **Chiusura.** La TV mostra il risultato. I punti Casino entrano in classifica una sola volta, alla chiusura; nessun bonus toglie punti. Blackjack e Cavallo non danno punti: il premio concordato con il bar lo consegnano barista e presentatore.
5. **Dopo.** La serata riprende dal round successivo; dopo il bonus dell’atto 5 si chiude con la classifica finale.

### Flusso per bonus

- **Casino nero/rosso** — tre girate; a ogni girata il telefono sceglie **NERO** o **ROSSO** entro dieci secondi, poi la ruota gira. Colore giusto **+100** a girata, massimo **+300**; zero o colore sbagliato 0.
- **Blackjack** — un turno per tavolo contro il banco TV; il banco si ferma a 17. Telefono: **CARTA** o **STAI** entro 15 secondi, poi la TV apre le carte. Chi batte il banco riceve il premio del bar, non punti; pari e sconfitte non tolgono nulla.
- **Casino dozzina** — tre girate; a ogni girata si sceglie **1–12**, **13–24** o **25–36** entro dieci secondi. Dozzina giusta **+200** a girata, massimo **+600**; zero o dozzina sbagliata 0.
- **Cavallo di battaglia** — i telefoni votano la categoria, poi otto domande flash. Vince chi ha più risposte esatte; a pari merito chi ha finito prima. Premio del bar, nessun punto in classifica.
- **Casino numero secco** — un numero da **0 a 36** scelto una volta, entro dieci secondi, e tenuto per tutte e tre le girate. Numero beccato **+1000 una volta sola**: se esce di nuovo in una girata successiva non paga il doppio; chi non lo becca prende 0; nessuna penalità.

### Flusso dei telefoni

1. **Ingresso.** Il QR sulla TV apre `/play?game={id}`. La squadra inserisce il nome, può scattare una foto facoltativa e sceglie il tema-colore; la scelta non si cambia più.
2. **Prova dei pulsanti.** Prima del primo round l’admin può avviare la prova: ogni telefono prova tocco, scelta, trascinamento, vibrazione e collegamento. Il round resta bloccato finché tutti non finiscono, salvo **AVVIA COMUNQUE**.
3. **Lobby e round.** Fuori dai round il telefono mostra l’attesa e il **Manuale dei giochi**; durante un round il manuale si chiude e il pulsante sparisce. La pulsantiera cambia per modalità: A–D, PRENOTA, trascinamento, livello, fiches.
4. **Pausa.** Se la regia mette in pausa, il telefono mostra **IN PAUSA** e blocca gli input; alla ripresa torna lo stato corrente. Anche la scheda TV nascosta mette in pausa da sola e si riprende al ritorno, senza sovrascrivere una pausa voluta dal presentatore.
5. **Riconnessione.** Il token della squadra resta nel browser: refresh, blocco schermo o rientro dalla stessa rete riprendono la stessa squadra. Se il token è perso, il nome non basta a rientrare.

### Flusso della regia

1. **Apertura.** `/admin` mostra lo stato della partita, il numero di round, la versione dello stato, i dispositivi online e l’ultimo evento.
2. **Conduzione.** **PARTI** apre il round o passa al successivo; **PROSSIMA MANCHE** serve ai giochi a manche; **PAUSA / RIPRENDI** ferma timer e input; **MOSTRA CLASSIFICA** apre la classifica in TV.
3. **Validazione.** Nei giochi a voce (Musica, Indovina chi, Ruota) la regia conferma **giusto** o **sbagliato**; nei giochi numerici il server valida. La soluzione è disponibile nel pannello quando il round lo prevede.
4. **Bonus e demo.** I cinque pulsanti bonus aprono il componente reale; la sezione Demo mostra introduzione, 13 giochi e 5 bonus senza cambiare lo stato della serata.
5. **Gestione.** Categorie e flag Timeline, prova dei pulsanti, espulsione di una squadra, reset partita e tema di Natale stanno nello stesso pannello. La regia non vota al posto dei telefoni.

### Recupero e riconnessione

- **Token per ruolo.** TV, regia e ogni telefono hanno un token separato; la TV e la regia riprendono la serata da un altro dispositivo con lo stesso segreto, il telefono riprende la propria squadra.
- **Sync.** Dopo una riconnessione il client chiede `/sync` e riceve snapshot + eventi mancanti; la TV salva checkpoint delle modalità e la classifica dopo ogni variazione. Un refresh non riparte da zero.
- **Autorità.** Il server è l’autorità su sessioni, round, punteggi verificati (Arena, Timeline, Bomba, Blackjack, fiches dell’Azzardo) e prova dei pulsanti. La TV possiede la presentazione e la maggior parte dello stato della singola modalità; i telefoni possiedono input e timer locali. I limiti di questa divisione sono elencati in [§12](#12-stato-e-roadmap).

## 4. Tecnologie

| Area | Scelta | Perché |
|---|---|---|
| Frontend | **Angular 22.3** standalone, signal, router lazy, service worker PWA | Un'unica codebase per TV, telefono e regia; le signal rendono esplicito lo stato che arriva dalla socket. |
| Backend | **Spring Boot 4.2.0**, Java **25 LTS** | REST + WebSocket nello stesso processo, persistenza JPA e test di integrazione. |
| Realtime | **STOMP su WebSocket nativo** (`@stomp/stompjs`) | Una sola socket per dispositivo, senza il fallback XHR di SockJS; riconnessione con backoff e jitter. L'endpoint SockJS resta disponibile sul backend, ma il frontend usa il WebSocket nativo. |
| Dati | **H2** su file in locale, profilo **MySQL** per il servizio | Zero installazioni per la serata; MySQL quando serve un database gestito. |
| Fisica | **Matter.js** per roulette e Biglie | La roulette e le biglie sono corpi rigidi con collisioni reali; disegno e muri usano la stessa geometria. |
| Qualità | **Vitest 5.1.1 + jsdom** e **JUnit / Spring Boot Test** | Test veloci sul frontend e test di integrazione sul backend. |
| Consegna | **Docker** fullstack | Un solo container serve TV, telefoni, API e WebSocket. |

## 5. Architettura

```mermaid
flowchart LR
  TV["TV /tv"] <-->|STOMP| BE["Spring Boot<br/>REST + WebSocket"]
  PHONE["Telefoni /play"] <-->|STOMP + REST| BE
  ADMIN["Regia /admin"] <-->|STOMP + REST| BE
  BE --> DB[("H2 / MySQL")]
  BE --> BANK["Banca domande<br/>JSON pre-generata"]
  BE --> MEDIA["Media locali<br/>iTunes / TMDB"]
```

**Chi possiede lo stato.** Il backend è l'autorità su sessioni, stato della partita, round, punteggi verificati (Arena, Timeline, Bomba, Blackjack, validazione delle fiches dell'Azzardo) e prova dei pulsanti. La TV possiede la presentazione e la maggior parte dello stato di gioco della singola modalità; i telefoni possiedono input e timer locali. Questa divisione è il motivo per cui alcune modalità hanno ancora tempi dichiarati dal client: è un limite noto, non un dettaglio da nascondere.

**Sessioni, sincronizzazione e ripresa.** Ogni dispositivo apre una sessione con `POST /games/{id}/session` e riceve un token; il token viene salvato per ruolo (`TV`, `ADMIN`, `REMOTE`) e usato su REST e STOMP. Dopo una riconnessione il client chiede `/sync` e riceve snapshot + eventi mancanti. La TV e la regia possono riprendere la stessa serata da un altro dispositivo con lo stesso segreto; un telefono riprende la propria squadra finché conserva il token.

**Sicurezza.** `CONTROL_SECRET` (almeno 32 caratteri) protegge l'apertura delle sessioni TV/admin; `ALLOWED_ORIGINS` limita le origini esatte di REST e WebSocket. Non ci sono cookie di sessione: l'autenticazione viaggia in header. I punteggi critici vengono calcolati o validati dal server. Restano aperti i limiti elencati in [§12](#12-stato-e-roadmap).

## 6. Avvio rapido

### Docker (consigliato per la serata)

```bash
cp deploy/.env.test.example deploy/.env
# apri deploy/.env e imposta CONTROL_SECRET (almeno 32 caratteri casuali)
docker compose -f deploy/docker-compose.test.yml --env-file deploy/.env up -d --build
```

Poi apri `http://localhost:8080/tv` sul PC e inquadra il QR con i telefoni. La regia è su `http://localhost:8080/admin`. Il test compose usa `ALLOWED_ORIGINS=*` perché è pensato per una rete locale di prova; non usarlo così in produzione.

### Sviluppo con npm

Servono **Node.js 26.13+ (LTS)**, **npm 11.20+** e **JDK 25 LTS**. La versione Node è fissata in `.nvmrc` e usata anche dalla CI.

```bash
npm install
cp .env.example .env
# imposta CONTROL_SECRET e, se apri dai telefoni, ALLOWED_ORIGINS
npm run dev
```

La guida passo-passo per computer, TV, telefoni, Docker, LAN e problemi frequenti è in **[`docs/SETUP-LOCALE.md`](docs/SETUP-LOCALE.md)**. Per tunnel, dominio, Vercel, PWA e backup la guida è **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**; per il container unico c'è **[`deploy/README.md`](deploy/README.md)**. Questo README non li duplica.

Per chi conduce la serata la guida operativa è **[`docs/PRESENTATORE.md`](docs/PRESENTATORE.md)** (schermi, pulsanti, decisioni, imprevisti); il copione con le frasi da dire resta **[`PRESENTAZIONE-PUBGAME.md`](PRESENTAZIONE-PUBGAME.md)**. I pulsanti del pannello sono in **[`docs/PANNELLO-ADMIN.md`](docs/PANNELLO-ADMIN.md)**, il telefono delle squadre in **[`docs/MANUALE-TELEFONO.md`](docs/MANUALE-TELEFONO.md)**.

## 7. Struttura delle cartelle

```text
apps/
├── frontend/src/app/
│   ├── core/          environment, WebSocket, servizi condivisi, guardie
│   ├── features/      tv/, remote/, admin/, games/, bonus/
│   └── shared/        modelli, enum, schedule, manuale, doppi di test
└── backend/src/main/java/com/pub_game_be/
    ├── config/        sicurezza, WebSocket, forward SPA
    ├── controller/    REST e STOMP
    ├── domain/        entità e enum
    ├── dto/           payload
    ├── reliability/   sessioni, stato, sync, prova pulsanti
    ├── repository/    JPA
    ├── security/      filtro sessioni e CORS
    └── service/       logica di gioco e domande
scripts/               avvio unificato, wrapper Maven, generazione contenuti
docs/                  setup, deployment, screenshot
deploy/                compose, Caddy, variabili di esempio
```

## 8. Come aggiungere un gioco

1. Aggiungi il valore all'enum condiviso `GameModeType` e inseriscilo nella scaletta in `shared/schedule.ts` (la scaletta è l'unica fonte di verità per round e occorrenze).
2. Crea la modalità in `features/games/<gioco>/` con il suo componente TV e, se serve, lo stato di gioco.
3. Aggiungi la schermata del telefono in `features/remote` e i relativi eventi STOMP; usa gli enum condivisi, non stringhe nuove.
4. Aggiungi i punteggi in `shared/models/scoring-rules.ts`: la tabella è letta da admin, manuale e demo.
5. Aggiungi la demo in `features/tv/demo-scripts.ts`: il test di copertura fallisce se una modalità della scaletta non ha demo o se un numero non coincide.
6. Aggiungi la descrizione del manuale in `shared/manual/manual-content.ts` e verifica che il testo resti generato dalle regole.
7. Scrivi i test della modalità, aggiorna quelli di copertura e lancia `npm run test:frontend` e `npm run build:frontend`.

## 9. Test e qualità

```bash
npm run test:frontend    # Vitest + jsdom
npm run test:backend     # JUnit / Spring Boot Test
npm run build:frontend   # ng build
npm run build:backend    # Maven package
```

Il frontend ha **76 file di spec (799 test al 25 novembre 2026, tutti eseguiti)**; il backend ha **189 test**. Le verifiche coprono, tra l'altro: regole di punteggio e scaletta, contenuti del manuale, copertura delle demo, round manager, apertura/chiusura del manuale sul telefono, modalità TV, sessioni e riconnessione, prova dei pulsanti, API e servizi del backend.

**Limiti noti dei test**: la suite frontend deve compilare per intero (un solo errore TypeScript in una spec ferma tutti i test);  non esiste ancora una prova end-to-end multi-dispositivo in rete; i controlli visivi sono manuali (TV e telefono); i timer dichiarati dal client non sono interamente verificabili dal server.

## 10. Audio

La colonna sonora della TV suona **file registrati** in `apps/frontend/public/assets/audio` (41 effetti e 20 loop in AAC `.m4a`, ~23 MB). Fonte e licenza di ogni file stanno in `FONTI.txt` e in `docs/CREDITI-AUDIO.md`. Nel codice non c'è più sintesi di eventi (Foley e i tappeti generati sono stati rimossi): resta solo la coda di stanza in `audio-dsp.ts`. Se un file manca, non suona nulla e compare un avviso in console.

- **Sottofondi.** Piano a **20 loop**: una base per ciascun atto (5, tutte diverse) più un loop per i giochi e i bonus che ne reggono uno. **Oggi sono in cartella 20 su 20**, tutti consegnati e resi in casa; la mappa gioco → loop è in `core/services/bed-map.ts`, il registro dei file in `bed-loops.ts`; il documento di riferimento è [`docs/SOTTOFONDI.md`](docs/SOTTOFONDI.md).
- **Regola di riproduzione.** La base d'atto suona di default; il loop del gioco la sostituisce con una dissolvenza di 1,5 s e a fine gioco si torna alla base. Musica e Time Buzzer restano in silenzio; durante la domanda di Quiz e Indovina chi la musica scende di 6 dB. I loop si caricano con l'atto e il service worker li tiene in cache.
- **Effetti e segnali.** Battito (dal round 20 cresce con la serata), tick del clock, suspense nei giochi a countdown, reveal, fanfara e podio. Mute con dissolvenza; la pausa ferma clock e battito.
- **Canali e proprietari.** I loop passano da quattro canali — `bed`, `loop-gioco`, `effetto`, `voce` — con un proprietario per scena: al cambio di gioco, round, bonus, pausa, reset o uscita dalla TV il canale uscente si ferma con una dissolvenza di 300–600 ms, e una richiesta lenta non può riaccendere un loop già fermato. Il pannello `?audiodebug=1` mostra i canali e i proprietari in tempo reale.
- **Regia audio.** La pagina `/audio` permette di ascoltare ogni evento, i sottofondi per atto e per gioco e il loro peso.
- **Manifesto e script.** `docs/MANIFESTO-AUDIO.md` è la fonte dei nomi dei file; `node scripts/audio/process-audio.mjs` normalizza (effetti −16 LUFS, loop −23 LUFS), taglia e converte i file grezzi messi in `_src/`.

Prima di una serata si ascolta la sala a volume vero: la checklist è in `docs/SERATA-PROVA.md` §3.3.

## 11. Serata di prova

Prima di una serata con telefoni veri:

1. `cp .env.test-night.example .env` e compila `CONTROL_SECRET` (≥ 32 caratteri) e `ALLOWED_ORIGINS` con IP LAN del PC.
2. `npm run db:backup` (copia in `backups/`, fuori dal repository).
3. `npm run dev`, poi `curl http://localhost:8080/health` deve rispondere `{"status":"ok"}`.
   Con Docker: `PUBGAME_TAG=3.0.0 docker compose up -d` fissa la versione, così un
   aggiornamento sbagliato si annulla cambiando tag.
4. Giro a vuoto con un iPhone e un Android: ingresso, un round, refresh della TV, blocco schermo di 60 secondi.

Il programma completo (ruoli, tempi, prove di caduta, cosa annotare, emergenze) è in **`docs/SERATA-PROVA.md`**. L'ordine delle fix da chiudere prima e dopo la serata è in **`docs/FIX-PRE-SERATA.md`**.

## 12. Stato e roadmap

Il registro completo dei difetti emersi nella prima serata (F01–F55), con stato e prova di ciascuno, è in [`docs/ROADMAP-POST-PRIMA-SERATA.md`](docs/ROADMAP-POST-PRIMA-SERATA.md). Una voce «corretta nel codice» significa verificata con test, **non** provata in sala.

**Pronto**

- Scaletta di 40 round in 5 atti, 13 modalità e 5 bonus sparsi nei round degli atti.
- Ingresso con QR, squadre con token, ripresa dopo refresh o cambio dispositivo; la TV e la regia riprendono la maggior parte dei giochi e dei bonus dopo un refresh (matrice in `docs/ROADMAP-POST-PRIMA-SERATA.md`).
- Manuale dei giochi sul telefono, apribile solo fuori dai round.
- Sezione Demo nell'admin (introduzione, 13 giochi, 5 bonus) con tabella punti generata da `SCORING_RULES`.
- Classifiche rapide e dettagliate, pausa, ripresa, diagnostica di regia, espulsione di una squadra dalla regia.
- Audio a file registrati con regia audio in `/audio`.
- Banca domande pre-generata: 983 domande, 360 domande Azzardo, 110 affermazioni Bomba e 222 eventi Timeline.

**Da provare con telefoni e TV veri** (corrette nel codice, non verificate in sala): rientro su iPhone e Safari, Time Buzzer, Arena (cerchio, movimento, inattività), Speed Rush a 90 secondi, Tennis dopo la migrazione del database (e il nuovo campo con le linee), Bomba con esplosione immediata, vibrazione e suono sui telefoni, la pausa di lettura e il 3-2-1 della regia scenica, il respiro/bolle con `?perf=1`, gli ingressi a sorpresa dei bonus e le fiche dell’Azzardo.

**Limitato o aperto**

- **Sottofondi:** 20 loop su 20 consegnati; resta la prova d'ascolto in sala a volume vero.
- **Font:** i caratteri (Anton, Space Mono, Bricolage Grotesque) sono serviti dal repository in `apps/frontend/public/assets/fonts`, quindi la serata regge anche senza internet.
- **Tempi dichiarati dal client:** alcune modalità usano tempi o stato del telefono; i punteggi non sono tutti verificabili lato server.
- **Sicurezza:** mancano rate limiting e recupero assistito del nome; un partecipante può prenotare per primo il nickname di un'altra squadra. Le sessioni non vengono revocate cambiando `CONTROL_SECRET`.
- **Rete:** manca una prova multi-dispositivo in rete e una suite E2E nel repository.
- **Cavallo di battaglia:** non ha funzionato nella prima serata e va riprovato in sala.

**In programma**

- Minigiochi lampo a sorpresa fra un round e l'altro (idea documentata, **non ancora implementata**).
- Rate limiting sulle sessioni e recupero assistito dei nomi.
- Test end-to-end con più browser e dispositivi reali.

## 13. Contenuti e licenze

- **Domande**: `apps/backend/src/main/resources/questions/questions-it.json` (983 domande, 16 categorie; Tennis Battle è un tipo di domanda, non una categoria), `azzardo-it.json` (360), `bomba-it.json` (110 affermazioni) e `timeline-it.json` (222 eventi). Il backend le carica all'avvio e non chiama alcun modello AI a runtime.
- **Generazione**: `scripts/generate-questions/generate.py` può usare Groq, ma solo quando si rigenera la banca. `GROQ_API_KEY` non serve per giocare.
- **Immagini**: “Indovina chi” può usare TMDB se `TMDB_API_KEY` è impostata; senza chiave la domanda resta senza foto. Se la banca media locale è presente, le immagini vengono servite dal backend.
- **Musica**: senza banca locale il backend usa le anteprime pubbliche di 30 secondi dell'iTunes Search API; con la banca locale i file sono serviti da `/media/...`.
- **Banca media locale (opzionale)**: può contenere anche i volti (`static/media/people/*.jpg`), le copertine (`static/media/covers/*.jpg`) e i brani (`static/media/music/*.m4a`), indicizzati da `questions/media-it.json`. **Non è inclusa nel repository**: `.gitignore` esclude `static/media/` e `media-it.json`. Va generata con `python scripts/generate-questions/generate_media.py --from-azzardo` (o copiata) prima della build. Con la banca installata il backend non chiama iTunes, TMDB o Wikipedia: ciò che manca resta un segnaposto.
- **Come aggiungere domande**: aggiungi voci alla banca JSON (o rigenera con lo script) mantenendo ID univoci e categorie esistenti; riavvia il backend e verifica la diagnostica delle domande usate.
- **Licenze**: nel repository non c'è un file `LICENSE`. I testi delle domande e il codice appartengono al proprietario del repository; le foto TMDB e le anteprime iTunes restano soggette ai rispettivi termini. Prima di un uso pubblico o commerciale verifica le licenze delle fonti multimediali.

## 14. Licenza e contatti

Nessun file di licenza è incluso: l'uso è riservato al proprietario del repository, salvo accordi diversi.

Repository: [github.com/psiep8/pub_game_FE](https://github.com/psiep8/pub_game_FE)

Per segnalazioni o proposte: apri una issue nel repository.

## 15. Mappa della documentazione

| Documento | A cosa serve |
|---|---|
| [`docs/SETUP-LOCALE.md`](docs/SETUP-LOCALE.md) | Installare e far girare il gioco su un computer, TV e telefoni |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md), [`deploy/README.md`](deploy/README.md) | Tunnel, dominio, container unico, backup |
| [`docs/PRESENTATORE.md`](docs/PRESENTATORE.md), [`docs/PANNELLO-ADMIN.md`](docs/PANNELLO-ADMIN.md), [`docs/AVVIO-SERATA-ADMIN.md`](docs/AVVIO-SERATA-ADMIN.md) | Condurre la serata dalla regia |
| [`docs/MANUALE-TELEFONO.md`](docs/MANUALE-TELEFONO.md), [`docs/manuale-serata.pdf`](docs/manuale-serata.pdf) | Guida per le squadre |
| [`docs/SERATA-PROVA.md`](docs/SERATA-PROVA.md) | Programma e checklist della prova con telefoni veri |
| [`docs/ROADMAP-POST-PRIMA-SERATA.md`](docs/ROADMAP-POST-PRIMA-SERATA.md), [`docs/FIX-PRE-SERATA.md`](docs/FIX-PRE-SERATA.md) | Registro dei difetti e stato delle correzioni |
| [`docs/SOTTOFONDI.md`](docs/SOTTOFONDI.md), [`docs/MANIFESTO-AUDIO.md`](docs/MANIFESTO-AUDIO.md), [`docs/AUDIO-CATALOGO.md`](docs/AUDIO-CATALOGO.md), [`docs/CREDITI-AUDIO.md`](docs/CREDITI-AUDIO.md) | Audio: loop, file, catalogo, crediti |
| [`DESCRIZIONE-GIOCO.md`](DESCRIZIONE-GIOCO.md), [`PRESENTAZIONE-PUBGAME.md`](PRESENTAZIONE-PUBGAME.md) | Descrizione e copione di presentazione |
| [`AGENTS.md`](AGENTS.md) | Stile grafico obbligatorio e regole per chi modifica l'interfaccia |
| [`docs/PULIZIA-REPORT.md`](docs/PULIZIA-REPORT.md), [`docs/STRESS-REPORT.md`](docs/STRESS-REPORT.md) | Pulizia del repository (prove di ogni rimozione) e misure di carico, crash e soak |
| [`CHANGELOG.md`](CHANGELOG.md) | Storia delle modifiche |
