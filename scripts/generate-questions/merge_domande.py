"""Aggiunge domande scritte a mano alla banca, con deduplica e id progressivi.

Uso:
    python merge_domande.py file1.json file2.json ...

Ogni file puo' essere una lista di domande oppure {"questions": [...]}.
I campi richiesti: category, type, difficulty, question, correctAnswer, options.
Le domande gia' presenti (stesso testo normalizzato) e i doppioni interna
vengono scartati; gli id vengono rinumerati per categoria.
"""

import json
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
BANK = os.path.join(REPO, "apps", "backend", "src", "main", "resources", "questions", "questions-it.json")

VALID_TYPES = ("QUIZ", "TRUE_FALSE", "IMAGE_BLUR")
VALID_DIFFICULTY = ("facile", "medio", "difficile")


def normalize(text: str) -> str:
    value = unicodedata.normalize("NFD", (text or "").lower())
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    return " ".join("".join(char if char.isalnum() else " " for char in value).split())


def slug(text: str) -> str:
    value = unicodedata.normalize("NFD", text.lower())
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")[:3] or "gen"


def validate(item: dict) -> str | None:
    """Restituisce il motivo dello scarto, oppure None se la domanda e' valida."""
    qtype = (item.get("type") or "").upper()
    question = (item.get("question") or "").strip()
    answer = str(item.get("correctAnswer") or "").strip()
    options = item.get("options")
    difficulty = (item.get("difficulty") or "").lower()

    if qtype not in VALID_TYPES:
        return f"tipo non valido: {qtype}"
    if difficulty not in VALID_DIFFICULTY:
        return f"difficolta non valida: {difficulty}"
    if len(question) < 12:
        return "domanda troppo corta"
    if not answer:
        return "risposta mancante"
    if not item.get("category"):
        return "categoria mancante"

    if not isinstance(options, list) or len(options) < 2:
        return "opzioni mancanti"
    if answer not in options:
        return "risposta non presente fra le opzioni"
    if qtype == "TRUE_FALSE" and sorted(option.upper() for option in options) != ["FALSO", "VERO"]:
        return "TRUE_FALSE con opzioni errate"
    if qtype == "QUIZ":
        if len(options) != 4:
            return "QUIZ con un numero di opzioni diverso da 4"
        if len({normalize(option) for option in options}) != 4:
            return "QUIZ con opzioni duplicate"
    return None


def load_questions(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)
    items = payload.get("questions") if isinstance(payload, dict) else payload
    if not isinstance(items, list):
        raise SystemExit(f"{path}: formato inatteso")
    return [item for item in items if isinstance(item, dict)]


def main() -> int:
    if len(sys.argv) < 2:
        print("uso: python merge_domande.py file.json [...]", file=sys.stderr)
        return 2

    with open(BANK, encoding="utf-8") as handle:
        bank = json.load(handle)

    existing = bank.get("questions", [])
    seen = {normalize(item.get("question", "")) for item in existing}
    added = 0
    rejected: list[str] = []

    for path in sys.argv[1:]:
        for item in load_questions(path):
            problem = validate(item)
            if problem:
                rejected.append(f"{item.get('question', '?')[:60]} -> {problem}")
                continue
            key = normalize(item["question"])
            if key in seen:
                continue
            options = item.get("options")
            if (item.get("type") or "").upper() == "TRUE_FALSE":
                options = ["VERO", "FALSO"]
            existing.append({
                "id": "tmp",
                "category": item["category"],
                "type": item["type"].upper(),
                "difficulty": item["difficulty"].lower(),
                "question": item["question"].strip(),
                "correctAnswer": str(item["correctAnswer"]).strip(),
                "options": options,
                "explanation": item.get("explanation"),
            })
            seen.add(key)
            added += 1

    counters: dict[str, int] = {}
    for item in existing:
        counters[item["category"]] = counters.get(item["category"], 0) + 1
        item["id"] = f"{slug(item['category'])}-{counters[item['category']]:04d}"

    bank["questions"] = existing
    with open(BANK, "w", encoding="utf-8") as handle:
        json.dump(bank, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print(f"aggiunte: {added} | scartate: {len(rejected)} | totale: {len(existing)}")
    for line in rejected[:15]:
        print("  scartata:", line)

    per_category: dict[str, int] = {}
    per_difficulty: dict[str, int] = {}
    for item in existing:
        per_category[item["category"]] = per_category.get(item["category"], 0) + 1
        per_difficulty[item["difficulty"]] = per_difficulty.get(item["difficulty"], 0) + 1
    print("per categoria:", dict(sorted(per_category.items())))
    print("per difficolta:", dict(sorted(per_difficulty.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
