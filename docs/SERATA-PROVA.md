# Serata di prova — programma operativo

La prima serata con telefoni veri serve a scoprire quello che la simulazione non
può dire: blocco schermo, browser in background, fotocamera, vibrazione, audio
della sala, layout sul proiettore. Questo documento è la scaletta: cosa fare
prima, cosa fare in sala, cosa guardare, cosa raccogliere dopo.

Regola generale: **durante la serata non si tocca il codice**. Si annota, si
fotografa, si riproduce dopo.

---

## 1. Obiettivo della serata

Verificare, nell'ordine:

1. **Ingresso**: QR → nome squadra → lobby, su iPhone (Safari) e Android (Chrome).
2. **Un atto completo**: i primi 8 round con classifica rapida, dettagliata e il
   bonus Casino.
3. **Tenuta dei telefoni**: blocco schermo 60 s, cambio app, Wi-Fi spento e
   riacceso, ritorno in primo piano.
4. **Tenuta della TV**: refresh a metà round, refresh durante bonus e classifica.
5. **Audio**: battito, clock, suspense, fanfara, senza sovrapposizioni.
6. **Leggibilità**: 720p e 1080p, dal fondo della sala.

Non è una serata di punteggio: se qualcosa si rompe si annota e si prosegue.

---

## 2. Persone e ruoli

| Ruolo | Chi | Cosa fa |
|---|---|---|
| **Presentatore** | tu | guida i round da `/admin`, decide i tempi, non tocca il PC |
| **Tecnico** | una persona fidata | tiene il PC, guarda i log, fa i refresh programmati |
| **Osservatore** | una persona | cronometro, note, foto degli schermi, raccoglie i reclami |
| **Tavoli** | 6–10 squadre | giocano, provano i casi di caduta su indicazione |

Servono almeno **due telefoni di prova in più** (uno iPhone, un Android) per le
prove di caduta, senza togliere il telefono a una squadra.

---

## 3. T-1 — oggi, prima di dormire

### 3.1 Configurazione (15 minuti)

```bash
# 1. Configurazione di serata
#    Se .env esiste già NON copiarlo sopra: si perdono chiavi e segreto.
#    Aggiungi solo le voci che mancano, prendendole da .env.test-night.example.
grep -E '^(CONTROL_SECRET|ALLOWED_ORIGINS|HOST)=' .env
#    CONTROL_SECRET: almeno 32 caratteri casuali (es. openssl rand -hex 24)
#    ALLOWED_ORIGINS: localhost + IP LAN del PC, separati da virgola
#    HOST=0.0.0.0

# 2. Backup del database attuale (se esiste)
npm run db:backup        # scrive in backups/ con data e ora
npm run db:backup -- --list

# 3. Avvio
npm run dev
```

`npm run dev` stampa l'IP LAN: quello va nelle `ALLOWED_ORIGINS` e serve ai
telefoni. Il QR sulla TV nasce da quell'indirizzo.

### 3.2 Controlli a freddo (20 minuti)

- [ ] `.env` ha `CONTROL_SECRET` di almeno 32 caratteri: senza, regia e TV non
      si accoppiano.
- [ ] `ALLOWED_ORIGINS` in `.env` contiene l'IP LAN stampato da `npm run dev`:
      senza, i telefoni vengono respinti e funziona solo il PC.
- [ ] `npm run dev` trova il JDK (lo dice nella prima riga: `JDK: .tools/jdk-…`)
      e non stampa `JAVA_HOME environment variable is not defined correctly`.
- [ ] `curl http://localhost:8080/health` risponde `{"status":"ok"}`.
- [ ] TV a `/tv`: si vede il QR, si sentono il tappeto del pub e il battito.
- [ ] `/admin`: entra solo col segreto; apertura lobby, primo round, pausa.
- [ ] Due telefoni entrano dai rispettivi browser (Safari e Chrome), non solo
      dal browser del PC.
- [ ] Muta e smuta la TV: il tappeto riparte una volta sola, non due.
- [ ] Un round di prova con 2 telefoni: risposta, reveal, classifica.

### 3.3 Prova da 40 round in background (opzionale, mentre prepari la sala)

La scaletta intera è verificabile senza stare davanti allo schermo:

```bash
ROUNDS_MODE=serata PLAYERS=16 node scripts/sim/full-match.mjs run
```

Dura ~25 minuti con `ROUND_MS=26000`. Serve a vedere gli atti 1–5, le
classifiche di metà e fine atto e la crescita del database: se compare un
errore, si legge nel log e non in sala.

### 3.4 Prova audio a orecchio (10 minuti) — farla con il volume di sala

Con il volume che userai davvero, ascolta in quest'ordine e segna chi
sovrasta l'altro:

| Momento | Cosa deve suonare | Cosa non deve succedere |
|---|---|---|
| Lobby | tappeto + battito lento | tappeto che riparte doppio dopo il mute |
| Inizio round 1 | un tick al secondo | tick doppio, tick che continua dopo il round |
| Pausa | silenzio di gioco (resta il tappeto) | tick o battito che continuano |
| Ripresa | tick che riparte | due tick sovrapposti |
| Round 20+ | battito che cresce | battito insieme al tick a volume fastidioso |
| Reveal | rullo + accordo | rullo troncato o doppio |
| Bonus Casino | tick della pallina | tick che restano dopo il fermo |
| Classifica finale | fanfara del podio | fanfara due volte |

Se il tick del clock copre la voce del presentatore, abbassa il volume di sistema
della TV: non cambiare il codice la sera stessa.

---

## 4. T-0 — il giorno della serata

### 4.1 Sessanta minuti prima

1. Backup del DB e copia su chiavetta o cloud.
2. `npm run dev`, poi apri `/tv` sul proiettore e `/admin` sul PC del presentatore.
3. Verifica i tre schermi a **1280×720** e a **1920×1080** (finestra ridotta e
   schermo intero): nessun testo tagliato, nessuna scrollbar sulla TV.
4. Connetti il PC via cavo, router dedicato, telefoni sul Wi-Fi 5 GHz.
5. Metti il PC in modalità "non sospendere" e disattiva gli aggiornamenti.
6. Prepara il foglio delle prove di caduta (§6) e un timer.

### 4.2 Dieci minuti prima

- [ ] Lobby aperta, QR grande, volume impostato, audio non muto.
- [ ] Un telefono di prova entra e vede il manuale.
- [ ] Refresh della TV: la lobby si ricostruisce e i tavoli restano.
- [ ] Foglio e penna per l'osservatore; telefono carico per le foto.

---

## 5. Scaletta della serata (90–120 minuti, non 40 round)

Una serata intera da 40 round non sta in una prova: si gioca **un atto intero**
e si campionano gli altri giochi. Il presentatore salta i round con i comandi di
regia, senza fretta.

| Blocco | Contenuto | Durata | Cosa si verifica |
|---|---|---|---|
| A | Ingresso + lobby | 10' | QR, nomi, doppioni, avatar |
| B | Atto 1: 8 round | 40' | tutti i giochi "di sapere", classifica rapida e dettagliata |
| C | Bonus Casino | 10' | risultati bonus, audio roulette, classifica bonus |
| D | Regole nuove: Bomba, Azzardo, Speed Rush, Tennis Battle (§5.1) | 25' | turni, fiches, corsia, traiettorie |
| E | Prova di caduta su un round | 10' | §6 |
| F | Chiusura: classifica finale | 5' | podio, fanfara |
| G | Debrief con i tavoli | 10' | cosa non si capiva |

Se il tempo stringe: A, B (round 1–4), C, E, F. Le prove di caduta valgono più
di due round in più.

### 5.1 Regole nuove — controlli della prova

Le regole cambiate dopo l'ultima stesura del documento. Da fare una volta sola,
con l'osservatore che cronometra: sono i punti in cui la simulazione non può
dire niente.

| Gioco | Cosa fare | Cosa deve succedere | Cosa annotare |
|---|---|---|---|
| **Bomba** | Due ondate con 6–8 squadre | Il tabellone resta coperto per tutta l'ondata e mostra solo chi ha scelto cosa; alla chiusura si scoprono insieme bombe, FUORI e −200. Chi non sceglie entro il turno è eliminato con −200 e non rigioca | Secondi reali per scegliere; se 20 s sono pochi con dieci tavoli |
| **Azzardo** | Due manche di fila | Il salvadanaio cresce (17 fiches → 13 giocabili), la puntata parte solo con CONFERMA PUNTATA e almeno una fiche, la riga «max 1000 a manche» si legge a 390px. Un tavolo prova a mettere 11 fiches e non deve poterlo fare | Se il tetto che cresce si capisce senza spiegazione |
| **Speed Rush** | Sessanta secondi pieni | Nessuna prova ripetuta, difficoltà che sale con l'avanzamento, badge ×2 dopo sei risposte di fila | Quante risposte fa il tavolo più veloce: sotto ~20 il traguardo da 25 è troppo alto |
| **Tennis Battle** | Quattro o cinque campi insieme | Dal fondo si distinguono i colpi (dritto, diagonale, stretto, corto, pallonetto) e si legge la fascia FACILE/MEDIA/DIFFICILE | Se il tiro a giro sembra un glitch |
| **Time Buzzer** | Una manche | Il bersaglio non supera mai i 20 secondi | Se qualcuno prova ad aspettare e perde |
| **Canzone** | Un round intero | Quattro manche da 30 secondi con distorsioni diverse, punteggio proporzionale ai secondi rimasti | Se le manche 2 e 3 si sentono diverse o solo rovinate |

Cinque minuti in più, se il tempo tiene: **Indovina chi** (round da 60 s,
indizio ogni 15) e **Timeline** (45 s, punteggi con un solo segno: mai «+-200»).

#### Due cose da non fare

- **Non ricaricare la TV durante l'Azzardo.** Saldo fiches, tetto e manche in
  corso vivono nella memoria della TV: un refresh a metà manche li perde. Bomba
  e Speed Rush hanno uno stato sul server, l'Azzardo no. Se succede, annota cosa
  hanno visto i tavoli: è la prova che serve uno snapshot server.
- **Non cambiare le regole a caldo.** Se i turni della Bomba sembrano corti, il
  backend accetta `PUBGAME_BOMBA_TURN_SECONDS=25` senza toccare il codice. Tutto
  il resto si annota e si decide con i log davanti.

#### Foglio dell'osservatore

| Gioco | Esito (ok / rotto / confuso) | Secondi reali | Chi ha protestato | Nota |
|---|---|---|---|---|
| Bomba |  |  |  |  |
| Azzardo |  |  |  |  |
| Speed Rush |  |  |  |  |
| Tennis Battle |  |  |  |  |
| Time Buzzer |  |  |  |  |
| Canzone |  |  |  |  |

Tre domande ai tavoli a fine serata, perché valgono più dei bug:

1. «Il tabellone coperto della Bomba tiene la suspence o annoia?»
2. «Il tetto delle fiches si capisce o sembra un limite arbitrario?»
3. «I colpi della palla si vedono o sono rumore?»

---

## 6. Prove di caduta (le più importanti)

Da fare **una alla volta**, con l'osservatore che cronometra.

| # | Prova | Come | Atteso |
|---|---|---|---|
| 1 | Telefono bloccato | blocca lo schermo per 60 s durante un round, poi sblocca | la risposta successiva parte; lo stato si riallinea da solo |
| 2 | App in background | cambia app per 30 s, torna | idem, senza doppioni in classifica |
| 3 | Wi-Fi spento | spegni il Wi-Fi per 20 s, riaccendi | riconnessione entro pochi secondi, nessun round perso |
| 4 | Refresh TV | ricarica la TV a metà round | compare il pannello "round ripristinabile"; Timeline riprende, gli altri si chiudono e si ripete il round |
| 5 | Refresh TV su bonus | ricarica durante un bonus | la TV torna in lobby senza restare bloccata |
| 6 | Regia da telefono | prova un'azione di regia da un telefono | rifiutata, nessun effetto |
| 7 | Nome falso | due telefoni con lo stesso nome | il secondo viene respinto o rinominato, mai due righe uguali |
| 8 | Backend riavviato | riavvia il backend a metà round | la TV mostra lo stato recuperato; i telefoni si riconnettono |

Annota per ogni prova: **esito, secondi di recupero, cosa ha visto il tavolo**.

La prova 4 (refresh della TV) **non va fatta durante l'Azzardo**: lo stato della
manche vive lì, e il refresh brucerebbe il salvadanaio invece di misurare il
recupero. Fallo su Timeline o su Bomba.

---

## 7. Cosa guardare (oltre ai bug)

- **Leggibilità**: dal fondo della sala, i numeri della classifica si leggono?
  Le risposte giuste/sbagliate si distinguono anche senza colore?
- **Ritmo**: quanto dura un round dall'apertura alla classifica? Annota i tempi:
  servono per stimare la durata vera di una serata.
- **Suspense**: la classifica rapida si capisce? Chi sale lo vede?
- **Telefono**: il pollice copre il pulsante? Il testo è leggibile a un metro?
- **Audio**: vedi §3.3. Segna ogni volta che due suoni si sovrappongono male.

---

## 8. Emergenze

| Problema | Mossa immediata |
|---|---|
| TV bloccata su un round | ricarica la TV; se non torna, chiudi il round dall'admin e rilancia |
| Un telefono non risponde più | il tavolo ricarica la pagina; se non basta, rientra col nickname |
| Backend giù | riavvia; i telefoni si riconnettono da soli, il round si ripete |
| Audio impazzito (tick o battito infinito) | muta e smuta dalla TV; se resta, ricarica la TV |
| Tutto fermo e nessuno sa perché | pausa dall'admin, respira, guarda i log: non riavviare a caso |

I log da guardare: console del browser TV (`F12`), terminale di `npm run dev`,
`apps/backend/data/pubgame.trace.db` solo se serve ricostruire.

---

## 9. Dopo la serata (30 minuti, la stessa notte)

1. **Backup**: `npm run db:backup` (cartella `backups/`, fuori dal repository).
2. **Screenshot e foto**: raccogli tutto in una cartella con la data.
3. **Debrief di 15 minuti** con i tavoli, tre domande: cosa non si capiva, cosa
   era lento, cosa mancava.
4. **Trascrivi le note** in `docs/FIX-PRE-SERATA.md` sotto "Esiti della prima
   serata", con: prova, esito, secondi, nota.
5. **Non correggere niente a caldo**: le fix si fanno il giorno dopo, con i log
   davanti.

---

## 10. Cosa questa serata non copre

- 40 round e i confini degli atti 3–5 (durata, memoria, crescita del DB).
- Classifiche con suspense (rullo, blackout) — non sono ancora implementate.
- Ripresa completa della TV per ogni gioco (oggi Timeline e Blackjack).
- Ripresa dell'Azzardo dopo un refresh della TV: lo stato della manche vive
  sulla TV, non sul server.
- Abbinamento admin: il codice a 6 cifre della TV vale 5 minuti e una volta sola;
  il segreto da 32 caratteri serve solo sulla TV per generarlo.
