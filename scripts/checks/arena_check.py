"""Controllo live dell'arena: pool dalla banca, nessuna chiamata AI.

Uso: python scripts/checks/arena_check.py http://localhost:8080 Sport 12
"""
import json
import sys
import time
import unicodedata
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
CATEGORY = sys.argv[2] if len(sys.argv) > 2 else "Sport"
PHONES = int(sys.argv[3]) if len(sys.argv) > 3 else 12
problems = []


def call(method, path, body=None, timeout=120):
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8")


def norm(text):
    value = unicodedata.normalize("NFD", (text or "").lower())
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    return " ".join("".join(char if char.isalnum() else " " for char in value).split())


def check(condition, label, detail=""):
    print(("  OK   " if condition else "  FAIL ") + label + ("" if condition else " " + str(detail)[:220]))
    if not condition:
        problems.append(label)


print(f"== backend {BASE}")
status, raw = call("GET", "/categories")
check(status == 200, "GET /categories", raw[:120])

status, raw = call("POST", "/games")
check(status == 200, "POST /games", raw[:160])
game_id = json.loads(raw)["id"] if status == 200 else 0
print(f"== partita {game_id}")

started = time.time()
status, raw = call("GET", f"/games/{game_id}/arena/prepare?category={CATEGORY}&count=20")
prepare_seconds = time.time() - started
prepared = json.loads(raw) if status == 200 else {}
check(status == 200, "GET /arena/prepare", raw[:160])
check(prepared.get("generated", 0) >= 1,
      f"prepare dalla banca: {prepared.get('generated')} domande in {prepare_seconds:.2f}s", prepared)
check(prepare_seconds < 2.0, f"prepare istantaneo ({prepare_seconds:.2f}s, nessuna chiamata AI)")
check(prepared.get("pool") == prepared.get("generated"), "pool riempito", prepared)

started = time.time()
seen = {}
served = []
for index in range(1, PHONES + 1):
    status, raw = call("GET", f"/games/{game_id}/arena-question?category={CATEGORY}&playerId=p{index}")
    if status != 200:
        check(False, f"arena-question p{index} HTTP {status}", raw[:160])
        continue
    question = json.loads(raw)
    served.append(question)
    seen.setdefault(norm(question.get("question")), []).append(f"p{index}")
elapsed = time.time() - started

duplicates = {text: phones for text, phones in seen.items() if len(phones) > 1}
check(len(served) == PHONES, f"{PHONES} domande servite ({len(served)})")
check(not duplicates, f"nessun doppione ({len(seen)} distinte su {len(served)})", duplicates)
check(elapsed < 5, f"tutte servite in {elapsed:.2f}s")
check(all(q.get("questionId") and q.get("playerId") for q in served), "questionId e playerId presenti")
check(all(isinstance(q.get("options"), list) and len(q["options"]) >= 2 for q in served),
      "ogni domanda ha le opzioni")

print("\n== giusto/sbagliato deciso dal server")
question = served[0]
wrong = next(option for option in question["options"] if option != question["correctAnswer"])
status, raw = call("POST", f"/games/{game_id}/arena-answer",
                   {"playerId": question["playerId"], "questionId": question["questionId"], "answer": wrong})
result = json.loads(raw) if status == 200 else {}
check(status == 200 and result.get("correct") is False, "risposta sbagliata riconosciuta", raw[:160])

status, raw = call("POST", f"/games/{game_id}/arena-answer",
                   {"playerId": question["playerId"], "questionId": question["questionId"],
                    "answer": question["correctAnswer"]})
result = json.loads(raw) if status == 200 else {}
check(status == 200 and result.get("correct") is True and result.get("totalScore", 0) >= 100,
      "risposta corretta riconosciuta e punteggio", raw[:160])

status, raw = call("POST", f"/games/{game_id}/arena-answer",
                   {"playerId": "intruso", "questionId": question["questionId"], "answer": question["correctAnswer"]})
check(status >= 400 or json.loads(raw or "{}").get("correct") is None,
      "la domanda di un altro giocatore non si puo' rispondere", raw[:160])

status, raw = call("POST", f"/games/{game_id}/arena/reset")
check(status == 200, "reset", raw[:120])

print("\n=== ESITO ===")
if problems:
    print(f"{len(problems)} problemi: {problems}")
    sys.exit(1)
print("tutti i controlli superati")
