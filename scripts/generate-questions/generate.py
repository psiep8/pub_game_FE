"""Genera la banca domande di PubGame (una volta, offline, su qualsiasi macchina).

Non ha dipendenze: solo Python 3.9+ e la libreria standard.

    export GROQ_API_KEY="gsk_..."          # macOS/Linux
    $env:GROQ_API_KEY="gsk_..."            # Windows PowerShell
    python generate.py --per-category 40

Il file prodotto va messo in apps/backend/src/main/resources/questions/questions-it.json
e da quel momento il backend non chiama più nessun modello.

Uscita: JSON {"version", "language", "generatedAt", "source", "questions": [...]}.
Ogni domanda: id, category, type, difficulty, question, correctAnswer, options, explanation.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-oss-120b"

CATEGORIES = [
    "Storia", "Scienza", "Sport", "Cinema", "Geografia", "Musica",
    "Arte", "Politica", "Motori", "Cibo e Gastronomia", "Televisione",
    "Lingue e Parole",
]

DIFFICULTY_HINT = {
    "facile": "domande molto semplici, da bambini o cultura generale di base",
    "medio": "domande per adulti mediamente istruiti, richiedono un attimo di riflessione",
    "difficile": "domande da esperti, con dettagli precisi",
}


def normalize(text: str) -> str:
    s = unicodedata.normalize("NFD", (text or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join("".join(c if c.isalnum() else " " for c in s).split())


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", normalize(text))[:3] or "gen"


def looks_english(text: str) -> bool:
    markers = (" the ", " which ", " what ", " who ", " when ", " is ", " are ", " true false")
    low = f" {normalize(text)} "
    return any(m in low for m in markers)


def post_groq(api_key: str, model: str, prompt: str, max_tokens: int, temperature: float) -> str:
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_completion_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }).encode("utf-8")

    req = urllib.request.Request(
        GROQ_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as response:
        body = json.loads(response.read().decode("utf-8"))
    return body["choices"][0]["message"]["content"]


def build_prompt(category: str, count: int, difficulty: str, with_chrono: bool, avoid: list[str]) -> str:
    avoid_block = ""
    if avoid:
        avoid_block = "NON ripetere questi argomenti già presenti:\n" + "\n".join(f"- {a}" for a in avoid[-40:]) + "\n"

    chrono_rule = (
        "3. Almeno 3 domande di tipo CHRONO: chiedi un anno (\"In che anno...\"), "
        "con correctAnswer uguale all'anno a 4 cifre e options null.\n"
        if with_chrono
        else ""
    )

    return (
        f"Genera {count} domande per un quiz da pub in italiano, categoria \"{category}\".\n"
        f"Difficoltà richiesta: {difficulty} ({DIFFICULTY_HINT[difficulty]}).\n"
        "REGOLE OBBLIGATORIE:\n"
        "1. Ogni domanda deve riguardare SOLO questa categoria: "
        f"\"{category}\". Niente domande fuori tema.\n"
        "2. Mix di tipi: circa 70% QUIZ (4 opzioni), circa 30% TRUE_FALSE "
        "(options esattamente [\"VERO\",\"FALSO\"] e correctAnswer VERO o FALSO).\n"
        f"{chrono_rule}"
        "4. 'correctAnswer' deve essere IDENTICO a una delle options (tranne CHRONO).\n"
        "5. Le 3 opzioni sbagliate devono essere plausibili ma chiaramente errate.\n"
        "6. Niente domande ambigue, niente doppioni, niente fatti inventati o incerti.\n"
        "7. Scrivi domanda, opzioni e risposte SOLO in italiano.\n"
        f"{avoid_block}"
        "Formato di risposta (solo JSON):\n"
        '{"questions": [{"question": "...", "type": "QUIZ", "options": ["A","B","C","D"], '
        '"correctAnswer": "A", "difficulty": "medio"}, '
        '{"question": "...", "type": "TRUE_FALSE", "options": ["VERO","FALSO"], '
        '"correctAnswer": "VERO", "difficulty": "facile", "explanation": "..."}]}'
    )


def validate(item: dict, category: str, difficulty: str) -> tuple[bool, str]:
    qtype = (item.get("type") or "QUIZ").upper()
    question = (item.get("question") or "").strip()
    answer = str(item.get("correctAnswer") or "").strip()
    options = item.get("options")

    if len(question) < 12:
        return False, "domanda troppo corta"
    if not answer:
        return False, "correctAnswer mancante"
    if looks_english(question):
        return False, "domanda non in italiano"

    if qtype == "CHRONO":
        if not re.fullmatch(r"\d{3,4}", answer):
            return False, "CHRONO senza anno valido"
        if options not in (None, []):
            return False, "CHRONO con options valorizzate"
        return True, ""

    if qtype not in ("QUIZ", "TRUE_FALSE"):
        return False, f"tipo non gestito {qtype}"

    if not isinstance(options, list) or len(options) < 2:
        return False, "options mancanti"

    if qtype == "TRUE_FALSE":
        if sorted(o.upper() for o in options) != ["FALSO", "VERO"]:
            return False, "TRUE_FALSE con opzioni diverse da VERO/FALSO"
        if answer.upper() not in ("VERO", "FALSO"):
            return False, "TRUE_FALSE con risposta non VERO/FALSO"
        return True, ""

    if len(options) != 4:
        return False, "QUIZ con un numero di opzioni diverso da 4"
    if len({normalize(o) for o in options}) != 4:
        return False, "QUIZ con opzioni duplicate"
    if answer not in options:
        return False, "correctAnswer non presente tra le opzioni"
    return True, ""


def main() -> int:
    parser = argparse.ArgumentParser(description="Genera la banca domande di PubGame.")
    parser.add_argument("--out", default="apps/backend/src/main/resources/questions/questions-it.json")
    parser.add_argument("--per-category", type=int, default=40, help="domande richieste per categoria")
    parser.add_argument("--batch", type=int, default=12, help="domande per singola chiamata")
    parser.add_argument("--model", default=os.environ.get("GROQ_MODEL", DEFAULT_MODEL))
    parser.add_argument("--delay", type=float, default=6.0, help="secondi tra una chiamata e l'altra")
    parser.add_argument("--difficulty", default="medio", choices=list(DIFFICULTY_HINT))
    parser.add_argument("--with-chrono", action="store_true", help="chiedi anche domande CHRONO")
    parser.add_argument("--categories", nargs="*", default=CATEGORIES)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--merge", action="store_true", help="aggiunge alla banca già esistente invece di sostituirla")
    args = parser.parse_args()

    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        print("ERRORE: variabile GROQ_API_KEY assente.", file=sys.stderr)
        return 2

    if args.seed is not None:
        random.seed(args.seed)

    existing = []
    if args.merge and os.path.exists(args.out):
        with open(args.out, encoding="utf-8") as handle:
            existing = json.load(handle).get("questions", [])
        print(f"Banca esistente: {len(existing)} domande")

    collected = list(existing)
    seen_questions = {normalize(q["question"]) for q in collected}
    seen_answers = {(normalize(q["category"]), normalize(str(q["correctAnswer"]))) for q in collected}
    failures = 0

    for category in args.categories:
        print(f"\n== {category}")
        produced = 0
        attempts = 0
        avoid = [q["question"] for q in collected if q.get("category") == category]
        while produced < args.per_category and attempts < args.per_category:
            attempts += 1
            want = min(args.batch, args.per_category - produced)
            prompt = build_prompt(category, want, args.difficulty, args.with_chrono, avoid)
            try:
                raw = post_groq(api_key, args.model, prompt, max_tokens=max(900, want * 220), temperature=0.7)
            except urllib.error.HTTPError as error:
                if error.code == 429:
                    print("  429: attendo 20s e riprovo")
                    time.sleep(20)
                    attempts -= 1
                    continue
                print(f"  HTTP {error.code}: {error.read()[:200]!r}")
                failures += 1
                break
            except Exception as error:  # rete, timeout, JSON rotto
                print(f"  errore: {error}")
                failures += 1
                time.sleep(3)
                continue

            try:
                parsed = json.loads(raw)
                items = parsed.get("questions") if isinstance(parsed, dict) else parsed
            except json.JSONDecodeError:
                print("  risposta non JSON, salto")
                failures += 1
                continue

            if not isinstance(items, list):
                print("  formato inatteso (manca 'questions'), salto")
                failures += 1
                continue

            for item in items:
                if not isinstance(item, dict):
                    continue
                ok, why = validate(item, category, args.difficulty)
                if not ok:
                    continue
                question = item["question"].strip()
                answer = str(item["correctAnswer"]).strip()
                key_q = normalize(question)
                key_a = (normalize(category), normalize(answer))
                if key_q in seen_questions or key_a in seen_answers:
                    continue
                qtype = (item.get("type") or "QUIZ").upper()
                options = item.get("options")
                if qtype == "TRUE_FALSE":
                    options = ["VERO", "FALSO"]
                    answer = answer.upper()
                if qtype == "CHRONO":
                    options = None
                collected.append({
                    "id": f"{slug(category)}-{len(collected) + 1:04d}",
                    "category": category,
                    "type": qtype,
                    "difficulty": item.get("difficulty", args.difficulty),
                    "question": question,
                    "correctAnswer": answer,
                    "options": options,
                    "explanation": item.get("explanation"),
                })
                seen_questions.add(key_q)
                seen_answers.add(key_a)
                avoid.append(question)
                produced += 1
                if produced >= args.per_category:
                    break

            print(f"  {produced}/{args.per_category} (tentativo {attempts})")
            time.sleep(args.delay)

        if produced < args.per_category:
            print(f"  ATTENZIONE: {category} ferma a {produced} domande")

    collected.sort(key=lambda q: (q["category"], q["type"], q["question"]))
    bank = {
        "version": 1,
        "language": "it",
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": f"groq:{args.model}",
        "questions": collected,
    }

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(bank, handle, ensure_ascii=False, indent=2)

    per_category = {}
    for item in collected:
        per_category[item["category"]] = per_category.get(item["category"], 0) + 1

    print("\n=== RIEPILOGO ===")
    print(f"file: {args.out}")
    print(f"domande totali: {len(collected)}")
    for category, total in sorted(per_category.items()):
        print(f"  {category:22s} {total}")
    if failures:
        print(f"chiamate fallite: {failures}")
    print("Duplicati rimossi in scrittura; rilanciare con --merge per aggiungere altre domande.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
