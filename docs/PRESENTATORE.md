# PubGame — Guida del presentatore

> Per chi conduce la serata. Dice **cosa vedi**, **cosa premi** e **cosa succede**
> prima, durante e dopo ogni round. Il copione con le frasi da dire è in
> [`../PRESENTAZIONE-PUBGAME.md`](../PRESENTAZIONE-PUBGAME.md); i pulsanti del
> pannello sono anche in [`PANNELLO-ADMIN.md`](PANNELLO-ADMIN.md); le squadre
> hanno il loro manuale in [`MANUALE-TELEFONO.md`](MANUALE-TELEFONO.md).

---

## 1. I tre schermi

| Schermo | Indirizzo | Chi lo guarda |
| --- | --- | --- |
| **TV** | `/tv` | Tutti. Mostra QR, domande, tabelloni, timer, classifiche. |
| **Regia** | `/admin` | Solo il presentatore, dal telefono o dal tablet. |
| **Telefoni** | `/play` | Ogni squadra, dopo aver inquadrato il QR. |

La regia **non vota** e **non risponde**: decide solo se una risposta a voce è
giusta o sbagliata, e quando la serata avanza.

---

## 2. Accendere e abbinare la regia

1. Accendi il backend e apri la TV su `/tv`. Nella lobby compaiono
   **PARTITA #N** e il riquadro **CODICE REGIA**.
2. Se il codice non c'è, premi **GENERA CODICE** sulla TV: la TV chiede il
   **segreto di regia** (`CONTROL_SECRET`). Il codice vale **5 minuti** e
   **una volta sola**.
3. Apri `/admin` sul telefono del presentatore:
   - nel campo **PARTITA #** metti il numero della lobby (di solito è già giusto);
   - se compare il riquadro **🔒 REGIA NON ABBINATA**, scrivi le 6 cifre e premi
     **ABBINA REGIA**; diagnostica e categorie si vedono comunque.
4. La regia è abbinata quando il riquadro **📡 CONNESSIONI & SALVATAGGIO**
   mostra lo stato della partita.

> Dopo 5 codici sbagliati la partita blocca i tentativi per un minuto: non è un
> guasto, aspettate e riprovate. Se la regia è già abbinata, riaprire `/admin`
> non richiede il codice: la sessione è salvata nel browser.

---

## 3. Pre-volo (5 minuti, prima di far entrare le squadre)

1. **Stato partita** nella diagnostica: deve rispondere, con **Dispositivi
   online** a zero prima che entrino i telefoni.
2. **Round aperto: no**. Se è *sì* c'è un round rimasto appeso: premi
   **⏸️ PAUSA / RIPRENDI** e poi di nuovo, oppure **▶️ PARTI** per chiuderlo.
3. **🗂️ CATEGORIE & TIMELINE**: accendi solo le categorie che vuoi giocare.
   🕒 Timeline va acceso solo sulle categorie con eventi ordinabili.
4. **🧪 PROVA DEI PULSANTI**: premi **▶️ AVVIA / RIFAI PROVA** e fai toccare ogni
   telefono. La riga finale diventa **TUTTI PRONTI**; in alternativa
   **⏭️ SALTA PROVA** oppure **⚠️ AVVIA COMUNQUE**.
5. **▶️ PARTI** è grigio finché la prova non è completa: è voluto.

---

## 4. Il pannello in un colpo d'occhio

| Riquadro | A cosa serve |
| --- | --- |
| **✅ SOLUZIONE** (in alto) | La risposta corretta del round. Non leggerla alle squadre. |
| **📡 CONNESSIONI & SALVATAGGIO** | Stato, round, eventi salvati, round aperto, domande usate, dispositivi online. |
| **🧪 PROVA DEI PULSANTI** | Il controllo dei telefoni. |
| **🗂️ CATEGORIE & TIMELINE** | Accendere/spegnere categorie, flag Timeline, aggiungerne una. |
| **🎬 DEMO** | Spiegare un gioco in TV senza toccare la partita. |
| **🎬 CONTROLLO FLUSSO** | I pulsanti che fanno avanzare la serata. |
| **Riquadro centrale** | Prenotazione, decisione, tabella punti del round. |

### I pulsanti

| Pulsante | Cosa fa | Quando |
| --- | --- | --- |
| **▶️ PARTI** | Apre il round successivo. | All'inizio di ogni round. |
| **🎵 PROSSIMA MANCHE** | Passa alla manche dopo (Canzone, Time Buzzer…). | Solo nei giochi a manche. |
| **🏆 MOSTRA CLASSIFICA** | Anticipa la classifica rapida in TV. | Quando vuoi commentare i punti. |
| **⏸️ PAUSA / RIPRENDI** | Copre TV e telefoni e ferma i timer. | Imprevisto, telefono da sistemare. |
| **↺ RIVEDI INTRO** | Rimette la presentazione iniziale in TV. | Per ripetere le regole. |
| **🎄 NATALE ON/OFF** | Tema natalizio su TV e telefoni. | Solo estetica, non cambia i punti. |
| **🎰 🏀 🐎 🎱 BONUS** | Apre il bonus dell'atto. | Dopo la classifica di fine atto. |
| **✖️ CHIUDI BONUS** | Chiude il bonus in TV. | A bonus concluso. |
| **🎬 APRI IN TV / ✖️ CHIUDI DEMO** | Apre o chiude la demo scelta. | Per spiegare un gioco. |

Sulla TV, in alto: **🔊 audio**, **⏸️ pausa**, **🎨 tema**, **AVANTI** (round
successivo), **🔄 reset**. Il reset va usato solo se siete davvero fuori strada.

---

## 5. Un round, passo per passo

1. **Prima**: annuncia il gioco. Se serve, apri la **DEMO** del gioco e chiudila
   con **✖️ CHIUDI DEMO**.
2. Premi **▶️ PARTI**. La TV estrae la modalità e la categoria, poi mostra la
   domanda; i telefoni si accendono.
3. **Durante**: guarda la TV per il tempo e la diagnostica per i telefoni.
   I telefoni spenti compaiono come offline: non serve ricreare nulla.
4. **Prenotazione** (Indovina chi, Musica, Ruota): quando il riquadro dice
   **🎤 Giocatore Prenotato!**, ascolta la risposta a voce.
   - **✅ CORRETTO** assegna i punti mostrati in **Se corretto**.
   - **❌ SBAGLIATO** applica la penalità mostrata in **Se sbagliato**.
5. **Giochi senza validazione** (Quiz, Timeline, Bomba, Azzardo, Time Buzzer,
   Speed Rush, Air Hockey, Arena, Blackjack, Ultima spiaggia): il riquadro dice
   **Round in Corso** e i punti li calcola il server. Non premere nulla.
6. **Chiusura**: la TV mostra il reveal e poi la classifica se è il momento.
   Per il round dopo premi di nuovo **▶️ PARTI**.

La tabella **PUNTI** sotto il riquadro riporta *Corretto*, *Sbagliato* e
*Non risposta* del gioco in corso: è la stessa che vedono i telefoni nel manuale.

---

## 6. Le due decisioni (e come non sbagliarle)

- Il nome grande è la squadra prenotata: leggi quello, non il primo che ricordi.
- Le due anteprime dicono quanto vale la decisione **adesso**, non a fine round.
- Dopo il tocco la decisione è registrata e la prenotazione si chiude. **Non si
  annulla**: se sbagli, lascia il round com'è, spiega la correzione ad alta voce
  e continua. Ricreare la partita è peggio.
- Se il pulsante non fa nulla, la socket della regia è caduta: il pannello tenta
  di riconnettersi da solo. Aspetta la spia di connessione e riprova; la
  prenotazione resta valida.

---

## 7. Giochi simultanei: cosa guardare (e cosa non toccare)

| Gioco | Cosa fanno i telefoni | Cosa fa la regia |
| --- | --- | --- |
| **Quiz** | Ognuno tocca A/B/C/D. | Niente: punti dal server. |
| **Timeline** | Trascinano le carte; l'ordine parte da solo. | Niente. |
| **Time Buzzer** | **STOP** al momento giusto, manche dopo manche. | **🎵 PROSSIMA MANCHE** solo se vuoi anticipare. |
| **Bomba** | Un turno per squadra: scelgono una casella. | Niente: il turno lo gestisce il server. |
| **Speed Rush** | Minigiochi rapidi. | Niente. |
| **Air Hockey** | Duello a coppie, a turno. | Niente: le coppie le decide il server. |
| **Arena** | Vero/Falso continuo, difficoltà crescente. | Niente: il cerchio e le eliminazioni sono in TV. |
| **Azzardo** | Distribuiscono le fiches. | Niente: le fiches le valida il server. |
| **Ultima spiaggia** | Scelgono livello e risposta. | Niente. |
| **Blackjack** | Al proprio turno: **CARTA** o **STAI**. | Niente: il banco è in TV. |

In tutti questi casi il pannello dice **«Questa modalità non richiede
validazione admin»**: è la conferma che state facendo la cosa giusta, cioè
niente.

---

## 8. Classifiche e bonus

1. Dopo i round **4, 12, 20, 28, 36** la TV mostra la classifica **rapida**;
   dopo **8, 16, 24, 32, 40** quella **dettagliata**, con podio e festeggiamento.
   La classifica resta in TV finché non premi **▶️ PARTI**.
2. Dopo i primi quattro atti lancia il bonus con il suo pulsante:
   **🎰 CASINO**, **🏀 BASKET**, **🐎 CAVALLO**, **🎱 BIGLIE**.
3. Segui il bonus in TV e chiudilo con **✖️ CHIUDI BONUS**.
4. **I bonus hanno una classifica propria e non aggiungono punti alla classifica
   della serata.** Dillo tu: evita le proteste.

---

## 9. Imprevisti

| Cosa succede | Cosa fare |
| --- | --- |
| La TV si blocca o si ricarica | Si ricollega e riprende dal server. Se compare **Round ripristinabile**, premi **Riprendi**. |
| Un telefono è offline | Chiedi di riaprire il link: riprende la stessa squadra. Non ricreare la partita. |
| Due squadre si prenotano insieme | Ne passa una sola, la prima arrivata. Il nome è in **Giocatore Prenotato**. |
| Una squadra protesta per i punti | Apri la tabella **PUNTI** del round e leggi la regola: è la stessa del manuale. |
| Hai deciso **SBAGLIATO** per errore | Non si annulla. Spiega la correzione e vai avanti. |
| La regia si spegne | Riapri `/admin` su un altro dispositivo: serve un **nuovo codice** dalla TV. |
| Il backend si riavvia | Alla riaccensione la partita riparte dall'ultimo stato salvato. Aspetta la diagnostica, poi **▶️ PARTI** se serve. |
| Il pubblico rumoreggia | **⏸️ PAUSA / RIPRENDI**, sistema, poi riprendi: i timer ripartono da dove erano. |

**Non** ricaricare la TV per «sistemare» e **non** ricreare la partita: la
diagnostica dice sempre se il problema è il backend o un telefono.

---

## 10. Chiusura della serata

1. Ultimo round: **Arena**, poi classifica dettagliata finale.
2. Leggi il podio, ringrazia, annuncia il premio.
3. Non cancellare la partita subito: domande usate ed eventi servono per la
   prossima serata.
4. Per la serata successiva crea una nuova partita: la banca domande riparte.

---

## 11. Frasi pronte

- Apertura: «Benvenuti al PubGame. Da adesso la TV è il tabellone: il telefono è
  il vostro pulsante.»
- Regole: «Una risposta per round, il tempo lo decide il server, le domande non
  tornano.»
- Prenotazione: «Chi si prenota per primo ha la parola, ma sbagliare costa.»
- Classifica: «Il tabellone non sbaglia: i punti li ha calcolati il server.»
- Chiusura: «Grazie a tutti: ci vediamo alla prossima, con domande che non avete
  ancora sentito.»
