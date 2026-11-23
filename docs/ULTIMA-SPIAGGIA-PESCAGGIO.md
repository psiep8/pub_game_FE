# Ultima spiaggia: come funziona il pescaggio e perché la soglia è 3

Questo file riporta cosa fa il codice oggi, con i riferimenti puntuali, e su
quella base motiva la soglia minima di domande per categoria e livello.

## Come funziona davvero il pescaggio

| Fatto | Dove |
| --- | --- |
| Ogni occorrenza di Ultima spiaggia usa **una sola categoria**, scelta a caso tra quelle utilizzabili | `QuestionBankService.java:929-948` |
| Il payload contiene **cinque domande, una per livello** (100, 200, 300, 400, 500) | `QuestionBankService.java:972-1000`, livelli in `QuestionBankService.java:145` |
| La domanda di ogni livello viene presa **solo dalla fascia dichiarata**; non c'è più il ripiego su un'altra fascia | `QuestionBankService.java:1040-1060` |
| Il payload è **uno solo per il round**: viene salvato su `GameRound` e tutte le squadre leggono quello | `GameController.java:176-193` (payload del round) |
| Quindi: **la stessa domanda di un livello va a tutte le squadre che scelgono quel livello**, non una domanda per squadra | conseguenza dei due punti sopra |
| Ogni squadra non può ripetere un livello già scelto nella stessa partita | `UltimaSpiaggiaLevelService.java:12-17, 62-84` |
| Cosa si consuma è la **domanda** (chiave domanda+risposta), per `gameId` | `QuestionHistoryService.java:117-141` (`key`, `isUsed(gameId, key)`) |
| Una domanda consumata non torna **nella stessa partita**, ma lo storico non ha memoria tra serate diverse: a ogni nuova partita riparte | `QuestionHistoryService.java:129-149` (tutto è per `gameId`) |

Conseguenza pratica: le domande sono condivise fra le squadre, quindi il
consumo per serata è quello delle occorrenze di gioco (una categoria e cinque
domande per occorrenza), non quello delle squadre.

## Perché la soglia minima è 3

- Celle della griglia: **16 categorie × 5 fasce = 80**. Conto in
  `docs/BANCHE-AUDIT.md`, tabella "Ultima spiaggia".
- Una sola domanda per cella (la soglia precedente, 1) significa: la seconda
  volta che una categoria viene ripescata nella stessa partita non c'è più
  niente di nuovo in nessuna fascia, e la terza serata ripropone subito le
  stesse cinque domande.
- Con **3 per cella** una categoria può servire fino a tre occorrenze della
  stessa partita (una domanda per fascia a ogni giro) e la banca resta sopra
  la soglia richiesta ("almeno 3 per categoria e livello").
- Poiché lo storico è per `gameId`, **3 è il minimo, non un tetto**: crescere
  oltre 3 accorcia le ripetizioni da una serata all'altra, e resta la strada
  per farlo senza toccare il codice.

## Cosa è stato aggiunto

- `scripts/generate-questions/bank_spiaggia.py`: 160 domande nuove (2 per
  categoria e fascia), ognuna con la voce usata per la verifica.
- `scripts/generate-questions/spiaggia_bands.json`: 80 id già in banca con la
  fascia rilevata a mano.
- `scripts/generate-questions/apply_spiaggia.py`: applica fasce e domande alla
  banca **senza rigenerarla** (`build_curated_bank.py` non le conosce e le
  perderebbe); con `--check` verifica che banca e file siano allineati.
- Risultato: 1143 domande, 240 con `spiaggiaBand`, **3 per categoria e
  fascia**, nessuna domanda preesistente modificata.
- `scripts/audit-banche.mjs`: soglia portata da 1 a 3 e **i buchi ora fanno
  fallire `--ci`** (prima erano solo segnalati). Verificato: con soglia 4
  l'audit esce 1 segnalando 80 celle, con soglia 3 esce 0.

## Limite noto, non corretto qui

`build_curated_bank.py` rigenera la banca da zero e perde fasce e aggiunte
manuali (`quiz-gaming-28`, `quiz-curiosita-40`, `quiz-viaggi-40` sparivano, 423
voci avevano le opzioni rimescolate). È un problema che c'era già prima di
questo intervento: per questo la banca si aggiorna con `apply_spiaggia.py` e
non rigenerandola.
