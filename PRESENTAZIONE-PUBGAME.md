# PUBGAME — Il copione del presentatore

> **VERSIONE 2.1.0 — 13 novembre 2026.**
> Il copione descrive la serata alla seconda major. Per i pulsanti del pannello admin
> vedi `docs/PANNELLO-ADMIN.md`; per il telefono delle squadre vedi `docs/MANUALE-TELEFONO.md`.
> Se un gioco o un punteggio cambia, questo file va riallineato.

Questo file è pensato per essere letto la sera stessa, anche con poca luce: contiene il
flusso della serata, le regole di ogni gioco, i punteggi e le frasi da dire. Non serve
conoscere il codice. Le parti in *corsivo* sono suggerimenti, non obblighi.

---

## 1. Prima di far entrare le squadre (10 minuti)

1. **Accendi il backend** (il programma che tiene la partita) e la **TV**.
2. Sulla TV compare la lobby con il numero della partita: **segnatelo**, è il numero che
   serve all'admin e ai telefoni.
3. Apri il **pannello admin** (telefono o tablet del presentatore) e inserisci quel numero
   nel campo **PARTITA #**. Al primo accesso compare **🔒 REGIA NON ABBINATA**: scrivi le
   6 cifre del riquadro **CODICE REGIA** nella lobby (durata 5 minuti, una volta sola)
   e premi **ABBINA REGIA**.
4. Controlla il riquadro **📡 CONNESSIONI & SALVATAGGIO**:
   - **Dispositivi online** deve salire man mano che le squadre entrano;
   - **Round aperto** deve essere *no* prima si iniziare;
   - **Domande usate** parte da zero a ogni nuova partita.
5. Nel riquadro **🗂️ CATEGORIE & TIMELINE** verifica che siano accese le categorie che
   vuoi giocare e che il flag **Timeline** sia attivo solo su quelle con eventi
   ordinabili nel tempo (Storia, Sport, Cinema, Musica…).
6. Fai un giro di prova: una squadra si collega, invia una risposta, la TV la mostra.
   Se funziona, siete pronti.
7. Ogni squadra può scattare o caricare una foto dal telefono: l'avatar compare in
   classifica per tutta la serata.

> *Frase di apertura:* «Benvenuti al PubGame. Da adesso stasera la TV non è più una TV:
> è il tabellone. Ogni squadra ha un telefono: quello è il vostro pulsante.»

---

## 2. Come funziona la serata (in trenta secondi)

- La partita dura **40 round**, divisi in **5 atti da 8 round**.
- Ogni round è **un gioco diverso**: quiz, musica, immagini, timeline, bomba, arena…
- Le squadre rispondono **dal telefono**; la TV mostra domanda, tempo e classifica.
- La scaletta mescola i giochi: ogni atto ha un ritmo suo e l'**Arena** chiude l'atto 3 e la serata.
- Dentro ogni atto c'è un **bonus diverso**, in un round scelto all'inizio della serata; la **classifica** dettagliata chiude l'atto.
- L'ultimo round del quinto atto è l'**Arena**: tutti insieme, e chi resta in piedi vince.

I punti non sono tutti uguali: più si risponde presto, più si guadagna. Sbagliare costa
in proporzione al tempo rimasto. La classifica è sempre in TV: nessuno deve fidarsi della
propria memoria.

---

## 3. Le tre regole che valgono per tutta la serata

1. **Una risposta per round.** Il server accetta la prima risposta valida: se il telefono
   ritenta perché il Wi-Fi è caduto, non prende doppio punteggio. Se una squadra si
   disconnette, si ricollega da sola e ritrova la domanda e il tempo rimasto.
2. **Il tempo lo decide il server.** Il cronometro in TV e quello del telefono sono la
   stessa cosa: nessuno guadagna secondi spegnendo lo schermo o cambiando app.
3. **Niente domande ripetute.** Le domande già uscite restano fuori per tutta la serata,
   anche se il programma viene riavviato. Se una categoria finisce le domande, il sistema
   lo dice: cambiate categoria o passate al gioco successivo.

> *Se qualcuno protesta:* «Il tabellone non sbaglia: la risposta è quella scritta in TV,
> i punti li ha calcolati il server.»

---

## 4. La scaletta completa

| Atto | Round | Giochi in ordine |
| --- | --- | --- |
| **1** | 1–8 | Quiz · Musica · Quiz · Time Buzzer · Azzardo · Timeline · Speed Rush · Ultima spiaggia |
| **2** | 9–16 | Azzardo · Ruota · **Biglie** · Quiz · Tennis Battle · Time Buzzer · Musica · Ultima spiaggia |
| **3** | 17–24 | Quiz · Speed Rush · Indovina chi · Tennis Battle · Time Buzzer · **Biglie** · Ultima spiaggia · **Arena** |
| **4** | 25–32 | Indovina chi · Bomba · Musica · **Biglie** · Ruota · Timeline · Speed Rush · Ultima spiaggia |
| **5** | 33–40 | Quiz · Musica · Bomba · Indovina chi · **Biglie** · Timeline · Ultima spiaggia · **Arena** |

Classifiche:

- **rapida** dopo i round 4, 12, 20, 28, 36 (metà atto);
- **dettagliata** dopo i round 8, 16, 24, 32, 40 (fine atto, con podio e festeggiamento).

Bonus, uno dentro ognuno dei cinque atti:

| Atto | Bonus | Punti |
| --- | --- | --- |
| 1 | 🎰 Casino nero/rosso | +100 a girata, tre girate (max +300) |
| 2 | 🃏 Blackjack | buono 3 consumazioni, max 3 a serata |
| 3 | 🎰 Casino dozzina | +200 a girata, tre girate (max +600) |
| 4 | 🐎 Cavallo di Battaglia | buono 1 consumazione di cibo |
| 5 | 🎯 Casino numero secco | +500 |

Chiuso il riepilogo di un bonus, la scaletta riparte dal round successivo; dopo il round 40 si chiude con la classifica finale aggiornata.

---

## 5. I giochi, uno per uno

Per ogni gioco: cosa vede il pubblico in TV, cosa fanno i telefoni, come si segna.

### QUIZ — la domanda classica

- **TV**: domanda e quattro risposte.
- **Telefoni**: ognuno tocca la risposta che ritiene giusta.
- **Punti**: fino a **+1000** in tre manches (facile ×1, media ×2, difficile ×3);
  sbagliata **−quota della domanda** in base al tempo; chi non risponde prende 0.
- *Da dire:* «Chi risponde subito vince tanto, chi risponde tardi vince poco, chi sbaglia
  paga. Nessuno è obbligato a rispondere.»

### INDOVINA CHI (IMAGE_BLUR) — il volto che si svela

- **TV**: una foto sfocata che si schiarisce lentamente.
- **Telefoni**: si preme per prenotarsi e si dice il nome ad alta voce.
- **Punti**: **+1000 × tempo rimasto** se il nome è giusto; **−1000 × tempo rimasto** se è
  sbagliato; chi non si prenota prende 0.
- *Da dire:* «Prima lo riconoscete, più vale. Ma prenotarsi e sbagliare costa caro.»

### MUSICA — l'intro da riconoscere

- **TV**: parte il brano, senza titolo né artista.
- **Telefoni**: prenotazione e risposta a voce.
- **Punti**: **+1000** alla prima manche, poi **+750**, **+500**, **+250**; sbagliata lo
  stesso valore in negativo, chi non risponde 0.
- *Da dire:* «La prima manche vale il doppio dell'ultima. Se conoscete la canzone, è il
  momento di rischiare.»

### TIMELINE — metti in ordine la storia

- **TV**: **otto eventi** mescolati a ogni round.
- **Telefoni**: si trascinano le carte nell'ordine cronologico e si invia.
- **Punti**: 8 posti giusti **+400**, 7 **+300**, 6 **+200**, 5 **+100**, 4 **0**, 3 **−50**,
  2 **−100**, 1 o 0 **−200**; chi non risponde prende 0.
- *Da dire:* «Otto eventi, un solo ordine giusto: ogni posto esatto conta.»

### RUOTA DELLA FORTUNA — il proverbio a lettere

- **TV**: un proverbio italiano con le lettere che si aprono una alla volta; il round dura
  75 secondi.
- **Telefoni**: prenotazione e risposta a voce.
- **Punti**: **+1000 × tempo rimasto** se il proverbio è giusto, **−1000 × tempo rimasto**
  se sbagliato.
- *Da dire:* «Le lettere arrivano nell'ordine meno utile: le consonanti rare per prime.
  Chi lo sa già, rischi.»

### BOMBA — restare in vita

- **TV**: il tabellone coperto e il turno che passa da una squadra all'altra.
- **Telefoni**: la squadra di turno sceglie una casella: è un'affermazione vera o falsa.
- **Punti**: casella vera **0**, si resta in vita; casella falsa **fuori dal round** con un
  malus che parte da **−500** e scende con le bombe rimaste (−500, −400, −300, −200, −100).
  Chi non sceglie in tempo è fuori come se avesse preso una bomba.
- *Da dire:* «Qui non si guadagna: si resta vivi. La prima bomba è quella che costa di più.»

### SPEED RUSH — la corsa a ostacoli di minigiochi

- **TV**: le corsie delle squadre che avanzano.
- **Telefoni**: minigiochi rapidi (tocca il diverso, ordina, calcola, memoria, colori…).
- **Punti**: **+800** al primo, **−400** all'ultimo, zero a metà se N è dispari; chi non
  arriva è ultimo a pari merito. Il punteggio lo calcola il server.
- *Da dire:* «Non conta sapere, conta non sbagliare: la corsia non aspetta nessuno.»

### TENNIS BATTLE — a coppie

- **TV**: il tavolo, i portieri laser e il disco.
- **Telefoni**: due squadre si sfidano a domande rapide; ogni risposta sbagliata o lenta
  allunga il tempo dell'avversario e rende il tiro più difficile.
- **Punti**: chi vince la partita prende **+500**, chi perde **0**.
- *Da dire:* «Rispondere velocemente non vi fa solo vincere il punto: toglie tempo e
  precisione a chi vi sta davanti.»

### ARENA — tutti contro tutti (l'ultimo round dell'atto)

- **TV**: il cerchio che si stringe, le squadre intorno, il tempo del round (130 secondi).
- **Telefoni**: Vero o Falso, una domanda dopo l'altra, il più velocemente possibile.
- **Difficoltà progressiva** (decisa dal server in base al tempo trascorso):
  - **primo quarto** del round: domande **facili**;
  - **metà centrale**: domande **medie**;
  - **ultimo quarto**: domande **difficili**.
- **Punti**: **+10** per risposta corretta, **−10** per risposta sbagliata; al piazzamento
  finale **+1000** al primo, **+500** al secondo, **−300** per chi resta nella metà bassa.
- *Da dire:* «Si parte facile, si finisce difficile: chi resta lucido negli ultimi trenta
  secondi si porta a casa l'atto.»

---

## 6. I bonus dentro gli atti

Non consumano un round: la TV li apre da sola in **un round interno dell'atto**, scelto all'inizio della serata tra il secondo, il terzo, il quinto, il sesto e il settimo (mai l'apertura, mai il quarto con la classifica rapida, mai l'ultimo); la regia può lanciarli anche a mano. I punti entrano in classifica **una sola volta, alla chiusura del bonus**; nessun bonus toglie punti.

### 🎰 Casino nero/rosso — nell'atto 1
- **Tre girate**: ogni tavolo sceglie **nero o rosso** entro dieci secondi.
- Ogni colore giusto vale **+100** (massimo +300); lo zero incassa per il banco.
- *Da dire:* «Tre giri, un colore: qui conta il fegato.»

### 🃏 Blackjack — nell'atto 2
- Un turno per tavolo, dal fondo della classifica: **15 secondi**, CARTA o STAI.
- Il banco si ferma a **17**. Chi lo batte riceve un **buono per 3 consumazioni al tavolo**, non punti; massimo tre buoni a serata.
- *Da dire:* «Il banco non aspetta: fermatevi prima di sballare.»

### 🎰 Casino dozzina — nell'atto 3
- **Tre girate** su **1–12, 13–24 o 25–36**, scelta in dieci secondi.
- Ogni dozzina giusta vale **+200** (massimo +600); lo zero non paga nessuno.
- *Da dire:* «Dodici numeri per volta: scegliete la fetta giusta.»

### 🐎 Cavallo di Battaglia — nell'atto 4
- La categoria la votano i telefoni; poi **otto domande difficili**, una dietro l'altra.
- Vince chi ha più risposte giuste, a pari merito chi ha finito prima: premio un **buono per una consumazione di cibo**.
- *Da dire:* «La domanda è sul telefono: guardate il tabellone e correte.»

### 🎯 Casino numero secco — nell'atto 5
- **Una sola girata** su un numero da **0 a 36**, scelta in dieci secondi.
- Numero esatto **+500**; se nessuno lo becca, nessuno prende punti. Poi la TV mostra la **classifica finale aggiornata**.
- *Da dire:* «Un numero, tutto: l'ultima carta della serata.»

---

## 7. Le classifiche

- **Rapida** (metà atto): posizioni e punti, veloce da leggere ad alta voce.
- **Dettagliata** (fine atto): podio con rullo e festeggiamento per il terzo, il secondo e
  il primo posto, poi la classifica completa.
- La classifica **resta in TV** finché non premi **PARTI**: nessuna chiusura
  automatica, così avete tutto il tempo per commentare.
- **I punti dei bonus entrano in classifica alla chiusura del bonus**: dopo il round 40 la TV mostra la classifica finale aggiornata.

> *Da dire al podio:* «Terzo posto… secondo… e primi, stasera, sono…» (lasciate un secondo
> di silenzio prima del nome: il rullo è già partito.)

---

## 8. Comandi del pannello admin

| Pulsante | Quando usarlo |
| --- | --- |
| ▶️ **PARTI** | per avviare il round successivo (disattivato finché la prova dei pulsanti non è pronta) |
| 🏆 **MOSTRA CLASSIFICA** | per anticipare la classifica senza aspettare la fine dell'atto |
| 🎵 **PROSSIMA MANCHE** | per passare alla manche successiva di un gioco a manche |
| ⏸️ **PAUSA / RIPRENDI** | per fermare tutto: in pausa la TV copre il gioco e i timer si fermano |
| 🎬 **DEMO** | per spiegare un gioco o un bonus prima di giocarlo, senza cambiare la partita |
| ✖️ **CHIUDI DEMO** | per tornare alla partita |
| 🎰 🃏 🐎 🎯 **BONUS** (CASINO, BLACKJACK, CAVALLO, NUMERO SECCO) | per lanciare il bonus dell’atto |
| ✖️ **CHIUDI BONUS** | per uscire da un bonus |
| **PARTITA #** | per puntare la TV giusta se l'admin è su un altro dispositivo |

Nel riquadro **CONNESSIONI & SALVATAGGIO** trovi, per ogni dispositivo: ruolo, nome,
stato online/offline, numero di riconnessioni, versione dello stato e ultimo evento
salvato. Serve a rispondere alla domanda di ogni presentatore: «quella squadra è
davvero collegata o ha il telefono in tasca spento?».

---

## 9. Imprevisti: cosa fare (e cosa non fare)

| Cosa succede | Cosa fare |
| --- | --- |
| Un telefono perde il Wi-Fi per pochi secondi | niente: si riconnette da solo, riprende la domanda e il tempo residuo |
| Una squadra chiude la pagina o riavvia il telefono | riapre il link: la sessione è la stessa, non deve reinserire il codice |
| La TV si disconnette | si ricollega da sola e richiede lo stato al server: la partita non si ferma |
| Il backend si riavvia (o salta la corrente) | alla riaccensione la partita riprende dall'ultimo stato salvato: squadre, risposte, punteggi, round e domande usate restano |
| Una risposta arriva due volte | il server riconosce il doppio invio e non assegna punti due volte |
| Una risposta arriva dopo la fine del round | viene rifiutata: il round non si riapre |
| Il pannello admin non risponde | guardate **Dispositivi online**: se è a zero è il backend, non le squadre |

**Non** ricaricare la pagina della TV per «sistemare»: la TV recupera da sola. **Non**
ricreare la partita se qualcosa sembra bloccato: prima controllate la diagnostica e
premete **PARTI**.

---

## 10. Chiusura della serata

1. Ultimo round: **Arena**, con la classifica dettagliata finale.
2. Leggete il podio, ringraziate le squadre, annunciate il premio.
3. Non cancellate la partita subito: lo storico delle domande usate e degli eventi serve
   per capire cosa è piaciuto e cosa no.
4. Per la serata successiva basta creare una nuova partita: la banca domande riparte da
   capo, con le domande già usate che tornano disponibili solo secondo la politica di
   storico configurata.

> *Frase finale:* «Grazie a tutti: stasera il tabellone ha parlato da solo. Ci vediamo
> alla prossima, con domande che non avete ancora sentito.»
