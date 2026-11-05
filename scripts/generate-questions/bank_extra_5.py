"""Espansione della banca domande - blocco 5.

Cinema, Serie TV e la categoria a doppio tema: 20 domande per fascia di
difficolta, divise tra film e serie televisive.
"""

from __future__ import annotations

EXTRA_QUIZ: dict[str, list[tuple[str, str, list[str], str]]] = {
    "Cinema, Serie TV": [
        ("Chi interpreta Harry Potter nei film della saga?", "Daniel Radcliffe", ["Rupert Grint", "Tom Felton", "Elijah Wood"], "facile"),
        ("Quale film Pixar racconta la storia di un pesce pagliaccio?", "Alla ricerca di Nemo", ["Toy Story", "Cars", "Up"], "facile"),
        ("Quale sitcom ha come protagonisti Ross, Rachel e Chandler?", "Friends", ["How I Met Your Mother", "The Big Bang Theory", "Seinfeld"], "facile"),
        ("Chi ha diretto Jurassic Park?", "Steven Spielberg", ["James Cameron", "George Lucas", "Ridley Scott"], "facile"),
        ("Quale attore interpreta Iron Man nel Marvel Cinematic Universe?", "Robert Downey Jr.", ["Chris Evans", "Chris Hemsworth", "Mark Ruffalo"], "facile"),
        ("In quale città immaginaria è ambientata Stranger Things?", "Hawkins", ["Derry", "Riverdale", "Silent Hill"], "facile"),
        ("Quale film ha vinto l'Oscar come miglior film nel 2020?", "Parasite", ["Joker", "1917", "Once Upon a Time in Hollywood"], "medio"),
        ("Chi interpreta la protagonista di Kill Bill?", "Uma Thurman", ["Charlize Theron", "Angelina Jolie", "Scarlett Johansson"], "medio"),
        ("Quale serie racconta la storia di un professore di chimica diventato narcotrafficante?", "Breaking Bad", ["Narcos", "Ozark", "Better Call Saul"], "medio"),
        ("Chi ha diretto Pulp Fiction?", "Quentin Tarantino", ["I fratelli Coen", "David Fincher", "Paul Thomas Anderson"], "medio"),
        ("Quale attore ha interpretato il Joker nel film del 2019?", "Joaquin Phoenix", ["Heath Ledger", "Jared Leto", "Jack Nicholson"], "medio"),
        ("Quale serie Netflix è ambientata nella società londinese dell'Ottocento?", "Bridgerton", ["The Crown", "Downton Abbey", "Outlander"], "medio"),
        ("Chi ha diretto La dolce vita?", "Federico Fellini", ["Vittorio De Sica", "Luchino Visconti", "Michelangelo Antonioni"], "medio"),
        ("Quale film Disney del 1994 racconta la storia di un cucciolo di leone?", "Il re leone", ["Tarzan", "La bella e la bestia", "Aladdin"], "medio"),
        ("Chi ha composto la colonna sonora di C'era una volta il West?", "Ennio Morricone", ["Nino Rota", "Piero Piccioni", "Luis Bacalov"], "difficile"),
        ("Quale serie racconta le vicende della famiglia Roy nell'industria dei media?", "Succession", ["Billions", "Mad Men", "The Newsroom"], "difficile"),
        ("Quale film di Kubrick è tratto da un romanzo di Anthony Burgess?", "Arancia meccanica", ["Shining", "Full Metal Jacket", "Lolita"], "difficile"),
        ("Chi ha vinto l'Oscar come miglior attrice per il film La favorita?", "Olivia Colman", ["Emma Stone", "Rachel Weisz", "Glenn Close"], "difficile"),
        ("Quale serie HBO racconta il traffico di droga a Baltimora?", "The Wire", ["I Soprano", "Oz", "Boardwalk Empire"], "difficile"),
        ("Quale film del 1972 si apre con il matrimonio di Connie Corleone?", "Il Padrino", ["Quei bravi ragazzi", "C'era una volta in America", "Il padrino - Parte II"], "difficile"),
        ("Quale regista ha girato Inception e Interstellar?", "Christopher Nolan", ["Denis Villeneuve", "Ridley Scott", "J. J. Abrams"], "difficile"),
        ("Quale serie distopica è tratta da un romanzo di Margaret Atwood?", "The Handmaid's Tale", ["Black Mirror", "Altered Carbon", "3%"], "difficile"),
        ("Quale film dello Studio Ghibli ha vinto l'Oscar nel 2003?", "La città incantata", ["Il mio vicino Totoro", "Principessa Mononoke", "Ponyo"], "difficile"),
        ("Quale attore ha interpretato il protagonista di Il gladiatore?", "Russell Crowe", ["Mel Gibson", "Brad Pitt", "Gerard Butler"], "difficile"),
    ],
}

EXTRA_TF: dict[str, list[tuple[str, str, str]]] = {
    "Cinema, Serie TV": [
        ("Titanic è un film del 1997 diretto da James Cameron.", "VERO", "facile"),
        ("Il Padrino è tratto da un romanzo di Mario Puzo.", "VERO", "facile"),
        ("Stranger Things è ambientato negli anni Ottanta.", "VERO", "facile"),
        ("Friends è una serie drammatica ambientata in ospedale.", "FALSO", "facile"),
        ("La Pixar è uno studio di animazione.", "VERO", "facile"),
        ("Parasite è il primo film non in lingua inglese a vincere l'Oscar come miglior film.", "VERO", "medio"),
        ("Breaking Bad è ambientato ad Albuquerque.", "VERO", "medio"),
        ("Il re leone della Disney riprende la trama dell'Amleto.", "VERO", "medio"),
        ("The Crown racconta la vita della regina Elisabetta II.", "VERO", "medio"),
        ("Kill Bill è stato diretto da Martin Scorsese.", "FALSO", "medio"),
        ("Ennio Morricone ha vinto l'Oscar per la colonna sonora di The Hateful Eight.", "VERO", "difficile"),
        ("Arancia meccanica è stato diretto da Stanley Kubrick.", "VERO", "difficile"),
        ("La città incantata ha vinto l'Oscar come miglior film d'animazione nel 2003.", "VERO", "difficile"),
        ("The Wire è ambientato a Chicago.", "FALSO", "difficile"),
        ("Succession racconta le vicende di una famiglia proprietaria di un impero mediatico.", "VERO", "difficile"),
        ("Joaquin Phoenix ha interpretato il Joker nel film del 2019.", "VERO", "difficile"),
    ],
}
