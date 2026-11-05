"""Punto di unione dei blocchi di espansione della banca domande.

Ogni blocco e un modulo `bank_extra_N.py` con quattro dizionari facoltativi:

    EXTRA_QUIZ:        categoria -> [(domanda, corretta, [sbagliate], difficolta), ...]
    EXTRA_TF:          categoria -> [(affermazione, "VERO" | "FALSO", difficolta), ...]
    EXTRA_THEMED_QUIZ: "Categoria|Tema" -> [(domanda, corretta, [sbagliate], difficolta), ...]
    EXTRA_THEMED_TF:   "Categoria|Tema" -> [(affermazione, "VERO" | "FALSO", difficolta), ...]

I blocchi tematici dichiarano esplicitamente a quale branca appartiene la
domanda: servono per le categorie a due argomenti (10 Geografia + 10 Viaggi,
10 Scienza + 10 Spazio, ...), dove la copertura va misurata per branca e non
lasciata a una parola chiave.

I blocchi vengono scoperti automaticamente: basta aggiungere un file
`bank_extra_N.py` nella stessa cartella.
"""

from __future__ import annotations

import importlib
from pathlib import Path

EXTRA_QUIZ: dict[str, list[tuple[str, str, list[str], str]]] = {}
EXTRA_TF: dict[str, list[tuple[str, str, str]]] = {}
EXTRA_THEMED_QUIZ: dict[str, list[tuple[str, str, list[str], str]]] = {}
EXTRA_THEMED_TF: dict[str, list[tuple[str, str, str]]] = {}


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
        for key, rows in getattr(module, "EXTRA_THEMED_QUIZ", {}).items():
            EXTRA_THEMED_QUIZ.setdefault(key, []).extend(rows)
        for key, rows in getattr(module, "EXTRA_THEMED_TF", {}).items():
            EXTRA_THEMED_TF.setdefault(key, []).extend(rows)


_load()
