package com.pub_game_be.config;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StaleRoundTypeConstraintFixerTest {
    private JdbcTemplate database(String name) {
        return new JdbcTemplate(new SingleConnectionDataSource(
                "jdbc:h2:mem:" + name + ";DB_CLOSE_DELAY=-1", "sa", "", true));
    }

    @Test
    void migraSoloIlVecchioVincoloDelTipoPreservandoDatiEAltriVincoli() {
        JdbcTemplate db = database("stale-round-fixer");
        db.execute("CREATE TABLE game_round (id INT PRIMARY KEY, type VARCHAR(40), note VARCHAR(40), "
                + "CONSTRAINT old_round_type CHECK (type IN ('QUIZ', 'MUSIC', 'AIR_HOCKEY')), "
                + "CONSTRAINT note_check CHECK (note <> 'QUIZ'))");
        db.execute("CREATE TABLE unrelated (kind VARCHAR(40) CONSTRAINT unrelated_kind CHECK (kind IN ('QUIZ', 'OTHER')))");
        db.update("INSERT INTO game_round VALUES (1, 'AIR_HOCKEY', 'ok')");
        assertThatThrownBy(() -> db.update("INSERT INTO game_round VALUES (2, 'TENNIS_BATTLE', 'ok')"))
                .isInstanceOf(RuntimeException.class);

        StaleRoundTypeConstraintFixer fixer = new StaleRoundTypeConstraintFixer(db);
        fixer.dropStaleCheckConstraints();
        fixer.dropStaleCheckConstraints();

        db.update("INSERT INTO game_round VALUES (2, 'TENNIS_BATTLE', 'ok')");
        assertThat(db.queryForObject("SELECT type FROM game_round WHERE id=1", String.class)).isEqualTo("AIR_HOCKEY");
        assertThatThrownBy(() -> db.update("INSERT INTO game_round VALUES (3, 'INVALID', 'ok')"))
                .isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> db.update("INSERT INTO game_round VALUES (4, 'QUIZ', 'QUIZ')"))
                .isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> db.update("INSERT INTO unrelated VALUES ('INVALID')"))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void lasciaIntattoUnVincoloGiaAggiornato() {
        JdbcTemplate db = database("current-round-fixer");
        String values = java.util.Arrays.stream(com.pub_game_be.domain.enums.GameType.values())
                .map(type -> "'" + type.name() + "'").collect(java.util.stream.Collectors.joining(","));
        db.execute("CREATE TABLE game_round (type VARCHAR(40), CONSTRAINT current_type CHECK (type IN (" + values + "))) ");

        new StaleRoundTypeConstraintFixer(db).dropStaleCheckConstraints();
        db.update("INSERT INTO game_round VALUES ('TENNIS_BATTLE')");
        assertThatThrownBy(() -> db.update("INSERT INTO game_round VALUES ('INVALID')"))
                .isInstanceOf(RuntimeException.class);
    }
}
