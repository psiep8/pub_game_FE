# Lavori in corso — pub_game_FE

Ultimo aggiornamento: 5 novembre 2026
Ultimo commit: `9e1d023` (Speed Rush, Time Buzzer, Air Hockey).
Le modifiche P0 (scaletta 40 round, bonus, Ruota, Time Buzzer, Air Hockey, auto-avanzamento) sono **non committate**.

---

## Cosa è già fatto

### Speed Rush
- Pool minigiochi: `tap`, `odd`, `order`, `math`, `stroop`, `memory`, `flip`, `count`.
- Boost a catena: ×2 a 2 risposte giuste di fila, ×3 a 5, ×4 a 10.
- Badge combo e fiamma in TV.
- `reaction` e `mole` rimosse: la talpa è motoria, non adatta a una speed race.

### Time Buzzer (al posto di Price)
- 3 manche, target casuale 5–30 secondi.
- TV: cronometro grande `00:19:23`.
- Remote: solo pulsante verde START/STOP, nessun cronometro.
- Eliminazioni circa 1/3 per manche; la TV mostra `FUORI` e `PASSANO`.
- Gli eliminati restano bloccati.

### Air Hockey Battle
- Enum `PING_PONG` → `AIR_HOCKEY_BATTLE` ovunque.
- Il tempo di risposta decide il tempo dell'avversario e la "secchezza" del tiro:
  - risposta veloce → avversario ~4s, tiro ~0,58s dritto;
  - risposta lenta → fino a ~12s, tiro ~2,6s a zig-zag.
- Portieri laser colorati e disco in campo.

### Flusso controllato dall'admin (fatto, da testare dal vivo)
Pannello **CONTROLLO FLUSSO** in `admin.html`:
- **PROSSIMO ROUND** → `ADMIN_NEXT_ROUND`
- **MOSTRA CLASSIFICA** → `ADMIN_SHOW_LEADERBOARD`
- **PAUSA / RIPRENDI** → `ADMIN_TOGGLE_PAUSE`
- **DEMO GIOCO** → `ADMIN_SHOW_DEMO`
- **CHIUDI DEMO** → `ADMIN_HIDE_DEMO`
- **PARTITA #** → campo numerico per targettare la TV anche da un altro dispositivo.

Rimosso:
- i timeout automatici che mostravano la classifica dopo il round;
- i pulsanti TV "PROSSIMO ROUND" e "CLASSIFICA";
- il pulsante TV "GIOCA ORA" (sostituito da **APRI LOBBY**, che crea solo la partita);
- la chiusura automatica della classifica: resta in TV finché l'admin non avanza.

La pausa ha un overlay a schermo intero: il gioco non è visibile dietro.

### Demo TV
- Overlay a schermo intero con `<video autoplay muted loop playsinline>`.
- Path: `/assets/demos/<tipo>.mp4` (es. `quiz.mp4`, `time_buzzer.mp4`, `air_hockey_battle.mp4`).
- Video **muto**: la spiegazione la fa il presentatore dal vivo.
- Se il file manca, resta l'animazione di fallback con il nome del gioco.
- I nomi dei file sono elencati in `apps/frontend/public/assets/demos/README.md`.

**Nota:** la demo non parte da sola alla prima apparizione; per ora la apre l'admin. Con il flusso manuale è coerente, ma si può automatizzare dopo.

### Flusso serata a 40 round (P0, 5 novembre)
- Scaletta fissa in 5 atti da 8 round: il primo round di ogni atto è Quiz, l'Arena chiude solo l'ultimo round.
- `ACT_DECKS` in `round-manager.service.ts`: Ruota 3 volte su 40 (atti 1, 3, 5), mai adiacente a Indovina chi.
- Bonus Roulette e Basket lanciabili dall'admin: non consumano un round.
  - `BONUS_RESULT` dal telefono; premi +300 / +150 / +75 ai primi tre.
  - Basket: pagina `/basket?player=...`, 30 s di gioco e 40 s di countdown in TV (margine per l'ultimo tiro).
- Time Buzzer: chi non preme entra con errore massimo ed è eliminato per primo.
- Ruota della Fortuna: lettere deterministiche (prima le più rare), timer 75 s, 3/40.
- Air Hockey: domande dalla banca (`GET /games/{id}/air-hockey/questions`), hardcoded solo come fallback.
- Avanzamento automatico dopo 10 s, annullato da pausa, classifica, demo o Prossimo round.

---

## Da fare domani

1. **Caricare i video demo** in `apps/frontend/public/assets/demos/`
   (`quiz.mp4`, `music.mp4`, `image_blur.mp4`, `timeline.mp4`, `roulette.mp4`, `arena.mp4`, `speed_rush.mp4`, `time_buzzer.mp4`, `air_hockey_battle.mp4`, `wheel_of_fortune.mp4`).
2. **QA dal vivo con backend acceso** (`127.0.0.1:8080`):
   - flusso admin: prossimo round, classifica, pausa, demo, bonus roulette/basket;
   - Time Buzzer e Air Hockey in TV + remote;
   - verifica che in pausa la TV non mostri il gioco e che l'auto-avanzamento si fermi.
3. **Altri 2 giochi bonus** (Memory, Tap/Swipe) da alternare a Roulette e Basket.
4. **Ruota**: separare la fase di lancio dalla rivelazione (oggi le lettere si aprono durante il timer).
5. **Commit** delle modifiche attuali, poi push.

---

## Come provarlo

```bash
# backend
cd apps/backend && ./mvnw spring-boot:run

# frontend
cd apps/frontend && npm start
```

- TV: pagina del gioco.
- Admin: pagina admin, stesso numero di **PARTITA #** mostrato sulla lobby TV.
- Se l'admin è su un altro dispositivo, inserire il numero a mano nel campo **PARTITA #**.

Limiti noti:
- Backend WS spento = niente test dal vivo.
- `MobileOnlyGuard` su `/play` limita il QA del remote; le schede nate su `/tv` restano redirette.
- Il flusso admin/TV è compilato ma **non ancora osservato in esecuzione**.

---

## Brief: bonus basket

Non è ancora codificato. È una mini-app a sé, non un minigioco da poche righe.

- **Telefono**: canvas 2D con palla, canestro, backboard e due ferri.
- **Controllo**: si trascina indietro la palla e si rilascia (o swipe) per il tiro.
- **Fisica**: gravità, rimbalzo su ferro/backboard, detezione del canestro.
- **Durata**: 20–30 secondi, tiri illimitati; ogni canestro vale punti bonus.
- **Premio**: punti bonus in classifica, oppure "gettone birra" gestito dall'admin a fine partita (serve una tabella di riscatto, non solo il punteggio).
- **Integrazione**: mode `BONUS_BASKET` o evento `BONUS_GAME` lanciato dall'admin; il risultato entra con `onAnswerReceived` e non consuma un round della scaletta.

### 4 bonus game in rotazione
1. Roulette
2. Basket (fisica)
3. Memory
4. Tap/Swipe

Primo passo consigliato: solo canvas + canestro + punteggio, senza premio birra, per valutare il feeling del tiro.

---

## File toccati (non committati)

- `apps/frontend/src/app/services/round-manager.service.ts` (+ spec)
- `apps/frontend/src/app/components/game-component/game-component.ts/.html/.css`
- `apps/frontend/src/app/components/game-component/mode/time-buzzer.mode.ts`
- `apps/frontend/src/app/components/game-component/mode/wheel-fortune.mode.ts`
- `apps/frontend/src/app/components/game-component/mode/ping-pong.mode.ts`
- `apps/frontend/src/app/components/game-component/interfaces/game-mode-type.ts`
- `apps/frontend/src/app/components/admin/admin.ts/.html`
- `apps/frontend/src/app/components/basket-bonus/basket-bonus.ts`
- `apps/frontend/src/app/components/remote-component/remote-component.ts/.html`
- `apps/frontend/src/app/services/game.service.ts`
- `apps/frontend/src/app/testing/test-doubles.ts`
- `apps/backend/src/main/java/com/pub_game_be/service/QuestionBankService.java`
- `apps/backend/src/main/java/com/pub_game_be/controller/PartyGamesController.java`
- `apps/frontend/public/assets/demos/README.md`
- `BRIEF-GIOCHI-MANCANTI.md` (non tracciato)
- `README_LAVORI.md` (questo file)

Verifiche del 5 novembre:
- Build FE `npx ng build` → exit 0.
- Build BE `./mvnw -B -DskipTests package` (JDK 25) → exit 0.
- Test FE: 62/64. Restano 2 fallimenti preesistenti e non collegati al P0:
  `LeaderboardDetailed` (spotlight dopo 9 s) e `Song` (etichetta fase 1).
- Le spec di `RoundManagerService`, `GameComponent` e `RemoteComponent` passano.
- Nessun test dal vivo: backend/WebSocket non avviati in questa sessione.
