# syntax=docker/dockerfile:1
#
# PubGame — immagine fullstack (variante A)
# Angular viene compilato e copiato dentro il jar Spring Boot: un solo
# container serve TV, telefoni, API e WebSocket sulla stessa origine.
#
# Build:
#   docker build -t pubgame:1.0.0 .
#   docker build --build-arg NG_CONFIG=test-night -t pubgame:test .
#
# NG_CONFIG: production (pub/dominio) oppure test-night (serata di prova).

FROM node:24-bookworm-slim AS frontend

WORKDIR /workspace
ARG NG_CONFIG=production

# Prima i manifest: il layer delle dipendenze resta in cache.
COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci

COPY apps/frontend apps/frontend
RUN cd apps/frontend && npx ng build --configuration "${NG_CONFIG}"

FROM maven:3.9-eclipse-temurin-25 AS backend

WORKDIR /workspace

COPY apps/backend/pom.xml apps/backend/mvnw ./
COPY apps/backend/.mvn .mvn
RUN chmod +x mvnw && ./mvnw -q -DskipTests dependency:go-offline

COPY apps/backend/src src
# Il contenuto di browser/ finisce nella radice statica: index.html, JS, CSS,
# icone e manifest PWA vengono serviti da Spring Boot.
COPY --from=frontend /workspace/apps/frontend/dist/pubgameFE/browser/ ./src/main/resources/static/
RUN ./mvnw -q -DskipTests package

FROM eclipse-temurin:25-jre-noble

WORKDIR /app

# UID/GID fissi: il volume dei dati mantiene i permessi anche senza lookup
# del nome utente nel container.
RUN groupadd --gid 10001 pubgame \
    && useradd --uid 10001 --gid pubgame --home-dir /app --shell /usr/sbin/nologin pubgame \
    && mkdir -p /app/data \
    && chown -R 10001:10001 /app

COPY --from=backend --chown=10001:10001 /workspace/target/pub_game_BE-*.jar /app/app.jar

USER 10001:10001

ENV SERVER_PORT=8080 \
    SERVER_ADDRESS=0.0.0.0 \
    DB_URL="jdbc:h2:file:/app/data/pubgame;DB_CLOSE_DELAY=-1" \
    JAVA_OPTS="-XX:MaxRAMPercentage=75.0"

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
