package com.pub_game_be.config;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Converte in VARCHAR le colonne H2 dichiarate ENUM da una versione vecchia
 * dello schema. Hibernate mappa gli enum come stringhe e un tipo ENUM nativo
 * rifiuta ogni valore aggiunto dopo la creazione della colonna: è così che
 * AZZARDO non riusciva a nascere su un database creato prima che esistesse.
 * I valori già scritti restano quelli; cambia solo il tipo della colonna.
 */
@Component
public class StaleEnumColumnFixer {
    private static final Logger log = LoggerFactory.getLogger(StaleEnumColumnFixer.class);

    private final JdbcTemplate jdbc;

    public StaleEnumColumnFixer(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void convertEnumColumns() {
        List<Map<String, Object>> columns = jdbc.queryForList(
                "SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                + "WHERE TABLE_SCHEMA = CURRENT_SCHEMA() AND DATA_TYPE = 'ENUM' "
                + "ORDER BY TABLE_NAME, COLUMN_NAME");
        for (Map<String, Object> column : columns) {
            String table = quoteIdentifier(String.valueOf(column.get("TABLE_NAME")));
            String name = quoteIdentifier(String.valueOf(column.get("COLUMN_NAME")));
            jdbc.execute("ALTER TABLE " + table + " ALTER COLUMN " + name + " SET DATA TYPE VARCHAR(255)");
            log.info("Colonna enum {}.{} convertita in VARCHAR.", table, name);
        }
    }

    private static String quoteIdentifier(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }
}
