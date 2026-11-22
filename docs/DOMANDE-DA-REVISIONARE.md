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
| Numero secco del Casino | **deciso il 23 novembre 2026: tre girate**, come colore e dozzina; se nessuno becca il numero, quella girata non paga nessuno | nessuna conferma: allineato a `casino-bonus.component.ts` |
| Finestra di scelta dei bonus | 10 secondi, si chiude prima se tutti hanno scelto | conferma della durata |
| Premi di Blackjack e Cavallo | gestiti da barista e presentatore, fuori dall'app | concordare premi e consegna in sala |
| Distrattori delle banche | corretti: l'audit non segnala più risposte più lunghe né distrattori troppo corti | rileggere le 47 opzioni riscritte con il pubblico davanti |
| Copertura di Ultima spiaggia | **cinque fasce reali** (facile, medio-facile, media, medio-difficile, difficile), una domanda dedicata per categoria e livello: 0 combinazioni scoperte; nessun ripiego su un'altra fascia | rileggere in sala le 80 riclassificazioni elencate sotto |
| Versione | 2.2.0 | conferma prima del rilascio |

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
| Ruota (frasi in `QuestionBankService.PROVERBS`) | 32 frasi, 2 occorrenze in serata | 0 | 0: nessuna frase sotto le tre parole o con numeri | 32 frasi bastano per due occorrenze, non per ripetere la stessa serata: valutarne altre |
| Bomba (`bomba-it.json`) | **110 affermazioni (62 vere, 48 false)**, 11 categorie da 9 a 10 | 0 | 0 campi mancanti: ogni riga ha id, categoria, booleano e fonte | 8 coppie in cui il nome cambiato ha tre o più parole: rivedute a mano, nessun fatto da correggere (elenco sotto) |

### Musica: anno completato

| Brano | Artista | Anno | Fonte |
| --- | --- | --- | --- |
| Boulevard of Broken Dreams | Green Day | **2004** | <https://it.wikipedia.org/wiki/Boulevard_of_Broken_Dreams> |

L'anno è stato scritto in `apps/backend/src/main/resources/questions/media-it.json`,
che **non è tracciato da git** (contiene i media veri): la correzione vive sul
computer del server e va rifatta se la banca si rigenera da zero con
`generate_media.py`. Con l'anno presente l'audit dà **0 campi mancanti** su
Musica.

### Bomba: coppie rivedute a mano

L'audit misura la distanza in parole dalla vera più vicina della stessa
categoria: con un nome di tre o più parole la distanza supera 2 anche quando è
cambiato **un solo dettaglio**. Le otto coppie rimaste sono state confrontate a
mano: in ognuna cambia un solo elemento e non c'è nulla da correggere. Le quattro
coppie che mancavano davvero sono state completate con una vera e la fonte
(Torre Eiffel 1889, ragni non insetti, violino a quattro corde, Titanic di
Cameron), più sei affermazioni nuove per portare ogni categoria ad almeno nove
righe: 95 → **110**.

| ID | Frase falsa | Vera corrispondente | Esito |
| --- | --- | --- | --- |
| `bomba-natura-04` | La rondine è l'animale più veloce in volo. | Il falco pellegrino è l'animale più veloce in volo. | cambiato solo l'animale: ok |
| `bomba-natura-06` | Lo squalo balena è il più grande animale esistente. | La balenottera azzurra è il più grande animale esistente. | cambiato solo l'animale: ok |
| `bomba-cinema-04` | Il padrino è diretto da Martin Scorsese. | Il padrino è diretto da Francis Ford Coppola. | cambiato solo il regista: ok |
| `bomba-musica-06` | Mozart compose La Traviata. | Mozart compose Le nozze di Figaro. | cambiata solo l'opera: ok |
| `bomba-arte-02` | La Gioconda è di Raffaello. | La Gioconda è di Leonardo da Vinci. | cambiato solo l'autore: ok |
| `bomba-tecnologia-02` | Il World Wide Web fu proposto da Bill Gates. | Il World Wide Web fu proposto da Tim Berners-Lee. | cambiato solo il nome: ok |
| `bomba-tecnologia-08` | La sigla CPU indica la memoria di massa. | La sigla CPU indica l'unità centrale di elaborazione. | cambiata solo la definizione: ok |
| `bomba-letteratura-08` | Il Gattopardo è di Leonardo Sciascia. | Il Gattopardo è di Giuseppe Tomasi di Lampedusa. | cambiato solo l'autore: ok |

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
