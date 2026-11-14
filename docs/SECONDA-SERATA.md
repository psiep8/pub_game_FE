# Seconda serata — le decisioni

La prima serata con telefoni veri è andata in porto. Questo documento raccoglie
le decisioni prese il **14 novembre**, guardando quello che la sala ha chiesto:
non è un piano di sviluppo, è il contratto con cui si tocca il codice prima
della seconda serata.

La pagella dei giochi e i guasti tecnici della prima serata stanno in
`docs/FIX-PRE-SERATA.md` §5.1 e §5.2. Qui c'è solo cosa cambia nel formato.

---

## 1. I bonus non sono più giochi

Un bonus diventa **un momento di 60–90 secondi**: zero regole da spiegare, zero
punti, zero classifica. Il motivo è nei dati della serata: i tre bonus più
riusciti (Casino, Cavallo, Biglie) non muovevano la classifica, mentre i bonus
come gara costruivano un secondo tabellone che nessuno guardava.

Conseguenza: il bonus non deve più dimostrare di essere un gioco equo. Deve
solo funzionare in sala.

---

## 2. Casino e Biglie diventano round

Sono i due momenti che la sala ha chiesto di rigiocare: da round entrano nella
classifica normale, senza inventare un secondo sistema di punteggio.

| Gioco | Da bonus | Da round |
|---|---|---|
| **Casino** | quattro manche (colore, dozzina, sestina, secco) | **una manche sola**, come chiesto dalla sala |
| **Biglie** | quattro gare, punti cumulativi | così com'è: è già un round travestito |

**Punti da riscalare.** Oggi il Casino arriva a 750 e le Biglie a 600, contro i
1000 di un Quiz. Da round devono valere fino a circa 1000, altrimenti chi vince
il Casino prende meno di chi indovina tre quiz. La tabella vive in
`apps/frontend/src/app/shared/models/scoring-rules.ts` ed è letta da admin,
manuale e demo.

**Scaletta da aggiornare.** Promuovere due bonus significa cambiare `ACT_DECKS`
in `shared/schedule.ts`, i conteggi dei round, il manuale, le demo e i test di
copertura. Non è una modifica da due righe: è il lavoro più grosso di questo
giro.

---

## 3. Basket fuori

In serata reale il bonus è bloccato e non è giocabile. Il pulsante in regia non
deve offrire un bonus che poi non parte: lo slot dell'atto 2 resta libero
finché non si decide con cosa riempirlo.

---

## 4. Cavallo

Resta l'unico bonus-gara, ma non si riprova finché il voto della categoria non è
affidabile: la TV oggi scarta i voti dei nomi che non trova identici in
`players` e dopo 15 secondi sceglie a caso.

Da decidere, prima di toccarlo:

- **rush per tutti** come oggi (otto domande in sessanta secondi, tutte le
  squadre insieme), oppure
- **una domanda a testa** a rotazione, più vicino a un "cavallo di battaglia".

Sono due giochi diversi: il primo è una corsa, il secondo è un duello. La scelta
cambia telefono, TV e tempi.

---

## 5. La sorpresa: la costellazione

Il bonus "sorpresa" non è un gioco: è una scena. La regia preme un pulsante, si
spengono le luci, i telefoni diventano luci.

### Come si svolge

1. In regia si preme **SORPRESA**. La TV va a nero, tiene un battito e mostra il
   tasto grande **SPEGNI LE LUCI — 3, 2, 1**.
2. Al buio i telefoni si accendono **uno alla volta**, ognuno del colore della
   sua squadra, in ordine casuale.
3. Quando sono tutte accese, pulsano insieme sul battito della TV.
4. La TV compone i colori in una forma sola e mostra **RIACCENDI**.
5. Si torna alla classifica. Nessun punto, nessuna spiegazione.

### Vincoli tecnici

- **Vibrazione**: `navigator.vibrate` non esiste su iPhone. Solo Android. La
  scena non può contarci.
- **Audio dai telefoni**: iOS lo sblocca solo con un gesto e non è affidabile a
  metà serata. L'audio lo tiene la TV.
- **Luminosità**: non si può forzare da remoto. Schermo colorato sì, luminosità
  no.
- **Sincronia**: sulla LAN va bene, ma il disegno deve tollerare 200–300 ms.
  Onde e sequenze sì, flash unico no.
- **Riconnessione**: un telefono che rientra a metà scena deve ricevere lo
  stato attuale o aspettare il prossimo, senza rompere la scena.

### Cosa serve nel codice

- Una nuova azione `SURPRISE_STATE` e la relativa voce nelle whitelist del
  backend (`WebSocketConfig`): il test `WebSocketActionWhitelistTest` chiude la
  sessione con 1002 se un'azione legittima resta fuori elenco.
- Una schermata a tutto schermo sul telefono.
- Chiusura con **CHIUDI BONUS**, senza toccare lo stato del round.
- Funziona anche senza buio: se in sala non si possono spegnere le luci, la
  scena regge lo stesso con TV e telefoni.

### Variante (solo se serve più "intrigo")

Al buio un solo telefono riceve un messaggio segreto ("sei tu il prescelto");
alla fine la sala deve indovinare chi è. Al prescelto si dà un privilegio, non
punti: per esempio sceglie la categoria del round successivo. Costa poco di più,
ma introduce una regola da spiegare.

---

## 6. Cosa resta aperto

- Casino: confermare **una manche sola** (o due) e i punti esatti da round.
- Slot del bonus dell'atto 2, dopo l'uscita del Basket.
- Cavallo: rush per tutti o domanda a testa.
- Punti esatti di Casino e Biglie da round.
