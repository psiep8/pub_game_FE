# Codice e asset senza chiamanti (23 novembre 2026)

Scansione fatta sul repository alla 2.2.0 e **ripetuta alla 2.3.1** per la
pulizia totale. In quel giro `ScreamDto` è stato rimosso; il resto è rimasto. Obiettivo: sapere cosa non è più usato senza
togliere niente che abbia chiamanti.

## Metodo

1. Elenco di tutti i file sotto `apps/frontend/src` e `apps/backend/src`
   (311 fra codice, stili e dati; esclusi `node_modules`, `target`, `dist`).
2. Per ogni classe dichiarata nel file, conteggio delle occorrenze del nome in
   **tutti gli altri file** del progetto, separando le occorrenze nei `.spec.ts`.
3. Gli asset (`apps/frontend/public/assets`, `apps/frontend/public/maps`) sono
   stati confrontati con i riferimenti nel codice e nei CSS.

Il conteggio per nome è volutamente grezzo: un numero a zero è un indizio, non
una prova. Le classi Spring, i test JUnit e i doppi di test risultano tutti a
zero perché nessuno li nomina nel sorgente — li carica il framework o li
seleziona il runner.

## Esito

Su 311 file, **70 classi non hanno riferimenti per nome fuori dal proprio
file**. Una, `ScreamDto`, è stata rimossa nella pulizia del 23 novembre 2026;
le altre 69 restano.

| Gruppo | Quante | Perché non è codice morto |
| --- | --- | --- |
| `@Component`, `@Service`, `@Configuration`, `@RestController` del backend (`DataInitializer`, `LoggingConfig`, `SecurityConfig`, `SpaForwardController`, `WebManifestController`, `BombaController`, `CategoryController`, `QuestionController`, `QuizController`, `ButtonTestController`, `PlayerRequestBodyAdvice`, `RestTemplateConfig`) | 12 | Li istanzia Spring e li raggiunge per annotazione o per rotta HTTP |
| Test JUnit (`*Test`, `*Tests`) | 33 | Li esegue Surefire; il nome non compare altrove per definizione |
| Doppi e utilità di test Angular (`FakeButtonTestService`, `BroadcastedStatus`) | 2 | Usati nei `.spec.ts` come valore, non come nome di classe |
| Tipi e opzioni dichiarati nello stesso file del servizio che li usa (`RoundConfig`, `GameRoundPayload`, `MarbleRollStyle`, `TrackPiece`, `BlackjackRow`, `UltimaSpiaggiaRow`, `LetterDeckOptions`, `AzzardoMedia`, `DemoScoreRow`, `TvPauseHooks`, …) | 21 | Interfacce e type alias consumati strutturalmente: TypeScript non li nomina al punto d'uso |
| `QuestionGeneratorService` | 1 | **Caso reale** (sotto) |
| ~~`ScreamDto`~~ | ~~1~~ | **Rimosso** il 23/11/2026: nessun altro file lo nominava |

## I due casi reali

### `ScreamDto` — rimosso

`apps/backend/src/main/java/com/pub_game_be/dto/ScreamDto.java` era un DTO di 17
righe senza chiamanti: il frontend manda `{gameId, playerName, intensity}` come
oggetto semplice su `sendScream`, e il backend non lo deserializzava in quella
classe. La rimozione è del 23 novembre 2026, dopo `grep` su tutto il progetto
(nessun controller, servizio o test lo nominava) e con la suite backend verde.

### `QuestionGeneratorService`

`apps/backend/src/main/java/com/pub_game_be/service/QuestionGeneratorService.java`
(592 righe) genera domande e indizi con l'API Groq. Oggi:

- non è iniettato in nessun altro bean: nessun costruttore o campo lo chiede;
- non ha test;
- non espone rotte: nessun controller lo nomina;
- le sue proprietà `groq.api.key`, `groq.api.model`, `groq.api.temperature` e
  `groq.api.image-blur-temperature` non compaiono in
  `application.properties`, quindi restano ai valori di default e la chiave è
  vuota.

È quindi codice non raggiungibile. **Non è stato rimosso**: è un'integrazione
opzionale di 592 righe e toglierla è una decisione di prodotto (tenerla per una
futura generazione di contenuti, o eliminarla insieme alle proprietà Groq),
non una pulizia da fare di nascosto dentro un intervento di documentazione.
Se si decide di toglierla, il taglio è isolato: la classe e le quattro
proprietà `groq.*`.

## Controprova: `AppleMusicCuratorService` non è morto

Sembrava un candidato, perché il nome non compare in nessun `.spec.ts` del
frontend e non ha rotte. In realtà ha tre chiamanti reali:
`QuestionBankService` (banca musicale), `AzzardoMediaService` (brani del round
Paesi) e il proprio test. Resta. È l'esempio del perché il conteggio per nome
da solo non basta a cancellare.

## Asset

| Cosa | Esito |
| --- | --- |
| `public/assets/fonts/*.woff2` (4 file) | Usati: `src/styles.css` li carica con `@font-face` |
| `public/assets/audio/**/.gitkeep` (7 cartelle) | Segnaposto di cartella, servono a tenere la struttura |
| `public/maps/*.svg` (64 sagome) | Usati a runtime: la TV del round Paesi di Azzardo compone l'URL dalla sigla del paese e ripiega sulla bandiera Flagcdn se la sagoma manca (`public/maps/README.md`) |
| `public/sim-boot.html`, `sim-duo.html`, `sim-rounds.html`, `quad.html` | Pagine di prova usate da `scripts/sim/match.mjs` e dalla regia; `sim-boot.html` e `sim-duo.html` sono anche in whitelist in `SecurityConfig` |
| `static/media/*` del backend | Banca locale esclusa da git, non è codice: vedi `docs/SETUP-LOCALE.md`, sezione 4.1 |

Nessun asset è stato rimosso: quelli che il codice non nomina sono caricati per
convenzione (font, mappe) o servono alle simulazioni.

## Come ripetere la scansione

Con ripgrep, per una classe sospetta:

```
rg -n --glob '!node_modules' --glob '!target' 'NomeClasse' apps
```

Se le uniche righe sono la dichiarazione e i `.spec.ts`, la classe va guardata a
mano: può essere Spring, un test o un tipo strutturale. La scansione completa
usata qui è lo stesso conteggio fatto in un solo passaggio su tutti i file, con
i `.spec.ts` contati a parte.
