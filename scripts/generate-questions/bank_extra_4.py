"""Espansione della banca domande - blocco 4.

Copre Gaming e Tecnologia, Curiosita, TV e Spettacolo e chiude le fasce rimaste
scoperte di Sport, Natura e Animali, Cibo e Gastronomia, Anime e manga.
"""

from __future__ import annotations

EXTRA_QUIZ: dict[str, list[tuple[str, str, list[str], str]]] = {
    "Gaming e Tecnologia": [
        ("Quale azienda ha creato la console PlayStation?", "Sony", ["Nintendo", "Microsoft", "Sega"], "facile"),
        ("Quale social network ha avuto come logo un uccellino azzurro?", "Twitter", ["Instagram", "TikTok", "LinkedIn"], "facile"),
        ("Quale azienda ha sviluppato Windows?", "Microsoft", ["Apple", "Google", "IBM"], "medio"),
        ("Come si chiama il protagonista della serie The Legend of Zelda?", "Link", ["Zelda", "Ganondorf", "Navi"], "medio"),
        ("Quale browser è sviluppato da Google?", "Chrome", ["Firefox", "Safari", "Edge"], "medio"),
        ("Quale unità misura la frequenza di un processore?", "L'hertz", ["Il byte", "Il watt", "Il pixel"], "medio"),
        ("Quale console Nintendo è uscita nel 2017?", "Nintendo Switch", ["Wii U", "Nintendo 3DS", "GameCube"], "medio"),
        ("Quale linguaggio di programmazione è nato nel 1995 per la JVM?", "Java", ["C#", "Python", "Ruby"], "difficile"),
        ("Quale azienda ha creato il motore grafico Unreal Engine?", "Epic Games", ["Unity Technologies", "Valve", "id Software"], "difficile"),
        ("Quale protocollo assegna automaticamente gli indirizzi IP?", "DHCP", ["DNS", "FTP", "SMTP"], "difficile"),
        ("Quanti bit compongono un byte?", "Otto", ["Quattro", "Sedici", "Due"], "difficile"),
        ("Quale gioco di Epic Games ha reso popolare la costruzione durante una battle royale?", "Fortnite", ["PUBG", "Apex Legends", "Warzone"], "difficile"),
        ("Quale rete sociale ha superato per prima il miliardo di utenti attivi?", "Facebook", ["YouTube", "Instagram", "TikTok"], "difficile"),
        ("Quale standard di rete è conosciuto come Wi-Fi 6?", "802.11ax", ["802.11ac", "802.11n", "802.11g"], "difficile"),
        ("Quale azienda produce le schede grafiche della serie GeForce?", "NVIDIA", ["AMD", "Intel", "Qualcomm"], "difficile"),
        ("Quale famiglia di modelli è alla base di ChatGPT?", "GPT", ["BERT", "ResNet", "AlphaGo"], "difficile"),
        ("Quale console Sega uscì nel 1998 e chiuse la produzione nel 2001?", "Dreamcast", ["Saturn", "Mega Drive", "Game Gear"], "difficile"),
    ],
    "Curiosità": [
        ("Qual è l'animale più veloce in volo?", "Il falco pellegrino", ["L'aquila reale", "Il rondone", "Il gabbiano"], "facile"),
        ("Quale metallo si usa comunemente per i fili elettrici?", "Il rame", ["Il ferro", "Il piombo", "Lo zinco"], "facile"),
        ("Quanti giorni ha un anno bisestile?", "366", ["365", "364", "367"], "facile"),
        ("Quale colore si ottiene mescolando blu e giallo?", "Il verde", ["L'arancione", "Il viola", "Il marrone"], "facile"),
        ("Qual è il pianeta più grande del sistema solare?", "Giove", ["Saturno", "Nettuno", "Urano"], "medio"),
        ("Quante dita ha una mano umana?", "Cinque", ["Quattro", "Sei", "Tre"], "medio"),
        ("Quale animale ha la lingua più lunga rispetto al corpo?", "Il camaleonte", ["La giraffa", "Il formichiere", "Il serpente"], "medio"),
        ("Quanto pesa approssimativamente un litro d'acqua?", "Un chilogrammo", ["Mezzo chilogrammo", "Due chilogrammi", "Dieci grammi"], "medio"),
        ("Qual è l'edificio più alto del mondo?", "Il Burj Khalifa", ["La Torre di Shanghai", "Il One World Trade Center", "Il Taipei 101"], "difficile"),
        ("Quante ossa compongono la mano umana?", "27", ["18", "32", "40"], "difficile"),
        ("Quale metallo è più prezioso dell'oro?", "Il rodio", ["L'argento", "Il platino", "Il palladio"], "difficile"),
        ("Qual è l'oceano più profondo in media?", "Il Pacifico", ["L'Atlantico", "L'Indiano", "L'Artico"], "difficile"),
        ("Quanti cromosomi ha una cellula umana?", "46", ["23", "48", "52"], "difficile"),
        ("Quale Paese ha il maggior numero di isole al mondo?", "La Svezia", ["L'Indonesia", "Le Filippine", "Il Canada"], "difficile"),
        ("Quale unità di misura corrisponde a zero sul meridiano di Greenwich?", "UTC", ["CET", "GMT+1", "EST"], "difficile"),
    ],
    "TV e Spettacolo": [
        ("Quale conduttore ha presentato il Festival di Sanremo nel 2021 e nel 2022?", "Amadeus", ["Carlo Conti", "Pippo Baudo", "Fabio Fazio"], "facile"),
        ("In quale regione si tiene il Festival di Sanremo?", "In Liguria", ["In Emilia-Romagna", "In Campania", "In Piemonte"], "facile"),
        ("Quale programma Rai è un quiz di cultura generale condotto da Carlo Conti?", "L'eredità", ["Affari tuoi", "Ballando con le stelle", "Porta a Porta"], "facile"),
        ("Chi conduce Porta a Porta?", "Bruno Vespa", ["Maurizio Costanzo", "Enrico Mentana", "Gianni Letta"], "medio"),
        ("Quale reality show rinchiude i concorrenti in una casa isolata?", "Il Grande Fratello", ["L'isola dei famosi", "Pechino Express", "Ciao Darwin"], "medio"),
        ("Quale serie italiana racconta le vicende della criminalità a Napoli?", "Gomorra", ["Suburra", "Il commissario Montalbano", "Romanzo criminale"], "medio"),
        ("Quale premio viene assegnato al miglior film alla Mostra di Venezia?", "Il Leone d'oro", ["L'Orso d'oro", "La Palma d'oro", "L'Oscar"], "medio"),
        ("Chi conduce Chi l'ha visto? da molti anni?", "Federica Sciarelli", ["Milena Gabanelli", "Lilli Gruber", "Bianca Berlinguer"], "medio"),
        ("Quale serie televisiva è ambientata a Westeros?", "Il Trono di Spade", ["Vikings", "The Witcher", "Rome"], "difficile"),
        ("In quale anno è andato in onda il primo episodio di Twin Peaks?", "1990", ["1985", "1995", "2000"], "difficile"),
        ("Quale attore interpreta il Dottor House nella serie House?", "Hugh Laurie", ["Hugh Grant", "Benedict Cumberbatch", "Michael Sheen"], "difficile"),
        ("Quale serie italiana ha come protagonista un commissario interpretato da Luca Zingaretti?", "Il commissario Montalbano", ["La piovra", "Gomorra", "Il capo dei capi"], "difficile"),
        ("Quale show di Rai 1 mette in gara personaggi famosi nel ballo?", "Ballando con le stelle", ["Amici", "Tu si que vales", "Tale e quale show"], "difficile"),
        ("Quale serie spagnola di Netflix racconta una rapina alla Zecca?", "La casa di carta", ["Élite", "Vis a vis", "Narcos"], "difficile"),
        ("Quale attore ha interpretato il commissario Cattani ne La piovra?", "Michele Placido", ["Luca Zingaretti", "Raoul Bova", "Kim Rossi Stuart"], "difficile"),
        ("Chi ha condotto Le Iene con Ilary Blasi nei primi anni Duemila?", "Teo Mammucari", ["Luciana Littizzetto", "Paola Cortellesi", "Sabrina Ferilli"], "difficile"),
    ],
    "Sport": [
        ("Quale nazione ha vinto il Mondiale di calcio del 2014?", "La Germania", ["L'Argentina", "Il Brasile", "L'Olanda"], "medio"),
    ],
    "Anime e manga": [],
}

EXTRA_TF: dict[str, list[tuple[str, str, str]]] = {
    "Gaming e Tecnologia": [
        ("Android è un sistema operativo per dispositivi mobili.", "VERO", "facile"),
        ("Il Wi-Fi è una tecnologia di rete senza fili.", "VERO", "medio"),
        ("Lo smartphone è stato inventato prima del personal computer.", "FALSO", "medio"),
        ("La RAM è una memoria volatile.", "VERO", "medio"),
        ("Il linguaggio Python è stato creato da Guido van Rossum.", "VERO", "difficile"),
        ("Il protocollo HTTPS cifra il traffico tramite TLS.", "VERO", "difficile"),
        ("La fibra ottica trasmette i dati tramite impulsi elettrici.", "FALSO", "difficile"),
        ("Un algoritmo di machine learning può essere addestrato su dati etichettati.", "VERO", "difficile"),
    ],
    "Curiosità": [
        ("Un anno bisestile ha 366 giorni.", "VERO", "facile"),
        ("Il colore viola si ottiene mescolando blu e rosso.", "VERO", "facile"),
        ("Il Sole sorge a ovest.", "FALSO", "facile"),
        ("Un litro d'acqua pesa circa un chilogrammo.", "VERO", "medio"),
        ("Il falco pellegrino è l'animale più veloce in volo.", "VERO", "medio"),
        ("Il ghiaccio occupa meno volume dell'acqua liquida.", "FALSO", "medio"),
        ("La Torre Eiffel fu costruita per l'Esposizione universale del 1889.", "VERO", "difficile"),
        ("Il rodio è più prezioso dell'oro.", "VERO", "difficile"),
        ("Un anno luce misura circa 9.460 miliardi di chilometri.", "VERO", "difficile"),
        ("In montagna l'acqua bolle a una temperatura più bassa che al mare.", "VERO", "difficile"),
    ],
    "TV e Spettacolo": [
        ("Il Festival di Sanremo si svolge in Liguria.", "VERO", "facile"),
        ("La Rai è una televisione privata.", "FALSO", "facile"),
        ("Il Leone d'oro è il premio della Mostra del cinema di Venezia.", "VERO", "medio"),
        ("Il Grande Fratello è un reality show.", "VERO", "medio"),
        ("Mediaset appartiene al gruppo Rai.", "FALSO", "medio"),
        ("Twin Peaks è stato creato da David Lynch.", "VERO", "difficile"),
        ("Il Trono di Spade è tratto dai romanzi di J. R. R. Tolkien.", "FALSO", "difficile"),
        ("Il Festival di Sanremo nasce nel 1951.", "VERO", "difficile"),
        ("La serie Gomorra è ambientata a Palermo.", "FALSO", "difficile"),
    ],
    "Natura e Animali": [
        ("Il koala si nutre principalmente di foglie di eucalipto.", "VERO", "medio"),
    ],
    "Cibo e Gastronomia": [
        ("Il riso per il risotto si tosta prima di aggiungere il brodo.", "VERO", "difficile"),
    ],
    "Anime e manga": [
        ("Il manga Naruto è stato creato da Masashi Kishimoto.", "VERO", "difficile"),
    ],
}
