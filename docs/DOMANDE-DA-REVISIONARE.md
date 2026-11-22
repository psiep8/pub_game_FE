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

## Fatti da verificare

_(nessuno: ogni evento Timeline aggiunto porta la sua fonte nel campo `source`;
le voci senza fonte sicura non sono state inserite)_
