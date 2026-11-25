# Setup serata — quizzOne 3.1.0

> Checklist rapida per la serata di **oggi, 25 novembre 2026**.
> Dettagli completi: [`SETUP-LOCALE.md`](SETUP-LOCALE.md) e
> [`AVVIO-SERATA-ADMIN.md`](AVVIO-SERATA-ADMIN.md).
> Durante la serata: [`PRESENTATORE.md`](PRESENTATORE.md) e
> [`PANNELLO-ADMIN.md`](PANNELLO-ADMIN.md).

---

## 0. Dieci minuti prima: controllo secco

- [ ] PC collegato alla corrente e alla TV; sospensione e salvaschermo disattivati.
- [ ] PC e telefoni sulla **stessa Wi-Fi**; PC via cavo se possibile.
- [ ] IP del PC annotato: `ipconfig` (Windows), `ipconfig getifaddr en0` (macOS) o
      `hostname -I` (Linux).
- [ ] `CONTROL_SECRET` nel file di configurazione: almeno 32 caratteri, non condiviso.
- [ ] `curl http://localhost:8080/health` risponde `{"status":"ok"}`.
- [ ] TV su `/tv`, a schermo intero, con **AUDIO ATTIVO**.
- [ ] Regia su `/admin` con il codice mostrato dalla TV.
- [ ] Almeno due telefoni di prova entrano dal QR e vedono il manuale.
- [ ] Lobby a `0/40`; nessuna partita vecchia aperta.

Se un punto fallisce, non iniziare la serata: usa la tabella in fondo.

---

## 1. Scegli la modalità

### A. Docker (consigliata per stasera)

Serve solo Docker Desktop avviato.

```bash
# Se deploy/.env non esiste:
cp deploy/.env.test.example deploy/.env

# Apri deploy/.env e imposta CONTROL_SECRET (32+ caratteri).
# Il compose di prova imposta ALLOWED_ORIGINS=*: va bene per la serata in casa.
```

Avvio della versione **3.1.0**:

```bash
PUBGAME_TAG=3.1.0 docker compose -f deploy/docker-compose.test.yml --env-file deploy/.env up -d --build
```

Verifica:

```bash
curl http://localhost:8080/health
```

Apri:

- TV: `http://<IP-del-PC>:8080/tv`
- Regia: `http://<IP-del-PC>:8080/admin`
- Telefoni: QR dalla TV, oppure `http://<IP-del-PC>:8080/play`

Non aprire la TV su `localhost`: il QR userebbe `localhost` e i telefoni non
entrerebbero.

### B. Sviluppo con npm

Serve Node.js 26.13+, npm 11.20+ e JDK 25.

```bash
npm install

# Se .env non esiste:
cp .env.test-night.example .env

# In .env:
# CONTROL_SECRET=... (32+ caratteri)
# ALLOWED_ORIGINS=http://localhost:4200,http://<IP-del-PC>:4200
# HOST=0.0.0.0
npm run dev
```

Apri:

- TV: `http://<IP-del-PC>:4200/tv`
- Regia: `http://<IP-del-PC>:4200/admin`
- Telefoni: QR dalla TV, oppure `http://<IP-del-PC>:4200/play`

Lascia aperto il terminale di `npm run dev`: chiuderlo spegne il gioco.

---

## 2. Prima di far entrare le squadre

### Backup

```bash
npm run db:backup
```

Con Docker il database vive nel volume; il backup manuale resta utile prima di
un aggiornamento o di un reset.

### Karaoke: clip e testi

Clip e testi non sono nel repository. Sulla macchina della serata devono esserci:

```bash
node scripts/bonus/scarica-testi.mjs --check
ls apps/backend/src/main/resources/static/media/music/*.m4a | wc -l
```

Se mancano, copia `questions/lyrics-bonus-it.json` e
`apps/backend/src/main/resources/static/media/music/` dalla macchina di lavoro,
oppure rigenerali con:

```bash
node scripts/bonus/prepara-clip.mjs
node scripts/bonus/scarica-testi.mjs
```

La banca ha 64 canzoni; entrano in partita quelle con il testo sincronizzato
locale (29 su questa macchina). Senza file la TV mostra «TESTO NON DISPONIBILE».

### Banche media

Se Indovina chi o Musica non hanno foto/brani:

```bash
npm run audit:banche
```

La banca locale (`questions/media-it.json` e `static/media/`) è fuori da Git:
va copiata dalla macchina che l'ha generata.

### Prova dei pulsanti

1. Entra con ogni telefono.
2. In `/admin` avvia **PROVA DEI PULSANTI**.
3. Fai toccare ogni telefono; attendi **TUTTI PRONTI**.
4. Premi **▶️ PARTI**.
5. Se un telefono resta «DA CONTROLLARE», controlla rete, browser e
   `ALLOWED_ORIGINS` prima di iniziare.

### Reset finale

Con almeno un telefono collegato, premi **RESET** in `/admin` e conferma.
La TV deve tornare alla lobby con `0/40`; i telefoni rientrano dal setup.
**Non farlo a serata iniziata:** cancella la partita.

---

## 3. Ordine della serata

- Un round alla volta con **▶️ PARTI**.
- Nei giochi a voce (Indovina chi, Musica, Ruota) decidi **CORRETTO** o
  **SBAGLIATO**.
- **PAUSA / RIPRENDI** per gli imprevisti.
- I cinque bonus partono da soli in un round interno dell'atto:
  **Karaoke → Blackjack → Casino 5 manche → Cavallo → Casino numero secco**.
- Chiuso il bonus, la scaletta riparte dal round successivo.
- Dopo il round 40: classifica finale e podio.

Regole e punteggi aggiornati sono nel [`manuale-serata.pdf`](manuale-serata.pdf)
e nel manuale dentro il telefono.

---

## 4. Se qualcosa non va

| Problema | Prima cosa da fare |
| --- | --- |
| I telefoni non aprono il QR | Stessa Wi-Fi? Stai usando l'IP del PC, non `localhost`? Firewall aperto sulla porta? |
| Il telefono dice «non autorizzato» (npm) | Aggiungi l'IP esatto in `ALLOWED_ORIGINS`, riavvia `npm run dev`. |
| La TV si blocca | Ricarica `/tv`: si riconnette e riprende dal server. Non ricreare la partita. |
| La regia non accetta il codice | Il codice dura 5 minuti: generalo di nuovo dalla TV. |
| Il backend non risponde | `curl http://localhost:8080/health`; riavvia il comando di avvio. |
| Manca l'audio | Premi **ATTIVA AUDIO** in TV; controlla uscita HDMI e mute. |
| Karaoke senza testo | Mancano clip/testi: non è un problema del telefono, copia i file. |

Se il problema non si risolve in un minuto: **annota, non toccare il codice**,
e continua con il gioco successivo. Il dettaglio delle emergenze è in
[`SERATA-PROVA.md`](SERATA-PROVA.md) e [`SETUP-LOCALE.md`](SETUP-LOCALE.md) §7.
