"""Espansione della banca domande - blocco 7.

Completa le branche Arte e Architettura / Architettura, Cibo e Gastronomia /
Gastronomia, Politica e Attualita / Attualita.
"""

from __future__ import annotations

EXTRA_THEMED_QUIZ: dict[str, list[tuple[str, str, list[str], str]]] = {
    "Arte e Architettura|Architettura": [
        ("Quale ingegnere ha progettato la Torre Eiffel?", "Gustave Eiffel", ["Antoni Gaudí", "Le Corbusier", "Santiago Calatrava"], "facile"),
        ("Quale monumento romano era un anfiteatro per i gladiatori?", "Il Colosseo", ["Il Pantheon", "Le Terme di Caracalla", "Il Foro Romano"], "facile"),
        ("Come si chiama la cupola di Brunelleschi a Firenze?", "La cupola di Santa Maria del Fiore", ["La cupola di San Pietro", "La cupola del Pantheon", "La cupola di San Marco"], "facile"),
        ("Quale stile architettonico usa archi a tutto sesto e volte a crociera?", "Il romanico", ["Il gotico", "Il barocco", "Il liberty"], "medio"),
        ("Quale architetto ha progettato il Padiglione di Barcellona?", "Mies van der Rohe", ["Antoni Gaudí", "Le Corbusier", "Frank Lloyd Wright"], "medio"),
        ("Quale cattedrale gotica ha le guglie più alte di Francia?", "Notre-Dame di Rouen", ["Notre-Dame di Parigi", "La cattedrale di Reims", "La cattedrale di Chartres"], "medio"),
        ("Quale grattacielo di New York fu il più alto del mondo negli anni Trenta?", "L'Empire State Building", ["Il Chrysler Building", "Il Rockefeller Center", "Il Woolworth Building"], "medio"),
        ("Quale architetto progettò Villa Savoye?", "Le Corbusier", ["Mies van der Rohe", "Walter Gropius", "Alvar Aalto"], "difficile"),
        ("Quale ponte veneziano in legno attraversa il Canal Grande?", "Il ponte dell'Accademia", ["Il ponte di Rialto", "Il ponte degli Scalzi", "Il ponte della Costituzione"], "difficile"),
        ("Quale architetto ha progettato il Museo Guggenheim di New York?", "Frank Lloyd Wright", ["Frank Gehry", "Ieoh Ming Pei", "Renzo Piano"], "difficile"),
    ],
    "Cibo e Gastronomia|Gastronomia": [
        ("Quale attrezzo si usa per mescolare i cibi sul fuoco?", "Il mestolo", ["Il mattarello", "Lo schiacciapatate", "Il tagliere"], "facile"),
        ("Quale piatto si prepara con uova sbattute e formaggio in padella?", "La frittata", ["La carbonara", "Il risotto", "La polenta"], "facile"),
        ("Quale ingrediente rende soffice un impasto da forno?", "Il lievito", ["Il sale", "Lo zucchero a velo", "L'aceto"], "facile"),
        ("Quale coltello si usa per tagliare il pane?", "Il coltello seghettato", ["Il coltello da burro", "Lo spelucchino", "Il trinciante"], "facile"),
        ("Quale tecnica rosola la carne e poi la cuoce lentamente con liquidi?", "La brasatura", ["La frittura", "La scottatura", "La marinatura"], "medio"),
        ("Quale salsa si prepara con burro, farina e latte?", "La besciamella", ["La maionese", "La salsa di soia", "Il ragù"], "medio"),
        ("Quale metodo conserva i cibi sottaceto?", "La conservazione in aceto", ["L'affumicatura", "La surgelazione", "La liofilizzazione"], "medio"),
        ("Quale strumento controlla la temperatura interna degli alimenti in cottura?", "Il termometro da cucina", ["Il timer", "Il mestolo", "La schiumarola"], "medio"),
        ("Quale tecnica cuoce gli alimenti sfruttando il vapore?", "La cottura a vapore", ["La gratinatura", "La frittura", "La brasatura"], "medio"),
        ("Quale reazione chimica dà la crosta bruna alla carne arrostita?", "La reazione di Maillard", ["La caramellizzazione", "La fermentazione", "La saponificazione"], "difficile"),
        ("Quale tecnica separa i grassi solidi per ottenere il burro chiarificato?", "La chiarificazione", ["La decantazione", "L'emulsione", "La riduzione"], "difficile"),
        ("Quale coltura batterica è usata per produrre lo yogurt?", "I lattobacilli", ["I lieviti", "Gli acetobatteri", "Gli stafilococchi"], "difficile"),
        ("Quale salsa madre francese si prepara con roux scuro e brodo?", "La salsa spagnola", ["La salsa olandese", "La salsa bernese", "La velouté"], "difficile"),
    ],
    "Politica e Attualità|Attualità": [
        ("Quale strumento permette di pagare contactless in negozio?", "La carta con NFC", ["Il libretto degli assegni", "Il vaglia postale", "La banconota da 500 euro"], "facile"),
        ("Quale piattaforma è usata per riunioni di lavoro a distanza?", "Zoom", ["Netflix", "Spotify", "Steam"], "facile"),
        ("Quale fonte rinnovabile sfrutta il sole per produrre elettricità?", "Il fotovoltaico", ["Il carbone", "Il nucleare a fissione", "Il gas naturale"], "facile"),
        ("Che cosa misura l'inflazione?", "L'aumento dei prezzi", ["La disoccupazione", "Il prodotto interno lordo", "Il debito pubblico"], "facile"),
        ("Quale accordo internazionale del 2015 riguarda il clima?", "L'accordo di Parigi", ["Il protocollo di Kyoto", "Il trattato di Maastricht", "La convenzione dell'Aia"], "medio"),
        ("Quale organizzazione raccoglie i dati sanitari globali?", "L'OMS", ["L'UNESCO", "La FAO", "L'ILO"], "medio"),
        ("Quale materia prima ha visto forti rincari dopo il 2021?", "Il gas naturale", ["L'acqua potabile", "Il sale", "La carta"], "medio"),
        ("Quale tipo di energia è al centro della transizione energetica?", "Le rinnovabili", ["Il carbone", "Il petrolio", "Lo scisto bituminoso"], "medio"),
        ("Quale social network è tra i più usati per informarsi, secondo le ricerche di settore?", "Facebook", ["LinkedIn", "MySpace", "Flickr"], "medio"),
        ("Quale indice diffuso dall'ISTAT misura il costo della vita?", "L'indice dei prezzi al consumo", ["Il tasso di cambio", "Il PIL pro capite", "Lo spread"], "difficile"),
        ("Quale strumento di politica monetaria alza il costo del credito?", "L'aumento dei tassi di interesse", ["La riduzione della spesa pubblica", "L'aumento delle imposte", "La svalutazione della moneta"], "difficile"),
        ("Quale patto europeo disciplina la stabilità dei bilanci nazionali?", "Il patto di stabilità", ["Il trattato di Schengen", "Il regolamento Dublino", "La convenzione di Lomé"], "difficile"),
        ("Quale istituto italiano produce le statistiche ufficiali del Paese?", "L'ISTAT", ["La Banca d'Italia", "Il Ministero dell'Economia", "La Corte dei Conti"], "difficile"),
        ("Quale programma europeo finanzia ricerca e innovazione dal 2021?", "Horizon Europe", ["Erasmus+", "Europa Creativa", "LIFE"], "difficile"),
    ],
}

EXTRA_THEMED_TF: dict[str, list[tuple[str, str, str]]] = {
    "Arte e Architettura|Architettura": [
        ("Il Ponte Vecchio è un ponte di Firenze.", "VERO", "facile"),
        ("La Torre di Pisa è un campanile.", "VERO", "facile"),
        ("Il Partenone è un palazzo rinascimentale.", "FALSO", "facile"),
        ("Il Duomo di Milano è in stile gotico.", "VERO", "medio"),
        ("La Sagrada Família è opera di Antoni Gaudí.", "VERO", "medio"),
        ("La cupola del Pantheon di Roma è chiusa da vetrate.", "FALSO", "medio"),
        ("Il Bauhaus fu fondato da Walter Gropius a Weimar.", "VERO", "difficile"),
        ("La cupola di San Pietro è opera di Michelangelo.", "VERO", "difficile"),
        ("Il ponte di Rialto è stato costruito in cemento armato.", "FALSO", "difficile"),
    ],
    "Cibo e Gastronomia|Gastronomia": [
        ("La ricetta elenca ingredienti e passaggi di un piatto.", "VERO", "facile"),
        ("Per cuocere la pasta si usa acqua fredda.", "FALSO", "facile"),
        ("Il tagliere serve ad appoggiare gli alimenti da tagliare.", "VERO", "facile"),
        ("La bilancia da cucina misura i liquidi in litri.", "FALSO", "facile"),
        ("La mise en place è la preparazione degli ingredienti prima della cottura.", "VERO", "medio"),
        ("La cottura sous vide usa temperature molto alte.", "FALSO", "medio"),
        ("La maionese è un'emulsione di olio e tuorlo d'uovo.", "VERO", "medio"),
        ("Il brodo si ottiene cuocendo carne o verdure in acqua.", "VERO", "medio"),
        ("La frollatura serve a rendere la carne più dura.", "FALSO", "medio"),
        ("Il roux è un composto di farina e burro usato per addensare le salse.", "VERO", "difficile"),
        ("La pastorizzazione elimina tutti i microrganismi, comprese le spore.", "FALSO", "difficile"),
        ("La fermentazione lattica è alla base della produzione dei crauti.", "VERO", "difficile"),
    ],
    "Politica e Attualità|Attualità": [
        ("Oggi molte riunioni di lavoro si tengono in videoconferenza.", "VERO", "facile"),
        ("L'inflazione indica la crescita dei prezzi nel tempo.", "VERO", "facile"),
        ("Il riscaldamento climatico è un tema discusso a livello internazionale.", "VERO", "facile"),
        ("Le borse valori aprono solo nel fine settimana.", "FALSO", "facile"),
        ("Le elezioni politiche si svolgono periodicamente secondo la legge.", "VERO", "facile"),
        ("L'accordo di Parigi fissa un obiettivo di limitazione del riscaldamento globale.", "VERO", "medio"),
        ("La Banca centrale europea ha sede a Londra.", "FALSO", "medio"),
        ("Il PNRR è un piano di investimenti finanziato dall'Unione europea.", "VERO", "medio"),
        ("Il prezzo del petrolio influisce sul costo della benzina.", "VERO", "medio"),
        ("L'OMS ha sede a Ginevra.", "VERO", "medio"),
        ("Lo spread misura la differenza di rendimento tra titoli di Stato.", "VERO", "difficile"),
        ("Il tasso di disoccupazione rapporta i senza lavoro alla forza lavoro.", "VERO", "difficile"),
        ("L'ISTAT è un'agenzia dell'Unione europea.", "FALSO", "difficile"),
        ("La Banca centrale europea ha il compito di mantenere la stabilità dei prezzi.", "VERO", "difficile"),
        ("Il debito pubblico italiano è espresso in dollari.", "FALSO", "difficile"),
    ],
}
