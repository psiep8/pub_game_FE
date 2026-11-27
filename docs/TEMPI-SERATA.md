# Tempi della serata

Quanto dura la serata, ricavato dai tempi dichiarati dai giochi. Qui c'è solo il
**tempo di gioco dei quaranta round**: intro, classifiche rapide e dettagliate,
bonus e pause d'atto stanno fuori e li decide la regia.

La tabella non si aggiorna a mano: ogni gioco espone la propria durata accanto
alle costanti che la compongono (`QUIZ_ROUND_SECONDS`, `MUSIC_ROUND_SECONDS`,
`BIGLIE_ROUND_SECONDS`, …). `round-durations.spec.ts` ricalcola tutto dal codice
e fallisce se questo documento non combacia più.

## Un round per gioco

| Gioco | Durata | Come nasce |
| --- | --- | --- |
| Quiz | 1'03" | 3 manche da 15 s più 3 s di reveal e 4,5 s di respiro fra le manche |
| Musica | 2'50" | 5 manche: 4 s + prenotazione 5 s + 12 s + prenotazione 5 s + reveal 8 s |
| Indovina chi | 2'15" | 3 manche da 45 s, un indizio ogni 15 s |
| Ruota della fortuna | 1'15" | un timer per round |
| Timeline | 0'45" | un timer per round |
| Time Buzzer | 1'45" | 3 manche: 5 s di slot, 20 s di bersaglio, 5 s di respiro, 5 s di countdown |
| Bomba | 2'40" | 20 s per squadra, con 8 squadre: in sala cresce di 20 s per squadra |
| Tennis Battle | 5'00" | le sfide si giocano in parallelo: conta il timer, non la somma |
| Ultima spiaggia | 0'37" | 12 s per scegliere il livello, 20 s per rispondere, 5 s di reveal |
| Azzardo | 2'33" | 4 manche da 30 s di puntata e 7 s di reveal, più 5 s di finale |
| Arena Battle Royale | 2'10" | un timer per round |
| Speed Rush | 1'30" | un timer per round |
| Biglie | 2'51" | intro 4 s, scelta 10 s, due gare da 70 s con countdown 3 s, respiro 4 s, finale 7 s |

## Gli atti

Con otto squadre in sala e con venti, per vedere quanto pesa la Bomba:

| Atto | Con 8 squadre | Con 20 squadre |
| --- | --- | --- |
| 1 | 12'00" | 12'00" |
| 2 | 16'54" | 16'54" |
| 3 | 17'11" | 17'11" |
| 4 | 14'49" | 18'49" |
| 5 | 19'26" | 23'26" |

L'atto 1 apre con la Musica e chiude con l'Ultima spiaggia; l'atto 5 è il più
lungo perché ha Tennis, Biglie, Arena e la seconda Bomba.

## La serata, per numero di squadre

| Squadre | Quaranta round |
| --- | --- |
| 4 | 77'40" |
| 8 | 80'20" |
| 10 | 81'40" |
| 14 | 84'20" |
| 20 | 88'20" |

Solo la Bomba dipende dalla sala: 20 s per squadra, due volte nella serata.
Tutto il resto è uguale con quattro o con venti squadre. A questi minuti vanno
aggiunti i cinque bonus (Karaoke, Black Jack, Cinque, Cavallo, Numero), le
cinque classifiche rapide e le cinque dettagliate.

## Come si legge in regia

- Un atto sta fra i **12 e i 20 minuti** di gioco con otto squadre: se la
  scaletta si allunga, il tempo si perde nelle pause, non nei round.
- Il respiro fra le manche (4,5 s) è già contato nel Quiz: la domanda dopo è a
  schermo e leggibile, con il cronometro fermo, e il 3-2-1 non si ripete.
- Tennis (5') e Musica (2'50") sono i due round da non aprire a fine serata se
  la sala è stanca.
- Con venti squadre l'atto 4 e l'atto 5 crescono di quattro minuti l'uno per la
  Bomba: sono i due momenti in cui conviene avere il presentatore libero.
