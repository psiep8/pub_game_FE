package com.pub_game_be.config;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Il file H2 della serata è nato quando {@code GameType} aveva ancora valori
 * diversi: la colonna del tipo di round conserva un CHECK con quella vecchia
 * lista e rifiuta i tipi aggiunti dopo (per esempio {@code TENNIS_BATTLE}).
 * Il risultato era un 500 sui giochi a prenotazione.
 *
 * <p>
 * {@code ddl-auto: update} non tocca i vincoli già presenti, quindi li
 * rimuoviamo all'avvio. I valori restano validati dall'enum lato applicazione.
 * </p>
 */
@Component
public class StaleRoundTypeConstraintFixer {

    private static final Logger log = LoggerFactory.getLogger(StaleRoundTypeConstraintFixer.class);

    private final JdbcTemplate jdbc;

    public StaleRoundTypeConstraintFixer(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void dropStaleCheckConstraints() {
        for (String[] target : staleConstraints()) {
            String table = target[0];
            String name = target[1];
            try {
                jdbc.execute("ALTER TABLE \"" + table + "\" DROP CONSTRAINT \"" + name + "\"");
                log.info("Vincolo obsoleto {} rimosso da {}", name, table);
            } catch (RuntimeException e) {
                log.warn("Vincolo {} su {} non rimosso: {}", name, table, e.getMessage());
            }
        }
    }

    /** Vincoli CHECK che enumerano i vecchi valori dell'enum dei round. */
    private List<String[]> staleConstraints() {
        List<String[]> found = new ArrayList<>();
        try {
            jdbc.query(
                    "SELECT ccu.TABLE_NAME, cc.CONSTRAINT_NAME "
                            + "FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc "
                            + "JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu "
                            + "  ON ccu.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA "
                            + " AND ccu.CONSTRAINT_NAME = cc.CONSTRAINT_NAME "
                            + "WHERE cc.CHECK_CLAUSE LIKE '%QUIZ%'",
                    rs -> {
                        found.add(new String[] { rs.getString(1), rs.getString(2) });
                    });
        } catch (RuntimeException e) {
            log.warn("Lettura dei vincoli CHECK non riuscita: {}", e.getMessage());
        }
        return found;
    }
}
