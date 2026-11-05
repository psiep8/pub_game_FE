"""Espansione della banca domande - blocco 9.

Rimpiazza le domande doppie rimosse dalla deduplica in Musica e Curiosita,
cosi che le due categorie a branca unica restino a quindici domande per fascia.
"""

from __future__ import annotations

EXTRA_QUIZ: dict[str, list[tuple[str, str, list[str], str]]] = {
    "Musica": [
        ("Quale strumento a tastiera produce il suono con martelletti sulle corde?", "Il pianoforte", ["L'organo", "La fisarmonica", "Il clavicembalo"], "facile"),
        ("In quale Paese è nato il fado?", "Il Portogallo", ["La Spagna", "Il Brasile", "La Grecia"], "medio"),
    ],
    "Curiosità": [
        ("Quale organo produce la bile?", "Il fegato", ["I reni", "Il pancreas", "La milza"], "facile"),
        ("Quante ossa ha in media lo scheletro di un adulto?", "206", ["186", "226", "246"], "medio"),
    ],
}
