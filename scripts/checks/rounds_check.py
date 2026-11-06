"""Controllo live dei payload di tutti i tipi di gioco, dalla banca domande.

Uso: python scripts/checks/rounds_check.py http://localhost:8080
"""
import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
problems = []


def call(method, path, body=None, timeout=90):
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


def check(condition, label, detail=""):
    print(("  OK   " if condition else "  FAIL ") + label + ("" if condition else " " + str(detail)[:240]))
    if not condition:
        problems.append(label)


status, raw = call("POST", "/games")
check(status == 200, "POST /games", raw[:150])
game_id = json.loads(raw)["id"] if status == 200 else 0

types = ["QUIZ", "IMAGE_BLUR", "MUSIC", "WHEEL_OF_FORTUNE", "SCREAM_RACE", "ARENA"]
payloads = {}

for game_type in types:
    status, raw = call("GET", f"/games/{game_id}/generate-ai-round?category=Scienza%20e%20Spazio&type={game_type}&difficulty=EASY")
    if status != 200:
        check(False, f"{game_type}: HTTP {status}", raw[:200])
        continue
    round_json = json.loads(raw)
    raw_payload = round_json.get("payload")
    try:
        payload = json.loads(raw_payload) if isinstance(raw_payload, str) else raw_payload
    except json.JSONDecodeError:
        payload = raw_payload
    payloads[game_type] = payload
    print(f"  ..  {game_type}: round {round_json.get('roundIndex')} payload={str(payload)[:110]}")

quiz = payloads.get("QUIZ") or {}
check(isinstance(quiz, dict) and len(quiz.get("options") or []) == 4, "QUIZ: 4 opzioni", quiz)
check(isinstance(quiz, dict) and quiz.get("correctAnswer") in (quiz.get("options") or []),
      "QUIZ: correctAnswer tra le opzioni", quiz)

image = payloads.get("IMAGE_BLUR") or {}
check(isinstance(image, dict) and bool(image.get("imageUrl")) and bool(image.get("correctAnswer")),
      "IMAGE_BLUR: personaggio + immagine", image)

music = payloads.get("MUSIC") or {}
check(isinstance(music, dict) and bool(music.get("previewUrl")), "MUSIC: anteprima audio", music)

wheel = payloads.get("WHEEL_OF_FORTUNE")
check(bool(wheel), "WHEEL_OF_FORTUNE: proverbio presente", wheel)

scream = payloads.get("SCREAM_RACE") or {}
check(isinstance(scream, dict) and scream.get("duration") and scream.get("instructions"),
      "SCREAM_RACE: durata e istruzioni", scream)

arena = payloads.get("ARENA") or {}
check(isinstance(arena, dict) and arena.get("questions") == [], "ARENA: nessun pacchetto inutile", arena)

print("\n== round classico (endpoint che rispondeva 500)")
status, raw = call("POST", f"/games/{game_id}/round")
check(status == 200, "POST /games/{id}/round", raw[:200])
if status == 200:
    round_json = json.loads(raw)
    payload = json.loads(round_json["payload"])
    check(len(payload.get("options") or []) == 4 and payload.get("correctAnswer") in payload["options"],
          "round classico servito dalla banca", payload)

print("\n== nessun doppione nella stessa partita")
seen = set()
repeated = []
for _ in range(6):
    status, raw = call("GET", f"/games/{game_id}/generate-ai-round?category=Cinema%2C%20Serie%20TV&type=QUIZ&difficulty=EASY")
    if status != 200:
        continue
    payload = json.loads(json.loads(raw)["payload"])
    text = " ".join(str(payload.get("question", "")).lower().split())
    if text in seen:
        repeated.append(text)
    seen.add(text)
check(len(seen) == 6 and not repeated, f"6 domande QUIZ distinte ({len(seen)}/6)", repeated)

print("\n=== ESITO ===")
if problems:
    print(f"{len(problems)} problemi: {problems}")
    sys.exit(1)
print("tutti i controlli superati")
