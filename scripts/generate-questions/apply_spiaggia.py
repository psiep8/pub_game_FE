"""Applica alla banca le fasce e le domande di Ultima spiaggia.

Serve a non dipendere da una rigenerazione completa: `build_curated_bank.py`
riscrive `questions-it.json` da zero e non conosce ne' le fasce
(`spiaggiaBand`) ne' le domande aggiunte dopo, quindi rigenerare perderebbe
tutto questo. Qui invece si parte dal file in banca e si aggiunge solo cio'
che manca:

- le etichette `spiaggiaBand` delle domande gia' esistenti, lette da
  `spiaggia_bands.json` (id -> fascia);
- le 160 domande nuove di `bank_spiaggia.py`, con id stabili.

Uso:
    python scripts/generate-questions/apply_spiaggia.py           # applica
    python scripts/generate-questions/apply_spiaggia.py --check    # verifica

`--check` non scrive nulla ed esce con codice 1 se la banca non e' allineata:
e' il controllo che l'audit usa per accorgersi di una banca incompleta.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from bank_spiaggia import BANDS, EXTRA

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BANK = ROOT / "apps" / "backend" / "src" / "main" / "resources" / "questions" / "questions-it.json"
BANDS_FILE = HERE / "spiaggia_bands.json"

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

# La difficolta' generale resta a tre valori: la fascia di Ultima spiaggia e'
# piu' fine e vive in `spiaggiaBand`.
DIFFICULTY = {
    "facile": "facile",
    "medio-facile": "medio",
    "media": "medio",
    "medio-difficile": "difficile",
    "difficile": "difficile",
}


def band_slug(band: str) -> str:
    return band.replace("-", "")


def with_band(item: dict, band: str) -> dict:
    """Fascia subito dopo la difficolta', come nelle domande gia' in banca."""
    out = {}
    for key, value in item.items():
        out[key] = value
        if key == "difficulty":
            out["spiaggiaBand"] = band
    return out


def reload() -> tuple[dict, list[dict]]:
    bank = json.loads(BANK.read_text(encoding="utf-8"))
    return bank, list(bank["questions"])


def entry_for(question_id: str, category: str, band: str, question: str,
              correct: str, wrong: list[str], source: str) -> dict:
    return {
        "id": question_id,
        "category": category,
        "type": "QUIZ",
        "difficulty": DIFFICULTY[band],
        "spiaggiaBand": band,
        "question": question,
        "correctAnswer": correct,
        "options": [correct, *wrong],
        "theme": None,
        "explanation": source,
    }


def apply(questions: list[dict], bands: dict[str, str]) -> tuple[list[str], list[str], list[str], list[str], list[str]]:
    """Ritorna (aggiunte, etichettate, riallineate, id scivolati, problemi)."""
    added: list[str] = []
    labelled: list[str] = []
    refreshed: list[str] = []
    shifted: list[str] = []
    problems: list[str] = []

    by_id = {item["id"]: index for index, item in enumerate(questions)}

    for question_id, band in bands.items():
        index = by_id.get(question_id)
        if index is None:
            problems.append(f"etichetta orfana: {question_id}")
            continue
        if band not in BANDS:
            problems.append(f"fascia sconosciuta per {question_id}: {band}")
            continue
        if questions[index].get("spiaggiaBand") != band:
            questions[index] = with_band(questions[index], band)
            labelled.append(question_id)

    counters: dict[tuple[str, str], int] = {}
    for category, band, question, correct, wrong, source in EXTRA:
        if category not in SLUG:
            problems.append(f"categoria sconosciuta: {category}")
            continue
        if band not in BANDS:
            problems.append(f"fascia sconosciuta: {band}")
            continue
        counter = counters.get((category, band), 0) + 1
        counters[(category, band)] = counter
        question_id = f"spiaggia-{SLUG[category]}-{band_slug(band)}-{counter:02d}"
        entry = entry_for(question_id, category, band, question, correct, wrong, source)
        index = by_id.get(question_id)
        if index is not None:
            # Riga gia' in banca: si riallinea al file tracciato, senza spostarla.
            if questions[index] != entry:
                # L'id dipende dalla posizione nel file: se cambia la domanda
                # dietro lo stesso id, qualcuno ha aggiunto righe in mezzo e
                # gli id sono scivolati. Non e' un errore, ma va detto.
                if questions[index].get("question") != question:
                    shifted.append(question_id)
                questions[index] = entry
                refreshed.append(question_id)
            continue
        questions.append(entry)
        by_id[question_id] = len(questions) - 1
        added.append(question_id)

    return added, labelled, refreshed, shifted, problems


def main() -> None:
    parser = argparse.ArgumentParser(description="Applica fasce e domande di Ultima spiaggia alla banca.")
    parser.add_argument("--check", action="store_true", help="non scrive: esce 1 se la banca non e' allineata")
    args = parser.parse_args()

    bank, questions = reload()
    bands = json.loads(BANDS_FILE.read_text(encoding="utf-8")) if BANDS_FILE.exists() else {}
    added, labelled, refreshed, shifted, problems = apply(questions, bands)

    tagged = sum(1 for item in questions if item.get("spiaggiaBand"))
    print(
        "Ultima spiaggia: "
        f"{tagged} domande con fascia ({len(added)} aggiunte, {len(labelled)} etichettate, "
        f"{len(refreshed)} riallineate)."
    )
    for problem in problems:
        print(f"  problema: {problem}")
    for question_id in shifted:
        print(f"  id scivolato: {question_id} (domanda diversa sotto lo stesso id)")

    if problems:
        raise SystemExit("Errori in bank_spiaggia/spiaggia_bands: correggili prima di scrivere.")

    if args.check:
        if added or labelled or refreshed:
            raise SystemExit("Banca non allineata a bank_spiaggia.py: esegui lo script senza --check.")
        print(f"Banca allineata ({tagged} fasce).")
        return

    bank["questions"] = questions
    BANK.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Scritto {BANK.relative_to(ROOT)}: {len(questions)} domande.")


if __name__ == "__main__":
    main()
