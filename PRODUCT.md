# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Squadre di un pub (2–20 tavoli, tipicamente 4–10) che giocano dallo stesso
telefono di squadra, e un presentatore/regia che pilota la serata dalla TV e dal
pannello admin. Il pubblico guarda la TV: le schermate TV sono la vista condivisa,
il telefono è il controller privato.

## Product Purpose

Pub Game è una serata quiz a squadre: 40 round in cinque atti, 13 modalità di
gioco, cinque bonus. Vince chi chiude con più punti. Il prodotto deve reggere una
serata dal vivo, con decine di telefoni sulla stessa rete e un presentatore che
non può fermarsi a sistemare l'interfaccia.

## Positioning

La partita è un unico stato sul server: TV, telefoni e regia vedono la stessa
verità, e ogni schermata è progettata per essere letta a distanza (TV) o toccata
in piedi, con una mano (telefono). Non è un quiz da divano: è un oggetto da pub,
stampato, con fiches e tabelloni.

## Operating Context

- Serata dal vivo: TV 16:9 (1920×1080 e 1280×720), telefoni 360–430 px di
  larghezza, luce di un locale, audio del pub.
- Il presentatore usa la dock TV e `/admin`; i giocatori usano `/play`; c'è una
  regia audio di prova e un'anteprima dei bonus per le demo.
- La serata non si può mettere in pausa per una modifica: gli errori di layout
  costano una partita.

## Capabilities and Constraints

- Frontend Angular 22 con token CSS in `apps/frontend/src/styles.css`, sette
  temi, componenti standalone.
- Backend Spring Boot con WebSocket STOMP; lo stato di gioco è del server.
- Regole, punteggi, banche ed enum non si cambiano per esigenze grafiche.
- Le banche media sono locali; niente dipendenze da servizi esterni in sala.
- Il progetto deve funzionare anche senza rete verso l'esterno.

## Brand Commitments

Il linguaggio visivo è vincolante ed è descritto in `AGENTS.md` e `DESIGN.md`:
carta e inchiostro, accenti acid/tomato/cobalt/mustard/mint, Anton + Bricolage
Grotesque + Space Mono, bordi pieni, ombre offset, radius 0 salvo oggetti fisici.
Niente gradienti, vetro, glow o radius arrotondati.

## Evidence on Hand

- `apps/frontend/src/styles.css`: token reali e temi.
- `docs/AUDIT-GRAFICO/`: inventario, referto schermate e riepilogo.
- `docs/AUDIO-CATALOGO.md`: catalogo audio.
- Schermate reali in `docs/AUDIT-GRAFICO/screens/` (TV e telefono, cinque viewport).

## Product Principles

1. La TV si legge da lontano; il telefono si tocca senza guardare.
2. Una sola verità di stato: la grafica non inventa mai dati che il server non ha.
3. Il colore ha un ruolo semantico, non decora.
4. La serata non si ferma: ogni schermata deve funzionare anche nello stato
   degradato (offline, riconnessione, squadra espulsa).
5. Lo stile è un oggetto stampato: se una scelta sembra una dashboard web, è
   sbagliata.

## Accessibility & Inclusion

Bersagli di tocco ≥44 px sul telefono, testi ≥12 px, contrasto verificato sulle
schermate reali; `prefers-reduced-motion` rispettato. La TV deve restare leggibile
a 3–5 metri e a 720p.
