"""Espansione della banca domande - blocco 6.

Completa le branche Geografia e Viaggi / Viaggi, Natura e Animali / Natura,
Scienza e Spazio / Spazio con il tema dichiarato esplicitamente.
"""

from __future__ import annotations

EXTRA_THEMED_QUIZ: dict[str, list[tuple[str, str, list[str], str]]] = {
    "Geografia e Viaggi|Viaggi": [
        ("Quale monumento simbolo di Parigi è una torre di ferro?", "La Torre Eiffel", ["L'Arco di Trionfo", "Il Sacro Cuore", "Notre-Dame"], "facile"),
        ("Quale monumento italiano è una torre pendente meta di turisti?", "La Torre di Pisa", ["Il Duomo di Milano", "Il Ponte Vecchio", "Castel del Monte"], "facile"),
        ("Quale città è famosa per i canali e le gondole?", "Venezia", ["Genova", "Bari", "Trieste"], "facile"),
        ("In quale città si trova il Colosseo, meta turistica di Roma?", "Roma", ["Atene", "Istanbul", "Siviglia"], "facile"),
        ("Quale struttura turistica offre pernottamento e colazione?", "Il bed and breakfast", ["Il campeggio", "L'ostello della gioventù", "Il resort"], "facile"),
        ("Quale città spagnola è celebre per la Sagrada Família?", "Barcellona", ["Madrid", "Siviglia", "Valencia"], "medio"),
        ("Quale monumento di Agra è patrimonio UNESCO e mausoleo?", "Il Taj Mahal", ["Il Forte Rosso", "Il Qutb Minar", "Il palazzo di Jaipur"], "medio"),
        ("Quale città europea è nota per il Ponte Carlo e il castello?", "Praga", ["Budapest", "Vienna", "Cracovia"], "medio"),
        ("Quale isola italiana è meta di turismo vulcanico con l'Etna?", "La Sicilia", ["La Sardegna", "Capri", "L'Elba"], "medio"),
        ("Quale città giapponese è celebre per i templi vicino al monte Fuji?", "Kyoto", ["Osaka", "Sapporo", "Nagoya"], "medio"),
        ("Quale sito turco è famoso per le rocce a cono della Cappadocia?", "Göreme", ["Efeso", "Pamukkale", "Troia"], "difficile"),
        ("Quale parco nazionale africano è celebre per la migrazione degli gnu?", "Il Serengeti", ["Il Kruger", "Il Chobe", "L'Etosha"], "difficile"),
        ("Quale capitale europea è attraversata dal Danubio e ha il castello di Buda?", "Budapest", ["Belgrado", "Vienna", "Bratislava"], "difficile"),
        ("Quale treno turistico svizzero attraversa il passo del Bernina?", "Il Bernina Express", ["Il Glacier Express", "Il Treno Rosso", "L'Orient Express"], "difficile"),
        ("Quale arcipelago norvegese è noto per il sole di mezzanotte e i fiordi?", "Le Lofoten", ["Le Shetland", "Le Orcadi", "Le Ebridi"], "difficile"),
    ],
    "Scienza e Spazio|Scienza": [
        ("Quale strumento misura la temperatura?", "Il termometro", ["Il barometro", "L'igrometro", "L'anemometro"], "facile"),
    ],
    "Scienza e Spazio|Spazio": [
        ("Qual è il satellite naturale della Terra?", "La Luna", ["Marte", "Titano", "Europa"], "facile"),
        ("Quale pianeta è noto come pianeta rosso?", "Marte", ["Venere", "Giove", "Mercurio"], "facile"),
        ("Quale agenzia spaziale portò l'uomo sulla Luna nel 1969?", "La NASA", ["L'ESA", "Roscosmos", "JAXA"], "medio"),
        ("Qual è la stella più vicina alla Terra dopo il Sole?", "Proxima Centauri", ["Sirio", "Alpha Centauri A", "Betelgeuse"], "medio"),
        ("Quale pianeta ha il periodo orbitale più lungo del sistema solare?", "Nettuno", ["Urano", "Saturno", "Giove"], "medio"),
        ("Come si chiama la galassia in cui si trova il sistema solare?", "La Via Lattea", ["Andromeda", "Il Triangolo", "La galassia del Sombrero"], "medio"),
        ("Quale missione portò per la prima volta un rover su Marte nel 1997?", "Pathfinder", ["Spirit", "Opportunity", "Curiosity"], "difficile"),
        ("Qual è il nome del telescopio spaziale lanciato nel 2021?", "James Webb", ["Hubble", "Keplero", "Spitzer"], "difficile"),
        ("Quale temperatura ha approssimativamente la superficie del Sole?", "Circa 5.500 °C", ["Circa 500 °C", "Circa 55.000 °C", "Circa 150 °C"], "difficile"),
    ],
    "Natura e Animali|Natura": [
        ("Quale parte della pianta produce i semi?", "Il fiore", ["La radice", "Il fusto", "La foglia"], "facile"),
        ("Quale gas rilasciano le piante durante la fotosintesi?", "L'ossigeno", ["L'anidride carbonica", "L'azoto", "Il metano"], "facile"),
        ("Quale foresta pluviale è la più estesa del pianeta?", "L'Amazzonia", ["Il Congo", "Il Borneo", "La Nuova Guinea"], "medio"),
        ("Quale fenomeno atmosferico è legato ai gas serra?", "L'effetto serra", ["L'aurora boreale", "La marea", "Il vento solare"], "medio"),
        ("Quale processo trasforma l'azoto atmosferico in forme usabili dalle piante?", "La fissazione dell'azoto", ["La fotosintesi", "La respirazione", "La traspirazione"], "difficile"),
        ("Quale biome è caratterizzato da permafrost e vegetazione bassa?", "La tundra", ["La taiga", "La savana", "La steppa"], "difficile"),
        ("Quale pianta carnivora cattura gli insetti con foglie a trappola?", "La dionea", ["La drosera", "La nepente", "La sarracenia"], "difficile"),
        ("Quale livello trofico occupano i funghi decompositori?", "I decompositori", ["I produttori", "I consumatori primari", "I consumatori secondari"], "difficile"),
        ("Quale accordo internazionale del 1997 riguarda la riduzione dei gas serra?", "Il protocollo di Kyoto", ["L'accordo di Parigi", "La convenzione di Ramsar", "Il protocollo di Montreal"], "difficile"),
    ],
}

EXTRA_THEMED_TF: dict[str, list[tuple[str, str, str]]] = {
    "Geografia e Viaggi|Viaggi": [
        ("Il Colosseo è una delle mete turistiche più visitate d'Italia.", "VERO", "facile"),
        ("La Torre Eiffel si trova a Londra.", "FALSO", "facile"),
        ("Un volo diretto non prevede scali intermedi.", "VERO", "facile"),
        ("Il passaporto serve per i viaggi verso molti Paesi extraeuropei.", "VERO", "facile"),
        ("Il turismo religioso porta visitatori a Lourdes e a Fatima.", "VERO", "facile"),
        ("Il Machu Picchu si trova in Perù.", "VERO", "medio"),
        ("Il Canale di Panama collega l'Atlantico al Pacifico.", "VERO", "medio"),
        ("La Cappadocia è famosa per le sue mongolfiere.", "VERO", "medio"),
        ("Il museo del Louvre si trova a Londra.", "FALSO", "medio"),
        ("Il Cammino di Santiago termina a Santiago de Compostela.", "VERO", "medio"),
        ("Il Glacier Express collega Zermatt a Sankt Moritz.", "VERO", "difficile"),
        ("Il Parco nazionale di Yellowstone si trova negli Stati Uniti.", "VERO", "difficile"),
        ("Il deserto del Wadi Rum è in Giordania.", "VERO", "difficile"),
        ("Il Machu Picchu è stato costruito dai Maya.", "FALSO", "difficile"),
        ("L'isola di Pasqua appartiene al Cile.", "VERO", "difficile"),
    ],
    "Scienza e Spazio|Spazio": [
        ("Il sistema solare ha otto pianeti.", "VERO", "facile"),
        ("La Luna è più grande della Terra.", "FALSO", "facile"),
        ("La luce del Sole impiega circa otto minuti a raggiungere la Terra.", "VERO", "medio"),
        ("Plutone è ancora considerato un pianeta del sistema solare.", "FALSO", "medio"),
        ("Un'eclissi solare avviene quando la Luna si frappone tra Sole e Terra.", "VERO", "medio"),
        ("Il buco nero al centro della Via Lattea si chiama Sagittarius A*.", "VERO", "difficile"),
        ("La sonda Voyager 1 ha superato l'eliopausa.", "VERO", "difficile"),
    ],
    "Natura e Animali|Natura": [
        ("Le foglie servono alla pianta per la fotosintesi.", "VERO", "facile"),
        ("Il bambù è una pianta che cresce molto lentamente.", "FALSO", "facile"),
        ("Le radici assorbono acqua e sali minerali.", "VERO", "facile"),
        ("Le foreste tropicali ospitano gran parte della biodiversità terrestre.", "VERO", "medio"),
        ("La deforestazione aumenta la capacità del suolo di trattenere acqua.", "FALSO", "medio"),
        ("Il Sahara era una savana verde migliaia di anni fa.", "VERO", "medio"),
        ("Il permafrost è un terreno ghiacciato per almeno due anni consecutivi.", "VERO", "difficile"),
        ("La tundra si trova solo nell'emisfero australe.", "FALSO", "difficile"),
        ("I licheni sono organismi simbiotici tra funghi e alghe.", "VERO", "difficile"),
        ("Le piante carnivore ricavano l'energia dagli insetti e non dalla fotosintesi.", "FALSO", "difficile"),
    ],
}
