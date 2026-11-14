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

> **Aggiornamento**: le voci 1–4 (ripresa TV per ogni gioco, punteggi server,
> codice breve admin, classifiche con suspense) **non** sono state fatte prima
> della serata: sono giorni di lavoro su stato, punteggi e sicurezza e toccarle
> a poche ore da una prova con telefoni veri significa rischiare la prova
> stessa. Le voci 5–8 sono invece chiuse (vedi sotto) e la serata ha già le sue
> protezioni: la TV si riprende per Timeline, per gli altri giochi si chiude il
> round ripristinabile e si rigioca.

1. **Ripresa completa della TV, gioco per gioco.** Oggi riprendono Timeline e
   Blackjack: gli altri mostrano il pannello "round ripristinabile" e si chiudono. Serve uno
   stato serializzabile per gioco (payload, secondi rimasti, fase) salvato nel
   round lato server e un `restore()` per ogni mode, come già fa Timeline.
   *Fatto quando*: ricaricando la TV in ognuno dei giochi si torna nella stessa
   fase, con lo stesso timer, senza perdere le risposte già arrivate.
2. **Motore punteggi sul server per gli altri giochi.** Speed Rush e Basket sono
   già lì; restano Time Buzzer, Timeline, Azzardo, Arena, Blackjack, Cavallo.
   *Fatto quando*: la TV non calcola più punti, li riceve.
3. **[fatto] Abbinamento admin con codice breve.** La TV mostra un codice a 6 cifre
   (`CODICE REGIA`, 5 minuti, uso unico); l'admin lo scambia con un token di regia.
   Il segreto da 32 caratteri serve solo alla TV per generare il codice.
   *Fatto quando*: si entra in regia da telefono in meno di dieci secondi.
4. **Classifiche con suspense e reveal unico in tre tempi.** Rullo, pausa prima
   del primo, distanza dal podio; poi il modello di reveal condiviso
   (tempo scaduto → rullo → risposta → punti in classifica).
   *Fatto quando*: la classifica rapida mostra chi sale e chi scende; il podio ha
   il falso allarme.
5. **[fatto] Partita simulata da 40 round.** `scripts/sim/full-match.mjs` accetta
   `ROUNDS_MODE=serata`: gioca i 40 round nell'ordine vero di `ACT_DECKS`
   (quindi attraversa atti 1–5, classifiche rapide e dettagliate). Comando:
   `ROUNDS_MODE=serata PLAYERS=16 node scripts/sim/full-match.mjs run`.
   *Resta da fare*: la run vera da 40 round, che dura ~25 minuti con
   `ROUND_MS=26000` — va lanciata in background mentre si prepara la sala.
6. **[fatto] CI.** `.github/workflows/ci.yml`: build e test frontend, test
   backend e una simulazione corta con 8 giocatori su ogni push. *Resta da
   verificare*: il primo run sul remoto (qui non posso spingere).
7. **[fatto] Infrastruttura di serata.** `HEALTHCHECK` nel `docker-compose.yml`
   (probe sulla porta), tag immagine da `PUBGAME_TAG` (`PUBGAME_TAG=2.0.0` per
   tornare indietro in un comando), `npm run db:backup` per il backup con
   timestamp in `backups/` (fuori dal repo).
8. **[fatto] `ALLOWED_ORIGINS` mai `"*"`.** Il default resta la lista esplicita;
   se qualcuno mette `*` il backend lo scrive a `WARN` all'avvio, così il jolly è
   una scelta consapevole e non un default silenzioso.

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

### 5.1 Pagella dei giochi — 6 partecipanti, prima volta in sala (13/11)

Giudizio della sala, non del codice. "Da migliorare" vuol dire che il gioco si è
capito e si è giocato, ma qualcosa nel ritmo o nella lettura non ha convinto.

| Gioco | Verdetto | Cosa ha visto la sala |
|---|---|---|
| Quiz | promosso | — |
| Indovina chi | da migliorare | giocato e capito, ma la foto non regge il confronto con il resto |
| Indovina la canzone | da migliorare | giocato e capito, l'ascolto è il punto debole |
| Ruota della fortuna | promosso | — |
| Arena | promosso | — |
| Ultima spiaggia | promosso | — |
| Blackjack | promosso | — |
| Speed Rush | piaciuto tantissimo | il più richiesto della serata |
| Azzardo | confusionario | regole e fiches non si leggono al primo colpo |
| Bomba | così così | il tabellone coperto piace, i turni sono lenti |
| Timeline | promosso ma da sistemare | l'ordine delle date va rifinito |
| Tennis Battle | mai giocato | il round non è mai partito (vedi §5.2) |
| Time Buzzer | carino, da chiarire | non è chiaro quando parte il cronometro |
| Bonus Casino | piaciuto tantissimo | da ridurre a una manche sola |
| Bonus Basket | bocciato | bloccato in serata reale: non è giocabile |
| Bonus Cavallo | non provato | partito senza scelta categoria, domande a tutti |
| Bonus Biglie | bellissimo | il momento più riuscito della serata |

### 5.2 Cosa sistemare, in ordine

**Bloccanti tecnici (prima di qualunque altra cosa)**

1. **Tennis: vincolo del database.** Il log di `deploy-app-1` del 13/11 alle
   21:51Z dice: `Value not permitted for column "('AIR_HOCKEY_BATTLE', ...)":
   "TENNIS_BATTLE"`. Il CHECK sulla colonna del tipo di round è rimasto quello
   di quando il gioco si chiamava Air Hockey. `StaleRoundTypeConstraintFixer`
   (aggiunto alle 22:33) non ha rimosso niente: nessuna riga `Vincolo obsoleto`
   nei log, e l'errore si è ripetuto alle 22:51. La query sui vincoli va
   corretta e verificata su un database nato prima del rename.
2. **CORS con `ALLOWED_ORIGINS=*`.** Due 500 alle 21:43Z:
   `allowedOrigins cannot contain the special value "*"` con credenziali
   attive. Il profilo di prova usa il jolly: va gestito con
   `allowedOriginPatterns`, altrimenti alcune chiamate REST falliscono senza
   spiegazione.
3. **Cavallo: voto della categoria.** La TV scarta i voti dei nomi che non
   trova esattamente in `players` (maiuscole e spazi contano) e dopo 15 secondi
   sceglie una categoria a caso. Va reso tollerante e va detto in TV quando
   nessuno ha votato.
4. **Basket fuori dalla scaletta.** In serata reale è bloccato: il pulsante in
   regia non deve offrire un bonus che poi non si può giocare.

**I piaciuti che devono contare**

5. **Punti dei bonus in classifica.** Casino, Biglie e Cavallo sono i momenti
   migliori della serata e oggi non muovono la classifica.
6. **Casino a una manche sola**, come chiesto dalla sala.

**Da chiarire**

7. **Time Buzzer:** countdown e "VIA" anche sul telefono, non solo in TV.
8. **Azzardo:** meno numeri sul telefono, fiches sulla risposta, conferma unica.
9. **Bomba:** turno più corto e "tocca a" molto più grande.
10. **Timeline:** ordinamento a tocchi invece del trascinamento, meno date.

**Contenuti**

11. **Banca media locale assente:** `static/media/{people,covers,music}` è
    vuota e `media-it.json` non esiste. Indovina chi resta senza foto e la
    canzone dipende dalle anteprime iTunes (rete e qualità variabile). È il
    motivo più probabile dei due "da migliorare".
12. Domande ambigue, doppioni e categorie sbilanciate.
