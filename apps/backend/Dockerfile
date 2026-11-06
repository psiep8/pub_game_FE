# ── Build ───────────────────────────────────────────────────────────────
# Il backend richiede JDK 25 (maven-enforcer), quindi l'immagine di build
# include già la toolchain giusta: nessuna dipendenza dal JDK della macchina.
FROM maven:3.9-eclipse-temurin-25 AS build

WORKDIR /workspace

# Prima i file di build: il layer delle dipendenze resta in cache finché il
# pom non cambia.
COPY pom.xml mvnw ./
COPY .mvn .mvn
RUN chmod +x mvnw && ./mvnw -q -DskipTests dependency:go-offline

COPY src src
RUN ./mvnw -q -DskipTests package

# ── Runtime ───────────────────────────────────────────────────────────────
FROM eclipse-temurin:25-jre

WORKDIR /app

# L'app usa H2 su file: la cartella data è un volume, così partite e round
# sopravvivono al riavvio del container.
RUN groupadd --system pubgame \
    && useradd --system --gid pubgame --home-dir /app pubgame \
    && mkdir -p /app/data \
    && chown -R pubgame:pubgame /app

COPY --from=build --chown=pubgame:pubgame /workspace/target/pub_game_BE-*.jar /app/app.jar

USER pubgame

ENV SERVER_PORT=8080 \
    SERVER_ADDRESS=0.0.0.0 \
    DB_URL="jdbc:h2:file:/app/data/pubgame;DB_CLOSE_DELAY=-1" \
    JAVA_OPTS="-XX:MaxRAMPercentage=75.0"

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
