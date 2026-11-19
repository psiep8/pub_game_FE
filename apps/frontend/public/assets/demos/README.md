# Demo TV

Le demo sono **animate direttamente in TV**: `demo-scripts.ts` compone le scene e
il componente TV le disegna. Non si carica nessun video e non c'è nessun mp4 in
questa cartella.

Le voci sono **19**: l'introduzione della serata, i **13 giochi** della scaletta
e i **5 bonus** di fine atto (Casino bianco/rosso, Blackjack, Casino dozzina,
Cavallo, Casino numero secco). Ognuna ha **cinque scene** — obiettivo, telefono,
punteggio, tabellone e chiusura — e la tabella dei punti arriva da
`SCORING_RULES`, quindi demo e manuale non possono divergere dal codice.

L'ordine in regia è `DEMO_ORDER`: introduzione, giochi nell'ordine della prima
uscita in scaletta, bonus.
