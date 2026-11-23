# Giro HTML TV, telefoni, bonus e regia — 23/11/2026

## Cos'è stato provato

Giro manuale con backend Docker reale e frontend Angular in sviluppo, senza mock.

| Voce | Valore |
|---|---|
| Backend | `http://127.0.0.1:8080`, container `pubgame-backend`, healthy |
| Frontend | `http://127.0.0.1:4200`, Angular dev server |
| Browser | Chromium del pannello di anteprima, viewport TV `1280×720`, telefono `390×844` |
| Partita TV | `#8`, creata per il giro; una squadra: `Squadra A` |
| Partita precedente | `#7`, usata per verificare reset e recupero |
| Autenticazione | sessioni TV/admin aperte con il segreto di regia del container; token non riportati in questo report |

Il backend Docker era **più vecchio del sorgente**: immagine costruita il **20/11/2026 19:36 UTC**, mentre il codice del 21–23/11 includeva già l’identità del round Quiz. Il primo errore del giro è nato da questo disallineamento; ho ricostruito il container (`docker compose up -d --build backend`) e ripetuto i test. I risultati sotto sono quelli ottenuti **dopo** la ricostruzione, salvo dove indicato.

> Nota sugli screenshot: il badge `Freebuff` in alto a sinistra, la barra/striscia nera a destra e il ritaglio a 1150 px sono **chrome del pannello di anteprima**, non dell’applicazione. Non sono contati come difetti del gioco. Il QR che punta a `127.0.0.1` è invece una conseguenza reale dell’apertura su loopback: per i telefoni serve l’IP LAN, come da `SETUP-LOCALE.md`.

## Sintesi

| # | Gravità | Area | Problema | Stato |
|---|---|---|---|---|
| 1 | **P1** | TV / reset | Il reset conferma sul server ma la TV non si ricarica per il `beforeunload`; resta il round vecchio | Verificato |
| 2 | **P1** | Telefono / Quiz | La prima manche Quiz non compare sul telefono; i tasti arrivano solo dalla manche 2 | Riprodotto 2 volte |
| 3 | **P2** | Telefono / reload | Dopo un reload a metà round il contatore torna a `ROUND 1/40` e il manuale `?manuale=` non si apre | Verificato |
| 4 | **P2** | TV / recupero | Pannello “Round ripristinabile” quasi illeggibile: titolo e ✕ scuri su fondo scuro; etichetta `QUIZ` duplicata | Verificato |
| 5 | **P2** | Bonus Cavallo | Durante il riordino del tabellone una riga scompare e due si sovrappongono per un frame | Verificato |
| 6 | **P3** | Partita nuova | Una partita appena creata non è restituita da `/games/active` finché non ha stato; una TV nuova torna alla partita precedente | Verificato via API |
| 7 | **P3** | Diagnostica | `roundOpen: true` con `roundType: null` e `roundIndex: 0` dopo reset/partita nuova | Verificato |
| 8 | **P3** | Bonus preview | A 720p la seconda riga delle cinque card è sotto la piega; serve scroll | Verificato |
| 9 | **P4** | Telefono / tema | Otto temi in quattro colonne a 390 px: chip molto stretti e testo a `0.55rem` | Verificato visivamente |
| 10 | **P2** | TV / storage | Con un `activeGameId` vecchio la TV apre `PARTITA #2` e resta `OFFLINE` (401), mentre `/games/active` indica la partita `#6` | Verificato all’avvio del giro |

> **Aggiornamento 24/11/2026:** tutte le voci P1, P2 e P3 di questa tabella sono state corrette. L’esito e le verifiche sono in fondo al report, nella sezione «Esito delle correzioni». Le sezioni di dettaglio qui sotto restano la fotografia del giro originale.

## Dettaglio

### 1. P1 — Reset TV: il server resetta, la TV resta sul round vecchio

**Passi**

1. Partita `#7`, round 2 “Indovina la canzone” aperto.
2. TV → `🔄 Reset partita` → `SÌ, RESETTA`.
3. La richiesta `POST /games/7/reset` risponde **200**.
4. La TV resta sul round 2 e sulla canzone vecchia; un reload manuale non cambia la schermata.

**Evidenza**

- Network del browser: `POST /games/7/reset → 200`, poi `GET /games/7/leaderboard → 200`.
- `game.component.ts`:
  - `@HostListener('window:beforeunload')` restituisce `"Hai una partita in corso!"` quando `phase() !== 'IDLE' && phase() !== GamePhase.INTRO` (righe ~389–394).
  - `confirmReset()` chiama `clearLocal()` e dentro `reloadPage()` → `location.reload()` (righe ~2358–2380).
- In automazione il prompt `beforeunload` annulla il reload: la pagina resta la stessa. In un browser normale l’utente vede **un secondo prompt** dopo aver già confermato il reset.
- Una nuova scheda sulla stessa partita mostrava la lobby vuota: il reset **lato server** aveva funzionato; il problema è il reload bloccato lato TV.

**Impatto**

Il reset non riporta la TV a una lobby pulita in modo affidabile. In sala il presentatore può credere di aver resettato e trovarsi ancora davanti al vecchio round. Nel test automatico il reset è rimasto visivamente non applicato.

**Indicazione**

Prima di `location.reload()` va azzerata la fase/`currentMode` oppure va introdotto un flag che disattiva il `beforeunload` durante il reset. Il reset non dovrebbe chiedere due conferme.

### 2. P1 — Quiz: la prima manche non arriva sul telefono

**Passi**

1. `Squadra A` entra, completa la prova pulsanti, la TV la vede come `1 SQUADRA COLLEGATA`.
2. TV → `AVANTI`; parte un round QUIZ (Anime/Manga).
3. La TV mostra domanda, 4 opzioni e timer 15 s.
4. Il telefono resta su “In attesa della prossima sfida...” per tutta la manche 1.
5. Alla manche 2 il telefono mostra finalmente le quattro lettere A/B/C/D.

**Evidenza**

- Riprodotto nel round 1 e nel round 3 della partita `#8`.
- Nel riepilogo TV il punto 1 riporta `— nessuna risposta`; i punti 2 e 3 hanno `✅ Squadra A`.
- `docs/AUDIT-GRAFICO/tour-mobile-quiz-wait.png`: telefono in attesa mentre la TV è già sul Quiz.
- `docs/AUDIT-GRAFICO/tour-tv-quiz-summary.png`: riepilogo con la prima manche senza risposta.
- Nessun errore JavaScript nel console del telefono; le chiamate `/games/8/quiz/answers` rispondono 200.

**Impatto**

La prima domanda di ogni Quiz è di fatto ingiocabile dal telefono. Se il comportamento è una race tra `SHOW_QUESTION`/`START_VOTING` e lo stato `QUIZ_STATE`, va corretto perché colpisce l’inizio di ogni round Quiz.

**Stato**

Riprodotto 2/2 con un telefono desktop emulato (`?quad=1`). Da confermare con due telefoni reali e con la TV non in pausa; la pausa è stata attivata nella seconda parte del test e non nella prima.

### 3. P2 — Reload del telefono: contatore a 1/40 e manuale non aperto

**Passi**

1. Partita `#8`, round 3/40 in corso, telefono su `Squadra A`.
2. Reload di `/play?game=8&quad=1&manuale=AZZARDO`.
3. Il telefono mostra `ROUND 1/40` (non `3/40`) e poi le opzioni del Quiz in corso, senza il manuale Azzardo.

**Evidenza**

- Snapshot del telefono: `ROUND 1/40` con `QUIZ` e A/B/C/D; la TV nello stesso momento è su `ROUND: 3/40`.
- `manuale=AZZARDO` non ha aperto la scheda: il `START_VOTING`/`QUIZ_STATE` chiama `closeManual()` e chiude l’anteprima aperta dal parametro.
- Il parametro è documentato nel codice come anteprima per `sim-duo` (`remote.component.ts` ~541–544).

**Impatto**

Chi ricarica il telefono a metà serata vede un numero di round sbagliato e perde il manuale. La sincronizzazione della domanda funziona, ma l’intestazione no.

### 4. P2 — Pannello di recupero TV illeggibile

**Evidenza**

- `docs/AUDIT-GRAFICO/tour-tv-recovery.png`.
- CSS `game.component.css`:
  - `.recovery-panel .recovery-panel-inner { background: linear-gradient(135deg, #1a1a2e, #0f0c29); color: var(--paper); }`
  - `.recovery-panel-title { color: var(--coal, #15150f); }`
  - `.recovery-panel-close { color: var(--coal, #15150f); }`
- Il titolo “Round ripristinabile” e la ✕ sono quasi neri sul fondo blu/nero.
- Il corpo mostra due volte `QUIZ`: l’icona di modalità e la label hanno lo stesso testo.

**Impatto**

Dopo un crash o un reload con round aperto, la TV chiede una decisione con testo quasi invisibile. È un problema di leggibilità, non solo estetico.

### 5. P2/P3 — Cavallo: tabellone in riordino con riga mancante

**Evidenza**

- `docs/AUDIT-GRAFICO/tour-bonus-cavallo.png`, catturato durante `DOMANDA 4/8`: la riga 3 non c’è, le righe 4 e 5 si sovrappongono e il bordo destro taglia `2/8`.
- `docs/AUDIT-GRAFICO/tour-bonus-cavallo-2.png`, a fine bonus: tutte le 8 righe sono presenti e ordinate, senza sovrapposizioni.

**Interpretazione**

Il tabellone usa righe con `position` assoluta e `top: calc(var(--row) * i)`. Durante il riordino la transizione può sovrapporre due righe e lasciare un buco per un frame; a riposo il layout è corretto. Non è quindi un layout rotto permanente, ma è visibile in diretta durante il bonus.

**Nota**

L’assenza del testo della domanda nella preview Cavallo **non è un bug**: il componente dichiara che la TV mostra solo cronometro e tabellone, mentre domanda e opzioni stanno sul telefono.

### 6. P3 — Una partita nuova non diventa subito “attiva”

**Passi**

1. Creata la partita `#8` (stato `CREATED`, nessun round).
2. `GET /games/active` restituiva ancora `{"gameId":7}`.
3. Una nuova scheda TV apriva `PARTITA #7`, non `#8`.
4. Dopo `POST /games/8/reset` (che crea lo stato), `/games/active` è passato a `8`.

**Impatto**

Una TV appena aperta può riagganciarsi alla partita precedente invece di quella appena creata. È un caso da chiarire: può essere il comportamento voluto (“attiva” = con stato), ma il nome e il commento del controller suggeriscono che la partita nuova dovrebbe essere raggiungibile.

### 7. P3 — Diagnostica: `roundOpen` vero senza round

Dopo il reset della partita `#7`:

```json
{"gameId":7,"status":"CREATED","roundIndex":0,"roundType":null,"roundOpen":true}
```

La stessa condizione si vede su `#8` appena creata (`stateVersion:0`, nessun round). Se `roundOpen` guida il pannello di recupero o la sincronizzazione, il valore è fuorviante. Da verificare la semantica lato backend: un gioco `CREATED` senza `roundType` non dovrebbe risultare “aperto”.

### 8. P3 — Bonus preview: la seconda riga non sta a 720p

`/bonus-preview` a `1280×720`: le prime tre card entrano, la quarta e la quinta iniziano sotto il bordo e richiedono scroll. La pagina è scrollabile, quindi non è un blocco, ma la vetrina “cinque bonus in una schermata” non è completa su un TV 720p.

### 9. P4 — Selettore tema molto compresso a 390 px

Il passo 2 dell’ingresso mostra 8 temi in 4 colonne. A 390 px ogni chip è largo circa 70 px, con etichetta a `0.55rem`; il tocco resta possibile ma il testo è piccolo e la griglia sembra compressa. Non è un errore funzionale, è un rischio di leggibilità sul telefono.

### 10. P2 — TV con partita vecchia in `localStorage`: resta offline sulla partita sbagliata

**Passi**

1. All’apertura del giro il backend rispondeva `GET /games/active → {"gameId":6}`.
2. La TV mostrava invece `PARTITA #2`, `0 SQUADRE COLLEGATE` e `OFFLINE`.
3. La console riportava `GET /games/2/session → 401`.
4. Impostando a mano `activeGameId` e un token validi la TV è passata online sulla partita corretta.

**Impatto**

Aprendo la TV dopo una serata precedente, il browser può ripartire dall’ID salvato invece che dalla partita attiva e mostrare una lobby vuota/offline. Il commento nel codice dice che la TV “chiede al server quale serata è in corso”, ma in questa prova non è avvenuto: il 401 ha lasciato la TV su `#2`.

**Nota**

Non ho ripulito il `localStorage` prima di questo passaggio: è esattamente la condizione di un PC usato per più serate. Da verificare se il 401 dovrebbe far scattare il fallback su `/games/active` senza intervento manuale.

## Cosa ha funzionato

Verificato direttamente, senza errori JavaScript ricorrenti dopo la ricostruzione del backend:

- Lobby TV a `1280×720`: QR, `PARTITA #8`, codice regia, contatore `0/40`, dock comandi; nessun overflow orizzontale (`scrollWidth = 1280`).
- Ingresso telefono: foto facoltativa, nome squadra, scelta tema, conferma.
- Prova pulsanti: tocco, scelta, trascinamento (passato automaticamente allo scadere), vibrazione con `NON VIBRA`; la TV mostra `Da controllare`.
- Quiz: manche 2 e 3, voto, riepilogo delle tre manches e assegnazione punti.
- Musica: prenotazione dal telefono, TV con `SQUADRA A · SI È PRENOTATO`, pannello risposte.
- Pausa TV e ripresa; cambio tema TV (ACIDO → SABBIA).
- Bonus preview: index, Casino colore, Dozzina, Numero secco, Blackjack e Cavallo si caricano; a fine animazione il tabellone Cavallo è corretto.
- Admin a 390 px: stato partita, round `2 MUSIC`, dispositivi, prova pulsanti, categorie, demo e controlli di flusso presenti; nessun overflow orizzontale misurato.

## Non verificato / limiti del giro

- **Nessun telefono fisico**: niente fotocamera, microfono, vibrazione reale, Safari/iOS, PWA, blocca-schermo, gesture touch reali.
- **Un solo tavolo** (`Squadra A`). Non ho potuto verificare gare tra più telefoni, nomi duplicati, riconnessioni contemporanee, isolamento tra squadre, timeout di presenza con più device.
- **QR non provato da un secondo dispositivo**: la TV era su `127.0.0.1`, quindi il QR punta a loopback. È il limite noto di questa prova, non un difetto del QR.
- **Giochi non giocati in diretta**: Timeline (drag), Azzardo (fiches), Ruota, Immagine sfocata, Arena, Bomba, Biglie, Tennis, Ultima spiaggia, Speed Rush, bonus Casino/Blackjack/Cavallo live. Ho visto le schermate/demo e le preview, non l’interazione completa.
- **Nessun test a 1080p/4K**, nessuna misura di performance, audio, font o memoria su serata lunga.
- **Admin**: sessione creata via segreto, non ho provato il flusso `GENERA CODICE` → codice a 6 cifre → admin da un secondo dispositivo.
- **Backend ricostruito durante il giro**: il primo errore Quiz (`Identità del round Quiz assente`) appartiene al container vecchio. I test successivi sono sul backend aggiornato; eventuali differenze con la serata precedente vanno attribuite al cambio immagine.

## File e artefatti

- `docs/AUDIT-GRAFICO/tour-tv-lobby-720.png`
- `docs/AUDIT-GRAFICO/tour-tv-recovery.png`
- `docs/AUDIT-GRAFICO/tour-tv-quiz-summary.png`
- `docs/AUDIT-GRAFICO/tour-tv-demo-timeline.png`
- `docs/AUDIT-GRAFICO/tour-mobile-join.png`
- `docs/AUDIT-GRAFICO/tour-mobile-theme.png`
- `docs/AUDIT-GRAFICO/tour-mobile-quiz-wait.png`
- `docs/AUDIT-GRAFICO/tour-bonus-index.png`
- `docs/AUDIT-GRAFICO/tour-bonus-casino.png`
- `docs/AUDIT-GRAFICO/tour-bonus-cavallo.png`
- `docs/AUDIT-GRAFICO/tour-bonus-cavallo-2.png`
- `docs/AUDIT-GRAFICO/tour-admin-mobile.png`

File temporanei usati per aprire le sessioni di prova: `.freebuff/tour-auth.sh` e `apps/frontend/public/__tour-session.json`. Il file pubblico con i token è stato rimosso; i token non sono riportati qui.

## Esito delle correzioni (24/11/2026)

### P1 — Reset TV

- `game.component.ts`: il reload del reset imposta `resetReloadInFlight`; il listener `beforeunload` lo legge e non blocca più `location.reload()`. Il flag si azzera nel `finally`, anche se il reset fallisce.
- Verifica reale su partita #9: `POST /games/9/reset` → 200; la TV si è ricaricata da sola ed è tornata alla lobby con `ROUND: 0/40`, senza seconda conferma.
- Diagnostica dopo il reset: `status: CREATED`, `roundIndex: 0`, `roundType: null`, `roundOpen: false`.

### P1 — Quiz, prima manche sul telefono

- `remote.component.ts`: uno snapshot `QUIZ` in ritardo sulla stessa apertura non riporta più il telefono a `WAITING`; un annuncio già accettato conserva `VOTING` e i tasti.
- Verifica reale: alla manche 1/3 il telefono ha mostrato A/B/C/D mentre la TV aveva domanda e timer; il voto è stato inviato (`RISPOSTA INVIATA`) e il round è proseguito sulla manche 2.
- Aggiunti due test di regressione in `remote.component.spec.ts` (snapshot in ritardo e contatore dopo refresh).

### P2 — Pannello di recupero

- `game.component.html` / `.css`: pannello in carta e inchiostro, bordo 3 px, ombra piena, titolo e ✕ in `var(--coal)`, bottoni coerenti; rimossi il fondo blu/nero e la duplicazione della label `QUIZ`.
- Il markup e il contrasto sono stati controllati sul sorgente; non è stato rifatto uno screenshot del pannello dopo la modifica.

### P2 — Reload telefono e manuale

- `remote.component.ts`: il contatore usa `roundIndex + 1` dal server; `?manuale=` è pinnato e i cambi automatici di round non lo chiudono.
- Verifica reale: reload a metà round 3 → header `ROUND 3/40`; `?game=9&quad=1&manuale=AZZARDO` ha aperto il manuale durante un round attivo ed è rimasto aperto dopo il passaggio al round successivo.

### P2 — TV con partita vecchia in storage

- `game.component.ts`: la TV risolve `/games/active` **prima** di aprire la sessione, quindi un token vecchio non può più bloccare l’avvio sulla partita sbagliata.
- Verifica reale: `localStorage` con `activeGameId=2` e token finto per #2; nuova scheda TV → `PARTITA #9`, sessione valida, nessun 401. Il contatore è ripartito da `0/40` invece di ereditare il 3/40 della serata precedente.

### P3 — Cavallo

- `cavallo-bonus.component.ts`: rimossa la transizione su `top` delle righe assolute; il riordino non anima più la posizione e non può sovrapporre due righe per un frame. La correzione è stata verificata sul CSS del componente, non con una cattura frame-by-frame.

### P3 — Partita nuova e `/games/active`

- `GameController.java`: `/games/active` restituisce la riga `Game` più recente anche senza stato, con fallback sull’ultimo stato salvato.
- Verifica reale: partita #9 creata → `/games/active` è passato subito da `#8` a `#9`; diagnostica `CREATED`, nessun round.

### P3 — Diagnostica `roundOpen`

- `GameStateService.java`: nuovo `hasOpenRound()`, che richiede `status RUNNING`, `roundType` valorizzato e deadline non scaduta. `ReliabilityController` usa questo valore.
- Verifica reale su partita nuova e su partita appena resettata: `roundOpen: false` con `roundType: null`.

### Controlli automatici

- Frontend: `npm run test:frontend` → **709 test passati** (70 file), inclusi i 104 test TV e i nuovi test del telefono.
- Frontend: `npm run build:frontend` → build completata; restano solo i warning CommonJS già noti di `qrcode` e `matter-js`.
- Backend: `npm run test:backend` → **169 test, 0 errori, 0 fallimenti**; `BUILD SUCCESS`.
## Contatore TV e reset delle squadre (24/11/2026)

### Contatore a inizio round

- `game.component.ts`: con `status: RUNNING` e `roundIndex: 0` il contatore usa `1`, non più `0`. Il caso `CREATED`/nessun round resta a `0`, mentre i round successivi continuano a non regredire rispetto alla scaletta locale.
- Test di regressione in `game.component.spec.ts`: partita con `RUNNING` + `roundIndex: 0` → `1/40`.
- Verifica reale: avviato il round 1, la TV ha mostrato `ROUND: 1/40`; una nuova scheda TV aperta a inizio round ha mostrato ancora `ROUND: 1/40`.

### Reset: squadre e contatore del telefono

- `DeviceSessionService.clearRemotes()`: il reset revoca le sessioni `REMOTE`, libera i nomi e lascia intatte TV e regia.
- `GameController.resetGame()`: chiama `clearRemotes()`, azzera anche la prova pulsanti (`ButtonTestService.forget`) e pubblica `GAME_RESET` con i nomi delle squadre rimosse.
- `remote.component.ts` / `.html`: su `GAME_RESET` il telefono torna al setup, cancella nome e token locali, azzera `roundNumber` e la pausa, e mostra «La partita è stata resettata». Anche lo snapshot `CREATED` con `roundIndex: 0` riporta il contatore a zero.
- Se l'evento si perde mentre la socket è chiusa, `ReliabilityService` non ricrea da solo la squadra: un heartbeat `410`/`401` per un `REMOTE` revoca il token e riporta al setup. Verificato con la scheda telefono rimasta su un'altra schermata: dopo la revoca il componente aveva `nickname: null`, `roundNumber: 0`, `paused: false`.
- Verifica reale: con telefono collegato, reset dalla TV → telefono sulla schermata nome con avviso di reset; TV `0 SQUADRE COLLEGATE`, `ROUND: 0/40`; diagnostica con sola presenza TV e stato `CREATED`. Anche la card della prova pulsanti è sparita dalla lobby.
- Test: reset revoca la squadra ma non TV/admin, lo stesso nome può rientrare con una sessione nuova; `GAME_RESET` azzera contatore e pausa sul telefono; `ButtonTestService.forget` svuota le squadre della prova pulsanti.

### Controlli automatici

- Frontend: **712 test passati** (70 file), inclusi i nuovi test TV e telefono.
- Backend: **171 test, 0 errori, 0 fallimenti**; `BUILD SUCCESS`.
- Build frontend completata.
