# Partita di prova dal frontend — 24 novembre 2026

Partita giocata sulla UI vera (TV + sei telefoni), non sulla simulazione
headless: serve a raccogliere le problematiche da valutare, non a certificare i
punteggi. Backend e frontend locali, database di prova separato
(`data/pubgame.mv.db` mai toccato).

## Come si è giocato

- **TV**: `http://127.0.0.1:4201/tv` in Chromium 1600×900, sessione TV aperta
  come farebbe l'abbinamento regia, sei telefoni su `/play` a 390×844.
- **Telefoni**: sei squadre reali (Anna, Bruno, Carla, Dario, Elena, Fabio) con
  prova pulsanti, ingresso in lobby, risposte e gesti veri (fiche dell'Azzardo
  comprese).
- **Regia**: il pulsante AVANTI della TV, premuto come farebbe il presentatore.
- **Scaletta**: la serata vera (40 round, cinque atti, cinque bonus) e, per
  coprire tutti i giochi in tempi utili, la scaletta di simulazione della TV
  (`/tv?sim=1`, 13 round: uno per gioco). Nel giro sim la regia ha aspettato
  150 s per round prima di chiudere.
- **Raccolta**: console TV e telefoni, richieste HTTP ≥ 400, testo del palco a
  ogni round, avanzamento dello snapshot del server ogni 2 s.

## Problemi trovati

### 1. AVANTI premuto a round aperto blocca la regia (grave) — **risolto** (`96dda8f`)

**Fix.** La chiusura del round ha ora un tempo massimo di 8 s: se il server non
risponde il pulsante AVANTI torna attivo, e un tentativo ormai scaduto non apre
un secondo round quando la risposta arriva in ritardo. L'avviso va in console,
non più in un `alert` che blocca la TV. Test di regressione: «libera AVANTI se
il server non conferma la chiusura del round» e «non apre un secondo round se la
chiusura risponde dopo il tempo massimo» in `game.component.spec.ts`.

Se AVANTI arriva mentre il round è ancora in corso (prima del riepilogo), la TV
resta sulla schermata del round e **il pulsante non risponde più**: altri click
non fanno nulla per minuti, non compare nessun avviso, la sala resta ferma.

Riprodotto tre volte su partite diverse, per esempio:

```
[20:48:09] AVANTI step 2
[20:48:25] schermo ROUND: 0/40 ... QUALE PROGRAMMA RAI ... MANCHE 1/3
[20:48:59] AVANTI step 3
[20:49:09] AVANTI ripetuto step 3 tentativo 2
[20:49:20] AVANTI ripetuto step 3 tentativo 3
[20:49:33] AVANTI ripetuto step 3 tentativo 4
[20:50:59] PROBLEMA round non aperto step 3
```

Il percorso è `adminNextRound()`: con il round aperto mette `closingRound =
true`, chiama `closeRound` e solo nella callback rimette il flag a `false`. Se
la risposta non arriva (o arriva mentre la TV ha già cambiato scena) il flag
resta alto e ogni AVANTI successivo esce subito da `if (this.closingRound)
return;`. Il fix ha seguito la prima strada: tempo massimo sul flag e avviso in
console.

**Conseguenze osservate** (non problemi separati, si risolvono con questo):

- La numerazione del round va fuori sincrono: dopo qualche AVANTI ravvicinato la
  TV ha mostrato `ROUND: 0/40`, poi `1/40` mentre lo snapshot del server era al
  round 3, con la barra di avanzamento indietro. La TV e il server raccontano due
  round diversi; da valutare anche un riallineamento allo snapshot quando arriva.
- Se il round che si apre è il Time Buzzer, la manche non parte (vedi punto 2).

### 2. Time Buzzer resta su «TEMPO IN ARRIVO… Premi START» (sintomo del punto 1) — **risolto di conseguenza**

Con AVANTI che non resta più bloccato, il round precedente si chiude davvero e
il Time Buzzer parte (verificato nel giro dei 13 giochi).

Visto in una partita reale, ma **non è un difetto del Time Buzzer**: succede
quando il round si apre mentre il precedente non è ancora chiuso sul server
(`POST /time-buzzer/start` risponde 409 se il round corrente non è TIME_BUZZER).
Nel giro di copertura pulito, con AVANTI premuto solo a riepilogo mostrato, il
Time Buzzer è partito e si è chiuso regolarmente.

Resta comunque da valutare il comportamento di facciata: la TV continua a
mostrare il cronometro che gira senza indicare l'errore. Un retry sul via e uno
stato d'errore esplicito renderebbero il guasto riconoscibile invece che
silenzioso.

### 3. TV in lobby senza abbinamento: sembra pronta ma è offline (media)

Aprendo `/tv` senza una sessione TV autorizzata la lobby si disegna comunque
(QR, PARTITA #n, codice regia), ma il badge in alto resta **OFFLINE** e il
server non vede nessuna socket (`WebSocketSession[0 current ... 0 total]`).
La schermata non dice che manca l'abbinamento regia: chi prepara la serata può
credere che sia tutto pronto e accorgersene solo quando i telefoni non entrano.

### 4. `GET /games/{id}/bonus-entrance` risponde 401 anche con la sessione TV (media)

La TV chiede il seme degli ingressi bonus all'avvio; la richiesta torna 401 due
volte su due partite (anche con token TV valido e `sync` funzionante). La TV
ripiega sul seme 0: gli ingressi a sorpresa non arrivano dal server e due TV
sulla stessa partita non sono garantite allineate, contro quanto scritto nel
README («il piano della partita nasce da un seme che decide il server»).

### 5. AVANTI non è raggiungibile con la classifica aperta (media) — **risolto** (`37235ba`, `9195fb6`, `7350baa`)

Con la classifica a schermo il dock è coperto: il click su AVANTI non arriva e
serve prima CHIUDI CLASSIFICA. In più il pulsante di chiusura ha richiesto più
click di fila (7 tentativi registrati in un secondo) prima di togliere la
classifica.

**Fix.** La classifica occupa tutto lo schermo sopra la dock: la X finiva sotto
la scena, e la dock stessa le copriva la metà alta, quindi i click arrivavano
solo a colpi. Ora la chiusura è un pulsante della dock della regia, con la
scritta leggibile «✕ CHIUDI CLASSIFICA» accanto ad AVANTI, e la dock sale sopra
la classifica quando è aperta (`9195fb6`): AVANTI la chiude e passa al round
dopo, la chiusura la toglie al primo click.

Per non finire sotto la barra, le due classifiche riservano la fascia alta: con
la classifica aperta la TV espone `leaderboard-open` e QUICK e DETAILED
allungano il proprio `padding-top` (`clamp(88px, 11vh, 104px)` la veloce,
`clamp(84px, 10vh, 100px)` la finale). Nella finale anche il chip «CLASSIFICA
FINALE · EDIZIONE 26», che con la dock più larga restava coperto per un bordo,
scende nella fascia libera tra dock e copertina (`7350baa`). Misure a 720p:
dock fino a y 79, chip a y 88, copertina da y 157, con corona e podio interi.

Test di regressione in `game.component.spec.ts`: «con la classifica aperta la X
e AVANTI restano nella dock e la chiudono», «tiene la dock sopra la classifica
invece di nasconderle i pulsanti» e «un solo pulsante di chiusura, con la
scritta, chiude la classifica»; il controllo sul nome di classe
`leaderboard-close` è stato sostituito da quest'ultimo, che prova il comportamento
del pulsante.

### 6. `POST /games/{id}/tv-state` risponde 409 durante il passaggio di round (media) — **risolto** (`96dda8f`)

Registrato una volta nella partita reale e **20 volte** nel giro dei 13 giochi,
sempre nei passaggi di round (per esempio Canzone → Indovina chi, e intorno alla
chiusura di Ultima Spiaggia). La TV salva il checkpoint del round mentre il
server lo considera già chiuso. Non blocca la partita, ma riempie la console di
errori e può perdere lo stato di ripresa; con 40 round la frequenza cresce.

**Fix.** La TV manda il checkpoint solo se appartiene alla modalità ancora aperta
e mai mentre sta chiudendo il round; dopo un 409 non ritenta più quel round (il
successivo torna a salvarsi normalmente, mentre errori diversi dal 409 non
bloccano i retry). Test di regressione: «non salva il checkpoint di una modalità
che non è più quella aperta» in `game.component.spec.ts` e «dopo un 409 non
ritenta lo stesso round e riprende col successivo» in
`reliability.service.spec.ts`.

### 7. Arena: il telefono continua a rispondere dopo la chiusura del round (minore) — **risolto** (`37235ba`)

A round Arena chiuso la schermata resta attiva sul telefono e ogni tap produce
`POST /games/{id}/arena-answer` → 409 con toast «❌ Risposta arena rifiutata dal
server». Tre tap di fila, tre errori.

**Fix.** Il 409 di round chiuso chiude la schermata come negli altri giochi:
domanda scartata, telefono in attesa, niente errore a schermo né riga in
console. Una domanda Arena chiesta a round chiuso non viene più ritentata a
intervalli, quindi i 409 si fermano al primo. Test di regressione: «chiude la
schermata Arena in silenzio se la risposta arriva a round chiuso» e «non ritenta
la domanda Arena se il round si chiude mentre la chiede» in
`remote.component.spec.ts`.

### 8. Prova pulsanti: chi non trascina resta «Da controllare» (minore, forse voluto)

Nella lobby tutte e sei le squadre sono comparse con «Da controllare» perché il
passo di trascinamento è stato superato per timeout (15 s), non col gesto. Se
l'intenzione è segnalare chi non ha completato la prova, il messaggio è corretto
ma nell'uso reale rischia di marchiare mezza sala.

### 9. Dialogo «Partita completata! Resetta per ricominciare.» copre il palco (minore, da confermare)

Alla fine dell'ultimo round compare un dialogo modale che copre il dock: AVANTI
non è più raggiungibile e l'unica uscita è il reset. Per la fine serata può
essere voluto, ma se il presentatore vuole riaprire il riepilogo o commentare
l'ultima schermata non ha modo di farlo senza resettare la partita.

### 10. Nessun avanzamento automatico a fine round (da valutare)

Il conto alla rovescia «RIPARTENZA · PROSSIMO ROUND» esiste ma parte solo dopo i
bonus. A fine round la TV resta sul riepilogo a tempo indefinito: la serata vera
richiede 40 click di AVANTI. Se è voluto (il presentatore commenta), va bene;
se il countdown doveva valere anche per i round, non scatta.

## Cosa ha funzionato

- Sei telefoni in lobby in meno di due minuti, con prova pulsanti e presenze
  corrette sulla TV.
- Quiz a tre manches con risposte, punteggi e riepilogo corretti; classifica
  rapida e dettagliata; demo «COME SI GIOCA» con SALTA.
- Bonus Sirena Rossa (Casino colore) entrato in scena da solo a fine atto, con
  il suo ingresso e il suo suono, e avanzamento automatico alla fine.
- Nel giro di copertura tutti i **13 giochi** si sono aperti in sequenza, ognuno
  con la sua schermata «COME SI GIOCA» e il suo palco, e la partita è arrivata
  all'ultimo round senza blocchi della regia (AVANTI premuto sempre a round
  chiuso). Time Buzzer, Bomba, Tennis, Ultima Spiaggia, Azzardo, Blackjack,
  Arena e Speed Rush hanno accettato il gioco e chiuso il round.
- Azzardo con le fiche sul telefono (pointer event veri), Timeline, Indovina la
  canzone, Indovina chi: tutte le schermate si aprono e accettano gioco.

## Copertura

Partita reale sulla scaletta vera (40 round):

| Momento | Esito |
| --- | --- |
| Lobby e ingressi (6 telefoni) | completo |
| Quiz (3 manches) | completo, con riepilogo |
| Canzone (4 manches) | completo ma senza riepilogo entro 150 s |
| Azzardo | schermata e puntata, chiuso dalla regia |
| Timeline | schermata e carte, chiuso dalla regia |
| Time Buzzer | bloccato su «TEMPO IN ARRIVO» per il punto 1 |
| Bonus Casino colore | completo |
| Scaletta 40 round | interrotta al round 5 dal punto 1 |

Giro di copertura su tutti i 13 giochi (`/tv?sim=1`, 13 round, regia che chiude
dopo 150 s di osservazione) — **completato: 13 round su 13, nessun blocco**:

| # | Gioco | Esito osservato |
| --- | --- | --- |
| 1 | QUIZ | riepilogo mostrato |
| 2 | INDOVINA LA CANZONE | chiuso dalla regia dopo il timeout, senza riepilogo |
| 3 | INDOVINA CHI | chiuso dalla regia dopo il timeout, senza riepilogo |
| 4 | RUOTA DELLA FORTUNA | chiuso dalla regia dopo il timeout, senza riepilogo |
| 5 | TIMELINE | chiuso dalla regia dopo il timeout, senza riepilogo |
| 6 | TIME BUZZER | partito e chiuso regolarmente (nessun riepilogo entro 150 s) |
| 7 | BOMBA | chiuso dalla regia dopo il timeout, senza riepilogo |
| 8 | TENNIS BATTLE | chiuso dalla regia dopo il timeout, senza riepilogo |
| 9 | ULTIMA SPIAGGIA | riepilogo mostrato |
| 10 | AZZARDO | riepilogo mostrato |
| 11 | BLACKJACK | aperto e chiuso; telefoni lasciati senza puntate, gioco non valutato |
| 12 | ARENA | aperto e chiuso; risposte telefono in 409 dopo la chiusura (punto 7) |
| 13 | SPEED RUSH | aperto e chiuso dalla regia |

Nota: «senza riepilogo» significa che la regia ha chiuso dopo i 150 s di
osservazione, senza aspettare la fine naturale del round; per quei giochi
punteggi e riepilogo non sono stati verificati. Gli errori raccolti nel giro
sono 31, quasi tutti `tv-state` 409 (punto 6) più gli errori Arena del punto 7;
nessuno ha fermato la partita.

## Come riprodurre

1. Backend di prova su 8091 con DB nuovo e `CONTROL_SECRET` lungo almeno 32
   caratteri; frontend su 4201 (`BE_PORT=8091 FE_PORT=4201 node scripts/dev.mjs
   frontend`).
2. Sessione TV via `POST /games/{id}/session` con `X-Control-Secret`, poi
   `localStorage` con `activeGameId`, `pubgame.session.<id>.TV` e
   `pubgame.intro.seen=1`.
3. Sei telefoni su `/play?game=<id>&nickname=<nome>&quad=1`.
4. AVANTI sulla TV a round aperto: si vede il punto 1. AVANTI a riepilogo
   mostrato: il round successivo parte regolarmente.
5. Per il giro completo dei giochi aprire `/tv?sim=1` (13 round, uno per gioco).
