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
| Numero secco del Casino | una sola girata: se nessuno becca il numero, nessuno prende punti | conferma con il gestore |
| Finestra di scelta dei bonus | 10 secondi, si chiude prima se tutti hanno scelto | conferma della durata |
| Buono bevande del Blackjack | massimo 3 squadre premiate per serata | decidere il tetto con il gestore |
| Consegna dei buoni | la TV mostra il premio, ma il buono non ha ancora un codice, uno stato consegnato/non consegnato né una schermata sul telefono | definire flusso e persistenza prima della serata |
| Distrattori delle banche | 47 risposte corrette sono più lunghe dei distrattori e 1 distrattore è molto corto (elenco in `docs/BANCHE-AUDIT.md`) | riscrivere a mano, senza cambiare i fatti |
| Copertura di Ultima spiaggia | 69 combinazioni categoria/livello senza domande dedicate | decidere se riempirle o dichiarare il ripiego |
| Versione | 2.2.0 | conferma prima del rilascio |

## Domande da guardare a mano

Le domande qui sotto sono state segnalate dall'audit perché la risposta corretta
è più lunga o più dettagliata dei distrattori: è un indizio di forma, non un
errore di fatto. Vanno resi i distrattori dello stesso formato, oppure la
domanda va riscritta.

<!-- Le righe vengono rigenerate dall'audit: vedi docs/BANCHE-AUDIT.md, sezione
     "Segnalazioni". Non aggiungere qui fatti nuovi senza la fonte. -->

_(nessuna voce ancora registrata a mano)_

## Fatti da verificare

_(nessuno: ogni evento Timeline aggiunto porta la sua fonte nel campo `source`;
le voci senza fonte sicura non sono state inserite)_
