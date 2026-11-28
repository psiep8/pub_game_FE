# Licenze — musica, karaoke e contenuti multimediali

> **Stato:** bozza di lavoro, 28 novembre 2026.
> **Non è un parere legale.** È una raccolta di informazioni generali sul diritto
> italiano, pensata per decidere cosa mettere in una serata pubblica e cosa
> chiedere a chi ha la licenza. Dove c'è scritto «da verificare» non ho trovato
> una risposta certa: va chiesta a SIAE, SCF o al gestore del locale.

Ambito: quizzOne usato in un pub o in un altro locale aperto al pubblico, con
TV, telefoni e presentatore. Il documento riguarda **i diritti sulle opere**
(musica, testi, immagini, audio), non le regole sui giochi a premi e sull'azzardo:
quelle stanno in una nota separata.

---

## 0. In breve

| Elemento | Rischio | Cosa fare |
|---|---|---|
| Loop ed effetti interni (Mixkit, CC0, sintesi nostra) | **basso** | tenerli nei crediti; non ridistribuirli come file sciolti |
| Domande, testi del gioco, regolamento | **basso** | sono nostri; nessun problema di licenza |
| Immagini Wikimedia Commons | **medio** | una licenza per file: attribuzione obbligatoria, attenzione alla CC-BY-SA |
| Foto TMDB (Indovina chi) | **medio-alto** | verificare i termini TMDB e l'uso commerciale |
| Musica con brani veri (round Musica) | **alto** | serve la licenza del locale per l'esecuzione pubblica, o si sostituisce |
| Karaoke (basi + testi sincronizzati) | **alto** | serve una licenza karaoke dedicata; la musica d'ambiente non basta |
| YouTube sulla TV del locale | **non coperto dai termini** | non usarlo come sorgente del gioco |
| Anteprime iTunes/Deezer da 30 s | **non coperte** | non salvarle e non riprodurle in pubblico |

La regola che conta: **la durata non crea una scorciatoia**. Trenta secondi non
sono una soglia di legge. Contano due atti: **riprodurre** il file (salvarlo,
incorporarlo, sincronizzare il testo) e **comunicarlo al pubblico** (farlo
sentire in un locale). Se manca la licenza per uno dei due, il problema c'è
anche con una clip di dieci secondi.

---

## 1. Chi copre cosa

| Diritto | Chi lo amministra | Cosa copre | Cosa non copre |
|---|---|---|---|
| Diritto d'autore sulla composizione | **SIAE** (autori ed editori) | esecuzione e comunicazione al pubblico dei brani in repertorio | non copre automaticamente la riproduzione del testo dentro un'app |
| Diritti connessi sul fonogramma | **SCF** (produttori e artisti interpreti) | diffusione della registrazione | non copre la composizione |
| Altri diritti connessi | Nuovo IMAIE, ITSRIGHT e altri enti | a seconda del repertorio e dell'uso | il gestore sa quali ha |
| Testo della canzone | editore / autore | riproduzione, sincronizzazione, messa a disposizione | non è «dato aperto» solo perché i tempi stanno su LRCLIB |

**SIAE e SCF sono due cose diverse.** La licenza SIAE non implica quella SCF, e
viceversa. In un locale servono entrambe per la musica protetta. La pagina SIAE
sulla musica d'ambiente lo dice esplicitamente: l'abbonamento **non copre** gli
utilizzi in occasione di spettacoli o eventi di intrattenimento, che richiedono
un'altra licenza.

**La musica d'ambiente non è un lasciapassare per il karaoke.** La licenza
«musica di sottofondo» copre la diffusione continua di musica registrata, non
un'esibizione con microfono, non un quiz musicale con clip scelte e non un
evento in cui il pubblico partecipa.

---

## 2. Musica nel gioco

### 2.1 I loop interni: la parte tranquilla

I 20 sottofondi e i 41 effetti in `apps/frontend/public/assets/audio` sono:

- **Mixkit License** e **Mixkit Stock Music Free License** — uso gratuito anche
  commerciale, senza obbligo di attribuzione; non si possono ridistribuire come
  file sciolti;
- **CC0** (Kenney) — nessun diritto riservato;
- **sintesi nostra** — gong, bong, gettoni, esplosione, loop degli atti.

Questa è la colonna sonora del gioco e **non passa da SIAE o SCF**: è già
licenziata alla fonte. Il documento di riferimento è `docs/CREDITI-AUDIO.md`,
generato da `FONTI.txt`. Va tenuto aggiornato: se un file viene sostituito senza
registrarne la licenza, il credito diventa falso.

### 2.2 I brani veri del round Musica

Il round Musica usa due strade:

1. **banca locale** (`/media/music/*.m4a`), non inclusa nel repository;
2. **anteprime iTunes** da 30 secondi, se la banca locale non c'è.

In entrambi i casi il brano è protetto. Riprodurlo in un locale è
**comunicazione al pubblico**: serve la licenza del locale (SIAE + SCF) e,
se il file è salvato e servito dall'app, anche il diritto di riproduzione.

Le anteprime iTunes non risolvono il problema. I Termini dei Servizi Multimediali
Apple parlano di uso **personale e non commerciale**: salvare l'anteprima nel
gioco e farla sentire in un pub esce da quel perimetro. Non è una licenza di
pubblica esecuzione, è un'anteprima per scegliere se comprare il brano.

### 2.3 YouTube sulla TV

È l'uso più diffuso e il più fragile. I Termini di YouTube riservano il servizio
all'uso personale e non commerciale e vietano di mostrare i contenuti in pubblico
senza autorizzazione. Il fatto che «tutti i locali lo facciano» non lo rende
autorizzato: significa solo che il controllo è raro.

C'è anche un doppio binario:

- **verso YouTube/Google**: l'uso in un locale non è previsto dai termini;
- **verso SIAE/SCF**: se il locale ha la licenza per la musica d'ambiente, quella
  può coprire i brani diffusi, ma non rende lecito l'uso del servizio YouTube.

Se il gestore usa YouTube per la musica di sottofondo, è una scelta sua e se ne
assume il rischio. **Il gioco non dovrebbe dipendere da YouTube**: né incorporarlo,
né usarlo come lettore.

### 2.4 Cosa fare per il round Musica

| Strada | Cosa serve | Giudizio |
|---|---|---|
| Solo loop interni | niente | sicuro, ma non è un quiz musicale |
| Banca locale + licenza SIAE/SCF del locale | copia della licenza, perimetro e scadenza | percorribile, da mettere per iscritto |
| Anteprime iTunes | licenza di pubblica esecuzione che Apple non dà | da evitare in pubblico |
| YouTube | autorizzazione che i termini non danno | da evitare |
| Libreria royalty-free con licenza di pubblica esecuzione | contratto della libreria | la strada più pulita se si vuole un quiz musicale |

Attenzione alle **cover**: rifare un brano non elimina il diritto sulla
composizione. Una cover è un'altra registrazione, ma la canzone resta di chi
l'ha scritta.

---

## 3. Karaoke

Il karaoke mette insieme tre livelli:

| Livello | Cosa è | Chi lo concede |
|---|---|---|
| Composizione | la canzone, melodia e testo | SIAE / editore |
| Fonogramma o base | la registrazione, anche strumentale | SCF / produttore |
| Testo sincronizzato | la riproduzione del testo sullo schermo | editore / autore |

La licenza «musica d'ambiente» non copre nessuno dei tre usi tipici del karaoke:
c'è un'esibizione, c'è un pubblico che partecipa, c'è un testo proiettato. SIAE
ha una **tariffa karaoke dedicata**; una fonte di categoria indica circa
**450 €/anno**, ma l'importo e le condizioni vanno verificati sul tariffario
vigente. SCF va comunque considerata per le basi.

**I testi di LRCLIB.** LRCLIB è una banca di testi sincronizzati con licenza
aperta **sui dati e sui tempi**. Non è una licenza sui testi delle canzoni:
quelli restano degli autori e degli editori. Mostrare il testo in TV è
riproduzione, e sincronizzarlo con l'audio è un uso ancora diverso. Il fatto che
lo script `scarica-testi.mjs` funzioni tecnicamente non dice nulla sul diritto.

**Le basi.** Se la base è la registrazione originale, serve SCF. Se è una base
strumentale rifatta, serve comunque il diritto sulla composizione. Non esiste
una «base karaoke» che si possa usare in pubblico senza licenza.

**Cosa fare:**

1. chiedere al gestore se ha una **licenza karaoke** e per quali basi;
2. se non ce l'ha, usare una **piattaforma karaoke che include i diritti**,
   invece di file propri;
3. se nessuna delle due è possibile, **togliere il Karaoke dalle serate
   pubbliche** e tenerlo a casa;
4. in ogni caso, non usare basi scaricate da YouTube o da siti di karaoke
   «gratis».

---

## 4. Il resto dei contenuti

### 4.1 Immagini

| Fonte | Licenza | Cosa richiede |
|---|---|---|
| Wikimedia Commons | una per file (PD, CC0, CC-BY, CC-BY-SA) | attribuzione; la CC-BY-SA può «contagiare» l'opera derivata |
| TMDB | termini TMDB | attribuzione e verifica dell'uso commerciale |
| Copertine musicali | titolari diversi | non sono coperte dalla licenza del brano |

Le foto dei personaggi in «Indovina chi» sono il punto più delicato: una foto
CC-BY-SA usata dentro un'app proprietaria può obbligare a distribuire l'app con
la stessa licenza, oppure a rimuovere la foto. La scelta sicura è **PD o CC0**,
con attribuzione anche quando non è obbligatoria. Il registro è in
`docs/CREDITI-IMMAGINI-CELEBRITA.md`.

### 4.2 Font, mappe, sticker

- **Anton** — SIL Open Font License 1.1 (`docs/stickers/OFL.txt`).
- **Mappe** — progetto djaiss, con menzione (vedi `apps/frontend/public/maps/README.md`).
- **Sticker** — vedi `docs/stickers/README.md`.

### 4.3 Domande e testi

Le domande sono nostre. I fatti su persone e opere non sono protetti dal diritto
d'autore, ma **le foto sì**, e possono entrare in gioco anche i diritti
d'immagine. Una domanda su un personaggio va bene; la sua foto va licenziata.

---

## 5. Cosa rischio

Questa è la parte che nessuno vuole leggere, quindi la metto in tabella.

| Scenario | Rischio tipico | Gravità |
|---|---|---|
| Musica protetta in locale senza SIAE/SCF | richiesta di pagamento dei diritti, sanzioni, diffida; nei casi previsti dalla L. 633/1941 anche denuncia | **alta** |
| Karaoke senza licenza dedicata | come sopra, più il fronte «testo riprodotto» | **alta** |
| Anteprime iTunes salvate e riprodotte | violazione dei termini Apple; rimozione, sospensione, possibile richiesta danni | **media** |
| YouTube in pubblico | violazione dei termini; rimozione dei contenuti, sospensione dell'account; possibili azioni dei titolari | **media** |
| Foto CC-BY-SA senza attribuzione | richiesta di attribuzione, rimozione, obbligo di licenziare l'opera derivata | **media** |
| Foto TMDB fuori dai termini | rimozione, richiesta di cessazione | **media** |
| Loop Mixkit/CC0 | nessun rischio, se i crediti restano corretti | **basso** |

**Chi rischia.** In genere l'«utilizzatore» è chi diffonde la musica: se il gioco
porta i brani nel locale, non è scontato che la responsabilità sia solo del
gestore. La licenza del pub copre il pub, non automaticamente l'organizzatore
che gli mette in mano un'app con i brani. Prima della serata va chiarito **per
iscritto** chi è il titolare della licenza e fin dove arriva.

**Il penale.** La L. 633/1941 punisce la comunicazione al pubblico non autorizzata
(art. 171) e prevede ipotesi più gravi quando c'è fine di lucro (art. 171-ter).
«Fine di lucro» non vuol dire solo biglietto d'ingresso: può bastare il vantaggio
economico del locale. Una serata gratuita non è, da sola, una difesa.

**Il civile è più probabile del penale.** SIAE e SCF agiscono soprattutto con
diffide e richieste di pagamento; il penale arriva nei casi più gravi. Questo non
rende il rischio trascurabile: una diffida durante la serata la ferma.

---

## 6. Come presentare le licenze nell'app

### Principio

Una pagina sola, leggibile da lontano, e nessuna rassicurazione falsa. Non
scrivere «siamo a norma»: scrivi **cosa è nostro, cosa è di terzi, cosa dipende
dal locale**. La pagina non deve interrompere il gioco: sta nel lobby, nei crediti
e nel pannello admin, non sopra le domande.

### 6.1 La pagina `/crediti`

Una schermata TV-first, con il linguaggio grafico del progetto (carta, inchiostro,
Anton per il titolo, mono per le etichette). Quattro blocchi:

```
CREDITI E LICENZE

AUDIO DEL GIOCO
Loop ed effetti: Mixkit License, Mixkit Stock Music Free,
CC0 (Kenney), sintesi PubGame. Elenco completo in docs/CREDITI-AUDIO.md.

IMMAGINI
Wikimedia Commons — autore e licenza per ogni foto.
TMDB — per le foto di «Indovina chi».

FONT E MAPPE
Anton (SIL OFL 1.1) · mappe djaiss.

MUSICA E KARAOKE
I brani del round Musica e del Karaoke non sono inclusi
nella licenza del gioco: valgono le licenze del locale.
Chiedi al gestore prima della serata.
```

Regole:

- **niente elenco infinito in TV**: la pagina mostra le famiglie, il dettaglio sta
  in `docs/LICENZE.md` e nei file `CREDITI-*`;
- **link dalla lobby** (una riga «Crediti» nel footer) e dal pannello admin;
- **raggiungibile via URL** (`/crediti`), così si apre anche da un telefono;
- **nessuna promessa**: la frase su Musica e Karaoke resta «valgono le licenze del
  locale» finché non c'è una conferma scritta.

### 6.2 Il regolamento della serata

Una card in lobby, non un popup:

> **Giochi a punti. Nessuna posta in denaro.**
> I premi sono assegnati alla classifica finale.
> La musica del gioco è su licenza; per i brani e il karaoke
> valgono le licenze del locale.

Questa card fa due cose: dice ai giocatori che non è azzardo e dice al gestore
che l'app non promette licenze che non ha. È il posto giusto per la frase, non la
schermata di una domanda.

### 6.3 Il pannello admin: la checklist «LICENZE»

Una sezione nel pannello, con semaforo e data dell'ultima verifica:

| Voce | Stato | Chi lo conferma |
|---|---|---|
| SIAE musica d'ambiente | ✅ / ⚠️ / ❌ | gestore |
| SCF fonogrammi | ✅ / ⚠️ / ❌ | gestore |
| Licenza karaoke | ✅ / ⚠️ / ❌ | gestore |
| YouTube escluso dal gioco | ✅ | noi |
| Anteprime iTunes escluse | ✅ | noi |
| Immagini attribuite | ✅ / ⚠️ | noi |

Il semaforo non è una consulenza: è un promemoria. Se una voce è ⚠️, l'admin vede
un avviso prima di avviare Musica o Karaoke, non un blocco. Il blocco serve solo
se si decide di non giocare quel round senza licenza.

### 6.4 Durante il round

- **Musica**: titolo e artista nella card della domanda, come già si fa; nessun
  testo legale.
- **Karaoke**: titolo, artista e «clip di 30 s» nella card; il testo resta al
  centro. La nota sulle licenze sta nella pagina crediti, non qui.
- **Niente watermark o disclaimer** sopra il gioco: sporca la scena e non protegge
  nessuno.

### 6.5 Dove vive la verità

Un solo posto: `docs/LICENZE.md` per le regole, `FONTI.txt` e `CREDITI-AUDIO.md`
per l'audio, `CREDITI-IMMAGINI-CELEBRITA.md` per le foto. Se un file cambia, si
aggiorna il registro nello stesso commit. La pagina `/crediti` legge da qui (o da
un JSON generato), non da testi scritti a mano in tre punti diversi.

---

## 7. Checklist prima di una serata pubblica

- [ ] Chiedere al gestore la **licenza SIAE** e la **licenza SCF**: copia,
      perimetro, scadenza.
- [ ] Chiedere se la licenza copre **eventi** o solo **musica d'ambiente**.
- [ ] Chiedere la **licenza karaoke** e l'elenco delle basi autorizzate.
- [ ] Decidere il round Musica: banca locale coperta, libreria royalty-free, o
      niente brani veri.
- [ ] **Non** usare YouTube, **non** usare anteprime iTunes salvate.
- [ ] Controllare le licenze delle foto e mettere l'attribuzione in `/crediti`.
- [ ] Mettere in lobby la card «giochi a punti, nessuna posta in denaro».
- [ ] Scrivere chi è responsabile di cosa (gestore / organizzatore).
- [ ] Tenere una copia delle conferme: email, PDF, numero di licenza.

---

## 8. Le domande da mandare (email)

> Oggetto: licenze per una serata quiz in un pub — musica e karaoke
>
> Buongiorno,
> organizzo una serata quiz in un pub. Il gioco è a punti, senza posta in denaro.
> Vorrei capire quali licenze servono per tre usi:
>
> 1. **Musica di sottofondo** durante la serata: la licenza SIAE/SCF del locale
>    copre anche la diffusione fatta dall'app sulla TV?
> 2. **Round Musica**: clip di 30 secondi di brani commerciali, scelte dal gioco
>    e riprodotte sulla TV del locale. Serve una licenza diversa dalla musica
>    d'ambiente? Quale?
> 3. **Karaoke**: basi musicali e testo sincronizzato mostrato in TV. Esiste una
>    tariffa dedicata? Vale anche se le basi sono file nostri e non di una
>    piattaforma?
>
> Grazie, resto a disposizione per i dettagli.

Mandarla a **SIAE**, **SCF** e al **gestore**. La risposta scritta è l'unica cosa
che vale in caso di contestazione.

---

## 9. Fonti

Lette il 28 novembre 2026:

- SIAE — *Musica d'ambiente*: <https://www.siae.it/it/utilizzatori/musica-ambiente/>
- SIAE — *Musica di sottofondo in bar, ristoranti, locali*: <https://www.siae.it/it/utilizzatori/musica-ambiente/bar-ristoranti-locali-pubblici-esercizi/>
- SIAE — *Eventi di spettacolo e intrattenimento*: <https://www.siae.it/it/utilizzatori/eventi-spettacolo-intrattenimento/>
- SIAE — *Eventi musicali senza ballo*: <https://www.siae.it/it/utilizzatori/eventi-spettacolo-intrattenimento/eventi-senza-ballo/>
- Confcommercio Imola — *SIAE: diritti d'autore per karaoke* (tariffa indicativa): <https://www.confcommercioimola.it/siae-diritti-dautore-per-karaoke-e-accordo-concertini-bar-e-ristoranti/>
- Apple — *Termini e condizioni dei Servizi Multimediali*: <https://www.apple.com/legal/internet-services/itunes/it/terms.html>
- L. 22 aprile 1941, n. 633 (diritto d'autore), artt. 15, 16, 171, 171-ter.
- Mixkit License / Mixkit Stock Music Free License — vedi `FONTI.txt`.
- Wikimedia Commons — licenza per singolo file.
- TMDB — termini del servizio.

**Da verificare, non risolto qui:** se un'app che gira su una TV del locale sia
un «apparecchio da intrattenimento» ai sensi del TULPS; se i premi del bar
ricadano nei concorsi a premio del DPR 430/2001; se i Termini YouTube attuali
abbiano un'eccezione per i locali. Sono tre domande diverse da quelle sulle
licenze musicali e vanno chieste separatamente.
