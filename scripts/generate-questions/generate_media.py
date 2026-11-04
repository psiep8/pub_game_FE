"""Scarica canzoni e volti per giocare offline (una volta, come per le domande).

Cosa fa:
  * cerca brani famosi su iTunes (nessuna chiave) e scarica l'anteprima di 30s;
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
TMDB_PERSON = "https://api.themoviedb.org/3/search/person"
TMDB_IMAGE = "https://image.tmdb.org/t/p/w500"
WIKI_SUMMARY = "https://it.wikipedia.org/api/rest_v1/page/summary/{}"

MUSIC_SEARCHES = [
    "Vasco Rossi", "Ligabue", "Eros Ramazzotti", "Laura Pausini", "Zucchero",
    "Negramaro", "Elisa", "Tiziano Ferro", "Mengoni", "Annalisa",
    "Queen", "Beatles", "Michael Jackson", "Madonna", "Elton John",
    "ABBA", "Rolling Stones", "U2", "Coldplay", "Daft Punk",
    "Pink Floyd", "AC/DC", "Nirvana", "Bob Marley", "Prince",
    "Eurythmics", "Blondie", "Dire Straits", "Police", "Tina Turner",
]

PEOPLE = [
    ("Sophia Loren", "Cinema"), ("Roberto Benigni", "Cinema"), ("Monica Bellucci", "Cinema"),
    ("Pierfrancesco Favino", "Cinema"), ("Tom Cruise", "Cinema"), ("Meryl Streep", "Cinema"),
    ("Leonardo DiCaprio", "Cinema"), ("Brad Pitt", "Cinema"), ("Angelina Jolie", "Cinema"),
    ("Robert De Niro", "Cinema"), ("Al Pacino", "Cinema"), ("Johnny Depp", "Cinema"),
    ("Vasco Rossi", "Musica"), ("Laura Pausini", "Musica"), ("Eros Ramazzotti", "Musica"),
    ("Luciano Ligabue", "Musica"), ("Zucchero", "Musica"), ("Taylor Swift", "Musica"),
    ("Madonna", "Musica"), ("Michael Jackson", "Musica"), ("Elton John", "Musica"),
    ("Beyoncé", "Musica"), ("Ed Sheeran", "Musica"), ("Freddie Mercury", "Musica"),
    ("Francesco Totti", "Sport"), ("Alessandro Del Piero", "Sport"), ("Valentino Rossi", "Sport"),
    ("Cristiano Ronaldo", "Sport"), ("Lionel Messi", "Sport"), ("Roger Federer", "Sport"),
    ("LeBron James", "Sport"), ("Michael Jordan", "Sport"), ("Diego Armando Maradona", "Sport"),
    ("Gerry Scotti", "Televisione"), ("Maria De Filippi", "Televisione"), ("Paolo Bonolis", "Televisione"),
    ("Federica Sciarelli", "Televisione"), ("Carlo Conti", "Televisione"), ("Amadeus", "Televisione"),
]

IMAGE_EXTENSIONS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def slug(text: str) -> str:
    value = unicodedata.normalize("NFD", text.lower())
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")[:60] or "file"


def get_json(url: str, timeout: int = 30):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 PubGame"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def download(url: str, destination: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 PubGame"})
    with urllib.request.urlopen(request, timeout=60) as response:
        content_type = (response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        data = response.read()
    if len(data) < 3000:
        raise ValueError("file troppo piccolo")
    if destination.endswith("."):
        destination = destination + (IMAGE_EXTENSIONS.get(content_type, ".jpg").lstrip("."))
    with open(destination, "wb") as handle:
        handle.write(data)
    return destination


def grab_music(static_dir: str, count: int) -> list[dict]:
    music_dir = os.path.join(static_dir, "media", "music")
    os.makedirs(music_dir, exist_ok=True)
    tracks: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for term in MUSIC_SEARCHES:
        if len(tracks) >= count:
            break
        query = urllib.parse.urlencode({
            "term": term, "media": "music", "entity": "song", "country": "IT", "limit": 3,
        })
        try:
            results = get_json(f"{ITUNES}?{query}").get("results", [])
        except Exception as error:
            print(f"  {term}: ricerca fallita ({error})")
            continue

        for item in results:
            preview = item.get("previewUrl")
            title = (item.get("trackName") or "").strip()
            artist = (item.get("artistName") or "").strip()
            if not preview or not title or not artist:
                continue
            key = (artist.lower(), title.lower())
            if key in seen:
                continue
            file_name = f"music/{slug(artist)}-{slug(title)}.m4a"
            path = os.path.join(music_dir, file_name.removeprefix("music/"))
            try:
                download(preview, path)
            except Exception as error:
                print(f"  {artist} - {title}: download fallito ({error})")
                continue
            seen.add(key)
            tracks.append({
                "type": "MUSIC",
                "title": title,
                "artist": artist,
                "year": str(item.get("releaseDate", ""))[:4],
                "albumCover": (item.get("artworkUrl100") or "").replace("100x100", "500x500") or None,
                "file": f"/media/{file_name}",
            })
            print(f"  ok {artist} - {title}")
            if len(tracks) >= count:
                break
        time.sleep(0.5)

    return tracks


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


def wiki_photo(name: str) -> str | None:
    """Foto principale della voce: l'API summary, non Special:FilePath (spesso 404)."""
    page = urllib.parse.quote(name.replace(" ", "_"))
    try:
        summary = get_json(WIKI_SUMMARY.format(page))
    except Exception:
        return None
    original = (summary.get("originalimage") or {}).get("source")
    thumbnail = (summary.get("thumbnail") or {}).get("source")
    return original or thumbnail


def grab_people(static_dir: str, limit: int | None) -> list[dict]:
    people_dir = os.path.join(static_dir, "media", "people")
    os.makedirs(people_dir, exist_ok=True)
    api_key = os.environ.get("TMDB_API_KEY", "").strip()
    people: list[dict] = []
    names = PEOPLE if not limit else PEOPLE[:limit]

    for name, category in names:
        file_name = f"people/{slug(name)}"
        path = os.path.join(people_dir, slug(name))

        url = None
        if api_key:
            try:
                url = tmdb_photo(name, api_key)
            except Exception:
                url = None
        if not url:
            url = wiki_photo(name)
        if not url:
            print(f"  {name}: nessuna foto trovata")
            continue

        extension = IMAGE_EXTENSIONS.get("image/jpeg", ".jpg")
        destination = path + extension
        try:
            download(url, destination)
        except Exception as error:
            print(f"  {name}: foto non scaricata ({error})")
            continue

        people.append({
            "type": "IMAGE_BLUR",
            "name": name,
            "category": category,
            "file": f"/media/{file_name}{extension}",
        })
        print(f"  ok {name}")
        time.sleep(0.4)

    return people


def main() -> int:
    parser = argparse.ArgumentParser(description="Scarica canzoni e volti per giocare offline.")
    parser.add_argument("--static-dir", default="apps/backend/src/main/resources/static")
    parser.add_argument("--out", default="apps/backend/src/main/resources/questions/media-it.json")
    parser.add_argument("--count-music", type=int, default=24)
    parser.add_argument("--count-people", type=int, default=None)
    parser.add_argument("--music-only", action="store_true")
    parser.add_argument("--people-only", action="store_true")
    args = parser.parse_args()

    music: list[dict] = []
    people: list[dict] = []

    if not args.people_only:
        print(f"== canzoni (max {args.count_music})")
        music = grab_music(args.static_dir, args.count_music)

    if not args.music_only:
        print("== volti")
        people = grab_people(args.static_dir, args.count_people)

    if not music and not people:
        print("ERRORE: non ho scaricato nulla.", file=sys.stderr)
        return 1

    bank = {
        "version": 1,
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
