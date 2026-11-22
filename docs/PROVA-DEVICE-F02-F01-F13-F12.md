# Giro di prova su device — F02, F16, F01, F13, F12, F09

Una sola sessione con TV e due telefoni, 75–90 minuti (90–105 con F09 e i casi
palette di F12). Serve a chiudere ciò che
jsdom non può dire: bfcache, storage delle PWA, rete reale, percezione in sala.

**Regola**: durante il giro non si tocca il codice. Si annota, si fotografa, si
riproduce dopo. Se un caso blocca il giro, si segna ❌ e si passa al successivo.

---

## 1. Prima di iniziare (5 minuti)

Annotare in cima al foglio:

| Voce | Valore |
|---|---|
| Commit testato (`git rev-parse --short HEAD`) | |
| TV: risoluzione e browser | |
| iPhone: modello, iOS, Safari o PWA (da Home) | |
| Android: modello, versione, Chrome | |
| `ALLOWED_ORIGINS` usata per il primo giro | |
| Chi guarda la TV dal fondo sala (per F12) | |

Controlli a freddo:

- [ ] TV su `/` con la partita aperta, QR visibile.
- [ ] Due telefoni entrati, squadre distinte, tutorial completato su entrambi.
- [ ] Un round già chiuso con punti a una squadra (serve a F12).
- [ ] La regia può chiudere un round e avviarne un altro Quiz (serve a F16).

---

## 2. F02 — Rientro del telefono e voti legacy (20 minuti)

Per R1–R13: sul telefono interessato, ricaricare la pagina **dal browser**
(⟳), non rientrare dalla Home. Aspettare 3 secondi e guardare cosa c'è a schermo.

### Preparazione R14–R15 — copia legacy con lo script

Non usare il database della serata. Con il backend fermo:

1. creare la copia da un backup con un Quiz aperto:
   `npm run db:legacy-copy -- --source <backup.mv.db> --target /tmp/pubgame-prova-legacy.mv.db`
   (aggiungere `--force` per rifarla). Lo script copia il file, sceglie l'ultimo
   Quiz aperto (o `--game-id`), riscrive il blob `quiz` **senza** `roundStartId`
   e allinea `round-announced`; il file sorgente viene solo letto. Se la copia
   non ha un Quiz aperto lo script lo dice: usare un backup preso durante un
   Quiz, non il database della serata.
2. avviare il backend sulla copia; lo script stampa il comando:
   `DB_URL='jdbc:h2:file:/tmp/pubgame-prova-legacy;DB_CLOSE_DELAY=-1' npm run dev:backend`
3. aprire la partita indicata dallo script: la TV deve vedere un Quiz in corso.

| # | Prova | Cosa deve succedere | Esito | Note / cosa si è visto |
|---|---|---|---|---|
| R1 | Quiz, manche aperta: vota con il telefono A, poi ricarica | Tasti aperti subito; la manche già votata risulta bloccata entro 1–2 s; nessun doppio voto sul server | | |
| R2 | Musica, brano in onda: ricarica il telefono B | Schermata del brano; tocco di prenotazione → la TV riceve **una** prenotazione | | |
| R3 | Bomba, round avviato: ricarica il telefono B | Nessun "In attesa" fisso: lo stato della bomba riparte da solo entro 2 s | | |
| R4 | Timeline con ordine **non ancora toccato**: ricarica | Carte nell'ordine mostrato, invio automatico dell'ordine iniziale (verificare sul server/TV che la risposta esista) | | |
| R5 | Timeline con ordine **già inviato**: disponi le carte, attendi 1 s, ricarica | Le carte sono nell'ordine scelto, non quello della TV; nessun nuovo invio finché non tocchi | | |
| R6 | *(opzionale, rete lenta)* Timeline: sposta una carta e ricarica subito; appena la pagina torna, sposta un'altra carta | Vince la seconda modifica; l'ordine del server non torna indietro | | |
| R7 | iOS: Safari, refresh durante un round | Stessa squadra, niente tutorial, il round in corso si riapre | | |
| R8 | iOS: vai su un'altra app 2–3 minuti, torna | Nessun secondo ingresso, nessuna risposta doppia; lo stato si riallinea | | |
| R9 | iOS: indietro/avanti del browser (bfcache) | Stessa squadra, riallineamento, nessun loop | | |
| R10 | iOS **PWA da Home**: chiudi, riapri dopo 5 minuti | Se lo storage è stato sfrattato: form con nome precompilato e avviso di sessione, **non** ingresso silenzioso né squadra sbagliata | | |
| R11 | Regia: espelli il telefono A mentre è aperto | Avviso «La regia ha rimosso la squadra»; un tocco residuo non manda voti; la TV toglie la squadra | | |
| R12 | Due schede sullo stesso telefono | La seconda mostra «Partita aperta in un'altra scheda» e non risponde; chiudendo la prima, la seconda torna attiva al ritorno in primo piano | | |
| R13 | Sessione non riconosciuta (serata diversa o token scaduto) | Form col nome pronto + «La sessione è scaduta»; nessun ingresso automatico | | |
| R14 | Con la copia legacy avviata: entra nella partita e apri il round Quiz; ricarica **entrambi i telefoni** dal browser, poi ricarica la TV e premi RIPRENDI | Dopo i refresh i due telefoni non offrono una domanda votabile: nessun tasto di risposta attivo e nessun voto registrabile; i voti legacy non compaiono. La TV mostra l'avviso «Quiz precedente non verificabile: i voti salvati sono conservati, ma non è sicuro riprendere» e non riapre la manche | | |
| R15 | Dalla regia chiudi il round e apri un Quiz **nuovo** (chiave di round diversa); vota da un telefono | La manche nuova parte con risposte vuote; i voti legacy non compaiono; il telefono vota regolarmente. Sulla copia, la riga `quiz-legacy-archive` è una sola e contiene il primo legacy; resta invariata dopo un secondo legacy/round | | |

Da guardare in ogni prova: la TV non deve ricevere due volte la stessa risposta o
lo stesso ordine Timeline, e la classifica non deve cambiare dopo un refresh del
telefono.

Per R15, a backend spento, controllare la copia con H2 Shell (sola lettura):
`SELECT blob_key, payload FROM state_blob WHERE game_id = <id> AND blob_key LIKE 'quiz%'`.
L'archivio conserva il **primo** legacy; un secondo legacy non lo sostituisce.

### Vie di sblocco del Quiz coperte dai test automatici

Al commit `15ab8cd4` la suite frontend (70 file, 680 test) copre in jsdom le
uscite dal blocco del riepilogo. Questi casi non vanno riprovati a mano per
fidarsi della logica: in sala servono a confermare che rete, socket e refresh
reali si comportino come i doppi di test. I test remoti sono 98
(`--include="**/remote.component.spec.ts"`).

| Via di sblocco | Test automatico | Cosa resta ai device |
|---|---|---|
| Riepilogo in volo: quattro tasti disabilitati | `tiene i tasti Quiz chiusi mentre il riepilogo è in volo e li riapre senza voto` | Che i tasti sembrino spenti a schermo, non solo `disabled` nel DOM |
| Riepilogo riuscito senza voto: tasti riaperti | stesso test | Che la risposta HTTP reale arrivi in tempi utili su Wi-Fi/4G di sala |
| Riepilogo riuscito con voto: tasti chiusi e risposta scelta | `dopo un refresh in Quiz non riapre il voto di una manche già votata` | R1: blocco entro 1–2 s dal refresh, nessun doppio voto sul server |
| Errore del riepilogo: tasti chiusi, nessun voto inviato | `se il riepilogo Quiz fallisce lascia i tasti chiusi e non invia voti` | R14: errore vero (rete caduta), avviso visibile e tasti non cliccabili |
| Riallineamento riuscito: attesa chiusa e avviso rimosso | `un reannuncio senza identità non riapre i tasti dopo un errore, ma il round dopo la fine sì` | Che RIPRENDI dalla TV porti il riallineamento a entrambi i telefoni |
| Reannuncio dello stesso round senza `roundStartId`: resta bloccato | stesso test e `un reannuncio senza identità non sblocca il legacy, ma il round dopo la fine sì` | F16 Q4: refresh TV e RIPRENDI con annuncio reale, nessuna riapertura |
| `ROUND_ENDED`: chiude attesa e blocco legacy | `la fine del round chiude l attesa del riepilogo Quiz` e il test legacy sopra | Che l'evento arrivi a un telefono che ha appena ripreso la socket |
| `REVEAL`: chiude attesa e sblocca il legacy | `REVEAL chiude l attesa del riepilogo Quiz e permette il round successivo`, `REVEAL sblocca il legacy e permette il round successivo` | Percezione a fine manche: nessun tasto residuo durante il reveal |
| Snapshot di un nuovo round (`roundKey`/`roundStartId` diversi): sblocca attesa e legacy | `uno snapshot di un nuovo round chiude l attesa del riepilogo Quiz`, `uno snapshot di un nuovo round sblocca il legacy` | R15: nuovo Quiz dal vero, con chiave di round diversa e voti vuoti |
| Annuncio con `roundStartId` nuovo: sblocca il legacy | `con un blob Quiz legacy non lascia una domanda votabile dopo il refresh` | R15: il telefono vota la manche nuova e il server la accetta |
| Snapshot ripetuto dello stesso legacy: non riapre | `con un blob Quiz legacy non lascia una domanda votabile dopo il refresh` (secondo snapshot) | R14: due refresh di fila sullo stesso telefono non aprono nulla |

Restano fuori dai test automatici, e vanno guardati solo in sala:

- **R14 completo**: copia legacy vera, backend sulla copia, entrambi i telefoni
  ricaricati dal browser, TV ricaricata e RIPRENDI. I test usano doppi dei
  servizi: non dimostrano che il server rifiuti i voti legacy né che la TV
  mostri l'avviso «Quiz precedente non verificabile…».
- **R15 completo**: chiusura del round dalla regia, Quiz nuovo con chiave
  diversa, voto accettato, riga `quiz-legacy-archive` unica. L'archivio è lato
  backend: nessun test frontend lo copre.
- **Tempismo reale**: latenza del riepilogo sulla rete di sala, ordine di
  arrivo di `START_VOTING`/`ROUND_ENDED`/`REVEAL` dopo una riconnessione,
  socket che riparte dopo il refresh.
- **Dispositivi**: iOS Safari e PWA da Home (storage, sospensione in
  background, bfcache) e Android Chrome; jsdom non li riproduce. Annotare
  modello e versione per ogni rosso.

Se un caso della tabella fallisce in sala è una regressione, non una prova
mancante: si annota con il device e si riproduce.

---

## 3. F16 — Annunci Quiz, cambio round e refresh (15 minuti)

Servono la TV e due telefoni già in squadra (A e B) e la regia pronta a
chiudere o avanzare il round. Il difetto da escludere è un annuncio Quiz **già
accettato** che arriva ai telefoni dopo il cambio round, o che arriva due volte.
Ripetere Q2–Q4 almeno tre volte: è una corsa, non un caso deterministico.

| # | Prova | Cosa deve succedere | Esito | Note |
|---|---|---|---|---|
| Q1 | Primo round Quiz: apri la manche dalla TV | Entrambi i telefoni mostrano la domanda e i tasti; ogni telefono vota una volta; la TV mostra una sola risposta per telefono | | |
| Q2 | Manche aperta: dalla regia chiudi il round e avviane un altro Quiz mentre i telefoni mostrano ancora la domanda | I telefoni non mostrano più la domanda vecchia; un tocco residuo non invia voti al round nuovo; nessun annuncio del round precedente riappare | | |
| Q3 | Cambio round **subito dopo l'apertura**, prima che i telefoni mostrino la domanda (3 volte) | L'annuncio del round superato non apre i tasti e non crea voti; il round nuovo arriva una volta sola, a entrambi i telefoni | | |
| Q4 | **Refresh TV (F5) durante l'annuncio**, entro 1–2 s dall'apertura; al ritorno premi RIPRENDI | La TV riprende il round aperto e riannuncia la manche corrente; i telefoni non ricevono un secondo annuncio né uno vecchio; i voti restano una volta sola | | |
| Q5 | Dopo Q4 vota da entrambi i telefoni | Un voto per telefono e manche; la TV mostra entrambe le risposte; la classifica non raddoppia i punti | | |
| Q6 | *(opzionale, rete lenta sul telefono B)* Ripeti Q3 con throttling | Il telefono scarta l'annuncio superato e accetta solo quello corrente | | |

Se la TV non mostra RIPRENDI dopo il refresh, annotare il comportamento senza
forzare la ripresa: Q4 resta non eseguita.

## 4. F01 — Ingresso su iPhone/Safari (5 minuti)

- [ ] Aprire il link del QR su iPhone **Safari**, da freddo (scheda nuova).
  Per 20 secondi: l'URL resta stabile, la pagina non si ricarica da sola, si
  arriva al nome squadra o alla lobby.
- [ ] Ripetere dalla **PWA installata** (Home).
- [ ] Ripetere in **navigazione privata** di Safari.

| # | Prova | Esito | Note (iOS, passi, cosa si è visto) |
|---|---|---|---|
| I1 | Safari, link QR, scheda nuova | | |
| I2 | Safari, secondo ingresso a partita già iniziata | | |
| I3 | PWA da Home | | |
| I4 | Navigazione privata | | |

Se compare un loop: annotare quanti giri, se l'URL cambia (query/route) e se
smette da solo dopo N secondi o resta bloccato.

---

## 5. F13 — CORS e origini reali (10 minuti)

Serve il PC con i log del backend visibili.

**Giro A — origini esplicite** (`ALLOWED_ORIGINS=http://localhost:4200,http://<IP-LAN>:4200`):

| # | Prova | Cosa deve succedere | Esito | Note |
|---|---|---|---|---|
| C1 | TV carica la partita | Nessun errore CORS in console; snapshot e realtime arrivano | | |
| C2 | Entrambi i telefoni entrano | Sessioni create, nessun preflight fallito in console | | |
| C3 | Un round parte e i voti arrivano | Risposte accettate, classifica aggiornata | | |
| C4 | Log del backend | Nessun avviso di origine rifiutata | | |

**Giro B — wildcard** (`ALLOWED_ORIGINS=*`), solo se il profilo di serata lo usa:

| # | Prova | Esito | Note |
|---|---|---|---|
| C5 | Stesse prove C1–C3 con wildcard | | |
| C6 | Log: avvisi o errori con credenziali | | |

Annotare sempre la riga esatta di `ALLOWED_ORIGINS` usata: senza quella il
risultato non è riproducibile.

---

## 6. F12 — Tema TV e palette delle squadre (15–20 minuti)

Serve un round chiuso con punti a una sola squadra, poi uno con pari merito, e
almeno tre telefoni: due restano in partita, il terzo serve alle prove di
espulsione e rientro.

**Prima di iniziare**: nessun telefono deve aver scelto il colore, tranne quello
indicato in T8 (per T12–T14 serve un telefono in più, che cambia nome o chiude
la pagina). Le palette vengono assegnate dalla TV all'ingresso, in ordine
(SABBIA, ARTICO, OCEANO, K-POP, CYBER, SUNSET, ORO, poi l'acido all'ottava):
se una squadra ha già scelto, i colori non sono più nell'ordine previsto e la
prova T1 va comunque fatta, annotando il colore visto.

| # | Prova | Cosa deve succedere | Esito | Note |
|---|---|---|---|---|
| T1 | Chiudi un round con una squadra nettamente prima | TV: il colore/etichetta della squadra vincente si vede già dalla schermata di chiusura e resta fino al round dopo | | |
| T2 | Chiedere a due persone dal fondo sala: «di che colore era il tema?» | Entrambe nominano la squadra vincente, senza suggerimenti | | |
| T3 | Telefono della squadra vincente e di un'altra | Coerenti con la TV (o differenza voluta e documentata) | | |
| T4 | Round con pari merito | Comportamento concordato: nessun tema, o tema condiviso, ma deciso e dichiarato | | |
| T5 | Round senza punti (nessuno vince) | Nessun tema assegnato per errore | | |
| T6 | Foto della TV a 720p e a 1080p | Consegna: due foto dei casi T1 e T4 | | |
| T7 | TV: **refresh** (F5) a metà serata, con almeno quattro squadre collegate | Ogni squadra riprende il colore che aveva: nessuna torna in acido, nessuno scambio di colore fra squadre | | |
| T8 | **Refresh della TV** dopo che un telefono ha scelto la palette prima del tutorial | Il colore scelto resta dopo il reload, senza che il telefono rimandi la scelta | | |
| T9 | Espelli una squadra **senza punti**, poi falla rientrare dallo stesso telefono | Al rientro ritrova **lo stesso colore** di prima; la classifica non cambia per le altre squadre | | |
| T10 | Espelli una squadra **con punti** | Resta in classifica con i suoi punti e il suo colore; una squadra nuova che entra non prende quel colore | | |
| T11 | Partita nuova (o reset confermato) con la TV ricaricata | I colori ripartono dall'inizio: prime squadre SABBIA, ARTICO, OCEANO; nessun colore ereditato dalla partita precedente | | |
| T12 | Lo **stesso telefono** rientra con un nome diverso (es. `Anna` → `Anna Sofia`) | La squadra resta una sola: stesso colore di prima, punti e risposte seguono il nuovo nome, nessuna riga `Anna` residua; il telefono non deve rimandare la palette | | |
| T13 | Un telefono **diverso** entra con quel nome (o un altro telefono cambia nome) | È una squadra nuova: riga nuova a zero punti e palette libera e distinta da quella di `Anna Sofia` | | |
| T14 | In lobby un telefono **chiude la pagina** (squadra ancora a zero punti) | La sua riga sparisce dalla classifica entro il refresh delle presenze e la palette torna disponibile; chi ha già punti resta in tabella anche se il telefono è staccato | | |

**Comportamento voluto in T12–T14.** Il messaggio di ingresso (`JOIN_GAME`) porta
anche il `deviceId`, lo stesso identificativo stabile con cui il telefono apre la
sessione. Quindi: stesso telefono + nome nuovo = **stessa squadra**, che porta
con sé palette, memoria del colore e punti (anche quelli del round in corso);
telefono diverso con lo stesso nome = **squadra nuova**. In lobby la TV toglie
le righe a **zero punti** delle squadre non più collegate e ne libera le
palette, così un telefono chiuso non lascia né righe fantasma né colori
occupati; chi ha punti resta, perché i punti non si cancellano senza una
decisione della regia.

Per T2 non spiegare prima cosa guardare: la percezione è il dato. In T7–T10
fotografare la TV prima e dopo: la coppia di scatti è la prova, l'occhio da solo
non distingue «colore simile» da «colore identico».

---

## 7. F09 — Classifica rapida su TV vera (10–15 minuti)

Le misure a 720p sono già state fatte sul componente Angular vero
(`docs/screenshots/f09-classifica-rapida-*-720p.png`): quello che manca è la
percezione a distanza e la resa di una TV fisica. Si guarda la classifica
**dopo** il reveal, quando il tabellone è compattato, non durante la sequenza.

Servono un round chiuso con 12 squadre, poi 16, poi 20 collegate. Chi non ha
venti telefoni può usare venti schede in incognito sullo stesso telefono o venti
profili browser: conta il numero di squadre in classifica, non i telefoni.

| # | Prova | Cosa deve succedere | Esito | Note |
|---|---|---|---|---|
| L1 | 12 squadre, TV a 720p | Due colonne, sei righe; tutti e dodici i nomi leggibili dal fondo sala, nessuno tagliato | | |
| L2 | 16 squadre | Due colonne, otto righe; tutti visibili senza scorrere | | |
| L3 | 20 squadre | Tre colonne, sette righe; tutti e venti visibili, l'ultima riga non esce dal riquadro | | |
| L4 | Chi sta dal fondo sala legge i nomi di L1–L3 | Almeno 8 nomi su 10 corretti a 4–5 metri | | |
| L5 | Ordine di lettura | Dal peggiore al migliore, sinistra→destra e riga per riga; il primo posto è l'ultimo in basso a destra | | |
| L6 | Avatar e colori con 12 e 20 squadre | Ogni squadra ha un colore distinto (le palette si ripetono oltre l'ottava) e l'avatar non schiaccia il nome | | |
| L7 | Foto della TV a 720p con 12, 16 e 20 squadre | Consegna: tre foto, nomi leggibili nello scatto | | |
| L8 | *(solo se la serata supera 20 squadre)* 24 squadre | Tre colonne, otto righe; se qualcosa esce dal riquadro si annota e si passa oltre | | |

Se una prova supera le 20 squadre non è prevista: annotare il numero reale e
fermarsi, non improvvisare una quarta colonna in sala.

---

## 8. Formato di esito per la roadmap

Per ogni voce toccata (F01, F02, F16, F12, F13, F09) riportare **quattro campi**, con lo
stesso schema delle righe esistenti:

```
| Fxx | <stato> | <prove eseguite, N passate / M totali> | `<hash>` | <cosa si è visto, casi falliti, device> |
```

Stati ammessi: `Corretto, da verificare in sala` (tutto verde, ma serve una
serata vera), `Parziale` (alcune prove rosse o non eseguite), `Aperto`
(riprodotto il problema, causa non ancora nota). Non si scrive «Chiuso» senza
tutte le prove eseguite.

Note obbligatorie accanto all'esito:

- device e versione per ogni prova rossa (es. «iPhone 13, iOS 18.2, Safari»);
- se la prova non è stata eseguita scrivere **non eseguita**, non lasciare vuoto;
- per F12, la risposta di T2 e il collegamento alle foto;
- per F13, la riga di `ALLOWED_ORIGINS` usata.

### Riepilogo da compilare a fine giro

| Voce | Esito complessivo | Prove passate | Cosa resta aperto |
|---|---|---|---|
| F01 | | /4 | |
| F02 | | /15 | |
| F16 | | /5 (+1) | |
| F12 | | /14 | |
| F13 | | /6 | |
| F09 | | /7 (+1) | |

Firmato: ____________________  Data: ____________  Commit: `__________`
