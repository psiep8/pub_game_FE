"""Temi interni delle categorie a doppio argomento.

Le categorie ufficiali a due branche ("Geografia e Viaggi", "Scienza e Spazio",
"Cinema, Serie TV"...) devono avere dieci domande per branca a ogni difficolta.
Per misurarlo serve sapere a quale branca appartiene ogni domanda: la
classificazione qui sotto e volutamente semplice e conservativa (parole chiave
del tema secondario, altrimenti tema principale). Il tema e un metadato di
copertura: non cambia come la domanda viene servita in partita.
"""

from __future__ import annotations

from typing import Optional

# categoria -> (tema principale, tema secondario, parole chiave del secondario)
THEME_SPLIT: dict[str, tuple[str, str, tuple[str, ...]]] = {
    "Geografia e Viaggi": (
        "Geografia",
        "Viaggi",
        ("monumento", "viaggio", "viaggi", "turismo", "turisti", "aeroporto", "crociera",
         "itinerario", "vacanza", "patrimonio", "unesco", "città d'arte", "treno"),
    ),
    "Scienza e Spazio": (
        "Scienza",
        "Spazio",
        ("pianeta", "pianeti", "stella", "stelle", "sole", "luna", "universo", "galassia",
         "orbita", "sistema solare", "anno luce", "cometa", "asteroide", "astronauta", "nasa",
         "telescopio", "buco nero", "satellite", "astronomia", "astronomica", "marte", "giove",
         "venere", "mercurio", "saturno", "nettuno", "urano", "copernico", "keplero", "eliocentrico"),
    ),
    "Natura e Animali": (
        "Animali",
        "Natura",
        ("pianta", "piante", "albero", "alberi", "fiore", "fiori", "foglia", "foglie", "radici",
         "quercia", "bambù", "foresta", "bosco", "ecosistema", "ambiente", "deserto", "clima",
         "barriera corallina", "alghe", "parassita"),
    ),
    "Cinema, Serie TV": (
        "Cinema",
        "Serie TV",
        ("serie", "sitcom", "episodio", "episodi", "stagione", "netflix", "hbo", "roy",
         "westeros", "baltimora", "hawkins", "albuquerque", "bridgerton", "succession",
         "the wire", "breaking bad", "stranger things", "friends", "the crown"),
    ),
    "TV e Spettacolo": (
        "TV",
        "Spettacolo",
        ("teatro", "concerto", "spettacolo", "palco", "opera", "balletto", "premio", "festival",
         "attore", "cantante", "tour", "regista"),
    ),
    "Arte e Architettura": (
        "Arte",
        "Architettura",
        ("palazzo", "chiesa", "duomo", "cattedrale", "ponte", "torre", "edificio", "architetto",
         "architettonico", "cupola", "basilica", "tempio", "grattacielo", "anfiteatro", "colosseo",
         "partenone"),
    ),
    "Politica e Attualità": (
        "Politica",
        "Attualità",
        ("oggi", "recente", "attuale", "cronaca", "inflazione", "ultim'ora", "social network"),
    ),
    "Cibo e Gastronomia": (
        "Cibo",
        "Gastronomia",
        ("chef", "ristorante", "ricetta", "cucina", "piatto", "tradizione", "sous vide",
         "frollatura", "fermentazione", "salagione", "brasatura", "cottura"),
    ),
    "Lingua e Letteratura": (
        "Letteratura",
        "Lingua",
        ("plurale", "articolo", "avverbio", "verbo", "congiuntivo", "sillabe", "punteggiatura",
         "grammatica", "sinonimo", "apostrofo", "alfabeto", "figura retorica", "endecasillabo",
         "vocale", "vocali", "significato"),
    ),
    "Anime e manga": (
        "Anime",
        "Manga",
        ("manga", "capitolo", "pubblicato", "tankobon", "shonen", "shojo"),
    ),
    "Gaming e Tecnologia": (
        "Gaming",
        "Tecnologia",
        ("internet", "rete", "software", "protocollo", "processore", "bit", "gpu", "cloud",
         "browser", "sistema operativo", "wi-fi", "wifi", "intelligenza artificiale", "cyber",
         "password", "server", "memoria", "ram", "algoritmo", "hacker", "informatica",
         "digitale", "html", "dns", "tcp", "ssd", "phishing", "crittografia"),
    ),
}

SINGLE_THEME_CATEGORIES = ("Storia", "Sport", "Musica", "Motori", "Curiosità")


def themes_for(category: str) -> Optional[tuple[str, str]]:
    split = THEME_SPLIT.get(category)
    return None if split is None else (split[0], split[1])


def theme_for(category: str, question: str, answer: str) -> Optional[str]:
    split = THEME_SPLIT.get(category)
    if split is None:
        return None
    primary, secondary, keywords = split
    text = f"{question} {answer}".lower()
    if any(keyword in text for keyword in keywords):
        return secondary
    return primary
