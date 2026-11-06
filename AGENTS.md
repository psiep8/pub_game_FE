# PubGame — istruzioni di progetto

## !IMPORTANT — Stile grafico obbligatorio

**Ogni modifica o aggiunta grafica deve essere in linea con lo stile dell'applicativo.**
Vale per TV, telefono, schermate bonus, classifiche, overlay, demo e componenti nuovi.
Nessuna eccezione: prima di scrivere CSS o markup, leggere i token in
`apps/frontend/src/styles.css` e guardare una schermata già allineata (per esempio
`blackjack.ts`, `leaderboard-quick-component/restyle.css`,
`leaderboard-detailed-component/restyle.css`).

### Linguaggio visivo

- **Carta e inchiostro.** Superfici `var(--paper)` / `var(--paper-hi)`, testo
  `var(--coal)`, oppure fondo `var(--bg-0)` con testo `var(--paper)`.
- **Accenti dalla palette**, mai inventati: `var(--acid)`, `var(--tomato)`,
  `var(--mustard)`, `var(--cobalt)`, `var(--mint)`.
- **Tipografia:** `var(--font-display)` (Anton) per i titoli, `var(--font)` per il
  testo, `var(--font-mono)` (Space Mono) per numeri, etichette e dati.
- **Geometria:** `border-radius: 0` sulle superfici; i cerchi restano solo dove
  rappresentano un oggetto fisico (pallina, gettone, orologio).
- **Bordi e ombre:** bordi pieni `2–4px solid var(--coal)` e ombre offset piene
  (`6px 6px 0`, `10px 10px 0`, `14px 14px 0`), senza blur.
- **Materiale:** carta puntinata, strisce diagonali, timbri ruotati, tabelle
  stampate, etichette mono. Il colore deve avere un ruolo semantico.

### Vietato

- Gradienti blu/viola da dashboard, vetro, `backdrop-filter: blur`, neon, glow,
  alone luminoso.
- Card arrotondate 10–26px, pillole, chip con radius 999px (salvo oggetti fisici).
- Palette fuori tema (`#0f172a`, `#111827`, `#fbbf24`, `#a3e635`, `#8b5cf6`,
  `#38bdf8`, viola/ciano generici).
- Emoji che fluttuano o ruotano come decorazione; animazioni decorative gratuite.
- Ombre morbide `0 20px 60px rgba(...)`, gradienti "glass", testi con gradiente.

### Prima di consegnare

- Confrontare la schermata con un tabellone già esistente: stesso spessore dei
  bordi, stesso tipo di ombra, stessa gerarchia tipografica.
- Controllare TV e telefono, anche a 720p.
- Se un componente legacy usa ancora il linguaggio vecchio, non copiarlo:
  aggiungere una skin con i token, come già fatto per Quiz, Canzone, Arena e
  classifiche.
