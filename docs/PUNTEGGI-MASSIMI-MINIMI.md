# Punteggi per round — massimo e minimo con N = 6 e N = 10

Tabella costruita dalle costanti reali, non da stime: `shared/models/scoring-rules.ts`,
`shared/models/rank-points.ts`, i motori in `features/games/*`, e il server dove il
punteggio è autorevole (`QuizService`, `SpeedRushService`, `BombaService`).
Riferimento: `main` al 25 novembre 2026. **Punteggi allineati al codice attuale.**

Nel repository non esisteva una tabella equivalente: il §6 della specifica la
chiedeva, ma non era mai stata scritta.

**Come leggerla.** Massimo e minimo sono per **squadra** e per **singolo round**,
nell'ipotesi limite in cui la squadra giochi tutte le manche/gare e risponda al
tempo zero dove il tempo taglia i punti. N non cambia quasi mai gli estremi:
cambia la distribuzione dei piazzamenti (seconda tabella) e il numero di bombe.

## 1. Tabella per round

| Gioco | Struttura del round | Max N=6 | Min N=6 | Max N=10 | Min N=10 | Punti decisi da |
|---|---|---:|---:|---:|---:|---|
| **Quiz** | 3 manches da 15 s | **+1000** | **−1000** | **+1000** | **−1000** | server (`QuizService`) |
| **Musica** | 4 round da 5 manche, un tema per round | **+1000** | **−250** | **+1000** | **−250** | TV (`musicPointsFor`) |
| **Timeline** | 8 eventi | +400 | −200 | +400 | −200 | server/TV (`TIMELINE_POSITION_POINTS`) |
| **Time Buzzer** | 3 manches, 2 occorrenze in serata | +1800 | −600 | +1800 | −600 | TV (`rankPoints` + perfetto) |
| **Speed Rush** | 1 gara | +800 | −400 | +800 | −400 | server (`SpeedRushService`) |
| **Tennis** | 1 partita per round; 3 round in serata | +500 | 0 | +500 | 0 | TV (`TENNIS_WIN`) |
| **Bomba** | tabellone a turni; 2 ondate in serata | 0 | −500 | 0 | −500 | server (`BombaService`) |
| **Biglie** | 2 gare per round; 4 round in serata | +1000 | −800 | +1000 | −800 | TV (`rankPoints`) |
| **Azzardo** | 4 manches; 2 occorrenze in serata | +1500 | 0 | +1500 | 0 | TV (`chipsBreakdown`) |
| **Ultima spiaggia** | 1 manche per apparizione; 5 in serata | +500 | −250 | +500 | −250 | TV (`level` scelto) |
| **Immagine sfocata** | 3 manches da 45 s (333/333/334) | +1000 | −1000 | +1000 | −1000 | TV (`calculatePoints`) |
| **Ruota della fortuna** | 1 frase da 75 s | +1000 | −1000 | +1000 | −1000 | TV (`calculatePoints`) |
| **Arena** | 1 round da 130 s | +1000 + 10×risposte giuste | −300 − 10×risposte sbagliate | +1000 + 10×risposte giuste | −300 − 10×risposte sbagliate | TV (`calculatePoints` + piazzamento) |

Note alle celle:

- **Quiz, ±1000:** il round vale **1000 punti in tutto**, divisi fra le tre
  manches dal mix di difficoltà: tre diverse pagano **200 / 350 / 450**, due
  uguali più una lasciano **250** alle più facili e il resto alle altre
  (250 / 375 / 375 oppure 250 / 250 / 500), tre uguali **333 / 333 / 334**. Ogni
  manche dura **15 secondi** e la quota scala con il tempo: rispondere subito
  vale il tetto, all'ultimo secondo zero. La sbagliata toglie **la stessa quota
  scalata**, quindi il round va da −1000 a +1000; chi non risponde prende 0. Dal
  23 novembre 2026 server (`QuizService.manchePoints`), `SCORING_RULES`,
  manuale e demo usano tutti questa tabella.
- **Time Buzzer, +1800:** 3 manche da **20 secondi** × 600 del tempo perfetto
  (errore ≤ 50 ms, solo per il primo). Senza nessun tempo perfetto il massimo è
  +900 (3 × 300).
- **Tennis, 0:** tre round in serata; in ogni round con N pari ogni squadra gioca una partita. Con N dispari la squadra senza avversario prende +500 a tavolino (`awardCourt` sul riposo). Il massimo per round è +500, in serata +1500.
- **Bomba, −500 alla prima:** solo malus, nessun bonus. Il malus è
  `−round10(500 × bombe rimaste / bombe iniziali)`, con «rimaste» che conta anche
  la bomba appena presa. Si scala dal totale **anche sotto zero**: chi ha pochi
  punti finisce in negativo, chi si salva prende 0. Il totale del round cambia
  con N: N=6 → 2 bombe (−500, −250; totale −750), N=10 → 4 bombe (−500, −380,
  −250, −130; totale −1260).
- **Azzardo, +1500 / −1000:** tetto di 500 per manche
  (`AZZARDO_MAX_WIN_PER_MANCHE`) e di 250 in perdita, con tetto di round a +1500
  e −1000 (`AZZARDO_MAX_WIN_PER_ROUND`, `AZZARDO_MAX_LOSS_PER_ROUND`). La
  classifica non scende mai sotto zero: il minimo reale è `−punti posseduti
  all'inizio del round` (0 per chi parte da zero).
- **Musica, +1000 / −250 per round:** un round sono **cinque manche**, un brano per manca, tutte sullo
  stesso tema. Il primo ascolto vale **+200**, il secondo **+100**, chi non prenota prende 0.
  Sbagliare al primo ascolto vale **0** (blocca solo quell'ascolto), sbagliare al secondo costa **−50**:
  il minimo del round è quindi 5 × −50 = **−250**. Ogni squadra ha una sola prenotazione per manca e
  rientra alla manca successiva. **La partita sono quattro round: massimo +4000, minimo −1000**, ed è la
  partita più pesante della serata.
- **Immagine/Ruota, −1000:** una sola risposta per squadra nel round;
  una risposta sbagliata manda `BLOCKED_ERROR` e chiude il round per quella squadra.
- **Arena:** non è limitata dalle costanti: il numero di risposte rapide in 130 s
  non è fissato. Il piazzamento finale vale +1000 / +500 / −300.

## 2. Dove N cambia davvero: le distribuzioni

Piazzamenti calcolati con `rankPoints` (arrotondamento alla decina).

**Speed Rush** — W=800, L=−400:

```
N=6   800, 530, 270, −130, −270, −400
N=10  800, 640, 480, 320, 160, −80, −160, −240, −320, −400
```

**Biglie (una gara)** — W=500, L=−400; il round sono due gare:

```
N=6   500, 330, 170, −130, −270, −400        → round: +1000 / −800
N=10  500, 400, 300, 200, 100, −80, −160, −240, −320, −400 → round: +1000 / −800
```

**Time Buzzer (una manche)** — W=300, L=−200; il round sono tre manche:

```
N=6   300, 200, 100, −70, −130, −200        → round: +900 / −600 (+1800 con 3 perfetti)
N=10  300, 240, 180, 120, 60, −40, −80, −120, −160, −200 → round: +900 / −600
```

**Bomba** — `bombsFor(N) = max(1, round(2N/5))`:

```
N=6   B=2   malus: −500, −250                 totale round −750
N=10  B=4   malus: −500, −380, −250, −130     totale round −1260
```

## 3. Bonus (solo punti positivi)

| Bonus | Max per occorrenza | Min | Fonte |
|---|---:|---:|---|
| Karaoke | +1000 (100 + 150 + 200 + 250 + 300) | 0 | `BONUS_KARAOKE_MANCHE_POINTS` |
| Casino 5 manche | +1500 (100 + 200 + 100 + 100 + 1000) | 0 | `BONUS_CASINO_FIVE_POINTS` |
| Casino numero secco | +1000 (una volta sola) | 0 | `BONUS_CASINO_NUMBER_POINTS` |
| Blackjack | 0 (premio del bar) | 0 | `BONUS_SCORING` |
| Cavallo di battaglia | 0 (premio del bar) | 0 | `BONUS_SCORING` |

## 4. Squilibri, in ordine di valore

1. **Quiz: +1000 / −1000, risolto.** Il conflitto tra server (−1000 fissi a
   manche) e regola dichiarata (penalità proporzionale alla quota e al tempo) è
   chiuso: il server usa la stessa formula del client, quindi il round resta in
   un intervallo simmetrico e non può più azzerare tre round di guadagni.
2. **Azzardo: +1500 / −1000 per round.** Deciso il 24 novembre 2026: tetti di
   500 e 250 a manche, round a +1500 e −1000. Con due occorrenze il tetto
   teorico scende a +3000; una manche intera non paga più di 500, meno di
   Time Buzzer (+1800) e Musica (±1000 in una manche). Per chi è a zero punti il
   minimo resta 0: solo upside.
3. **Time Buzzer: +1800 / −600.** Escursione 2400 per round: 4,5× il massimo di
   Timeline e 3× il suo minimo. È già segnalato nel §6 della specifica.
4. **Biglie: +1000 / −800.** Escursione 1800 e la penalità fissa più grande dopo
   il Quiz: due gare con piazzamenti negativi pesano quasi quanto il primo posto.
5. **Musica: +4000 / −1000 a partita.** Il round vale 1000 (5 × 200), quindi
   la partita di quattro round arriva a **+4000**, il doppio del Quiz. È la
   partita più pesante della serata: il rischio però è basso (−50 al massimo per
   manca, 0 al primo ascolto), quindi la forbice reale tra chi riconosce e chi
   non riconosce è 5000 punti.
6. **Tennis: +500 / 0 per round.** Nessun rischio: 500 punti secchi a partita, fino a +1500 nei tre round, senza alcun malus. Asimmetrico rispetto a Biglie e Time Buzzer.
7. **Timeline: +400 / −200.** L'escursione più piccola (600) per il gioco con più
   passaggi (ordinare 8 eventi): sottopesata rispetto agli altri.
8. **Bonus: 300–600.** Un bonus intero vale meno di un round di Musica (1000) o di
   Speed Rush; è una scelta voluta (solo positivi), ma muove poco la classifica.
9. **Arena: estremi non limitati.** +10/−10 per risposta più il piazzamento:
   senza un tetto al numero di risposte, massimo e minimo non derivano dalle
   costanti e non sono confrontabili con gli altri giochi.
10. **Bomba: solo malus, scalato anche sotto zero.** Deciso il 24 novembre 2026:
    non c'è più il taglio sui punti disponibili, quindi chi è a zero finisce in
    negativo. Chi si salva prende 0, senza premi.

## 5. Coerenze da decidere (senza toccare i numeri ora)

- **Quiz, penalità sbagliata:** deciso il 23 novembre 2026 — la penalità è la
  quota della manche scalata dal tempo, come il guadagno. Massimo +1000, minimo
  −1000 per round; nessuna risposta 0.
- **Ultima spiaggia, chi non sceglie:** il codice assegna 0; `SCORING_RULES` dice
  «−metà del livello scelto». Senza livello scelto la metà non esiste: va scritto
  esplicitamente che l'assenza di scelta vale 0.
- **Arena:** definire un tetto alle risposte o dichiarare che il gioco è fuori
  dalla tabella dei massimi/minimi.
