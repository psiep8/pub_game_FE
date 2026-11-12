# Fix in ordine, prima e dopo la prima serata

Ordine di lavoro deciso dopo la revisione dei commit `b9f9a10..f927e49`.
Legenda: **[fatto]** già in questo albero, **[stasera]** va chiuso prima di
domani, **[P1]** entro una settimana dalla serata, **[P2]** giro successivo.

La serata serve a raccogliere dati, non a chiudere il backlog: quello che non è
**[stasera]** non entra nella serata.

---

## 1. Fatto in questa preparazione

| # | Fix | Dove | Perché |
|---|---|---|---|
| 1 | **[fatto]** `startClock()` ferma il tick precedente | `core/services/audio.service.ts` | due start senza stop lasciavano due intervalli e `stopClock()` ne spegneva uno solo: tick per tutta la serata |
| 2 | **[fatto]** la pausa ferma clock e battito, la ripresa li riapre | `features/tv/game.component.ts` | a gioco in pausa il countdown continuava a suonare |
| 3 | **[fatto]** riaggancio immediato quando la scheda torna visibile o torna la rete | `core/websocket/web-socket.service.ts` | il backoff faceva aspettare fino a decine di secondi dopo un blocco schermo |
| 4 | **[fatto]** `GET /health` senza autenticazione | `controller/HealthController.java` | sonda per Docker e controllo a freddo |
| 5 | **[fatto]** report e log di simulazione fuori dal repo | `.gitignore`, `scripts/sim/reports/` | ~13 MB di CSV/JSON/log non sono codice; restano su disco |
| 6 | **[fatto]** rimossi 7 mp3 identici e mai referenziati | `apps/frontend/src/assets/audio/` | 600 KB di doppioni inutili (`md5` uguale per tutti e sette) |
| 7 | **[fatto]** versione **2.0.0** su root, frontend e backend | `package.json`, `pom.xml` | major fissata a fine preparazione |

---

## 2. [stasera] — bloccanti per domani

| # | Cosa | Come | Fatto quando |
|---|---|---|---|
| 1 | `.env` di serata | `cp .env.test-night.example .env`; `CONTROL_SECRET` ≥ 32 caratteri; `ALLOWED_ORIGINS` con localhost **e** IP LAN; `HOST=0.0.0.0` | TV e telefoni entrano senza errori di origine |
| 2 | Backup del DB prima di iniziare | copia `apps/backend/data/pubgame.mv.db` in `backups/` con data e ora | esiste il file di backup |
| 3 | Prova audio di sala | tabella §3.3 di `docs/SERATA-PROVA.md`, con il volume vero | nessun tick o battito sovrapposto |
| 4 | Giro a vuoto con due telefoni veri | Safari + Chrome, un round completo, refresh TV, blocco schermo 60 s | le tre prove passano o sono annotate |
| 5 | Piano B della ripresa TV | scritto su carta: se la TV si blocca → ricarica, round ripristinabile, altrimenti chiudi il round e rilancia | chi è in regia sa cosa fare senza pensarci |
| 6 | Foglio delle prove di caduta | stampa §6 di `docs/SERATA-PROVA.md` con spazio per gli esiti | l'osservatore ha il foglio in mano |

Nota: il tick del clock è volutamente secco (1650 Hz, 40 ms). Se in sala copre la
voce, si abbassa il volume di sistema della TV — **non** si cambia il codice la
sera stessa.

---

## 3. [P1] — la settimana dopo la serata

In quest'ordine, perché ogni voce sblocca la successiva.

1. **Ripresa completa della TV, gioco per gioco.** Oggi solo Timeline riprende:
   gli altri mostrano il pannello "round ripristinabile" e si chiudono. Serve uno
   stato serializzabile per gioco (payload, secondi rimasti, fase) salvato nel
   round lato server e un `restore()` per ogni mode, come già fa Timeline.
   *Fatto quando*: ricaricando la TV in ognuno dei giochi si torna nella stessa
   fase, con lo stesso timer, senza perdere le risposte già arrivate.
2. **Motore punteggi sul server per gli altri giochi.** Speed Rush e Basket sono
   già lì; restano Time Buzzer, Timeline, Azzardo, Arena, Blackjack, Cavallo.
   *Fatto quando*: la TV non calcola più punti, li riceve.
3. **Abbinamento admin con codice breve.** La TV mostra un codice a 4–6 cifre,
   l'admin lo scambia con un token di regia a scadenza: niente più 32 caratteri
   digitati sul telefono.
   *Fatto quando*: si entra in regia da telefono in meno di dieci secondi.
4. **Classifiche con suspense e reveal unico in tre tempi.** Rullo, pausa prima
   del primo, distanza dal podio; poi il modello di reveal condiviso
   (tempo scaduto → rullo → risposta → punti in classifica).
   *Fatto quando*: la classifica rapida mostra chi sale e chi scende; il podio ha
   il falso allarme.
5. **Partita simulata da 40 round.** Il pilota arriva a 13: serve la scaletta
   intera per misurare durata reale, crescita del DB e tenuta della classifica.
   *Fatto quando*: la run #166 chiude 40 round e 5 bonus con 0 errori aperti.
6. **CI.** Workflow con `npm run build`, `npm run test:frontend`,
   `npm run test:backend` e una simulazione corta (8 giocatori, 3 round) su ogni
   push.
   *Fatto quando*: il badge è verde e un PR rotto viene fermato.
7. **Infrastruttura di serata.** `HEALTHCHECK` nel compose su `/health`, tag
   delle immagini per versione (`pubgame:2.0.0`) con rollback in un comando,
   backup automatico prima e dopo la serata.
   *Fatto quando*: un aggiornamento sbagliato si annulla in meno di due minuti.
8. **`ALLOWED_ORIGINS` mai `"*"`.** Il default resta la lista esplicita; `*` solo
   come scelta consapevole e documentata per una serata tra amici.
   *Fatto quando*: `.env.example` e i profili non suggeriscono più il jolly.

---

## 4. [P2] — giro successivo

- Durata di 3 ore: memoria del browser TV, crescita del DB, pulizia delle
  sessioni vecchie.
- Contenuti: domande ambigue, doppioni, categorie sbilanciate.
- Accessibilità: corpo minimo sulla TV, giusto/sbagliato anche con un'icona e non
  solo col colore, foto delle squadre in ogni classifica.
- Rete: limite di frequenza dei messaggi per dispositivo, correzione periodica
  dell'orologio del server, router dedicato e PC su cavo (§ già in checklist).
- Suspense: blackout dopo l'atto 4 (ordine senza punti) e podio finale a scena.
- Controllo del presentatore: pulsante "Rivela" per i momenti importanti.

---

## 5. Esiti della prima serata

Da compilare la notte stessa, poi trasformare ogni riga in una fix con priorità.

| Prova | Esito | Recupero | Cosa ha visto il tavolo |
|---|---|---|---|
| Telefono bloccato 60 s | | | |
| App in background 30 s | | | |
| Wi-Fi spento 20 s | | | |
| Refresh TV a metà round | | | |
| Refresh TV su bonus | | | |
| Regia da telefono | | | |
| Nome falso | | | |
| Backend riavviato | | | |

Altre note della serata:

- Durata media di un round: ______
- Numero di riconnessioni spontanee: ______
- Problemi audio: ______
- Problemi di leggibilità: ______
