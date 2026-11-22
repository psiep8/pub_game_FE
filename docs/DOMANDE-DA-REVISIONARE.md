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
| Musica (`media-it.json`, music) | 114 brani, 5 occorrenze in serata | 0 | **1 campo mancante**: `year` vuoto per «Boulevard of Broken Dreams» | l'anno va aggiunto con la fonte (vedi sotto) |
| Ruota (frasi in `QuestionBankService.PROVERBS`) | 32 frasi, 2 occorrenze in serata | 0 | 0: nessuna frase sotto le tre parole o con numeri | 32 frasi bastano per due occorrenze, non per ripetere la stessa serata: valutarne altre |
| Bomba (`bomba-it.json`) | 95 affermazioni (50 vere, 45 false), 11 categorie da 7 a 10 affermazioni | 0 | 0 campi mancanti: ogni riga ha id, categoria, booleano e fonte | **11 false** in cui il controllo «un solo dettaglio cambiato» non trova una vera abbastanza vicina (elenco sotto) |

### Musica: anno da completare

| Brano | Artista | Campo | Cosa serve |
| --- | --- | --- | --- |
| Boulevard of Broken Dreams | Green Day | `year` vuoto | anno di pubblicazione con la fonte, da inserire in `media-it.json` |

### Bomba: false da leggere a mano

Il controllo automatico misura la distanza in parole dalla vera più vicina
della stessa categoria: se è maggiore di 2 non può garantire che sia cambiato
**un solo dettaglio**. Non significa che la frase sia sbagliata, solo che la
coppia vera/falsa va confrontata a mano (o che manca la vera corrispondente).

| ID | Frase falsa | Perché è in elenco |
| --- | --- | --- |
| `bomba-natura-04` | La rondine è l'animale più veloce in volo. | la vera vicina nomina il falco pellegrino: il dettaglio cambiato è l'animale, non un numero |
| `bomba-natura-06` | Lo squalo balena è il più grande animale esistente. | stessa struttura, soggetto diverso dalla vera |
| `bomba-natura-08` | I ragni sono insetti. | la vera vicina parla di otto zampe: manca la vera «i ragni non sono insetti» |
| `bomba-cinema-04` | Il padrino è diretto da Martin Scorsese. | un solo nome cambiato, ma la distanza in parole è 3 |
| `bomba-musica-06` | Mozart compose La Traviata. | il titolo cambiato è di più parole del titolo vero |
| `bomba-musica-08` | Il violino ha cinque corde. | la vera vicina cambia anche lo strumento |
| `bomba-arte-02` | La Gioconda è di Raffaello. | un solo nome cambiato, distanza 3 |
| `bomba-arte-08` | La Torre Eiffel fu inaugurata nel 1900. | non c'è una vera sulla Torre Eiffel: la più vicina è la Gioconda |
| `bomba-tecnologia-02` | Il World Wide Web fu proposto da Bill Gates. | nome cambiato, distanza 3 |
| `bomba-tecnologia-08` | La sigla CPU indica la memoria di massa. | la vera cambia la definizione con più parole |
| `bomba-letteratura-08` | Il Gattopardo è di Leonardo Sciascia. | manca la vera sullo stesso libro |

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

## Fatti da verificare

_(nessuno: ogni evento Timeline aggiunto porta la sua fonte nel campo `source`;
le voci senza fonte sicura non sono state inserite)_
