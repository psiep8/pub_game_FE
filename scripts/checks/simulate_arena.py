"""Simula N telefoni che giocano l'arena, tutti in parallelo.

Le richieste partono una per dispositivo nello stesso istante: è più severo di
dieci telefoni veri (che arrivano comunque sfalsati) perché mette alla prova la
deduplica sotto concorrenza.

Uso:
    python scripts/checks/simulate_arena.py http://localhost:8080
    python scripts/checks/simulate_arena.py http://localhost:8080 10 3 Sport
    python scripts/checks/simulate_arena.py http://localhost:8080 8 2 --prepare

Esce con codice 1 se una domanda esce due volte, se l'esito non torna o se un
dispositivo resta senza punteggio.
"""

from __future__ import annotations

import json
import sys
import threading
import unicodedata
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
PLAYERS = int(sys.argv[2]) if len(sys.argv) > 2 else 8
ROUNDS = int(sys.argv[3]) if len(sys.argv) > 3 else 2
CATEGORY = sys.argv[4] if len(sys.argv) > 4 else ""
USE_PREPARE = "--prepare" in sys.argv

problems: list[str] = []
lock = threading.Lock()


def call(method: str, path: str, body: dict | None = None, timeout: int = 60):
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return response.status, (json.loads(raw) if raw.strip().startswith(("{", "[")) else raw)
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8")


def norm(text: str) -> str:
    value = unicodedata.normalize("NFD", (text or "").lower())
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    return " ".join("".join(char if char.isalnum() else " " for char in value).split())


def fail(message: str) -> None:
    with lock:
        problems.append(message)
    print("  FAIL " + message)


def device_round(game_id: int, player: str, round_index: int, answer_correctly: bool) -> None:
    path = f"/games/{game_id}/arena-question?playerId={player}"
    if CATEGORY:
        path += f"&category={CATEGORY}"
    status, question = call("GET", path)
    if status != 200 or not isinstance(question, dict):
        fail(f"{player} r{round_index}: arena-question HTTP {status} {str(question)[:120]}")
        return

    if question.get("playerId") != player:
        fail(f"{player} r{round_index}: playerId restituito {question.get('playerId')}")
    options = question.get("options") or []
    correct_answer = question.get("correctAnswer")
    if not question.get("questionId") or not options or correct_answer is None:
        fail(f"{player} r{round_index}: domanda incompleta {str(question)[:160]}")
        return

    if answer_correctly:
        answer = correct_answer
    else:
        wrong = [option for option in options if option != correct_answer]
        if not wrong:
            fail(f"{player} r{round_index}: nessuna opzione sbagliata disponibile")
            return
        answer = wrong[0]

    status, result = call("POST", f"/games/{game_id}/arena-answer", {
        "playerId": player,
        "questionId": question["questionId"],
        "answer": answer,
    })
    if status != 200 or not isinstance(result, dict):
        fail(f"{player} r{round_index}: arena-answer HTTP {status} {str(result)[:120]}")
        return

    if bool(result.get("correct")) is not answer_correctly:
        fail(f"{player} r{round_index}: esito {result.get('correct')} con risposta "
             f"{'giusta' if answer_correctly else 'sbagliata'}")

    with lock:
        exchanges.append({
            "player": player,
            "round": round_index,
            "question": question.get("question"),
            "category": question.get("category"),
            "answer": answer,
            "correct": bool(result.get("correct")),
            "score": result.get("totalScore"),
        })


exchanges: list[dict] = []


def main() -> int:
    status, categories = call("GET", "/categories")
    if status != 200:
        print(f"ERRORE: backend non raggiungibile su {BASE} (HTTP {status})", file=sys.stderr)
        return 2

    status, game = call("POST", "/games")
    if status != 200:
        print(f"ERRORE: creazione partita HTTP {status}", file=sys.stderr)
        return 2
    game_id = game["id"]

    players = [f"Sim{p}" for p in range(1, PLAYERS + 1)]
    print(f"== partita {game_id}: {PLAYERS} dispositivi x {ROUNDS} round"
          f"{' (categoria ' + CATEGORY + ')' if CATEGORY else ' (categorie miste)'}")

    if USE_PREPARE:
        category = CATEGORY or "Scienza e Spazio"
        status, prepared = call("GET", f"/games/{game_id}/arena/prepare?category={category}&count=20")
        print(f"== prepare {category}: {prepared}")

    for round_index in range(1, ROUNDS + 1):
        threads = [
            threading.Thread(target=device_round,
                             args=(game_id, player, round_index, (index % 2 == 0)))
            for index, player in enumerate(players)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        texts = [norm(item["question"]) for item in exchanges if item["round"] == round_index]
        duplicates = {text for text in texts if texts.count(text) > 1}
        print(f"== round {round_index}: {len(texts)} risposte, {len(set(texts))} domande distinte")
        for duplicate in duplicates:
            fail(f"round {round_index}: domanda ripetuta -> {duplicate}")

    seen: dict[str, list[int]] = {}
    for item in exchanges:
        seen.setdefault(norm(item["question"]), []).append(item["round"])
    repeated = {text: rounds for text, rounds in seen.items() if len(rounds) > 1}
    if repeated:
        fail(f"{len(repeated)} domande ripetute: {list(repeated)[:3]}")

    print("\n== punteggi")
    status, scores = call("GET", f"/games/{game_id}/arena/scores")
    if status == 200 and isinstance(scores, dict):
        for player in players:
            entry = scores.get(player) or scores.get("scores", {}).get(player)
            print(f"  {player:8s} {entry}")
    else:
        print(f"  (endpoint punteggi non disponibile: HTTP {status})")

    totals: dict[str, int] = {}
    for item in exchanges:
        if isinstance(item.get("score"), int):
            totals[item["player"]] = item["score"]

    print("\n== riepilogo")
    print(f"  scambi totali: {len(exchanges)}")
    print(f"  domande distinte: {len(seen)}")
    print(f"  risposte giuste: {sum(1 for item in exchanges if item['correct'])}"
          f" / sbagliate: {sum(1 for item in exchanges if not item['correct'])}")
    for player in players:
        if totals.get(player, 0) <= 0:
            fail(f"{player} è rimasto a 0 punti")

    if problems:
        print(f"\n=== {len(problems)} PROBLEMI ===")
        return 1
    print("\nnessun problema: nessuna domanda ripetuta, esiti e punteggi coerenti")
    return 0


if __name__ == "__main__":
    sys.exit(main())
