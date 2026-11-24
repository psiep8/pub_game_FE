# PubGame BE — Backend Spring Boot

> **VERSIONE 2.5.0 — 24 novembre 2026.** Vince il codice; per il quadro completo
> del gioco e della scaletta vale il [`README.md`](../../README.md) della radice.

Backend **Spring Boot 4.2.0** su **Java 25 LTS**: REST e WebSocket STOMP nello stesso
processo, persistenza JPA, sessioni per dispositivo e checkpoint della TV.
Vive in `apps/backend` del monorepo.

## Requisiti

- JDK 25
- Maven 3.9+ (c'è `./mvnw`, e dalla radice `node scripts/mvn.mjs`)
- MySQL 8+ solo per il profilo `mysql`

## Avvio

```bash
# dalla radice
npm run dev:backend        # compile + spring-boot:run
npm run test:backend       # JUnit / Spring Boot Test
npm run build:backend      # package del jar

# oppure da apps/backend
./mvnw spring-boot:run
```

Il server parte su `http://0.0.0.0:8080`. In locale il database H2 vive su file
in `apps/backend/data/`; i profili `test-night` e `prod` usano file separati.

## Configurazione

Le variabili arrivano da `.env` (vedi `.env.example`) o dall'ambiente:

| Variabile | A cosa serve |
|---|---|
| `CONTROL_SECRET` | Apre le sessioni TV e regia (almeno 32 caratteri) |
| `ALLOWED_ORIGINS` | Origini esatte ammesse su REST e WebSocket |
| `GROQ_API_KEY` | Solo per rigenerare la banca domande |
| `TMDB_API_KEY` | Foto di “Indovina chi” quando la banca locale non c'è |

Senza `GROQ_API_KEY` e `TMDB_API_KEY` il gioco funziona con la banca JSON
pre-generata. La configurazione sta in `src/main/resources/application*.yml`.

## Struttura

```text
src/main/java/com/pub_game_be/
├── config/        WebSocket (STOMP + SockJS), forward delle route SPA
├── controller/    REST e STOMP
├── domain/        entità e enum
├── dto/           payload
├── reliability/   sessioni, stato, sync, checkpoint, prova pulsanti
├── repository/    JPA
├── security/      filtro sessioni e CORS
└── service/       logica di gioco e domande
src/main/resources/questions/   banche pre-generate (983 quiz + 360 azzardo + 110 bomba + 222 timeline)
```

L'autorità su punteggi e avanzamento è del server; la TV conserva la
presentazione. La matrice di ripresa dopo un refresh è in
[`docs/ROADMAP-POST-PRIMA-SERATA.md`](../../docs/ROADMAP-POST-PRIMA-SERATA.md).
