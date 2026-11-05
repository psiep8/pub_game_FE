"""Punto di unione dei blocchi di espansione della banca domande.

Ogni blocco e un modulo `bank_extra_N.py` con due dizionari:

    EXTRA_QUIZ: categoria -> [(domanda, corretta, [sbagliate], difficolta), ...]
    EXTRA_TF:   categoria -> [(affermazione, "VERO" | "FALSO", difficolta), ...]

I blocchi vengono scoperti automaticamente: basta aggiungere un file
`bank_extra_N.py` nella stessa cartella. `build_curated_bank.py` importa da qui
e verifica che ogni fascia di difficolta arrivi al numero richiesto: 15 domande
per categoria, 20 per le categorie doppie come Cinema, Serie TV (10 per tema).
"""

from __future__ import annotations

import importlib
from pathlib import Path

EXTRA_QUIZ: dict[str, list[tuple[str, str, list[str], str]]] = {}
EXTRA_TF: dict[str, list[tuple[str, str, str]]] = {}


def _blocks() -> list[str]:
    folder = Path(__file__).resolve().parent
    return sorted(path.stem for path in folder.glob("bank_extra_[0-9]*.py"))


def _load() -> None:
    for name in _blocks():
        module = importlib.import_module(name)
        for category, rows in getattr(module, "EXTRA_QUIZ", {}).items():
            EXTRA_QUIZ.setdefault(category, []).extend(rows)
        for category, rows in getattr(module, "EXTRA_TF", {}).items():
            EXTRA_TF.setdefault(category, []).extend(rows)


_load()
