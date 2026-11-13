# PubGame — Avvio della serata a casa (guida per l'admin)

> Per te, che ospiti la serata con gli amici. Una pagina: cosa serve, cosa fare in
> ordine, come far entrare i telefoni e cosa controllare prima che arrivino.
> Dettagli di rete, Docker e problemi: [`SETUP-LOCALE.md`](SETUP-LOCALE.md).
> Durante la serata: [`PRESENTATORE.md`](PRESENTATORE.md) e [`PANNELLO-ADMIN.md`](PANNELLO-ADMIN.md).

---

## 1. Cosa serve

| Cosa | Dettaglio |
| --- | --- |
| **Un PC** | Fa da server. Deve restare acceso e collegato alla rete per tutta la serata. |
| **Una TV o un proiettore** | Collegato al PC (HDMI) oppure un secondo schermo. Mostra `/tv`. |
| **Il tuo telefono o un tablet** | Per la regia `/admin`. |
| **Telefoni degli amici** | Browser normale (Safari o Chrome). Niente app. |
| **Wi-Fi unico** | PC, TV, telefoni e regia sulla stessa rete. |
| **Docker** *(consigliato)* **oppure** Node.js 22.22+, npm 11, JDK 25 | Scegli una delle due strade in `SETUP-LOCALE.md`, §3 o §4. |
| **Un segreto di regia** | Stringa casuale di almeno 32 caratteri (`CONTROL_SECRET`). Generala una volta e tienila: serve per aprire la regia. |

Prima di questa sera, se non l'hai ancora fatto, leggi `SETUP-LOCALE.md` §3 o §4:
lì ci sono i comandi esatti per il tuo sistema.

---

## 2. Preparazione (da fare prima, non la sera stessa)

1. **Segreto di regia.** Crea `CONTROL_SECRET` (32+ caratteri) nel file di
   configurazione: `deploy/.env` per Docker, `.env` per npm. Non metterlo in chat né
   in un documento condiviso.
2. **Origini consentite.** Con npm, in `.env` imposta `ALLOWED_ORIGINS` con
   l'indirizzo esatto del PC (es. `http://192.168.1.20:4200`), protocollo e porta
   compresi. Con il compose di prova il valore è già `*`, che va bene in casa.
3. **Backup del database.** `npm run db:backup`. Copia in `backups/`, fuori dal repository.
4. **Firewall di Windows.** Consenti la porta usata (8080 con Docker, 4200 e 8080 con npm)
   sulle reti private, altrimenti i telefoni non si collegano.
5. **Prova di 10 minuti.** Accendi tutto una sera prima o al mattino e fai una partita
   finta con un solo telefono. Riferimento: `SETUP-LOCALE.md` §6.

---

## 3. Accendere il gioco (la sera)

Scegli una strada.

**Docker (consigliato):**

```bash
docker compose -f deploy/docker-compose.test.yml --env-file deploy/.env up -d --build
```

Per fissare la versione 2.1.0 aggiungi `PUBGAME_TAG=2.1.0` prima del comando.
Aggiornamenti sbagliati si annullano cambiando tag.

**Npm:**

```bash
npm run dev
```

All'avvio il terminale stampa l'indirizzo del PC e quello per i telefoni. Lascia la
finestra aperta per tutta la serata: chiuderla spegne il gioco.

**Verifica del backend:** apri nel browser `http://localhost:8080/health`. Deve
rispondere `{"status":"ok"}`.

---

## 4. Aprire TV e regia

1. **TV:** sul PC apri `http://<IP-del-PC>:8080/tv` (con npm: `:4200/tv`). Non usare
   `localhost` sulla TV: il QR punterebbe a `localhost` e i telefoni non lo aprirebbero.
   Trovi l'IP con `ipconfig` (Windows) → *Indirizzo IPv4*.
2. **Regia:** dal tuo telefono apri `http://<IP-del-PC>:8080/admin` (con npm `:4200/admin`).
3. Nella lobby TV compaiono **PARTITA #N** e il riquadro **CODICE REGIA**. Se il codice
   non c'è, premi **GENERA CODICE** sulla TV e inseriscilo nel pannello. Vale 5 minuti
   e una volta sola.

---

## 5. Far entrare i telefoni

1. I telefoni degli amici inquadrano il **QR** sulla TV e aprono il link.
2. Ogni squadra sceglie un nickname e gioca. Non serve installare nulla.
3. Il manuale per loro è in [`MANUALE-TELEFONO.md`](MANUALE-TELEFONO.md) (lo trovano
   anche dentro la pagina, nel pulsante *Manuale dei giochi*).
4. Nel pannello admin il numero **Dispositivi online** deve salire a mano a mano che
   entrano. Se resta a zero, il problema è la rete, non i telefoni.

---

## 6. Prima di iniziare

- Pannello admin: **Round aperto: no**.
- **🗂️ CATEGORIE & TIMELINE**: accendi solo le categorie che volete giocare.
- **🧪 PROVA DEI PULSANTI**: fai toccare ogni telefono, poi **TUTTI PRONTI** e **▶️ PARTI**.
- Se un amico non riesce a entrare, vedi §8.

---

## 7. Durante la serata

- Un round alla volta: **▶️ PARTI** avvia il successivo.
- Nei giochi con prenotazione decidi **✅ CORRETTO** o **❌ SBAGLIATO** dopo aver
  ascoltato la risposta. Negli altri giochi il server calcola da solo.
- Pausa per imprevisti: **⏸️ PAUSA / RIPRENDI**.
- Fine atto (round 8, 16, 24, 32, 40): classifica, poi bonus.

Il dettaglio dei pulsanti è in [`PANNELLO-ADMIN.md`](PANNELLO-ADMIN.md) e il percorso
passo per passo in [`PRESENTATORE.md`](PRESENTATORE.md).

---

## 8. Se qualcosa non va

| Problema | Cosa fare |
| --- | --- |
| I telefoni non aprono il link | Stesso Wi-Fi del PC? Firewall aperto sulla porta? Stai usando l'IP del PC, non `localhost`? |
| Il telefono dice "non autorizzato" (npm) | `ALLOWED_ORIGINS` non contiene l'indirizzo: aggiungilo in `.env`, riavvia. |
| La TV si blocca | Ricarica `/tv`: si riconnette e riprende dal server. Non ricreare la partita. |
| La regia non accetta il codice | Il codice dura 5 minuti. Generane uno nuovo sulla TV. Dopo 5 errori aspetta un minuto. |
| Il PC si è spento o il terminale è chiuso | Riaccendi con lo stesso comando (§3). Il database non si perde. |
| Il backend non risponde | Controlla `http://localhost:8080/health`. Se non risponde, riavvia il comando (§3). |

Se il problema persiste, non ricreare la partita: annota che cosa vedi e rileggi
`SETUP-LOCALE.md` §7.

---

## 9. Dopo la serata

1. Ferma il gioco (`Ctrl+C` nel terminale oppure `docker compose down`).
2. Fai un backup: `npm run db:backup`.
3. Tieni la partita: domande usate ed eventi servono per la prossima serata.
