"""Costruisce la banca numerica di Azzardo.

Quattro categorie (celebrità, canzoni, paesi, storia) per tre livelli, trenta
domande per categoria e livello. Il file prodotto è
apps/backend/src/main/resources/questions/azzardo-it.json e viene letto da
QuestionBankService: nessuna chiamata esterna a runtime.

I conteggi dei confini non sono scritti a mano: si calcolano dalle liste di
vicini qui sotto, così un errore di conteggio salta subito all'occhio.

    python scripts/generate-questions/build_azzardo_bank.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps" / "backend" / "src" / "main" / "resources" / "questions" / "azzardo-it.json"
TARGET = 30

CELEBRITIES = {
    1: [
        ("Albert Einstein", 1879),
        ("Marilyn Monroe", 1926),
        ("Elvis Presley", 1935),
        ("Michael Jackson", 1958),
        ("Lady Diana", 1961),
        ("Barack Obama", 1961),
        ("John Lennon", 1940),
        ("Freddie Mercury", 1946),
        ("Madonna", 1958),
        ("David Bowie", 1947),
        ("Nelson Mandela", 1918),
        ("Mahatma Gandhi", 1869),
        ("John Fitzgerald Kennedy", 1917),
        ("Charlie Chaplin", 1889),
        ("Audrey Hepburn", 1929),
        ("Bruce Lee", 1940),
        ("Pelé", 1940),
        ("Diego Armando Maradona", 1960),
        ("Muhammad Ali", 1942),
        ("Steve Jobs", 1955),
        ("Bill Gates", 1955),
        ("J.K. Rowling", 1965),
        ("Steven Spielberg", 1946),
        ("Robert De Niro", 1943),
        ("Al Pacino", 1940),
        ("Harrison Ford", 1942),
        ("Julia Roberts", 1967),
        ("Tom Hanks", 1956),
        ("Jim Carrey", 1962),
        ("Robin Williams", 1951),
    ],
    2: [
        ("Johnny Depp", 1963),
        ("Angelina Jolie", 1975),
        ("Morgan Freeman", 1937),
        ("Samuel L. Jackson", 1948),
        ("Whoopi Goldberg", 1955),
        ("Eddie Murphy", 1961),
        ("Will Smith", 1968),
        ("Denzel Washington", 1954),
        ("Nicole Kidman", 1967),
        ("Kate Winslet", 1975),
        ("Natalie Portman", 1981),
        ("Emma Watson", 1990),
        ("Daniel Radcliffe", 1989),
        ("Rupert Grint", 1988),
        ("Robert Pattinson", 1986),
        ("Kristen Stewart", 1990),
        ("Taylor Swift", 1989),
        ("Adele", 1988),
        ("Rihanna", 1988),
        ("Shakira", 1977),
        ("Jennifer Lopez", 1969),
        ("Eminem", 1972),
        ("Jay-Z", 1969),
        ("Kanye West", 1977),
        ("Drake", 1986),
        ("Bruno Mars", 1985),
        ("Ed Sheeran", 1991),
        ("Ariana Grande", 1993),
        ("Billie Eilish", 2001),
        ("Miley Cyrus", 1992),
    ],
    3: [
        ("Stephen Hawking", 1942),
        ("Alan Turing", 1912),
        ("Marie Curie", 1867),
        ("Nikola Tesla", 1856),
        ("Charles Darwin", 1809),
        ("Leonardo da Vinci", 1452),
        ("Michelangelo Buonarroti", 1475),
        ("Galileo Galilei", 1564),
        ("Wolfgang Amadeus Mozart", 1756),
        ("Ludwig van Beethoven", 1770),
        ("Vincent van Gogh", 1853),
        ("Pablo Picasso", 1881),
        ("Salvador Dalí", 1904),
        ("Frida Kahlo", 1907),
        ("Ernest Hemingway", 1899),
        ("George Orwell", 1903),
        ("Franz Kafka", 1883),
        ("Agatha Christie", 1890),
        ("J.R.R. Tolkien", 1892),
        ("C.S. Lewis", 1898),
        ("H.P. Lovecraft", 1890),
        ("Edgar Allan Poe", 1809),
        ("Charles Dickens", 1812),
        ("Victor Hugo", 1802),
        ("Jane Austen", 1775),
        ("Arthur Conan Doyle", 1859),
        ("Jules Verne", 1828),
        ("Herman Melville", 1819),
        ("Mary Shelley", 1797),
        ("Bram Stoker", 1847),
    ],
}

SONGS = {
    1: [
        ("Imagine", "John Lennon", 1971),
        ("Bohemian Rhapsody", "Queen", 1975),
        ("Billie Jean", "Michael Jackson", 1983),
        ("Like a Prayer", "Madonna", 1989),
        ("Smells Like Teen Spirit", "Nirvana", 1991),
        ("Wonderwall", "Oasis", 1995),
        ("Hey Jude", "The Beatles", 1968),
        ("Let It Be", "The Beatles", 1970),
        ("Yesterday", "The Beatles", 1965),
        ("Hotel California", "Eagles", 1976),
        ("Thriller", "Michael Jackson", 1982),
        ("Beat It", "Michael Jackson", 1982),
        ("Sweet Dreams", "Eurythmics", 1983),
        ("Every Breath You Take", "The Police", 1983),
        ("With or Without You", "U2", 1987),
        ("Nothing Else Matters", "Metallica", 1991),
        ("Losing My Religion", "R.E.M.", 1991),
        ("Creep", "Radiohead", 1992),
        ("Under the Bridge", "Red Hot Chili Peppers", 1991),
        ("Purple Rain", "Prince", 1984),
        ("Like a Virgin", "Madonna", 1984),
        ("Material Girl", "Madonna", 1984),
        ("Girls Just Want to Have Fun", "Cyndi Lauper", 1983),
        ("Total Eclipse of the Heart", "Bonnie Tyler", 1983),
        ("Africa", "Toto", 1982),
        ("Dancing Queen", "ABBA", 1976),
        ("Stayin' Alive", "Bee Gees", 1977),
        ("YMCA", "Village People", 1978),
        ("Roxanne", "The Police", 1978),
        ("Another Brick in the Wall", "Pink Floyd", 1979),
    ],
    2: [
        ("Stairway to Heaven", "Led Zeppelin", 1971),
        ("Black Hole Sun", "Soundgarden", 1994),
        ("Torn", "Natalie Imbruglia", 1997),
        ("...Baby One More Time", "Britney Spears", 1998),
        ("I Want It That Way", "Backstreet Boys", 1999),
        ("Bye Bye Bye", "NSYNC", 2000),
        ("In the End", "Linkin Park", 2000),
        ("How You Remind Me", "Nickelback", 2001),
        ("Lose Yourself", "Eminem", 2002),
        ("Crazy in Love", "Beyoncé", 2003),
        ("Yeah!", "Usher", 2004),
        ("Boulevard of Broken Dreams", "Green Day", 2004),
        ("Hips Don't Lie", "Shakira", 2006),
        ("Umbrella", "Rihanna", 2007),
        ("Viva la Vida", "Coldplay", 2008),
        ("Poker Face", "Lady Gaga", 2008),
        ("Bad Romance", "Lady Gaga", 2009),
        ("Rolling in the Deep", "Adele", 2010),
        ("Someone Like You", "Adele", 2011),
        ("Call Me Maybe", "Carly Rae Jepsen", 2012),
        ("Get Lucky", "Daft Punk", 2013),
        ("Happy", "Pharrell Williams", 2013),
        ("Uptown Funk", "Mark Ronson e Bruno Mars", 2014),
        ("Hello", "Adele", 2015),
        ("Shape of You", "Ed Sheeran", 2017),
        ("Despacito", "Luis Fonsi", 2017),
        ("Old Town Road", "Lil Nas X", 2019),
        ("Blinding Lights", "The Weeknd", 2019),
        ("Drivers License", "Olivia Rodrigo", 2021),
        ("As It Was", "Harry Styles", 2022),
    ],
    3: [
        ("Like a Rolling Stone", "Bob Dylan", 1965),
        ("Good Vibrations", "The Beach Boys", 1966),
        ("A Day in the Life", "The Beatles", 1967),
        ("Sympathy for the Devil", "The Rolling Stones", 1968),
        ("Space Oddity", "David Bowie", 1969),
        ("Bridge Over Troubled Water", "Simon & Garfunkel", 1970),
        ("What's Going On", "Marvin Gaye", 1971),
        ("Superstition", "Stevie Wonder", 1972),
        ("Money", "Pink Floyd", 1973),
        ("Jolene", "Dolly Parton", 1973),
        ("Born to Run", "Bruce Springsteen", 1975),
        ("Dancing in the Dark", "Bruce Springsteen", 1984),
        ("Heroes", "David Bowie", 1977),
        ("Anarchy in the U.K.", "Sex Pistols", 1976),
        ("London Calling", "The Clash", 1979),
        ("Love Will Tear Us Apart", "Joy Division", 1980),
        ("Under Pressure", "Queen e David Bowie", 1981),
        ("Tainted Love", "Soft Cell", 1981),
        ("Blue Monday", "New Order", 1983),
        ("When Doves Cry", "Prince", 1984),
        ("Take On Me", "a-ha", 1985),
        ("West End Girls", "Pet Shop Boys", 1985),
        ("Sweet Child o' Mine", "Guns N' Roses", 1987),
        ("Where the Streets Have No Name", "U2", 1987),
        ("Personal Jesus", "Depeche Mode", 1989),
        ("Nothing Compares 2 U", "Sinéad O'Connor", 1990),
        ("Common People", "Pulp", 1995),
        ("Paranoid Android", "Radiohead", 1997),
        ("Song 2", "Blur", 1997),
        ("Seven Nation Army", "The White Stripes", 2003),
    ],
}

HISTORY = {
    1: [
        ("In che anno è caduto il Muro di Berlino?", 1989),
        ("In che anno l'uomo è sbarcato sulla Luna?", 1969),
        ("In che anno è finita la Seconda guerra mondiale?", 1945),
        ("In che anno è nato il Regno d'Italia?", 1861),
        ("In che anno è scoppiata la Rivoluzione francese?", 1789),
        ("In che anno Colombo arrivò in America?", 1492),
        ("In che anno è avvenuto l'attacco di Pearl Harbor?", 1941),
        ("In che anno è avvenuto lo sbarco in Normandia?", 1944),
        ("In che anno è stata sganciata la bomba su Hiroshima?", 1945),
        ("In che anno è scoppiata la Rivoluzione russa?", 1917),
        ("In che anno è stato assassinato John Kennedy?", 1963),
        ("In che anno è avvenuto l'attacco alle Torri Gemelle?", 2001),
        ("In che anno è avvenuto il disastro di Chernobyl?", 1986),
        ("In che anno è caduta l'Unione Sovietica?", 1991),
        ("In che anno è stato firmato il Trattato di Roma?", 1957),
        ("In che anno è nata la Repubblica Italiana?", 1946),
        ("In che anno è nata l'ONU?", 1945),
        ("In che anno è stata firmata la Dichiarazione di indipendenza degli Stati Uniti?", 1776),
        ("In che anno è avvenuta la battaglia di Waterloo?", 1815),
        ("In che anno si è tenuto il Congresso di Vienna?", 1815),
        ("In che anno è stata proclamata l'unificazione della Germania?", 1871),
        ("In che anno è iniziata la Prima guerra mondiale?", 1914),
        ("In che anno è finita la Prima guerra mondiale?", 1918),
        ("In che anno è crollata la Borsa di Wall Street?", 1929),
        ("In che anno è stato lanciato lo Sputnik 1?", 1957),
        ("In che anno è avvenuto il primo volo dei fratelli Wright?", 1903),
        ("In che anno è affondato il Titanic?", 1912),
        ("In che anno è avvenuto il terremoto di Messina?", 1908),
        ("In che anno è avvenuta l'eruzione del Vesuvio che seppellì Pompei?", 79),
        ("In che anno è avvenuto l'incendio di Roma di Nerone?", 64),
    ],
    2: [
        ("In che anno è stato assassinato Abraham Lincoln?", 1865),
        ("In che anno è iniziata la guerra di secessione americana?", 1861),
        ("In che anno è avvenuta la battaglia di Gettysburg?", 1863),
        ("In che anno è iniziata la Rivoluzione americana?", 1775),
        ("In che anno Napoleone prese il potere con il colpo di Stato del 18 brumaio?", 1799),
        ("In che anno è stato incoronato imperatore Napoleone?", 1804),
        ("In che anno è iniziata la campagna di Russia di Napoleone?", 1812),
        ("In che anno è avvenuta la battaglia di Trafalgar?", 1805),
        ("In che anno l'India ha ottenuto l'indipendenza?", 1947),
        ("In che anno Nelson Mandela è uscito dal carcere?", 1990),
        ("In che anno Fidel Castro è andato al potere a Cuba?", 1959),
        ("In che anno è scoppiata la crisi dei missili di Cuba?", 1962),
        ("In che anno è avvenuta la Guerra dei Sei Giorni?", 1967),
        ("In che anno è finita la guerra del Vietnam?", 1975),
        ("In che anno è avvenuta la Rivoluzione iraniana?", 1979),
        ("In che anno è stato costruito il Muro di Berlino?", 1961),
        ("In che anno è avvenuta la Primavera di Praga?", 1968),
        ("In che anno è nato il sindacato Solidarnosc?", 1980),
        ("In che anno sono stati firmati gli accordi di Dayton?", 1995),
        ("In che anno è avvenuta la Guerra del Golfo?", 1991),
        ("In che anno è iniziata l'invasione dell'Iraq?", 2003),
        ("In che anno è avvenuto l'attentato al Bataclan?", 2015),
        ("In che anno si è tenuto il referendum sulla Brexit?", 2016),
        ("In che anno l'OMS ha dichiarato la pandemia di COVID-19?", 2020),
        ("In che anno è avvenuto lo tsunami dell'Oceano Indiano?", 2004),
        ("In che anno è avvenuto il disastro di Fukushima?", 2011),
        ("In che anno è entrata in vigore la Costituzione italiana?", 1948),
        ("In che anno è nata la NATO?", 1949),
        ("In che anno è nato il Patto di Varsavia?", 1955),
        ("In che anno è avvenuta la Rivoluzione ungherese?", 1956),
    ],
    3: [
        ("In che anno è caduta Costantinopoli?", 1453),
        ("In che anno è finita la Guerra dei Cent'anni?", 1453),
        ("In che anno è iniziata la Guerra delle Due Rose?", 1455),
        ("In che anno Gutenberg stampò la sua Bibbia?", 1455),
        ("In che anno è caduto il regno di Granada?", 1492),
        ("In che anno è stato firmato il Trattato di Tordesillas?", 1494),
        ("In che anno è avvenuto il Sacco di Roma?", 1527),
        ("In che anno si è tenuta la Dieta di Worms?", 1521),
        ("In che anno è iniziato il Concilio di Trento?", 1545),
        ("In che anno è avvenuta la Notte di San Bartolomeo?", 1572),
        ("In che anno è stata sconfitta l'Invincibile Armata?", 1588),
        ("In che anno è stata firmata la Pace di Westfalia?", 1648),
        ("In che anno è avvenuta la Gloriosa Rivoluzione inglese?", 1688),
        ("In che anno è iniziata la guerra di successione spagnola?", 1701),
        ("In che anno è stato firmato il Trattato di Parigi che chiuse la Rivoluzione americana?", 1783),
        ("In che anno è iniziata la guerra di Crimea?", 1853),
        ("In che anno si è tenuta la Conferenza di Berlino?", 1884),
        ("In che anno è avvenuto l'attentato di Sarajevo?", 1914),
        ("In che anno è stato firmato il Trattato di Versailles?", 1919),
        ("In che anno è avvenuta la Marcia su Roma?", 1922),
        ("In che anno sono state approvate le leggi razziali in Italia?", 1938),
        ("In che anno è avvenuta la Notte dei cristalli?", 1938),
        ("In che anno è stato firmato il patto Molotov-Ribbentrop?", 1939),
        ("In che anno è iniziata l'Operazione Barbarossa?", 1941),
        ("In che anno si è tenuta la Conferenza di Yalta?", 1945),
        ("In che anno è iniziato il processo di Norimberga?", 1945),
        ("In che anno è stato annunciato il Piano Marshall?", 1947),
        ("In che anno è iniziato il blocco di Berlino?", 1948),
        ("In che anno è nata la Repubblica Popolare Cinese?", 1949),
        ("In che anno è iniziata la guerra di Corea?", 1950),
    ],
}

BORDERS = {
    1: {
        "Italia": ["Francia", "Svizzera", "Austria", "Slovenia", "San Marino", "Città del Vaticano"],
        "Francia": ["Belgio", "Lussemburgo", "Germania", "Svizzera", "Italia", "Monaco", "Spagna", "Andorra"],
        "Germania": ["Danimarca", "Polonia", "Cechia", "Austria", "Svizzera", "Francia", "Lussemburgo", "Belgio", "Paesi Bassi"],
        "Spagna": ["Portogallo", "Francia", "Andorra", "Regno Unito", "Marocco"],
        "Svizzera": ["Francia", "Germania", "Austria", "Liechtenstein", "Italia"],
        "Austria": ["Germania", "Cechia", "Slovacchia", "Ungheria", "Slovenia", "Italia", "Svizzera", "Liechtenstein"],
        "Portogallo": ["Spagna"],
        "Belgio": ["Francia", "Lussemburgo", "Germania", "Paesi Bassi"],
        "Paesi Bassi": ["Germania", "Belgio"],
        "Lussemburgo": ["Belgio", "Francia", "Germania"],
        "Danimarca": ["Germania"],
        "Norvegia": ["Svezia", "Finlandia", "Russia"],
        "Svezia": ["Norvegia", "Finlandia"],
        "Finlandia": ["Svezia", "Norvegia", "Russia"],
        "Polonia": ["Germania", "Cechia", "Slovacchia", "Ucraina", "Bielorussia", "Lituania", "Russia"],
        "Cechia": ["Germania", "Polonia", "Slovacchia", "Austria"],
        "Slovacchia": ["Cechia", "Polonia", "Ucraina", "Ungheria", "Austria"],
        "Ungheria": ["Austria", "Slovacchia", "Ucraina", "Romania", "Serbia", "Croazia", "Slovenia"],
        "Slovenia": ["Italia", "Austria", "Ungheria", "Croazia"],
        "Croazia": ["Slovenia", "Ungheria", "Serbia", "Bosnia ed Erzegovina", "Montenegro"],
        "Serbia": ["Ungheria", "Romania", "Bulgaria", "Macedonia del Nord", "Kosovo", "Montenegro", "Bosnia ed Erzegovina", "Croazia"],
        "Romania": ["Ungheria", "Ucraina", "Moldavia", "Bulgaria", "Serbia"],
        "Bulgaria": ["Romania", "Serbia", "Macedonia del Nord", "Grecia", "Turchia"],
        "Grecia": ["Albania", "Macedonia del Nord", "Bulgaria", "Turchia"],
        "Albania": ["Montenegro", "Kosovo", "Macedonia del Nord", "Grecia"],
        "Macedonia del Nord": ["Serbia", "Kosovo", "Albania", "Grecia", "Bulgaria"],
        "Montenegro": ["Croazia", "Bosnia ed Erzegovina", "Serbia", "Kosovo", "Albania"],
        "Bosnia ed Erzegovina": ["Croazia", "Serbia", "Montenegro"],
        "Irlanda": ["Regno Unito"],
        "Regno Unito": ["Irlanda"],
    },
    2: {
        "Brasile": ["Guyana francese", "Suriname", "Guyana", "Venezuela", "Colombia", "Perù", "Bolivia", "Paraguay", "Argentina", "Uruguay"],
        "Argentina": ["Cile", "Bolivia", "Paraguay", "Brasile", "Uruguay"],
        "Cile": ["Perù", "Bolivia", "Argentina"],
        "Perù": ["Ecuador", "Colombia", "Brasile", "Bolivia", "Cile"],
        "Colombia": ["Panama", "Venezuela", "Brasile", "Perù", "Ecuador"],
        "Venezuela": ["Colombia", "Brasile", "Guyana"],
        "Ecuador": ["Colombia", "Perù"],
        "Bolivia": ["Brasile", "Paraguay", "Argentina", "Cile", "Perù"],
        "Paraguay": ["Bolivia", "Brasile", "Argentina"],
        "Uruguay": ["Brasile", "Argentina"],
        "Messico": ["Stati Uniti", "Guatemala", "Belize"],
        "Guatemala": ["Messico", "Belize", "Honduras", "El Salvador"],
        "Honduras": ["Guatemala", "El Salvador", "Nicaragua"],
        "El Salvador": ["Guatemala", "Honduras"],
        "Nicaragua": ["Honduras", "Costa Rica"],
        "Costa Rica": ["Nicaragua", "Panama"],
        "Panama": ["Costa Rica", "Colombia"],
        "Stati Uniti": ["Canada", "Messico"],
        "Canada": ["Stati Uniti"],
        "Cina": ["Corea del Nord", "Russia", "Mongolia", "Kazakistan", "Kirghizistan", "Tagikistan", "Afghanistan", "Pakistan", "India", "Nepal", "Bhutan", "Myanmar", "Laos", "Vietnam"],
        "India": ["Pakistan", "Cina", "Nepal", "Bhutan", "Bangladesh", "Myanmar"],
        "Russia": ["Norvegia", "Finlandia", "Estonia", "Lettonia", "Lituania", "Polonia", "Bielorussia", "Ucraina", "Georgia", "Azerbaigian", "Kazakistan", "Cina", "Mongolia", "Corea del Nord"],
        "Mongolia": ["Russia", "Cina"],
        "Kazakistan": ["Russia", "Cina", "Kirghizistan", "Uzbekistan", "Turkmenistan"],
        "Uzbekistan": ["Kazakistan", "Kirghizistan", "Tagikistan", "Afghanistan", "Turkmenistan"],
        "Turkmenistan": ["Kazakistan", "Uzbekistan", "Afghanistan", "Iran"],
        "Iran": ["Iraq", "Turchia", "Armenia", "Azerbaigian", "Turkmenistan", "Afghanistan", "Pakistan"],
        "Turchia": ["Grecia", "Bulgaria", "Georgia", "Armenia", "Azerbaigian", "Iran", "Iraq", "Siria"],
        "Algeria": ["Marocco", "Sahara Occidentale", "Mauritania", "Mali", "Niger", "Libia", "Tunisia"],
        "Sudafrica": ["Namibia", "Botswana", "Zimbabwe", "Mozambico", "Eswatini", "Lesotho"],
    },
}

POPULATION = {
    3: [
        ("Italia", 59),
        ("Francia", 68),
        ("Germania", 84),
        ("Spagna", 48),
        ("Portogallo", 10),
        ("Grecia", 10),
        ("Svezia", 11),
        ("Norvegia", 5),
        ("Danimarca", 6),
        ("Finlandia", 6),
        ("Polonia", 37),
        ("Romania", 19),
        ("Paesi Bassi", 18),
        ("Belgio", 12),
        ("Austria", 9),
        ("Svizzera", 9),
        ("Irlanda", 5),
        ("Ungheria", 10),
        ("Cechia", 11),
        ("Slovacchia", 5),
        ("Stati Uniti", 335),
        ("Canada", 40),
        ("Messico", 128),
        ("Brasile", 216),
        ("Argentina", 46),
        ("Giappone", 124),
        ("Cina", 1410),
        ("India", 1430),
        ("Australia", 26),
        ("Egitto", 112),
    ],
}

YEAR_STEPS = {1: 2, 2: 3, 3: 4}


def check(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def build() -> list[dict]:
    rows: list[dict] = []

    for level in (1, 2, 3):
        check(len(CELEBRITIES[level]) == TARGET, f"celebrita livello {level}: {len(CELEBRITIES[level])}")
        check(len(SONGS[level]) == TARGET, f"canzoni livello {level}: {len(SONGS[level])}")
        check(len(HISTORY[level]) == TARGET, f"storia livello {level}: {len(HISTORY[level])}")

        for name, year in CELEBRITIES[level]:
            rows.append({
                "level": level,
                "category": "CELEBRITÀ",
                "question": f"Qual è l'anno di nascita di {name}?",
                "unit": "anno",
                "value": year,
                "step": YEAR_STEPS[level],
            })

        for title, artist, year in SONGS[level]:
            rows.append({
                "level": level,
                "category": "CANZONI",
                "question": f"In che anno è uscita {title} di {artist}?",
                "unit": "anno",
                "value": year,
                "step": YEAR_STEPS[level],
            })

        for question, year in HISTORY[level]:
            rows.append({
                "level": level,
                "category": "STORIA",
                "question": question,
                "unit": "anno",
                "value": year,
                "step": YEAR_STEPS[level],
            })

    for level in (1, 2):
        check(len(BORDERS[level]) == TARGET, f"paesi livello {level}: {len(BORDERS[level])}")
        for country, neighbours in BORDERS[level].items():
            rows.append({
                "level": level,
                "category": "PAESI",
                "question": f"Quanti paesi confinano con {country}?",
                "unit": "paesi confinanti",
                "value": len(neighbours),
                "step": 1,
            })

    check(len(POPULATION[3]) == TARGET, f"popolazione livello 3: {len(POPULATION[3])}")
    for country, millions in POPULATION[3]:
        rows.append({
            "level": 3,
            "category": "PAESI",
            "question": f"Quanti milioni di abitanti ha {country}?",
            "unit": "milioni di abitanti",
            "value": millions,
            "step": 5,
        })

    seen: set[tuple[int, str, str]] = set()
    for row in rows:
        key = (row["level"], row["category"], row["question"])
        check(key not in seen, f"domanda ripetuta: {key}")
        seen.add(key)
        check(row["value"] > 0, f"valore non positivo: {row}")
        check(row["step"] > 0, f"passo non positivo: {row}")

    return rows


def main() -> None:
    rows = build()
    counts: dict[tuple[int, str], int] = {}
    for row in rows:
        counts[(row["level"], row["category"])] = counts.get((row["level"], row["category"]), 0) + 1
    for level in (1, 2, 3):
        for category in ("CELEBRITÀ", "CANZONI", "PAESI", "STORIA"):
            check(counts[(level, category)] == TARGET, f"{category} livello {level}: {counts[(level, category)]}")

    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"Scritte {len(rows)} domande in {OUT}")


if __name__ == "__main__":
    main()
