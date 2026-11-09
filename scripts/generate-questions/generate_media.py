"""Scarica canzoni e volti per giocare offline (una volta, come per le domande).

Cosa fa:
  * cerca brani famosi su iTunes (nessuna chiave) e scarica l'anteprima di 30s;
    se un originale non c'è nello store italiano, ripiega su Deezer;
  * scarica la foto di una lista di personaggi famosi (TMDB se c'è la chiave,
    altrimenti Wikipedia);
  * scrive entrambi in apps/backend/src/main/resources/static/media/... e
    l'indice in apps/backend/src/main/resources/questions/media-it.json.

Uso:
    python generate_media.py --count-music 24 --count-people 40
    python generate_media.py --people-only
    python generate_media.py --music-only --count-music 40

Variabili opzionali:
    TMDB_API_KEY   per foto migliori (https://www.themoviedb.org/settings/api)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ITUNES = "https://itunes.apple.com/search"
DEEZER = "https://api.deezer.com/search"
TMDB_PERSON = "https://api.themoviedb.org/3/search/person"
TMDB_IMAGE = "https://image.tmdb.org/t/p/w500"
WIKI_SUMMARY = "https://{lang}.wikipedia.org/api/rest_v1/page/summary/{page}"
WIKI_API = "https://it.wikipedia.org/w/api.php"

MUSIC_SEARCHES = [
    "Vasco Rossi", "Ligabue", "Eros Ramazzotti", "Laura Pausini", "Zucchero",
    "Negramaro", "Elisa", "Tiziano Ferro", "Mengoni", "Annalisa",
    "Queen", "Beatles", "Michael Jackson", "Madonna", "Elton John",
    "ABBA", "Rolling Stones", "U2", "Coldplay", "Daft Punk",
    "Pink Floyd", "AC/DC", "Nirvana", "Bob Marley", "Prince",
    "Eurythmics", "Blondie", "Dire Straits", "Police", "Tina Turner",
]

PEOPLE = [
    ("Sophia Loren", "Cinema, Serie TV"), ("Roberto Benigni", "Cinema, Serie TV"), ("Monica Bellucci", "Cinema, Serie TV"),
    ("Pierfrancesco Favino", "Cinema, Serie TV"), ("Tom Cruise", "Cinema, Serie TV"), ("Meryl Streep", "Cinema, Serie TV"),
    ("Leonardo DiCaprio", "Cinema, Serie TV"), ("Brad Pitt", "Cinema, Serie TV"), ("Angelina Jolie", "Cinema, Serie TV"),
    ("Robert De Niro", "Cinema, Serie TV"), ("Al Pacino", "Cinema, Serie TV"), ("Johnny Depp", "Cinema, Serie TV"),
    ("Vasco Rossi", "Musica"), ("Laura Pausini", "Musica"), ("Eros Ramazzotti", "Musica"),
    ("Luciano Ligabue", "Musica"), ("Zucchero", "Musica"), ("Taylor Swift", "Musica"),
    ("Madonna", "Musica"), ("Michael Jackson", "Musica"), ("Elton John", "Musica"),
    ("Beyoncé", "Musica"), ("Ed Sheeran", "Musica"), ("Freddie Mercury", "Musica"),
    ("Francesco Totti", "Sport"), ("Alessandro Del Piero", "Sport"), ("Valentino Rossi", "Sport"),
    ("Cristiano Ronaldo", "Sport"), ("Lionel Messi", "Sport"), ("Roger Federer", "Sport"),
    ("LeBron James", "Sport"), ("Michael Jordan", "Sport"), ("Diego Armando Maradona", "Sport"),
    ("Gerry Scotti", "TV e Spettacolo"), ("Maria De Filippi", "TV e Spettacolo"), ("Paolo Bonolis", "TV e Spettacolo"),
    ("Federica Sciarelli", "TV e Spettacolo"), ("Carlo Conti", "TV e Spettacolo"), ("Amadeus", "TV e Spettacolo"),
    ("Sofia Vergara", "Cinema, Serie TV"), ("Penelope Cruz", "Cinema, Serie TV"), ("Javier Bardem", "Cinema, Serie TV"),
    ("Scarlett Johansson", "Cinema, Serie TV"), ("Tom Hanks", "Cinema, Serie TV"), ("Julia Roberts", "Cinema, Serie TV"),
    ("Cate Blanchett", "Cinema, Serie TV"), ("Denzel Washington", "Cinema, Serie TV"), ("Emma Watson", "Cinema, Serie TV"),
    ("Vin Diesel", "Cinema, Serie TV"), ("Margot Robbie", "Cinema, Serie TV"), ("Dwayne Johnson", "Cinema, Serie TV"),
    ("Adele", "Musica"), ("Shakira", "Musica"), ("Rihanna", "Musica"),
    ("Bruce Springsteen", "Musica"), ("David Bowie", "Musica"), ("Lady Gaga", "Musica"),
    ("Bob Dylan", "Musica"), ("Marco Mengoni", "Musica"), ("Elisa", "Musica"),
    ("Tiziano Ferro", "Musica"), ("Annalisa", "Musica"),
    ("Federica Pellegrini", "Sport"), ("Jannik Sinner", "Sport"), ("Rafael Nadal", "Sport"),
    ("Usain Bolt", "Sport"), ("Serena Williams", "Sport"), ("Paolo Maldini", "Sport"),
    ("Gianluigi Buffon", "Sport"), ("Alberto Tomba", "Sport"), ("Simone Biles", "Sport"),
    ("Fiorello", "TV e Spettacolo"), ("Bruno Vespa", "TV e Spettacolo"), ("Milly Carlucci", "TV e Spettacolo"),
    ("Mara Venier", "TV e Spettacolo"), ("Pippo Baudo", "TV e Spettacolo"), ("Alfonso Signorini", "TV e Spettacolo"),
    ("Lewis Hamilton", "Motori"), ("Charles Leclerc", "Motori"), ("Michael Schumacher", "Motori"),
    ("Ayrton Senna", "Motori"), ("Max Verstappen", "Motori"), ("Sebastian Vettel", "Motori"),
]

IMAGE_EXTENSIONS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def slug(text: str) -> str:
    value = unicodedata.normalize("NFD", text.lower())
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")[:60] or "file"


def norm(text: str) -> str:
    value = unicodedata.normalize("NFD", (text or "").lower())
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


CELEB_RE = re.compile(r"(?:nascita di|nato|nata|morto|morta) (.+?)\?\s*$", re.I)
SONG_RE = re.compile(r"uscit[oa] (.+?) di (.+?)\?\s*$", re.I)

# Nomi ambigui su Wikipedia: la voce giusta è quella tra parentesi.
WIKI_ALIASES = {
    "Drake": "Drake (rapper)",
    "C.S. Lewis": "C. S. Lewis",
}


def load_env_file() -> None:
    """Legge .env (root del repo o cartella corrente) senza sovrascrivere l'ambiente."""
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(here)), ".env"),
        os.path.join(os.getcwd(), ".env"),
    ]
    for candidate in candidates:
        if not os.path.exists(candidate):
            continue
        try:
            with open(candidate, encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    if key and value and key not in os.environ:
                        os.environ[key] = value
        except Exception:
            continue


def get_json(url: str, timeout: int = 30, attempts: int = 3):
    """Con una rete instabile una singola richiesta fallisce spesso: si ritenta."""
    last_error = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 PubGame"})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as error:
            last_error = error
            time.sleep(1.5 * (attempt + 1))
    raise last_error


def download(url: str, destination: str) -> str:
    last_error = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 PubGame"})
            with urllib.request.urlopen(request, timeout=60) as response:
                content_type = (response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
                data = response.read()
            if len(data) < 3000:
                raise ValueError("file troppo piccolo")
            target = destination
            if target.endswith("."):
                target = target + (IMAGE_EXTENSIONS.get(content_type, ".jpg").lstrip("."))
            with open(target, "wb") as handle:
                handle.write(data)
            return target
        except Exception as error:
            last_error = error
            time.sleep(1.5 * (attempt + 1))
    raise last_error


def find_itunes(term: str, limit: int = 5) -> list[dict]:
    query = urllib.parse.urlencode({
        "term": term, "media": "music", "entity": "song", "country": "IT", "limit": limit,
    })
    return get_json(f"{ITUNES}?{query}").get("results", [])


def find_deezer(term: str, limit: int = 20) -> list[dict]:
    query = urllib.parse.urlencode({"q": term, "limit": limit})
    return get_json(f"{DEEZER}?{query}").get("data", [])


def download_cover(item: dict, covers_dir: str) -> str | None:
    """Copertina locale: senza questo file la TV resterebbe con il segnaposto."""
    url = (item.get("artworkUrl100") or "").replace("100x100", "600x600")
    if not url:
        return None
    name = f"{slug(item.get('artistName', ''))}-{slug(item.get('trackName', ''))}"
    try:
        path = download(url, os.path.join(covers_dir, name + "."))
        return "/media/covers/" + os.path.basename(path)
    except Exception as error:
        print(f"  copertina non scaricata ({error})")
        return None


def store_track(item: dict, music_dir: str, covers_dir: str,
                seen: set[tuple[str, str]]) -> dict | None:
    preview = item.get("previewUrl")
    title = (item.get("trackName") or "").strip()
    artist = (item.get("artistName") or "").strip()
    if not title or not artist:
        return None
    key = (artist.lower(), title.lower())
    if key in seen:
        return None
    file_name = f"music/{slug(artist)}-{slug(title)}.m4a"
    path = os.path.join(music_dir, file_name.removeprefix("music/"))
    cover_name = f"{slug(artist)}-{slug(title)}"
    existing_cover = next(
        (ext for ext in (".jpg", ".png", ".webp")
         if os.path.exists(os.path.join(covers_dir, cover_name + ext))), None)
    if os.path.exists(path) and os.path.getsize(path) > 3000:
        seen.add(key)
        print(f"  ok (gia presente) {artist} - {title}")
        return {
            "type": "MUSIC",
            "title": title,
            "artist": artist,
            "year": str(item.get("releaseDate", ""))[:4],
            "albumCover": f"/media/covers/{cover_name}{existing_cover}" if existing_cover else None,
            "file": f"/media/{file_name}",
        }
    if not preview:
        return None
    try:
        download(preview, path)
    except Exception as error:
        print(f"  {artist} - {title}: download fallito ({error})")
        return None
    seen.add(key)
    cover = download_cover(item, covers_dir)
    print(f"  ok {artist} - {title}")
    return {
        "type": "MUSIC",
        "title": title,
        "artist": artist,
        "year": str(item.get("releaseDate", ""))[:4],
        "albumCover": cover,
        "file": f"/media/{file_name}",
    }


def grab_music(static_dir: str, count: int,
               extra_songs: list[tuple[str, str]] | None = None) -> list[dict]:
    music_dir = os.path.join(static_dir, "media", "music")
    covers_dir = os.path.join(static_dir, "media", "covers")
    os.makedirs(music_dir, exist_ok=True)
    os.makedirs(covers_dir, exist_ok=True)
    tracks: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for term in MUSIC_SEARCHES:
        if len(tracks) >= count:
            break
        try:
            results = find_itunes(term)
        except Exception as error:
            print(f"  {term}: ricerca fallita ({error})")
            continue
        for item in results:
            track = store_track(item, music_dir, covers_dir, seen)
            if track:
                tracks.append(track)
            if len(tracks) >= count:
                break
        time.sleep(0.5)

    # Le canzoni delle manche Azzardo hanno un titolo preciso: si cercano una
    # per una e non contano nel limite di --count-music.
    for title, artist in extra_songs or []:
        track = grab_song(title, artist, music_dir, covers_dir, seen)
        if track:
            tracks.append(track)
        time.sleep(0.3)

    return tracks


def grab_song(title: str, artist: str, music_dir: str, covers_dir: str,
              seen: set[tuple[str, str]]) -> dict | None:
    try:
        results = find_itunes(f"{title} {artist}", 10)
    except Exception as error:
        print(f"  {artist} - {title}: ricerca fallita ({error})")
        return grab_deezer_song(title, artist, music_dir, covers_dir, seen)

    wanted_title = norm(title)
    wanted_artist = norm(artist)
    best = next((item for item in results
                 if norm(item.get("trackName")) == wanted_title
                 and wanted_artist in norm(item.get("artistName"))), None)
    if not best:
        best = next((item for item in results
                     if wanted_title in norm(item.get("trackName"))
                     and (wanted_artist in norm(item.get("artistName"))
                          or norm(item.get("artistName")) in wanted_artist)
                     and "live" not in norm(item.get("trackName"))), None)
    if not best:
        # Su iTunes mancano alcuni originali (in Italia): Deezer li ha.
        return grab_deezer_song(title, artist, music_dir, covers_dir, seen)
    return store_track(best, music_dir, covers_dir, seen) if best else None


def grab_deezer_song(title: str, artist: str, music_dir: str, covers_dir: str,
                     seen: set[tuple[str, str]]) -> dict | None:
    """Ripiego per i brani che lo store italiano non espone."""
    try:
        results = find_deezer(f"{title} {artist}")
    except Exception as error:
        print(f"  {artist} - {title}: Deezer non raggiungibile ({error})")
        return None
    wanted_title = norm(title)
    wanted_artist = norm(artist)
    best = next((item for item in results
                 if norm(item.get("title")) == wanted_title
                 and wanted_artist in norm((item.get("artist") or {}).get("name"))
                 and item.get("preview")), None)
    if not best:
        return None
    key = (artist.lower(), title.lower())
    if key in seen:
        return None
    base = f"{slug(artist)}-{slug(title)}"
    try:
        path = download(best["preview"], os.path.join(music_dir, base + ".mp3"))
    except Exception as error:
        print(f"  {artist} - {title}: download Deezer fallito ({error})")
        return None
    cover = None
    album = best.get("album") or {}
    cover_url = album.get("cover_big") or album.get("cover_medium")
    if cover_url:
        try:
            cover_path = download(cover_url, os.path.join(covers_dir, base + "."))
            cover = "/media/covers/" + os.path.basename(cover_path)
        except Exception as error:
            print(f"  {artist} - {title}: copertina Deezer non scaricata ({error})")
    seen.add(key)
    print(f"  ok (deezer) {artist} - {title}")
    return {
        "type": "MUSIC",
        "title": title,
        "artist": artist,
        "year": str((best.get("release_date") or ""))[:4],
        "albumCover": cover,
        "file": "/media/music/" + os.path.basename(path),
    }


def azzardo_media(bank_path: str) -> tuple[list[tuple[str, str]], list[str]]:
    """Tutte le canzoni e le celebrità che possono uscire in Azzardo."""
    try:
        with open(bank_path, encoding="utf-8") as handle:
            data = json.load(handle)
    except Exception as error:
        print(f"  banca Azzardo non leggibile ({error})")
        return [], []

    songs: list[tuple[str, str]] = []
    names: list[str] = []
    for item in data:
        category = (item.get("category") or "").upper()
        question = item.get("question") or ""
        if category.startswith("CELEBR"):
            match = CELEB_RE.search(question)
            if match:
                names.append(match.group(1).strip())
        elif category == "CANZONI":
            match = SONG_RE.search(question)
            if match:
                songs.append((match.group(1).strip(), match.group(2).strip()))
    return list(dict.fromkeys(songs)), list(dict.fromkeys(names))


def tmdb_photo(name: str, api_key: str) -> str | None:
    query = urllib.parse.urlencode({"query": name, "api_key": api_key, "language": "it-IT"})
    results = get_json(f"{TMDB_PERSON}?{query}").get("results", [])
    for person in results:
        if person.get("profile_path") and person.get("name", "").lower() == name.lower():
            return TMDB_IMAGE + person["profile_path"]
    for person in results:
        if person.get("profile_path"):
            return TMDB_IMAGE + person["profile_path"]
    return None


def wiki_summary(name: str) -> dict | None:
    """Foto, descrizione ed estratto: si prova italiano, poi inglese."""
    name = WIKI_ALIASES.get(name, name)
    page = urllib.parse.quote(name.replace(" ", "_"))
    for language in ("it", "en"):
        try:
            summary = get_json(WIKI_SUMMARY.format(lang=language, page=page))
        except Exception:
            continue
        if str(summary.get("type", "")).lower() == "disambiguation":
            continue

        image = ((summary.get("thumbnail") or {}).get("source")
                 or (summary.get("originalimage") or {}).get("source"))
        description = (summary.get("description") or "").strip()
        extract = (summary.get("extract") or "").strip()

        if not image:
            # Ripiego: ricerca per titolo (gestisce redirect e titoli non esatti).
            query = urllib.parse.urlencode({
                "action": "query", "format": "json", "generator": "search",
                "gsrsearch": name, "gsrlimit": 1, "prop": "pageimages",
                "piprop": "original", "redirects": 1,
            })
            try:
                results = get_json(f"{WIKI_API}?{query}")
                pages = (results.get("query") or {}).get("pages") or {}
                for page_data in pages.values():
                    image = (page_data.get("original") or {}).get("source")
                    if image:
                        break
            except Exception:
                pass

        if image or description or extract:
            return {"image": image, "description": description, "extract": extract}

    return None


def grab_people(static_dir: str, limit: int | None, force: bool = False,
                extra_names: tuple[str, ...] | list[str] = ()) -> list[dict]:
    people_dir = os.path.join(static_dir, "media", "people")
    os.makedirs(people_dir, exist_ok=True)
    api_key = os.environ.get("TMDB_API_KEY", "").strip()
    people: list[dict] = []

    names = list(PEOPLE[:limit] if limit else PEOPLE)
    known = {norm(name) for name, _ in names}
    for name in extra_names:
        if norm(name) not in known:
            names.append((name, "Celebrità"))
            known.add(norm(name))

    for name, category in names:
        file_name = f"people/{slug(name)}"
        path = os.path.join(people_dir, slug(name))
        # Il riepilogo serve anche quando la foto è già in cache: gli indizi
        # devono restare disponibili anche offline.
        summary = wiki_summary(name) or {}

        reused = None if force else next(
            (ext for ext in (".jpg", ".png", ".webp") if os.path.exists(path + ext)), None)
        if reused:
            people.append({
                "type": "IMAGE_BLUR",
                "name": name,
                "category": category,
                "file": f"/media/{file_name}{reused}",
                "description": summary.get("description", ""),
                "extract": summary.get("extract", ""),
            })
            print(f"  ok (gia presente) {name}")
            time.sleep(0.5)
            continue

        url = None
        if api_key:
            try:
                url = tmdb_photo(name, api_key)
            except Exception:
                url = None
        if not url:
            url = summary.get("image")
        if not url:
            print(f"  {name}: nessuna foto trovata")
            time.sleep(0.8)
            continue

        extension = IMAGE_EXTENSIONS.get("image/jpeg", ".jpg")
        destination = path + extension
        try:
            download(url, destination)
        except Exception as error:
            print(f"  {name}: foto non scaricata ({error})")
            time.sleep(1.2)
            continue

        people.append({
            "type": "IMAGE_BLUR",
            "name": name,
            "category": category,
            "file": f"/media/{file_name}{extension}",
            "description": summary.get("description", ""),
            "extract": summary.get("extract", ""),
        })
        print(f"  ok {name}")
        time.sleep(1.2)

    return people


def main() -> int:
    load_env_file()
    parser = argparse.ArgumentParser(description="Scarica canzoni e volti per giocare offline.")
    parser.add_argument("--static-dir", default="apps/backend/src/main/resources/static")
    parser.add_argument("--out", default="apps/backend/src/main/resources/questions/media-it.json")
    parser.add_argument("--count-music", type=int, default=24)
    parser.add_argument("--count-people", type=int, default=None)
    parser.add_argument("--music-only", action="store_true")
    parser.add_argument("--people-only", action="store_true")
    parser.add_argument("--force", action="store_true", help="riscarica anche i file già presenti")
    parser.add_argument("--from-azzardo", action="store_true",
                        help="aggiunge tutte le canzoni e le celebrità della banca Azzardo")
    parser.add_argument("--azzardo-bank",
                        default="apps/backend/src/main/resources/questions/azzardo-it.json")
    args = parser.parse_args()

    azzardo_songs: list[tuple[str, str]] = []
    azzardo_people: list[str] = []
    if args.from_azzardo:
        print("== banca Azzardo")
        azzardo_songs, azzardo_people = azzardo_media(args.azzardo_bank)
        print(f"  {len(azzardo_songs)} canzoni, {len(azzardo_people)} volti")

    music: list[dict] = []
    people: list[dict] = []

    if not args.people_only:
        print(f"== canzoni (max {args.count_music})")
        music = grab_music(args.static_dir, args.count_music, azzardo_songs)

    if not args.music_only:
        print("== volti")
        people = grab_people(args.static_dir, args.count_people, args.force, azzardo_people)

    # Un aggiornamento parziale non deve cancellare l'altra metà della banca.
    if os.path.exists(args.out):
        try:
            with open(args.out, encoding="utf-8") as handle:
                previous = json.load(handle)
            if args.people_only and not music:
                music = previous.get("music", [])
            if args.music_only and not people:
                people = previous.get("people", [])
        except Exception:
            pass

    if not music and not people:
        print("ERRORE: non ho scaricato nulla.", file=sys.stderr)
        return 1

    bank = {
        "version": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "itunes + tmdb/wikipedia",
        "music": music,
        "people": people,
    }
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(bank, handle, ensure_ascii=False, indent=2)

    print("\n=== RIEPILOGO ===")
    print(f"brani: {len(music)}")
    print(f"volti: {len(people)}")
    print(f"indice: {args.out}")
    print("File media in:", os.path.join(args.static_dir, "media"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
