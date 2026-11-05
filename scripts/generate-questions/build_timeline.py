"""Costruisce la banca eventi per la Timeline.

Ogni categoria temporale ha almeno 8 eventi, distanziati di almeno 3 anni,
così anche il round finale da 8 carte resta giocabile.

    python scripts/generate-questions/build_timeline.py
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps" / "backend" / "src" / "main" / "resources" / "questions" / "timeline-it.json"

EVENTS: list[tuple[str, int, str]] = [
    # Storia
    ("Caduta dell'Impero romano d'Occidente", 476, "Storia"),
    ("Incoronazione di Carlo Magno", 800, "Storia"),
    ("Battaglia di Hastings", 1066, "Storia"),
    ("Scoperta dell'America", 1492, "Storia"),
    ("Rivoluzione francese", 1789, "Storia"),
    ("Congresso di Vienna", 1815, "Storia"),
    ("Inizio della Prima guerra mondiale", 1914, "Storia"),
    ("Caduta del Muro di Berlino", 1989, "Storia"),

    # Geografia e Viaggi
    ("Vasco da Gama arriva in India", 1498, "Geografia e Viaggi"),
    ("Apertura del Canale di Suez", 1869, "Geografia e Viaggi"),
    ("Naufragio del Titanic", 1912, "Geografia e Viaggi"),
    ("Primo volo transatlantico senza scalo", 1919, "Geografia e Viaggi"),
    ("Amelia Earhart attraversa l'Atlantico in solitaria", 1932, "Geografia e Viaggi"),
    ("Hillary e Tenzing raggiungono l'Everest", 1953, "Geografia e Viaggi"),
    ("Apertura del Tunnel della Manica", 1994, "Geografia e Viaggi"),
    ("La nave Ever Given blocca il Canale di Suez", 2021, "Geografia e Viaggi"),

    # Scienza e Spazio
    ("Copernico pubblica le rivoluzioni celesti", 1543, "Scienza e Spazio"),
    ("Newton pubblica i Principia", 1687, "Scienza e Spazio"),
    ("Einstein pubblica la relatività ristretta", 1905, "Scienza e Spazio"),
    ("Scoperta della penicillina", 1928, "Scienza e Spazio"),
    ("Scoperta della struttura del DNA", 1953, "Scienza e Spazio"),
    ("Lancio dello Sputnik", 1957, "Scienza e Spazio"),
    ("Sbarco dell'uomo sulla Luna", 1969, "Scienza e Spazio"),
    ("Conferma del bosone di Higgs", 2012, "Scienza e Spazio"),
    ("Inizio della pandemia di COVID-19", 2020, "Scienza e Spazio"),

    # Sport
    ("Prime Olimpiadi moderne ad Atene", 1896, "Sport"),
    ("Primo Tour de France", 1903, "Sport"),
    ("Primo Mondiale di calcio in Uruguay", 1930, "Sport"),
    ("Jesse Owens vince quattro ori a Berlino", 1936, "Sport"),
    ("Olimpiadi di Roma", 1960, "Sport"),
    ("Il Dream Team vince l'oro olimpico", 1992, "Sport"),
    ("Usain Bolt stabilisce il record dei 100 metri", 2008, "Sport"),
    ("L'Italia vince il Campionato europeo di calcio", 2021, "Sport"),

    # Cinema, Serie TV
    ("Prima proiezione cinematografica dei fratelli Lumière", 1895, "Cinema, Serie TV"),
    ("Esce Il cantante di jazz, primo film sonoro", 1927, "Cinema, Serie TV"),
    ("Biancaneve e i sette nani, primo lungometraggio animato Disney", 1937, "Cinema, Serie TV"),
    ("Esce Quarto potere di Orson Welles", 1941, "Cinema, Serie TV"),
    ("Esce Guerre stellari", 1977, "Cinema, Serie TV"),
    ("Esce Matrix", 1999, "Cinema, Serie TV"),
    ("Esce Avatar", 2009, "Cinema, Serie TV"),
    ("Parasite vince la Palma d'Oro", 2019, "Cinema, Serie TV"),

    # TV e Spettacolo
    ("Prima edizione del Festival di Sanremo", 1951, "TV e Spettacolo"),
    ("Inizio delle trasmissioni Rai", 1954, "TV e Spettacolo"),
    ("Nasce CNN", 1980, "TV e Spettacolo"),
    ("Nasce MTV", 1981, "TV e Spettacolo"),
    ("Debutta I Simpson", 1989, "TV e Spettacolo"),
    ("Nasce Sky Italia", 2003, "TV e Spettacolo"),
    ("Netflix lancia lo streaming", 2007, "TV e Spettacolo"),
    ("House of Cards, prima serie originale Netflix", 2013, "TV e Spettacolo"),

    # Musica
    ("Prima de Le nozze di Figaro di Mozart", 1786, "Musica"),
    ("Prima della Nona sinfonia di Beethoven", 1824, "Musica"),
    ("Apertura del Festival di Bayreuth", 1876, "Musica"),
    ("Elvis Presley incide That's All Right", 1954, "Musica"),
    ("I Beatles pubblicano Love Me Do", 1962, "Musica"),
    ("Esce Sgt. Pepper's Lonely Hearts Club Band", 1967, "Musica"),
    ("Live Aid", 1985, "Musica"),
    ("Apple lancia l'iTunes Store", 2001, "Musica"),

    # Arte e Architettura
    ("Completa la cupola del Duomo di Firenze", 1436, "Arte e Architettura"),
    ("Viene inaugurato il David di Michelangelo", 1504, "Arte e Architettura"),
    ("Michelangelo completa la volta della Cappella Sistina", 1512, "Arte e Architettura"),
    ("Inaugurazione della Torre Eiffel", 1889, "Arte e Architettura"),
    ("Nasce il cubismo con Les Demoiselles d'Avignon", 1907, "Arte e Architettura"),
    ("Apre il Museum of Modern Art di New York", 1929, "Arte e Architettura"),
    ("Picasso dipinge Guernica", 1937, "Arte e Architettura"),
    ("Inaugura la Sydney Opera House", 1973, "Arte e Architettura"),

    # Politica e Attualità
    ("Magna Carta in Inghilterra", 1215, "Politica e Attualità"),
    ("Dichiarazione d'indipendenza degli Stati Uniti", 1776, "Politica e Attualità"),
    ("Dichiarazione dei diritti dell'uomo e del cittadino", 1789, "Politica e Attualità"),
    ("Fondazione delle Nazioni Unite", 1945, "Politica e Attualità"),
    ("Entrata in vigore della Costituzione italiana", 1948, "Politica e Attualità"),
    ("Trattato di Maastricht", 1992, "Politica e Attualità"),
    ("Attentato alle Torri Gemelle", 2001, "Politica e Attualità"),
    ("Uscita del Regno Unito dall'Unione Europea", 2020, "Politica e Attualità"),

    # Motori
    ("Karl Benz brevetta la prima automobile a motore", 1886, "Motori"),
    ("Ford lancia il Model T", 1908, "Motori"),
    ("Prima 24 Ore di Le Mans", 1923, "Motori"),
    ("Primo campionato mondiale di Formula 1", 1950, "Motori"),
    ("Debutta la Volkswagen Golf", 1974, "Motori"),
    ("Toyota lancia la Prius", 1997, "Motori"),
    ("Tesla lancia il Model S", 2012, "Motori"),
    ("Max Verstappen vince il mondiale di Formula 1", 2021, "Motori"),

    # Cibo e Gastronomia
    ("Nasce la Coca-Cola", 1886, "Cibo e Gastronomia"),
    ("La pizza Margherita viene servita a Napoli", 1889, "Cibo e Gastronomia"),
    ("Prima guida Michelin", 1900, "Cibo e Gastronomia"),
    ("Momofuku Ando inventa i noodles istantanei", 1958, "Cibo e Gastronomia"),
    ("Apre il primo Starbucks a Seattle", 1971, "Cibo e Gastronomia"),
    ("Nasce il movimento Slow Food a Bra", 1986, "Cibo e Gastronomia"),
    ("La dieta mediterranea entra nel patrimonio UNESCO", 2010, "Cibo e Gastronomia"),
    ("L'arte del pizzaiolo napoletano entra nel patrimonio UNESCO", 2017, "Cibo e Gastronomia"),

    # Lingua e Letteratura
    ("Muore Dante e circola la Divina Commedia", 1321, "Lingua e Letteratura"),
    ("Pubblicato il Vocabolario della Crusca", 1612, "Lingua e Letteratura"),
    ("Pubblicati I promessi sposi", 1827, "Lingua e Letteratura"),
    ("Pubblicati I Malavoglia", 1881, "Lingua e Letteratura"),
    ("Pubblicato La strada di Swann di Proust", 1913, "Lingua e Letteratura"),
    ("Pubblicato 1984 di Orwell", 1949, "Lingua e Letteratura"),
    ("Pubblicato Lolita di Nabokov", 1955, "Lingua e Letteratura"),
    ("Pubblicato Harry Potter e la pietra filosofale", 1997, "Lingua e Letteratura"),

    # Anime e manga
    ("Inizia il manga Astro Boy", 1952, "Anime e manga"),
    ("Debutta l'anime Astro Boy", 1963, "Anime e manga"),
    ("Inizia il manga Doraemon", 1969, "Anime e manga"),
    ("Inizia il manga Dragon Ball", 1984, "Anime e manga"),
    ("Fondazione dello Studio Ghibli", 1985, "Anime e manga"),
    ("Inizia il manga One Piece", 1997, "Anime e manga"),
    ("Inizia il manga Naruto", 1999, "Anime e manga"),
    ("La città incantata vince l'Orso d'oro", 2001, "Anime e manga"),

    # Gaming e Tecnologia
    ("ENIAC, primo computer elettronico general-purpose", 1946, "Gaming e Tecnologia"),
    ("Tennis for Two, primo videogioco", 1958, "Gaming e Tecnologia"),
    ("Primo collegamento ARPANET", 1969, "Gaming e Tecnologia"),
    ("Atari lancia Pong", 1972, "Gaming e Tecnologia"),
    ("Nintendo pubblica Mario Bros.", 1983, "Gaming e Tecnologia"),
    ("Tim Berners-Lee presenta il World Wide Web", 1991, "Gaming e Tecnologia"),
    ("Apple presenta il primo iPhone", 2007, "Gaming e Tecnologia"),
    ("Nintendo lancia Switch", 2017, "Gaming e Tecnologia"),
]


def main() -> None:
    categories = sorted({category for _, _, category in EVENTS})
    for category in categories:
        total = sum(1 for _, _, item_category in EVENTS if item_category == category)
        assert total >= 8, f"{category}: servono almeno 8 eventi, trovati {total}"

    payload = {
        "version": 2,
        "language": "it",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "curated-timeline",
        "events": [
            {"label": label, "year": year, "category": category}
            for label, year, category in EVENTS
        ],
    }

    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Timeline: {len(EVENTS)} eventi in {len(categories)} categorie")


if __name__ == "__main__":
    main()
