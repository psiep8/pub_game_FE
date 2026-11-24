package com.pub_game_be.config;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StaleEnumColumnFixerTest {
    private JdbcTemplate database(String name) {
        return new JdbcTemplate(new SingleConnectionDataSource(
                "jdbc:h2:mem:" + name + ";DB_CLOSE_DELAY=-1", "sa", "", true));
    }

    @Test
    void converteLeColonneEnumSenzaPerdereIValoriScritti() {
        JdbcTemplate db = database("stale-enum-fixer");
        db.execute("CREATE TABLE game_round (type ENUM('QUIZ', 'MUSIC'), status ENUM('VOTING'))");
        db.execute("CREATE TABLE other (kind ENUM('QUIZ'))");
        db.update("INSERT INTO game_round VALUES ('QUIZ', 'VOTING')");
        assertThatThrownBy(() -> db.update("INSERT INTO game_round VALUES ('AZZARDO', 'VOTING')"))
                .isInstanceOf(RuntimeException.class);

        new StaleEnumColumnFixer(db).convertEnumColumns();
        new StaleEnumColumnFixer(db).convertEnumColumns();

        db.update("INSERT INTO game_round VALUES ('AZZARDO', 'VOTING')");
        assertThat(db.queryForList("SELECT type FROM game_round ORDER BY type", String.class))
                .containsExactly("AZZARDO", "QUIZ");
        assertThat(db.queryForList("SELECT status FROM game_round", String.class))
                .containsOnly("VOTING");
        db.update("INSERT INTO other VALUES ('AZZARDO')");
        assertThat(db.queryForObject("SELECT kind FROM other", String.class)).isEqualTo("AZZARDO");
    }

    @Test
    void lasciaIntatteLeColonneGiaTestuali() {
        JdbcTemplate db = database("current-enum-fixer");
        db.execute("CREATE TABLE game_round (type VARCHAR(40), status VARCHAR(40))");
        db.update("INSERT INTO game_round VALUES ('QUIZ', 'VOTING')");

        new StaleEnumColumnFixer(db).convertEnumColumns();

        db.update("INSERT INTO game_round VALUES ('AZZARDO', 'VOTING')");
        assertThat(db.queryForList("SELECT type FROM game_round ORDER BY type", String.class))
                .containsExactly("AZZARDO", "QUIZ");
    }
}
