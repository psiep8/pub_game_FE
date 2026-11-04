"""Prova dal vivo dei giochi nuovi contro il backend avviato.

Verifica che:
- Timeline e Quanto costa non mandino la soluzione ai telefoni;
- il server calcoli i punteggi e li restituisca al reveal;
- l'arena serva solo Vero/Falso e non esaurisca la banca dopo due domande.

Uso: python scripts/checks/party_games_check.py [porta]
"""

import json
import sys
import time
import urllib.error
import urllib.request

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
BASE = f"http://localhost:{PORT}"


def call(method, path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read().decode("utf-8")
    return json.loads(raw) if raw else None


def wait_for_backend(timeout=120):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            call("GET", "/categories")
            return True
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            time.sleep(2)
    return False


def payload_of(round_json):
    payload = round_json["payload"]
    return json.loads(payload) if isinstance(payload, str) else payload


def main():
    if not wait_for_backend():
        print("❌ backend non raggiungibile su", BASE)
        return 1

    game = call("POST", "/games", {})
    game_id = game["id"]
    print("gioco creato:", game_id)

    # ---------------------------------------------------------- Timeline
    rounds = call(
        "GET",
        f"/games/{game_id}/generate-ai-round?category=CULTURA%20GENERALE&type=TIMELINE&difficulty=medio",
    )
    timeline = payload_of(rounds)
    assert timeline["type"] == "TIMELINE", timeline
    assert timeline["items"], "nessuna carta servita"
    assert all("year" not in card for card in timeline["items"]), "gli anni viaggiano verso i telefoni"
    print(f"TIMELINE: {len(timeline['items'])} carte, nessun anno nel payload")

    order = [card["id"] for card in timeline["items"]]
    answer = call(
        "POST", f"/games/{game_id}/timeline-answer", {"playerName": "Squadra Test", "order": order}
    )
    print("timeline punteggio:", answer)

    reveal = call("GET", f"/games/{game_id}/timeline/reveal")
    years = [item["year"] for item in reveal["items"]]
    assert years == sorted(years), "la soluzione non è in ordine cronologico"
    assert reveal["results"], "nessun risultato nel reveal"
    print("timeline reveal:", years)

    # ------------------------------------------------------- Quanto costa
    price_round = payload_of(
        call(
            "GET",
            f"/games/{game_id}/generate-ai-round?category=CULTURA%20GENERALE&type=PRICE&difficulty=medio",
        )
    )
    assert price_round["type"] == "PRICE", price_round
    assert "price" not in price_round, "il prezzo viaggia verso i telefoni"
    print("PRICE:", price_round.get("name"))

    call("POST", f"/games/{game_id}/price-answer", {"playerName": "Squadra Test", "estimate": 2})
    call("POST", f"/games/{game_id}/price-answer", {"playerName": "Squadra Due", "estimate": 999})
    price_reveal = call("GET", f"/games/{game_id}/price/reveal")
    assert price_reveal["price"] > 0, "prezzo assente nel reveal"
    assert price_reveal["results"][0]["closest"] is True, "la stima più vicina non è premiata"
    print("price reveal:", price_reveal["price"], "€, closest:", price_reveal["closest"])

    # ------------------------------------------- Speed Rush e Ping Pong
    for game_type in ("SPEED_RUSH", "PING_PONG"):
        config = payload_of(
            call(
                "GET",
                f"/games/{game_id}/generate-ai-round?category=CULTURA%20GENERALE"
                f"&type={game_type}&difficulty=medio",
            )
        )
        assert config["type"] == game_type, config
        print(game_type, "config ok, durata", config.get("duration"))

    # --------------------------------------------------------------- Arena
    seen = []
    sides = []
    for index in range(10):
        raw = call(
            "GET",
            f"/games/{game_id}/arena-question?category=Scienza&playerId=p{index}",
        )
        question = json.loads(raw) if isinstance(raw, str) else raw
        assert question["type"] == "TRUE_FALSE", f"arena non Vero/Falso: {question['type']}"
        assert question["options"] == ["VERO", "FALSO"], question["options"]
        seen.append(question["question"])
        sides.append(question["correctAnswer"])

        if index == 0:
            wrong = "FALSO" if question["correctAnswer"] == "VERO" else "VERO"
            result = call(
                "POST",
                f"/games/{game_id}/arena-answer",
                {"playerId": "p0", "questionId": question["questionId"], "answer": wrong},
            )
            assert result["correct"] is False and result["points"] == -10, result
            print("arena risposta errata:", result["points"])

    assert len(set(seen)) == len(seen), "l'arena ha ripetuto una domanda"
    assert all(
        sides[i] != sides[i - 1] for i in range(1, len(sides))
    ), f"VERO/FALSO non alternati: {sides}"
    print(f"ARENA: {len(seen)} domande Vero/Falso tutte diverse, lati alternati {sides[:4]}...")

    print("\n✅ tutti i controlli sono passati")
    return 0


if __name__ == "__main__":
    sys.exit(main())
