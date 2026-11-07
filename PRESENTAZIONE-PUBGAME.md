# PUBGAME — Il copione del presentatore

> **VERSIONE BETA — snapshot del 7 novembre 2026.**
> Il copione descrive la serata **così com'è adesso**, prima del refactoring della
> prossima versione. Se un gioco o un punteggio cambia, questo file va riallineato dopo.

Questo file è pensato per essere letto la sera stessa, anche con poca luce: contiene il
flusso della serata, le regole di ogni gioco, i punteggi e le frasi da dire. Non serve
conoscere il codice. Le parti in *corsivo* sono suggerimenti, non obblighi.

---

## 1. Prima di far entrare le squadre (10 minuti)

1. **Accendi il backend** (il programma che tiene la partita) e la **TV**.
2. Sulla TV compare la lobby con il numero della partita: **segnatelo**, è il numero che
   serve all'admin e ai telefoni.
3. Apri il **pannello admin** (telefono o tablet del presentatore) e inserisci quel numero
   nel campo **PARTITA #**.
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
- La scaletta mescola i giochi: ogni atto ha un ritmo suo e l'**Arena** chiude l'atto 2 e la serata.
- Alla fine di ogni atto c'è una **classifica** e, dopo i primi quattro atti, un **bonus**.
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
| **1** | 1–8 | Quiz · Musica · Black Jack · Indovina chi · Timeline · Time Buzzer · Ultima spiaggia · Bomba |
| **2** | 9–16 | Azzardo · Musica · Black Jack · Quiz · Ruota · Time Buzzer · Ultima spiaggia · **Arena** |
| **3** | 17–24 | Timeline · Musica · Speed Rush · Indovina chi · Quiz · Time Buzzer · Ultima spiaggia · Black Jack |
| **4** | 25–32 | Indovina chi · Bomba · Musica · Quiz · Ruota · Timeline · Ultima spiaggia · Speed Rush |
| **5** | 33–40 | Quiz · Musica · Bomba · Indovina chi · Azzardo · Timeline · Ultima spiaggia · **Arena** |

Classifiche:

- **rapida** dopo i round 4, 12, 20, 28, 36 (metà atto);
- **dettagliata** dopo i round 8, 16, 24, 32, 40 (fine atto, con podio e festeggiamento).

Bonus, uno dopo ciascuno dei primi quattro atti:

| Dopo l'atto | Bonus |
| --- | --- |
| 1 | 🎰 Casino (quattro manche, roulette vera) |
| 2 | 🏀 Basket (tre manche) |
| 3 | 🐎 Cavallo di Battaglia |
| 4 | 🎱 Biglie (quattro gare) |

Dopo il quinto atto non c'è bonus: si chiude con la classifica finale.

---

## 5. I giochi, uno per uno

Per ogni gioco: cosa vede il pubblico in TV, cosa fanno i telefoni, come si segna.

### QUIZ — la domanda classica

- **TV**: domanda e quattro risposte.
- **Telefoni**: ognuno tocca la risposta che ritiene giusta.
- **Punti**: risposta corretta **+1000 × tempo rimasto**; sbagliata **−1000 × tempo
  rimasto**; chi non risponde prende 0.
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
- **Punti**: quattro manche, valore decrescente **+2000 / +1500 / +1000 / +500**; sbagliato
  **−1000**; chi non risponde 0.
- *Da dire:* «La prima manche vale il doppio dell'ultima. Se conoscete la canzone, è il
  momento di rischiare.»

### TIMELINE — metti in ordine la storia

- **TV**: quattro o cinque eventi mescolati.
- **Telefoni**: si trascinano le carte nell'ordine cronologico e si invia.
- **Punti**: **1000 × coppie corrette**, **+200** se l'ordine è perfetto (massimo 1200).
  Una risposta conta come corretta solo se ha almeno una coppia giusta; sbagliare non
  toglie punti.
- *Da dire:* «Non serve essere perfetti: ogni coppia nell'ordine giusto vale mille. Ma il
  bonus da duecento lo prende solo chi azzecca tutto.»

### RUOTA DELLA FORTUNA — il proverbio a lettere

- **TV**: un proverbio italiano con le lettere che si aprono una alla volta; il round dura
  75 secondi.
- **Telefoni**: prenotazione e risposta a voce.
- **Punti**: **+1000 × tempo rimasto** se il proverbio è giusto, **−1000 × tempo rimasto**
  se sbagliato.
- *Da dire:* «Le lettere arrivano nell'ordine meno utile: le consonanti rare per prime.
  Chi lo sa già, rischi.»

### BOMBA — la catena che passa di mano

- **TV**: la miccia che scorre e la domanda del momento.
- **Telefoni**: la squadra di turno risponde; se non sa, **passa** la bomba a un'altra
  squadra.
- **Punti**: ogni squadra parte da **1000**; ogni passaggio riuscito vale **+50** (massimo
  +500); risposta sbagliata o tempo scaduto **−3 secondi di miccia**; lo scoppio costa
  **−300**. Il saldo entra in classifica.
- *Da dire:* «Passare la bomba fa guadagnare, tenerla troppo a lungo fa esplodere. Non è
  un gioco di conoscenza, è un gioco di nervi.»

### SPEED RUSH — la corsa a ostacoli di minigiochi

- **TV**: le corsie delle squadre che avanzano.
- **Telefoni**: minigiochi rapidi (tocca il diverso, ordina, calcola, memoria, colori…).
- **Punti**: per piazzamento **+1000 / +900 / +800 …**; ogni errore fa arretrare la corsia;
  le risposte giuste di fila accendono i boost **×2 (2 di fila), ×3 (5), ×4 (10)**.
- *Da dire:* «Non conta sapere, conta non sbagliare: la combo moltiplica tutto.»

### AIR HOCKEY BATTLE — uno contro uno

- **TV**: il tavolo, i portieri laser e il disco.
- **Telefoni**: due squadre si sfidano a domande rapide; ogni risposta sbagliata o lenta
  allunga il tempo dell'avversario e rende il tiro più difficile.
- **Punti**: il set si chiude a **7 gol**; il vincitore prende **+1000**, il perdente
  **+200** di consolazione.
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

## 6. I bonus di fine atto

Non consumano un round della scaletta: si lanciano dal pannello admin e servono a tenere
alta l'attenzione dopo la classifica.

### 🎰 Casino — quattro manche, una roulette vera

- Quattro manche a difficoltà crescente: **colore** (2 caselle, 100 punti), **dozzina**
  (3 caselle, 150), **sestina** (6 caselle, 200), **numero secco** (37 caselle, 300).
- Ogni manche si chiude con un giro della roulette europea in TV: la pallina parte,
  rallenta e si ferma sul numero. Sullo zero incassa il banco.
- Sul numero secco la ruota rigira finché almeno un tavolo ha puntato il numero uscito.
- **Punti**: +100 / +150 / +200 / +300 a chi indovina la manche. Sbagliare non toglie nulla.
- *Da dire:* «Qui non serve sapere niente: serve fegato. Più stretta la casella, più alta la posta.»

### 🏀 Basket — tre manche al canestro

- Pagina `/basket` sul telefono: si trascina indietro la palla e si rilascia per tirare.
- **Tre manche da 20 secondi**: canestro grande (+2), medio (+3), piccolo (+5). Il ferro
  si stringe a ogni manche; chi fa swish senza toccare il ferro prende un punto in più.
- I punti delle tre manche si sommano e entrano in classifica.
- *Da dire:* «Il canestro grande è facile ma paga poco: il vero malloppo è nel piccolo.»

### 🐎 Cavallo di Battaglia — otto domande, il tabellone in TV

- La squadra sceglie una categoria dal telefono; arrivano **otto domande difficili** di
  quella categoria, una dietro l'altra, con **15 secondi** per rispondere.
- Domanda e opzioni stanno **solo sul telefono**. La TV mostra il countdown e il
  **tabellone del bonus**, sempre in scena: a ogni reveal si riordina e segna i punti.
- **Punti**: +100 per risposta esatta, +50 alla prima esatta della manche.
- *Da dire:* «La TV non vi aiuta: la domanda è sul telefono. Guardate il tabellone e
  correte.»

### 🎱 Biglie — quattro gare, una biglia per tavolo

- Ogni tavolo sceglie **una biglia** dal telefono, in ordine sorteggiato: la scelta si fa
  una volta sola e vale per tutte e quattro le gare.
- I fondi cambiano: **terra, asfalto, neve, acqua**. Ogni biglia ha velocità, accelerazione
  e tenuta diverse, e ogni fondo premia una qualità.
- La TV segue la corsa con una camera laterale su un unico tracciato di curve e dossi:
  salti, attrito e scie diverse per ogni terreno. Ogni gara dura circa 30 secondi e il
  vincitore non è deciso prima.
- **Punti**: 150 / 100 / 60 / 30 a ogni gara, cumulativi (massimo 600).
- *Da dire:* «Non esiste la biglia perfetta: scegliete quella giusta per i quattro fondi.»

---

## 7. Le classifiche

- **Rapida** (metà atto): posizioni e punti, veloce da leggere ad alta voce.
- **Dettagliata** (fine atto): podio con rullo e festeggiamento per il terzo, il secondo e
  il primo posto, poi la classifica completa.
- La classifica **resta in TV** finché non premi **PROSSIMO ROUND**: nessuna chiusura
  automatica, così avete tutto il tempo per commentare.

> *Da dire al podio:* «Terzo posto… secondo… e primi, stasera, sono…» (lasciate un secondo
> di silenzio prima del nome: il rullo è già partito.)

---

## 8. Comandi del pannello admin

| Pulsante | Quando usarlo |
| --- | --- |
| ▶️ **PROSSIMO ROUND** | per passare al gioco successivo (annulla anche l'avanzamento automatico) |
| 🏆 **MOSTRA CLASSIFICA** | per anticipare la classifica senza aspettare la fine dell'atto |
| ⏸️ **PAUSA / RIPRENDI** | per fermare tutto: in pausa la TV copre il gioco e i timer si fermano |
| 🎥 **DEMO GIOCO** | per spiegare un gioco prima di giocarlo (demo animata, senza mp4) |
| ✖️ **CHIUDI DEMO** | per tornare alla partita |
| 🎰 🏀 🐎 🎱 **BONUS** | per lanciare il bonus di fine atto |
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
premete **PROSSIMO ROUND**.

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
