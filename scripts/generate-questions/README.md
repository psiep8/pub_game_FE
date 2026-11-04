# Generare la banca domande (da fare su un'altra macchina)

Il backend **non chiama più nessun modello AI**: le domande vivono in un file JSON che si
genera una volta sola, qui o su un altro computer, e poi si copia nel progetto.

```
scripts/generate-questions/generate.py   ->  apps/backend/src/main/resources/questions/questions-it.json
```

Così la serata al pub funziona anche con il wifi lento, senza rate limit e senza chiavi
API sul computer che proietta il gioco.

---

## 1. Cosa serve sull'altra macchina

- **Python 3.9 o superiore** (`python --version`; su Windows va bene anche `py --version`).
  Nessun pacchetto da installare: lo script usa solo la libreria standard.
- Una **chiave Groq** gratuita: https://console.groq.com/keys (inizia con `gsk_...`).
- Il file `generate.py`: basta copiare la cartella `scripts/generate-questions`, non serve
  tutto il repository.

## 2. Impostare la chiave (senza scriverla nel codice)

PowerShell:

```powershell
$env:GROQ_API_KEY="gsk_..."
```

Prompt dei comandi:

```bat
set GROQ_API_KEY=gsk_...
```

macOS / Linux:

```bash
export GROQ_API_KEY="gsk_..."
```

La chiave resta solo nella sessione del terminale: non finisce in nessun file.

## 3. Generare

Comando standard (40 domande per ognuna delle 12 categorie, circa 480 domande):

```bash
python generate.py --per-category 40
```

Prima prova veloce (2 minuti, per vedere che tutto funzioni):

```bash
python generate.py --per-category 5 --categories Storia Sport
```

Opzioni utili:

| Opzione | A cosa serve |
| --- | --- |
| `--per-category 40` | quante domande per categoria (default 40) |
| `--categories Storia Sport Cinema` | limitare le categorie |
| `--batch 12` | domande chieste per singola chiamata (alzarlo = meno chiamate) |
| `--delay 6` | secondi di pausa tra le chiamate (alzarlo se compaiono 429) |
| `--difficulty facile\|medio\|difficile` | difficoltà richiesta |
| `--with-chrono` | chiedere anche domande "in che anno...?" |
| `--merge` | **aggiungere** alla banca esistente invece di sostituirla |
| `--out percorso.json` | scrivere altrove |
| `--model nome` | cambiare modello Groq (default `openai/gpt-oss-120b`) |

Lo script stampa un riepilogo finale con il totale e le domande per categoria; se una
categoria resta sotto il numero richiesto lo segnala.

## 4. Il formato prodotto

```json
{
  "version": 1,
  "language": "it",
  "generatedAt": "2026-11-04T10:00:00+00:00",
  "source": "groq:openai/gpt-oss-120b",
  "questions": [
    {
      "id": "storia-0001",
      "category": "Storia",
      "type": "QUIZ",
      "difficulty": "medio",
      "question": "In che anno è iniziata la Rivoluzione francese?",
      "correctAnswer": "1789",
      "options": ["1789", "1776", "1815", "1848"],
      "explanation": null
    }
  ]
}
```

Tipi ammessi: `QUIZ` (4 opzioni, `correctAnswer` identica a una di esse), `TRUE_FALSE`
(`options` = `["VERO","FALSO"]`), `CHRONO` (anno a 4 cifre, `options` = `null`),
`IMAGE_BLUR` (solo `correctAnswer` col nome del personaggio: la foto la risolve il backend).

Lo script scarta da solo le domande rotte (opzioni sbagliate, risposta non presente,
domande in inglese) e i doppioni, sia per testo sia per risposta.

## 5. Portare il file nel progetto

Copiare il JSON in:

```
apps/backend/src/main/resources/questions/questions-it.json
```

Poi ricompilare il backend:

```bash
cd apps/backend
./mvnw -B clean package
```

All'avvio il log mostra `Banca domande caricata: N domande.` e un riepilogo per categoria.
Se compare `Banca domande assente`, il file non è finito nel posto giusto (deve stare in
`src/main/resources/questions/`, non in `target/`).

## 6. Come si comporta il backend

- `POST /games/{id}/round`: pesca dalla banca la domanda del tipo richiesto (QUIZ,
  TRUE_FALSE, CHRONO, IMAGE_BLUR). `ROULETTE`, `WHEEL_OF_FORTUNE`, `MUSIC` e `SCREAM_RACE`
  restano generati in locale perché non sono domande di cultura.
- `GET /games/{id}/arena/prepare?category=...&count=20`: riempie il pool della partita.
- `GET /games/{id}/arena-question?playerId=...`: serve un telefono dal pool, in modo che
  ogni dispositivo abbia la sua domanda e nessuna esca due volte.
- Nessuna chiave AI, nessuna chiamata a Groq. Restano solo TMDB (foto di IMAGE_BLUR) e
  iTunes (anteprime musicali), entrambi senza chiave obbligatoria.

## 7. Problemi comuni

**`ERRORE: variabile GROQ_API_KEY assente`** — la variabile è stata impostata in un altro
terminale: reimpostarla e rilanciare.

**Molti `429`** — limite di token al minuto. Rilanciare con `--delay 12 --batch 8`; le
domande già raccolte non si perdono se si usa `--merge` con lo stesso `--out`.

**Una categoria ha meno domande del previsto** — il modello ha rifiutato o ripetuto:
rilanciare `--merge --categories <quella categoria>`.

**JSON non valido** — succede solo se il file viene modificato a mano: verificare con
`python -c "import json;json.load(open('questions-it.json'))"`.

## 8. Rigenerare più avanti

`--merge` aggiunge senza toccare il resto: si può far crescere la banca nel tempo
(`--per-category 20 --merge`) senza mai perdere le domande già buone. La deduplica è
globale, quindi i doppioni non entrano anche se si rilanciano le stesse categorie.

---

## 9. Canzoni e volti (banca media)

Anche musica e immagini possono stare in locale: `generate_media.py` scarica le
anteprime di 30 secondi da iTunes (nessuna chiave) e le foto dei personaggi da
TMDB (se c'è `TMDB_API_KEY`) o da Wikipedia, mettendole dentro il backend.

```bash
python generate_media.py --count-music 24 --count-people 40
```

Produce:

- `apps/backend/src/main/resources/static/media/music/*.m4a`
- `apps/backend/src/main/resources/static/media/people/*.jpg`
- `apps/backend/src/main/resources/questions/media-it.json` (l'indice)

All'avvio il backend scrive `Banca media: N brani, M volti.` e serve i file su
`/media/...`. Se l'indice non c'è torna a iTunes e TMDB in tempo reale come
prima: la banca media è un'aggiunta, non un obbligo.

Dettagli utili:

- gli URL restituiti sono assoluti, ricavati dalla richiesta: funzionano sia da
  `localhost` sia dall'IP di rete della TV;
- `--music-only` / `--people-only` per rifare solo una delle due parti;
- rilanciandolo i file con lo stesso nome vengono sovrascritti e l'indice
  riscritto;
- se un browser rifiuta l'anteprima `.m4a`, basta cambiare l'estensione in
  `.mp4` nell'indice (è lo stesso contenitore MP4);
- i file media e l'indice sono in `.gitignore`: si copiano sulla macchina che
  proietta il gioco, non nel repository.
