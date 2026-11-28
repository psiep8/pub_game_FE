# quizzOne 3.2 — Fix dopo la seconda serata (v2, aggiornato al 27/11)

Riferimento: `main` a `1ace6a43` (27/11 10:17, unione #9). Ho letto il commit, la sua descrizione e il registro **`docs/ROADMAP-SECONDA-SERATA.md`**. Non ho eseguito il codice: lo stato viene dal registro dell'AI.
**Questo file va copiato nella radice del repo** (il registro dice che il precedente non era nel repository): `FIX-SECONDA-SERATA-2026-11-27.md`.

## Stato al 27/11

| Blocco | Stato |
|---|---|
| **A** N-01 aggancio regia, N-02 pulsante unico e dock nascosta, N-03 Indovina chi manche 2-3, N-04 Cavallo per squadra, N-05 blocco a round chiuso, N-06 reset iPhone, N-08 vibrazione/flash | **Fatti** (con E2E Playwright TV + 3 telefoni per N-03, N-04, N-05). Non rifarli. |
| **A** N-07 tic infinito | **Da fare**: nessuna causa trovata (il registro lo dice onestamente). |
| **A** N-09 Karaoke | **Parziale**: c'è `npm run check:karaoke` (64 brani, 29 con testi completi). Mancano banner in lobby e prova `?karaoke-demo=1`. |
| **Musica** (4 round × 5 manche, 10 temi, audio pulito, 236 brani) | **Implementato** nell'unione #9. Restano verifiche e rifiniture: sezione F. |
| **B** N-10…N-15, **C** N-16…N-48, **D** N-49…N-51, **E** N-52…N-55 | **Da fare**. |
| **D2** Timeline (atti 2/4/5 e gioco al posto dell'atto 1) | **Sospesa**, serve la mia scelta. |
| `audit-banche --ci` | **Fallisce**: Musica «251 brani con 5 campi/file mancanti» (vedi M-01). |

## Regole di lavoro

1. **Un fix = un commit** (anche un solo gioco, un solo sintomo), messaggio `fix|feat(<area>): <cosa> [N-xx]`, con test. Push dopo ogni commit se il flusso lo prevede; nessun tag.
2. **Fix a fondo, non di superficie.** Per ogni voce: cerca la **causa**, scrivila nel registro (`docs/ROADMAP-SECONDA-SERATA.md`, già avviato: continua lì), correggi la causa, non il sintomo.
3. **Importante, lezione della prima serata:** F-22 (scoppio Bomba) e F-31 (riepilogo Speed Rush) risultavano «Fatto» nel registro con test verdi, ma **in serata non c'erano**. I test unitari non bastano: per ogni voce segnata sotto come **[RIAPERTA]** scrivi un **test guidato dalla UI vera** (Playwright: **usa il banco già presente** `e2e/tv-telefoni.spec.ts`, TV + 3 telefoni contro il backend reale, porte isolate) che riproduce il sintomo e fallisce prima del fix.
4. **Prova con tante squadre** per tutto ciò che mostra elenchi: 4, 8, 10, 14 e 20 squadre (`scripts/sim`).
5. Tutto ciò che cambia punteggi o regole: aggiorna `scoring-rules.ts`, manuale, demo, PDF, `PUNTEGGI-MASSIMI-MINIMI.md`, README, CHANGELOG **nello stesso gruppo di commit** (test di coerenza verde).
6. Alla fine, tabella: voce | stato | causa trovata | commit | test | cosa provare in sala.

**Ordine:** chiudi il blocco A (N-07, N-09) → F (rifiniture Musica) → B → C → D → E. Dopo ogni blocco, suite + simulazione 40+5.

---

## Decisioni mie, da confermare

| # | Questione | Proposta (l'AI usa questa se non cambio) |
|---|---|---|
| **D1** | **Quiz a 4 manche**: nel manuale statico c'è «fino a 1500 per round», nel codice (`scoring-rules.ts`) «1000 in tre manche». Incoerenti. | **±1000 per round**, come deciso. Quota per manche = `round10(1000 × peso / somma pesi)` con pesi Facile 1, Media 2, Difficile 3. Es. mix 3F+1M → 200/200/200/400; 1F+2M+1D → 100/200/200/300 ... (somma 1000). Ogni manche 15 s, quota scalata col tempo, sbagliata toglie la stessa quota scalata. 4 manche × 15 s = 60 s. |
| **D2 (ancora aperta)** | **Timeline**: oggi è in 3 round (atti 1, 2, 4), tu scrivi «due volte, induce all'errore» e «quarto atto a 6 opzioni, quinto a 8». | Timeline in **atto 2 (4 eventi), atto 4 (6), atto 5 (8)**; **via dall'atto 1**, al suo posto Quiz o altro gioco: dimmi quale. *Va bene?* |
| **D3** | **Arena: punteggio.** Tu proponi solo +10/−10 per risposta. | **Sono d'accordo**: via i punti di piazzamento (+1000/+500, −300): chi parte primo ha già più possibilità. Resta solo ±10 per risposta. |
| **D4** | **Azzardo**: regola di «copertura» (vedi N-31). | Vedi sotto: moltiplicatore sulle vincite in base a quante risposte copri. |
| **D5** | **Indovina chi**: 4 manche × ±500 = ±2000 per round, 3 round in serata. | Come scritto. Nota: 3 round × 4 manche × 60 s ≈ 12 minuti + intro: il gioco pesa molto in serata. |

---

# A. Rompono la serata (da fare per primi)







### N-07 Rumore costante «tiktiktik» per tutta la partita — **DA FARE** (registro: nessuna causa trovata)
Cerca la fonte di un **tic infinito** (tick del conto alla rovescia, battito o suono di timer che non si ferma).
1. Con il gestore audio a canali (`?audiodebug=1`) esegui una serata simulata nel browser, **campionando ogni 5 s** quali sorgenti sono attive; fallisce il test se un loop «tick» resta attivo fuori da un conto alla rovescia.
2. Ogni tick appartiene a un proprietario (round/fase) e **si ferma** alla chiusura, alla pausa, al cambio e alla ricarica.
3. Riporta la causa trovata.


### N-09 Karaoke — **PARZIALE** (resta: banner lobby + `?karaoke-demo=1` + giro completo)
1. **Controllo preliminare**: script `npm run check:karaoke` che verifica clip, testi e sincronizzazione e **fallisce con messaggio chiaro** se manca qualcosa.
2. **Banner nella lobby di regia**: «Karaoke: N canzoni pronte su 5» (verde/rosso). Se mancano i testi, il bonus si **sostituisce o si salta in automatico**: mai partire rotto.
3. **Modalità prova** (`?karaoke-demo=1`) con testi **finti** e una clip di prova per percorrere tutto il flusso: stop, silenzio, prenotazione, CORRETTO, SBAGLIATO, riapertura, pausa, ricarica.
4. Fai **tu il giro completo** in questa modalità e correggi ciò che non va; poi la lista di ciò che resta da provare con i testi veri.

---

# B. Flusso, ritmo, riepiloghi

### N-10 Ingressi a scatti (`#ENTR`): causa comune
Sintomi in quasi tutti i giochi: **scatto brutto** all'entrata, poi la domanda **appare laggata, si stringe, poi riappare**; la card «corretto/sbagliato» entra con **uno scatto enorme**.
1. **Causa probabile: cambi di layout dopo la comparsa** (la card cambia dimensione quando entrano le opzioni, il componente si rimonta, i font/immagini arrivano dopo). Verificalo con `PerformanceObserver('layout-shift')` e `longtask`.
2. Regole: layout **finale riservato prima** dell'animazione; animare solo `transform`/`opacity`; nessun rimontaggio del componente durante la scena; **precarica e decodifica** font e immagini prima di mostrarli; niente `backdrop-filter`/`filter` su elementi grandi; promuovi a livello compositing **prima** dell'inizio.
3. Un solo componente **`FeedbackCard`** (corretto/sbagliato/esito) per tutta l'app, con entrata fluida a scala+dissolvenza e un breve respiro.
4. **Criterio di fine, misurabile:** per ogni gioco con `#ENTR` (Quiz, Indovina chi, Timeline, Ruota, Time Buzzer, Bomba, Speed Rush, Azzardo, Ultima spiaggia, Biglie, Cavallo): **layout shift = 0** durante l'entrata e **nessun frame oltre 50 ms** a 1280×720 con CPU 4× (budget **N-10b**). Tabella prima/dopo (`frame-budget.mjs` esteso a tutti i giochi).
5. Un commit per causa e uno per gioco dove serve.

### N-11 Riepiloghi dei giochi: componente unico
Mancano in **Arena** e **Speed Rush** [RIAPERTA]; in altri la ripartenza è troppo breve; in altri è ridondante.
1. **Tabella** (riportala): per ognuno dei 14 giochi, riepilogo sì/no, durata, quando riparte. Decidi dove serve di più.
2. **`RoundRecap` condiviso**: riepilogo a classifica dei **punti guadagnati o persi in quel round** (non delle singole risposte), per i giochi con punteggi multipli o più manche.
3. **Molte squadre:** mostra a **pagine** di 6–8 righe, ognuna ferma 3 s con **dissolvenza**; l'ordine è dal peggiore al migliore con suspense, oppure «escono gli ultimi, entrano i migliori»; ultima pagina: podio. A 4–10 squadre una pagina sola.
4. **Durate minime** (in `tv-timing.ts`): riepilogo di round 8–12 s (+ pagine), poi **respiro**, poi il prossimo. In ogni caso **mai meno di 30 s** prima del round successivo (F-12) nei giochi dove c'è il riepilogo.
5. Test UI con 4, 8, 10, 14, 20 squadre, ogni gioco.

### N-12 Ritmo generale e manche
- **Fra una manche e l'altra:** respiro di **almeno 4–5 s** con la nuova domanda/soggetto **visibile e leggibile**, **niente countdown 3-2-1** (quello resta solo a inizio round). Applica a Quiz, Indovina chi, Ruota, Time Buzzer, Azzardo, Biglie.
- Scandire ogni round con pause giuste per il pubblico e per il presentatore: tutte le durate in `tv-timing.ts`, con tabella nel registro.

### N-13 Primo round sfalsato e prima classifica mancante
1. Il primo round è **sfalsato per le connessioni**: aspetta tutti i telefoni (o un timeout) prima di aprire il primo round e sincronizza i tempi col **server** (scadenza assoluta, non locale).
2. **La classifica rapida del round 4 non è uscita** [RIAPERTA]: riproduci (potrebbe dipendere da bonus nello stesso slot, dalla pausa, dal round contato male) e correggi con test UI sull'intera atto 1.

### N-14 Barra del tempo del Quiz
La barra della TV **non coincide con la fine reale**: sui telefoni si stacca prima che la barra finisca. Tutte le barre (TV e telefoni) devono derivare dalla **stessa scadenza del server**, con correzione dello scarto d'orologio; test: a ±200 ms barra TV e telefono finiscono insieme.

### N-15 Classifiche: flash, variante dopo le Arene, finale
1. **Flash** (round 4, 12, 20, 28, 36): **troppo rapida**. Più suspense: entrata dal peggiore al migliore con piccole pause, **sospiro prima del podio**. Con **più di 10 squadre**: finestra a scorrimento (entrano le nuove, escono le vecchie) o pagine; riporta cosa hai scelto con 14 e 20 squadre.
2. **Classifica «da film» dopo le Arene (round 24 e 40)**, molto più lenta: pausa, **preavvisi** («Tra poco…»), grafica scenografica da titoli di coda, che mostra **piano piano dal peggiore**, ogni squadra con le sue **statistiche**: **performance migliore e peggiore** (round e punti), **più grande rimonta**, **più punti in un solo gioco**, **gioco più forte** e **più debole**, ecc. Servono i **punti per round e per squadra** salvati dal server: verifica che ci siano.
3. **Statistiche per il presentatore** (in regia, una pagina): curiosità per far ridere («la squadra più sfortunata», «il re del Time Buzzer», «ha perso più punti con la Bomba»…).
4. **Dopo il 40° round:** dal **5° posto in poi**, **colpi di scena a TV** (effetti di sparo/coriandoli + suono), perché la sala urli e il presentatore possa «avallare» la TV (pulsante «AVANZA» in regia).
5. **Dopo i premi: selfie di tavolo e poster** (N-33).

---

# C. Giochi

### Quiz
- **N-16 Riepilogo a classifica:** punti effettivamente vinti/persi nel round, non risposta per risposta (con più di 5–6 squadre non regge). **A TV solo la risposta esatta**, non le errate votate.
- **N-17 4 manche, 60 secondi reali** (D1): una domanda in più per round, punteggi riallineati, manuale e `scoring-rules.ts` corretti (la riga «fino a 1500» sparisce).
- **N-18** Il respiro fra manche (N-12) e la barra del tempo (N-14).

### Indovina chi
- **N-19** Bug delle manche 2 e 3: N-03.
- **N-20 Categorie sbagliate:** è uscita **Beyoncé** nella prima manche (storia/letteratura). Aggiungi all'audit: ogni persona ha **un solo ambito primario**, e la manche 1 estrae **solo** persone dell'ambito 1. Ricontrolla l'intera banca con Wikidata (occupazione prevalente) e produci la lista delle incoerenze.
- **N-21 Quattro manche per round:** 1) arte, letteratura, storia, scienza; 2) musica; 3) cinema, TV, spettacolo, attualità; 4) sport, motori. **±500 per manche** ×tempo, round **da −2000 a +2000** (D5). Banca: dimmi quante persone per ambito, almeno **60 per ambito** per 3 serate senza ripetizioni.
- **N-22 Indizi di qualità (decisivo):** ieri indizi **uguali all'inizio**, poi sulla **data di nascita**. Voglio indizi **rilevanti**: vita, carriera, biografia, eventi importanti.
  1. Regole nell'audit: **al massimo un indizio anagrafico** (data o luogo di nascita) per persona, mai nei primi due; i 4 indizi di **tipi diversi** (es.: ambito e epoca → contesto/nazionalità → opera o evento celebre → aneddoto o anno preciso).
  2. Vietati gli indizi con struttura identica fra persone nello stesso round.
  3. Rigenera con fonti (Wikidata/Wikipedia), poi **campione di 30 da rivedere** in `docs/DOMANDE-DA-REVISIONARE.md`.

### Timeline
- **N-23** Posizionamento e opzioni crescenti (D2): atto 2 → 4 eventi, atto 4 → 6, atto 5 → 8; aggiorna round managing, punteggi (max/min per numero di eventi), manuale e demo.
- **N-24** **In una partita non sono uscite le opzioni, in un'altra sì:** riproduci (condizione di gara all'entrata, ordine degli eventi STOMP, ricarica) con test UI.
- **N-25** Riepilogo ridisegnato, pagina unica o a pagine con tante squadre (N-11).

### Ruota della fortuna
- **N-26** **Due manche per round, due proverbi, ±500 per manche** (round ±1000), sempre moltiplicati per il tempo. Verifica che la banca basti senza ripetizioni (4 proverbi in 2 round), tempi e respiro fra manche.

### Time Buzzer
- **N-27** Il **tempo compare sui telefoni prima che sullo schermo**: il bersaglio si mostra **prima in TV**, e sul telefono solo dopo (o con lo stesso istante `showAt` dal server, con scarto ≤ 100 ms).
- **N-28 Riepilogo di ogni manche**: dal peggiore al migliore, **man mano**, con suspense; con tante squadre a pagine (N-11).

### Bomba
- **N-29 Banca troppo facile** (tutti bravi): **difficoltà crescente** nei due round; formato positivo («quali di questi…?») ma con **elementi sbagliati più sottili** (quasi giusti), argomenti meno comuni; audit con fascia di difficoltà per argomento e round 2 più difficile del 1.
- **N-30 Nessuno scoppio a TV e telefono** (audio e visivo) [RIAPERTA, F-22]: riproduci con test UI; controlla `prefers-reduced-motion`, audio non sbloccato, ordine eventi, canale audio. Scoppio **a tutto schermo e con suono** su telefono e TV.
- **N-31 Bombe rimaste non esplose** a fine round (tutti bravi): **nessuno deve perdere punti per essere capitato su una bomba per costrizione**. Regola: una squadra perde punti **solo se sceglie una bomba avendo almeno una casella sicura disponibile**; se restano solo bombe, il round finisce e le bombe vengono **disinnescate** (festa, nessun malus). Leggi `BombaService`, descrivi il comportamento attuale e correggi.
- **N-32** Controllo del riepilogo (N-11).

### Speed Rush
- **N-33** **Entrata migliore**, e niente **schermata bianca** in attesa della gara.
- **N-34 Ripetizioni fra round** di bandiere e proverbi già usciti (varietà ottima): **banca più ampia** o pescaggio a rotazione; **zero ripetizioni nella serata** e, per quanto possibile, fra serate (storico).
- **N-35 Riepilogo mancante** [RIAPERTA, F-31].

### Azzardo
- **N-36** **8 manche** (2 storia, 2 geografia, 2 musica, 2 celebrità), aggiorna banca (almeno 3 serate senza ripetizioni), tempi (30 s a manche), tetti: **mantieni i tetti di round già decisi (+1500/−1000)** e ricalcola quelli per manche.
- **N-37** **Non mostrare a TV le fiches delle opzioni scelte** (induce a seguire la maggioranza).
- **N-38 Nuova logica (D4):** ogni round **vanno puntate tutte le fiches del salvadanaio** (nessuno punta zero): se restano fiches non puntate, valgono come **perse**. **Chi punta lo stesso numero su tutte le risposte è penalizzato**: moltiplicatore sulle vincite in base a quante risposte copri: **1 risposta ×1,0 · 2 ×0,75 · 3 ×0,5 · 4 ×0,25**, le perdite non cambiano. Telefono con un contatore «Fiches da puntare: N», indicatore di copertura e messaggio «Scegli almeno una risposta su cui puntare di più». Simula con 10 000 puntate casuali e riportami il valore atteso per strategia (tutto su una, 2+2+3+3, uniforme) per mostrare che il puntare uniforme non conviene.
- **N-39** **Descrizione del gioco approfondita** (come funziona, fiches, punti, penalità) per tutti: demo e manuale; testata a 3 m.
- **N-40** Riepilogo per round e finale buoni: provare con tantissime squadre.

### Ultima spiaggia
- **N-41** **Penalità uguale al premio:** ±500, ±400, ±300, ±200, ±100 secondo il livello (errore e mancata risposta: **−il valore del livello**, non la metà). Aggiorna regola, manuale, demo e test.
- **N-42** **Un round non si è giocato** (4 su 5): trova la causa nella scaletta/stato (round saltato? bonus nello stesso slot? pescaggio fallito?).
- **N-43** **Qualche giocatore non ha potuto rispondere** al telefono: riproduci (livello scelto, sessione scaduta, bottoni disabilitati) con test UI e 6+ telefoni.
- **N-44** Riepilogo buono, con tante squadre (N-11).

### Biglie
- **N-45** Entrata troppo breve; riepilogo con tante squadre; la **percentuale di corsa in alto** mostra solo le **prime 6** se le squadre sono molte.

### Arena
- **N-46 Remoto:** «riconnessione» che compare come un **flash in alto** a caso; **caricamento lungo tra una domanda e l'altra**. Precarica la domanda seguente, evita rerender pieni, distingui i veri distacchi da quelli finti, tempi misurati.
- **N-47 Salti proporzionali alla posizione** (d = distanza dal centro, 0 = centro, 1 = bordo). Proposta: **avanti = F × (0,6 + 0,8·d)** (più lontano, salto in avanti più lungo), **indietro = B × (1,4 − 0,8·d)** (più lontano, salto indietro più piccolo; vicino al centro il balzo indietro è più grande e quello in avanti più piccolo). Riporta i valori F e B attuali, simula 10 000 partite con una squadra al 50%, 60% e 70% di risposte giuste e mostra: probabilità di arrivare al centro, di restare nel cerchio, tempo medio. Voglio che sia **più difficile restare e raggiungere il centro**, ma **più facile recuperare per chi sta perdendo**.
- **N-48 Punteggio (D3):** solo **±10 a risposta**, via piazzamento; riepilogo con **punteggio finale chiaro**, specie al **40° round**.

---

# D. Bonus

### N-49 Casino
Ottimo in entrambi i bonus. **Riapri:** **suono della pallina che gira** e **della pallina che si posa** sono **scomparsi** [RIAPERTA, F-34]. Test UI con audio attivo e controllo dei canali; riepiloghi (N-11).

### N-50 Blackjack
Okay: nessuna modifica, solo il riepilogo.

### N-51 Cavallo
N-04, più **ingresso secco**: serve un'**attesa e un'entrata** dedicate (N-10).

---

# E. Novità grandi

### N-52 Selfie dei tavoli e poster
**Dopo i premi**, ogni squadra scatta un **selfie del proprio tavolo** dal telefono; le foto finiscono in un **poster** della serata.
1. **Telefono:** `<input type="file" accept="image/*" capture="user">` (funziona su LAN in **HTTP**, a differenza di `getUserMedia` che richiede HTTPS). Comprimi a ~1600 px lato lungo prima dell'invio.
2. **Backend:** salva le foto in un volume locale (`photos/<partita>/<squadra>.jpg`), limite di dimensione, una foto per squadra (si può rifare), eliminazione dalla regia.
3. **Poster:** pagina in regia che compone un **collage** (griglia con nome squadra, punteggio finale, posizione, data e titolo «quizzOne»), esportabile in **PNG/PDF A3** (canvas nel browser o server).
4. **Privacy:** le foto restano sul PC della serata, mai pubblicate; avviso chiaro sul telefono; pulsante «cancella tutte le foto» in regia.
5. TV: schermata «SELFIE TIME» con le foto che compaiono man mano.

### N-53 Demo: refactoring completo
Sono ancora **brutte e poco chiare**. Non rifare altro lavoro a caso:
1. **Una sola demo, per il Quiz, rifatta bene**, e **fermati per farmela approvare** con le catture a 1920×1080 e 1280×720.
2. Modello: **3 schede automatiche da 6 s** per gioco: **OBIETTIVO** (una frase + icona), **COME SI GIOCA** (3 passaggi numerati con un mini-esempio animato), **PUNTI** (tabella grande letta da `scoring-rules.ts`). Testi ≥ 28 px, 1 idea per scheda, movimento sobrio, nessun testo fuori area.
3. Solo dopo l'ok, applicala a tutti i giochi; il presentatore ha avanti/indietro/ripeti.

### N-54 Temi Gold, Black, K-pop
Ricontrolla **TV e telefono** per **contrasto** (anche negli altri temi). Test automatico che calcola il contrasto di testo e sfondo (≥ 4,5:1, ≥ 3:1 per testi grandi) sulle schermate principali per ogni tema; lista dei punti fuori soglia e correzioni.

### N-55 Gadget post-serata (anche scemenze)
Idee per le squadre: lista in chat; nessun lavoro per l'AI, salvo il **diploma/pergamena stampabile** per ogni squadra (N-52 poster) se vuoi.

---

# F. Musica: già in main, ora si verifica e si rifinisce

L'unione #9 ha implementato la nuova Musica: **4 round per partita, 5 manche per round, un tema per round** (10 temi estratti a bolle), ascolto 1 = 4 s, prenotazione 5 s, ascolto 2 = 12 s da zero, reveal 8 s, **audio pulito** (niente pitch, ring, stutter), **+200 / +100, malus −50 al secondo ascolto**, round da 1000 e partita da 4000, tema e brani nello stato della partita (`MusicRoundService`), 236 brani, `cleanValue` ricorsivo.
**Non va rimesso in discussione.** Questo è l'elenco di ciò che resta (un commit ciascuno).

### M-01 `audit-banche --ci` fallisce (Musica) — **per primo**
«251 brani con 5 campi/file mancanti» contro i 236 dichiarati nel commit. Trova quali sono (campi, file `.m4a` assenti o sotto i 3 KB), correggi **con gli script** (`generate_media.py` + adder, `tagga-musica.mjs`; mai a mano `media-it.json`) o scarta i brani non esponibili e riportali. Il generatore deve **fallire** se un brano ha tema o decennio mancante o se un tema non regge **5 brani con mix 2 hit + 2 medi + 1 difficile e artisti distinti**. L'audit torna verde.

### M-02 Brani del Karaoke fuori dalla Musica
I brani scelti per il bonus «Canta la canzone» **non devono mai comparire nei round Musica**. Verifica che la banca Karaoke (64 brani) e quella Musica (236) siano disgiunte per i brani usati nel bonus (campo `riservata_bonus` o equivalente) e aggiungi un test su 40 round simulati.

### M-03 Prova punto per punto del «Definition of done»
Scrivi nel registro una **tabella** con la prova di ogni requisito: il secondo ascolto riparte da zero e arriva a 12 s; alla fine della quinta manche il round si chiude (nessun sesto brano); nessun artista due volte nel round; **nessun tema ripetuto nei 4 round e nessun brano ripetuto nella partita**; sbagliare al primo ascolto non toglie punti; dopo un **refresh o una pausa a metà round** si riprende dalla manche e dall'ascolto giusti; **nessuna soluzione (titolo, artista, `previewUrl`, anche in `songs[]`) è leggibile nel payload WebSocket dei telefoni** (test sul payload reale, non a occhio). E2E TV + 3 telefoni per un round intero di Musica (era già stato corretto «la ripresa con payload doppio-encodato»: includilo).

### M-04 Scaletta e tempi
Musica compare **4 volte** (atti 1, 2, 4, 5): 4 round ≈ 2'50" ciascuno. Controlla che il tempo totale della serata con la nuova Musica, le classifiche, i 5 bonus e il Karaoke resti ragionevole (riporta una stima in minuti per atto). Se non regge, **si toglie un round alla scaletta, non si riducono le manche** (regola del committente).

### M-05 I 4 secondi del primo ascolto
Le anteprime da 30 s partono da `currentTime = 0`: con un'introduzione lenta o silenziosa, 4 secondi sono «buttati». Aggiungi un campo opzionale **`startAt`** per brano (default 0) e uno script (`ffmpeg silencedetect`, già usato dai test di volume) che segnala i brani con **più di 1 s di silenzio iniziale** o un'intro senza voce riconoscibile: propone un `startAt` e li mette in una lista **da ascoltare a mano** (`docs/DOMANDE-DA-REVISIONARE.md`). Mai effetti sull'audio: solo il punto di partenza.

### M-06 Rifiniture di gioco
1. **Nessun buco** fra un ascolto e l'altro e fra una manche e l'altra (preload verificato con la tabella dei tempi reali, a 4× di CPU).
2. Le etichette in TV in mono: «Round 2 · manche 3 di 5 · 1° ascolto · 200 punti», con il valore che scende **200 → 100** e il **rullo dei temi** che si ferma su quello del payload.
3. **Riepilogo del round** (vedi N-11): punti guadagnati e persi per squadra nel round, con tante squadre a pagine.
4. **Nomi nei documenti:** il prompt originale parlava di «PubGame»: nei manuali, demo e PDF il nome è **quizzOne**; controlla che la Musica non ne abbia lasciati.
5. Manuale, demo (solo alla prima apparizione) e `PUNTEGGI-MASSIMI-MINIMI.md`: «4 round × 5 manche, massimo 4000 a partita; malus −50 solo al secondo ascolto».

### M-07 Prova in sala (da annotare, non è codice)
Volume di sala a 4 s e a 12 s; quanto si riconoscono i brani «hit» / «medi» / «difficili» al primo ascolto; se 4 s bastano o servono 5; se la prenotazione di 5 s è giusta con 10 squadre. Gli intervalli stanno in `game-timings.ts`: **cambiabili in un solo punto**.

---

## Comando da dare all'AI

```
Leggi FIX-SECONDA-SERATA-2026-11-27.md nella radice del repo (copialo lì) e docs/ROADMAP-SECONDA-SERATA.md. Il blocco A è quasi chiuso e la nuova Musica è già in main (unione #9): NON rifarli e NON rimettere in discussione la struttura della Musica (4 round x 5 manche, 4 s / 12 s puliti, +200/+100/-50). REGOLA FERREA: un fix = un commit con test, messaggio "fix|feat(<area>): <cosa> [N-xx|M-xx]"; cerca e riporta la CAUSA nel registro docs/ROADMAP-SECONDA-SERATA.md; nessun tag. Per le voci [RIAPERTE] (scoppio Bomba, riepilogo Speed Rush, classifica rapida al round 4, suono pallina del Casino) scrivi PRIMA un test con il banco Playwright già presente (e2e/tv-telefoni.spec.ts, TV + 3 telefoni, backend reale) che fallisce, poi correggi. Prova con 4, 8, 10, 14 e 20 squadre tutto ciò che mostra elenchi. ORDINE: (1) M-01: l'audit-banche --ci oggi FALLISCE (Musica, 251 brani con 5 campi o file mancanti): trovali, correggili con gli script (mai a mano media-it.json) o scartali e riportali; (2) N-07 (tic infinito): campiona ogni 5 s le sorgenti audio attive in una serata simulata nel browser reale e riporta la causa; (3) N-09: banner in lobby del Karaoke e giro completo con ?karaoke-demo=1; (4) M-02…M-06 (Musica: brani del Karaoke esclusi, tabella di prova del definition of done, stima dei tempi per atto, startAt per i primi 4 secondi, rifiniture, nome quizzOne nei documenti); (5) blocco B (N-10…N-15), poi C, D, E. Per N-53 fai SOLO la demo del Quiz e FERMATI per farmela approvare. D2 (Timeline e gioco dell'atto 1) resta sospesa: non toccare la scaletta e chiedimelo. Aggiorna manuali, demo, PDF, scoring-rules.ts, PUNTEGGI-MASSIMI-MINIMI.md, README e CHANGELOG nello stesso gruppo di commit di ogni cambio di regole. Dopo ogni blocco: suite frontend e backend, build, audit-banche --ci, test:sim e Playwright. Alla fine la tabella: voce | stato | causa | commit | test | cosa provare in sala.
```
