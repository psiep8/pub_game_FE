# Brief operativo PubGame — correzioni, video demo, bonus e giochi nuovi

> **VERSIONE BETA — snapshot del 7 novembre 2026.**
> Il brief resta come riferimento storico: descrive il progetto **prima** del refactoring
> della prossima versione. Le parti già superate sono segnalate dagli aggiornamenti qui
> sotto; lo stato reale del codice è in `README_LAVORI.md`.

> **Aggiornamento 5/11:** le demo sono state realizzate come tre scene animate in TV (interfaccia TV, remote e punteggio) per ogni gioco e per i bonus; gli mp4 non sono più necessari. La specifica storica sotto resta come riferimento.
>
> **Aggiornamento 6/11:** la scaletta a 40 round è cambiata e le sezioni §1.1 e §3.3 sono superate. Time Buzzer è un round vero, il Cavallo è tornato bonus, il Casino è un bonus unico in quattro manche, e c'è un round nuovo (La Ultima spiaggia). Lo stato aggiornato è in `README_LAVORI.md`.

> **A chi è rivolto:** a un agente di coding con ragionamento alto, che lavora sul repository `pub_game` senza aver visto la conversazione da cui nasce questo documento. È autoportante.
>
> **Stato del repository a cui si riferisce:** branch `main`, HEAD `76a5cc2` (*feat(party): flusso admin, 40 turni e bonus basket*), allineato a `origin/main`. Working tree pulito tranne questo file, non tracciato.
>
> **Come procedere:** leggi tutto, poi lavora in ordine di priorità (§0). Fai **una sola** domanda all'utente solo se devi scegliere tra alternative equivalenti; per il resto le decisioni sono già prese e vanno eseguite.
>
> **Regola di verifica:** distingui sempre ciò che hai compilato da ciò che hai osservato in esecuzione. Il flusso admin/TV è compilato ma **non è mai stato visto dal vivo**: dichiaralo nel riepilogo.

---

## 0. Priorità

| Priorità | Lavoro | Perché prima |
| --- | --- | --- |
| **P0** | Sei correzioni al flusso attuale (§3) | oggi ci sono bonus non giocabili e un bug che premia chi non fa niente |
| **P1** | Video esplicativi dei giochi (§4) | la cartella è vuota: la TV mostra solo il fallback |
| **P2** | Minigiochi bonus tipo roulette e basket (§5) | sono il modo per movimentare gli intervalli tra gli atti |
| **P3** | Nuove microprove di Speed Rush (§6) | allunga la vita del gioco che ne ha più bisogno |
| **P4** | Due giochi di round nuovi (§7) | opzionale: il catalogo è già a nove giochi |

Non fare P4 prima di P0-P2.

---

## 1. Stato reale (verificato sul codice)

### 1.1 Struttura della serata

- `RoundManagerService`: **40 round in 5 atti da 8**, scaletta **fissa** (`ACT_DECKS`), niente più estrazione a pesi.
- Primo round di ogni atto: sempre `QUIZ`.
- Classifiche: rapida ai round **4, 12, 20, 28, 36**; dettagliata a **8, 16, 24, 32, 40**.
- `isActEnd()` esiste (multipli di 8).
- `ROULETTE` **non è in nessun mazzo**; `startBonusRound()` esiste ma **non viene chiamato da nessuna parte**.

Scalette attuali:

```ts
const ACT_DECKS: GameModeType[][] = [
  ['QUIZ','MUSIC','TIME_BUZZER','WHEEL_OF_FORTUNE','IMAGE_BLUR','TIMELINE','QUIZ','SPEED_RUSH'],
  ['QUIZ','IMAGE_BLUR','TIMELINE','ARENA','MUSIC','TIME_BUZZER','WHEEL_OF_FORTUNE','AIR_HOCKEY_BATTLE'],
  ['QUIZ','TIMELINE','MUSIC','SPEED_RUSH','TIME_BUZZER','AIR_HOCKEY_BATTLE','WHEEL_OF_FORTUNE','ARENA'],
  ['QUIZ','MUSIC','TIME_BUZZER','IMAGE_BLUR','ARENA','TIMELINE','WHEEL_OF_FORTUNE','SPEED_RUSH'],
  ['QUIZ','TIMELINE','MUSIC','SPEED_RUSH','IMAGE_BLUR','AIR_HOCKEY_BATTLE','WHEEL_OF_FORTUNE','TIME_BUZZER'],
];
```

Giochi di round oggi: `QUIZ`, `MUSIC`, `TIME_BUZZER`, `WHEEL_OF_FORTUNE`, `IMAGE_BLUR`, `TIMELINE`, `SPEED_RUSH`, `ARENA`, `AIR_HOCKEY_BATTLE` (**9**).

### 1.2 Cosa è già collegato

- Flusso admin: `ADMIN_NEXT_ROUND`, `ADMIN_SHOW_LEADERBOARD`, `ADMIN_TOGGLE_PAUSE`, `ADMIN_SHOW_DEMO`, `ADMIN_HIDE_DEMO` (admin → WebSocket → TV).
- Demo TV: overlay a schermo intero in `game-component.html` (~riga 197), video `/assets/demos/<tipo>.mp4`, `autoplay muted loop playsinline`, fallback se il file manca.
- Round simultanei: eventi `TIMELINE_RESULT`, `TIME_BUZZER_ANSWER`, `SPEED_RUSH_PROGRESS`, `AIR_HOCKEY_BATTLE_ANSWER` gestiti dalla TV.
- Basket: pagina `/basket` con canvas, 30 secondi, punteggio locale e record in `localStorage`.

### 1.3 Cosa non è collegato (verificato)

- **Bonus**: nessun `BONUS_RESULT`, nessun chiamante di `startBonusRound()`, la roulette non è in nessun mazzo, il basket non manda punti a classifica o WebSocket.
- **Video**: `apps/frontend/public/assets/demos/` contiene **solo** `README.md`; i dieci mp4 non esistono.
- **README_LAVORI.md** è indietro di un commit: dice "ultimo commit `9e1d023`" e "modifiche admin non committate", ma sono dentro `76a5cc2`.

### 1.4 Residui da ripulire (bassa priorità, non ora)

- Dal 6/11 `GameType.java` non ha più `CHRONO`, `TRUE_FALSE` e `ROULETTE`: restano solo i tipi giocabili (il Cavallo è un bonus, la Ultima spiaggia è un round vero).
- Esistono ancora `QuestionGeneratorService` e `CelebrityImageService` nel backend; verificare se sono codice morto prima di rimuoverli.
- Il backend ha ancora endpoint `price-answer` / `price/reveal` in `PartyGamesController` mentre il frontend ha sostituito Price con Time Buzzer.

---

## 2. Regole non negoziabili

- 4-10 squadre, **un telefono per squadra**, TV condivisa, tavoli fisicamente separati.
- Giochi **in parallelo**: mai turni che bloccano gli altri tavoli.
- Input: tap, swipe singolo, campo numerico. **Niente testo libero, niente disegno, niente microfono** (pub rumoroso).
- Round: 20-60 secondi, almeno 20 di gioco vero. Niente cerimonie lunghe.
- Contenuti **pre-generati** (JSON sul classpath). Nessuna AI a runtime.
- **Server autoritativo** dove c'è una soluzione: il telefono manda la scelta, il server valida, la TV applica.
- Punteggi **mai negativi** nei giochi nuovi; nei giochi esistenti non peggiorare.
- Funziona con **4 e con 10 squadre**.

---

## 3. P0 — Sei correzioni

### 3.1 Collegare i bonus (roulette e basket)

**Problema.** `startBonusRound()` non è chiamato; `ROULETTE` non è in nessun mazzo; `/basket` è una pagina isolata che non comunica con la partita. Oggi roulette e basket **non si giocano dentro la serata**.

**Fix.**

1. `startBonusRound(type: GameModeType = 'ROULETTE')`: imposta `nextRoundType` **senza incrementare `currentRound`** (deve restare com'è).
2. Evento unico `BONUS_RESULT { playerName, score }` inviato al WebSocket dal bonus; la TV lo riceve e lo applica alla classifica.
3. Premio **limitato e uguale per tutti i bonus**: ai primi tre classificati del bonus vanno **+300 / +150 / +75**; nessun punto negativo; il resto prende 0. Serve ad addolcire la classifica senza ribaltarla.
4. Rotazione decisa (un bonus per intervallo, **nessun round consumato**):

| Dopo l'atto | Bonus |
| --- | --- |
| 1 (round 8) | `ROULETTE` |
| 2 (round 16) | `BASKET` |
| 3 (round 24) | `DOPPIA_O_NIENTE` |
| 4 (round 32) | `TIRA_E_MOLLA` (collettivo, prima del finale) |
| 5 (round 40) | nessun bonus |

5. Admin: un comando per lanciare il bonus dell'intervallo, o automatico a `isActEnd()` con conferma. Il bonus **non deve partire** mentre la classifica è aperta o la partita è in pausa.

**Roulette.** Riusa la modalità esistente: ultima spiaggia su un colore, 20 secondi, +150 se indovini, 0 altrimenti. Non è un round e non tocca `currentRound`.

**Basket.** La pagina `/basket` va integrata: 30 secondi, tiri liberi, punteggio; alla fine manda `BONUS_RESULT` con nome squadra e punteggio **normalizzato** (es. `score/5` arrotondato, tetto 15) per evitare che un singolo bravo al basket valga più di un round. Il nome squadra va scelto all'inizio (o letto dal nickname) e verificato contro la classifica attiva.

**Attenzione di flusso.** Il basket è una pagina a sé: se il telefono è su `/play`, l'utente deve poterci arrivare senza perdere la sessione. Preferibile trasformarlo in una modalità `BONUS_BASKET` dentro il flusso remote; in alternativa, link diretto con `playerName` in query e ritorno a `/play` a fine bonus.

**Accettazione.**

- [ ] Dopo l'atto 1 l'admin lancia la roulette: la classifica cambia, il contatore round **non** cambia.
- [ ] Dopo l'atto 2 il basket assegna i tre premi senza sforare il tetto.
- [ ] `BONUS_RESULT` applicato **una sola volta** (idempotente).
- [ ] Nessun bonus parte durante pausa o classifica.

### 3.2 Bug Time Buzzer: chi non preme non viene eliminato

**Problema (verificato in `time-buzzer.mode.ts`, `revealManche`).** I risultati sono costruiti **solo** dai tentativi ricevuti (`this.guesses()`). Chi non preme non compare, quindi non viene né punito né eliminato: **conviene non premere**.

**Fix.**

- Prima di ordinare, aggiungi i giocatori ancora in gara che non hanno premuto:
  ```ts
  const missing = this.remaining().filter(
    (name) => !this.guesses().some((g) => g.playerName === name),
  );
  ```
  Assegna a ciascuno `ms = MANCHE_MS`, `error = MANCHE_MS`, `eliminated: true` (errore massimo).
- Ordinamento: errori crescenti; i "non premuti" finiscono in fondo e vengono eliminati per primi.
- Se restano meno di 3 squadre, `eliminateCount` deve essere 0 (non eliminare tutti).
- Opzionale: mostrare in TV "NON HA PREMUTO" accanto al nome.

**Accettazione.**

- [ ] Con 6 squadre, chi non preme mai è eliminato alla prima manche.
- [ ] Non è possibile vincere il Time Buzzer senza premere.
- [ ] Con 2 squadre rimaste il gioco finisce senza eliminazioni impossibili.

### 3.3 Finale debole

**Problema.** L'atto 5 finisce con `TIME_BUZZER`, un gioco calmo, non con l'Arena.

**Fix.** Nell'atto 5: `IMAGE_BLUR` (posizione 5) diventa `TIME_BUZZER`, e `TIME_BUZZER` (posizione 8) diventa `ARENA`. Risultato:

```ts
['QUIZ','TIMELINE','MUSIC','SPEED_RUSH','TIME_BUZZER','AIR_HOCKEY_BATTLE','WHEEL_OF_FORTUNE','ARENA']
```

**Accettazione.** L'ultimo round della serata è `ARENA`; nell'atto 5 `IMAGE_BLUR` non compare; nessuna modalità ripetuta due volte di fila.

### 3.4 Atto 1: due giochi a prenotazione di fila

**Problema.** Nell'atto 1 `WHEEL_OF_FORTUNE` (posizione 5) e `IMAGE_BLUR` (posizione 6) sono consecutivi; entrambi richiedono che l'admin giudichi a voce.

**Fix.** Scambia le posizioni 4 e 5 dell'atto 1:

```ts
['QUIZ','MUSIC','TIME_BUZZER','IMAGE_BLUR','WHEEL_OF_FORTUNE','TIMELINE','QUIZ','SPEED_RUSH']
```

**Accettazione.** Aggiungi un test che, per **tutti** gli atti, verifichi che due giochi "a prenotazione" non siano mai adiacenti. Insieme di prenotazione: `MUSIC`, `IMAGE_BLUR`, `WHEEL_OF_FORTUNE`.

### 3.5 Ruota e Air Hockey

**Ruota (`wheel-fortune.mode.ts`).**

- Oggi le lettere sono scelte per rarità ma con **scelta casuale tra pari rarità** (`pickNextLetterByRarity`), quindi la sequenza cambia a ogni partita. Rendi l'ordine **deterministico**: rarità, poi alfabetico; la stessa frase deve rivelare le stesse lettere nello stesso ordine.
- Riduci la frequenza da **5/40 a 3/40** (togli due occorrenze in eccesso dagli atti 2 e 4, sostituendole con giochi già presenti, senza creare adiacenze di prenotazione e senza duplicare tre volte lo stesso gioco nello stesso atto).
- Porta la modalità a due fasi come deciso: prima la ruota/lettere, poi la prenotazione e la risposta. Il timer attuale è 120 s: riducilo a 60-75 s.
- Correggi apostrofi e accenti nel confronto della frase (normalizza con `QuestionHistoryService.normalize` lato server, o equivalente lato client).

**Air Hockey (`air-hockey-battle.mode.ts`).**

- Oggi le domande sono **scritte nel codice** (`question('EASY', 'Quanto fa 2 + 2?', ...)`, riga ~58). Vanno pescate dalla banca con il campo `difficulty`, con un endpoint dedicato o con il pool esistente.
- La difficoltà deve crescere con il livello della partita (es. `EASY` → `MEDIUM` → `HARD`), non essere fissa.
- Frequenza: 3/40 (oggi 3, va bene, ma verifica le adiacenze con la nuova scaletta).
- Fallback: se la banca non ha domande per quella difficoltà, usa `QUIZ` di difficoltà vicina; se non c'è nulla, la modalità non viene estratta (mai un 500).

**Accettazione.**

- [ ] La ruota compare 3 volte su 40.
- [ ] La stessa frase produce sempre la stessa sequenza di lettere.
- [ ] Nessuna domanda hardcoded nell'Air Hockey: tutte dalla banca.
- [ ] Con la banca vuota l'Air Hockey non rompe la partita.

### 3.6 Carico sull'admin e durata

**Problema.** 14 round su 40 (`MUSIC`, `IMAGE_BLUR`, `WHEEL_OF_FORTUNE`) richiedono che l'admin giudichi a voce, oltre ai comandi manuali di flusso. Stima dell'utente: circa **2 ore e un quarto** a serata; ogni atto 25-30 minuti.

**Fix.** Conto alla rovescia automatico tra un round e l'altro, **fermabile dall'admin**:

- allo scadere del round parte un overlay "PROSSIMO ROUND TRA 10" e, a zero, `ADMIN_NEXT_ROUND` automatico;
- un'azione dell'admin (pausa, classifica, demo, stop) annulla il countdown;
- niente countdown durante classifica o pausa;
- il countdown non deve partire se il round è ancora in corso;
- opzione per disattivarlo (es. `autoAdvance = true` in `RoundManagerService`).

**Accettazione.**

- [ ] Un atto intero si può giocare senza toccare l'admin, tranne che per i giudizi.
- [ ] L'admin può fermare il countdown e riprenderlo.
- [ ] Nessun doppio avanzamento (round skippato) se l'admin clicca mentre il countdown è a zero.

---

## 4. P1 — Video esplicativi dei giochi

### 4.1 Cosa esiste già (verificato)

- Overlay TV a schermo intero: `game-component.html` ~riga 197, `@if (demoType(); as demo)`.
- Video: `<video src="/assets/demos/<tipo>.mp4" autoplay muted loop playsinline>`.
- Fallback se il file manca: orbe + "Demo video non ancora caricata".
- Admin: pulsante **DEMO GIOCO** → `ADMIN_SHOW_DEMO` con `type` = modalità corrente; **CHIUDI DEMO** → `ADMIN_HIDE_DEMO`.
- `apps/frontend/public/assets/demos/README.md` elenca i dieci file richiesti.
- **La cartella contiene solo il README: nessun video è presente.**

### 4.2 Specifica dei video

| Proprietà | Valore |
| --- | --- |
| Formato | H.264 `.mp4`, 1280×720 |
| Durata | 8-15 secondi, loop |
| Audio | **nessuno** (muto): la spiegazione la fa il presentatore |
| Contenuto | 3 battute: cosa vedi in TV → cosa fai sul telefono → come si vince |
| Testo | pochi caratteri, grandi, leggibili da 3-4 metri |
| Peso | ≤ 4 MB per file (sono serviti in locale, ma la TV non deve scattare) |

Nomi richiesti (minuscolo, come il tipo della modalità):

```text
quiz.mp4
music.mp4
image_blur.mp4
timeline.mp4
roulette.mp4
arena.mp4
speed_rush.mp4
time_buzzer.mp4
air_hockey_battle.mp4
wheel_of_fortune.mp4
```

### 4.3 Cosa manca oltre ai file

- **Pausa durante la demo**: verificare se aprire la demo ferma il round. Se non lo fa, mettere in pausa il gioco e riprendere alla chiusura: altrimenti i giocatori perdono secondi di gioco.
- **Precaricamento**: i video sono locali, ma conviene `preload="metadata"` e mostrare il fallback finché il primo frame non è pronto.
- **Demo automatica**: oggi la apre solo l'admin. Valutare (non obbligatorio) l'apertura automatica alla prima apparizione di una modalità nella serata, con chiusura dopo un loop o al tap dell'admin.
- **Stato della modalità**: se non c'è una modalità corrente, `type` cade su `QUIZ`; va bene, ma l'admin deve poter scegliere il tipo da mostrare (menu a tendina) per spiegare un gioco prima che compaia.

### 4.4 Accettazione

- [ ] Tutti e dieci i file esistono e partono muti, in loop, a schermo intero.
- [ ] Se un file manca, il fallback appare senza errori in console.
- [ ] Aprire e chiudere la demo non consuma il round e non lascia il timer bloccato.
- [ ] La demo si chiude dall'admin e (se implementato) al termine del loop.

---

## 5. P2 — Minigiochi bonus (tipo roulette e basket)

### 5.1 Regole comuni

- **Nessun round consumato**: il contatore resta fermo.
- Durata **20-40 secondi**, tutte le squadre insieme.
- Premio limitato: **+300 / +150 / +75** ai primi tre; nessun negativo.
- Un solo evento di risultato: `BONUS_RESULT { playerName, score }`.
- Idempotenza: lo stesso bonus non può pagare due volte.
- Se il bonus è collettivo, il premio va a tutte le squadre in proporzione al contributo, con tetto.

### 5.2 I cinque candidati

| Bonus | Meccanica | Tipo | Lavoro |
| --- | --- | --- | --- |
| **Roulette** | ultima spiaggia su un colore, 20 s | rischio | già pronto, da collegare |
| **Basket** | 30 s di tiri liberi sul telefono, canestro = punti | abilità | pagina esistente, da integrare |
| **Doppia o niente** | vedi una carta, scegli se la prossima è più alta o più bassa; ogni giusta raddoppia, un errore azzera, "INCASSA" in qualsiasi momento; la TV mostra chi è ancora in gioco | rischio e nervi | basso |
| **Tira e molla** | tutti i telefoni spingono insieme una barra contro il tempo; se il pub supera la soglia, tutti prendono punti e chi ha dato più colpi ne prende di più | cooperativo | basso, con tetto ai tocchi/secondo |
| **Gratta e vinci** | ogni squadra gratta una carta con premi nascosti (+100, +300, ruba punti alla squadra sopra); riusa l'effetto scratch del vinile | fortuna | basso-medio |

Riserve: **Continua la canzone** (riusa la Musica, l'admin giudica) e **Caccia all'oggetto** (l'admin chiama un oggetto, il primo tavolo che lo porta vince; serve un pulsante admin "assegna N punti a una squadra").

**Non** proporre Tap/Swipe: duplica lo Speed Rush. Memory: di riserva, assomiglia a una prova già presente.

### 5.3 Integrazione tecnica

1. `startBonusRound(type)` in `RoundManagerService`: accetta il tipo, non incrementa `currentRound`, salva `nextRoundType`.
2. L'admin lancia il bonus dell'intervallo (o parte da `isActEnd()` con conferma).
3. Il componente bonus manda `BONUS_RESULT` sul WebSocket; la TV lo applica via `LeaderboardService.addPoints` con il tetto dei tre premi.
4. Il bonus non deve partire durante pausa, classifica o demo.
5. Il bonus non deve poter essere lanciato due volte per lo stesso intervallo: memorizza l'ultimo intervallo servito.

### 5.4 Accettazione

- [ ] Roulette e Basket si giocano **dentro** la serata, non come pagine isolate.
- [ ] Il contatore dei 40 round non cambia dopo un bonus.
- [ ] I premi sono esattamente +300/+150/+75, una volta sola.
- [ ] Un bonus non parte se la partita è in pausa o la classifica è aperta.

---

## 6. P3 — Speed Rush: nuove microprove

Regole per sceglierle: **massimo 4 secondi**, un solo gesto, niente audio (pub), niente accelerometro (su iPhone chiede permesso), niente cultura generale (c'è l'Arena).

| Minigioco | Come funziona | Cosa mette alla prova |
| --- | --- | --- |
| **Smista** | una carta scorre, swipe a sinistra o destra per categoria (frutta/animale, caldo/freddo); 4 carte di fila | classificazione rapida |
| **Cosa è cambiato** | 4 emoji per 1,2 s, poi una è diversa: tocca la nuova | memoria visiva |
| **Completa la sequenza** | ▲■▲■? oppure 2-4-8-?, 3 opzioni | logica |
| **Tocca in ordine** | 5 numeri sparsi sullo schermo, tocca da 1 a 5 | ricerca visiva |
| **Tonalità** | griglia 3×3, un quadrato ha una sfumatura leggermente diversa | percezione |
| **Orologio** | quadrante analogico, scegli l'ora tra 3 opzioni | lettura rapida |
| **Freccia contro-senso** | freccia verde = swipe nella stessa direzione, rossa = in quella opposta | inibizione |
| **Lettera mancante** | `C_SA`, scegli la lettera (parole dalla banca o dai proverbi) | lingua |

Ordine di partenza: **Smista, Cosa è cambiato, Completa la sequenza, Tocca in ordine**.

**Bilanciamento.**

- Oggi ogni squadra pesca prove a caso: chi becca "tap" avanza più in fretta di chi becca "memoria" a parità di passo (9). Usa un **mazzo mescolato** con tutte le prove: ogni squadra le vede tutte, in ordine diverso.
- Con moltiplicatore ×3 o più, servi le varianti difficili (più opzioni, tempo di visione più corto): rischio contro premio.

**Accettazione.**

- [ ] Ogni squadra riceve tutte le prove, in ordine diverso.
- [ ] Una prova non dura più di 4 secondi.
- [ ] Nessun minigioco richiede audio, accelerometro o testo libero.
- [ ] Con moltiplicatore alto compaiono varianti difficili, non prove nuove.

---

## 7. P4 — Due giochi di round nuovi (opzionale)

Il catalogo di round è già a **nove** giochi. Aggiungerne due ha senso solo se aggiungono **un'emozione** che manca, non se sono varianti di quiz, arena o ruota.

Copertura attuale: conoscenza, riconoscimento visivo, riconoscimento uditivo, parola, ordinamento, velocità, rischio.

Buchi plausibili: **stima/senso comune**, **attenzione/memoria**, **cooperazione**, **sorpresa/umorismo**. Attenzione: i tavoli sono separati, quindi niente giochi che richiedano discussione tra squadre.

Se l'utente chiede di procedere, produci:

1. **5-6 candidati**, ognuno con pitch di una riga, input, contenuti, costo e rischio.
2. **Griglia di valutazione** (voti 1-5, pesi): unicità ×3, aderenza al pub ×3, semplicità di input ×2, riuso tecnico ×2, costo contenuti ×1, tenuta ×2, scalabilità ×1.
3. **Due raccomandati** con specifica implementabile: regole, fasi e durate, punteggio, schema della banca, payload TV/telefono, endpoint, UI, fallback.
4. **Una sola domanda** all'utente con la coppia proposta, prima di scrivere codice.

Vincoli: niente microfono, niente testo libero, niente disegno, niente giochi a turni, niente soluzioni visibili ai telefoni prima del reveal.

Nota: `QUANTO COSTA?` era in valutazione ed è stato sostituito da Time Buzzer nel commit `9e1d023`; non riproporlo identico senza una ragione nuova.

---

## 8. Test e comandi

```bash
# backend (JDK 25 obbligatorio)
cd apps/backend && ./mvnw -B clean package

# frontend
cd apps/frontend && npm run build
```

Verifiche minime prima di dichiarare finito un punto:

1. Build verde di backend e frontend.
2. Un giro completo di 40 round con le nuove scalette: nessun crash, nessuna modalità due volte di fila, Arena ultima.
3. Time Buzzer: 6 squadre, una non preme mai → eliminata alla prima manche.
4. Bonus: lanciato dopo l'atto 1, classifica aggiornata, contatore fermo, premio una volta sola.
5. Demo: apri/chiudi, il timer del round non si perde.
6. Nessuna chiamata esterna durante la partita.

Test da riga di comando utili:

```bash
python scripts/checks/simulate_arena.py http://<ip>:8080 10 3 --prepare
python scripts/checks/arena_check.py <url> <categoria> <n>
python scripts/checks/rounds_check.py <url>
```

Se un test non è eseguibile (manca backend, mancano telefoni, mancano video), **dichiaralo**: non dire "testato" per qualcosa che hai solo compilato.

---

## 9. Stile e consegna

- Commenti e commit in **italiano**, conventional commits (`feat:`, `fix:`, `chore:`).
- Un commit per correzione P0, uno per i video, uno per i bonus, uno per Speed Rush.
- Non toccare `.env`, non committare segreti, non aggiungere dipendenze senza necessità.
- Aggiorna `README_LAVORI.md` (oggi fermo a `9e1d023`) con: commit attuale, scaletta a 40 round, stato dei bonus, stato delle demo, cosa è stato verificato dal vivo e cosa no.
- Riepilogo finale: cosa hai fatto, file toccati, test eseguiti con esito, test non eseguiti e perché.
