#!/usr/bin/env python3
"""Aggiunge al media bank locale i brani del catalogo Musica.

Riusa la logica di `scripts/generate-questions/generate_media.py` (iTunes,
fallback sul catalogo dell'artista, Deezer, copertina) invece di duplicarla:
qui c'è solo la lista curata di titoli/artisti e il merge nell'indice.

Uso:
    python scripts/banche/aggiungi-musica.py            # scarica i mancanti
    python scripts/banche/aggiungi-musica.py --dry-run  # dice cosa manca
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
import time
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CATALOG = os.path.join(ROOT, "scripts", "banche", "musica-catalogo.json")
INDEX = os.path.join(ROOT, "apps", "backend", "src", "main", "resources", "questions", "media-it.json")
STATIC_DIR = os.path.join(ROOT, "apps", "backend", "src", "main", "resources", "static")
MEDIA_DIR = os.path.join(STATIC_DIR, "media", "music")
COVERS_DIR = os.path.join(STATIC_DIR, "media", "covers")


def load_generator():
    path = os.path.join(ROOT, "scripts", "generate-questions", "generate_media.py")
    spec = importlib.util.spec_from_file_location("generate_media", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def load_json(path: str) -> dict:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def already_indexed(entry: dict, music: list[dict], norm) -> bool:
    """Il brano è già nell'indice? Titolo uguale e artista compatibile."""
    wanted_title = norm(entry["title"])
    wanted_artist = norm(entry["artist"])
    for item in music:
        title = norm(item.get("title", ""))
        artist = norm(item.get("artist", ""))
        if title != wanted_title:
            continue
        if not wanted_artist or not artist:
            return True
        if wanted_artist in artist or artist in wanted_artist:
            return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Scarica i brani mancanti del catalogo Musica.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    gm = load_generator()
    catalog = load_json(CATALOG)
    index = load_json(INDEX)
    music: list[dict] = list(index.get("music") or [])

    seen: set[tuple[str, str]] = {
        ((item.get("artist") or "").lower(), (item.get("title") or "").lower())
        for item in music
    }

    missing = [entry for entry in catalog["tracks"] if not already_indexed(entry, music, gm.norm)]
    print(f"catalogo: {len(catalog['tracks'])} brani · indice: {len(music)} · mancanti: {len(missing)}")
    if args.dry_run:
        for entry in missing:
            print(f"  - {entry['artist']} - {entry['title']}")
        return 0

    os.makedirs(MEDIA_DIR, exist_ok=True)
    os.makedirs(COVERS_DIR, exist_ok=True)

    added: list[dict] = []
    skipped: list[dict] = []
    for position, entry in enumerate(missing, start=1):
        print(f"[{position}/{len(missing)}] {entry['artist']} - {entry['title']}")
        try:
            track = gm.grab_song(entry["title"], entry["artist"], MEDIA_DIR, COVERS_DIR, seen)
        except Exception as error:  # rete instabile: si riporta e si prosegue
            print(f"  ERRORE: {error}")
            track = None
        if not track:
            skipped.append(entry)
            print("  SCARTATO: nessuna anteprima disponibile")
            continue
        file_path = os.path.join(STATIC_DIR, track["file"].lstrip("/"))
        if not os.path.exists(file_path) or os.path.getsize(file_path) <= 3000:
            skipped.append(entry)
            print("  SCARTATO: file assente o troppo piccolo")
            continue
        added.append(track)
        time.sleep(0.4)

    if not added:
        print("Nessun brano nuovo scaricato.", file=sys.stderr)
        return 1

    merged = music + added
    index.update(
        {
            "version": 2,
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": index.get("source", "itunes + tmdb/wikipedia"),
            "music": merged,
        }
    )
    with open(INDEX, "w", encoding="utf-8") as handle:
        json.dump(index, handle, ensure_ascii=False, indent=2)

    print("\n=== RIEPILOGO ===")
    print(f"aggiunti: {len(added)} · scartati: {len(skipped)} · totale indice: {len(merged)}")
    for entry in skipped:
        print(f"  scartato: {entry['artist']} - {entry['title']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
