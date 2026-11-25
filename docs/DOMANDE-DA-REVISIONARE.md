# Domande e regole da revisionare

Qui finisce tutto ciò che l'audit automatico non può decidere: fatti dubbi,
domande con due risposte difendibili, distrattori che possono ingannare più del
giusto e le scelte lasciate aperte dalla specifica. Ogni riga va approvata o
scartata da chi conosce il pubblico; l'audit propone, non decide.

L'elenco delle segnalazioni automatiche è in `docs/BANCHE-AUDIT.md`, rigenerato
con `npm run audit:banche`.

## Scelte della specifica da confermare

| Voce | Proposta seguita | Cosa serve |
| --- | --- | --- |
| Punti "a metà campo" con N pari | positivi ai primi `N/2`, negativi agli ultimi `N/2`, nessuno a zero | conferma della formula simmetrica |
| Timeline con 1 o 0 posti giusti | entrambi a −200 | conferma dell'unione dei due casi |
| Time Buzzer "tempo perfetto" | errore ≤ 50 ms vale +600 | provare la soglia sul telefono, in sala |
| Numero secco del Casino | **deciso il 24 novembre 2026:** numero scelto **una volta sola** prima delle tre girate e tenuto; chi lo becca prende **1000 punti una volta sola** (max +1000), chi non lo becca 0 | conferma in sala: il telefono sceglie una volta e la TV rigira tre volte lo stesso numero |
| Finestra di scelta dei bonus | 10 secondi, si chiude prima se tutti hanno scelto | conferma della durata |
| Premi di Blackjack e Cavallo | gestiti da barista e presentatore, fuori dall'app | concordare premi e consegna in sala |
| Distrattori delle banche | corretti: l'audit non segnala più risposte più lunghe né distrattori troppo corti | rileggere le 47 opzioni riscritte con il pubblico davanti |
| Copertura di Ultima spiaggia | **cinque fasce reali** (facile, medio-facile, media, medio-difficile, difficile), una domanda dedicata per categoria e livello: 0 combinazioni scoperte; nessun ripiego su un'altra fascia | rileggere in sala le 80 riclassificazioni elencate sotto |
| Versione | 2.3.1 | fissata il 23 novembre 2026 (era 2.2.0) |

## Domande da guardare a mano

Le 47 risposte più lunghe dei distrattori sono state riallineate cambiando la
forma delle opzioni o accorciando la risposta, senza cambiare i fatti. L'audit
ora restituisce **0 segnalazioni** e **0 doppioni**. Restano da rileggere in
sala le nuove formulazioni, in particolare i nomi completati con il ruolo
(`Re Umberto I`, `Claudio Tolomeo`) e i titoli con la precisazione tra parentesi
(`Élite (serie)`, `The Wall (album)`).

Due controlli dell'audit sono stati corretti perché producevano falsi positivi:
`C#` è un'opzione valida di due caratteri e una risposta di un solo carattere
come l'articolo `L'` comparirebbe dentro qualunque testo italiano.

<!-- Le righe vengono rigenerate dall'audit: vedi docs/BANCHE-AUDIT.md, sezione
     "Segnalazioni". Non aggiungere qui fatti nuovi senza la fonte. -->

_(nessuna nuova voce registrata a mano)_

## Esito dell'audit esteso (B3, 23 novembre 2026)

L'audit automatico ora copre anche **Indovina chi**, **Musica**, **Ruota** e
**Bomba**. Comandi: `npm run audit:banche` (report in `docs/BANCHE-AUDIT.md`),
`node scripts/audit-banche.mjs --ci` (fallisce su doppioni, campi mancanti e
segnalazioni delle domande).

| Banca | Copertura | Doppioni | Problemi automatici | Da guardare a mano |
| --- | --- | --- | --- | --- |
| Indovina chi (`media-it.json`, people) | 150 persone, 7 categorie | 0 | 0: tutte con categoria, foto su disco, descrizione ed estratto | nessuna voce: gli indizi sono verificati da `CelebrityClueLeakTest` |
| Musica (`media-it.json`, music) | 114 brani, 5 occorrenze in serata | 0 | 0: ogni brano ha anno, file e copertina | nessuna |
| Ruota (frasi in `QuestionBankService.PROVERBS`) | **62 frasi**, 2 occorrenze in serata | 0 | 0: nessuna frase sotto le tre parole o con numeri | nessuna: la scelta salta i proverbi già usati nella partita, quindi due occorrenze a serata non ripetono la frase |
| Bomba (`bomba-it.json`) | **110 affermazioni (62 vere, 48 false)**, 11 categorie da 9 a 10 | 0 | 0 campi mancanti: ogni riga ha id, categoria, booleano e fonte; 0 dubbi di distanza | nessuna: le 8 coppie segnalate sono state allineate (elenco sotto) |

### Musica: anno completato

| Brano | Artista | Anno | Fonte |
| --- | --- | --- | --- |
| Boulevard of Broken Dreams | Green Day | **2004** | <https://it.wikipedia.org/wiki/Boulevard_of_Broken_Dreams> |

L'anno è stato scritto in `apps/backend/src/main/resources/questions/media-it.json`,
che **non è tracciato da git** (contiene i media veri): la correzione vive sul
computer del server e va rifatta se la banca si rigenera da zero con
`generate_media.py`. Con l'anno presente l'audit dà **0 campi mancanti** su
Musica.

### Bomba: coppie allineate (23 novembre 2026)

L'audit misura la distanza in parole dalla vera più vicina della stessa
categoria. Le otto coppie segnalate il 23 novembre sono state risolte
**accorciando i nomi troppo lunghi** («Francis Ford Coppola» → «Francis
Coppola», «Leonardo da Vinci» → «Leonardo», «Tim Berners-Lee» →
«Berners-Lee», «Giuseppe Tomasi di Lampedusa» → «Lampedusa») e, dove le due
frasi non erano la stessa affermazione, **portando la falsa a un solo dettaglio
di distanza**. Nessun fatto è cambiato: le affermazioni restano vere o false come
prima e ognuna tiene la sua fonte. L'audit ora dà **0 dubbi** su 110
affermazioni (62 vere, 48 false).

Le quattro coppie che mancavano davvero erano già state completate con una vera
e la fonte (Torre Eiffel 1889, ragni non insetti, violino a quattro corde,
Titanic di Cameron), più sei affermazioni nuove per portare ogni categoria ad
almeno nove righe: 95 → **110**.

| ID | Frase falsa | Vera corrispondente | Distanza |
| --- | --- | --- | --- |
| `bomba-natura-04` | Il gabbiano è l'animale più veloce in volo. | Il falco pellegrino è l'animale più veloce in volo. | 2 |
| `bomba-natura-06` | La balena grigia è il più grande animale esistente. | La balenottera azzurra è il più grande animale esistente. | 2 |
| `bomba-cinema-04` | Il padrino è diretto da Martin Scorsese. | Il padrino è diretto da Francis Coppola. | 2 |
| `bomba-musica-06` | Verdi compose Le nozze di Figaro. | Mozart compose Le nozze di Figaro. | 1 |
| `bomba-arte-02` | La Gioconda è di Raffaello. | La Gioconda è di Leonardo. | 1 |
| `bomba-tecnologia-02` | Il World Wide Web fu proposto da Bill Gates. | Il World Wide Web fu proposto da Berners-Lee. | 2 |
| `bomba-tecnologia-08` | La sigla GPU indica l'unità centrale di elaborazione. | La sigla CPU indica l'unità centrale di elaborazione. | 1 |
| `bomba-letteratura-08` | Il Gattopardo è di Sciascia. | Il Gattopardo è di Lampedusa. | 1 |

### Timeline: undici eventi di difficoltà 5 (23 novembre 2026)

La Timeline è passata da **211** a **222** eventi. I nuovi sono tutti di
difficoltà 5, uno per ciascuna delle categorie che ne erano prive: ora tutte le
14 categorie hanno almeno un evento «che la sanno in pochi». Ogni anno era
libero (quell'anno non aveva altri eventi in banca) e la fonte è un collegamento
di ricerca a Wikipedia, come per gli altri eventi.

| Anno | Evento | Categoria | Fonte |
| --- | --- | --- | --- |
| 1748 | Pace di Aquisgrana | Storia | <https://it.wikipedia.org/w/index.php?search=Pace%20di%20Aquisgrana%20(1748)> |
| 1854 | La spedizione di Perry apre il Giappone | Geografia e Viaggi | <https://it.wikipedia.org/w/index.php?search=Convenzione%20di%20Kanagawa> |
| 1898 | Primo campionato italiano di calcio | Sport | <https://it.wikipedia.org/w/index.php?search=Campionato%20Italiano%20di%20Football%201898> |
| 1925 | Esce La corazzata Potëmkin | Cinema, Serie TV | <https://it.wikipedia.org/w/index.php?search=La%20corazzata%20Pot%C3%ABmkin> |
| 1956 | Prima edizione dell'Eurovision Song Contest | TV e Spettacolo | <https://it.wikipedia.org/w/index.php?search=Eurovision%20Song%20Contest%201956> |
| 1874 | Prima esecuzione del Requiem di Verdi | Musica | <https://it.wikipedia.org/w/index.php?search=Messa%20da%20requiem%20(Verdi)> |
| 1998 | Firmato lo Statuto di Roma | Politica e Attualità | <https://it.wikipedia.org/w/index.php?search=Statuto%20di%20Roma> |
| 1947 | Enzo Ferrari fonda la Ferrari | Motori | <https://it.wikipedia.org/w/index.php?search=Ferrari> |
| 1877 | Nasce la Barilla a Parma | Cibo e Gastronomia | <https://it.wikipedia.org/w/index.php?search=Barilla> |
| 1978 | Debutta Capitan Harlock | Anime e manga | <https://it.wikipedia.org/w/index.php?search=Capitan%20Harlock> |
| 1993 | Esce Doom | Gaming e Tecnologia | <https://it.wikipedia.org/w/index.php?search=Doom%20(videogioco)> |

## Ultima spiaggia a cinque fasce (B1, 23 novembre 2026)

### Fabbisogno ricalcolato dal codice

- Una occorrenza usa **una sola categoria** e **cinque domande**, una per
  livello: il payload del server contiene le cinque domande e i tavoli scelgono
  il livello, quindi **la stessa domanda è condivisa fra tutte le squadre** che
  scelgono quel livello nello stesso round (`QuestionBankService.ultimaSpiaggiaRound`).
- Le domande non si ripetono nella stessa partita (`QuestionHistoryService`):
  ogni occorrenza consuma cinque domande di quella categoria.
- In scaletta Ultima spiaggia compare **5 volte** (atti 1-5, `shared/schedule.ts`):
  servono **25 domande nuove** in cinque categorie diverse, cioè 5 per categoria.
- La soglia «12 domande per categoria e livello» della specifica precedente
  avrebbe chiesto 960 domande (16 categorie × 5 livelli × 12). **Non è un
  vincolo del gioco**: la meccanica ne consuma una per livello e occorrenza.
- Scelta fatta: **80 domande dedicate**, una per ciascuna delle 16 categorie e
  delle 5 fasce. Coprono 16 occorrenze (tre serate) e lasciano al presentatore
  tutte le categorie ufficiali. Nessun fatto nuovo: sono domande già in banca,
  riclassificate.

### Criterio delle cinque fasce

| Fascia | Livello | Chi la sa |
| --- | --- | --- |
| facile | 100 | quasi ogni adulto, senza pensarci |
| medio-facile | 200 | chi ha una cultura generale da scuola dell'obbligo |
| media | 300 | chi segue il tema ogni tanto; la risposta non è ovvia ma è nota |
| medio-difficile | 400 | chi ha studiato o segue il tema con continuità |
| difficile | 500 | solo chi segue il tema da vicino (dettaglio specifico) |

La fascia è dichiarata sulla domanda nel campo `spiaggiaBand` di
`questions-it.json`; `QuestionBankService` usa **solo** quella e, se una
categoria non ha la fascia del livello, scarta il round e prova un'altra
categoria. La difficoltà generica del Quiz (facile/media/difficile) resta
invariata e serve agli altri giochi.

### Le 80 domande riclassificate

Da rileggere in sala: la classificazione è una proposta, non un fatto. Una
domanda che il pubblico trova fuori fascia si sposta cambiando `spiaggiaBand`
(o si sostituisce con un'altra della stessa categoria).

| Categoria | Fascia | Domanda | Risposta |
| --- | --- | --- | --- |
| Storia | facile | `quiz-storia-02` Chi è stato il primo presidente degli Stati Uniti? | George Washington |
| Storia | medio-facile | `quiz-storia-03` Quale muro è caduto nel 1989, segnando la fine della Guerra Fredda? | Il Muro di Berlino |
| Storia | media | `quiz-storia-09` Chi fu il primo re dell'Italia unita nel 1861? | Vittorio Emanuele II |
| Storia | medio-difficile | `quiz-storia-07` Quale trattato pose fine alla Prima guerra mondiale con la Germania? | Il trattato di Versailles |
| Storia | difficile | `quiz-storia-20` Quale trattato del 1648 chiuse la Guerra dei Trent'anni? | La pace di Westfalia |
| Geografia e Viaggi | facile | `quiz-geografia-02` Qual è la capitale della Francia? | Parigi |
| Geografia e Viaggi | medio-facile | `quiz-geografia-03` Qual è la montagna più alta del mondo? | L'Everest |
| Geografia e Viaggi | media | `quiz-geografia-01` Qual è la capitale dell'Australia? | Canberra |
| Geografia e Viaggi | medio-difficile | `quiz-geografia-19` Qual è la capitale del Kazakistan? | Astana |
| Geografia e Viaggi | difficile | `quiz-geografia-21` Quale Paese copre il maggior numero di fusi orari? | La Francia |
| Scienza e Spazio | facile | `quiz-scienza-03` Quale elemento chimico ha come simbolo O? | Ossigeno |
| Scienza e Spazio | medio-facile | `quiz-scienza-02` Qual è il pianeta più vicino al Sole? | Mercurio |
| Scienza e Spazio | media | `quiz-scienza-13` Qual è l'unità di misura della forza nel Sistema Internazionale? | Il newton |
| Scienza e Spazio | medio-difficile | `quiz-scienza-19` Qual è l'elemento più abbondante nell'universo? | L'idrogeno |
| Scienza e Spazio | difficile | `quiz-scienza-22` Quale legge lega pressione e volume di un gas a temperatura costante? | La legge di Boyle |
| Natura e Animali | facile | `quiz-natura-02` Quale animale è noto per cambiare colore? | Il camaleonte |
| Natura e Animali | medio-facile | `quiz-natura-04` Quale pianta produce le ghiande? | La quercia |
| Natura e Animali | media | `quiz-natura-01` Qual è il mammifero terrestre più grande? | L'elefante africano |
| Natura e Animali | medio-difficile | `quiz-natura-05` Qual è il gruppo animale più numeroso sulla Terra? | Gli insetti |
| Natura e Animali | difficile | `quiz-natura-16` Qual è il mammifero più piccolo del mondo? | Il pipistrello calabrone |
| Sport | facile | `quiz-sport-01` Quanti giocatori per squadra scendono in campo nel calcio? | 11 |
| Sport | medio-facile | `quiz-sport-02` In quale sport il punteggio si conta 15, 30, 40? | Il tennis |
| Sport | media | `quiz-sport-06` Quante volte l'Italia ha vinto i Mondiali di calcio? | Quattro |
| Sport | medio-difficile | `quiz-sport-07` Quale nazione ha vinto il primo Mondiale di calcio nel 1930? | L'Uruguay |
| Sport | difficile | `quiz-sport-21` Quale nazione ha vinto la prima Coppa del Mondo di rugby nel 1987? | La Nuova Zelanda |
| Cinema, Serie TV | facile | `quiz-cinema-02` Chi ha diretto il film Titanic del 1997? | James Cameron |
| Cinema, Serie TV | medio-facile | `quiz-cinema-03` Quale attore interpreta Jack Sparrow nella saga Pirati dei Caraibi? | Johnny Depp |
| Cinema, Serie TV | media | `quiz-cinema-07` Quale film di Stanley Kubrick è ambientato nell'Overlook Hotel? | Shining |
| Cinema, Serie TV | medio-difficile | `quiz-cinema-09` Quale film di Orson Welles del 1941 è celebre per l'uso della profondità di campo? | Quarto potere |
| Cinema, Serie TV | difficile | `quiz-cinema-26` Quale serie racconta le vicende della famiglia Roy nell'industria dei media? | Succession |
| TV e Spettacolo | facile | `quiz-tv-02` Che tipo di programma è il TG1? | Un telegiornale |
| TV e Spettacolo | medio-facile | `quiz-tv-04` Quale programma mette in gara cuochi dilettanti e professionisti? | MasterChef |
| TV e Spettacolo | media | `quiz-tv-07` Quale programma politico conduce Bruno Vespa? | Porta a Porta |
| TV e Spettacolo | medio-difficile | `quiz-tv-09` In quale programma i concorrenti scelgono un pacco per vincere un premio? | Affari tuoi |
| TV e Spettacolo | difficile | `quiz-tv-20` In quale anno è andato in onda il primo episodio di Twin Peaks? | 1990 |
| Musica | facile | `quiz-musica-02` Quale gruppo ha inciso Bohemian Rhapsody? | I Queen |
| Musica | medio-facile | `quiz-musica-05` Quale gruppo inglese ha inciso Hey Jude? | I Beatles |
| Musica | media | `quiz-musica-08` Quale compositore, divenuto sordo, scrisse la Nona sinfonia? | Ludwig van Beethoven |
| Musica | medio-difficile | `quiz-musica-18` Quale compositore è noto per Le quattro stagioni? | Antonio Vivaldi |
| Musica | difficile | `quiz-musica-20` Chi ha composto il Boléro? | Maurice Ravel |
| Arte e Architettura | facile | `quiz-arte-01` Chi ha dipinto la Gioconda? | Leonardo da Vinci |
| Arte e Architettura | medio-facile | `quiz-arte-04` Chi ha dipinto La notte stellata? | Vincent van Gogh |
| Arte e Architettura | media | `quiz-arte-09` Chi ha dipinto Guernica? | Pablo Picasso |
| Arte e Architettura | medio-difficile | `quiz-arte-08` Chi ha progettato la cupola del Duomo di Firenze? | Filippo Brunelleschi |
| Arte e Architettura | difficile | `quiz-arte-20` Quale architetto progettò la Sagrada Família? | Antoni Gaudí |
| Politica e Attualità | facile | `quiz-politica-03` Chi è il capo dello Stato in Italia? | Il Presidente della Repubblica |
| Politica e Attualità | medio-facile | `quiz-politica-04` Quanti Stati fanno parte dell'Unione Europea? | 27 |
| Politica e Attualità | media | `quiz-politica-01` In quale anno è entrata in vigore la Costituzione italiana? | 1948 |
| Politica e Attualità | medio-difficile | `quiz-politica-08` Quanti anni dura il mandato del Presidente della Repubblica italiana? | Sette |
| Politica e Attualità | difficile | `quiz-politica-19` Quanti membri permanenti ha il Consiglio di sicurezza dell'ONU? | Cinque |
| Motori | facile | `quiz-motori-01` Quale casa automobilistica produce la Golf? | Volkswagen |
| Motori | medio-facile | `quiz-motori-02` Quale marchio ha come simbolo il cavallino rampante? | La Ferrari |
| Motori | media | `quiz-motori-06` Quale scuderia ha vinto più titoli costruttori nella storia della Formula 1? | La Ferrari |
| Motori | medio-difficile | `quiz-motori-08` Quanti cilindri ha tradizionalmente il motore boxer della Porsche 911? | Sei |
| Motori | difficile | `quiz-motori-09` Chi ha vinto il primo campionato mondiale di Formula 1 nel 1950? | Nino Farina |
| Cibo e Gastronomia | facile | `quiz-cibo-04` Quale città è famosa in tutto il mondo per la pizza? | Napoli |
| Cibo e Gastronomia | medio-facile | `quiz-cibo-01` Qual è l'ingrediente principale del pesto genovese? | Il basilico |
| Cibo e Gastronomia | media | `quiz-cibo-03` Quale formaggio si usa nella ricetta tradizionale della carbonara? | Il pecorino |
| Cibo e Gastronomia | medio-difficile | `quiz-cibo-07` Quale vino piemontese si produce con uve Nebbiolo? | Il Barolo |
| Cibo e Gastronomia | difficile | `quiz-cibo-19` Quale salsa fredda provenzale si prepara con aglio, olio e tuorlo? | L'aioli |
| Lingua e Letteratura | facile | `quiz-lingua-06` Chi ha scritto la Divina Commedia? | Dante Alighieri |
| Lingua e Letteratura | medio-facile | `quiz-lingua-13` Chi ha scritto Pinocchio? | Carlo Collodi |
| Lingua e Letteratura | media | `quiz-lingua-04` Quale di queste parole è un palindromo? | Anna |
| Lingua e Letteratura | medio-difficile | `quiz-lingua-05` Come si chiama la parte della grammatica che studia la struttura della frase? | La sintassi |
| Lingua e Letteratura | difficile | `quiz-lingua-20` Quale romanzo di Italo Calvino racconta un ragazzo che vive sugli alberi? | Il barone rampante |
| Anime e manga | facile | `quiz-anime-02` Come si chiama il protagonista di Naruto? | Naruto Uzumaki |
| Anime e manga | medio-facile | `quiz-anime-10` Come si chiama il compagno elettrico di Ash Ketchum? | Pikachu |
| Anime e manga | media | `quiz-anime-05` Quale studio ha prodotto Spirited Away? | Studio Ghibli |
| Anime e manga | medio-difficile | `quiz-anime-07` Quale anime ha come protagonisti i fratelli Elric? | Fullmetal Alchemist |
| Anime e manga | difficile | `quiz-anime-18` In quale anno uscì il primo capitolo di Dragon Ball? | 1984 |
| Gaming e Tecnologia | facile | `quiz-gaming-03` Qual è il sistema operativo di Google per smartphone? | Android |
| Gaming e Tecnologia | medio-facile | `quiz-gaming-06` Quale componente è chiamato CPU? | Il processore |
| Gaming e Tecnologia | media | `quiz-gaming-04` Chi è stato il cofondatore di Microsoft insieme a Paul Allen? | Bill Gates |
| Gaming e Tecnologia | medio-difficile | `quiz-gaming-13` Quale azienda ha sviluppato Windows? | Microsoft |
| Gaming e Tecnologia | difficile | `quiz-gaming-20` Quale protocollo assegna automaticamente gli indirizzi IP? | DHCP |
| Curiosità | facile | `quiz-curiosita-03` Quale frutto ha i semi all'esterno? | La fragola |
| Curiosità | medio-facile | `quiz-curiosita-06` Quale cibo può conservarsi a lungo senza deteriorarsi? | Il miele |
| Curiosità | media | `quiz-curiosita-02` Quale pianeta è il più caldo del sistema solare? | Venere |
| Curiosità | medio-difficile | `quiz-curiosita-07` Quale animale ha tre cuori? | Il polpo |
| Curiosità | difficile | `quiz-curiosita-19` Qual è l'edificio più alto del mondo? | Il Burj Khalifa |

## Campione di difficoltà del Quiz (B2, 23 novembre 2026)

Criterio: campione estratto a caso con seed fisso **20261123** dalle domande `QUIZ` a quattro opzioni di `questions-it.json`, trenta per fascia dichiarata (`difficulty`). Il seed rende il campione riproducibile; non è una scelta di merito. Giudicare ogni domanda con il criterio delle fasce (facile: lo sa quasi ogni adulto; media: serve una conoscenza specifica ma diffusa; difficile: lo sa solo chi segue il tema) e segnare le ricollocazioni da applicare a parte.

### Fascia facile (30 domande)

| ID | Categoria | Domanda | Risposta | Distrattori |
| --- | --- | --- | --- | --- |
| `quiz-cinema-serie-tv-01` | Cinema, Serie TV | Quale serie italiana racconta le indagini di un prete di paese? | Don Matteo | Un posto al sole · La piovra · Il commissario Montalbano |
| `quiz-lingua-letteratura-03` | Lingua e Letteratura | Quale poeta ha scritto la canzone Italia mia? | Francesco Petrarca | Ludovico Ariosto · Dante Alighieri · Giovanni Boccaccio |
| `quiz-cinema-03` | Cinema, Serie TV | Quale attore interpreta Jack Sparrow nella saga Pirati dei Caraibi? | Johnny Depp | Brad Pitt · Orlando Bloom · Keanu Reeves |
| `quiz-cinema-11` | Cinema, Serie TV | Chi interpreta Harry Potter nei film della saga? | Daniel Radcliffe | Elijah Wood · Rupert Grint · Tom Felton |
| `quiz-politica-attualità-01` | Politica e Attualità | Quale strumento permette di pagare contactless in negozio? | La carta con NFC | La banconota da 500 euro · Il vaglia postale · Il libretto degli assegni |
| `quiz-scienza-12` | Scienza e Spazio | Quale gas respirano gli esseri umani per vivere? | L'ossigeno | L'elio · L'idrogeno · L'azoto |
| `quiz-natura-natura-02` | Natura e Animali | Quale gas rilasciano le piante durante la fotosintesi? | L'ossigeno | Il metano · L'azoto · L'anidride carbonica |
| `quiz-lingua-06` | Lingua e Letteratura | Chi ha scritto la Divina Commedia? | Dante Alighieri | Alessandro Manzoni · Francesco Petrarca · Giovanni Boccaccio |
| `quiz-lingua-14` | Lingua e Letteratura | Quale segno di punteggiatura chiude una domanda? | Il punto interrogativo | La virgola semplice · I due punti · Il punto esclamativo |
| `quiz-cinema-14` | Cinema, Serie TV | Chi ha diretto Jurassic Park? | Steven Spielberg | James Cameron · George Lucas · Ridley Scott |
| `quiz-geografia-02` | Geografia e Viaggi | Qual è la capitale della Francia? | Parigi | Marsiglia · Lione · Bordeaux |
| `quiz-scienza-05` | Scienza e Spazio | Quale gas assorbono le piante durante la fotosintesi? | L'anidride carbonica | L'ossigeno · L'azoto atmosferico · L'idrogeno |
| `quiz-natura-03` | Natura e Animali | Quale organo permette ai pesci di respirare sott'acqua? | Le branchie | Le squame · I polmoni · Le pinne |
| `quiz-gaming-03` | Gaming e Tecnologia | Qual è il sistema operativo di Google per smartphone? | Android | Symbian · iOS · Windows Phone |
| `quiz-arte-04` | Arte e Architettura | Chi ha dipinto La notte stellata? | Vincent van Gogh | Paul Cézanne · Claude Monet · Paul Gauguin |
| `quiz-natura-07` | Natura e Animali | Quale animale marino è un mammifero? | Il delfino | Il tonno · Il polpo · Lo squalo |
| `quiz-geografia-13` | Geografia e Viaggi | In quale continente si trova il deserto del Sahara? | Africa | Oceania · America meridionale · Asia |
| `quiz-politica-02` | Politica e Attualità | Quale forma di governo ha oggi l'Italia? | La repubblica parlamentare | Lo stato federale · La monarchia costituzionale · La repubblica presidenziale |
| `quiz-cibo-01` | Cibo e Gastronomia | Qual è l'ingrediente principale del pesto genovese? | Il basilico | Il prezzemolo · Il rosmarino · La salvia |
| `quiz-curiosita-13` | Curiosità | Quanti giorni ha un anno bisestile? | 366 | 367 · 364 · 365 |
| `quiz-motori-11` | Motori | Quale casa automobilistica ha per simbolo il cavallino rampante? | La Ferrari | La Maserati · La Lamborghini · La Porsche |
| `quiz-geografia-11` | Geografia e Viaggi | Qual è la capitale della Spagna? | Madrid | Valencia · Siviglia · Barcellona |
| `quiz-scienza-02` | Scienza e Spazio | Qual è il pianeta più vicino al Sole? | Mercurio | Terra · Venere · Marte |
| `quiz-politica-attualità-02` | Politica e Attualità | Quale piattaforma è usata per riunioni di lavoro a distanza? | Zoom | Netflix · Spotify · Steam |
| `quiz-geografia-12` | Geografia e Viaggi | Qual è il fiume più lungo d'Italia? | Il Po | L'Adige · Il Tevere · L'Arno |
| `quiz-curiosita-14` | Curiosità | Quale colore si ottiene mescolando blu e giallo? | Il verde | L'arancione · Il viola · Il marrone |
| `quiz-musica-04` | Musica | Chi ha cantato Nel blu dipinto di blu, conosciuta come Volare? | Domenico Modugno | Adriano Celentano · Gino Paoli · Lucio Battisti |
| `quiz-tv-01` | TV e Spettacolo | Quale quiz storico conduceva Mike Bongiorno chiedendo di lasciare o raddoppiare? | Lascia o raddoppia? | Rischiatutto · Il Telemike · Il gioco dei pacchi |
| `quiz-arte-architettura-02` | Arte e Architettura | Quale ingegnere ha progettato la Torre Eiffel? | Gustave Eiffel | Antoni Gaudí · Le Corbusier · Santiago Calatrava |
| `quiz-natura-09` | Natura e Animali | Quale parte della pianta assorbe acqua e sali minerali? | Le radici | Le foglie · Il fiore · Il fusto |

### Fascia medio (30 domande)

| ID | Categoria | Domanda | Risposta | Distrattori |
| --- | --- | --- | --- | --- |
| `quiz-cibo-gastronomia-08` | Cibo e Gastronomia | Quale strumento controlla la temperatura interna degli alimenti in cottura? | Il termometro da cucina | La schiumarola · Il mestolo da cucina · Il timer da cucina |
| `quiz-politica-08` | Politica e Attualità | Quanti anni dura il mandato del Presidente della Repubblica italiana? | Sette | Sei · Nove · Cinque |
| `quiz-cibo-18` | Cibo e Gastronomia | Quale dolce napoletano è fatto di pasta sfoglia e ricotta? | La sfogliatella | Il tiramisù · Il cannolo siciliano · Il panettone |
| `quiz-cibo-17` | Cibo e Gastronomia | Quale caffè si serve con una dose d'acqua più lunga? | L'espresso lungo | Il ristretto · Il macchiato · Il caffè corretto |
| `quiz-curiosita-04` | Curiosità | Quale mammifero depone le uova? | L'ornitorinco | Il canguro · Il delfino · Il pipistrello |
| `quiz-motori-17` | Motori | Quale pilota è soprannominato Il Dottore nel motomondiale? | Valentino Rossi | Casey Stoner · Giacomo Agostini · Jorge Lorenzo |
| `quiz-geografia-viaggi-06` | Geografia e Viaggi | Quale città spagnola è celebre per la Sagrada Família? | Barcellona | Valencia · Siviglia · Madrid |
| `quiz-politica-attualità-06` | Politica e Attualità | Quale organizzazione raccoglie i dati sanitari globali? | L'OMS | L'UNESCO · L'ILO · La FAO |
| `quiz-lingua-04` | Lingua e Letteratura | Quale di queste parole è un palindromo? | Anna | Luna · Casa · Sole |
| `quiz-cibo-14` | Cibo e Gastronomia | Quale formaggio condisce la pizza margherita? | Il fior di latte | Il pecorino romano · Il gorgonzola · Il taleggio |
| `quiz-geografia-08` | Geografia e Viaggi | Quale capitale europea si trova sul Danubio ed è nata dall'unione di Buda e Pest? | Budapest | Vienna · Bratislava · Belgrado |
| `quiz-curiosita-18` | Curiosità | Quanto pesa approssimativamente un litro d'acqua? | Un chilogrammo | Due chilogrammi · Dieci grammi · Mezzo chilogrammo |
| `quiz-curiosita-02` | Curiosità | Quale pianeta è il più caldo del sistema solare? | Venere | Mercurio · Marte · Giove |
| `quiz-curiosita-40` | Curiosità | In quale anno è entrata in servizio la prima linea della metropolitana di Roma? | 1955 | 1937 · 1968 · 1980 |
| `quiz-gaming-gaming-01` | Gaming e Tecnologia | Quale gioco è ambientato nel regno di Hyrule? | The Legend of Zelda | Star Fox 64 · Metroid Prime · Kirby's Dream Land |
| `quiz-musica-16` | Musica | Quale strumento a fiato è il più acuto dell'orchestra? | L'ottavino | L'oboe · Il flauto traverso · Il clarinetto |
| `quiz-politica-01` | Politica e Attualità | In quale anno è entrata in vigore la Costituzione italiana? | 1948 | 1945 · 1946 · 1950 |
| `quiz-arte-15` | Arte e Architettura | Chi ha progettato la cupola di Santa Maria del Fiore? | Filippo Brunelleschi | Donatello · Giotto · Leon Battista Alberti |
| `quiz-sport-06` | Sport | Quante volte l'Italia ha vinto i Mondiali di calcio? | Quattro | Cinque · Due · Tre |
| `quiz-geografia-15` | Geografia e Viaggi | Quale mare bagna la costa di Napoli? | Il mar Tirreno | Il mar Adriatico · Il mar Ionio · Il mar Ligure |
| `quiz-politica-15` | Politica e Attualità | In che anno è entrata in vigore la Costituzione italiana? | 1948 | 1946 · 1947 · 1950 |
| `quiz-cibo-15` | Cibo e Gastronomia | Quale spezia dà al curry il colore giallo? | La curcuma | Lo zafferano · Il peperoncino · Il pepe nero |
| `quiz-gaming-13` | Gaming e Tecnologia | Quale azienda ha sviluppato Windows? | Microsoft | Apple · IBM Corporation · Google |
| `quiz-tv-09` | TV e Spettacolo | In quale programma i concorrenti scelgono un pacco per vincere un premio? | Affari tuoi | L'eredità · Reazione a catena · Caduta libera |
| `quiz-musica-17` | Musica | Chi era il cantante dei Queen? | Freddie Mercury | Mick Jagger · David Bowie · Robert Plant |
| `quiz-storia-08` | Storia | Quale navigatore iniziò la prima circumnavigazione del globo? | Ferdinando Magellano | Cristoforo Colombo · Vasco da Gama · James Cook |
| `quiz-lingua-05` | Lingua e Letteratura | Come si chiama la parte della grammatica che studia la struttura della frase? | La sintassi | La semantica · La morfologia · La fonetica |
| `quiz-anime-08` | Anime e manga | Quale manga ha come protagonista Light Yagami? | Death Note | Monster · Tokyo Ghoul · Parasyte |
| `quiz-gaming-15` | Gaming e Tecnologia | Quale browser è sviluppato da Google? | Chrome | Firefox · Safari · Edge |
| `quiz-tv-tv-01` | TV e Spettacolo | Quale conduttore ha legato il suo nome al Festival di Sanremo per molti anni? | Pippo Baudo | Mike Bongiorno · Enzo Tortora · Corrado |

### Fascia difficile (30 domande)

| ID | Categoria | Domanda | Risposta | Distrattori |
| --- | --- | --- | --- | --- |
| `quiz-cibo-gastronomia-10` | Cibo e Gastronomia | Quale reazione chimica dà la crosta bruna alla carne arrostita? | La reazione di Maillard | La fermentazione · La caramellizzazione · La saponificazione |
| `quiz-arte-18` | Arte e Architettura | Quale stile architettonico caratterizza il Duomo di Milano? | Il gotico | Il romanico · Il neoclassico · Il barocco |
| `quiz-anime-manga-09` | Anime e manga | Quale autore ha creato il manga 20th Century Boys? | Naoki Urasawa | Takehiko Inoue · Tsugumi Ohba · Hajime Isayama |
| `quiz-cinema-25` | Cinema, Serie TV | Chi ha composto la colonna sonora di C'era una volta il West? | Ennio Morricone | Nino Rota · Piero Piccioni · Luis Bacalov |
| `quiz-cinema-26` | Cinema, Serie TV | Quale serie racconta le vicende della famiglia Roy nell'industria dei media? | Succession | The Newsroom · Billions · Mad Men |
| `quiz-geografia-viaggi-15` | Geografia e Viaggi | Quale arcipelago norvegese è noto per il sole di mezzanotte e i fiordi? | Le Lofoten | Le Ebridi · Le Orcadi · Le Shetland |
| `quiz-politica-attualità-13` | Politica e Attualità | Quale istituto italiano produce le statistiche ufficiali del Paese? | L'ISTAT | La Corte dei Conti · La Banca d'Italia · Il Ministero dell'Economia |
| `quiz-anime-06` | Anime e manga | Chi ha creato Sailor Moon? | Naoko Takeuchi | Ai Yazawa · CLAMP · Rumiko Takahashi |
| `quiz-lingua-21` | Lingua e Letteratura | Quale movimento letterario italiano lanciò il primo manifesto nel 1909? | Il futurismo | Il verismo · L'ermetismo · Il crepuscolarismo |
| `quiz-curiosita-19` | Curiosità | Qual è l'edificio più alto del mondo? | Il Burj Khalifa | Il One World Trade Center · La Torre di Shanghai · Il Taipei 101 |
| `quiz-politica-attualità-14` | Politica e Attualità | Quale programma europeo finanzia ricerca e innovazione dal 2021? | Horizon Europe | LIFE · Erasmus+ · Europa Creativa |
| `quiz-cibo-gastronomia-13` | Cibo e Gastronomia | Quale salsa madre francese si prepara con roux scuro e brodo? | La salsa spagnola | La velouté · La salsa olandese · La salsa bernese |
| `quiz-scienza-spazio-07` | Scienza e Spazio | Quale missione portò per la prima volta un rover su Marte nel 1997? | Pathfinder | Spirit · Curiosity · Opportunity |
| `quiz-sport-24` | Sport | Qual è la distanza della prova olimpica di triathlon? | 1500 m nuoto, 40 km bici, 10 km corsa | 2000 m nuoto, 60 km bici, 15 km corsa · 750 m nuoto, 20 km bici, 5 km corsa · 1000 m nuoto, 30 km bici, 10 km corsa |
| `quiz-cibo-19` | Cibo e Gastronomia | Quale salsa fredda provenzale si prepara con aglio, olio e tuorlo? | L'aioli | La salsa tartara · La salsa verde · La maionese |
| `quiz-storia-25` | Storia | Quale civiltà precolombiana costruì Machu Picchu? | Gli Inca | I Maya · Gli Aztechi · Gli Olmechi |
| `quiz-natura-20` | Natura e Animali | Quali organismi costruiscono le barriere coralline? | I polipi del corallo | I molluschi bivalvi · I ricci di mare · Le spugne marine |
| `quiz-musica-10` | Musica | Chi ha composto la tetralogia L'anello del Nibelungo? | Richard Wagner | Richard Strauss · Gustav Mahler · Giuseppe Verdi |
| `quiz-cibo-gastronomia-12` | Cibo e Gastronomia | Quale coltura batterica è usata per produrre lo yogurt? | I lattobacilli | Gli acetobatteri · Gli stafilococchi · I lieviti |
| `quiz-natura-19` | Natura e Animali | Qual è il serpente velenoso più lungo del mondo? | Il cobra reale | Il mamba nero · Il taipan · La vipera del Gabon |
| `quiz-cibo-24` | Cibo e Gastronomia | In quale regione spagnola si produce il vino Rioja? | Nella Rioja | In Galizia · In Andalusia · In Catalogna |
| `quiz-gaming-22` | Gaming e Tecnologia | Quale gioco di Epic Games ha reso popolare la costruzione durante una battle royale? | Fortnite | PUBG · Apex Legends · Warzone |
| `quiz-tv-21` | TV e Spettacolo | Quale attore interpreta il Dottor House nella serie House? | Hugh Laurie | Michael Sheen · Hugh Grant · Benedict Cumberbatch |
| `quiz-politica-19` | Politica e Attualità | Quanti membri permanenti ha il Consiglio di sicurezza dell'ONU? | Cinque | Quindici · Dieci · Sette |
| `quiz-sport-22` | Sport | In quale sport si assegna la Coppa Davis? | Nel tennis | Nel rugby · Nel golf · Nella pallamano |
| `quiz-cinema-serie-tv-07` | Cinema, Serie TV | Quale serie spagnola racconta una banda con le maschere di Dalí? | La casa di carta | Narcos: Messico · Élite (serie) · Vis a vis |
| `quiz-arte-10` | Arte e Architettura | Quale movimento artistico teorizzò Filippo Tommaso Marinetti? | Il futurismo | Il surrealismo · Il dadaismo · Il simbolismo |
| `quiz-tv-25` | TV e Spettacolo | Quale attore ha interpretato il commissario Cattani ne La piovra? | Michele Placido | Kim Rossi Stuart · Raoul Bova · Luca Zingaretti |
| `quiz-gaming-19` | Gaming e Tecnologia | Quale azienda ha creato il motore grafico Unreal Engine? | Epic Games | Unity Technologies · id Software · Valve |
| `quiz-politica-10` | Politica e Attualità | Quanti giudici compongono la Corte costituzionale italiana? | Quindici | Nove · Dodici · Ventuno |

## Fatti da verificare

_(nessuno: ogni evento Timeline aggiunto porta la sua fonte nel campo `source`;
le voci senza fonte sicura non sono state inserite)_

## Ultima spiaggia — 160 domande nuove (23 novembre 2026)

Aggiunte per portare la banca a **3 domande per categoria e livello** (240 in tutto).
La banca non poteva superare l'audit con una sola domanda per cella: la soglia era 1.
Ogni riga ha la voce usata per la verifica: vanno lette a mano, come le altre.

| id | categoria | fascia | domanda | corretta | sbagliate | fonte |
| --- | --- | --- | --- | --- | --- | --- |
| `spiaggia-anime-facile-01` | Anime e manga | facile | Chi è il protagonista di One Piece? | Monkey D. Luffy | Roronoa Zoro · Naruto Uzumaki · Son Goku | Wikipedia it: Monkey D. Luffy |
| `spiaggia-anime-facile-02` | Anime e manga | facile | In quale manga il protagonista è Son Goku? | Dragon Ball | Naruto · Bleach · One Piece | Wikipedia it: Dragon Ball |
| `spiaggia-anime-mediofacile-01` | Anime e manga | medio-facile | In quale manga un quaderno uccide chi ne legge il nome? | Death Note | Il Libro dei Morti · Il Grimorio · Il Diario Nero | Wikipedia it: Death Note |
| `spiaggia-anime-mediofacile-02` | Anime e manga | medio-facile | Quale manga di basket ha come protagonista Hanamichi Sakuragi? | Slam Dunk | Kuroko no Basket · Captain Tsubasa · Haikyu!! | Wikipedia it: Slam Dunk |
| `spiaggia-anime-media-01` | Anime e manga | media | Chi ha creato il manga L'attacco dei giganti? | Hajime Isayama | Eiichiro Oda · Masashi Kishimoto · Tite Kubo | Wikipedia it: L'attacco dei giganti |
| `spiaggia-anime-media-02` | Anime e manga | media | Come si chiama la volpe a nove code sigillata dentro Naruto? | Kurama | Shukaku · Matatabi · Gyuki | Wikipedia it: Kurama (Naruto) |
| `spiaggia-anime-mediodifficile-01` | Anime e manga | medio-difficile | In quale anno è iniziata la serializzazione di One Piece? | 1997 | 1995 · 1999 · 2001 | Wikipedia it: One Piece |
| `spiaggia-anime-mediodifficile-02` | Anime e manga | medio-difficile | Chi ha scritto il manga Death Note? | Tsugumi Ohba | Takeshi Obata · Hajime Isayama · Naoki Urasawa | Wikipedia it: Death Note |
| `spiaggia-anime-difficile-01` | Anime e manga | difficile | Quale studio ha animato il film Akira del 1988? | TMS Entertainment | Studio Ghibli · Production I.G · Toei Animation | Wikipedia it: Akira (film) |
| `spiaggia-anime-difficile-02` | Anime e manga | difficile | Chi ha diretto il film animato Your Name? | Makoto Shinkai | Hayao Miyazaki · Mamoru Hosoda · Satoshi Kon | Wikipedia it: Your Name |
| `spiaggia-arte-facile-01` | Arte e Architettura | facile | Chi ha scolpito il David di Firenze? | Michelangelo | Donatello · Bernini · Cellini | Wikipedia it: David (Michelangelo) |
| `spiaggia-arte-facile-02` | Arte e Architettura | facile | In quale città si trova la Torre Eiffel? | Parigi | Lione · Marsiglia · Bordeaux | Wikipedia it: Torre Eiffel |
| `spiaggia-arte-mediofacile-01` | Arte e Architettura | medio-facile | Chi ha dipinto La nascita di Venere? | Botticelli | Raffaello · Giorgione · Mantegna | Wikipedia it: La nascita di Venere |
| `spiaggia-arte-mediofacile-02` | Arte e Architettura | medio-facile | Chi ha dipinto La scuola di Atene? | Raffaello | Michelangelo · Tiziano · Il Perugino | Wikipedia it: La scuola di Atene |
| `spiaggia-arte-media-01` | Arte e Architettura | media | Quale corrente artistica ha in Claude Monet il suo esponente più noto? | L'impressionismo | Il cubismo · Il romanticismo · Il barocco | Wikipedia it: Impressionismo |
| `spiaggia-arte-media-02` | Arte e Architettura | media | Chi ha dipinto L'urlo? | Edvard Munch | Gustav Klimt · Egon Schiele · Paul Klee | Wikipedia it: L'urlo |
| `spiaggia-arte-mediodifficile-01` | Arte e Architettura | medio-difficile | Chi ha progettato il museo Guggenheim di Bilbao? | Frank Gehry | Norman Foster · Renzo Piano · Zaha Hadid | Wikipedia it: Museo Guggenheim Bilbao |
| `spiaggia-arte-mediodifficile-02` | Arte e Architettura | medio-difficile | Chi ha dipinto Las Meninas? | Diego Velázquez | Francisco Goya · El Greco · Bartolomé Murillo | Wikipedia it: Las Meninas |
| `spiaggia-arte-difficile-01` | Arte e Architettura | difficile | Quale artista ha introdotto il ready-made con l'opera Fontana? | Marcel Duchamp | Man Ray · Pablo Picasso · Salvador Dalí | Wikipedia it: Fontana (Duchamp) |
| `spiaggia-arte-difficile-02` | Arte e Architettura | difficile | Quale architetto ha progettato la cupola di San Pietro a Roma? | Michelangelo | Brunelleschi · Bramante · Bernini | Wikipedia it: Cupola di San Pietro |
| `spiaggia-cibo-facile-01` | Cibo e Gastronomia | facile | Quale piatto milanese si prepara con riso e zafferano? | Risotto alla milanese | La paella valenciana · Il riso al salto · La panissa vercellese | Wikipedia it: Risotto alla milanese |
| `spiaggia-cibo-facile-02` | Cibo e Gastronomia | facile | Da quale pianta si ricava la bevanda del caffè? | Dal caffè | Dal cacao · Dal tè · Dal mate | Wikipedia it: Caffè |
| `spiaggia-cibo-mediofacile-01` | Cibo e Gastronomia | medio-facile | Quale dolce siciliano si riempie di ricotta dolce? | Il cannolo | La sfogliatella · Il babà · La cassata | Wikipedia it: Cannolo siciliano |
| `spiaggia-cibo-mediofacile-02` | Cibo e Gastronomia | medio-facile | Quale dolce napoletano si prepara con ricotta e grano cotto? | La pastiera | La sfogliatella · Il babà · La delizia al limone | Wikipedia it: Pastiera |
| `spiaggia-cibo-media-01` | Cibo e Gastronomia | media | Quale spezia si ricava dagli stimmi del croco? | Lo zafferano | La curcuma · Il pepe · La paprica | Wikipedia it: Zafferano |
| `spiaggia-cibo-media-02` | Cibo e Gastronomia | media | Da quale cereale si ricava la farina per il pane più comune in Italia? | Dal grano tenero | Dal riso · Dal mais · Dall'orzo | Wikipedia it: Farina di grano tenero |
| `spiaggia-cibo-mediodifficile-01` | Cibo e Gastronomia | medio-difficile | Quale formaggio campano è prodotto con latte di bufala? | La mozzarella di bufala | Il provolone del Monaco · Il caciocavallo · La scamorza affumicata | Wikipedia it: Mozzarella di bufala campana |
| `spiaggia-cibo-mediodifficile-02` | Cibo e Gastronomia | medio-difficile | Quale salsa madre francese si prepara con burro, farina e latte? | La besciamella | La maionese · La vellutata · L'olandese | Wikipedia it: Besciamella |
| `spiaggia-cibo-difficile-01` | Cibo e Gastronomia | difficile | Quale vino rosso piemontese si produce con uve Nebbiolo e invecchia almeno 38 mesi? | Il Barolo | Il Barbaresco · Il Gattinara · Il Dolcetto | Wikipedia it: Barolo (vino) |
| `spiaggia-cibo-difficile-02` | Cibo e Gastronomia | difficile | Quale tecnica di cottura sottovuoto a bassa temperatura prende il nome dal suo inventore? | La sous-vide | La confit · La brasatura · La frittura a vuoto | Wikipedia it: Sous-vide |
| `spiaggia-cinema-facile-01` | Cinema, Serie TV | facile | Chi ha diretto E.T. l'extra-terrestre? | Steven Spielberg | George Lucas · Ridley Scott · Robert Zemeckis | Wikipedia it: E.T. l'extra-terrestre |
| `spiaggia-cinema-facile-02` | Cinema, Serie TV | facile | Quale film del 1993 porta sullo schermo i dinosauri di Hammond? | Jurassic Park | Il mondo perduto · Parco giochi · Dinosauri | Wikipedia it: Jurassic Park (film) |
| `spiaggia-cinema-mediofacile-01` | Cinema, Serie TV | medio-facile | Chi interpreta Neo nella saga di Matrix? | Keanu Reeves | Laurence Fishburne · Brad Pitt · Tom Cruise | Wikipedia it: Matrix (film) |
| `spiaggia-cinema-mediofacile-02` | Cinema, Serie TV | medio-facile | Quale film Pixar del 1995 è il primo lungometraggio interamente in CGI? | Toy Story | A Bug's Life · Monsters & Co. · Shrek | Wikipedia it: Toy Story - Il mondo dei giocattoli |
| `spiaggia-cinema-media-01` | Cinema, Serie TV | media | Chi ha diretto Inception? | Christopher Nolan | David Fincher · Ridley Scott · Michael Bay | Wikipedia it: Inception |
| `spiaggia-cinema-media-02` | Cinema, Serie TV | media | In quale città è ambientata la serie Stranger Things? | Hawkins | Derry · Riverdale · Twin Peaks | Wikipedia it: Stranger Things |
| `spiaggia-cinema-mediodifficile-01` | Cinema, Serie TV | medio-difficile | Chi ha diretto 8½? | Federico Fellini | Michelangelo Antonioni · Vittorio De Sica · Luchino Visconti | Wikipedia it: 8½ |
| `spiaggia-cinema-mediodifficile-02` | Cinema, Serie TV | medio-difficile | Chi ha interpretato il Joker in Il cavaliere oscuro? | Heath Ledger | Jack Nicholson · Joaquin Phoenix · Jared Leto | Wikipedia it: Il cavaliere oscuro |
| `spiaggia-cinema-difficile-01` | Cinema, Serie TV | difficile | Quale film ha vinto la Palma d'oro a Cannes nel 2019? | Parasite | Joker · Dolor y gloria · Once Upon a Time in Hollywood | Wikipedia it: Parasite (film 2019) |
| `spiaggia-cinema-difficile-02` | Cinema, Serie TV | difficile | Chi ha composto la colonna sonora di Blade Runner del 1982? | Vangelis | Ennio Morricone · Hans Zimmer · John Williams | Wikipedia it: Blade Runner |
| `spiaggia-curiosita-facile-01` | Curiosità | facile | Quanti colori ha l'arcobaleno secondo la tradizione? | Sette | Cinque · Sei · Otto | Wikipedia it: Arcobaleno |
| `spiaggia-curiosita-facile-02` | Curiosità | facile | Quale metallo liquido è usato nei termometri tradizionali? | Il mercurio | Il piombo · Lo stagno · Il sodio | Wikipedia it: Mercurio (elemento) |
| `spiaggia-curiosita-mediofacile-01` | Curiosità | medio-facile | Quante corde ha una chitarra classica? | Sei | Quattro · Cinque · Sette | Wikipedia it: Chitarra classica |
| `spiaggia-curiosita-mediofacile-02` | Curiosità | medio-facile | Quante carte ci sono in un mazzo da poker senza jolly? | 52 | 48 · 54 · 56 | Wikipedia it: Carte da gioco |
| `spiaggia-curiosita-media-01` | Curiosità | media | Quale organo filtra il sangue e produce l'urina? | I reni | Il fegato · La milza · Il pancreas | Wikipedia it: Rene |
| `spiaggia-curiosita-media-02` | Curiosità | media | Quale metallo è il miglior conduttore di elettricità? | L'argento | Il rame · L'oro · L'alluminio | Wikipedia it: Conduttività elettrica |
| `spiaggia-curiosita-mediodifficile-01` | Curiosità | medio-difficile | Qual è l'unità di misura della pressione nel Sistema Internazionale? | Il pascal | Il bar · L'atmosfera · Il torr | Wikipedia it: Pascal (unità di misura) |
| `spiaggia-curiosita-mediodifficile-02` | Curiosità | medio-difficile | Quante ossa compongono una mano umana? | 27 | 21 · 24 · 30 | Wikipedia it: Mano |
| `spiaggia-curiosita-difficile-01` | Curiosità | difficile | Quale pianeta ha il campo magnetico più intenso del sistema solare? | Giove | Saturno · Terra · Nettuno | Wikipedia it: Giove (astronomia) |
| `spiaggia-curiosita-difficile-02` | Curiosità | difficile | Quale metallo ha il punto di fusione più alto? | Il tungsteno | Il platino · Il titanio · Il molibdeno | Wikipedia it: Tungsteno |
| `spiaggia-gaming-facile-01` | Gaming e Tecnologia | facile | Quale console Nintendo del 2006 usava un telecomando a movimento? | Wii | GameCube · Switch · N64 | Wikipedia it: Wii |
| `spiaggia-gaming-facile-02` | Gaming e Tecnologia | facile | Quale azienda produce la PlayStation? | Sony | Nintendo · Microsoft · Sega | Wikipedia it: PlayStation |
| `spiaggia-gaming-mediofacile-01` | Gaming e Tecnologia | medio-facile | Quale formato immagine supporta la trasparenza ed è diffuso sul web? | PNG | JPEG · BMP · TIFF | Wikipedia it: PNG |
| `spiaggia-gaming-mediofacile-02` | Gaming e Tecnologia | medio-facile | Quale gioco a blocchi è il più venduto di sempre? | Minecraft | Tetris · Roblox · Fortnite | Wikipedia it: Minecraft |
| `spiaggia-gaming-media-01` | Gaming e Tecnologia | media | Quale protocollo rende cifrata la navigazione sul web? | HTTPS | FTP · SMTP · HTTP | Wikipedia it: HTTPS |
| `spiaggia-gaming-media-02` | Gaming e Tecnologia | media | Quale linguaggio definisce lo stile delle pagine web? | CSS | HTML · SQL · Python | Wikipedia it: CSS |
| `spiaggia-gaming-mediodifficile-01` | Gaming e Tecnologia | medio-difficile | Quale console Sony è uscita nel 2020? | PlayStation 5 | PlayStation 4 · PlayStation 4 Pro · PSP | Wikipedia it: PlayStation 5 |
| `spiaggia-gaming-mediodifficile-02` | Gaming e Tecnologia | medio-difficile | Quale azienda ha progettato il chip M1 dei Mac? | Apple | Intel · AMD · Qualcomm | Wikipedia it: Apple M1 |
| `spiaggia-gaming-difficile-01` | Gaming e Tecnologia | difficile | Quale standard corrisponde al Wi-Fi 6? | 802.11ax | 802.11ac · 802.11n · 802.11g | Wikipedia it: IEEE 802.11ax |
| `spiaggia-gaming-difficile-02` | Gaming e Tecnologia | difficile | Quale algoritmo asimmetrico è alla base della maggior parte dei certificati HTTPS? | RSA | MD5 · SHA-1 · AES | Wikipedia it: RSA (crittografia) |
| `spiaggia-geografia-facile-01` | Geografia e Viaggi | facile | Qual è la capitale della Germania? | Berlino | Monaco di Baviera · Amburgo · Francoforte | Wikipedia it: Berlino |
| `spiaggia-geografia-facile-02` | Geografia e Viaggi | facile | Qual è l'oceano più esteso della Terra? | L'oceano Pacifico | L'oceano Atlantico · L'oceano Indiano · L'oceano Artico | Wikipedia it: Oceano Pacifico |
| `spiaggia-geografia-mediofacile-01` | Geografia e Viaggi | medio-facile | Quale nazione ha per capitale Oslo? | La Norvegia | La Svezia · La Danimarca · La Finlandia | Wikipedia it: Oslo |
| `spiaggia-geografia-mediofacile-02` | Geografia e Viaggi | medio-facile | Qual è l'isola più grande del Mediterraneo? | La Sicilia | La Sardegna · Cipro · Corsica | Wikipedia it: Sicilia |
| `spiaggia-geografia-media-01` | Geografia e Viaggi | media | Qual è il fiume più lungo dell'Africa? | Il Nilo | Il Congo · Il Niger · Lo Zambesi | Wikipedia it: Nilo |
| `spiaggia-geografia-media-02` | Geografia e Viaggi | media | Qual è la capitale dell'Argentina? | Buenos Aires | Córdoba · Rosario · Mendoza | Wikipedia it: Buenos Aires |
| `spiaggia-geografia-mediodifficile-01` | Geografia e Viaggi | medio-difficile | Quale catena montuosa segna il confine tra Europa e Asia in Russia? | Gli Urali | Il Caucaso · I Monti Altaj · I Carpazi | Wikipedia it: Urali |
| `spiaggia-geografia-mediodifficile-02` | Geografia e Viaggi | medio-difficile | Quale deserto si estende tra Cile e Perù? | L'Atacama | Il Namib · Il Gobi · Il Kalahari | Wikipedia it: Deserto di Atacama |
| `spiaggia-geografia-difficile-01` | Geografia e Viaggi | difficile | Qual è la capitale del Kirghizistan? | Biškek | Almaty · Dušanbe · Taškent | Wikipedia it: Biškek |
| `spiaggia-geografia-difficile-02` | Geografia e Viaggi | difficile | Qual è la vetta più alta dell'Africa? | Il Kilimangiaro | Il monte Kenya · Il Ruwenzori · Il Toubkal | Wikipedia it: Kilimangiaro |
| `spiaggia-lingua-facile-01` | Lingua e Letteratura | facile | Quante lettere ha l'alfabeto italiano? | 21 | 23 · 26 · 19 | Wikipedia it: Alfabeto italiano |
| `spiaggia-lingua-facile-02` | Lingua e Letteratura | facile | Qual è il plurale di «camicia»? | Camicie | Camice · Camicii · Camicia | Wikipedia it: Plurale italiano |
| `spiaggia-lingua-mediofacile-01` | Lingua e Letteratura | medio-facile | Chi ha scritto Il piacere? | Gabriele D’Annunzio | Italo Calvino · Primo Levi · Leonardo Sciascia | Wikipedia it: Il piacere (romanzo) |
| `spiaggia-lingua-mediofacile-02` | Lingua e Letteratura | medio-facile | Chi ha scritto la poesia L'infinito? | Giacomo Leopardi | Ugo Foscolo · Giovanni Pascoli · Gabriele D'Annunzio | Wikipedia it: L'infinito |
| `spiaggia-lingua-media-01` | Lingua e Letteratura | media | Chi ha scritto Il vecchio e il mare? | Ernest Hemingway | John Steinbeck · Francis Scott Fitzgerald · William Faulkner | Wikipedia it: Il vecchio e il mare |
| `spiaggia-lingua-media-02` | Lingua e Letteratura | media | Quale romanzo di Orwell racconta il regime del Grande Fratello? | 1984 | La fattoria degli animali · Fahrenheit 451 · Il mondo nuovo | Wikipedia it: 1984 (romanzo) |
| `spiaggia-lingua-mediodifficile-01` | Lingua e Letteratura | medio-difficile | Chi ha scritto La coscienza di Zeno? | Italo Svevo | Luigi Pirandello · Federico Tozzi · Alberto Moravia | Wikipedia it: La coscienza di Zeno |
| `spiaggia-lingua-mediodifficile-02` | Lingua e Letteratura | medio-difficile | Come si chiama la figura retorica che accosta due termini opposti? | Ossimoro | Metafora · Sinestesia · Anafora | Wikipedia it: Ossimoro |
| `spiaggia-lingua-difficile-01` | Lingua e Letteratura | difficile | Chi ha scritto Il sentiero dei nidi di ragno? | Italo Calvino | Cesare Pavese · Beppe Fenoglio · Elio Vittorini | Wikipedia it: Il sentiero dei nidi di ragno |
| `spiaggia-lingua-difficile-02` | Lingua e Letteratura | difficile | Quale poeta latino ha scritto l'Eneide? | Virgilio | Ovidio · Orazio · Lucano | Wikipedia it: Eneide |
| `spiaggia-motori-facile-01` | Motori | facile | Quale casa ha prodotto la 500, simbolo del boom italiano? | Fiat | Renault · Volkswagen · Opel | Wikipedia it: Fiat 500 |
| `spiaggia-motori-facile-02` | Motori | facile | Quale azienda italiana produce la Vespa? | Piaggio | Ducati · Aprilia · Benelli | Wikipedia it: Vespa |
| `spiaggia-motori-mediofacile-01` | Motori | medio-facile | Quale casa giapponese produce la Corolla? | Toyota | Honda · Nissan · Mazda | Wikipedia it: Toyota Corolla |
| `spiaggia-motori-mediofacile-02` | Motori | medio-facile | Chi ha vinto sette titoli mondiali di Formula 1 con la Ferrari? | Michael Schumacher | Lewis Hamilton · Sebastian Vettel · Niki Lauda | Wikipedia it: Michael Schumacher |
| `spiaggia-motori-media-01` | Motori | media | Quale gara di durata si corre a Le Mans? | La 24 Ore | La 12 Ore · La 1000 Miglia · La 6 Ore | Wikipedia it: 24 Ore di Le Mans |
| `spiaggia-motori-media-02` | Motori | media | Quale modello Tesla è una berlina compatta? | La Model 3 | La Model X · La Model S · Il Cybertruck | Wikipedia it: Tesla Model 3 |
| `spiaggia-motori-mediodifficile-01` | Motori | medio-difficile | Quale costruttore vinse il primo titolo mondiale costruttori di Formula 1, nel 1958? | La Vanwall | La Ferrari · La Maserati · La Cooper | Wikipedia it: Campionato mondiale costruttori di Formula 1 |
| `spiaggia-motori-mediodifficile-02` | Motori | medio-difficile | Chi ha vinto il titolo mondiale di Formula 1 nel 2021? | Max Verstappen | Lewis Hamilton · Charles Leclerc · Valtteri Bottas | Wikipedia it: Campionato mondiale di Formula 1 2021 |
| `spiaggia-motori-difficile-01` | Motori | difficile | In quale anno la Formula 1 ha introdotto l'ala mobile DRS? | 2011 | 2009 · 2013 · 2015 | Wikipedia it: Drag Reduction System |
| `spiaggia-motori-difficile-02` | Motori | difficile | Quale casa ha sviluppato il primo motore rotativo Wankel di serie? | NSU | Mazda · Citroën · BMW | Wikipedia it: Motore Wankel |
| `spiaggia-musica-facile-01` | Musica | facile | Quanti tasti ha un pianoforte standard? | 88 | 76 · 96 · 61 | Wikipedia it: Pianoforte |
| `spiaggia-musica-facile-02` | Musica | facile | Quale strumento a fiato è fatto di ottone con tre pistoni? | La tromba | Il flauto traverso · Il clarinetto · Il sassofono | Wikipedia it: Tromba |
| `spiaggia-musica-mediofacile-01` | Musica | medio-facile | Chi ha scritto La donna cannone? | Francesco De Gregori | Fabrizio De André · Lucio Dalla · Francesco Guccini | Wikipedia it: La donna cannone |
| `spiaggia-musica-mediofacile-02` | Musica | medio-facile | Quale gruppo britannico ha inciso Yesterday? | I Beatles | I Rolling Stones · I Queen · Gli Who | Wikipedia it: Yesterday (brano musicale) |
| `spiaggia-musica-media-01` | Musica | media | Chi ha composto La bohème? | Giacomo Puccini | Giuseppe Verdi · Gioachino Rossini · Vincenzo Bellini | Wikipedia it: La bohème |
| `spiaggia-musica-media-02` | Musica | media | Quale album dei Pink Floyd del 1973 contiene Money? | The Dark Side of the Moon | Wish You Were Here · Atom Heart Mother · The Division Bell | Wikipedia it: The Dark Side of the Moon |
| `spiaggia-musica-mediodifficile-01` | Musica | medio-difficile | Quale trombettista jazz era soprannominato Satchmo? | Louis Armstrong | Miles Davis · Dizzy Gillespie · Chet Baker | Wikipedia it: Louis Armstrong |
| `spiaggia-musica-mediodifficile-02` | Musica | medio-difficile | Chi ha composto l'oratorio Il Messia? | Georg Friedrich Händel | Johann Sebastian Bach · Antonio Vivaldi · Joseph Haydn | Wikipedia it: Il Messia |
| `spiaggia-musica-difficile-01` | Musica | difficile | Chi ha composto il balletto L'uccello di fuoco? | Igor Stravinskij | Sergej Prokof'ev · Claude Debussy · Maurice Ravel | Wikipedia it: L'uccello di fuoco |
| `spiaggia-musica-difficile-02` | Musica | difficile | Quale gruppo tedesco pubblicò l'album Autobahn nel 1974? | I Kraftwerk | I Can · I Neu! · I Tangerine Dream | Wikipedia it: Autobahn (album) |
| `spiaggia-natura-facile-01` | Natura e Animali | facile | Quale animale è il più veloce sulla terraferma? | Il ghepardo | Il leone · Il cavallo · L'antilope | Wikipedia it: Ghepardo |
| `spiaggia-natura-facile-02` | Natura e Animali | facile | Qual è l'animale più alto del mondo? | La giraffa | L'elefante · Il cammello · Il cavallo | Wikipedia it: Giraffa |
| `spiaggia-natura-mediofacile-01` | Natura e Animali | medio-facile | Qual è l'uccello più grande che non sa volare? | Lo struzzo | L'emù · Il pinguino imperatore · Il casuario | Wikipedia it: Struzzo |
| `spiaggia-natura-mediofacile-02` | Natura e Animali | medio-facile | Quale insetto produce il filo di seta? | Il baco da seta | La falena notturna · Il bruco peloso · La coccinella | Wikipedia it: Bombyx mori |
| `spiaggia-natura-media-01` | Natura e Animali | media | Qual è il rettile più grande del mondo? | Il coccodrillo marino | Il pitone reticolato · La tartaruga liuto · Il varano di Komodo | Wikipedia it: Coccodrillo marino |
| `spiaggia-natura-media-02` | Natura e Animali | media | Quale felino è il più grande del mondo? | La tigre | Il leone · Il giaguaro · Il leopardo | Wikipedia it: Tigre |
| `spiaggia-natura-mediodifficile-01` | Natura e Animali | medio-difficile | Quale animale ha la gestazione più lunga? | L'elefante | La balenottera azzurra · La giraffa · Il rinoceronte | Wikipedia it: Elefante |
| `spiaggia-natura-mediodifficile-02` | Natura e Animali | medio-difficile | Quale serpente è il più lungo del mondo? | Il pitone reticolato | Il cobra reale · L'anaconda verde · Il pitone birmano | Wikipedia it: Pitone reticolato |
| `spiaggia-natura-difficile-01` | Natura e Animali | difficile | Quale uccello compie la migrazione più lunga? | La sterna artica | La rondine · L'airone cenerino · Il falco pellegrino | Wikipedia it: Sterna artica |
| `spiaggia-natura-difficile-02` | Natura e Animali | difficile | Quale albero può vivere più a lungo? | Il bristlecone | La quercia · Il baobab · Il faggio | Wikipedia it: Pinus longaeva |
| `spiaggia-politica-facile-01` | Politica e Attualità | facile | In quale città ha sede il Parlamento italiano? | Roma | Milano · Torino · Firenze | Wikipedia it: Parlamento italiano |
| `spiaggia-politica-facile-02` | Politica e Attualità | facile | Quanti Paesi fanno parte del G7? | Sette | Cinque · Otto · Dieci | Wikipedia it: G7 |
| `spiaggia-politica-mediofacile-01` | Politica e Attualità | medio-facile | In quale città ha sede principale l'ONU? | New York | Ginevra · Parigi · Vienna | Wikipedia it: Organizzazione delle Nazioni Unite |
| `spiaggia-politica-mediofacile-02` | Politica e Attualità | medio-facile | Quanti deputati ha la Camera italiana dopo la riforma del 2020? | 400 | 630 · 315 · 500 | Wikipedia it: Camera dei deputati |
| `spiaggia-politica-media-01` | Politica e Attualità | media | In quale anno l'euro è entrato in circolazione come moneta contante? | 2002 | 1999 · 2000 · 2004 | Wikipedia it: Euro |
| `spiaggia-politica-media-02` | Politica e Attualità | media | Quale istituzione europea ha sede a Francoforte? | La Banca centrale europea | Il Parlamento europeo · La Commissione europea · La Corte di giustizia | Wikipedia it: Banca centrale europea |
| `spiaggia-politica-mediodifficile-01` | Politica e Attualità | medio-difficile | Quale trattato del 1992 ha istituito l'Unione europea? | Il trattato di Maastricht | Il trattato di Roma · Il trattato di Lisbona · L'Atto unico europeo | Wikipedia it: Trattato di Maastricht |
| `spiaggia-politica-mediodifficile-02` | Politica e Attualità | medio-difficile | Quanti Paesi dell'UE usano l'euro? | 20 | 17 · 22 · 27 | Wikipedia it: Eurozona |
| `spiaggia-politica-difficile-01` | Politica e Attualità | difficile | In quale anno è entrato in vigore il trattato di Lisbona? | 2009 | 2007 · 2005 · 2011 | Wikipedia it: Trattato di Lisbona |
| `spiaggia-politica-difficile-02` | Politica e Attualità | difficile | Quanti seggi ha il Parlamento europeo nella legislatura iniziata nel 2024? | 720 | 705 · 751 · 736 | Wikipedia it: Parlamento europeo |
| `spiaggia-scienza-facile-01` | Scienza e Spazio | facile | Quante ossa ha il corpo di un adulto? | 206 | 186 · 226 · 246 | Wikipedia it: Scheletro umano |
| `spiaggia-scienza-facile-02` | Scienza e Spazio | facile | Quanti pianeti compongono il sistema solare? | Otto | Nove · Sette · Dieci | Wikipedia it: Sistema solare |
| `spiaggia-scienza-mediofacile-01` | Scienza e Spazio | medio-facile | Qual è il simbolo chimico del sodio? | Na | Cl · Br · Ca | Wikipedia it: Sodio |
| `spiaggia-scienza-mediofacile-02` | Scienza e Spazio | medio-facile | Quale organo produce l'insulina? | Il pancreas | Il fegato · La tiroide · I reni | Wikipedia it: Insulina |
| `spiaggia-scienza-media-01` | Scienza e Spazio | media | Qual è l'unità di misura della potenza nel Sistema Internazionale? | Il watt | Il joule · Il pascal · Il newton | Wikipedia it: Watt |
| `spiaggia-scienza-media-02` | Scienza e Spazio | media | Qual è la velocità approssimativa della luce nel vuoto? | 300.000 km al secondo | 30.000 km al secondo · 3.000 km al secondo · 3.000.000 km al secondo | Wikipedia it: Velocità della luce |
| `spiaggia-scienza-mediodifficile-01` | Scienza e Spazio | medio-difficile | Quale pianeta impiega più tempo a ruotare su sé stesso che a completare un anno? | Venere | Mercurio · Marte · Giove | Wikipedia it: Venere (astronomia) |
| `spiaggia-scienza-mediodifficile-02` | Scienza e Spazio | medio-difficile | Chi pubblicò la prima tavola periodica degli elementi nel 1869? | Dmitrij Mendeleev | Antoine Lavoisier · John Dalton · Robert Boyle | Wikipedia it: Tavola periodica degli elementi |
| `spiaggia-scienza-difficile-01` | Scienza e Spazio | difficile | Quale particella è associata al campo che dà massa alle altre? | Il bosone di Higgs | Il fotone · Il gluone · Il neutrino | Wikipedia it: Bosone di Higgs |
| `spiaggia-scienza-difficile-02` | Scienza e Spazio | difficile | Qual è la luna più grande del sistema solare? | Ganimede | Titano · Callisto · La Luna | Wikipedia it: Ganimede (astronomia) |
| `spiaggia-sport-facile-01` | Sport | facile | In quale sport si gioca su 18 buche? | Il golf | Il tennis · Il bowling · Il croquet | Wikipedia it: Golf |
| `spiaggia-sport-facile-02` | Sport | facile | Quanti giocatori per squadra sono in campo nel basket? | Cinque | Sei · Sette · Quattro | Wikipedia it: Pallacanestro |
| `spiaggia-sport-mediofacile-01` | Sport | medio-facile | Ogni quanti anni si disputano i Giochi olimpici estivi? | Quattro | Due · Tre · Cinque | Wikipedia it: Giochi olimpici |
| `spiaggia-sport-mediofacile-02` | Sport | medio-facile | Quale nazione ha vinto più Mondiali di calcio? | Il Brasile | La Germania · L'Italia · L'Argentina | Wikipedia it: Campionato mondiale di calcio |
| `spiaggia-sport-media-01` | Sport | media | In quale sport si parla di «strike» e di «spare»? | Il bowling | Il curling · Il biliardo · Il golf | Wikipedia it: Bowling |
| `spiaggia-sport-media-02` | Sport | media | Quale sport unisce nuoto, ciclismo e corsa? | Il triathlon | Il pentathlon · Il decathlon · Il duathlon | Wikipedia it: Triathlon |
| `spiaggia-sport-mediodifficile-01` | Sport | medio-difficile | In quale anno si tennero le Olimpiadi di Roma? | 1960 | 1956 · 1964 · 1948 | Wikipedia it: Giochi della XVII Olimpiade |
| `spiaggia-sport-mediodifficile-02` | Sport | medio-difficile | Quale club vinse la prima Champions League con questa denominazione, nel 1993? | Il Marsiglia | Il Milan · L'Ajax · Il Barcellona | Wikipedia it: UEFA Champions League 1992-1993 |
| `spiaggia-sport-difficile-01` | Sport | difficile | Chi detiene il record mondiale dei 100 metri piani maschili? | Usain Bolt | Tyson Gay · Asafa Powell · Yohan Blake | Wikipedia it: Record mondiali di atletica leggera |
| `spiaggia-sport-difficile-02` | Sport | difficile | In quale edizione dei Giochi è debuttato il rugby a sette? | Rio 2016 | Londra 2012 · Pechino 2008 · Tokyo 2020 | Wikipedia it: Rugby a sette ai Giochi olimpici |
| `spiaggia-storia-facile-01` | Storia | facile | In che anno è iniziata la Prima guerra mondiale? | 1914 | 1912 · 1916 · 1918 | Wikipedia it: Prima guerra mondiale |
| `spiaggia-storia-facile-02` | Storia | facile | Chi guidò il regime fascista italiano dal 1922? | Benito Mussolini | Vittorio Emanuele III · Pietro Badoglio · Giovanni Giolitti | Wikipedia it: Benito Mussolini |
| `spiaggia-storia-mediofacile-01` | Storia | medio-facile | In che anno Roma divenne capitale d'Italia? | 1871 | 1861 · 1866 · 1876 | Wikipedia it: Roma capitale |
| `spiaggia-storia-mediofacile-02` | Storia | medio-facile | Quale battaglia del 1571 vide la Lega Santa battere la flotta ottomana? | Lepanto | Prevesa · Navarino · Trafalgar | Wikipedia it: Battaglia di Lepanto |
| `spiaggia-storia-media-01` | Storia | media | Sotto quale imperatore romano iniziò la costruzione del Colosseo? | Vespasiano | Traiano · Adriano · Nerone | Wikipedia it: Colosseo |
| `spiaggia-storia-media-02` | Storia | media | In che anno Cristoforo Colombo arrivò per la prima volta in America? | 1492 | 1498 · 1487 · 1503 | Wikipedia it: Cristoforo Colombo |
| `spiaggia-storia-mediodifficile-01` | Storia | medio-difficile | Chi fu il primo imperatore di Roma? | Augusto | Giulio Cesare · Tiberio · Caligola | Wikipedia it: Augusto |
| `spiaggia-storia-mediodifficile-02` | Storia | medio-difficile | Quale trattato del 1920 chiuse la pace con l'Ungheria dopo la Grande guerra? | Il trattato del Trianon | Il trattato di Saint-Germain · Il trattato di Sèvres · Il trattato di Losanna | Wikipedia it: Trattato del Trianon |
| `spiaggia-storia-difficile-01` | Storia | difficile | Quale dinastia regnò in Russia dal 1613 al 1917? | I Romanov | I Rurik · Gli Orlov · I Godunov | Wikipedia it: Romanov |
| `spiaggia-storia-difficile-02` | Storia | difficile | Quale città fu capitale dell'Impero bizantino fino al 1453? | Costantinopoli | Gerusalemme · Trebisonda · Antiochia | Wikipedia it: Costantinopoli |
| `spiaggia-tv-facile-01` | TV e Spettacolo | facile | Quale rete trasmette il TG1? | Rai 1 | Rai 2 · Rete 4 · Italia 1 | Wikipedia it: TG1 |
| `spiaggia-tv-facile-02` | TV e Spettacolo | facile | In quale città si tiene il Festival della canzone italiana? | Sanremo | Roma · Torino · Napoli | Wikipedia it: Festival di Sanremo |
| `spiaggia-tv-mediofacile-01` | TV e Spettacolo | medio-facile | Quale rete trasmette Striscia la notizia? | Canale 5 | Rai 1 · La7 · Italia 1 | Wikipedia it: Striscia la notizia |
| `spiaggia-tv-mediofacile-02` | TV e Spettacolo | medio-facile | Quale programma di Maria De Filippi cerca nuovi talenti canori? | Amici | X Factor · The Voice · Ti lascio una canzone | Wikipedia it: Amici di Maria De Filippi |
| `spiaggia-tv-media-01` | TV e Spettacolo | media | Quale serie racconta le indagini del commissario di Vigata? | Il commissario Montalbano | Che Dio ci aiuti · Il Commissario Rex · Napoli Centrale | Wikipedia it: Il commissario Montalbano |
| `spiaggia-tv-media-02` | TV e Spettacolo | media | Quale conduttore ha guidato il Festival di Sanremo 2024? | Amadeus | Carlo Conti · Paolo Bonolis · Gerry Scotti | Wikipedia it: Festival di Sanremo 2024 |
| `spiaggia-tv-mediodifficile-01` | TV e Spettacolo | medio-difficile | Quale attore interpreta il dottor Gregory House? | Hugh Laurie | Benedict Cumberbatch · Hugh Grant · Kiefer Sutherland | Wikipedia it: Dr. House - Medical Division |
| `spiaggia-tv-mediodifficile-02` | TV e Spettacolo | medio-difficile | In quale anno è iniziata in Italia la prima edizione del Grande Fratello? | 2000 | 1998 · 2002 · 2004 | Wikipedia it: Grande Fratello (programma televisivo) |
| `spiaggia-tv-difficile-01` | TV e Spettacolo | difficile | In quale anno è andata in onda la prima edizione italiana di X Factor? | 2008 | 2006 · 2010 · 2012 | Wikipedia it: X Factor (Italia) |
| `spiaggia-tv-difficile-02` | TV e Spettacolo | difficile | Quale attrice interpreta Daenerys Targaryen ne Il Trono di Spade? | Emilia Clarke | Sophie Turner · Lena Headey · Maisie Williams | Wikipedia it: Il Trono di Spade |

## Timeline: fonti sostituite (23 novembre 2026)

I 222 eventi avevano tutti un collegamento di ricerca di Wikipedia, non una voce.
Qui sotto i 44 eventi passati alla pagina precisa (tutti quelli di difficoltà 5 più un
campione di 30: due per categoria e i primi due del file). Lo script li ha verificati su
it.wikipedia: la voce esiste, il suo testo contiene l'anno dell'evento e almeno una parola
dell'etichetta. Le pagine di disambiguazione sono rifiutate.

All'epoca restavano 178 eventi con il collegamento di ricerca, non fonti precise: sono stati
chiusi nell'intervento successivo (sezione «fonti precise su tutti gli eventi»).

| Anno | Evento | Voce |
| --- | --- | --- |
| 1748 | Pace di Aquisgrana | Trattato di Aquisgrana (1748) |
| 1854 | La spedizione di Perry apre il Giappone | Convenzione di Kanagawa |
| 1938 | Scoperta della fissione nucleare | Fissione nucleare |
| 1898 | Primo campionato italiano di calcio | Campionato Italiano di Football 1898 |
| 1925 | Esce La corazzata Potëmkin | La corazzata Potëmkin |
| 1956 | Prima edizione dell'Eurovision Song Contest | Eurovision Song Contest 1956 |
| 1874 | Prima esecuzione del Requiem di Verdi | Requiem (Verdi) |
| 1667 | Bernini completa il colonnato di San Pietro | Basilica di San Pietro in Vaticano |
| 1998 | Firmato lo Statuto di Roma | Statuto di Roma |
| 1947 | Enzo Ferrari fonda la Ferrari | Ferrari |
| 1877 | Nasce la Barilla a Parma | Barilla |
| 1525 | Bembo pubblica le Prose della volgar lingua | Prose nelle quali si ragiona della volgar lingua |
| 1978 | Debutta Capitan Harlock | Capitan Harlock |
| 1993 | Esce Doom | Doom |
| 476 | Caduta dell'Impero romano d'Occidente | Caduta dell'Impero romano d'Occidente |
| 800 | Incoronazione di Carlo Magno | Incoronazione di Carlo Magno |
| 1815 | Congresso di Vienna | Congresso di Vienna |
| 1953 | Hillary e Tenzing raggiungono l'Everest | Everest |
| 1957 | Lancio dello Sputnik | Sputnik 1 |
| 1992 | Il Dream Team vince l'oro olimpico | Nazionale maschile di pallacanestro degli Stati Uniti d'America |
| 1999 | Esce Matrix | Matrix |
| 2003 | Nasce Sky Italia | Sky Italia |
| 1967 | Esce Sgt. Pepper's Lonely Hearts Club Band | Sgt. Pepper's Lonely Hearts Club Band |
| 1907 | Nasce il cubismo con Les Demoiselles d'Avignon | Les demoiselles d'Avignon |
| 1992 | Trattato di Maastricht | Trattato di Maastricht |
| 1997 | Toyota lancia la Prius | Toyota Prius |
| 1986 | Nasce il movimento Slow Food a Bra | Slow Food |
| 1913 | Pubblicato La strada di Swann di Proust | Dalla parte di Swann |
| 1997 | Inizia il manga One Piece | One Piece |
| 1991 | Tim Berners-Lee presenta il World Wide Web | World Wide Web |
| 1870 | Presa di Roma | Presa di Roma |
| 1922 | Scoperta della tomba di Tutankhamon | Tutankhamon |
| 1895 | Röntgen scopre i raggi X | Raggi X |
| 1976 | Nadia Comăneci ottiene il primo 10 alle Olimpiadi | Nadia Comăneci |
| 1972 | Esce Il padrino | Il padrino (film) |
| 2000 | Debutta Chi vuol essere miliardario? in Italia | Chi vuol essere milionario? |
| 1982 | Esce Thriller di Michael Jackson | Thriller (album Michael Jackson) |
| 1793 | Il Louvre diventa museo pubblico | Museo del Louvre |
| 1957 | Trattato di Roma, nasce la CEE | Trattato che istituisce la Comunità economica europea |
| 1966 | Debutta la Lamborghini Miura | Lamborghini Miura |
| 1940 | Apre il primo McDonald's | McDonald's |
| 1600 | Prima di Amleto di Shakespeare | Amleto |
| 1988 | Esce il film Akira | Akira (film) |
| 1985 | Esce Super Mario Bros. per NES | Super Mario Bros. |

Da guardare a occhio, benché verificate:
- **Bernini completa il colonnato di San Pietro (1667)** → la voce è *Basilica di San Pietro in Vaticano*: contiene il 1667, ma non è la pagina del solo colonnato.
- **Pace di Aquisgrana (1748)** → la voce si chiama *Trattato di Aquisgrana*: se in TV il pubblico si aspetta «pace», l'etichetta può restare com'è.
- **Primo campionato italiano di calcio (1898)** → *Campionato Italiano di Football 1898*, il nome dell'epoca.
- **Esce Thriller (1982)** → *Thriller (album Michael Jackson)*: le voci «Thriller (album)» e «Thriller (Michael Jackson)» sono disambiguazioni e sono state scartate.
- **Trattato di Roma, nasce la CEE (1957)** → la voce è *Trattato che istituisce la Comunità economica europea*.
- **Il Dream Team vince l'oro olimpico (1992)** → la voce è la nazionale statunitense, non una pagina del «Dream Team».

## Timeline: fonti precise su tutti gli eventi (23 novembre 2026)

Dopo i 44 del primo giro sono passati alla pagina voce anche gli altri eventi che avevano ancora
un collegamento di ricerca. Per ognuno lo script verifica che la voce esista, che il suo testo
contenga l'anno dell'evento, che condivida una parola con l'etichetta e che non sia una
disambiguazione; la mappa dei titoli sta in `scripts/generate-questions/fix_timeline_sources.mjs`.

Risultato: **222 eventi su 222** con la voce precisa; **0** eventi con il collegamento di ricerca.

### L'unico caso chiuso a mano

| Anno | Evento | Cosa è stato fatto |
| --- | --- | --- |
| 2001 | Apple lancia iTunes | L'etichetta era «Apple lancia l'iTunes Store», ma lo Store è del 2003: corretta in «Apple lancia iTunes». La voce collegata è *iTunes*, che è il soggetto giusto; non riporta però il 2001 nel testo, quindi è l'unica fonte Timeline che non passa il controllo automatico sull'anno ed è stata scelta a mano. La mappa in `fix_timeline_sources.mjs` lo dice accanto alla voce. |

### Voci generiche: persona o ente invece della pagina dell'evento

Verificate come le altre (anno presente nel testo), ma la pagina è quella del protagonista:
vanno bene come fonte del fatto, non come racconto dell'evento.

| Anno | Evento | Voce |
| --- | --- | --- |
| 1498 | Vasco da Gama arriva in India | Vasco da Gama |
| 1932 | Amelia Earhart attraversa l'Atlantico in solitaria | Amelia Earhart |
| 1936 | Jesse Owens vince quattro ori a Berlino | Jesse Owens |
| 2008 | Usain Bolt stabilisce il record dei 100 metri | Usain Bolt |
| 1895 | Prima proiezione cinematografica dei fratelli Lumière | Auguste e Louis Lumière |
| 1954 | Inizio delle trasmissioni Rai | Rai |
| 1911 | Amundsen raggiunge il Polo Sud | Roald Amundsen |
| 1961 | Gagarin, primo uomo nello spazio | Jurij Gagarin |
| 2016 | Bob Dylan riceve il Nobel per la letteratura | Bob Dylan |
| 1976 | L'incidente di Niki Lauda al Nürburgring | Niki Lauda |
| 1994 | Muore Ayrton Senna a Imola | Ayrton Senna |
| 1812 | I fratelli Grimm pubblicano le loro fiabe | Fratelli Grimm |

L'audit non controlla le fonti: la verifica automatica dice che la pagina parla di quell'anno,
non che l'anno scritto nell'evento sia giusto. La lettura umana resta quella della sezione 2.2.

<!-- CELEBRITA-INDIZI:INIZIO -->

## Banca indizi Celebrità (revisione a campione)

Generata da `scripts/banche/genera-indizi.mjs`: quattro indizi per persona,
due ampi e due specifici, dalla voce di it.wikipedia citata su ogni riga.
Qui si legge un campione prima della serata.

| Persona | Ambito | Indizi (ampio → specifico) |
| --- | --- | --- |
| **Andy Warhol** | 1 · arte | 1. Un artista, pittore, regista. _(ampio)_<br>2. Pittsburgh, Novecento: un artista, pittore, regista. _(ampio)_<br>3. Nasce a Pittsburgh il 6 agosto 1928. _(specifico)_<br>4. Nato Andrew Warhola Jr. _(specifico)_ |
| **Claude Monet** | 1 · arte | 1. Un pittore francese, considerato uno dei fondatori dell'Impressionismo francese. _(ampio)_<br>2. Parigi, Ottocento: un pittore francese, considerato uno dei fondatori dell'Impressionismo francese. _(ampio)_<br>3. Nasce a Parigi il 14 novembre 1840. _(specifico)_<br>4. I suoi lavori si distinguono per la rappresentazione della sua immediata percezione dei soggetti, in modo particolare per quanto riguarda la paesaggistica e la pittura en plein… _(specifico)_ |
| **Frida Kahlo** | 1 · arte | 1. Una pittrice messicana. _(ampio)_<br>2. Città del Messico, Novecento: una pittrice messicana. _(ampio)_<br>3. Nasce a Città del Messico il 6 luglio 1907. _(specifico)_<br>4. una pittrice messicana del 1907: la voce di Wikipedia ne racconta la storia. _(specifico)_ |
| **Leonardo da Vinci** | 1 · arte | 1. Uno scienziato, inventore e artista italiano. _(ampio)_<br>2. Anchiano, Quattrocento: uno scienziato, inventore e artista italiano. _(ampio)_<br>3. Nasce a Anchiano il 15 aprile 1452. _(specifico)_<br>4. Uomo d'ingegno e talento universale del Rinascimento, considerato uno dei più grandi geni dell'umanità, incarnò in pieno lo spirito della sua epoca, portandolo alle maggiori for… _(specifico)_ |
| **Michelangelo Buonarroti** | 1 · arte | 1. Uno scultore, pittore, architetto e poeta italiano. _(ampio)_<br>2. Caprese, Quattrocento: uno scultore, pittore, architetto e poeta italiano. _(ampio)_<br>3. Nasce a Caprese il 6 marzo 1475. _(specifico)_<br>4. Soprannominato "Divin Artista" e definito "Artista universale", fu protagonista del Rinascimento italiano e già in vita fu riconosciuto dai suoi contemporanei come uno dei più g… _(specifico)_ |
| **Pablo Picasso** | 1 · arte | 1. Un pittore, scultore e litografo spagnolo. _(ampio)_<br>2. Malaga, Ottocento: un pittore, scultore e litografo spagnolo. _(ampio)_<br>3. Nasce a Malaga il 25 ottobre 1881. _(specifico)_<br>4. Con oltre 13.000 dipinti e disegni, detiene il primato mondiale della produttività artistica. _(specifico)_ |
| **Salvador Dalí** | 1 · arte | 1. Un pittore, scultore, saggista. _(ampio)_<br>2. Figueres, Novecento: un pittore, scultore, saggista. _(ampio)_<br>3. Nasce a Figueres il 11 maggio 1904. _(specifico)_<br>4. Abile pittore e virtuosissimo disegnatore, è celebre principalmente per le immagini suggestive e bizzarre delle sue opere surrealiste e dadaiste. _(specifico)_ |
| **Vincent van Gogh** | 1 · arte | 1. Un pittore olandese. _(ampio)_<br>2. Zundert, Ottocento: un pittore olandese. _(ampio)_<br>3. Nasce a Zundert il 30 marzo 1853. _(specifico)_<br>4. Dopo diversi anni di sofferenze, patendo anche di frequenti disturbi mentali, nel 1890 si suicidò ad Auvers-sur-Oise, all'età di 37 anni. _(specifico)_ |
| **Alessandro Manzoni** | 1 · letteratura | 1. Uno scrittore, poeta, drammaturgo e politico italiano. _(ampio)_<br>2. Milano, Settecento: uno scrittore, poeta, drammaturgo e politico italiano. _(ampio)_<br>3. Nasce a Milano il 7 marzo 1785. _(specifico)_<br>4. Considerato uno dei maggiori romanzieri italiani di tutti i tempi per il celeberrimo romanzo I promessi sposi, caposaldo della letteratura italiana, ebbe il merito di aver getta… _(specifico)_ |
| **Dante Alighieri** | 1 · letteratura | 1. Un poeta, scrittore e politico italiano. _(ampio)_<br>2. Firenze, Trecento: un poeta, scrittore e politico italiano. _(ampio)_<br>3. Nasce a Firenze nel 1265. _(specifico)_<br>4. La sua fama è dovuta alla paternità della Comedìa, divenuta celebre come Divina Commedia e universalmente considerata la più grande opera scritta in lingua italiana e uno dei ma… _(specifico)_ |
| **Ernest Hemingway** | 1 · letteratura | 1. Uno scrittore e giornalista statunitense. _(ampio)_<br>2. Oak Park, Ottocento: uno scrittore e giornalista statunitense. _(ampio)_<br>3. Nasce a Oak Park il 21 luglio 1899. _(specifico)_<br>4. Ricevette il Premio Pulitzer nel 1953 per Il vecchio e il mare e vinse il premio Nobel per la letteratura nel 1954. _(specifico)_ |
| **Jules Verne** | 1 · letteratura | 1. Uno scrittore francese. _(ampio)_<br>2. Nantes, Ottocento: uno scrittore francese. _(ampio)_<br>3. Nasce a Nantes il 8 febbraio 1828. _(specifico)_<br>4. Giunse al successo nel 1863, quando si dedicò proprio al racconto d'avventura. _(specifico)_ |
| **William Shakespeare** | 1 · letteratura | 1. Un drammaturgo e poeta inglese. _(ampio)_<br>2. Stratford-upon-Avon, Cinquecento: un drammaturgo e poeta inglese. _(ampio)_<br>3. Nasce a Stratford-upon-Avon il 23 aprile 1564. _(specifico)_<br>4. Delle sue opere sono stati ritrovati, incluse alcune collaborazioni, 38 testi teatrali, 154 sonetti, tre poemi e una serie di altre opere in versi. _(specifico)_ |
| **Albert Einstein** | 1 · scienza | 1. Un fisico tedesco naturalizzato svizzero e statunitense. _(ampio)_<br>2. Ulma, Ottocento: un fisico tedesco naturalizzato svizzero e statunitense. _(ampio)_<br>3. Nasce a Ulma il 14 marzo 1879. _(specifico)_<br>4. Considerato il più importante fisico del XX secolo e in generale uno dei più grandi ed influenti scienziati della storia, è conosciuto al grande pubblico per la formula dell'equ… _(specifico)_ |
| **Charles Darwin** | 1 · scienza | 1. Un biologo, naturalista. _(ampio)_<br>2. Shrewsbury, Ottocento: un biologo, naturalista. _(ampio)_<br>3. Nasce a Shrewsbury il 12 febbraio 1809. _(specifico)_<br>4. Pubblicò la sua teoria sull'evoluzione delle specie nel libro L'origine delle specie , che è il suo lavoro più noto. _(specifico)_ |
| **Galileo Galilei** | 1 · scienza | 1. Un fisico, astronomo, filosofo. _(ampio)_<br>2. Pisa, Cinquecento: un fisico, astronomo, filosofo. _(ampio)_<br>3. Nasce a Pisa il 15 febbraio 1564. _(specifico)_<br>4. Inizialmente appoggiato dal papa e dai gesuiti, venne poi sospettato di eresia, accusato di voler sovvertire la filosofia naturale aristotelica e le Sacre Scritture, processato… _(specifico)_ |
| **Isaac Newton** | 1 · scienza | 1. Un matematico, fisico, astronomo. _(ampio)_<br>2. Woolsthorpe-by-Colsterworth, Seicento: un matematico, fisico, astronomo. _(ampio)_<br>3. Nasce a Woolsthorpe-by-Colsterworth il 25 dicembre 1642. _(specifico)_<br>4. Considerato uno dei più grandi scienziati di tutti i tempi, ha anche ricoperto i ruoli di presidente della Royal Society , direttore della Zecca inglese e membro del Parlamento . _(specifico)_ |
| **Marie Curie** | 1 · scienza | 1. Una fisica, chimica e matematica polacca naturalizzata francese. _(ampio)_<br>2. Varsavia, Ottocento: una fisica, chimica e matematica polacca naturalizzata francese. _(ampio)_<br>3. Nasce a Varsavia il 7 novembre 1867. _(specifico)_<br>4. Nel 1903 fu la prima donna insignita del premio Nobel. _(specifico)_ |
| **Nikola Tesla** | 1 · scienza | 1. Un inventore, fisico e ingegnere elettrotecnico serbo. _(ampio)_<br>2. Smiljan, Ottocento: un inventore, fisico e ingegnere elettrotecnico serbo. _(ampio)_<br>3. Nasce a Smiljan il 10 luglio 1856. _(specifico)_<br>4. A riconoscimento dei suoi contributi fu intitolata a suo nome, durante la Conférence générale des poids et mesures del 1960, l'unità di misura dell'induzione magnetica nel Siste… _(specifico)_ |
| **Stephen Hawking** | 1 · scienza | 1. Un cosmologo, fisico, astrofisico. _(ampio)_<br>2. Oxford, Novecento: un cosmologo, fisico, astrofisico. _(ampio)_<br>3. Nasce a Oxford il 8 gennaio 1942. _(specifico)_<br>4. Tali teorie, sempre spiegate con chiarezza e semplicità, hanno raggiunto il grande pubblico attraverso numerosi testi di divulgazione scientifica. _(specifico)_ |
| **Thomas Edison** | 1 · scienza | 1. Un inventore e imprenditore statunitense. _(ampio)_<br>2. Milan, Ottocento: un inventore e imprenditore statunitense. _(ampio)_<br>3. Nasce a Milan il 11 febbraio 1847. _(specifico)_<br>4. Era considerato uno dei più prolifici progettisti del suo tempo, avendo ottenuto il record di 1 093 brevetti registrati a suo nome, in tutto il mondo, inclusi Stati Uniti, Itali… _(specifico)_ |
| **Abraham Lincoln** | 1 · storia | 1. Un politico, avvocato e militare statunitense. _(ampio)_<br>2. Hodgenville, Ottocento: un politico, avvocato e militare statunitense. _(ampio)_<br>3. Nasce a Hodgenville il 12 febbraio 1809. _(specifico)_<br>4. Fu il sedicesimo presidente degli Stati Uniti d'America, dal 4 marzo 1861 fino al suo assassinio. _(specifico)_ |
| **Cleopatra** | 1 · storia | 1. Una regina egizia appartenente al periodo tolemaico. _(ampio)_<br>2. Primo secolo a.C.: una regina egizia appartenente al periodo tolemaico. _(ampio)_<br>3. Nasce nel 69 a.C. _(specifico)_<br>4. Donna forte e indipendente, portò avanti una politica espansiva e accentratrice, nonostante il continuo avanzare dell'egemonia della Repubblica romana nel mar Mediterraneo. _(specifico)_ |
| **Cristoforo Colombo** | 1 · storia | 1. Un navigatore ed esploratore italiano della Repubblica di Genova. _(ampio)_<br>2. Genova, Quattrocento: un navigatore ed esploratore italiano della Repubblica di Genova. _(ampio)_<br>3. Nasce a Genova nel 1451. _(specifico)_<br>4. Fu poi il navigatore Amerigo Vespucci che, nei primi anni del XVI secolo, scoprì che si trattava invece di un nuovo continente, inizialmente chiamato "Nuovo Mondo", quindi, in s… _(specifico)_ |
| **Giulio Cesare** | 1 · storia | 1. Un politico, militare, scrittore e oratore romano. _(ampio)_<br>2. Roma, Primo secolo a.C.: un politico, militare, scrittore e oratore romano. _(ampio)_<br>3. Nasce a Roma il 13 luglio 100 a.C. _(specifico)_<br>4. Ebbe un ruolo fondamentale nella transizione del sistema di governo dalla forma repubblicana a quella imperiale. _(specifico)_ |
| **Giuseppe Garibaldi** | 1 · storia | 1. Un patriota, militare, politico e scrittore italiano. _(ampio)_<br>2. Nizza, Ottocento: un patriota, militare, politico e scrittore italiano. _(ampio)_<br>3. Nasce a Nizza il 4 luglio 1807. _(specifico)_<br>4. Considerato dalla storiografia e nella cultura di massa del XX secolo il principale eroe nazionale italiano, iniziò i suoi spostamenti per il mondo come ufficiale di navi mercan… _(specifico)_ |
| **John F. Kennedy** | 1 · storia | 1. Un politico statunitense. _(ampio)_<br>2. Brookline, Novecento: un politico statunitense. _(ampio)_<br>3. Nasce a Brookline il 29 maggio 1917. _(specifico)_<br>4. Nato nella influente famiglia, cattolica di origine irlandese, si laureò all'università Harvard nel 1937. _(specifico)_ |
| **Mahatma Gandhi** | 1 · storia | 1. Un attivista, politico. _(ampio)_<br>2. Porbandar, Ottocento: un attivista, politico. _(ampio)_<br>3. Nasce a Porbandar il 2 ottobre 1869. _(specifico)_<br>4. Uno dei pionieri e dei teorici del satyagraha, un termine coniato da lui stesso, cioè la resistenza all'oppressione tramite la disobbedienza civile di massa che ha portato l'Ind… _(specifico)_ |
| **Martin Luther King** | 1 · storia | 1. Un attivista, politico e pastore protestante statunitense. _(ampio)_<br>2. Atlanta, Novecento: un attivista, politico e pastore protestante statunitense. _(ampio)_<br>3. Nasce a Atlanta il 15 gennaio 1929. _(specifico)_<br>4. Considerato come una delle figure più popolari e carismatiche della lotta contro la segregazione razziale, ricevette il premio Nobel per la pace nel 1964. _(specifico)_ |
| **Napoleone Bonaparte** | 1 · storia | 1. Un politico e generale francese. _(ampio)_<br>2. Ajaccio, Settecento: un politico e generale francese. _(ampio)_<br>3. Nasce a Ajaccio il 15 agosto 1769. _(specifico)_<br>4. Ottenuti prestigio e stima grazie alle vittorie nel corso della prima campagna d'Italia, dopo il colpo di Stato del 18 brumaio assunse il potere in Francia: fu Primo Console dal… _(specifico)_ |
| **Nelson Mandela** | 1 · storia | 1. Un politico e attivista sudafricano. _(ampio)_<br>2. Mvezo, Novecento: un politico e attivista sudafricano. _(ampio)_<br>3. Nasce a Mvezo il 18 luglio 1918. _(specifico)_<br>4. Antagonista, con il predecessore Frederik de Klerk, dell'apartheid e insieme a questi insignito del premio Nobel per la pace nel 1993, fu il primo presidente sudafricano non bia… _(specifico)_ |
| **Winston Churchill** | 1 · storia | 1. Un politico, storico, giornalista. _(ampio)_<br>2. Woodstock, Ottocento: un politico, storico, giornalista. _(ampio)_<br>3. Nasce a Woodstock il 30 novembre 1874. _(specifico)_<br>4. È stato Primo ministro del Regno Unito dal 1940 al 1945 e nuovamente dal 1951 al 1955. _(specifico)_ |
| **Achille Lauro** | 2 · musica | 1. Un cantautore italiano. _(ampio)_<br>2. Verona, Novecento: un cantautore italiano. _(ampio)_<br>3. Nasce a Verona il 11 luglio 1990. _(specifico)_<br>4. Noto per i suoi lavori in rock, hip hop, pop e cantautorato, nel 2019 è salito alla ribalta partecipando al 69º Festival di Sanremo con il brano Rolls Royce. _(specifico)_ |
| **Adele** | 2 · musica | 1. Una cantautrice britannica. _(ampio)_<br>2. Londra, Novecento: una cantautrice britannica. _(ampio)_<br>3. Nasce a Londra il 5 maggio 1988. _(specifico)_<br>4. Ritenuta una delle esponenti della nuova generazione del soul bianco insieme a Duffy e alla scomparsa Amy Winehouse, ha esordito nel 2008 con l'album 19, il quale ha ricevuto un… _(specifico)_ |
| **Adriano Celentano** | 2 · musica | 1. Un cantante, showman, attore. _(ampio)_<br>2. Milano, Novecento: un cantante, showman, attore. _(ampio)_<br>3. Nasce a Milano il 6 gennaio 1938. _(specifico)_<br>4. Attivo nello spettacolo dal 1956, ha spesso collaborato alla composizione dei propri brani, lasciando talvolta che altri ne firmassero la proprietà intellettuale. _(specifico)_ |
| **Andrea Bocelli** | 2 · musica | 1. Un cantante e tenore italiano. _(ampio)_<br>2. La Sterza, Novecento: un cantante e tenore italiano. _(ampio)_<br>3. Nasce a La Sterza il 22 settembre 1958. _(specifico)_<br>4. Voce tenorile, la sua notorietà incominciò nel 1993, quando cantò il duetto Miserere con Zucchero, per poi consolidarsi con la canzone Il mare calmo della sera, con cui vinse il… _(specifico)_ |
| **Angelina Mango** | 2 · musica | 1. Una cantautrice italiana. _(ampio)_<br>2. Maratea, Duemila: una cantautrice italiana. _(ampio)_<br>3. Nasce a Maratea il 10 aprile 2001. _(specifico)_<br>4. Ha raggiunto il successo nel 2023 grazie alla partecipazione alla ventiduesima edizione del talent show Amici di Maria De Filippi, in cui ha vinto la categoria canto, il premio… _(specifico)_ |
| **Annalisa** | 2 · musica | 1. Una cantautrice italiana, classe 1985. _(ampio)_<br>2. Savona, Novecento: una cantautrice italiana. _(ampio)_<br>3. Nasce a Savona il 5 agosto 1985. _(specifico)_<br>4. Dopo alcune esperienze nell'ambito musicale con due gruppi, è divenuta nota come cantante solista tra il 2010 e il 2011 partecipando alla decima edizione del talent show Amici d… _(specifico)_ |
| **Ariana Grande** | 2 · musica | 1. Una cantautrice, attrice, produttrice discografica e imprenditrice statunitense. _(ampio)_<br>2. Boca Raton, Novecento: una cantautrice, attrice, produttrice discografica e imprenditrice statunitense. _(ampio)_<br>3. Nasce a Boca Raton il 26 giugno 1993. _(specifico)_<br>4. Nel 2025 Billboard l'ha piazzata all’ottavo posto della classifica delle maggiori artiste femminili del XXI secolo. _(specifico)_ |
| **Beyoncé** | 2 · musica | 1. Una cantautrice, attrice, produttrice discografica. _(ampio)_<br>2. Novecento: una cantautrice, attrice, produttrice discografica. _(ampio)_<br>3. Nasce nel 1981. _(specifico)_<br>4. Considerata una delle migliori performer della sua generazione nonché una delle figure di maggiore rilevanza musicale del XXI secolo, vendendo 200 milioni di copie nel mondo com… _(specifico)_ |
| **Biagio Antonacci** | 2 · musica | 1. Un cantautore italiano, classe 1963. _(ampio)_<br>2. Milano, Novecento: un cantautore italiano. _(ampio)_<br>3. Nasce a Milano il 9 novembre 1963. _(specifico)_<br>4. un cantautore italiano del 1963: la voce di Wikipedia ne racconta la storia. _(specifico)_ |
| **Billie Eilish** | 2 · musica | 1. Una cantautrice statunitense. _(ampio)_<br>2. Duemila: una cantautrice statunitense. _(ampio)_<br>3. Nasce nel 2001. _(specifico)_<br>4. È salita alla ribalta a soli sedici anni nel 2017 con l'EP di debutto Don't Smile at Me, pubblicato nell'agosto 2017, portandola ad essere nominata come Up next dalla piattaform… _(specifico)_ |
| **Blanco** | 2 · musica | 1. Un cantautore e rapper italiano. _(ampio)_<br>2. Brescia, Duemila: un cantautore e rapper italiano. _(ampio)_<br>3. Nasce a Brescia il 10 febbraio 2003. _(specifico)_<br>4. Salito alla ribalta nel 2021 con i successi numero uno La canzone nostra e Mi fai impazzire, ha pubblicato il suo disco d'esordio Blu celeste, trainato dai singoli Notti in bian… _(specifico)_ |
| **Bob Dylan** | 2 · musica | 1. Un cantautore statunitense. _(ampio)_<br>2. Duluth, Novecento: un cantautore statunitense. _(ampio)_<br>3. Nasce a Duluth il 24 maggio 1941. _(specifico)_<br>4. Ha legalmente cambiato il suo nome in Robert nell'agosto 1962. _(specifico)_ |
| **Bruce Springsteen** | 2 · musica | 1. Un cantautore e chitarrista statunitense. _(ampio)_<br>2. Long Branch, Novecento: un cantautore e chitarrista statunitense. _(ampio)_<br>3. Nasce a Long Branch il 23 settembre 1949. _(specifico)_<br>4. Fra i suoi album di maggior successo si annoverano Born to Run, Darkness on the Edge of Town, The River e Born in the U.S.A., lavori emblematici della sua poetica volta a raccon… _(specifico)_ |
| **Bruno Mars** | 2 · musica | 1. Un cantautore e produttore discografico statunitense di origini portoricane e filippine. _(ampio)_<br>2. Honolulu, Novecento: un cantautore e produttore discografico statunitense di origini portoricane e filippine. _(ampio)_<br>3. Nasce a Honolulu il 8 ottobre 1985. _(specifico)_<br>4. Considerato uno degli artisti di maggior successo del XXI secolo, dopo aver firmato un contratto con la Atlantic Records nel 2009, raggiunge la notorietà l'anno seguente, presta… _(specifico)_ |
| **Claudio Baglioni** | 2 · musica | 1. Un cantautore, musicista e compositore italiano. _(ampio)_<br>2. Roma, Novecento: un cantautore, musicista e compositore italiano. _(ampio)_<br>3. Nasce a Roma il 16 maggio 1951. _(specifico)_<br>4. Si stima abbia venduto più di 60 milioni di copie, tra cui spicca l'album La vita è adesso del 1985, noto per il suo record di permanenza in prima posizione per ventisette setti… _(specifico)_ |
| **David Bowie** | 2 · musica | 1. Un cantautore, polistrumentista e attore britannico. _(ampio)_<br>2. Novecento: un cantautore, polistrumentista e attore britannico. _(ampio)_<br>3. Nasce nel 1947. _(specifico)_<br>4. Dopo gli esordi in vari gruppi come cantante e sassofonista, raggiunse il successo come solista nei primi anni settanta, attraversando cinque decenni di musica rock e acquisendo… _(specifico)_ |
| **Dua Lipa** | 2 · musica | 1. Una cantante e compositrice britannica di etnia kosovaro-albanese. _(ampio)_<br>2. Londra, Novecento: una cantante e compositrice britannica di etnia kosovaro-albanese. _(ampio)_<br>3. Nasce a Londra il 22 agosto 1995. _(specifico)_<br>4. Esordì sul mercato nel 2015 per Warner Records con il singolo Be the One, successivamente inserito nel suo primo album da cui furono tratti altri due singoli di successo, New Ru… _(specifico)_ |
| **Ed Sheeran** | 2 · musica | 1. Un cantautore britannico. _(ampio)_<br>2. Halifax, Novecento: un cantautore britannico. _(ampio)_<br>3. Nasce a Halifax il 17 febbraio 1991. _(specifico)_<br>4. Ha ottenuto grande successo e popolarità in America del Nord, Oceania ed Europa, soprattutto nel Regno Unito, suo paese natale, dove ha infranto svariati record di vendite. _(specifico)_ |
| **Elisa** | 2 · musica | 1. Una cantautrice e produttrice discografica italiana. _(ampio)_<br>2. Trieste, Novecento: una cantautrice e produttrice discografica italiana. _(ampio)_<br>3. Nasce a Trieste il 19 dicembre 1977. _(specifico)_<br>4. Il successo in ambito discografico arrivò a diciannove anni con l'album in studio d'esordio Pipes & Flowers , sebbene la notorietà al grande pubblico sia giunta quattro anni più… _(specifico)_ |
| **Elodie** | 2 · musica | 1. Una cantautrice e attrice italiana. _(ampio)_<br>2. Roma, Novecento: una cantautrice e attrice italiana. _(ampio)_<br>3. Nasce a Roma il 3 maggio 1990. _(specifico)_<br>4. Dopo aver esordito nel 2016 alla quindicesima edizione del talent show Amici di Maria De Filippi, in cui si è classificata seconda ed ha ottenuto il premio della critica e il pr… _(specifico)_ |
| **Elton John** | 2 · musica | 1. Un cantante, compositore e pianista britannico. _(ampio)_<br>2. Pinner, Novecento: un cantante, compositore e pianista britannico. _(ampio)_<br>3. Nasce a Pinner il 25 marzo 1947. _(specifico)_<br>4. Inoltre, insieme all'autore Bernie Taupin, forma una delle coppie di compositori più famose e prolifiche della musica contemporanea, attiva pressoché ininterrottamente dal 1967. _(specifico)_ |
| **Emma Marrone** | 2 · musica | 1. Una cantautrice e attrice italiana, classe 1984. _(ampio)_<br>2. Firenze, Novecento: una cantautrice e attrice italiana. _(ampio)_<br>3. Nasce a Firenze il 25 maggio 1984. _(specifico)_<br>4. Dopo alcune esperienze nell'ambito musicale con diversi gruppi, tra il 2009 e il 2010 è salita alla ribalta come cantante solista in seguito alla vittoria della nona edizione de… _(specifico)_ |
| **Eros Ramazzotti** | 2 · musica | 1. Un cantautore, musicista e produttore discografico italiano. _(ampio)_<br>2. Roma, Novecento: un cantautore, musicista e produttore discografico italiano. _(ampio)_<br>3. Nasce a Roma il 28 ottobre 1963. _(specifico)_<br>4. Annoverato tra i cantautori italiani di maggior successo nel panorama internazionale, nonché tra i più noti esponenti della musica leggera italiana, ha ottenuto popolarità press… _(specifico)_ |
| **Fabrizio De André** | 2 · musica | 1. Un cantautore italiano, classe 1940. _(ampio)_<br>2. Genova, Novecento: un cantautore italiano. _(ampio)_<br>3. Nasce a Genova il 18 febbraio 1940. _(specifico)_<br>4. È l'artista con il maggior numero di riconoscimenti da parte del Club Tenco, con sei Targhe e un Premio Tenco. _(specifico)_ |
| **Fiorella Mannoia** | 2 · musica | 1. Una cantautrice e attrice italiana, classe 1954. _(ampio)_<br>2. Roma, Novecento: una cantautrice e attrice italiana, classe 1954. _(ampio)_<br>3. Nasce a Roma il 4 aprile 1954. _(specifico)_<br>4. Ha iniziato la sua carriera nel 1968, distinguendosi nel panorama musicale italiano per il suo timbro vocale particolare e per le interpretazioni di pezzi di altri artisti. _(specifico)_ |
| **Freddie Mercury** | 2 · musica | 1. Un cantautore e compositore britannico di origini parsi. _(ampio)_<br>2. Zanzibar, Novecento: un cantautore e compositore britannico di origini parsi. _(ampio)_<br>3. Nasce a Zanzibar il 5 settembre 1946. _(specifico)_<br>4. Come membro dei Queen venne inserito nella Rock and Roll Hall of Fame nel 2001, e come singolo artista entrò a far parte della Songwriters Hall of Fame nel 2003. _(specifico)_ |
| **Ghali** | 2 · musica | 1. Un rapper e cantautore italiano di origini tunisine. _(ampio)_<br>2. Milano, Novecento: un rapper e cantautore italiano di origini tunisine. _(ampio)_<br>3. Nasce a Milano il 21 maggio 1993. _(specifico)_<br>4. un rapper e cantautore italiano di origini tunisine del 1993: la voce di Wikipedia ne racconta la storia. _(specifico)_ |
| **Gianna Nannini** | 2 · musica | 1. Una cantautrice italiana, classe 1954. _(ampio)_<br>2. Siena, Novecento: una cantautrice italiana. _(ampio)_<br>3. Nasce a Siena il 14 giugno 1954. _(specifico)_<br>4. una cantautrice italiana del 1954: la voce di Wikipedia ne racconta la storia. _(specifico)_ |
| **Giorgia** | 2 · musica | 1. Una cantautrice, produttrice discografica e conduttrice televisiva italiana. _(ampio)_<br>2. Roma, Novecento: una cantautrice, produttrice discografica e conduttrice televisiva italiana. _(ampio)_<br>3. Nasce a Roma il 26 aprile 1971. _(specifico)_<br>4. Ha venduto oltre 25 milioni di dischi in tutto il mondo, di cui 10 milioni solo in Italia tra album, singoli, EP e DVD. _(specifico)_ |
| **Harry Styles** | 2 · musica | 1. Un cantautore e attore britannico. _(ampio)_<br>2. Redditch, Novecento: un cantautore e attore britannico. _(ampio)_<br>3. Nasce a Redditch il 1 febbraio 1994. _(specifico)_<br>4. La sua carriera musicale è iniziata nel 2010 come membro degli One Direction, che è diventata rapidamente una delle boy band di maggior successo nella musica pop. _(specifico)_ |
| **Jovanotti** | 2 · musica | 1. Un cantautore, rapper e disc jockey italiano. _(ampio)_<br>2. Roma, Novecento: un cantautore, rapper e disc jockey italiano. _(ampio)_<br>3. Nasce a Roma il 27 settembre 1966. _(specifico)_<br>4. Nel corso della sua carriera ha pubblicato venti album in studio, collaborando con numerosi artisti della scena musicale italiana, tra cui Elisa, Giorgia, Negramaro, Cesare Crem… _(specifico)_ |
| **Justin Bieber** | 2 · musica | 1. Un cantautore canadese. _(ampio)_<br>2. London, Novecento: un cantautore canadese. _(ampio)_<br>3. Nasce a London il 1 marzo 1994. _(specifico)_<br>4. My World, il suo EP di debutto, fu pubblicato a fine 2009 e venne certificato disco di platino negli Stati Uniti d'America. _(specifico)_ |
| **Katy Perry** | 2 · musica | 1. Una cantautrice e personaggio televisivo statunitense. _(ampio)_<br>2. Santa Barbara, Novecento: una cantautrice e personaggio televisivo statunitense. _(ampio)_<br>3. Nasce a Santa Barbara il 25 ottobre 1984. _(specifico)_<br>4. Billboard l'ha definita una delle più grandi pop star del ventunesimo secolo, inserendola al quinto posto tra le artiste che lo hanno dominato e al primo tra le pop star che han… _(specifico)_ |
| **Lady Gaga** | 2 · musica | 1. Una cantautrice, compositrice e attrice statunitense. _(ampio)_<br>2. New York, Novecento: una cantautrice, compositrice e attrice statunitense. _(ampio)_<br>3. Nasce a New York il 28 marzo 1986. _(specifico)_<br>4. Nota per lo stile camaleontico e i modi eccentrici, si è affermata nel panorama musicale internazionale per la natura provocatoria dei suoi lavori e per le esibizioni dal vivo,… _(specifico)_ |
| **Lana Del Rey** | 2 · musica | 1. Una cantautrice statunitense, classe 1985. _(ampio)_<br>2. New York, Novecento: una cantautrice statunitense. _(ampio)_<br>3. Nasce a New York il 21 giugno 1985. _(specifico)_<br>4. Pur essendo attiva musicalmente dal 2005, la fama internazionale è arrivata nel 2012 con il secondo album in studio Born to Die. _(specifico)_ |
| **Laura Pausini** | 2 · musica | 1. Una cantautrice italiana, classe 1974. _(ampio)_<br>2. Faenza, Novecento: una cantautrice italiana. _(ampio)_<br>3. Nasce a Faenza il 16 maggio 1974. _(specifico)_<br>4. Ha iniziato la sua carriera nel 1993, vincendo il Festival di Sanremo nella sezione "Nuove proposte" con il brano La solitudine e confermando il successo l'anno seguente classif… _(specifico)_ |
| **Luciano Ligabue** | 2 · musica | 1. Un cantautore, regista, scrittore. _(ampio)_<br>2. Correggio, Novecento: un cantautore, regista, scrittore. _(ampio)_<br>3. Nasce a Correggio il 13 marzo 1960. _(specifico)_<br>4. Si è aggiudicato in particolare tre Targhe Tenco e un Premio Tenco. _(specifico)_ |
| **Lucio Dalla** | 2 · musica | 1. Un cantautore, compositore. _(ampio)_<br>2. Bologna, Novecento: un cantautore, compositore. _(ampio)_<br>3. Nasce a Bologna il 4 marzo 1943. _(specifico)_<br>4. Musicista di formazione jazz, è considerato uno dei maggiori cantautori italiani. _(specifico)_ |
| **Madonna** | 2 · musica | 1. Una cantautrice, produttrice discografica e attrice statunitense. _(ampio)_<br>2. Bay City, Novecento: una cantautrice, produttrice discografica e attrice statunitense. _(ampio)_<br>3. Nasce a Bay City il 16 agosto 1958. _(specifico)_<br>4. Tra i suoi album più acclamati Like a Virgin , True Blue e Like a Prayer , così come il vincitore del Grammy Award per il miglior album pop Ray of Light e Confessions on a Dance… _(specifico)_ |
| **Mahmood** | 2 · musica | 1. Un cantautore e paroliere italiano. _(ampio)_<br>2. Milano, Novecento: un cantautore e paroliere italiano. _(ampio)_<br>3. Nasce a Milano il 12 settembre 1992. _(specifico)_<br>4. Ha raggiunto la notorietà nel 2018 partecipando a Sanremo Giovani, vincendo la seconda serata con il brano Gioventù bruciata e guadagnando così l'accesso alla categoria unica de… _(specifico)_ |
| **Marco Mengoni** | 2 · musica | 1. Un cantautore italiano, classe 1988. _(ampio)_<br>2. Ronciglione, Novecento: un cantautore italiano. _(ampio)_<br>3. Nasce a Ronciglione il 25 dicembre 1988. _(specifico)_<br>4. Dopo alcune esperienze nell'ambito musicale come membro di un quintetto vocale, a 16 anni decide di intraprendere la carriera solista, salendo alla ribalta nel 2009 grazie alla… _(specifico)_ |
| **Max Pezzali** | 2 · musica | 1. Un cantautore italiano, classe 1967. _(ampio)_<br>2. Pavia, Novecento: un cantautore italiano. _(ampio)_<br>3. Nasce a Pavia il 14 novembre 1967. _(specifico)_<br>4. È noto per essere stato frontman e voce principale degli 883, gruppo fondato insieme all'amico Mauro Repetto nel 1989, ha ricoperto tale ruolo per 15 anni per poi intraprendere… _(specifico)_ |
| **Michael Jackson** | 2 · musica | 1. Un cantautore, compositore, classe 1958. _(ampio)_<br>2. Gary, Novecento: un cantautore, compositore. _(ampio)_<br>3. Nasce a Gary il 29 agosto 1958. _(specifico)_<br>4. Nel 1982 ha pubblicato Thriller, che risulta essere l'album più venduto di sempre, con vendite stimate che vanno dai 70 ai 100 milioni di copie a livello globale, delle quali 34… _(specifico)_ |
| **Miley Cyrus** | 2 · musica | 1. Una cantautrice e attrice statunitense. _(ampio)_<br>2. Franklin, Novecento: una cantautrice e attrice statunitense. _(ampio)_<br>3. Nasce a Franklin il 23 novembre 1992. _(specifico)_<br>4. Bambina prodigio, ha raggiunto la celebrità a livello mondiale all'età di tredici anni grazie al ruolo di Stewart/Hannah Montana nella serie televisiva di Disney Channel Hannah… _(specifico)_ |
| **Mina** | 2 · musica | 1. Una cantante, produttrice discografica. _(ampio)_<br>2. Busto Arsizio, Novecento: una cantante, produttrice discografica. _(ampio)_<br>3. Nasce a Busto Arsizio il 25 marzo 1940. _(specifico)_<br>4. In carriera ha pubblicato più di 1.500 brani, sia su supporti singoli sia su album: 9 sue canzoni sono arrivate al numero uno nelle classifiche settimanali italiane, mentre dei… _(specifico)_ |
| **Olivia Rodrigo** | 2 · musica | 1. Una cantautrice e attrice statunitense di origini filippine. _(ampio)_<br>2. Murrieta, Duemila: una cantautrice e attrice statunitense di origini filippine. _(ampio)_<br>3. Nasce a Murrieta il 20 febbraio 2003. _(specifico)_<br>4. Dopo aver interpretato il ruolo di Paige Olvera nella serie Bizaardvark e quello di Nini Salazar-Roberts nella serie High School Musical: The Musical - La serie, nel 2021 è sali… _(specifico)_ |
| **Renato Zero** | 2 · musica | 1. Un cantautore e produttore discografico italiano. _(ampio)_<br>2. Roma, Novecento: un cantautore e produttore discografico italiano. _(ampio)_<br>3. Nasce a Roma il 30 settembre 1950. _(specifico)_<br>4. Fra i cantautori italiani più popolari e di maggior successo di sempre, nel corso della sua lunga carriera ha pubblicato 50 album, di cui 35 in studio, 7 dal vivo, 7 raccolte uf… _(specifico)_ |
| **Rihanna** | 2 · musica | 1. Una cantante, imprenditrice, attrice e diplomatica barbadiana. _(ampio)_<br>2. Saint Michael, Novecento: una cantante, imprenditrice, attrice e diplomatica barbadiana. _(ampio)_<br>3. Nasce a Saint Michael il 20 febbraio 1988. _(specifico)_<br>4. Si è trasferita negli Stati Uniti d'America all'età di 16 anni grazie a un contratto discografico con l'etichetta Def Jam Recordings. _(specifico)_ |
| **Rosalía** | 2 · musica | 1. Una cantautrice, produttrice discografica e attrice spagnola. _(ampio)_<br>2. Sant Cugat del Vallès, Novecento: una cantautrice, produttrice discografica e attrice spagnola. _(ampio)_<br>3. Nasce a Sant Cugat del Vallès il 25 settembre 1992. _(specifico)_<br>4. Formatasi musicalmente a Barcellona, nel 2017 esordisce con l'album in studio Los ángeles. _(specifico)_ |
| **Sabrina Carpenter** | 2 · musica | 1. Una cantautrice e attrice statunitense, classe 1999. _(ampio)_<br>2. Quakertown, Novecento: una cantautrice e attrice statunitense. _(ampio)_<br>3. Nasce a Quakertown il 11 maggio 1999. _(specifico)_<br>4. Ha iniziato la carriera recitando in serie televisive e film, diventando nota al pubblico di Disney Channel per aver interpretato il ruolo di Maya Hart nella serie televisiva Gi… _(specifico)_ |
| **Salmo** | 2 · musica | 1. Un rapper, cantautore e produttore discografico italiano. _(ampio)_<br>2. Olbia, Novecento: un rapper, cantautore e produttore discografico italiano. _(ampio)_<br>3. Nasce a Olbia il 29 giugno 1984. _(specifico)_<br>4. un rapper, cantautore e produttore discografico italiano del 1984: la voce di Wikipedia ne racconta la storia. _(specifico)_ |
| **Selena Gomez** | 2 · musica | 1. Un'attrice, cantante, imprenditrice e produttrice televisiva statunitense. _(ampio)_<br>2. Grand Prairie, Novecento: un'attrice, cantante, imprenditrice e produttrice televisiva statunitense. _(ampio)_<br>3. Nasce a Grand Prairie il 22 luglio 1992. _(specifico)_<br>4. Ha recitato da bambina nella serie televisiva Barney e successivamente è apparsa in varie serie televisive della Disney. _(specifico)_ |
| **Sfera Ebbasta** | 2 · musica | 1. Un rapper italiano. _(ampio)_<br>2. Sesto San Giovanni, Novecento: un rapper italiano. _(ampio)_<br>3. Nasce a Sesto San Giovanni il 7 dicembre 1992. _(specifico)_<br>4. È salito alla ribalta nell'estate del 2015 grazie alla pubblicazione dell'album XDVR insieme a Charlie Charles, a cui sono seguiti altri sei album. _(specifico)_ |
| **Shakira** | 2 · musica | 1. Una cantautrice, ballerina, produttrice discografica e attrice colombiana con cittadinanza statunitense. _(ampio)_<br>2. Barranquilla, Novecento: una cantautrice, ballerina, produttrice discografica e attrice colombiana con cittadinanza statunitense. _(ampio)_<br>3. Nasce a Barranquilla il 2 febbraio 1977. _(specifico)_<br>4. Ha debuttato nel mercato discografico latinoamericano con gli album Magia, Pies descalzos e ¿Dónde están los ladrones? _(specifico)_ |
| **Tananai** | 2 · musica | 1. Un cantautore e produttore discografico italiano, classe 1995. _(ampio)_<br>2. Milano, Novecento: un cantautore e produttore discografico italiano. _(ampio)_<br>3. Nasce a Milano il 8 maggio 1995. _(specifico)_<br>4. Ha iniziato la carriera musicale nel 2014 con lo pseudonimo Not for Us, producendo principalmente musica elettronica, per poi orientarsi verso il genere pop con lo pseudonimo da… _(specifico)_ |
| **Taylor Swift** | 2 · musica | 1. Una cantautrice, produttrice discografica. _(ampio)_<br>2. West Reading, Novecento: una cantautrice, produttrice discografica. _(ampio)_<br>3. Nasce a West Reading il 13 dicembre 1989. _(specifico)_<br>4. Riconosciuta come una figura di spicco nella storia della musica country e pop, con vendite stimate di oltre 200 milioni di unità a livello globale tra album e singoli, è una de… _(specifico)_ |
| **The Weeknd** | 2 · musica | 1. Un cantautore, produttore discografico e attore canadese. _(ampio)_<br>2. Toronto, Novecento: un cantautore, produttore discografico e attore canadese. _(ampio)_<br>3. Nasce a Toronto il 16 febbraio 1990. _(specifico)_<br>4. Nel 2011 ha firmato il suo primo contratto discografico con la Republic Records, pubblicando la raccolta Trilogy formata dai mixtape House of Balloons, Thursday e Echoes of Sile… _(specifico)_ |
| **Tiziano Ferro** | 2 · musica | 1. Un cantautore e produttore discografico italiano, classe 1980. _(ampio)_<br>2. Latina, Novecento: un cantautore e produttore discografico italiano. _(ampio)_<br>3. Nasce a Latina il 21 febbraio 1980. _(specifico)_<br>4. Salito alla ribalta grazie al singolo di debutto Xdono, che ottenne il terzo posto nella classifica dei singoli più venduti in Europa nel 2002, è ritenuto uno dei più influenti… _(specifico)_ |
| **Ultimo** | 2 · musica | 1. Un cantautore italiano, classe 1996. _(ampio)_<br>2. Roma, Novecento: un cantautore italiano. _(ampio)_<br>3. Nasce a Roma il 27 gennaio 1996. _(specifico)_<br>4. Ha raggiunto la notorietà nel 2018 vincendo il 68º Festival di Sanremo nella sezione "Nuove proposte" con il brano Il ballo delle incertezze, si è poi classificato al secondo po… _(specifico)_ |
| **Vasco Rossi** | 2 · musica | 1. Un cantautore italiano, classe 1952. _(ampio)_<br>2. Zocca, Novecento: un cantautore italiano. _(ampio)_<br>3. Nasce a Zocca il 7 febbraio 1952. _(specifico)_<br>4. Dal 1977 ha pubblicato 37 album, di cui 18 in studio, 13 dal vivo e 6 raccolte ufficiali , e 192 canzoni, oltre ad aver scritto numerosi testi e musiche per altri interpreti. _(specifico)_ |
| **Zucchero** | 2 · musica | 1. Un cantautore italiano, classe 1955. _(ampio)_<br>2. Reggio Emilia, Novecento: un cantautore italiano. _(ampio)_<br>3. Nasce a Reggio Emilia il 25 settembre 1955. _(specifico)_<br>4. Annoverato fra i principali esponenti del blues in Italia, nell'arco di oltre cinquant'anni di carriera ha riscosso un ragguardevole successo commerciale, vendendo più di 60 mil… _(specifico)_ |
| **Al Pacino** | 3 · cinema | 1. Un attore statunitense. _(ampio)_<br>2. New York, Novecento: un attore statunitense. _(ampio)_<br>3. Nasce a New York il 25 aprile 1940. _(specifico)_<br>4. Fra i numerosi riconoscimenti conferitogli vi sono due premi Emmy, un premio BAFTA, due Tony Award – con i quali ha completato la tripla corona della recitazione –, cinque Golde… _(specifico)_ |
| **Ana de Armas** | 3 · cinema | 1. Un'attrice e modella cubana naturalizzata spagnola. _(ampio)_<br>2. L'Avana, Novecento: un'attrice e modella cubana naturalizzata spagnola. _(ampio)_<br>3. Nasce a L'Avana il 30 aprile 1988. _(specifico)_<br>4. Ha esordito nel 2006 con il film Una rosa de Francia di Manuel Aragón, mentre tra il 2007 e il 2010 ha recitato nella serie televisiva El Internado. _(specifico)_ |
| **Angelina Jolie** | 3 · cinema | 1. Un'attrice, produttrice cinematografica. _(ampio)_<br>2. Los Angeles, Novecento: un'attrice, produttrice cinematografica. _(ampio)_<br>3. Nasce a Los Angeles il 4 giugno 1975. _(specifico)_<br>4. Ha raggiunto notorietà internazionale interpretando l'eroina dei videogiochi Lara Croft nei film Lara Croft: Tomb Raider e Lara Croft: Tomb Raider - La culla della vita . _(specifico)_ |
| **Anya Taylor-Joy** | 3 · cinema | 1. Un'attrice ed ex modella statunitense con cittadinanza britannica. _(ampio)_<br>2. Miami, Novecento: un'attrice ed ex modella statunitense con cittadinanza britannica. _(ampio)_<br>3. Nasce a Miami il 16 aprile 1996. _(specifico)_<br>4. un'attrice ed ex modella statunitense con cittadinanza britannica del 1996: la voce di Wikipedia ne racconta la storia. _(specifico)_ |
| **Brad Pitt** | 3 · cinema | 1. Un attore e produttore cinematografico statunitense. _(ampio)_<br>2. Shawnee, Novecento: un attore e produttore cinematografico statunitense. _(ampio)_<br>3. Nasce a Shawnee il 18 dicembre 1963. _(specifico)_<br>4. Durante quasi cinque decenni di carriera ha ricevuto numerosi riconoscimenti per i suoi contributi nel mondo del cinema, inclusi due premi Oscar, di cui uno per aver prodotto, t… _(specifico)_ |
| **Cate Blanchett** | 3 · cinema | 1. Un'attrice e produttrice cinematografica australiana con cittadinanza statunitense. _(ampio)_<br>2. Melbourne, Novecento: un'attrice e produttrice cinematografica australiana con cittadinanza statunitense. _(ampio)_<br>3. Nasce a Melbourne il 14 maggio 1969. _(specifico)_<br>4. Considerata una delle migliori attrici della sua generazione, è stata candidata in totale otto volte agli Oscar, la quarta attrice in assoluto più candidata della storia del pre… _(specifico)_ |
| **Checco Zalone** | 3 · cinema | 1. Un comico, sceneggiatore, attore. _(ampio)_<br>2. Capurso, Novecento: un comico, sceneggiatore, attore. _(ampio)_<br>3. Nasce a Capurso il 3 giugno 1977. _(specifico)_<br>4. I sei film che lo hanno visto protagonista hanno incassato complessivamente 297 milioni di euro e cinque di questi compaiono nella lista dei dieci film con maggiori incassi in I… _(specifico)_ |
| **Chris Hemsworth** | 3 · cinema | 1. Un attore australiano, noto al grande pubblico per aver interpretato il ruolo di Thor nei film del Marvel. _(ampio)_<br>2. Melbourne, Novecento: un attore australiano, noto al grande pubblico per aver interpretato il ruolo di Thor nei film del Marvel. _(ampio)_<br>3. Nasce a Melbourne il 11 agosto 1983. _(specifico)_<br>4. un attore australiano, noto al grande pubblico per aver interpretato il ruolo di Thor nei film del Marvel del 1983: la voce di Wikipedia ne racconta la storia. _(specifico)_ |
| **Cillian Murphy** | 3 · cinema | 1. Un attore e produttore cinematografico irlandese. _(ampio)_<br>2. Cork, Novecento: un attore e produttore cinematografico irlandese. _(ampio)_<br>3. Nasce a Cork il 25 maggio 1976. _(specifico)_<br>4. Dopo aver intrapreso una carriera da musicista, poi abbandonata, iniziò a recitare a teatro e nelle pellicole indipendenti irlandesi verso la fine degli anni '90. _(specifico)_ |
| **Denzel Washington** | 3 · cinema | 1. Un attore, regista e produttore cinematografico statunitense. _(ampio)_<br>2. Mount Vernon, Novecento: un attore, regista e produttore cinematografico statunitense. _(ampio)_<br>3. Nasce a Mount Vernon il 28 dicembre 1954. _(specifico)_<br>4. Ha ottenuto molti riconoscimenti per il suo lavoro cinematografico fin dagli anni ottanta, incluse le sue interpretazioni di personaggi come l'attivista anti-apartheid sudafrica… _(specifico)_ |
| **Dwayne Johnson** | 3 · cinema | 1. Un attore, produttore cinematografico. _(ampio)_<br>2. Hayward, Novecento: un attore, produttore cinematografico. _(ampio)_<br>3. Nasce a Hayward il 2 maggio 1972. _(specifico)_<br>4. Dal 1996 al 2004 ha avuto successo nella World Wrestling Federation/Entertainment come una delle figure cardine e tra le più carismatiche dell'Attitude Era: è infatti riconosciu… _(specifico)_ |
| **Elio Germano** | 3 · cinema | 1. Un attore e regista italiano. _(ampio)_<br>2. Roma, Novecento: un attore e regista italiano. _(ampio)_<br>3. Nasce a Roma il 25 settembre 1980. _(specifico)_<br>4. Per La nostra vita ha vinto anche il Nastro d'argento al migliore attore protagonista ed il Prix d'interprétation masculine al Festival di Cannes 2010. _(specifico)_ |
| **Emma Stone** | 3 · cinema | 1. Un'attrice statunitense, vincitrice di due Premi Oscar. _(ampio)_<br>2. Scottsdale, Novecento: un'attrice statunitense, vincitrice di due Premi Oscar. _(ampio)_<br>3. Nasce a Scottsdale il 6 novembre 1988. _(specifico)_<br>4. Annoverata tra le migliori attrici della sua generazione, ha debuttato sul grande schermo con il film Su×bad - Tre menti sopra il pelo , continuando a recitare in numerosi film… _(specifico)_ |
| **Emma Watson** | 3 · cinema | 1. Un'attrice e attivista britannica. _(ampio)_<br>2. Parigi, Novecento: un'attrice e attivista britannica. _(ampio)_<br>3. Nasce a Parigi il 15 aprile 1990. _(specifico)_<br>4. Nel 2015 la rivista Time l'ha inserita tra le 100 persone più influenti del pianeta. _(specifico)_ |
| **Florence Pugh** | 3 · cinema | 1. Un'attrice britannica. _(ampio)_<br>2. Oxford, Novecento: un'attrice britannica. _(ampio)_<br>3. Nasce a Oxford il 3 gennaio 1996. _(specifico)_<br>4. Ha ottenuto il riconoscimento pubblico per i suoi ruoli nei film Lady Macbeth , Una famiglia al tappeto , Midsommar - Il villaggio dei dannati e Don't Worry Darling . _(specifico)_ |
| **Javier Bardem** | 3 · cinema | 1. Un attore spagnolo. _(ampio)_<br>2. Las Palmas de Gran Canaria, Novecento: un attore spagnolo. _(ampio)_<br>3. Nasce a Las Palmas de Gran Canaria il 1 marzo 1969. _(specifico)_<br>4. È stato candidato quattro volte al Premio Oscar rispettivamente nella sezione miglior attore protagonista per Prima che sia notte, Biutiful e A proposito dei Ricardo e nella sez… _(specifico)_ |
| **Jenna Ortega** | 3 · cinema | 1. Un'attrice statunitense. _(ampio)_<br>2. Palm Desert, Duemila: un'attrice statunitense. _(ampio)_<br>3. Nasce a Palm Desert il 27 settembre 2002. _(specifico)_<br>4. È nota per aver interpretato Harley Diaz nella serie Disney Channel Harley in mezzo , Ellie Alves nella serie You e Tara Carpenter nei film horror Scream e Scream VI . _(specifico)_ |
| **Johnny Depp** | 3 · cinema | 1. Un attore, regista e produttore cinematografico statunitense, classe 1963. _(ampio)_<br>2. Owensboro, Novecento: un attore, regista e produttore cinematografico statunitense. _(ampio)_<br>3. Nasce a Owensboro il 9 giugno 1963. _(specifico)_<br>4. La sua carriera è iniziata negli anni ottanta con piccoli ruoli in film come Nightmare - Dal profondo della notte, Platoon e, soprattutto, nella serie televisiva I quattro della… _(specifico)_ |
| **Julia Roberts** | 3 · cinema | 1. Un'attrice e produttrice cinematografica statunitense. _(ampio)_<br>2. Smyrna, Novecento: un'attrice e produttrice cinematografica statunitense. _(ampio)_<br>3. Nasce a Smyrna il 28 ottobre 1967. _(specifico)_<br>4. Con il film drammatico Fiori d'acciaio , per il quale si è aggiudicata il Golden Globe per la migliore attrice non protagonista e la sua prima candidatura all'Oscar nella medesi… _(specifico)_ |
| **Leonardo DiCaprio** | 3 · cinema | 1. Un attore, produttore cinematografico e ambientalista statunitense. _(ampio)_<br>2. Los Angeles, Novecento: un attore, produttore cinematografico e ambientalista statunitense. _(ampio)_<br>3. Nasce a Los Angeles il 11 novembre 1974. _(specifico)_<br>4. Considerato tra gli attori più celebri e popolari della storia del cinema, ha preso parte a numerose pellicole di successo e ha spesso ottenuto il consenso di pubblico e critica… _(specifico)_ |
| **Luca Marinelli** | 3 · cinema | 1. Un attore italiano, vincitore di un David di Donatello. _(ampio)_<br>2. Roma, Novecento: un attore italiano, vincitore di un David di Donatello. _(ampio)_<br>3. Nasce a Roma il 22 ottobre 1984. _(specifico)_<br>4. un attore italiano, vincitore di un David di Donatello del 1984: la voce di Wikipedia ne racconta la storia. _(specifico)_ |
| **Margot Robbie** | 3 · cinema | 1. Un'attrice, produttrice cinematografica e televisiva australiana. _(ampio)_<br>2. Dalby, Novecento: un'attrice, produttrice cinematografica e televisiva australiana. _(ampio)_<br>3. Nasce a Dalby il 2 luglio 1990. _(specifico)_<br>4. Ha iniziato la sua carriera apparendo in film indipendenti australiani, venendo in seguito lanciata nella soap opera Neighbours . _(specifico)_ |
| **Meryl Streep** | 3 · cinema | 1. Un'attrice statunitense, classe 1949. _(ampio)_<br>2. Summit, Novecento: un'attrice statunitense. _(ampio)_<br>3. Nasce a Summit il 22 giugno 1949. _(specifico)_<br>4. Detiene il record assoluto di candidature agli Oscar con due vittorie da protagonista nel 1983 e nel 2012 e una come non protagonista nel 1980, eguagliando per vittorie Ingrid B… _(specifico)_ |
| **Millie Bobby Brown** | 3 · cinema | 1. Un'attrice britannica, classe 2004. _(ampio)_<br>2. Marbella, Duemila: un'attrice britannica. _(ampio)_<br>3. Nasce a Marbella il 19 febbraio 2004. _(specifico)_<br>4. Nel 2016 ha ottenuto il successo mondiale con il ruolo di Undici nella serie televisiva Stranger Things, ideata dai fratelli Duffer e distribuita da Netflix, che le è valso due… _(specifico)_ |
| **Miriam Leone** | 3 · cinema | 1. Un'attrice, conduttrice televisiva ed ex modella italiana. _(ampio)_<br>2. Catania, Novecento: un'attrice, conduttrice televisiva ed ex modella italiana. _(ampio)_<br>3. Nasce a Catania il 14 aprile 1985. _(specifico)_<br>4. Per il suo lavoro in campo interpretativo ha ottenuto diversi riconoscimenti, tra cui due Nastri d'argento, un premio Flaiano, due Ciak d'oro e una candidatura al David di Donat… _(specifico)_ |
| **Monica Bellucci** | 3 · cinema | 1. Un'attrice ed ex modella italiana. _(ampio)_<br>2. Città di Castello, Novecento: un'attrice ed ex modella italiana. _(ampio)_<br>3. Nasce a Città di Castello il 30 settembre 1964. _(specifico)_<br>4. Considerata una delle più celebri sex symbol a cavallo tra gli anni 1990 e 2000, nella sua carriera ha preso parte a svariati film di notevole successo internazionale, fra cui D… _(specifico)_ |
| **Nicole Kidman** | 3 · cinema | 1. Un'attrice, produttrice cinematografica e produttrice televisiva australiana con cittadinanza statunitense. _(ampio)_<br>2. Honolulu, Novecento: un'attrice, produttrice cinematografica e produttrice televisiva australiana con cittadinanza statunitense. _(ampio)_<br>3. Nasce a Honolulu il 20 giugno 1967. _(specifico)_<br>4. Considerata tra le migliori attrici della sua generazione, nell'arco della sua carriera le sono stati attribuiti numerosi riconoscimenti, tra cui un Premio Oscar, sei Golden Glo… _(specifico)_ |
| **Paola Cortellesi** | 3 · cinema | 1. Un'attrice, comica, sceneggiatrice e regista italiana. _(ampio)_<br>2. Roma, Novecento: un'attrice, comica, sceneggiatrice e regista italiana. _(ampio)_<br>3. Nasce a Roma il 24 novembre 1973. _(specifico)_<br>4. Dopo il debutto in giovane età come cantante di Cacao meravigliao per la trasmissione Indietro tutta! _(specifico)_ |
| **Paul Mescal** | 3 · cinema | 1. Un attore irlandese. _(ampio)_<br>2. Maynooth, Novecento: un attore irlandese. _(ampio)_<br>3. Nasce a Maynooth il 2 febbraio 1996. _(specifico)_<br>4. Ha ottenuto l'attenzione internazionale per la sua interpretazione nella miniserie televisiva Normal People, per la quale si è aggiudicato un BAFTA Television Award e ha ricevut… _(specifico)_ |
| **Pedro Pascal** | 3 · cinema | 1. Un attore cileno naturalizzato statunitense. _(ampio)_<br>2. Santiago del Cile, Novecento: un attore cileno naturalizzato statunitense. _(ampio)_<br>3. Nasce a Santiago del Cile il 2 aprile 1975. _(specifico)_<br>4. È noto per aver interpretato Oberyn Martell nell'acclamata serie televisiva Il Trono di Spade , Javier F. _(specifico)_ |
| **Penelope Cruz** | 3 · cinema | 1. Un'attrice e modella spagnola. _(ampio)_<br>2. Alcobendas, Novecento: un'attrice e modella spagnola. _(ampio)_<br>3. Nasce a Alcobendas il 28 aprile 1974. _(specifico)_<br>4. Ha debuttato sul grande schermo a 17 anni con la pellicola spagnola Prosciutto prosciutto , a cui seguono Apri gli occhi e La niña dei tuoi sogni . _(specifico)_ |
| **Pierfrancesco Favino** | 3 · cinema | 1. Un attore, produttore cinematografico e regista teatrale italiano. _(ampio)_<br>2. Roma, Novecento: un attore, produttore cinematografico e regista teatrale italiano. _(ampio)_<br>3. Nasce a Roma il 24 agosto 1969. _(specifico)_<br>4. Affermatosi in via definitiva dopo aver vestito i panni di Gino Bartali nell'omonima miniserie televisiva, da allora ha recitato in innumerevoli opere italiane e anche in vari f… _(specifico)_ |
| **Robert De Niro** | 3 · cinema | 1. Un attore e produttore cinematografico statunitense con cittadinanza italiana. _(ampio)_<br>2. New York, Novecento: un attore e produttore cinematografico statunitense con cittadinanza italiana. _(ampio)_<br>3. Nasce a New York il 17 agosto 1943. _(specifico)_<br>4. È particolarmente apprezzato per l'interpretazione di personaggi complessi, incarnati in film di grande successo diretti da alcuni dei maggiori registi degli anni settanta e gli… _(specifico)_ |
| **Robert Pattinson** | 3 · cinema | 1. Un attore britannico. _(ampio)_<br>2. Londra, Novecento: un attore britannico. _(ampio)_<br>3. Nasce a Londra il 13 maggio 1986. _(specifico)_<br>4. Ha iniziato la sua carriera cinematografica interpretando Cedric Diggory nel film Harry Potter e il calice di fuoco . _(specifico)_ |
| **Roberto Benigni** | 3 · cinema | 1. Un attore, comico, cabarettista. _(ampio)_<br>2. Castiglion Fiorentino, Novecento: un attore, comico, cabarettista. _(ampio)_<br>3. Nasce a Castiglion Fiorentino il 27 ottobre 1952. _(specifico)_<br>4. Esordendo come popolare monologhista teatrale, dalla comicità ironica e dissacrante, nel tempo è diventato personaggio pubblico tra i più conosciuti e apprezzati in Italia e nel… _(specifico)_ |
| **Ryan Gosling** | 3 · cinema | 1. Un attore e produttore cinematografico canadese. _(ampio)_<br>2. London, Novecento: un attore e produttore cinematografico canadese. _(ampio)_<br>3. Nasce a London il 12 novembre 1980. _(specifico)_<br>4. Ha iniziato la sua carriera da bambino, prima come membro del Mickey Mouse Club poi come interprete di serie televisive, tra cui Young Hercules. _(specifico)_ |
| **Scarlett Johansson** | 3 · cinema | 1. Un'attrice e cantante statunitense. _(ampio)_<br>2. New York, Novecento: un'attrice e cantante statunitense. _(ampio)_<br>3. Nasce a New York il 22 novembre 1984. _(specifico)_<br>4. Ha fatto il suo esordio cinematografico come attrice bambina nel 1994 in Genitori cercasi, ottenendo i primi riconoscimenti per i suoi ruoli in Manny & Lo , L'uomo che sussurrav… _(specifico)_ |
| **Sofia Vergara** | 3 · cinema | 1. Un'attrice, produttrice televisiva e modella colombiana naturalizzata statunitense. _(ampio)_<br>2. Barranquilla, Novecento: un'attrice, produttrice televisiva e modella colombiana naturalizzata statunitense. _(ampio)_<br>3. Nasce a Barranquilla il 10 luglio 1972. _(specifico)_<br>4. È nota soprattutto per il ruolo di Gloria Delgado-Pritchett nella acclamata serie televisiva Modern Family, per la quale ha ricevuto quattro candidature al Golden Globe, una al… _(specifico)_ |
| **Sophia Loren** | 3 · cinema | 1. Un'attrice italiana con cittadinanza francese. _(ampio)_<br>2. Roma, Novecento: un'attrice italiana con cittadinanza francese. _(ampio)_<br>3. Nasce a Roma il 20 settembre 1934. _(specifico)_<br>4. Nel 1960 venne diretta da Vittorio De Sica ne La ciociara, per il quale vinse il Premio Oscar. _(specifico)_ |
| **Sydney Sweeney** | 3 · cinema | 1. Un'attrice statunitense, classe 1997. _(ampio)_<br>2. Spokane, Novecento: un'attrice statunitense. _(ampio)_<br>3. Nasce a Spokane il 12 settembre 1997. _(specifico)_<br>4. Ha ricevuto consensi più ampi per la sua interpretazione di Cassie Howard nella serie televisiva Euphoria e nella prima stagione della serie antologica The White Lotus , entramb… _(specifico)_ |
| **Timothée Chalamet** | 3 · cinema | 1. Un attore statunitense con cittadinanza francese. _(ampio)_<br>2. New York, Novecento: un attore statunitense con cittadinanza francese. _(ampio)_<br>3. Nasce a New York il 27 dicembre 1995. _(specifico)_<br>4. Annoverato tra i migliori attori della sua generazione, ha ricevuto il riconoscimento internazionale con il ruolo di Elio Perlman nel film Chiamami col tuo nome di Luca Guadagni… _(specifico)_ |
| **Tom Cruise** | 3 · cinema | 1. Un attore e produttore cinematografico statunitense, classe 1962. _(ampio)_<br>2. Syracuse, Novecento: un attore e produttore cinematografico statunitense. _(ampio)_<br>3. Nasce a Syracuse il 3 luglio 1962. _(specifico)_<br>4. Candidato per quattro volte ai premi Oscar ed ha vinto tre Golden Globe. _(specifico)_ |
| **Tom Hanks** | 3 · cinema | 1. Un attore, regista, sceneggiatore. _(ampio)_<br>2. Concord, Novecento: un attore, regista, sceneggiatore. _(ampio)_<br>3. Nasce a Concord il 9 luglio 1956. _(specifico)_<br>4. La sua carriera ha avuto inizio negli anni ottanta quando, interpretando la serie Henry e Kip, cominciò a esser conosciuto. _(specifico)_ |
| **Tom Holland** | 3 · cinema | 1. Un attore britannico, classe 1996. _(ampio)_<br>2. Londra, Novecento: un attore britannico, classe 1996. _(ampio)_<br>3. Nasce a Londra il 1 giugno 1996. _(specifico)_<br>4. Dopo aver interpretato il ruolo di Lucas nel film The Impossible del 2012, è diventato noto dal 2016 per il suo ruolo di Peter Parker / Spider-Man nel Marvel Cinematic Universe. _(specifico)_ |
| **Toni Servillo** | 3 · cinema | 1. Un attore e regista teatrale italiano. _(ampio)_<br>2. Afragola, Novecento: un attore e regista teatrale italiano. _(ampio)_<br>3. Nasce a Afragola il 25 gennaio 1959. _(specifico)_<br>4. Nel corso della sua carriera ha ricevuto quattro David di Donatello, una Coppa Volpi e quattro Nastri d'argento. _(specifico)_ |
| **Valeria Golino** | 3 · cinema | 1. Un'attrice, regista ed ex modella italiana. _(ampio)_<br>2. Napoli, Novecento: un'attrice, regista ed ex modella italiana. _(ampio)_<br>3. Nasce a Napoli il 22 ottobre 1965. _(specifico)_<br>4. Ha recitato in molti film, tra cui Storia d'amore, Lupo solitario, Respiro, Hot Shots!, Hot Shots! _(specifico)_ |
| **Vin Diesel** | 3 · cinema | 1. Un attore, produttore cinematografico, classe 1967. _(ampio)_<br>2. Alameda, Novecento: un attore, produttore cinematografico. _(ampio)_<br>3. Nasce a Alameda il 18 luglio 1967. _(specifico)_<br>4. È diventato famoso alla fine degli anni novanta per le sue apparizioni in diversi film hollywoodiani di successo tra cui Salvate il soldato Ryan , Pitch Black , xXx e soprattutt… _(specifico)_ |
| **Zendaya** | 3 · cinema | 1. Un'attrice e cantante statunitense, classe 1996. _(ampio)_<br>2. Oakland, Novecento: un'attrice e cantante statunitense. _(ampio)_<br>3. Nasce a Oakland il 1 settembre 1996. _(specifico)_<br>4. Ha iniziato la carriera come modella e ballerina prima di recitare nel film Disney per la televisione Nemici per la pelle , per poi acquisire maggior popolarità grazie ai ruoli… _(specifico)_ |
| **Chiara Ferragni** | 3 · spettacolo | 1. Un'imprenditrice e blogger italiana. _(ampio)_<br>2. Cremona, Novecento: un'imprenditrice e blogger italiana. _(ampio)_<br>3. Nasce a Cremona il 7 maggio 1987. _(specifico)_<br>4. È proprietaria del gruppo finanziario Sisterhood Srl, che a sua volta possiede la società TBS Crew Srl e ha quote nella società Fenice Srl. _(specifico)_ |
| **Eleonora Abbagnato** | 3 · spettacolo | 1. Una ballerina, insegnante di danza classica e direttrice artistica italiana. _(ampio)_<br>2. Palermo, Novecento: una ballerina, insegnante di danza classica e direttrice artistica italiana. _(ampio)_<br>3. Nasce a Palermo il 30 giugno 1978. _(specifico)_<br>4. Dal 2013 al 2021 è stata étoile del Balletto dell'Opéra di Parigi e dal 2015 dirige il corpo di ballo del Teatro dell'Opera di Roma. _(specifico)_ |
| **Luciana Littizzetto** | 3 · spettacolo | 1. Una comica, attrice, conduttrice radiofonica. _(ampio)_<br>2. Torino, Novecento: una comica, attrice, conduttrice radiofonica. _(ampio)_<br>3. Nasce a Torino il 29 ottobre 1964. _(specifico)_<br>4. una comica, attrice, conduttrice radiofonica del 1964: la voce di Wikipedia ne racconta la storia. _(specifico)_ |
| **Roberto Bolle** | 3 · spettacolo | 1. Un ballerino italiano. _(ampio)_<br>2. Casale Monferrato, Novecento: un ballerino italiano. _(ampio)_<br>3. Nasce a Casale Monferrato il 26 marzo 1975. _(specifico)_<br>4. Considerato uno dei ballerini più famosi della storia della danza, è il primo ballerino nella storia ad essere diventato contemporaneamente Étoile del Teatro alla Scala di Milan… _(specifico)_ |
| **Virginia Raffaele** | 3 · spettacolo | 1. Una comica, imitatrice e attrice italiana. _(ampio)_<br>2. Roma, Novecento: una comica, imitatrice e attrice italiana. _(ampio)_<br>3. Nasce a Roma il 27 settembre 1980. _(specifico)_<br>4. Nel corso della sua carriera si è divisa tra cinema, teatro e televisione e ha ottenuto diversi riconoscimenti, tra cui il Nastro d'argento alla migliore attrice in un film comm… _(specifico)_ |
| **Alberto Tomba** | 3 · sport | 1. Un ex sciatore alpino italiano. _(ampio)_<br>2. Bologna, Novecento: un ex sciatore alpino italiano. _(ampio)_<br>3. Nasce a Bologna il 19 dicembre 1966. _(specifico)_<br>4. Uno dei protagonisti dello sci alpino dal 1986 al 1998 nelle specialità dello slalom gigante e di quello speciale, ed è considerato tra i migliori sciatori di tutti i tempi nell… _(specifico)_ |
| **Alessandro Del Piero** | 3 · sport | 1. Un ex calciatore italiano, di ruolo attaccante. _(ampio)_<br>2. Conegliano, Novecento: un ex calciatore italiano, di ruolo attaccante. _(ampio)_<br>3. Nasce a Conegliano il 9 novembre 1974. _(specifico)_<br>4. Con la nazionale italiana è diventato campione del mondo nel 2006. _(specifico)_ |
| **Andrea Pirlo** | 3 · sport | 1. Un allenatore di calcio ed ex calciatore italiano. _(ampio)_<br>2. Flero, Novecento: un allenatore di calcio ed ex calciatore italiano. _(ampio)_<br>3. Nasce a Flero il 19 maggio 1979. _(specifico)_<br>4. Con la nazionale italiana è diventato campione del mondo nel 2006 e vicecampione d'Europa nel 2012. _(specifico)_ |
| **Carlos Alcaraz** | 3 · sport | 1. Un tennista spagnolo. _(ampio)_<br>2. Murcia, Duemila: un tennista spagnolo. _(ampio)_<br>3. Nasce a Murcia il 5 maggio 2003. _(specifico)_<br>4. Con la vittoria delle ATP Finals 2026, ha ulteriormente esteso questo premiato diventando il quarto tennista nella storia e il più giovane in assoluto ad aver vinto i cinque tor… _(specifico)_ |
| **Charles Leclerc** | 3 · sport | 1. Un pilota automobilistico monegasco. _(ampio)_<br>2. Monte Carlo, Novecento: un pilota automobilistico monegasco. _(ampio)_<br>3. Nasce a Monte Carlo il 16 ottobre 1997. _(specifico)_<br>4. Vincitore dei campionati di GP3 Series nel 2016 e di Formula 2 nel 2017 da esordiente, ha debuttato in Formula 1 nel 2018 con la Sauber, per poi passare al volante della Ferrari… _(specifico)_ |
| **Cristiano Ronaldo** | 3 · sport | 1. Un calciatore portoghese, attaccante dell'Al-Nassr. _(ampio)_<br>2. Funchal, Novecento: un calciatore portoghese, attaccante dell'Al-Nassr. _(ampio)_<br>3. Nasce a Funchal il 5 febbraio 1985. _(specifico)_<br>4. Con la nazionale portoghese è diventato campione d'Europa nel 2016 e ha vinto la UEFA Nations League 2018-2019 e 2024-2025. _(specifico)_ |
| **Diego Armando Maradona** | 3 · sport | 1. Un calciatore, allenatore di calcio e dirigente sportivo argentino. _(ampio)_<br>2. Lanús, Novecento: un calciatore, allenatore di calcio e dirigente sportivo argentino. _(ampio)_<br>3. Nasce a Lanús il 30 ottobre 1960. _(specifico)_<br>4. Con il club partenopeo, di cui fu capitano a partire dal 1987, vinse i primi due storici scudetti della squadra, una Coppa Italia, una Supercoppa italiana, e una Coppa UEFA, que… _(specifico)_ |
| **Erling Haaland** | 3 · sport | 1. Un calciatore norvegese, attaccante del Manchester City e della nazionale norvegese. _(ampio)_<br>2. Leeds, Novecento: un calciatore norvegese, attaccante del Manchester City e della nazionale norvegese. _(ampio)_<br>3. Nasce a Leeds il 21 luglio 2000. _(specifico)_<br>4. Considerato uno dei migliori calciatori della sua generazione nonché il miglior norvegese di sempre, è cresciuto nel settore giovanile del Bryne, con cui ha esordito tra i profe… _(specifico)_ |
| **Federica Pellegrini** | 3 · sport | 1. Un personaggio televisivo ed ex nuotatrice italiana. _(ampio)_<br>2. Mirano, Novecento: un personaggio televisivo ed ex nuotatrice italiana. _(ampio)_<br>3. Nasce a Mirano il 5 agosto 1988. _(specifico)_<br>4. Ha preso parte a cinque rassegne olimpiche: la prima nel 2004 quando, solo sedicenne, conquistò la medaglia d'argento nei 200 metri stile libero divenendo all'epoca la più giova… _(specifico)_ |
| **Francesco Totti** | 3 · sport | 1. Un ex calciatore italiano, di ruolo attaccante o centrocampista. _(ampio)_<br>2. Roma, Novecento: un ex calciatore italiano, di ruolo attaccante o centrocampista. _(ampio)_<br>3. Nasce a Roma il 27 settembre 1976. _(specifico)_<br>4. Con la nazionale italiana è diventato campione del mondo nel 2006 e vicecampione d'Europa nel 2000. _(specifico)_ |
| **Gianluigi Buffon** | 3 · sport | 1. Un dirigente sportivo ed ex calciatore italiano. _(ampio)_<br>2. Carrara, Novecento: un dirigente sportivo ed ex calciatore italiano. _(ampio)_<br>3. Nasce a Carrara il 28 gennaio 1978. _(specifico)_<br>4. Considerato uno dei migliori calciatori della storia del calcio, nonché uno dei più grandi portieri di tutti i tempi, è diventato campione del mondo nel 2006 e vicecampione d'Eu… _(specifico)_ |
| **Gianmarco Tamberi** | 3 · sport | 1. Un altista italiano, campione olimpico ai Giochi di Tokyo 2020. _(ampio)_<br>2. Civitanova Marche, Novecento: un altista italiano, campione olimpico ai Giochi di Tokyo 2020. _(ampio)_<br>3. Nasce a Civitanova Marche il 1 giugno 1992. _(specifico)_<br>4. Detentore del record nazionale della specialità sia all'aperto sia indoor, in carriera vanta anche un titolo mondiale indoor , un titolo europeo indoor e nove titoli italiani as… _(specifico)_ |
| **Giannis Antetokounmpo** | 3 · sport | 1. Un cestista greco con cittadinanza nigeriana. _(ampio)_<br>2. Atene, Novecento: un cestista greco con cittadinanza nigeriana. _(ampio)_<br>3. Nasce a Atene il 6 dicembre 1994. _(specifico)_<br>4. Selezionato come quindicesima scelta assoluta al Draft NBA 2013, è soprannominato The Greek Freak , ed è considerato uno dei migliori cestisti della sua generazione e uno dei gi… _(specifico)_ |
| **Jannik Sinner** | 3 · sport | 1. Un tennista italiano. _(ampio)_<br>2. San Candido, Duemila: un tennista italiano. _(ampio)_<br>3. Nasce a San Candido il 16 agosto 2001. _(specifico)_<br>4. Nel 2026 ha completato il Career Golden Masters diventando, insieme a Novak Đoković, l'unico tennista della storia e il più giovane in assoluto a riuscirci. _(specifico)_ |
| **Kylian Mbappé** | 3 · sport | 1. Un calciatore francese, attaccante del Real Madrid e della nazionale francese. _(ampio)_<br>2. Parigi, Novecento: un calciatore francese, attaccante del Real Madrid e della nazionale francese. _(ampio)_<br>3. Nasce a Parigi il 20 dicembre 1998. _(specifico)_<br>4. Considerato uno dei migliori calciatori della sua generazione, esordisce come professionista nel 2015 tra le file del Monaco, con cui vince un campionato francese. _(specifico)_ |
| **LeBron James** | 3 · sport | 1. Un cestista statunitense, ala dei Philadelphia 76ers. _(ampio)_<br>2. Akron, Novecento: un cestista statunitense, ala dei Philadelphia 76ers. _(ampio)_<br>3. Nasce a Akron il 30 dicembre 1984. _(specifico)_<br>4. È il miglior marcatore della storia dell'NBA , il primo a raggiungere la cifra di 60.000 minuti e 40.000 punti nella regular season, oltre a essere il primo a raggiungere la cif… _(specifico)_ |
| **Lewis Hamilton** | 3 · sport | 1. Un pilota automobilistico britannico. _(ampio)_<br>2. Stevenage, Novecento: un pilota automobilistico britannico. _(ampio)_<br>3. Nasce a Stevenage il 7 gennaio 1985. _(specifico)_<br>4. Considerato uno dei migliori piloti di tutti i tempi, insieme a Michael Schumacher è il più vincente nella storia della Formula 1, con 7 titoli mondiali conquistati: nel 2008 co… _(specifico)_ |
| **Lionel Messi** | 3 · sport | 1. Un calciatore argentino, attaccante o centrocampista dell'Inter Miami. _(ampio)_<br>2. Rosario, Novecento: un calciatore argentino, attaccante o centrocampista dell'Inter Miami. _(ampio)_<br>3. Nasce a Rosario il 24 giugno 1987. _(specifico)_<br>4. Con la nazionale argentina è diventato campione del mondo nel 2022, vicecampione del mondo nel 2014 e nel 2026 e campione del Sud America nel 2021 e nel 2024. _(specifico)_ |
| **Marcell Jacobs** | 3 · sport | 1. Un velocista ed ex lunghista italiano con cittadinanza statunitense. _(ampio)_<br>2. El Paso, Novecento: un velocista ed ex lunghista italiano con cittadinanza statunitense. _(ampio)_<br>3. Nasce a El Paso il 26 settembre 1994. _(specifico)_<br>4. È inoltre l'attuale primatista europeo dei 100 metri piani, grazie al tempo di 9"80 corso in finale ai Giochi olimpici di Tokyo 2020, e dei 60 metri piani con il tempo di 6"41 c… _(specifico)_ |
| **Max Verstappen** | 3 · sport | 1. Un pilota automobilistico olandese. _(ampio)_<br>2. Hasselt, Novecento: un pilota automobilistico olandese. _(ampio)_<br>3. Nasce a Hasselt il 30 settembre 1997. _(specifico)_<br>4. Considerato uno dei migliori piloti della storia, ha debuttato in F1 nel 2015 al volante della Toro Rosso diventando il più giovane esordiente a prendere il via ad un Gran Premi… _(specifico)_ |
| **Michael Jordan** | 3 · sport | 1. Un imprenditore, ex cestista ed ex giocatore di baseball statunitense. _(ampio)_<br>2. New York, Novecento: un imprenditore, ex cestista ed ex giocatore di baseball statunitense. _(ampio)_<br>3. Nasce a New York il 17 febbraio 1963. _(specifico)_<br>4. Ha giocato 15 stagioni nella National Basketball Association tra il 1984 e il 2003, vincendo sei titoli NBA con i Chicago Bulls. _(specifico)_ |
| **Michael Schumacher** | 3 · sport | 1. Un ex pilota automobilistico tedesco. _(ampio)_<br>2. Hürth, Novecento: un ex pilota automobilistico tedesco. _(ampio)_<br>3. Nasce a Hürth il 3 gennaio 1969. _(specifico)_<br>4. Considerato uno dei migliori piloti automobilistici di tutti i tempi, insieme a Lewis Hamilton è il più vincente nella storia della Formula 1 con 7 titoli mondiali, i primi due… _(specifico)_ |
| **Neymar** | 3 · sport | 1. Un calciatore brasiliano, attaccante del Santos. _(ampio)_<br>2. Mogi das Cruzes, Novecento: un calciatore brasiliano, attaccante del Santos. _(ampio)_<br>3. Nasce a Mogi das Cruzes il 5 febbraio 1992. _(specifico)_<br>4. Soprannominato O Ney dai tifosi brasiliani per l'assonanza con O Rei, soprannome di Pelé, è stato cresciuto nelle giovanili del Santos, per poi venire promosso in prima squadra… _(specifico)_ |
| **Novak Djokovic** | 3 · sport | 1. Un tennista serbo. _(ampio)_<br>2. Belgrado, Novecento: un tennista serbo. _(ampio)_<br>3. Nasce a Belgrado il 22 maggio 1987. _(specifico)_<br>4. In virtù dei suoi primati, dei suoi record assoluti, dei titoli vinti e dello stile di gioco completo ed efficace su ogni superficie, è considerato uno dei più forti tennisti di… _(specifico)_ |
| **Paolo Maldini** | 3 · sport | 1. Un dirigente sportivo ed ex calciatore italiano, classe 1968. _(ampio)_<br>2. Milano, Novecento: un dirigente sportivo ed ex calciatore italiano. _(ampio)_<br>3. Nasce a Milano il 26 giugno 1968. _(specifico)_<br>4. È stato vicecampione del mondo nel 1994 e vicecampione d'Europa nel 2000 con la nazionale italiana. _(specifico)_ |
| **Rafael Nadal** | 3 · sport | 1. Un ex tennista spagnolo. _(ampio)_<br>2. Manacor, Novecento: un ex tennista spagnolo. _(ampio)_<br>3. Nasce a Manacor il 3 giugno 1986. _(specifico)_<br>4. In virtù dei record, dei titoli conseguiti e del completo repertorio di gioco, è riconosciuto come uno dei migliori tennisti di tutti i tempi, nonché uno dei più grandi atleti n… _(specifico)_ |
| **Roberto Baggio** | 3 · sport | 1. Un ex calciatore italiano, di ruolo attaccante o centrocampista, classe 1967. _(ampio)_<br>2. Caldogno, Novecento: un ex calciatore italiano, di ruolo attaccante o centrocampista. _(ampio)_<br>3. Nasce a Caldogno il 18 febbraio 1967. _(specifico)_<br>4. Con la nazionale italiana è stato vicecampione del mondo nel 1994. _(specifico)_ |
| **Roger Federer** | 3 · sport | 1. Un ex tennista svizzero. _(ampio)_<br>2. Basilea, Novecento: un ex tennista svizzero. _(ampio)_<br>3. Nasce a Basilea il 8 agosto 1981. _(specifico)_<br>4. Nello specifico, ha vinto 8 Wimbledon , 6 Australian Open, 5 US Open e 1 Roland Garros. _(specifico)_ |
| **Serena Williams** | 3 · sport | 1. Una tennista statunitense. _(ampio)_<br>2. Saginaw, Novecento: una tennista statunitense. _(ampio)_<br>3. Nasce a Saginaw il 26 settembre 1981. _(specifico)_<br>4. Può inoltre vantare cinque WTA Finals e 19 tornei di categoria Premier , oltre a 21 titoli Tier I e Tier II e alla medaglia d'oro conquistata alle Olimpiadi di Londra nel 2012 a… _(specifico)_ |
| **Simone Biles** | 3 · sport | 1. Una ginnasta statunitense, due volte campionessa olimpica all-around. _(ampio)_<br>2. Columbus, Novecento: una ginnasta statunitense, due volte campionessa olimpica all-around. _(ampio)_<br>3. Nasce a Columbus il 14 marzo 1997. _(specifico)_<br>4. È la ginnasta che ha conquistato più medaglie della storia ai Campionati del Mondo, avendo vinto 30 medaglie , nonché la più medagliata di sempre fra Mondiali e Olimpiadi, avend… _(specifico)_ |
| **Sofia Goggia** | 3 · sport | 1. Una sciatrice alpina italiana. _(ampio)_<br>2. Bergamo, Novecento: una sciatrice alpina italiana. _(ampio)_<br>3. Nasce a Bergamo il 15 novembre 1992. _(specifico)_<br>4. E' l'unica atleta nella storia a ottenere 3 medaglie olimpiche in discesa. _(specifico)_ |
| **Tadej Pogačar** | 3 · sport | 1. Un ciclista su strada sloveno. _(ampio)_<br>2. Komenda, Novecento: un ciclista su strada sloveno. _(ampio)_<br>3. Nasce a Komenda il 21 settembre 1998. _(specifico)_<br>4. Soprannominato Pogi, è professionista dal 2019. _(specifico)_ |
| **Usain Bolt** | 3 · sport | 1. Un ex velocista giamaicano, primatista mondiale dei 100 metri piani. _(ampio)_<br>2. Sherwood Content, Novecento: un ex velocista giamaicano, primatista mondiale dei 100 metri piani. _(ampio)_<br>3. Nasce a Sherwood Content il 21 agosto 1986. _(specifico)_<br>4. L'unico atleta nella storia ad avere vinto la medaglia d'oro nei 100 m piani e nei 200 m piani in tre edizioni consecutive dei Giochi olimpici , oltre che in tre diverse edizion… _(specifico)_ |
| **Valentino Rossi** | 3 · sport | 1. Un pilota automobilistico, dirigente sportivo ed ex pilota motociclistico italiano. _(ampio)_<br>2. Urbino, Novecento: un pilota automobilistico, dirigente sportivo ed ex pilota motociclistico italiano. _(ampio)_<br>3. Nasce a Urbino il 16 febbraio 1979. _(specifico)_<br>4. Considerato uno dei migliori piloti motociclistici di tutti i tempi, è tra i più vincenti nella storia del motociclismo, nonché l'unico pilota nella storia del motomondiale ad a… _(specifico)_ |
| **Zlatan Ibrahimović** | 3 · sport | 1. Un dirigente sportivo ed ex calciatore svedese. _(ampio)_<br>2. Malmö, Novecento: un dirigente sportivo ed ex calciatore svedese. _(ampio)_<br>3. Nasce a Malmö il 3 ottobre 1981. _(specifico)_<br>4. È stato inserito per undici volte tra i candidati alla vittoria del Pallone d'oro arrivando a ricoprire come massimo piazzamento in classifica la quarta posizione nel 2013 alle… _(specifico)_ |
| **Alfonso Signorini** | 3 · tv | 1. Un giornalista, conduttore televisivo. _(ampio)_<br>2. Milano, Novecento: un giornalista, conduttore televisivo. _(ampio)_<br>3. Nasce a Milano il 7 aprile 1964. _(specifico)_<br>4. È proprietario con Mondadori della Talent Agency, società da lui fondata e diretta, dedicata alla produzione televisiva e alla ricerca di talenti da inserire nel mondo televisiv… _(specifico)_ |
| **Amadeus** | 3 · tv | 1. Un conduttore televisivo, conduttore radiofonico. _(ampio)_<br>2. Ravenna, Novecento: un conduttore televisivo, conduttore radiofonico. _(ampio)_<br>3. Nasce a Ravenna il 4 settembre 1962. _(specifico)_<br>4. Esordisce negli anni 1980 a Radio Deejay, lanciato dal talent scout Claudio Cecchetto, in qualità di DJ, e si afferma successivamente come conduttore televisivo a partire dagli… _(specifico)_ |
| **Belén Rodríguez** | 3 · tv | 1. Una modella, conduttrice televisiva. _(ampio)_<br>2. Buenos Aires, Novecento: una modella, conduttrice televisiva. _(ampio)_<br>3. Nasce a Buenos Aires il 20 settembre 1984. _(specifico)_<br>4. una modella, conduttrice televisiva del 1984: la voce di Wikipedia ne racconta la storia. _(specifico)_ |
| **Carlo Conti** | 3 · tv | 1. Italian TV presenter. _(ampio)_<br>2. Cinquecento: Italian TV presenter. _(ampio)_<br>3. Nasce nel 1556. _(specifico)_<br>4. Cardinale italiano – compositore italiano – matematico italiano – politico svizzero – conduttore televisivo e radiofonico italiano. _(specifico)_ |
| **Federica Sciarelli** | 3 · tv | 1. Una giornalista e conduttrice televisiva italiana. _(ampio)_<br>2. Roma, Novecento: una giornalista e conduttrice televisiva italiana. _(ampio)_<br>3. Nasce a Roma il 9 ottobre 1958. _(specifico)_<br>4. una giornalista e conduttrice televisiva italiana del 1958: la voce di Wikipedia ne racconta la storia. _(specifico)_ |
| **Fiorello** | 3 · tv | 1. Uno showman, comico, cabarettista. _(ampio)_<br>2. Catania, Novecento: uno showman, comico, cabarettista. _(ampio)_<br>3. Nasce a Catania il 16 maggio 1960. _(specifico)_<br>4. uno showman, comico, cabarettista del 1960: la voce di Wikipedia ne racconta la storia. _(specifico)_ |
| **Gerry Scotti** | 3 · tv | 1. Un conduttore televisivo, conduttore radiofonico, classe 1956. _(ampio)_<br>2. Camporinaldo, Novecento: un conduttore televisivo, conduttore radiofonico. _(ampio)_<br>3. Nasce a Camporinaldo il 7 agosto 1956. _(specifico)_<br>4. È considerato uno dei volti più noti di Mediaset, insieme a Paolo Bonolis e Maria De Filippi. _(specifico)_ |
| **Ilary Blasi** | 3 · tv | 1. Una conduttrice televisiva, showgirl ed ex modella italiana. _(ampio)_<br>2. Roma, Novecento: una conduttrice televisiva, showgirl ed ex modella italiana. _(ampio)_<br>3. Nasce a Roma il 28 aprile 1981. _(specifico)_<br>4. una conduttrice televisiva, showgirl ed ex modella italiana del 1981: la voce di Wikipedia ne racconta la storia. _(specifico)_ |
| **Maria De Filippi** | 3 · tv | 1. Una conduttrice televisiva, autrice televisiva e produttrice televisiva italiana. _(ampio)_<br>2. Milano, Novecento: una conduttrice televisiva, autrice televisiva e produttrice televisiva italiana. _(ampio)_<br>3. Nasce a Milano il 5 dicembre 1961. _(specifico)_<br>4. Attiva in televisione dal 1992, quando ha cominciato a lavorare per Canale 5 conducendo il talk show pomeridiano Amici, ha consolidato la sua notorietà negli anni successivi pre… _(specifico)_ |
| **Milly Carlucci** | 3 · tv | 1. Una conduttrice televisiva, autrice televisiva ed ex attrice italiana. _(ampio)_<br>2. Sulmona, Novecento: una conduttrice televisiva, autrice televisiva ed ex attrice italiana. _(ampio)_<br>3. Nasce a Sulmona il 1 ottobre 1954. _(specifico)_<br>4. Attiva sul piccolo schermo sin dalla fine degli anni settanta, durante il decennio seguente diventa conosciuta al pubblico come showgirl e conduttrice di numerosi programmi tele… _(specifico)_ |
| **Paolo Bonolis** | 3 · tv | 1. Un conduttore televisivo, showman e autore televisivo italiano. _(ampio)_<br>2. Roma, Novecento: un conduttore televisivo, showman e autore televisivo italiano. _(ampio)_<br>3. Nasce a Roma il 14 giugno 1961. _(specifico)_<br>4. Insieme all'amico e collega Luca Laurenti, con il quale collabora dal 1991, forma una delle coppie più longeve e apprezzate della televisione italiana. _(specifico)_ |
| **Pippo Baudo** | 3 · tv | 1. Un conduttore televisivo. _(ampio)_<br>2. Militello in Val di Catania, Novecento: un conduttore televisivo. _(ampio)_<br>3. Nasce a Militello in Val di Catania il 7 giugno 1936. _(specifico)_<br>4. Considerato uno dei volti più iconici della televisione italiana, ha legato gran parte della sua carriera alla Rai, conducendo numerosi programmi di intrattenimento e tredici ed… _(specifico)_ |
| **Stefano De Martino** | 3 · tv | 1. Un conduttore televisivo e ballerino italiano. _(ampio)_<br>2. Torre del Greco, Novecento: un conduttore televisivo e ballerino italiano. _(ampio)_<br>3. Nasce a Torre del Greco il 3 ottobre 1989. _(specifico)_<br>4. un conduttore televisivo e ballerino italiano del 1989: la voce di Wikipedia ne racconta la storia. _(specifico)_ |
| **Alessandro Borghi** | 3 · cinema | 1. Un attore italiano. _(ampio)_<br>2. Roma, Novecento: un attore italiano. _(ampio)_<br>3. Nasce a Roma il 19 settembre 1986. _(specifico)_<br>4. un attore italiano del 1986: la voce di Wikipedia ne racconta la storia. _(specifico)_ |

### Persone non risolte (0)

Nessuna.

<!-- CELEBRITA-INDIZI:FINE -->
