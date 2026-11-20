# Audit delle banche domande

Generato da `node scripts/audit-banche.mjs --write`. Non modifica le banche:
elenca ciò che va corretto a mano e i buchi di copertura.

## Quiz, Arena, Tennis, Cavallo

| Tipo | Domande |
| --- | --- |
| IMAGE_BLUR | 6 |
| QUIZ | 533 |
| TENNIS_BATTLE | 30 |
| TRUE_FALSE | 422 |

| Difficoltà | Domande |
| --- | --- |
| difficile | 332 |
| facile | 329 |
| medio | 330 |

### Posizione della risposta corretta

| Categoria | A | B | C | D |
| --- | --- | --- | --- | --- |
| Storia | 6 | 6 | 8 | 5 |
| Geografia e Viaggi | 13 | 6 | 7 | 14 |
| Scienza e Spazio | 9 | 7 | 10 | 10 |
| Natura e Animali | 4 | 14 | 8 | 7 |
| Sport | 4 | 6 | 7 | 10 |
| Cinema, Serie TV | 11 | 17 | 8 | 5 |
| TV e Spettacolo | 11 | 5 | 10 | 8 |
| Musica | 6 | 8 | 6 | 5 |
| Arte e Architettura | 2 | 12 | 12 | 10 |
| Politica e Attualità | 8 | 12 | 8 | 11 |
| Motori | 8 | 6 | 5 | 6 |
| Cibo e Gastronomia | 6 | 8 | 13 | 11 |
| Lingua e Letteratura | 9 | 9 | 10 | 9 |
| Anime e manga | 10 | 7 | 9 | 9 |
| Gaming e Tecnologia | 9 | 12 | 11 | 4 |
| Curiosità | 36 | 9 | 2 | 9 |

### Doppioni (9)

| Tipo | Domanda | Prima occorrenza |
| --- | --- | --- |
| testo | `quiz-gaming-17` Quale console Nintendo è uscita nel 2017? | quiz-gaming-02 |
| testo+risposta | `tf-curiosita-02` Il polpo ha tre cuori. | tf-natura-16 |
| testo | `quiz-geografia-viaggi-04` In quale città si trova il Colosseo? | quiz-arte-12 |
| testo+risposta | `ah-medium-11` Qual è la capitale della Francia? | quiz-geografia-02 |
| testo+risposta | `ah-medium-12` Chi ha dipinto la Gioconda? | quiz-arte-01 |
| testo+risposta | `ah-medium-16` Chi ha scritto la Divina Commedia? | quiz-lingua-06 |
| testo+risposta | `ah-medium-20` In che anno è caduto il Muro di Berlino? | quiz-storia-11 |
| testo+risposta | `ah-hard-21` Qual è la capitale dell'Australia? | quiz-geografia-01 |
| testo+risposta | `ah-hard-25` Chi ha scritto 1984? | quiz-lingua-08 |

### Segnalazioni (51)

| Controllo | Domanda | Dettaglio |
| --- | --- | --- |
| indizio di forma: risposta più lunga | `quiz-storia-04` | Quale condottiero francese fu sconfitto nella battaglia di Waterloo? |
| indizio di forma: risposta più lunga | `quiz-storia-09` | Chi fu il primo re dell'Italia unita nel 1861? |
| indizio di forma: risposta più lunga | `quiz-storia-22` | Quale città fu capitale dell'Impero bizantino? |
| indizio di forma: risposta più lunga | `quiz-geografia-07` | Quale stretto separa l'Europa dall'Africa? |
| indizio di forma: risposta più lunga | `quiz-geografia-10` | Quale Stato è il più piccolo del mondo? |
| indizio di forma: risposta più lunga | `quiz-scienza-05` | Quale gas assorbono le piante durante la fotosintesi? |
| indizio di forma: risposta più lunga | `quiz-scienza-26` | Chi propose il modello eliocentrico nel Cinquecento? |
| indizio di forma: risposta più lunga | `quiz-natura-14` | Quale albero produce il sughero? |
| indizio di forma: risposta più lunga | `quiz-natura-20` | Quali organismi costruiscono le barriere coralline? |
| indizio di forma: risposta più lunga | `quiz-natura-23` | Quale felino vive ad alta quota sull'Himalaya? |
| indizio di forma: risposta più lunga | `quiz-natura-24` | Quale organo permette ai serpenti di percepire il calore? |
| indizio di forma: risposta più lunga | `quiz-sport-23` | Quale città ha ospitato i Giochi olimpici estivi del 1992? |
| indizio di forma: risposta più lunga | `quiz-cinema-08` | Quale serie è ambientata nel continente di Westeros? |
| indizio di forma: risposta più lunga | `quiz-cinema-12` | Quale film Pixar racconta la storia di un pesce pagliaccio? |
| indizio di forma: risposta più lunga | `quiz-cinema-27` | Quale film di Kubrick è tratto da un romanzo di Anthony Burgess? |
| indizio di forma: risposta più lunga | `quiz-cinema-32` | Quale serie distopica è tratta da un romanzo di Margaret Atwood? |
| indizio di forma: risposta più lunga | `quiz-tv-01` | Quale quiz storico conduceva Mike Bongiorno chiedendo di lasciare o raddoppiare? |
| indizio di forma: risposta più lunga | `quiz-tv-07` | Quale programma politico conduce Bruno Vespa? |
| indizio di forma: risposta più lunga | `quiz-tv-19` | Quale serie televisiva è ambientata a Westeros? |
| indizio di forma: risposta più lunga | `quiz-tv-22` | Quale serie italiana ha come protagonista un commissario interpretato da Luca Zingaretti? |
| indizio di forma: risposta più lunga | `quiz-tv-23` | Quale show di Rai 1 mette in gara personaggi famosi nel ballo? |
| indizio di forma: risposta più lunga | `quiz-tv-24` | Quale serie spagnola di Netflix racconta una rapina alla Zecca? |
| indizio di forma: risposta più lunga | `quiz-musica-09` | Quale album dei Pink Floyd ha in copertina un prisma che scompone la luce? |
| indizio di forma: risposta più lunga | `quiz-arte-25` | Quale palazzo di Vicenza è opera di Andrea Palladio? |
| indizio di forma: risposta più lunga | `quiz-motori-01` | Quale casa automobilistica produce la Golf? |
| indizio di forma: risposta più lunga | `quiz-cibo-23` | Quale formaggio a pasta filata è tipico della Campania? |
| indizio di forma: risposta più lunga | `quiz-cibo-24` | In quale regione spagnola si produce il vino Rioja? |
| la domanda contiene la risposta | `quiz-lingua-01` | Quale articolo determinativo maschile singolare si usa davanti a una parola che inizia per vocale? |
| indizio di forma: risposta più lunga | `quiz-lingua-02` | Quale figura retorica è contenuta nell'espressione il mare ride? |
| indizio di forma: risposta più lunga | `quiz-lingua-14` | Quale segno di punteggiatura chiude una domanda? |
| indizio di forma: risposta più lunga | `quiz-lingua-22` | Chi ha scritto Il Gattopardo? |
| indizio di forma: risposta più lunga | `quiz-anime-09` | Quale film Ghibli racconta la storia di Totoro? |
| indizio di forma: risposta più lunga | `quiz-anime-15` | Come si chiama il protagonista di One Piece? |
| indizio di forma: risposta più lunga | `quiz-anime-24` | Quale anime ha come protagonisti Edward e Alphonse Elric? |
| indizio di forma: risposta più lunga | `quiz-gaming-13` | Quale azienda ha sviluppato Windows? |
| indizio di forma: risposta più lunga | `quiz-gaming-17` | Quale console Nintendo è uscita nel 2017? |
| distrattore troppo corto | `quiz-gaming-18` | C# |
| indizio di forma: risposta più lunga | `quiz-curiosita-01` | Qual è l'animale più veloce in volo? |
| indizio di forma: risposta più lunga | `quiz-scienza-spazio-04` | Qual è la stella più vicina alla Terra dopo il Sole? |
| indizio di forma: risposta più lunga | `quiz-cibo-gastronomia-08` | Quale strumento controlla la temperatura interna degli alimenti in cottura? |
| indizio di forma: risposta più lunga | `quiz-politica-attualità-10` | Quale indice diffuso dall'ISTAT misura il costo della vita? |
| indizio di forma: risposta più lunga | `quiz-cinema-serie-tv-03` | Quale serie racconta un gruppo di ragazzi in una cittadina con un mondo parallelo? |
| indizio di forma: risposta più lunga | `quiz-cinema-serie-tv-07` | Quale serie spagnola racconta una banda con le maschere di Dalí? |
| indizio di forma: risposta più lunga | `quiz-tv-spettacolo-06` | Quale drammaturgo napoletano è autore di Filumena Marturano? |
| indizio di forma: risposta più lunga | `quiz-anime-anime-01` | Quale anime del 1995 è stato diretto da Hideaki Anno? |
| indizio di forma: risposta più lunga | `quiz-anime-manga-04` | Su quale rivista giapponese viene pubblicato One Piece? |
| indizio di forma: risposta più lunga | `quiz-gaming-gaming-01` | Quale gioco è ambientato nel regno di Hyrule? |
| indizio di forma: risposta più lunga | `quiz-gaming-tecnologia-03` | Quale memoria conserva i dati anche senza alimentazione? |
| indizio di forma: risposta più lunga | `ah-medium-16` | Chi ha scritto la Divina Commedia? |
| indizio di forma: risposta più lunga | `ah-hard-22` | Chi ha composto la Nona Sinfonia? |
| indizio di forma: risposta più lunga | `ah-hard-30` | Qual è il deserto più grande del mondo? |

## Timeline

Eventi: **113** (servono almeno 24 per tre round da 8).

| Categoria | Eventi | Round coperti |
| --- | --- | --- |
| Anime e manga | 8 | 1 |
| Arte e Architettura | 8 | 1 |
| Cibo e Gastronomia | 8 | 1 |
| Cinema, Serie TV | 8 | 1 |
| Gaming e Tecnologia | 8 | 1 |
| Geografia e Viaggi | 8 | 1 |
| Lingua e Letteratura | 8 | 1 |
| Motori | 8 | 1 |
| Musica | 8 | 1 |
| Politica e Attualità | 8 | 1 |
| Scienza e Spazio | 9 | 1.1 |
| Sport | 8 | 1 |
| Storia | 8 | 1 |
| TV e Spettacolo | 8 | 1 |

| Difficoltà | Eventi |
| --- | --- |
| (assente) | 113 |

### Campi mancanti (226)

| Evento | Campo |
| --- | --- |
| Caduta dell'Impero romano d'Occidente | difficulty |
| Caduta dell'Impero romano d'Occidente | source |
| Incoronazione di Carlo Magno | difficulty |
| Incoronazione di Carlo Magno | source |
| Battaglia di Hastings | difficulty |
| Battaglia di Hastings | source |
| Scoperta dell'America | difficulty |
| Scoperta dell'America | source |
| Rivoluzione francese | difficulty |
| Rivoluzione francese | source |
| Congresso di Vienna | difficulty |
| Congresso di Vienna | source |
| Inizio della Prima guerra mondiale | difficulty |
| Inizio della Prima guerra mondiale | source |
| Caduta del Muro di Berlino | difficulty |
| Caduta del Muro di Berlino | source |
| Vasco da Gama arriva in India | difficulty |
| Vasco da Gama arriva in India | source |
| Apertura del Canale di Suez | difficulty |
| Apertura del Canale di Suez | source |
| Naufragio del Titanic | difficulty |
| Naufragio del Titanic | source |
| Primo volo transatlantico senza scalo | difficulty |
| Primo volo transatlantico senza scalo | source |
| Amelia Earhart attraversa l'Atlantico in solitaria | difficulty |
| Amelia Earhart attraversa l'Atlantico in solitaria | source |
| Hillary e Tenzing raggiungono l'Everest | difficulty |
| Hillary e Tenzing raggiungono l'Everest | source |
| Apertura del Tunnel della Manica | difficulty |
| Apertura del Tunnel della Manica | source |
| La nave Ever Given blocca il Canale di Suez | difficulty |
| La nave Ever Given blocca il Canale di Suez | source |
| Copernico pubblica le rivoluzioni celesti | difficulty |
| Copernico pubblica le rivoluzioni celesti | source |
| Newton pubblica i Principia | difficulty |
| Newton pubblica i Principia | source |
| Einstein pubblica la relatività ristretta | difficulty |
| Einstein pubblica la relatività ristretta | source |
| Scoperta della penicillina | difficulty |
| Scoperta della penicillina | source |
| Scoperta della struttura del DNA | difficulty |
| Scoperta della struttura del DNA | source |
| Lancio dello Sputnik | difficulty |
| Lancio dello Sputnik | source |
| Sbarco dell'uomo sulla Luna | difficulty |
| Sbarco dell'uomo sulla Luna | source |
| Conferma del bosone di Higgs | difficulty |
| Conferma del bosone di Higgs | source |
| Inizio della pandemia di COVID-19 | difficulty |
| Inizio della pandemia di COVID-19 | source |
| Prime Olimpiadi moderne ad Atene | difficulty |
| Prime Olimpiadi moderne ad Atene | source |
| Primo Tour de France | difficulty |
| Primo Tour de France | source |
| Primo Mondiale di calcio in Uruguay | difficulty |
| Primo Mondiale di calcio in Uruguay | source |
| Jesse Owens vince quattro ori a Berlino | difficulty |
| Jesse Owens vince quattro ori a Berlino | source |
| Olimpiadi di Roma | difficulty |
| Olimpiadi di Roma | source |

…e altre 166 righe.

### Anni troppo vicini (< 3 anni)

| Primo | Secondo | Distanza |
| --- | --- | --- |
| Rivoluzione francese | Dichiarazione dei diritti dell'uomo e del cittadino | 0 |
| Karl Benz brevetta la prima automobile a motore | Nasce la Coca-Cola | 0 |
| Inaugurazione della Torre Eiffel | La pizza Margherita viene servita a Napoli | 0 |
| Prima proiezione cinematografica dei fratelli Lumière | Prime Olimpiadi moderne ad Atene | 1 |
| Primo Tour de France | Einstein pubblica la relatività ristretta | 2 |
| Einstein pubblica la relatività ristretta | Nasce il cubismo con Les Demoiselles d'Avignon | 2 |
| Nasce il cubismo con Les Demoiselles d'Avignon | Ford lancia il Model T | 1 |
| Naufragio del Titanic | Pubblicato La strada di Swann di Proust | 1 |
| Pubblicato La strada di Swann di Proust | Inizio della Prima guerra mondiale | 1 |
| Esce Il cantante di jazz, primo film sonoro | Scoperta della penicillina | 1 |
| Scoperta della penicillina | Apre il Museum of Modern Art di New York | 1 |
| Apre il Museum of Modern Art di New York | Primo Mondiale di calcio in Uruguay | 1 |
| Primo Mondiale di calcio in Uruguay | Amelia Earhart attraversa l'Atlantico in solitaria | 2 |
| Jesse Owens vince quattro ori a Berlino | Biancaneve e i sette nani, primo lungometraggio animato Disney | 1 |
| Biancaneve e i sette nani, primo lungometraggio animato Disney | Picasso dipinge Guernica | 0 |
| Fondazione delle Nazioni Unite | ENIAC, primo computer elettronico general-purpose | 1 |
| ENIAC, primo computer elettronico general-purpose | Entrata in vigore della Costituzione italiana | 2 |
| Entrata in vigore della Costituzione italiana | Pubblicato 1984 di Orwell | 1 |
| Pubblicato 1984 di Orwell | Primo campionato mondiale di Formula 1 | 1 |
| Primo campionato mondiale di Formula 1 | Prima edizione del Festival di Sanremo | 1 |
| Prima edizione del Festival di Sanremo | Inizia il manga Astro Boy | 1 |
| Inizia il manga Astro Boy | Hillary e Tenzing raggiungono l'Everest | 1 |
| Hillary e Tenzing raggiungono l'Everest | Scoperta della struttura del DNA | 0 |
| Scoperta della struttura del DNA | Inizio delle trasmissioni Rai | 1 |
| Inizio delle trasmissioni Rai | Elvis Presley incide That's All Right | 0 |
| Elvis Presley incide That's All Right | Pubblicato Lolita di Nabokov | 1 |
| Pubblicato Lolita di Nabokov | Lancio dello Sputnik | 2 |
| Lancio dello Sputnik | Momofuku Ando inventa i noodles istantanei | 1 |
| Momofuku Ando inventa i noodles istantanei | Tennis for Two, primo videogioco | 0 |
| Tennis for Two, primo videogioco | Olimpiadi di Roma | 2 |
| Olimpiadi di Roma | I Beatles pubblicano Love Me Do | 2 |
| I Beatles pubblicano Love Me Do | Debutta l'anime Astro Boy | 1 |
| Esce Sgt. Pepper's Lonely Hearts Club Band | Sbarco dell'uomo sulla Luna | 2 |
| Sbarco dell'uomo sulla Luna | Inizia il manga Doraemon | 0 |
| Inizia il manga Doraemon | Primo collegamento ARPANET | 0 |
| Primo collegamento ARPANET | Apre il primo Starbucks a Seattle | 2 |
| Apre il primo Starbucks a Seattle | Atari lancia Pong | 1 |
| Atari lancia Pong | Inaugura la Sydney Opera House | 1 |
| Inaugura la Sydney Opera House | Debutta la Volkswagen Golf | 1 |
| Nasce CNN | Nasce MTV | 1 |
| Nasce MTV | Nintendo pubblica Mario Bros. | 2 |
| Nintendo pubblica Mario Bros. | Inizia il manga Dragon Ball | 1 |
| Inizia il manga Dragon Ball | Live Aid | 1 |
| Live Aid | Fondazione dello Studio Ghibli | 0 |
| Fondazione dello Studio Ghibli | Nasce il movimento Slow Food a Bra | 1 |
| Caduta del Muro di Berlino | Debutta I Simpson | 0 |
| Debutta I Simpson | Tim Berners-Lee presenta il World Wide Web | 2 |
| Tim Berners-Lee presenta il World Wide Web | Il Dream Team vince l'oro olimpico | 1 |
| Il Dream Team vince l'oro olimpico | Trattato di Maastricht | 0 |
| Trattato di Maastricht | Apertura del Tunnel della Manica | 2 |
| Toyota lancia la Prius | Pubblicato Harry Potter e la pietra filosofale | 0 |
| Pubblicato Harry Potter e la pietra filosofale | Inizia il manga One Piece | 0 |
| Inizia il manga One Piece | Esce Matrix | 2 |
| Esce Matrix | Inizia il manga Naruto | 0 |
| Inizia il manga Naruto | Apple lancia l'iTunes Store | 2 |
| Apple lancia l'iTunes Store | Attentato alle Torri Gemelle | 0 |
| Attentato alle Torri Gemelle | La città incantata vince l'Orso d'oro | 0 |
| La città incantata vince l'Orso d'oro | Nasce Sky Italia | 2 |
| Netflix lancia lo streaming | Apple presenta il primo iPhone | 0 |
| Apple presenta il primo iPhone | Usain Bolt stabilisce il record dei 100 metri | 1 |
| Usain Bolt stabilisce il record dei 100 metri | Esce Avatar | 1 |
| Esce Avatar | La dieta mediterranea entra nel patrimonio UNESCO | 1 |
| La dieta mediterranea entra nel patrimonio UNESCO | Conferma del bosone di Higgs | 2 |
| Conferma del bosone di Higgs | Tesla lancia il Model S | 0 |
| Tesla lancia il Model S | House of Cards, prima serie originale Netflix | 1 |
| L'arte del pizzaiolo napoletano entra nel patrimonio UNESCO | Nintendo lancia Switch | 0 |
| Nintendo lancia Switch | Parasite vince la Palma d'Oro | 2 |
| Parasite vince la Palma d'Oro | Inizio della pandemia di COVID-19 | 1 |
| Inizio della pandemia di COVID-19 | Uscita del Regno Unito dall'Unione Europea | 0 |
| Uscita del Regno Unito dall'Unione Europea | La nave Ever Given blocca il Canale di Suez | 1 |
| La nave Ever Given blocca il Canale di Suez | L'Italia vince il Campionato europeo di calcio | 0 |
| L'Italia vince il Campionato europeo di calcio | Max Verstappen vince il mondiale di Formula 1 | 0 |

## Azzardo

| Categoria | Livello 1 | Livello 2 | Livello 3 |
| --- | --- | --- | --- |
| CANZONI | 30 | 30 | 30 |
| CELEBRITÀ | 30 | 30 | 30 |
| PAESI | 30 | 30 | 30 |
| STORIA | 30 | 30 | 30 |

## Ultima spiaggia (minimo 12 domande per categoria e livello)

| Categoria | Livello 1 (100) | Livello 2 (200) | Livello 3 (300) | Livello 4 (400) | Livello 5 (500) |
| --- | --- | --- | --- | --- | --- |
| Anime e manga | 5 | 5 | 6 | 6 | 13 |
| Arte e Architettura | 4 | 4 | 7 | 7 | 13 |
| Cibo e Gastronomia | 6 | 6 | 7 | 7 | 12 |
| Cinema, Serie TV | 6 | 6 | 7 | 7 | 14 |
| Curiosità | 4 | 4 | 4 | 4 | 9 |
| Gaming e Tecnologia | 5 | 5 | 5 | 5 | 14 |
| Geografia e Viaggi | 6 | 6 | 7 | 7 | 14 |
| Lingua e Letteratura | 5 | 5 | 7 | 7 | 13 |
| Motori | 4 | 4 | 4 | 4 | 9 |
| Musica | 4 | 4 | 4 | 4 | 9 |
| Natura e Animali | 5 | 5 | 4 | 4 | 15 |
| Politica e Attualità | 5 | 5 | 7 | 7 | 14 |
| Scienza e Spazio | 6 | 6 | 6 | 6 | 12 |
| Sport | 4 | 4 | 5 | 5 | 9 |
| Storia | 3 | 3 | 4 | 4 | 9 |
| TV e Spettacolo | 5 | 5 | 6 | 6 | 12 |

Buchi: **69**.

| Categoria | Livello | Fascia | Capienza |
| --- | --- | --- | --- |
| Anime e manga | 1 | facile | 5 |
| Anime e manga | 2 | facile | 5 |
| Anime e manga | 3 | medio | 6 |
| Anime e manga | 4 | medio | 6 |
| Arte e Architettura | 1 | facile | 4 |
| Arte e Architettura | 2 | facile | 4 |
| Arte e Architettura | 3 | medio | 7 |
| Arte e Architettura | 4 | medio | 7 |
| Cibo e Gastronomia | 1 | facile | 6 |
| Cibo e Gastronomia | 2 | facile | 6 |
| Cibo e Gastronomia | 3 | medio | 7 |
| Cibo e Gastronomia | 4 | medio | 7 |
| Cinema, Serie TV | 1 | facile | 6 |
| Cinema, Serie TV | 2 | facile | 6 |
| Cinema, Serie TV | 3 | medio | 7 |
| Cinema, Serie TV | 4 | medio | 7 |
| Curiosità | 1 | facile | 4 |
| Curiosità | 2 | facile | 4 |
| Curiosità | 3 | medio | 4 |
| Curiosità | 4 | medio | 4 |
| Curiosità | 5 | difficile | 9 |
| Gaming e Tecnologia | 1 | facile | 5 |
| Gaming e Tecnologia | 2 | facile | 5 |
| Gaming e Tecnologia | 3 | medio | 5 |
| Gaming e Tecnologia | 4 | medio | 5 |
| Geografia e Viaggi | 1 | facile | 6 |
| Geografia e Viaggi | 2 | facile | 6 |
| Geografia e Viaggi | 3 | medio | 7 |
| Geografia e Viaggi | 4 | medio | 7 |
| Lingua e Letteratura | 1 | facile | 5 |
| Lingua e Letteratura | 2 | facile | 5 |
| Lingua e Letteratura | 3 | medio | 7 |
| Lingua e Letteratura | 4 | medio | 7 |
| Motori | 1 | facile | 4 |
| Motori | 2 | facile | 4 |
| Motori | 3 | medio | 4 |
| Motori | 4 | medio | 4 |
| Motori | 5 | difficile | 9 |
| Musica | 1 | facile | 4 |
| Musica | 2 | facile | 4 |
| Musica | 3 | medio | 4 |
| Musica | 4 | medio | 4 |
| Musica | 5 | difficile | 9 |
| Natura e Animali | 1 | facile | 5 |
| Natura e Animali | 2 | facile | 5 |
| Natura e Animali | 3 | medio | 4 |
| Natura e Animali | 4 | medio | 4 |
| Politica e Attualità | 1 | facile | 5 |
| Politica e Attualità | 2 | facile | 5 |
| Politica e Attualità | 3 | medio | 7 |
| Politica e Attualità | 4 | medio | 7 |
| Scienza e Spazio | 1 | facile | 6 |
| Scienza e Spazio | 2 | facile | 6 |
| Scienza e Spazio | 3 | medio | 6 |
| Scienza e Spazio | 4 | medio | 6 |
| Sport | 1 | facile | 4 |
| Sport | 2 | facile | 4 |
| Sport | 3 | medio | 5 |
| Sport | 4 | medio | 5 |
| Sport | 5 | difficile | 9 |
| Storia | 1 | facile | 3 |
| Storia | 2 | facile | 3 |
| Storia | 3 | medio | 4 |
| Storia | 4 | medio | 4 |
| Storia | 5 | difficile | 9 |
| TV e Spettacolo | 1 | facile | 5 |
| TV e Spettacolo | 2 | facile | 5 |
| TV e Spettacolo | 3 | medio | 6 |
| TV e Spettacolo | 4 | medio | 6 |
