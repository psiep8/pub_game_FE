# PubGame — descrizione del gioco

> **VERSIONE 2.3 — 19 novembre 2026.**
> Se una regola non combacia col codice, vince il codice. Per la serata fanno fede
> `README.md` e `docs/manuale-serata.html/PDF`.

PubGame è un **gioco a squadre da pub**: una TV condivisa, un telefono per tavolo e un
presentatore che conduce da `/admin`. Nessuna app da installare: i telefoni aprono il
browser dal QR in TV.

---

## 1. La serata in breve

- **40 round**, divisi in **5 atti da 8**.
- **13 giochi di round**, con le **Biglie** presenti quattro volte, una per atto dal
  secondo al quinto (round 11, 22, 28, 37).
- **5 bonus**, uno dentro ogni atto (in un round interno scelto dal seme).
- Classifica **rapida** dopo i round 4, 12, 20, 28 e 36; **dettagliata** dopo 8, 16, 24,
  32 e 40.
- Dopo l'ultimo bonus dell'atto 5 la TV mostra la **classifica finale aggiornata**.

| Schermata | Dispositivo | A cosa serve |
| --- | --- | --- |
| `/tv` | TV o computer collegato | Domande, giochi, classifiche, bonus |
| `/play` | smartphone di ogni squadra | Risposte, prenotazioni, scelte |
| `/admin` | smartphone del presentatore | Avvio round, pause, classifiche, bonus |

---

## 2. Scaletta attuale

| Atto | Round | Giochi in ordine |
| --- | --- | --- |
| **1** | 1–8 | Quiz · Musica · Quiz · Time Buzzer · Azzardo · Timeline · Speed Rush · Ultima spiaggia |
| **2** | 9–16 | Azzardo · Ruota · **Biglie** · Quiz · Tennis Battle · Time Buzzer · Musica · Ultima spiaggia |
| **3** | 17–24 | Quiz · Speed Rush · Indovina chi · Tennis Battle · Time Buzzer · **Biglie** · Ultima spiaggia · **Arena** |
| **4** | 25–32 | Indovina chi · Bomba · Musica · **Biglie** · Ruota · Timeline · Speed Rush · Ultima spiaggia |
| **5** | 33–40 | Quiz · Musica · Bomba · Indovina chi · **Biglie** · Timeline · Ultima spiaggia · **Arena** |

Conteggi: **5 Quiz, 4 Musica, 4 Biglie, 3 Speed Rush, 3 Time Buzzer, 3 Indovina chi,
3 Timeline, 2 Azzardo, 2 Arena, 2 Bomba, 2 Tennis, 2 Ruota, 5 Ultima spiaggia.**
Blackjack non è più un round. Arena chiude gli atti 3 e 5; Ultima spiaggia è ai round
8, 16, 23, 32 e 39.

---

## 3. Giochi di round

- **Quiz** — tre manche a scelta multipla; il tempo rimasto decide il valore.
- **Musica** — quattro ascolti; prenotazione e risposta a voce.
- **Indovina chi** — foto sfocata che si schiarisce; prenotazione e risposta a voce.
- **Ruota della fortuna** — proverbio con lettere coperte; prenotazione.
- **Timeline** — carte da ordinare; il server conserva la soluzione.
- **Time Buzzer** — fermare il cronometro senza vederlo; tre manche.
- **Bomba** — tabellone a turni con caselle vere e bombe; due apparizioni.
- **Speed Rush** — 90 secondi di microprove, corsia e classifica per arrivo.
- **Tennis Battle** — duello a coppie con punteggio 15/30/40/vantaggio e killer point.
- **Azzardo** — quattro manche numeriche con fiches e quote.
- **Ultima spiaggia** — cinque livelli 100–500, consumabili una volta per squadra.
- **Arena** — Vero/Falso continuo dentro un cerchio che si stringe.
- **Biglie** — quattro round da **due gare** (otto gare in serata) su due delle otto piste:
  rally (terra), F1 (asfalto), neve, acqua, **vetro**, sabbia, spazio e magma. La coppia di
  piste la sceglie il seme del round; una biglia per tavolo, scelta una volta sola. Ogni
  gara paga **150/100/60/30** ai primi quattro e **−30/−60/−100/−150** agli ultimi
  quattro; i punti entrano subito in classifica.

I punteggi vivono in `shared/models/scoring-rules.ts`; la scaletta in
`shared/schedule.ts` è l'unica fonte di verità per round e occorrenze.

---

## 4. I cinque bonus

I bonus non consumano round. Partono da soli in **un round interno dell'atto** (mai il
primo, mai l'ultimo: slot 2, 3, 5, 6 o 7), scelto dal seme all'inizio della serata;
chiuso il riepilogo la scaletta riprende dal round successivo. I punti vengono
accreditati **una sola volta, alla chiusura**.

| Atto | Bonus | Come funziona | Punti |
| --- | --- | --- | --- |
| 1 | **Casino bianco/rosso** | Una manche sul colore, un giro di roulette | +100 |
| 2 | **Blackjack** | Un turno per tavolo, 15 s, banco a 17 | +150 vittoria / +75 pari |
| 3 | **Casino dozzina** | Una manche su 1–12, 13–24 o 25–36 | +120 |
| 4 | **Cavallo di battaglia** | Categoria votata, otto domande flash | podio +200 / +100 / +50 |
| 5 | **Casino numero secco** | Una puntata su un numero da 0 a 36 | +300 |

Ogni bonus ha un ingresso TV scenografico distinto. Dopo quello dell'atto 5 si chiude con
la classifica finale.

---

## 5. Regole trasversali

1. **Una risposta per round.** Il server accetta la prima risposta valida.
2. **Il tempo è condiviso.** TV, telefono e server usano la stessa finestra di round.
3. **Le domande uscite non tornano** nella stessa serata.
4. **La classifica è in TV.** I telefoni non sono il tabellone.
5. **Pausa e ripresa** fermano timer e input; la TV può riprendere la partita dalla
   sessione salvata.

---

## 6. Pannello admin

- **PROSSIMO ROUND**, **MOSTRA CLASSIFICA**, **PAUSA / RIPRENDI**.
- **DEMO** per spiegare un gioco, **CHIUDI DEMO** per tornare alla partita.
- Bonus dell'atto: **Casino**, **Blackjack**, **Cavallo**, **Casino dozzina**,
  **Casino numero secco**; partono da soli nel round dello slot, **CHIUDI BONUS** per
  uscire prima.
- **PARTITA #** per comandare la TV da un altro dispositivo.
- Fra un round e l'altro si avanza con **▶️ PARTI** (o **AVANTI** in TV). Chiuso il
  bonus, invece, la TV mostra il riepilogo per **8 secondi** e poi dieci di conto alla
  rovescia: in tutto 18 secondi prima di ripartire da sola dal round successivo. Pausa,
  classifica, demo o comando manuale annullano il conto alla rovescia.

---

## 7. Stato, limiti e prossimi passi

- Il flusso con più telefoni reali non è ancora stato provato dal vivo.
- La resa visiva e sonora dei nuovi ingressi bonus va verificata su TV e telefoni.
- La ripresa completa dei bonus non è ancora salvata sul server.
- Alcuni tempi e stati vivono ancora nella TV; i punteggi critici sono validati dal
  server dove previsto.
- La roadmap operativa è in `docs/ROADMAP-POST-PRIMA-SERATA.md`.

Per installazione e configurazione: `README.md`.
