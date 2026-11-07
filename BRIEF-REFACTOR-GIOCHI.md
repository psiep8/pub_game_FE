# Brief refactor: progetto e giochi

> **PROSSIMA VERSIONE — piano di refactoring (7 novembre 2026).**
> Descrive cosa cambia **dopo** la beta fotografata dagli altri documenti. Le sezioni sono
> indipendenti: si può procedere un gioco alla volta.

Documento operativo per chi implementa. Le sezioni sono indipendenti: si può procedere un gioco alla volta.

## 0. Effetti sonori sulla TV
I suoni di conferma sono oggi sul telefono. Vanno spostati sulla TV come effetti da bar: tintinnio di gettoni, applauso, "uuuh" quando una squadra sbaglia, rullo prima delle rivelazioni, sirena per le bombe. Il telefono resta con al massimo una vibrazione breve.

## 1. Refactor del progetto
1. **Pulizia:** eliminare codice deprecato e non usato (restano `CHRONO` e `TRUE_FALSE` in `GameType`, endpoint dei prezzi, bonus e modalità non più in scaletta). Controllare con `ts-prune` o `knip` prima di cancellare.
2. **Enum globali al posto delle stringhe.** Il conteggio nel codice frontend è: `'REVEAL'` 36, `'FINALE'` 32, `'WAITING'` 28, `'PICK'` 14, `'PLAYING'` 13, `'RACE'` 11, `'INTRO'` 10. Creare in `shared/enums/` almeno: `GamePhase` (fasi comuni), `GameModeType`, `BonusType`, `PlayerStatus`, `WsAction` (azioni WebSocket, ora stringhe sparse) e un `as const` per i tipi dei messaggi. Le fasi proprie di un solo gioco restano nel suo file ma come enum.
3. **Struttura Angular 22:** componenti standalone e con signal, un file per componente con nome esplicito (`*.component.ts`), `inject()` al posto dei costruttori, controllo di flusso `@if/@for` nei template, `ChangeDetectionStrategy.OnPush` ovunque, route lazy con `loadComponent`.
4. **Cartelle:** `core/` (servizi singleton, guard, ws), `shared/` (enum, modelli, utility, componenti riusabili), `features/` (`tv`, `remote`, `admin`, `games/<gioco>`, `bonus/<bonus>`), ogni gioco con la sua cartella (modalità, componente TV, componente telefono, test). Spostare con `git mv` per non perdere la storia.
5. **Fare i passi uno alla volta**, con build e test verdi tra uno e l'altro.

## 2. Indovina chi
- Durata più lunga (90 s invece di 60) e schiarimento proporzionato: la sfocatura scende a gradini lungo tutta la durata.
- Ogni ~15 s la TV mostra un indizio (film, carriera, curiosità). 5-6 indizi per personaggio, dal più vago al più facile.
- La banca ha solo 6 personaggi: servono almeno 60, ciascuno con immagine e indizi (preparare con lo script di generazione).

## 3. Ruota della Fortuna
Le lettere in uscita sono un'estrazione mista. Per ogni frase si contano le lettere presenti e si ordinano per presenza. Il mazzo alterna lettere comuni della frase a lettere casuali: nelle prime 3 estrazioni c'è sempre almeno una vocale e almeno una lettera che compare 2 o più volte nella frase; poi 1 su 3 estrazioni resta tra le più presenti. Così non si aspetta mai troppo per le lettere importanti.

## 4. Time Buzzer
Partenza automatica per tutti. Il server manda `TIME_BUZZER_START` a tutti i telefoni dopo un conto alla rovescia 3-2-1 sulla TV. Ogni telefono misura il tempo dalla ricezione del segnale al tocco di STOP (`performance.now()`), il server controlla che il valore sia plausibile rispetto al tempo trascorso. 5 manche con bersagli casuali sotto i 30 s, al centesimo.

## 5. Bomba (nuova logica, a turni)
Gioco solo a malus, senza interazione diretta tra tavoli.
- **Tabellone:** con `n` squadre ci sono `2n + n/2` caselle e una bomba ogni tre squadre: 20 opzioni e 3 bombe con 8 partecipanti, 15 e 2 con 6, 10 e 1 con 4.
- **Domanda:** "Quale tra queste NON appartiene a…?": le caselle sono elementi della categoria e le bombe sono gli intrusi. Quasi tutte le opzioni sono vere, solo una ogni tre squadre è falsa.
- **Telefono:** ogni telefono mostra la lista completa come pulsanti, ma si sceglie solo quando il server dà il turno. L'admin legge la domanda ma non sceglie; la TV mostra tabellone, turno e scelte.
- **Turni:** si gioca una squadra alla volta, in ordine. La squadra di turno dice un'opzione e il turno passa alla successiva sia se la casella è vera sia se è una bomba. Vent'anni secondi per turno: chi non risponde salta il turno, senza penalità.
- **Punti:** una casella vera non cambia i punti; una bomba costa 200 punti a chi la sceglie (mai sotto zero in classifica) e lo toglie dal round.
- **Se non tutte le bombe esplodono:** nessun problema. A fine round la TV mostra quelle rimaste e le disinnesca senza conseguenze. Se non ne esplode nessuna, nessuno perde punti.

## 6. Speed Rush: nuove microprove
Si mescolano in un mazzo (senza ripetizioni consecutive dello stesso tipo):
- **Matematica semplice** (3+5, 2×5): 3 pulsanti con i risultati (niente tastiera, ci vuole troppo).
- **Mischia colori:** un colore risultante e N colori sotto; si selezionano quelli che lo producono.
- **Bandiera:** una bandiera sopra e due nomi a pulsanti (per esempio Camerun e Senegal).
- **Sinonimi e contrari:** una parola sopra e due pulsanti, uno giusto.
- **Traduzione:** una parola inglese e due pulsanti.

## 7. Blackjack
Chi sbaglia perde. Si punta 100, 200 o 300 punti reali (mai sotto zero). Blackjack naturale paga il doppio. Sulla TV, accanto al banco, si vede la mano della squadra che gioca in quel turno, con effetti da bar (gettoni, "CARTA!", "LASCIA!"). Nota: nell'ultimo pull `BonusType` ha `CASINO`, `BASKET`, `CAVALLO`, `BIGLIE`: verificare dove sta il blackjack (manche del bonus Casino o round) e uniformare.

## 8. Quota: nuovo nome "Azzardo"
Tre volte nella serata, con difficoltà crescente: 1 facile/media, 2 media, 3 difficile. Ogni volta 4 manche, una per categoria:
1. Anno di nascita di una celebrità.
2. Anno di uscita di una canzone.
3. Nazione vista in foto o sagoma della mappa: nel livello facile "quanti paesi confinanti?" (0-14), nel difficile "quanti abitanti, in milioni?". Preferire sagoma o mappa (libera da diritti) alle foto.
4. Anno di un evento storico.

Le quattro opzioni sono molto vicine tra loro. Puntata sui punti veri: 100, 200 o 300 per manche. Vincita = puntata × quota (facile 2, media 3, difficile 4). Perdita = puntata × moltiplicatore che scende lungo le manche (100% alla prima, poi 80%, 60%, 40%): chi perde presto perde di più, chi resiste perde meno. Mai sotto zero. Serve una banca di almeno 30 domande per categoria e livello.

## 9. Scommessa: nuovo nome "Tutto o metà"
5 round. In ogni round viene estratta una categoria. Ogni squadra sceglie per quel round un livello da 100 a 500; **ogni livello si usa una sola volta per squadra in tutta la partita**, quindi all'ultimo round resta un solo livello. Ogni telefono ha la propria domanda a 4 risposte, uguale per chiunque abbia scelto lo stesso livello. Giusta = +valore, sbagliata o scaduta = −metà del valore. La TV mostra per squadra livello scelto ed esito. Servono domande a 5 livelli per ogni categoria (almeno 4 per livello).

## 10. Biglie
La visione di gara va bene. Cambiare solo il percorso: più curve, tornanti, deviazioni anche doppie (bivi che si ricongiungono), per creare incertezza. Con Matter si fa con segmenti inclinati, perni e bivi; la gara resta decisa dal seme scelto prima (simulazione nascosta, poi replay).

## 11. Consigli
- Prima di tutto la banca domande: i giochi nuovi ne hanno bisogno in grande quantità (Vero/Falso, 3 opzioni per Bomba, numeriche per Azzardo, 5 livelli per Tutto o metà, 60 personaggi, parole inglesi, bandiere).
- Tenere un solo file di costanti per punteggi e durate (`scoring-rules.ts`) così si regola il bilanciamento in un punto.
- Dopo il refactor, una prova completa con 8-10 telefoni prima di aggiungere altro.
