"""Espansione della banca domande - blocco 10.

Dopo la deduplica sei combinazioni branca/difficolta erano scese a nove
domande: qui tornano a dieci.
"""

from __future__ import annotations

EXTRA_THEMED_QUIZ: dict[str, list[tuple[str, str, list[str], str]]] = {
    "TV e Spettacolo|TV": [
        ("Quale conduttore ha legato il suo nome al Festival di Sanremo per molti anni?", "Pippo Baudo", ["Mike Bongiorno", "Corrado", "Enzo Tortora"], "medio"),
    ],
    "Arte e Architettura|Architettura": [
        ("Quale materiale rivoluzionò l'architettura dell'Ottocento permettendo grandi luci?", "Il ferro", ["Il legno", "Il marmo", "Il gesso"], "medio"),
    ],
    "Lingua e Letteratura|Letteratura": [
        ("Quale scrittore ha creato il personaggio di Sherlock Holmes?", "Arthur Conan Doyle", ["Agatha Christie", "Edgar Allan Poe", "Jules Verne"], "facile"),
    ],
    "Lingua e Letteratura|Lingua": [
        ("Quale parola è un articolo determinativo?", "Il", ["Un", "Uno", "Alcuni"], "facile"),
    ],
}

EXTRA_THEMED_TF: dict[str, list[tuple[str, str, str]]] = {
    "Arte e Architettura|Architettura": [
        ("Le piramidi di Giza sono tombe monumentali dell'antico Egitto.", "VERO", "facile"),
    ],
    "Lingua e Letteratura|Letteratura": [
        ("Il Decameron è ambientato durante la peste del 1348.", "VERO", "medio"),
    ],
}
