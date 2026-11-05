"""Costruisce la banca domande curata per le 16 categorie ufficiali.

Non chiama nessun modello: i contenuti sono scritti qui, in modo che la banca
possa essere rigenerata in modo deterministico con:

    python scripts/generate-questions/build_curated_bank.py

Produce:
- 10 QUIZ per ognuna delle 16 categorie
- 10 VERO/FALSO per categoria, per Arena
- 10 domande brevi per difficolta per Air Hockey (EASY/MEDIUM/HARD)
- le domande IMAGE_BLUR gia presenti, rimappate sulle nuove categorie
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps" / "backend" / "src" / "main" / "resources" / "questions" / "questions-it.json"

CATEGORIES = [
    "Storia",
    "Geografia e Viaggi",
    "Scienza e Spazio",
    "Natura e Animali",
    "Sport",
    "Cinema, Serie TV",
    "TV e Spettacolo",
    "Musica",
    "Arte e Architettura",
    "Politica e Attualità",
    "Motori",
    "Cibo e Gastronomia",
    "Lingua e Letteratura",
    "Anime e manga",
    "Gaming e Tecnologia",
    "Curiosità",
]

SLUG = {
    "Storia": "storia",
    "Geografia e Viaggi": "geografia",
    "Scienza e Spazio": "scienza",
    "Natura e Animali": "natura",
    "Sport": "sport",
    "Cinema, Serie TV": "cinema",
    "TV e Spettacolo": "tv",
    "Musica": "musica",
    "Arte e Architettura": "arte",
    "Politica e Attualità": "politica",
    "Motori": "motori",
    "Cibo e Gastronomia": "cibo",
    "Lingua e Letteratura": "lingua",
    "Anime e manga": "anime",
    "Gaming e Tecnologia": "gaming",
    "Curiosità": "curiosita",
}

# (domanda, risposta corretta, tre risposte sbagliate, difficolta)
QUIZ: dict[str, list[tuple[str, str, list[str], str]]] = {
    "Storia": [
        ("In che anno è iniziata la Rivoluzione francese?", "1789", ["1776", "1815", "1848"], "medio"),
        ("Chi è stato il primo presidente degli Stati Uniti?", "George Washington", ["Abraham Lincoln", "Thomas Jefferson", "John Adams"], "facile"),
        ("Quale muro è caduto nel 1989, segnando la fine della Guerra Fredda?", "Il Muro di Berlino", ["La Muraglia cinese", "Il Muro di Adriano", "Il Vallo Antonino"], "facile"),
        ("Quale condottiero francese fu sconfitto nella battaglia di Waterloo?", "Napoleone Bonaparte", ["Luigi XIV", "Carlo Magno", "Robespierre"], "facile"),
        ("Quale civiltà costruì le piramidi di Giza?", "Quella egizia", ["Quella maya", "Quella romana", "Quella greca"], "facile"),
        ("Chi fu il primo imperatore romano?", "Augusto", ["Giulio Cesare", "Nerone", "Traiano"], "medio"),
        ("Quale trattato pose fine alla Prima guerra mondiale con la Germania?", "Il trattato di Versailles", ["Il trattato di Vienna", "Il trattato di Tordesillas", "La pace di Westfalia"], "medio"),
        ("Quale navigatore iniziò la prima circumnavigazione del globo?", "Ferdinando Magellano", ["Cristoforo Colombo", "Vasco da Gama", "James Cook"], "medio"),
        ("Chi fu il primo re dell'Italia unita nel 1861?", "Vittorio Emanuele II", ["Umberto I", "Carlo Alberto", "Napoleone III"], "medio"),
        ("Quale imperatore romano emanò l'Editto di Milano nel 313?", "Costantino", ["Diocleziano", "Teodosio", "Giustiniano"], "difficile"),
    ],
    "Geografia e Viaggi": [
        ("Qual è la capitale dell'Australia?", "Canberra", ["Sydney", "Melbourne", "Perth"], "medio"),
        ("Qual è la capitale della Francia?", "Parigi", ["Lione", "Marsiglia", "Bordeaux"], "facile"),
        ("Qual è la montagna più alta del mondo?", "L'Everest", ["Il K2", "Il Cervino", "Il Monte Bianco"], "facile"),
        ("Qual è l'oceano più grande?", "Il Pacifico", ["L'Atlantico", "L'Indiano", "L'Artico"], "facile"),
        ("Qual è la capitale del Giappone?", "Tokyo", ["Kyoto", "Osaka", "Seul"], "facile"),
        ("Qual è il lago più profondo del mondo?", "Il lago Bajkal", ["Il lago Vittoria", "Il lago Superiore", "Il Mar Caspio"], "medio"),
        ("Quale stretto separa l'Europa dall'Africa?", "Lo stretto di Gibilterra", ["Lo stretto di Messina", "Il Bosforo", "Lo stretto di Bering"], "medio"),
        ("Quale capitale europea si trova sul Danubio ed è nata dall'unione di Buda e Pest?", "Budapest", ["Vienna", "Bratislava", "Belgrado"], "medio"),
        ("Qual è il punto più profondo degli oceani?", "La fossa delle Marianne", ["La fossa delle Tonga", "La fossa di Porto Rico", "La dorsale medio-atlantica"], "difficile"),
        ("Quale Stato è il più piccolo del mondo?", "La Città del Vaticano", ["Monaco", "San Marino", "Il Liechtenstein"], "difficile"),
    ],
    "Scienza e Spazio": [
        ("Qual è l'elemento chimico con simbolo Fe?", "Ferro", ["Fluoro", "Fosforo", "Francio"], "facile"),
        ("Qual è il pianeta più vicino al Sole?", "Mercurio", ["Venere", "Marte", "Terra"], "facile"),
        ("Quale elemento chimico ha come simbolo O?", "Ossigeno", ["Oro", "Osmio", "Ozono"], "facile"),
        ("Quante ossa ha in media il corpo di un adulto?", "206", ["106", "156", "306"], "facile"),
        ("Quale gas assorbono le piante durante la fotosintesi?", "L'anidride carbonica", ["L'ossigeno", "L'azoto", "L'idrogeno"], "facile"),
        ("Quale metallo è liquido a temperatura ambiente?", "Il mercurio", ["Il piombo", "Lo stagno", "L'alluminio"], "facile"),
        ("Quale organo pompa il sangue nel corpo umano?", "Il cuore", ["Il fegato", "I polmoni", "I reni"], "facile"),
        ("Chi ha formulato la teoria della relatività?", "Albert Einstein", ["Isaac Newton", "Niels Bohr", "Max Planck"], "medio"),
        ("Qual è il pianeta con la massa maggiore del sistema solare?", "Giove", ["Saturno", "Nettuno", "Urano"], "medio"),
        ("Quale particella è stata confermata sperimentalmente al CERN nel 2012?", "Il bosone di Higgs", ["Il neutrino tau", "Il quark top", "Il gravitone"], "difficile"),
    ],
    "Natura e Animali": [
        ("Qual è il mammifero terrestre più grande?", "L'elefante africano", ["Il rinoceronte bianco", "La giraffa", "L'ippopotamo"], "facile"),
        ("Quale animale è noto per cambiare colore?", "Il camaleonte", ["Il panda", "La tigre", "Il koala"], "facile"),
        ("Quale organo permette ai pesci di respirare sott'acqua?", "Le branchie", ["I polmoni", "Le pinne", "Le squame"], "facile"),
        ("Quale pianta produce le ghiande?", "La quercia", ["Il faggio", "La betulla", "Il pino"], "facile"),
        ("Qual è il gruppo animale più numeroso sulla Terra?", "Gli insetti", ["I mammiferi", "Gli uccelli", "I rettili"], "medio"),
        ("Quale felino è il più veloce sulla terraferma?", "Il ghepardo", ["Il leone", "La tigre", "Il leopardo"], "facile"),
        ("Quale animale marino è un mammifero?", "Il delfino", ["Lo squalo", "Il tonno", "Il polpo"], "facile"),
        ("Quale deserto caldo è il più grande del mondo?", "Il Sahara", ["Il Gobi", "Il Kalahari", "L'Atacama"], "medio"),
        ("Quale parte della pianta assorbe acqua e sali minerali?", "Le radici", ["Le foglie", "Il fusto", "Il fiore"], "facile"),
        ("Qual è il pesce più grande del mondo?", "Lo squalo balena", ["Lo squalo bianco", "Il capodoglio", "Il tonno rosso"], "difficile"),
    ],
    "Sport": [
        ("Quanti giocatori per squadra scendono in campo nel calcio?", "11", ["10", "12", "9"], "facile"),
        ("In quale sport il punteggio si conta 15, 30, 40?", "Il tennis", ["Il padel", "Lo squash", "Il badminton"], "facile"),
        ("Quale nazione ha vinto più Coppe del Mondo di calcio?", "Il Brasile", ["L'Italia", "La Germania", "L'Argentina"], "facile"),
        ("Quanto misura una maratona?", "42,195 chilometri", ["21,097 chilometri", "30 chilometri", "50 chilometri"], "facile"),
        ("Di che colore è la maglia del leader del Tour de France?", "Gialla", ["Rosa", "Verde", "Bianca"], "facile"),
        ("Quante volte l'Italia ha vinto i Mondiali di calcio?", "Quattro", ["Due", "Tre", "Cinque"], "medio"),
        ("Quale nazione ha vinto il primo Mondiale di calcio nel 1930?", "L'Uruguay", ["L'Argentina", "Il Brasile", "L'Italia"], "medio"),
        ("Quale classica ciclistica italiana si corre da Milano a Sanremo?", "La Milano-Sanremo", ["Il Giro di Lombardia", "La Strade Bianche", "Il Giro del Piemonte"], "medio"),
        ("Quale squadra ha vinto più scudetti nella storia del calcio italiano?", "La Juventus", ["L'Inter", "Il Milan", "Il Torino"], "medio"),
        ("Quale pugile amava ripetere di essere il più grande, the greatest?", "Muhammad Ali", ["Joe Frazier", "Mike Tyson", "Rocky Marciano"], "difficile"),
    ],
    "Cinema, Serie TV": [
        ("Chi ha diretto Il Padrino?", "Francis Ford Coppola", ["Martin Scorsese", "Sergio Leone", "Brian De Palma"], "medio"),
        ("Chi ha diretto il film Titanic del 1997?", "James Cameron", ["Steven Spielberg", "Ridley Scott", "Martin Scorsese"], "facile"),
        ("Quale attore interpreta Jack Sparrow nella saga Pirati dei Caraibi?", "Johnny Depp", ["Orlando Bloom", "Brad Pitt", "Keanu Reeves"], "facile"),
        ("Come si chiama il leone protagonista del film Il re leone?", "Simba", ["Mufasa", "Scar", "Timon"], "facile"),
        ("Quale film italiano del 1997 ha vinto l'Oscar come miglior film straniero?", "La vita è bella", ["Nuovo Cinema Paradiso", "Il postino", "Malèna"], "facile"),
        ("Chi ha diretto Pulp Fiction?", "Quentin Tarantino", ["Joel Coen", "David Fincher", "Guy Ritchie"], "medio"),
        ("Quale film di Stanley Kubrick è ambientato nell'Overlook Hotel?", "Shining", ["Arancia meccanica", "Full Metal Jacket", "Eyes Wide Shut"], "medio"),
        ("Quale serie è ambientata nel continente di Westeros?", "Il Trono di Spade", ["The Witcher", "Vikings", "Roma"], "facile"),
        ("Quale film di Orson Welles del 1941 è celebre per l'uso della profondità di campo?", "Quarto potere", ["Il monello", "Via col vento", "Il grande sonno"], "difficile"),
        ("Quale attrice ha vinto l'Oscar per Il silenzio degli innocenti?", "Jodie Foster", ["Meryl Streep", "Glenn Close", "Susan Sarandon"], "medio"),
    ],
    "TV e Spettacolo": [
        ("Quale quiz storico conduceva Mike Bongiorno chiedendo di lasciare o raddoppiare?", "Lascia o raddoppia?", ["Rischiatutto", "Il gioco dei pacchi", "Telemike"], "facile"),
        ("Che tipo di programma è il TG1?", "Un telegiornale", ["Un talk show", "Un reality", "Una fiction"], "facile"),
        ("Quale rete italiana trasmette il TG3?", "Rai 3", ["Rai 1", "Rai 2", "Rete 4"], "facile"),
        ("Quale programma mette in gara cuochi dilettanti e professionisti?", "MasterChef", ["Bake Off", "4 Ristoranti", "Cucine da incubo"], "facile"),
        ("Come si chiama il festival musicale che si tiene ogni anno a Sanremo?", "Il Festival di Sanremo", ["Il Festivalbar", "Umbria Jazz", "Il Concerto del Primo Maggio"], "facile"),
        ("Quale conduttore ha presentato il Festival di Sanremo per cinque edizioni consecutive fino al 2024?", "Amadeus", ["Carlo Conti", "Pippo Baudo", "Fabio Fazio"], "medio"),
        ("Quale programma politico conduce Bruno Vespa?", "Porta a Porta", ["Report", "Otto e mezzo", "Piazzapulita"], "medio"),
        ("Quale trasmissione di inchieste è condotta da Sigfrido Ranucci?", "Report", ["Le Iene", "Striscia la notizia", "Presadiretta"], "medio"),
        ("In quale programma i concorrenti scelgono un pacco per vincere un premio?", "Affari tuoi", ["L'eredità", "Caduta libera", "Reazione a catena"], "medio"),
        ("Chi conduce il programma Uomini e donne?", "Maria De Filippi", ["Milly Carlucci", "Mara Venier", "Barbara D'Urso"], "difficile"),
    ],
    "Musica": [
        ("Chi ha composto La Traviata?", "Giuseppe Verdi", ["Gioachino Rossini", "Giacomo Puccini", "Vincenzo Bellini"], "medio"),
        ("Quale gruppo ha inciso Bohemian Rhapsody?", "I Queen", ["I Beatles", "I Pink Floyd", "I Led Zeppelin"], "facile"),
        ("Quale strumento ha 88 tasti?", "Il pianoforte", ["L'organo", "La fisarmonica", "Il clavicembalo"], "facile"),
        ("Chi ha cantato Nel blu dipinto di blu, conosciuta come Volare?", "Domenico Modugno", ["Adriano Celentano", "Lucio Battisti", "Gino Paoli"], "facile"),
        ("Quale gruppo inglese ha inciso Hey Jude?", "I Beatles", ["I Rolling Stones", "I Kinks", "Gli Who"], "facile"),
        ("Quale band italiana ha vinto l'Eurovision nel 2021?", "I Måneskin", ["Il Volo", "I Negramaro", "Gli Eurythmics"], "facile"),
        ("A quale famiglia di strumenti appartiene il violino?", "Agli archi", ["Agli ottoni", "Ai legni", "Alle percussioni"], "facile"),
        ("Quale compositore, divenuto sordo, scrisse la Nona sinfonia?", "Ludwig van Beethoven", ["Wolfgang Amadeus Mozart", "Johann Sebastian Bach", "Franz Schubert"], "medio"),
        ("Quale album dei Pink Floyd ha in copertina un prisma che scompone la luce?", "The Dark Side of the Moon", ["The Wall", "Wish You Were Here", "Animals"], "medio"),
        ("Chi ha composto la tetralogia L'anello del Nibelungo?", "Richard Wagner", ["Giuseppe Verdi", "Richard Strauss", "Gustav Mahler"], "difficile"),
    ],
    "Arte e Architettura": [
        ("Chi ha dipinto la Gioconda?", "Leonardo da Vinci", ["Michelangelo", "Raffaello", "Caravaggio"], "facile"),
        ("Chi ha scolpito il David conservato alla Galleria dell'Accademia?", "Michelangelo", ["Donatello", "Bernini", "Canova"], "facile"),
        ("In quale museo si trova la Venere di Milo?", "Al Louvre", ["Agli Uffizi", "Al British Museum", "Ai Musei Vaticani"], "facile"),
        ("Chi ha dipinto La notte stellata?", "Vincent van Gogh", ["Claude Monet", "Paul Gauguin", "Paul Cézanne"], "facile"),
        ("Chi ha affrescato la volta della Cappella Sistina?", "Michelangelo", ["Raffaello", "Perugino", "Botticelli"], "facile"),
        ("Chi ha dipinto Il bacio conservato a Vienna?", "Gustav Klimt", ["Egon Schiele", "Edvard Munch", "Henri Matisse"], "medio"),
        ("Chi ha scolpito la Pietà conservata in San Pietro?", "Michelangelo", ["Bernini", "Donatello", "Verrocchio"], "medio"),
        ("Chi ha progettato la cupola del Duomo di Firenze?", "Filippo Brunelleschi", ["Leon Battista Alberti", "Giotto", "Andrea Palladio"], "medio"),
        ("Chi ha dipinto Guernica?", "Pablo Picasso", ["Joan Miró", "Salvador Dalí", "Georges Braque"], "medio"),
        ("Quale movimento artistico teorizzò Filippo Tommaso Marinetti?", "Il futurismo", ["Il dadaismo", "Il surrealismo", "Il simbolismo"], "difficile"),
    ],
    "Politica e Attualità": [
        ("In quale anno è entrata in vigore la Costituzione italiana?", "1948", ["1946", "1945", "1950"], "medio"),
        ("Quale forma di governo ha oggi l'Italia?", "La repubblica parlamentare", ["La monarchia costituzionale", "La repubblica presidenziale", "Lo stato federale"], "facile"),
        ("Chi è il capo dello Stato in Italia?", "Il Presidente della Repubblica", ["Il Presidente del Consiglio", "Il Presidente della Camera", "Il Presidente della Corte costituzionale"], "facile"),
        ("Quanti Stati fanno parte dell'Unione Europea?", "27", ["25", "28", "30"], "facile"),
        ("Quale organizzazione militare ha sede a Bruxelles e comprende gli Stati Uniti?", "La NATO", ["L'ONU", "L'OSCE", "L'Eurocorps"], "facile"),
        ("Chi nomina il Presidente del Consiglio dei ministri in Italia?", "Il Presidente della Repubblica", ["Il corpo elettorale", "Il Presidente del Senato", "La Corte costituzionale"], "medio"),
        ("Quale trattato ha istituito l'Unione Europea nel 1992?", "Il trattato di Maastricht", ["Il trattato di Roma", "Il trattato di Amsterdam", "Il trattato di Lisbona"], "medio"),
        ("Quanti anni dura il mandato del Presidente della Repubblica italiana?", "Sette", ["Cinque", "Sei", "Nove"], "medio"),
        ("Quale organo dell'ONU ha cinque membri permanenti con diritto di veto?", "Il Consiglio di sicurezza", ["L'Assemblea generale", "Il Segretariato", "La Corte internazionale di giustizia"], "medio"),
        ("Quanti giudici compongono la Corte costituzionale italiana?", "Quindici", ["Nove", "Dodici", "Ventuno"], "difficile"),
    ],
    "Motori": [
        ("Quale casa automobilistica produce la Golf?", "Volkswagen", ["Fiat", "Renault", "Peugeot"], "facile"),
        ("Quale marchio ha come simbolo il cavallino rampante?", "La Ferrari", ["La Porsche", "La Lamborghini", "La Maserati"], "facile"),
        ("Come si chiama la gara di durata più famosa, corsa in Francia?", "La 24 Ore di Le Mans", ["La Mille Miglia", "La Targa Florio", "Il Rally di Montecarlo"], "facile"),
        ("Quanti mondiali di Formula 1 ha vinto Michael Schumacher?", "Sette", ["Tre", "Cinque", "Nove"], "facile"),
        ("Quale pilota ha vinto sette titoli mondiali di Formula 1 con la Mercedes?", "Lewis Hamilton", ["Nico Rosberg", "Sebastian Vettel", "Fernando Alonso"], "medio"),
        ("Quale scuderia ha vinto più titoli costruttori nella storia della Formula 1?", "La Ferrari", ["La McLaren", "La Williams", "La Mercedes"], "medio"),
        ("Quale pilota è soprannominato il Kaiser?", "Michael Schumacher", ["Sebastian Vettel", "Niki Lauda", "Alain Prost"], "medio"),
        ("Quanti cilindri ha tradizionalmente il motore boxer della Porsche 911?", "Sei", ["Quattro", "Otto", "Dieci"], "medio"),
        ("Chi ha vinto il primo campionato mondiale di Formula 1 nel 1950?", "Nino Farina", ["Juan Manuel Fangio", "Alberto Ascari", "Stirling Moss"], "difficile"),
        ("Quale pilota ha vinto il mondiale di Formula 1 del 2021 all'ultima gara?", "Max Verstappen", ["Lewis Hamilton", "Charles Leclerc", "Valtteri Bottas"], "difficile"),
    ],
    "Cibo e Gastronomia": [
        ("Qual è l'ingrediente principale del pesto genovese?", "Il basilico", ["Il prezzemolo", "Il rosmarino", "La salvia"], "facile"),
        ("Da quale cereale si ricava il pane tradizionale italiano?", "Dal grano", ["Dal mais", "Dal riso", "Dall'orzo"], "facile"),
        ("Quale formaggio si usa nella ricetta tradizionale della carbonara?", "Il pecorino", ["Il parmigiano", "Il gorgonzola", "La mozzarella"], "facile"),
        ("Quale città è famosa in tutto il mondo per la pizza?", "Napoli", ["Genova", "Bari", "Palermo"], "facile"),
        ("Da quale frutto si ottiene il vino?", "Dall'uva", ["Dal melograno", "Dal fico", "Dalla pera"], "facile"),
        ("Quale salume è l'ingrediente principale della pasta alla carbonara?", "Il guanciale", ["La pancetta", "Lo speck", "La salsiccia"], "medio"),
        ("Quale vino piemontese si produce con uve Nebbiolo?", "Il Barolo", ["Il Chianti", "Il Prosecco", "Il Nero d'Avola"], "medio"),
        ("Quale dolce campano è a forma di fungo e inzuppato di sciroppo?", "Il babà", ["La sfogliatella", "La pastiera", "Il tiramisù"], "medio"),
        ("Quale formaggio si usa nel tiramisù?", "Il mascarpone", ["La ricotta", "Il philadelphia", "Lo stracchino"], "medio"),
        ("Quale fungo pregiatissimo è celebrato nella fiera di Alba?", "Il tartufo bianco", ["Il porcino", "Il finferlo", "Il chiodino"], "difficile"),
    ],
    "Lingua e Letteratura": [
        ("Quale articolo determinativo maschile singolare si usa davanti a una parola che inizia per vocale?", "L'", ["Il", "Lo", "La"], "facile"),
        ("Quale figura retorica è contenuta nell'espressione il mare ride?", "La personificazione", ["La metafora", "L'ossimoro", "L'anafora"], "medio"),
        ("Quale modo e tempo verbale è cantassi?", "Congiuntivo imperfetto", ["Indicativo imperfetto", "Condizionale presente", "Congiuntivo presente"], "medio"),
        ("Quale di queste parole è un palindromo?", "Anna", ["Casa", "Luna", "Sole"], "medio"),
        ("Come si chiama la parte della grammatica che studia la struttura della frase?", "La sintassi", ["La fonetica", "La morfologia", "La semantica"], "medio"),
        ("Chi ha scritto la Divina Commedia?", "Dante Alighieri", ["Francesco Petrarca", "Giovanni Boccaccio", "Alessandro Manzoni"], "facile"),
        ("Quale romanzo inizia con Quel ramo del lago di Como?", "I promessi sposi", ["I Malavoglia", "Il Gattopardo", "Pinocchio"], "medio"),
        ("Chi ha scritto 1984?", "George Orwell", ["Aldous Huxley", "Ray Bradbury", "Franz Kafka"], "medio"),
        ("Quale poeta ha scritto L'infinito?", "Giacomo Leopardi", ["Giuseppe Ungaretti", "Eugenio Montale", "Giovanni Pascoli"], "medio"),
        ("Chi ha scritto Cent'anni di solitudine?", "Gabriel García Márquez", ["Jorge Luis Borges", "Julio Cortázar", "Pablo Neruda"], "difficile"),
    ],
    "Anime e manga": [
        ("Chi ha creato Dragon Ball?", "Akira Toriyama", ["Eiichiro Oda", "Masashi Kishimoto", "Naoko Takeuchi"], "medio"),
        ("Come si chiama il protagonista di Naruto?", "Naruto Uzumaki", ["Sasuke Uchiha", "Kakashi Hatake", "Itachi Uchiha"], "facile"),
        ("Quale manga racconta le avventure dei Pirati di Cappello di Paglia?", "One Piece", ["Bleach", "Fairy Tail", "Tokyo Ghoul"], "facile"),
        ("In Attack on Titan, chi è il protagonista?", "Eren Jaeger", ["Levi Ackerman", "Armin Arlert", "Mikasa Ackerman"], "medio"),
        ("Quale studio ha prodotto Spirited Away?", "Studio Ghibli", ["Toei Animation", "Madhouse", "Kyoto Animation"], "medio"),
        ("Chi ha creato Sailor Moon?", "Naoko Takeuchi", ["CLAMP", "Rumiko Takahashi", "Ai Yazawa"], "difficile"),
        ("Quale anime ha come protagonisti i fratelli Elric?", "Fullmetal Alchemist", ["Sword Art Online", "Death Note", "Demon Slayer"], "medio"),
        ("Quale manga ha come protagonista Light Yagami?", "Death Note", ["Monster", "Tokyo Ghoul", "Parasyte"], "medio"),
        ("Quale film Ghibli racconta la storia di Totoro?", "Il mio vicino Totoro", ["La città incantata", "Ponyo", "Howl's Moving Castle"], "facile"),
        ("Come si chiama il compagno elettrico di Ash Ketchum?", "Pikachu", ["Charizard", "Bulbasaur", "Squirtle"], "facile"),
    ],
    "Gaming e Tecnologia": [
        ("Quale azienda ha creato Mario?", "Nintendo", ["Sony", "Sega", "Microsoft"], "facile"),
        ("Quale console Nintendo è uscita nel 2017?", "Switch", ["Wii U", "3DS", "GameCube"], "facile"),
        ("Qual è il sistema operativo di Google per smartphone?", "Android", ["iOS", "Windows Phone", "Symbian"], "facile"),
        ("Chi è stato il cofondatore di Microsoft insieme a Paul Allen?", "Bill Gates", ["Steve Jobs", "Steve Wozniak", "Mark Zuckerberg"], "medio"),
        ("Quale piattaforma di distribuzione digitale possiede Valve?", "Steam", ["Epic Games Store", "GOG", "Origin"], "medio"),
        ("Quale componente è chiamato CPU?", "Il processore", ["La scheda video", "La memoria RAM", "Il disco rigido"], "facile"),
        ("Quale social network era noto per l'uccellino azzurro?", "Twitter", ["Facebook", "Instagram", "TikTok"], "medio"),
        ("Quale videogioco battle royale è sviluppato da Epic Games?", "Fortnite", ["PUBG", "Apex Legends", "Warzone"], "facile"),
        ("Quale azienda produce PlayStation?", "Sony", ["Nintendo", "Microsoft", "Sega"], "facile"),
        ("In quale anno è stato lanciato il primo iPhone?", "2007", ["2005", "2009", "2010"], "difficile"),
    ],
    "Curiosità": [
        ("Qual è l'animale più veloce in volo?", "Il falco pellegrino", ["L'aquila reale", "La rondine", "L'albatro"], "medio"),
        ("Quale pianeta è il più caldo del sistema solare?", "Venere", ["Mercurio", "Marte", "Giove"], "medio"),
        ("Quale frutto ha i semi all'esterno?", "La fragola", ["La mela", "La pera", "La ciliegia"], "facile"),
        ("Quale mammifero depone le uova?", "L'ornitorinco", ["Il canguro", "Il pipistrello", "Il delfino"], "medio"),
        ("Quale parte del corpo umano non contiene vasi sanguigni?", "La cornea", ["Il fegato", "Il cuore", "Il rene"], "difficile"),
        ("Quale cibo può conservarsi a lungo senza deteriorarsi?", "Il miele", ["Il latte", "Il pane", "La carne cruda"], "facile"),
        ("Quale animale ha tre cuori?", "Il polpo", ["Lo squalo", "Il delfino", "La tartaruga"], "medio"),
        ("Quale paese ha il maggior numero di fusi orari?", "La Francia", ["La Russia", "Gli Stati Uniti", "La Cina"], "difficile"),
        ("Quale pianta è famosa per la crescita molto rapida?", "Il bambù", ["La quercia", "L'ulivo", "Il cactus"], "facile"),
        ("Quale insetto può sollevare molte volte il proprio peso?", "La formica", ["La farfalla", "La libellula", "La coccinella"], "facile"),
    ],
}

TF: dict[str, list[tuple[str, str, str]]] = {
    "Storia": [
        ("La Prima Guerra Mondiale è iniziata nel 1914.", "VERO", "facile"),
        ("Giulio Cesare è stato il primo imperatore romano.", "FALSO", "facile"),
        ("La battaglia di Lepanto fu combattuta nel 1571.", "VERO", "medio"),
        ("L'Unione Sovietica si è dissolta nel 1991.", "VERO", "medio"),
        ("Il trattato di Tordesillas divise le zone di espansione tra Spagna e Portogallo.", "VERO", "difficile"),
        ("La rivolta di Haymarket del 1886 avvenne a Chicago.", "VERO", "difficile"),
        ("La caduta dell'Impero romano d'Occidente è avvenuta nel 1492.", "FALSO", "facile"),
        ("Napoleone Bonaparte è morto in esilio sull'isola di Sant'Elena.", "VERO", "medio"),
        ("L'Unità d'Italia è stata proclamata nel 1861.", "VERO", "facile"),
        ("Il Muro di Berlino è caduto nel 1975.", "FALSO", "facile"),
    ],
    "Geografia e Viaggi": [
        ("Il Po è il fiume più lungo d'Italia.", "VERO", "facile"),
        ("L'Australia è al tempo stesso un paese e un continente.", "VERO", "facile"),
        ("Il deserto del Sahara si trova in Asia.", "FALSO", "facile"),
        ("Il Mar Caspio è il lago più grande del mondo.", "VERO", "medio"),
        ("La Groenlandia è la più grande isola del mondo.", "VERO", "medio"),
        ("Il lago Titicaca si trova tra Perù e Bolivia.", "VERO", "difficile"),
        ("Il Kilimangiaro si trova in Kenya.", "FALSO", "difficile"),
        ("La capitale dell'Australia è Sydney.", "FALSO", "facile"),
        ("Il Monte Bianco si trova al confine tra Italia e Francia.", "VERO", "facile"),
        ("La Sardegna è bagnata dal Mar Adriatico.", "FALSO", "facile"),
    ],
    "Scienza e Spazio": [
        ("L'acqua bolle a 100 gradi Celsius al livello del mare.", "VERO", "facile"),
        ("Il Sole è una stella.", "VERO", "facile"),
        ("Il DNA ha una struttura a doppia elica.", "VERO", "medio"),
        ("La velocità della luce nel vuoto è di circa 300.000 chilometri al secondo.", "VERO", "medio"),
        ("I neutroni hanno carica elettrica nulla.", "VERO", "difficile"),
        ("La meiosi produce cellule con corredo cromosomico aploide.", "VERO", "difficile"),
        ("Il simbolo chimico del ferro è Fe.", "VERO", "facile"),
        ("Gli elettroni hanno carica elettrica positiva.", "FALSO", "medio"),
        ("La Luna è un pianeta.", "FALSO", "facile"),
        ("Il Sole è un pianeta.", "FALSO", "facile"),
    ],
    "Natura e Animali": [
        ("La balena è un mammifero.", "VERO", "facile"),
        ("I ragni sono insetti.", "FALSO", "facile"),
        ("Le piante producono ossigeno tramite la fotosintesi.", "VERO", "facile"),
        ("Il panda gigante si nutre principalmente di bambù.", "VERO", "facile"),
        ("I delfini respirano attraverso le branchie.", "FALSO", "medio"),
        ("Il ghepardo è il felino più veloce.", "VERO", "medio"),
        ("Le rane sono rettili.", "FALSO", "medio"),
        ("L'orso polare vive al Polo Sud.", "FALSO", "medio"),
        ("Il bambù è una pianta.", "VERO", "facile"),
        ("Le api producono miele.", "VERO", "facile"),
    ],
    "Sport": [
        ("Una partita di basket NBA si gioca in quattro quarti.", "VERO", "medio"),
        ("Nel basket scendono in campo cinque giocatori per squadra.", "VERO", "facile"),
        ("La Formula 1 si corre solo su circuiti permanenti, mai su strade cittadine.", "FALSO", "facile"),
        ("Il nuoto sincronizzato non è mai stato uno sport olimpico.", "FALSO", "medio"),
        ("Gli Stati Uniti hanno vinto più medaglie olimpiche di qualsiasi altra nazione.", "VERO", "medio"),
        ("La Coppa del Mondo di rugby si disputa ogni due anni.", "FALSO", "difficile"),
        ("Il fioretto è una delle armi della scherma.", "VERO", "difficile"),
        ("Una partita di calcio dura 90 minuti più il recupero.", "VERO", "facile"),
        ("Nel basket una schiacciata vale tre punti.", "FALSO", "facile"),
        ("Le Olimpiadi estive si tengono ogni quattro anni.", "VERO", "facile"),
    ],
    "Cinema, Serie TV": [
        ("Il film Il Padrino è ambientato a Napoli.", "FALSO", "facile"),
        ("Il film Il Padrino è tratto da un romanzo di Mario Puzo.", "VERO", "facile"),
        ("Walt Disney ha creato il personaggio di Topolino.", "VERO", "facile"),
        ("Il film Matrix è uscito nel 1999.", "VERO", "medio"),
        ("Roberto Benigni ha vinto l'Oscar come miglior attore per La vita è bella.", "VERO", "medio"),
        ("Il neorealismo italiano nasce negli anni Ottanta.", "FALSO", "difficile"),
        ("La Palma d'Oro del 2019 è andata al film Parasite.", "VERO", "difficile"),
        ("Il film Quarto potere è stato diretto da Alfred Hitchcock.", "FALSO", "difficile"),
        ("Il film Titanic è stato diretto da James Cameron.", "VERO", "facile"),
        ("Marlon Brando ha interpretato Don Vito Corleone ne Il padrino.", "VERO", "medio"),
    ],
    "TV e Spettacolo": [
        ("Il Festival di Sanremo si svolge ogni anno a luglio.", "FALSO", "facile"),
        ("Netflix è un servizio di streaming.", "VERO", "facile"),
        ("Il Grande Fratello è un reality show.", "VERO", "facile"),
        ("Il programma Uomini e donne è condotto da Maria De Filippi.", "VERO", "medio"),
        ("Il Festival di Sanremo si svolge al Teatro Ariston.", "VERO", "medio"),
        ("Black Mirror è una serie antologica con episodi autoconclusivi.", "VERO", "difficile"),
        ("Che tempo che fa è un programma condotto da Fabio Fazio.", "VERO", "difficile"),
        ("Il TG1 va in onda su Rai 1.", "VERO", "facile"),
        ("Il Grande Fratello è un telegiornale.", "FALSO", "facile"),
        ("La trasmissione Report va in onda su una rete Mediaset.", "FALSO", "medio"),
    ],
    "Musica": [
        ("Il pianoforte ha 66 tasti.", "FALSO", "facile"),
        ("Mozart è nato a Salisburgo.", "VERO", "facile"),
        ("L'inno italiano si chiama Fratelli d'Italia.", "VERO", "facile"),
        ("Il jazz nasce in Italia.", "FALSO", "medio"),
        ("Luciano Pavarotti era un tenore italiano.", "VERO", "medio"),
        ("Il contrabbasso suona più grave del violoncello.", "VERO", "difficile"),
        ("Claude Debussy era un compositore francese.", "VERO", "difficile"),
        ("I Beatles erano originari di Liverpool.", "VERO", "facile"),
        ("Mozart è nato a Vienna.", "FALSO", "medio"),
        ("La Scala è un teatro lirico di Milano.", "VERO", "facile"),
    ],
    "Arte e Architettura": [
        ("Il David di Michelangelo è conservato a Firenze.", "VERO", "facile"),
        ("Il Colosseo è un anfiteatro romano.", "VERO", "facile"),
        ("La Gioconda è esposta al museo del Louvre.", "VERO", "facile"),
        ("Il Barocco si sviluppa nell'Ottocento.", "FALSO", "medio"),
        ("Salvador Dalí è stato un esponente del surrealismo.", "VERO", "medio"),
        ("Il Partenone si trova sull'Acropoli di Atene.", "VERO", "difficile"),
        ("La Cappella Sistina si trova in Vaticano.", "VERO", "facile"),
        ("Il David di Michelangelo è conservato a Venezia.", "FALSO", "facile"),
        ("Il Cenacolo di Leonardo si trova a Milano.", "VERO", "medio"),
        ("Il Colosseo è stato costruito nel Novecento.", "FALSO", "facile"),
    ],
    "Politica e Attualità": [
        ("In Italia il voto è obbligatorio per legge.", "FALSO", "medio"),
        ("L'Italia è uno Stato membro dell'Unione Europea.", "VERO", "facile"),
        ("La Costituzione italiana è entrata in vigore il 1 gennaio 1948.", "VERO", "medio"),
        ("Il Regno Unito è una monarchia costituzionale.", "VERO", "medio"),
        ("Il Presidente della Repubblica italiana può sciogliere anticipatamente le Camere.", "VERO", "difficile"),
        ("L'Italia è membro permanente del Consiglio di sicurezza dell'ONU.", "FALSO", "difficile"),
        ("Il Parlamento italiano è composto dalla Camera dei Deputati e dal Senato.", "VERO", "facile"),
        ("Il Presidente della Repubblica italiana resta in carica sette anni.", "VERO", "medio"),
        ("La sede principale dell'ONU è a Ginevra.", "FALSO", "facile"),
        ("L'Unione Europea conta 27 Stati membri.", "VERO", "facile"),
    ],
    "Motori": [
        ("Un motore diesel non ha candele di accensione.", "VERO", "medio"),
        ("La MotoGP è un campionato di motociclismo.", "VERO", "facile"),
        ("Il marchio Mercedes-Benz ha come simbolo una stella a tre punte.", "VERO", "facile"),
        ("La Lamborghini ha la sua sede a Sant'Agata Bolognese.", "VERO", "medio"),
        ("Il rally si corre anche su strade sterrate e aperte al traffico.", "VERO", "medio"),
        ("Il motore Wankel è un motore rotativo.", "VERO", "difficile"),
        ("Il Gran Premio di Monaco si corre su un circuito cittadino.", "VERO", "difficile"),
        ("La Ferrari ha la sede a Milano.", "FALSO", "facile"),
        ("Le MotoGP corrono con motori a due tempi.", "FALSO", "medio"),
        ("La Porsche è una casa automobilistica francese.", "FALSO", "facile"),
    ],
    "Cibo e Gastronomia": [
        ("La pizza margherita prende il nome da una regina d'Italia.", "VERO", "facile"),
        ("Il Parmigiano Reggiano è un formaggio a denominazione di origine protetta.", "VERO", "facile"),
        ("La mozzarella di bufala è tipica della Campania.", "VERO", "facile"),
        ("Il riso è un cereale.", "VERO", "medio"),
        ("L'aceto balsamico tradizionale è originario di Modena.", "VERO", "medio"),
        ("La pasta all'amatriciana tradizionale prevede la pancetta affumicata.", "FALSO", "difficile"),
        ("Il pecorino romano si produce con latte di pecora.", "VERO", "difficile"),
        ("La pizza Margherita prevede l'ananas tra gli ingredienti.", "FALSO", "facile"),
        ("La pasta è un alimento privo di carboidrati.", "FALSO", "medio"),
        ("Il risotto alla milanese si prepara con lo zafferano.", "VERO", "facile"),
    ],
    "Lingua e Letteratura": [
        ("Il congiuntivo è un modo verbale.", "VERO", "facile"),
        ("In italiano gli aggettivi concordano in genere e numero con il nome.", "VERO", "facile"),
        ("Un ossimoro accosta due termini contraddittori.", "VERO", "medio"),
        ("Il congiuntivo italiano ha due tempi.", "FALSO", "medio"),
        ("L'italiano standard deriva dal greco antico.", "FALSO", "difficile"),
        ("La Divina Commedia è scritta in terzine.", "VERO", "medio"),
        ("Il romanzo I promessi sposi è ambientato in Sicilia.", "FALSO", "facile"),
        ("George Orwell ha scritto 1984.", "VERO", "facile"),
        ("L'infinito è una poesia di Giacomo Leopardi.", "VERO", "facile"),
        ("Romeo e Giulietta è una tragedia di William Shakespeare.", "VERO", "facile"),
    ],
    "Anime e manga": [
        ("Dragon Ball è stato creato da Akira Toriyama.", "VERO", "facile"),
        ("Naruto è ambientato in un mondo di pirati.", "FALSO", "facile"),
        ("One Piece racconta le avventure di Monkey D. Luffy.", "VERO", "facile"),
        ("Studio Ghibli è una casa di produzione giapponese.", "VERO", "facile"),
        ("Sailor Moon è stato creato da Naoko Takeuchi.", "VERO", "medio"),
        ("Attack on Titan è un manga giapponese.", "VERO", "medio"),
        ("Goku è il protagonista di One Piece.", "FALSO", "facile"),
        ("Death Note ha come protagonista Light Yagami.", "VERO", "medio"),
        ("Pokémon è nato come videogioco prima che come anime.", "VERO", "medio"),
        ("My Hero Academia è ambientato in un mondo senza superpoteri.", "FALSO", "medio"),
    ],
    "Gaming e Tecnologia": [
        ("La PlayStation è prodotta da Sony.", "VERO", "facile"),
        ("Nintendo ha creato il personaggio di Mario.", "VERO", "facile"),
        ("Android è sviluppato da Apple.", "FALSO", "facile"),
        ("Steam è una piattaforma di distribuzione digitale di videogiochi.", "VERO", "medio"),
        ("Il primo iPhone è stato presentato nel 1997.", "FALSO", "medio"),
        ("Fortnite è sviluppato da Epic Games.", "VERO", "medio"),
        ("Una CPU è il processore di un computer.", "VERO", "facile"),
        ("Microsoft ha creato la console Xbox.", "VERO", "facile"),
        ("Il Wi-Fi è una tecnologia per la trasmissione di dati senza fili.", "VERO", "facile"),
        ("Il linguaggio HTML serve principalmente a creare fogli di calcolo.", "FALSO", "medio"),
    ],
    "Curiosità": [
        ("Il miele può durare molto a lungo senza deteriorarsi.", "VERO", "facile"),
        ("Il polpo ha tre cuori.", "VERO", "medio"),
        ("La fragola ha i semi all'esterno.", "VERO", "facile"),
        ("Il falco pellegrino è l'animale più veloce in volo.", "VERO", "medio"),
        ("La cornea umana contiene vasi sanguigni.", "FALSO", "difficile"),
        ("Il bambù è una delle piante dalla crescita più rapida.", "VERO", "facile"),
        ("I gatti hanno più vertebre cervicali delle giraffe.", "FALSO", "difficile"),
        ("L'acqua pura è un buon conduttore di elettricità.", "FALSO", "medio"),
        ("Il suono viaggia più velocemente nell'acqua che nell'aria.", "VERO", "medio"),
        ("La Grande Muraglia cinese è visibile a occhio nudo dalla Luna.", "FALSO", "facile"),
    ],
}

# (difficolta, domanda, quattro opzioni, indice corretto)
AIR_HOCKEY: list[tuple[str, str, list[str], int]] = [
    ("EASY", "Qual è la capitale d'Italia?", ["Roma", "Milano", "Napoli", "Torino"], 0),
    ("EASY", "Quanti giorni ha una settimana?", ["7", "5", "10", "12"], 0),
    ("EASY", "Di che colore è il cielo in una giornata serena?", ["Azzurro", "Verde", "Rosso", "Nero"], 0),
    ("EASY", "Quanto fa 2 + 2?", ["4", "5", "3", "6"], 0),
    ("EASY", "Quante zampe ha un ragno?", ["8", "6", "4", "10"], 0),
    ("EASY", "Su quale pianeta viviamo?", ["Terra", "Marte", "Luna", "Venere"], 0),
    ("EASY", "Qual è il giorno dopo lunedì?", ["Martedì", "Domenica", "Venerdì", "Mercoledì"], 0),
    ("EASY", "Quanti mesi ha un anno?", ["12", "10", "11", "13"], 0),
    ("EASY", "Qual è il colore del latte?", ["Bianco", "Nero", "Rosso", "Blu"], 0),
    ("EASY", "In quale stagione di solito nevica?", ["Inverno", "Estate", "Primavera", "Autunno"], 0),
    ("MEDIUM", "Qual è la capitale della Francia?", ["Parigi", "Lione", "Marsiglia", "Nizza"], 0),
    ("MEDIUM", "Chi ha dipinto la Gioconda?", ["Leonardo da Vinci", "Michelangelo", "Raffaello", "Caravaggio"], 0),
    ("MEDIUM", "Quante corde ha un violino?", ["4", "5", "6", "3"], 0),
    ("MEDIUM", "Qual è il fiume più lungo d'Italia?", ["Po", "Tevere", "Adige", "Arno"], 0),
    ("MEDIUM", "Quale pianeta è il più vicino al Sole?", ["Mercurio", "Venere", "Marte", "Terra"], 0),
    ("MEDIUM", "Chi ha scritto la Divina Commedia?", ["Dante Alighieri", "Petrarca", "Boccaccio", "Manzoni"], 0),
    ("MEDIUM", "Quale elemento chimico ha simbolo Au?", ["Oro", "Argento", "Rame", "Alluminio"], 0),
    ("MEDIUM", "Qual è la moneta del Giappone?", ["Yen", "Won", "Yuan", "Ringgit"], 0),
    ("MEDIUM", "Quante sono le regioni italiane?", ["20", "19", "21", "18"], 0),
    ("MEDIUM", "In che anno è caduto il Muro di Berlino?", ["1989", "1991", "1987", "1985"], 0),
    ("HARD", "Qual è la capitale dell'Australia?", ["Canberra", "Sydney", "Melbourne", "Perth"], 0),
    ("HARD", "Chi ha composto la Nona Sinfonia?", ["Beethoven", "Mozart", "Bach", "Chopin"], 0),
    ("HARD", "Qual è il mare più salato?", ["Mar Morto", "Mediterraneo", "Mar Rosso", "Adriatico"], 0),
    ("HARD", "Quanti giocatori ha una squadra di rugby in campo?", ["15", "11", "13", "7"], 0),
    ("HARD", "Chi ha scritto 1984?", ["George Orwell", "Aldous Huxley", "Ray Bradbury", "Franz Kafka"], 0),
    ("HARD", "Qual è la capitale del Canada?", ["Ottawa", "Toronto", "Montreal", "Vancouver"], 0),
    ("HARD", "Quante ossa ha il corpo umano adulto?", ["206", "186", "226", "246"], 0),
    ("HARD", "Qual è l'unità di misura della forza?", ["Newton", "Joule", "Watt", "Pascal"], 0),
    ("HARD", "Qual è l'elemento chimico con simbolo W?", ["Tungsteno", "Titanio", "Tallio", "Tennesso"], 0),
    ("HARD", "Qual è il deserto più grande del mondo?", ["Antartico", "Sahara", "Gobi", "Kalahari"], 0),
]

# ---------------------------------------------------------------------------
# Espansione della banca: contenuti aggiunti per portare ogni fascia di
# difficolta a 15 domande (20 per le categorie a doppio tema come Cinema,
# Serie TV). I blocchi vivono in bank_extra_N.py.
from bank_extra import EXTRA_QUIZ as _EXTRA_QUIZ, EXTRA_TF as _EXTRA_TF

for _category, _rows in _EXTRA_QUIZ.items():
    QUIZ.setdefault(_category, []).extend(_rows)
for _category, _rows in _EXTRA_TF.items():
    TF.setdefault(_category, []).extend(_rows)


IMAGE_BLUR = [
    ("cin-0004", "Cinema, Serie TV", "Sophia Loren"),
    ("cin-0005", "Cinema, Serie TV", "Roberto Benigni"),
    ("cin-0006", "Cinema, Serie TV", "Tom Cruise"),
    ("cin-0007", "Cinema, Serie TV", "Meryl Streep"),
    ("mus-0003", "Musica", "Vasco Rossi"),
    ("mus-0004", "Musica", "Taylor Swift"),
]


def build() -> dict:
    rng = random.Random(20261105)
    questions: list[dict] = []

    for category in CATEGORIES:
        for index, (question, correct, wrong, difficulty) in enumerate(QUIZ[category], 1):
            options = [correct, *wrong]
            rng.shuffle(options)
            questions.append({
                "id": f"quiz-{SLUG[category]}-{index:02d}",
                "category": category,
                "type": "QUIZ",
                "difficulty": difficulty,
                "question": question,
                "correctAnswer": correct,
                "options": options,
                "explanation": None,
            })

        for index, (question, answer, difficulty) in enumerate(TF[category], 1):
            questions.append({
                "id": f"tf-{SLUG[category]}-{index:02d}",
                "category": category,
                "type": "TRUE_FALSE",
                "difficulty": difficulty,
                "question": question,
                "correctAnswer": answer,
                "options": ["VERO", "FALSO"],
                "explanation": None,
            })

    for index, (difficulty, question, options, correct_index) in enumerate(AIR_HOCKEY, 1):
        questions.append({
            "id": f"ah-{difficulty.lower()}-{index:02d}",
            "category": "Curiosità",
            "type": "AIR_HOCKEY",
            "difficulty": difficulty,
            "question": question,
            "correctAnswer": options[correct_index],
            "options": options,
            "explanation": None,
        })

    for question_id, category, answer in IMAGE_BLUR:
        questions.append({
            "id": question_id,
            "category": category,
            "type": "IMAGE_BLUR",
            "difficulty": "facile",
            "question": "Chi è questa persona?",
            "correctAnswer": answer,
            "options": None,
            "explanation": None,
        })

    return {
        "version": 2,
        "language": "it",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "curated-16-categories",
        "questions": questions,
    }


DIFFICULTY_BANDS = ("facile", "medio", "difficile")

# Ogni fascia di difficolta deve avere almeno questo numero di domande
# (QUIZ + Vero/Falso). Le categorie a doppio tema ne vogliono di piu.
BAND_TARGETS = {"__default__": 15, "Cinema, Serie TV": 20}


def band_totals(category: str) -> dict[str, int]:
    totals = {band: 0 for band in DIFFICULTY_BANDS}
    for row in QUIZ.get(category, []):
        totals[row[3]] = totals.get(row[3], 0) + 1
    for row in TF.get(category, []):
        totals[row[2]] = totals.get(row[2], 0) + 1
    return totals


def check_coverage() -> None:
    problems: list[str] = []
    print("Copertura per categoria e difficolta (QUIZ + Vero/Falso):")
    for category in CATEGORIES:
        target = BAND_TARGETS.get(category, BAND_TARGETS["__default__"])
        totals = band_totals(category)
        line = " | ".join(f"{band} {totals.get(band, 0)}/{target}" for band in DIFFICULTY_BANDS)
        print(f"  {category}: {line}")
        for band in DIFFICULTY_BANDS:
            if totals.get(band, 0) < target:
                problems.append(f"{category} - {band}: {totals.get(band, 0)} < {target}")
    if problems:
        raise SystemExit("Fasce di difficolta incomplete:\n  " + "\n  ".join(problems))


def main() -> None:
    check_coverage()

    bank = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for category in CATEGORIES:
        total = sum(1 for item in bank["questions"] if item["category"] == category)
        print(f"{category}: {total} domande")


if __name__ == "__main__":
    main()
