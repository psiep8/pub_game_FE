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
- Un modello che risponde in JSON: **Groq** con una chiave gratuita
  (https://console.groq.com/keys, inizia con `gsk_...`) **oppure un modello locale**
  tipo Qwen su Ollama / LM Studio, senza chiave (vedi sezione 10).
- Il file `generate.py`: basta copiare la cartella `scripts/generate-questions`, non serve
  tutto il repository.

## 2. Impostare la chiave (serve solo con Groq)

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

Comando standard (10 quiz per ognuna delle 16 categorie, 160 quiz):

```bash
python generate.py --per-category 10
```

La banca ufficiale del gioco è più ampia e viene rigenerata senza modello da
`build_curated_bank.py`. La regola è per **branca**, non per categoria:

| Tipo di categoria | Domande richieste per ogni fascia (facile / medio / difficile) |
| --- | --- |
| branca unica (Storia, Sport, Musica, Motori, Curiosità) | 15 in tutto |
| due branche (Geografia e Viaggi, Scienza e Spazio, ...) | 10 della prima branca **+** 10 della seconda |

Esempio: `Geografia e Viaggi` ha 10 domande di Geografia e 10 di Viaggi per la fascia
facile, e lo stesso per medio e difficile. In partita il tema non cambia nulla: la
categoria pesca da tutto il suo mazzo, il tema serve a garantire che nessuna delle due
anime della categoria resti scoperta. Oltre alle domande da gioco ci sono 30 domande
brevi per Air Hockey (10 EASY, 10 MEDIUM, 10 HARD). Gli eventi Timeline vengono da
`build_timeline.py`.

Ogni domanda porta il campo `theme`: per i contenuti nuovi è dichiarato nel blocco
tematico, per quelli storici lo ricava `themes.py` dalle parole chiave (in modo
conservativo: se la domanda parla di un viaggio o di un monumento è Viaggi, altrimenti
Geografia).

I contenuti aggiuntivi stanno nei blocchi `bank_extra_N.py` (uno per gruppo di
categorie) e vengono scoperti automaticamente da `bank_extra.py`. Ogni blocco può
esportare quattro dizionari: `EXTRA_QUIZ` e `EXTRA_TF` per categoria e
`EXTRA_THEMED_QUIZ` / `EXTRA_THEMED_TF` con chiave `"Categoria|Branca"` quando il tema
va dichiarato a mano.

Prima di contare, la banca viene **deduplicata**: due domande con la stessa categoria,
lo stesso tipo, lo stesso testo e la stessa risposta non possono entrarci entrambe, e la
seconda viene scartata (a fine build lo script stampa l'elenco dei doppioni rimossi). Se
togliere un doppione lascia una branca sotto le dieci domande, la domanda che manca va
scritta in un blocco, non ricopiata: i blocchi `bank_extra_9.py`, `_10.py` e `_11.py`
esistono proprio per questo.

Lo script **si rifiuta di scrivere la banca incompleta**: stampa il report di copertura
per branca (e per categoria) calcolato sulla banca finale e termina con errore se una
branca resta sotto le dieci domande in una fascia. La stessa regola è verificata dal backend in
`QuestionBankCoverageTest`, che controlla anche Cavallo di Battaglia (otto domande per
categoria) e Bomba (dodici domande per ciascuno dei cinque atti).

Usa `generate.py` solo per espandere i quiz con un LLM.

Prima prova veloce (2 minuti, per vedere che tutto funzioni):

```bash
python generate.py --per-category 5 --categories Storia Sport
```

Opzioni utili:

| Opzione | A cosa serve |
| --- | --- |
| `--per-category 10` | quante domande per categoria (default 10) |
| `--categories Storia Sport "TV e Spettacolo"` | limitare le categorie |
| `--batch 12` | domande chieste per singola chiamata (alzarlo = meno chiamate) |
| `--delay 6` | secondi di pausa tra le chiamate (alzarlo se compaiono 429) |
| `--difficulty facile\|medio\|difficile` | difficoltà richiesta |
| `--merge` | **aggiungere** alla banca esistente invece di sostituirla |
| `--out percorso.json` | scrivere altrove |
| `--base-url URL` | endpoint OpenAI-compatibile (Groq, Ollama, LM Studio) |
| `--model nome` | modello da usare (default `openai/gpt-oss-120b` su Groq) |
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
(`options` = `["VERO","FALSO"]`),
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
  TRUE_FALSE, IMAGE_BLUR). `WHEEL_OF_FORTUNE`, `MUSIC` e `SCREAM_RACE` restano generati
  in locale perché non sono domande di cultura.
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
(`--per-category 10 --merge`) senza mai perdere le domande già buone. La deduplica è
globale, quindi i doppioni non entrano anche se si rilanciano le stesse categorie.

---

## 9. Canzoni e volti (banca media)

Anche musica e immagini possono stare in locale: `generate_media.py` scarica le
anteprime di 30 secondi da iTunes (nessuna chiave) e le foto dei personaggi da
TMDB (se c'è `TMDB_API_KEY`) o da Wikipedia, mettendole dentro il backend. Se un
originale non è nello store italiano, ripiega su Deezer (anteprima MP3).

```bash
python generate_media.py --count-music 24 --count-people 40 --from-azzardo
```

`--from-azzardo` legge `questions/azzardo-it.json` e scarica anche tutte le
canzoni e le celebrità che possono uscire nelle quattro manche, così il round
non dipende dalla rete. Produce:

- `apps/backend/src/main/resources/static/media/music/*.m4a`
- `apps/backend/src/main/resources/static/media/covers/*.jpg`
- `apps/backend/src/main/resources/static/media/people/*.jpg`
- `apps/backend/src/main/resources/questions/media-it.json` (l'indice)

All'avvio il backend scrive `Banca media locale: N brani, M volti.` e serve i
file su `/media/...`. Quando l'indice c'è, il backend non chiama più iTunes,
TMDB o Wikipedia: quello che manca resta un segnaposto. Senza indice torna ai
servizi esterni come prima.

Dettagli utili:

- gli URL restituiti sono assoluti, ricavati dalla richiesta: funzionano sia da
  `localhost` sia dall'IP di rete della TV;
- l'indice salva anche descrizione ed estratto di Wikipedia: gli indizi delle
  Celebrità restano disponibili offline;
- `--music-only` / `--people-only` per rifare solo una delle due parti;
- rilanciandolo i file con lo stesso nome vengono riusati e l'indice riscritto;
- se un browser rifiuta l'anteprima `.m4a`, basta cambiare l'estensione in
  `.mp4` nell'indice (è lo stesso contenitore MP4);
- i file media e l'indice sono in `.gitignore`: si copiano sulla macchina che
  proietta il gioco, non nel repository.

---

## 10. Modello locale (Ollama su questa macchina)

Il backend non chiama nessun modello: serve solo a generare la banca domande una
volta. Lo script parla con qualsiasi endpoint compatibile OpenAI, quindi con un
modello locale non serve nessuna chiave e non c'è rate limit.

### 10.1 Installare Ollama (Windows)

```bash
winget install --id Ollama.Ollama --exact
ollama --version
curl http://localhost:11434/api/tags
```

Il server ascolta su `127.0.0.1:11434`. Se risponde `"models":[]` è pronto e
vuoto; se la connessione viene rifiutata, aprire l'app Ollama (oppure
`ollama serve`).

### 10.2 Quale modello su questa macchina

Scheda video **Radeon RX 580**: Ollama su Windows non usa ROCm per le GPU
Polaris, quindi l'inferenza gira su **CPU** con 31,8 GB di RAM.

| Modello | Download | Note |
| --- | --- | --- |
| `qwen3:8b` | 5,2 GB | scelta consigliata: buon italiano, entra nel disco |
| `qwen3:14b` | 9,3 GB | qualità migliore, circa il doppio del tempo |
| `qwen2.5:14b` | 9,0 GB | non-thinking: JSON più prevedibile, italiano solido |

Attenzione al disco: su questo PC restano pochi GB liberi, quindi un modello da
20-27B non è un'opzione.

```bash
ollama pull qwen3:8b
```

Se compare `part stalled`, rilanciare lo stesso comando: riprende dai pezzi già
scaricati (`ollama list` mostra il modello solo a download completo).

### 10.3 Prima prova

```bash
python generate.py --per-category 5 --categories Storia Sport \
    --base-url http://localhost:11434/v1/chat/completions \
    --model qwen3:8b --delay 0 --batch 4 --out prova.json
```

Controllare che `prova.json` contenga domande in italiano, con 4 opzioni, e che
`correctAnswer` sia identica a una di esse. I modelli locali sbagliano più spesso
dei provider grossi: le domande rotte vengono scartate da sole, ma vale la pena
leggere le prime righe a mano.

### 10.4 Banca completa

```bash
python generate.py --per-category 10 \
    --base-url http://localhost:11434/v1/chat/completions \
    --model qwen3:8b --delay 0 --batch 4
```

Aggiungere --merge per non perdere le domande gia presenti (comprese le IMAGE_BLUR scritte a mano).

Su CPU sono **ore**, non minuti: conviene lanciarlo la sera. Per non perdere il
lavoro fatto, procedere a blocchi di categorie con `--merge`:

```bash
python generate.py --per-category 10 --merge --categories Storia "Geografia e Viaggi" \
    --base-url http://localhost:11434/v1/chat/completions \
    --model qwen3:8b --delay 0 --batch 4
```

Consigli pratici con i modelli locali:

- `--delay 0`: nessun limite al minuto da rispettare.
- `--batch 4` (o 6): pacchetti piccoli, meno risposte troncate.
- `qwen3` ragiona prima di rispondere: se le risposte arrivano vuote o contengono
  solo il ragionamento, passare a `qwen2.5:14b`, che non è un modello "thinking".
- Se una categoria resta corta: rilanciare `--merge --categories <quella>`.
- Se non raccoglie niente, esce con errore e **non tocca** la banca esistente.

### 10.5 Musica e volti (nessun modello)

`generate_media.py` non usa LLM: scarica da iTunes e da Wikipedia/TMDB.

```bash
python scripts/generate-questions/generate_media.py --count-music 24
```

Produce `static/media/music/*.m4a`, `static/media/people/*.jpg` e l'indice
`questions/media-it.json` (tutti in `.gitignore`: si copiano a mano sulla
macchina che proietta il gioco).

### 10.6 Alternative

Vanno bene anche LM Studio (`http://localhost:1234/v1/chat/completions`) e
llama.cpp (`http://127.0.0.1:8080/v1/chat/completions`): cambiano solo
`--base-url` e `--model`.
