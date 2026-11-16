# Giro di prova su device — F02, F01, F13, F12, F09

Una sola sessione con TV e due telefoni, 45–60 minuti (70 con la prova F09). Serve a chiudere ciò che
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

---

## 2. F02 — Rientro del telefono (15 minuti)

Per ogni prova: sul telefono interessato, ricaricare la pagina **dal browser**
(⟳), non rientrare dalla Home. Aspettare 3 secondi e guardare cosa c'è a schermo.

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

Da guardare in ogni prova: la TV non deve ricevere due volte la stessa risposta o
lo stesso ordine Timeline, e la classifica non deve cambiare dopo un refresh del
telefono.

---

## 3. F01 — Ingresso su iPhone/Safari (5 minuti)

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

## 4. F13 — CORS e origini reali (10 minuti)

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

## 5. F12 — Diagnosi del tema TV (10 minuti)

Serve un round chiuso con punti a una sola squadra, poi uno con pari merito.

| # | Prova | Cosa deve succedere | Esito | Note |
|---|---|---|---|---|
| T1 | Chiudi un round con una squadra nettamente prima | TV: il colore/etichetta della squadra vincente si vede già dalla schermata di chiusura e resta fino al round dopo | | |
| T2 | Chiedere a due persone dal fondo sala: «di che colore era il tema?» | Entrambe nominano la squadra vincente, senza suggerimenti | | |
| T3 | Telefono della squadra vincente e di un'altra | Coerenti con la TV (o differenza voluta e documentata) | | |
| T4 | Round con pari merito | Comportamento concordato: nessun tema, o tema condiviso, ma deciso e dichiarato | | |
| T5 | Round senza punti (nessuno vince) | Nessun tema assegnato per errore | | |
| T6 | Foto della TV a 720p e a 1080p | Consegna: due foto dei casi T1 e T4 | | |

Per T2 non spiegare prima cosa guardare: la percezione è il dato.

---

## 6. F09 — Classifica rapida su TV vera (10–15 minuti)

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

## 7. Formato di esito per la roadmap

Per ogni voce toccata (F01, F02, F12, F13, F09) riportare **quattro campi**, con lo
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
| F02 | | /13 | |
| F12 | | /6 | |
| F13 | | /6 | |
| F09 | | /7 (+1) | |

Firmato: ____________________  Data: ____________  Commit: `__________`
