# PubGame — variante A in un container

Due configurazioni, stesso codice e stessa immagine:

| Configurazione | File | Accesso | Uso |
|---|---|---|---|
| Test tra amici | `docker-compose.test.yml` | `http://<IP>:8080/tv` | prova, senza dominio |
| Servizio | `docker-compose.service.yml` | `https://<DOMAIN>/tv` | serate al pub |

In entrambi i casi il container serve **frontend, API e WebSocket** sulla stessa
origine. Non serve un reverse proxy separato per il test; per il servizio Caddy
aggiunge HTTPS e il dominio.

## Requisiti

- Docker con Compose v2.
- Un server con 2 GB di RAM (il JVM sta comodo).
- Per il servizio: un dominio con record `A` verso l'IP del server.
- `CONTROL_SECRET` di almeno 32 caratteri casuali.

## Test tra amici, senza dominio

```bash
cp deploy/.env.test.example deploy/.env
# genera il segreto con: openssl rand -hex 32
# apri deploy/.env e incolla il valore in CONTROL_SECRET

docker compose -f deploy/docker-compose.test.yml --env-file deploy/.env up -d --build
```

Poi apri:

- TV: `http://<IP-del-server>:8080/tv`
- Telefoni: inquadrano il QR mostrato dalla TV, oppure `http://<IP-del-server>:8080/play`

Se la 8080 è già occupata, aggiungi `TEST_PORT=18080` a `deploy/.env` e usa
lo stesso numero nell'URL (`http://<IP-del-server>:18080/tv`).

La porta 8080 deve essere raggiungibile dai telefoni: apri la porta nel firewall
del provider o nel security group. Non c'è HTTPS: il gioco funziona, ma il
telefono **non può installare la scorciatoia PWA** (il service worker richiede
un contesto sicuro). Per l'icona serve il servizio con dominio o un tunnel HTTPS.

## Servizio con dominio

```bash
cp deploy/.env.service.example deploy/.env
# genera il segreto con: openssl rand -hex 32
# apri deploy/.env: imposta DOMAIN e incolla il valore in CONTROL_SECRET

docker compose -f deploy/docker-compose.service.yml --env-file deploy/.env up -d --build
```

Prima di avviare, crea il record DNS:

```
A    play.example.it    <IP-del-server>
```

Caddy ottiene e rinnova il certificato da solo. Apri `https://play.example.it/tv`.

## Cosa viene salvato

- Test: volume Docker `deploy_pubgame-test-data` → `/app/data`.
- Servizio: volume Docker `deploy_pubgame-data` → `/app/data`.
- Il database H2 e la classifica vivono nel volume; i container possono essere
  ricreati senza perdere le partite.

Backup del volume del servizio:

```bash
docker run --rm \
  -v deploy_pubgame-data:/data:ro \
  -v "$PWD:/backup" \
  alpine tar czf /backup/pubgame-data-$(date +%F).tgz -C /data .
```

Fermati prima il container se vuoi un backup coerente di H2:

```bash
docker compose -f deploy/docker-compose.service.yml --env-file deploy/.env stop app
```

## Media (canzoni e foto)

`apps/backend/src/main/resources/static/media` è ignorato da git: se vuoi la
banca locale, copiala prima della build. Senza media il backend usa i fallback
(anteprime iTunes online o domande senza immagine).

## Aggiornamento

```bash
git pull
docker compose -f deploy/docker-compose.service.yml --env-file deploy/.env up -d --build
```

Il volume dati resta; l'immagine viene ricostruita con il nuovo codice.

## Sicurezza

- `CONTROL_SECRET` non va condiviso con i giocatori.
- `ALLOWED_ORIGINS=*` è solo per il test: il servizio usa l'URL esatto del dominio.
- Il test senza HTTPS è pensato per pochi amici, non per un servizio pubblico.
- Per il servizio, tieni il firewall su 80/443 (e 22 per SSH); la porta 8080 del
  container non è esposta all'esterno.
