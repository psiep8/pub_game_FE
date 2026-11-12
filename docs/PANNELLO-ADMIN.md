# PubGame — Guida al pannello admin

> Per chi tiene il pannello durante la serata (telefono o tablet del presentatore).
> Descrive i pulsanti così come appaiono oggi nell'interfaccia. Se un'etichetta cambia,
> questo file va riallineato.

Il pannello admin apre da `/admin`. Serve a dire alla TV **cosa succede adesso**:
far partire il round, decidere se una risposta è giusta, lanciare un bonus, mostrare
una classifica. Non fa vedere le risposte alle squadre: la soluzione compare solo sul
pannello admin e in TV, nei momenti previsti dal gioco.

---

## 1. Prima di iniziare

1. Inserisci il numero della partita nel campo **PARTITA #** (il numero che la TV mostra
   nella lobby). Senza questo numero il pannello non sa a quale TV parlare.
2. Controlla il riquadro **📡 CONNESSIONI & SALVATAGGIO**:
   - **Stato partita** e **Round** dicono in che punto siamo.
   - **Round aperto** deve essere *no* prima di iniziare un round.
   - **Dispositivi online** deve salire man mano che entrano le squadre. Se è a zero,
     il problema è il backend, non le squadre.
3. Nel riquadro **🗂️ CATEGORIE & TIMELINE** accendi le categorie che vuoi giocare.
   Il flag **🕒 Timeline** vale solo per le categorie con eventi ordinabili nel tempo.
   Una categoria **🚫 Spenta** resta nello storico ma non compare in TV.

---

## 2. I riquadri del pannello

| Riquadro | A cosa serve |
| --- | --- |
| **✅ SOLUZIONE** (in alto, quando c'è) | La risposta corretta del round in corso. Non mostrarla alle squadre. |
| **📡 CONNESSIONI & SALVATAGGIO** | Stato della partita, round aperto, domande usate, dispositivi online e riconnessioni. |
| **🧪 PROVA DEI PULSANTI** | Test dei telefoni prima della serata: vedi sezione 5. |
| **🗂️ CATEGORIE & TIMELINE** | Aggiungere una categoria, accenderla o spegnerla, attivare Timeline. |
| **🎬 DEMO** | Aprire in TV la spiegazione di un gioco o di un bonus, senza cambiare la partita. |
| **🎬 CONTROLLO FLUSSO** | I pulsanti che fanno avanzare la serata: sezione 3. |
| **Riquadro centrale** | Cambia in base al round: prenotazioni, decisioni, punti. Sezione 4. |

---

## 3. Controllo flusso: i pulsanti

| Pulsante | Cosa fa | Quando usarlo |
| --- | --- | --- |
| **▶️ PARTI** | Avvia il prossimo round. | Per ogni round. È disattivato finché la prova dei pulsanti non è pronta, a meno di usare *AVVIA COMUNQUE*. |
| **🎵 PROSSIMA MANCHE** | Passa alla manche successiva di un gioco a manche (es. Time Buzzer). | Solo dentro un gioco che ha più manche. |
| **🏆 MOSTRA CLASSIFICA** | Mostra in TV la classifica rapida. | Per anticipare la classifica senza aspettare la fine dell'atto. |
| **⏸️ PAUSA / RIPRENDI** | Ferma il gioco: la TV copre tutto e i timer si fermano. | Per un imprevisto. Riprendi quando è tutto pronto. |
| **↺ RIVEDI INTRO** | Riporta in TV la presentazione iniziale. | Per ripetere le regole all'inizio della serata. |
| **🎄 NATALE ON / OFF** | Attiva o spegne il tema natalizio. | Solo per scelta estetica. Non cambia i punti. |
| **🎰 BONUS CASINO** · **🏀 BONUS BASKET** · **🐎 BONUS CAVALLO** · **🎱 BONUS BIGLIE** | Avvia il bonus di fine atto. | Alla fine di un atto, dopo la classifica. |
| **✖️ CHIUDI BONUS** | Chiude il bonus in corso. | Per uscire da un bonus. |

> Avanzamento manuale: usa **PARTI** oppure il tasto **AVANTI** in TV. Entrambi fanno
> partire il round successivo.

---

## 4. Il riquadro centrale: prenotazioni e decisioni

Nei giochi a risposta libera (quiz, indovina, ruota, timeline…) il pannello segue questo
schema.

### Round in corso, nessuno si è prenotato
- Il riquadro dice **In Attesa di Prenotazioni**. Le squadre possono prenotarsi dal
  telefono.
- Se la soluzione è disponibile, compare in un riquadro **SOLUZIONE** per l'admin.

### Una squadra si è prenotata
- Compare **🎤 Giocatore Prenotato!** con il nome della squadra. Il telefono dell'admin
  vibra.
- Ascoltate la risposta. Il pannello mostra due anteprime dei punti:
  - **✅ Se corretto**: i punti che la squadra guadagna.
  - **❌ Se sbagliato**: i punti che la squadra perde (o guadagna, se la regola è diversa).
- Decidete con i due pulsanti grandi:
  - **✅ CORRETTO** (+punti)
  - **❌ SBAGLIATO** (-punti)

### Giochi senza validazione admin
- Nei giochi che si decidono da soli (per esempio Speed Rush, Air Hockey, Bomba,
  Azzardo) il pannello dice **Round in Corso** e **Questa modalità non richiede
  validazione admin**. Non serve premere nulla: il punteggio lo calcola il server.

### La tabella PUNTI
Sotto il riquadro compare **PUNTI — tipo del round** con le tre regole: *Corretto*,
*Sbagliato*, *Non risposta*. È la stessa tabella che vede la TV. Controllatela se una
squadra protesta.

---

## 5. Prova dei pulsanti (prima della serata)

1. Premi **▶️ AVVIA / RIFAI PROVA**.
2. Ogni telefono deve: toccare, scegliere, trascinare, sentire la vibrazione e rispondere
   alla TV.
3. Il pannello mostra una riga per squadra con i puntini che si accendono, il tempo di
   risposta in ms e le segnalazioni:
   - **VIBRAZIONE NO**: il telefono non vibra (controlla il vibrare in silenzioso).
   - **DA CONTROLLARE**: la prova ha un'anomalia da guardare.
4. Se una squadra non ha finito, premi **Rifai** accanto al suo nome.
5. Quando la riga finale dice **TUTTI PRONTI**, premi **▶️ PARTI**.
6. **⏭️ SALTA PROVA** chiude il controllo senza verificare i telefoni.
   **⚠️ AVVIA COMUNQUE** fa partire il round anche se la prova non è finita: usatelo
   solo se sapete già cosa non funziona.

---

## 6. Errori comuni

| Cosa vedi | Cosa fare |
| --- | --- |
| *Diagnostica non disponibile: backend non raggiungibile* | Il backend non risponde. Controlla che sia acceso e raggiungibile, poi riprova. Non ricreare la partita. |
| **PARTI** è grigio | La prova dei pulsanti non è completa. Completala o usa **AVVIA COMUNQUE**. |
| **Round aperto: sì** ma la TV è ferma | Premi **PAUSA / RIPRENDI** per sbloccare, poi di nuovo per riprendere. Se resta fermo, controlla i dispositivi online. |
| Una squadra non compare | Controlla **Dispositivi online** e fatele riaprire il link. Non serve reinserire il codice. |
| Hai premuto SBAGLIATO per errore | Il punteggio è già contato: per correggere, lascia il round come è e spiega la correzione alla squadra. Non ricreare la partita. |
| Due squadre si sono prenotate insieme | Il server accetta una sola prenotazione per round: quella arrivata per prima. Verifica il nome in **Giocatore Prenotato**. |

> **Non** ricaricare la pagina admin per «sistemare»: il pannello si riallinea da solo al
> server.

---

## 7. Fine atto e bonus

1. Dopo l'ultimo round dell'atto la TV mostra la classifica rapida (o dettagliata a fine atto).
2. Premi **🏆 MOSTRA CLASSIFICA** solo se vuoi anticiparla.
3. Lancia il bonus dell'atto con il suo pulsante (**BONUS CASINO**, **BASKET**, **CAVALLO**
   o **BIGLIE**).
4. A bonus concluso premi **✖️ CHIUDI BONUS**, poi **▶️ PARTI** per il round successivo.

---

## 8. Cosa non fare

- Non chiudere la partita a metà per «ripartire»: si perde il punto in cui siete.
- Non premere due volte **PARTI** nello stesso istante: il secondo tocco non serve.
- Non mostrare la soluzione dal telefono dell'admin alle squadre durante il round.
