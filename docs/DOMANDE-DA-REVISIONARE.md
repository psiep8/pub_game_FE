# Domande e regole da revisionare

Qui finisce tutto ciò che l'audit automatico non può decidere: fatti dubbi,
domande con due risposte difendibili, distrattori che possono ingannare più del
giusto e le scelte lasciate aperte dalla specifica. Ogni riga va approvata o
scartata da chi conosce il pubblico; l'audit propone, non decide.

L'elenco delle segnalazioni automatiche è in `docs/BANCHE-AUDIT.md`, rigenerato
con `npm run audit:banche`.

## Scelte della specifica da confermare

| Voce | Proposta seguita | Cosa serve |
| --- | --- | --- |
| Punti "a metà campo" con N pari | positivi ai primi `N/2`, negativi agli ultimi `N/2`, nessuno a zero | conferma della formula simmetrica |
| Timeline con 1 o 0 posti giusti | entrambi a −200 | conferma dell'unione dei due casi |
| Time Buzzer "tempo perfetto" | errore ≤ 50 ms vale +600 | provare la soglia sul telefono, in sala |
| Numero secco del Casino | **deciso il 23 novembre 2026: tre girate**, come colore e dozzina; se nessuno becca il numero, quella girata non paga nessuno | nessuna conferma: allineato a `casino-bonus.component.ts` |
| Finestra di scelta dei bonus | 10 secondi, si chiude prima se tutti hanno scelto | conferma della durata |
| Premi di Blackjack e Cavallo | gestiti da barista e presentatore, fuori dall'app | concordare premi e consegna in sala |
| Distrattori delle banche | corretti: l'audit non segnala più risposte più lunghe né distrattori troppo corti | rileggere le 47 opzioni riscritte con il pubblico davanti |
| Copertura di Ultima spiaggia | **ripiego dichiarato**: se una fascia è esaurita, `QuestionBankService` pesca una domanda nuova della stessa categoria e ne mostra la difficoltà reale; restano 69 combinazioni sotto le 12 domande dedicate | riempirle solo con domande verificate, non inventate |
| Versione | 2.2.0 | conferma prima del rilascio |

## Domande da guardare a mano

Le 47 risposte più lunghe dei distrattori sono state riallineate cambiando la
forma delle opzioni o accorciando la risposta, senza cambiare i fatti. L'audit
ora restituisce **0 segnalazioni** e **0 doppioni**. Restano da rileggere in
sala le nuove formulazioni, in particolare i nomi completati con il ruolo
(`Re Umberto I`, `Claudio Tolomeo`) e i titoli con la precisazione tra parentesi
(`Élite (serie)`, `The Wall (album)`).

Due controlli dell'audit sono stati corretti perché producevano falsi positivi:
`C#` è un'opzione valida di due caratteri e una risposta di un solo carattere
come l'articolo `L'` comparirebbe dentro qualunque testo italiano.

<!-- Le righe vengono rigenerate dall'audit: vedi docs/BANCHE-AUDIT.md, sezione
     "Segnalazioni". Non aggiungere qui fatti nuovi senza la fonte. -->

_(nessuna nuova voce registrata a mano)_

## Esito dell'audit esteso (B3, 23 novembre 2026)

L'audit automatico ora copre anche **Indovina chi**, **Musica**, **Ruota** e
**Bomba**. Comandi: `npm run audit:banche` (report in `docs/BANCHE-AUDIT.md`),
`node scripts/audit-banche.mjs --ci` (fallisce su doppioni, campi mancanti e
segnalazioni delle domande).

| Banca | Copertura | Doppioni | Problemi automatici | Da guardare a mano |
| --- | --- | --- | --- | --- |
| Indovina chi (`media-it.json`, people) | 150 persone, 7 categorie | 0 | 0: tutte con categoria, foto su disco, descrizione ed estratto | nessuna voce: gli indizi sono verificati da `CelebrityClueLeakTest` |
| Musica (`media-it.json`, music) | 114 brani, 5 occorrenze in serata | 0 | **1 campo mancante**: `year` vuoto per «Boulevard of Broken Dreams» | l'anno va aggiunto con la fonte (vedi sotto) |
| Ruota (frasi in `QuestionBankService.PROVERBS`) | 32 frasi, 2 occorrenze in serata | 0 | 0: nessuna frase sotto le tre parole o con numeri | 32 frasi bastano per due occorrenze, non per ripetere la stessa serata: valutarne altre |
| Bomba (`bomba-it.json`) | 95 affermazioni (50 vere, 45 false), 11 categorie da 7 a 10 affermazioni | 0 | 0 campi mancanti: ogni riga ha id, categoria, booleano e fonte | **11 false** in cui il controllo «un solo dettaglio cambiato» non trova una vera abbastanza vicina (elenco sotto) |

### Musica: anno da completare

| Brano | Artista | Campo | Cosa serve |
| --- | --- | --- | --- |
| Boulevard of Broken Dreams | Green Day | `year` vuoto | anno di pubblicazione con la fonte, da inserire in `media-it.json` |

### Bomba: false da leggere a mano

Il controllo automatico misura la distanza in parole dalla vera più vicina
della stessa categoria: se è maggiore di 2 non può garantire che sia cambiato
**un solo dettaglio**. Non significa che la frase sia sbagliata, solo che la
coppia vera/falsa va confrontata a mano (o che manca la vera corrispondente).

| ID | Frase falsa | Perché è in elenco |
| --- | --- | --- |
| `bomba-natura-04` | La rondine è l'animale più veloce in volo. | la vera vicina nomina il falco pellegrino: il dettaglio cambiato è l'animale, non un numero |
| `bomba-natura-06` | Lo squalo balena è il più grande animale esistente. | stessa struttura, soggetto diverso dalla vera |
| `bomba-natura-08` | I ragni sono insetti. | la vera vicina parla di otto zampe: manca la vera «i ragni non sono insetti» |
| `bomba-cinema-04` | Il padrino è diretto da Martin Scorsese. | un solo nome cambiato, ma la distanza in parole è 3 |
| `bomba-musica-06` | Mozart compose La Traviata. | il titolo cambiato è di più parole del titolo vero |
| `bomba-musica-08` | Il violino ha cinque corde. | la vera vicina cambia anche lo strumento |
| `bomba-arte-02` | La Gioconda è di Raffaello. | un solo nome cambiato, distanza 3 |
| `bomba-arte-08` | La Torre Eiffel fu inaugurata nel 1900. | non c'è una vera sulla Torre Eiffel: la più vicina è la Gioconda |
| `bomba-tecnologia-02` | Il World Wide Web fu proposto da Bill Gates. | nome cambiato, distanza 3 |
| `bomba-tecnologia-08` | La sigla CPU indica la memoria di massa. | la vera cambia la definizione con più parole |
| `bomba-letteratura-08` | Il Gattopardo è di Leonardo Sciascia. | manca la vera sullo stesso libro |

## Fatti da verificare

_(nessuno: ogni evento Timeline aggiunto porta la sua fonte nel campo `source`;
le voci senza fonte sicura non sono state inserite)_
