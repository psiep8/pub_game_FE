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

Restano 178 eventi con il collegamento di ricerca: non sono fonti precise.

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
