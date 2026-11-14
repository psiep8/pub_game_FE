package com.pub_game_be.config;

import com.pub_game_be.domain.enums.GameType;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Aggiorna il vecchio CHECK H2 dell'enum dei round senza perdere valori storici. */
@Component
public class StaleRoundTypeConstraintFixer {
    private static final Logger log = LoggerFactory.getLogger(StaleRoundTypeConstraintFixer.class);
    private static final Pattern ENUM_CHECK = Pattern.compile(
            "(?i)^\\s*\\(*\\s*\"?TYPE\"?\\s+IN\\s*\\(\\s*('[A-Z0-9_]+'(?:\\s*,\\s*'[A-Z0-9_]+')*)\\s*\\)\\s*\\)*\\s*$");
    private static final Pattern VALUE = Pattern.compile("'([A-Z0-9_]+)'");
    private final JdbcTemplate jdbc;

    public StaleRoundTypeConstraintFixer(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void dropStaleCheckConstraints() {
        var checks = jdbc.queryForList(
                "SELECT ccu.TABLE_SCHEMA, ccu.TABLE_NAME, cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE "
                + "FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc "
                + "JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu "
                + "ON ccu.CONSTRAINT_CATALOG = cc.CONSTRAINT_CATALOG "
                + "AND ccu.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA "
                + "AND ccu.CONSTRAINT_NAME = cc.CONSTRAINT_NAME "
                + "WHERE ccu.TABLE_SCHEMA = CURRENT_SCHEMA() "
                + "AND ccu.TABLE_NAME = 'GAME_ROUND' AND ccu.COLUMN_NAME = 'TYPE'");
        Set<String> current = Arrays.stream(GameType.values()).map(Enum::name)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        for (var check : checks) {
            String clause = String.valueOf(check.get("CHECK_CLAUSE"));
            Matcher expression = ENUM_CHECK.matcher(clause);
            if (!expression.matches()) {
                log.warn("CHECK sul tipo di round non riconosciuto: {}. Nessuna modifica automatica.", check.get("CONSTRAINT_NAME"));
                continue;
            }
            Set<String> values = new LinkedHashSet<>();
            Matcher matcher = VALUE.matcher(expression.group(1));
            while (matcher.find()) values.add(matcher.group(1));
            if (!values.contains("QUIZ") || values.containsAll(current)) continue;
            values.addAll(current);
            String schema = quoteIdentifier(String.valueOf(check.get("TABLE_SCHEMA")));
            String table = quoteIdentifier(String.valueOf(check.get("TABLE_NAME")));
            String oldName = quoteIdentifier(String.valueOf(check.get("CONSTRAINT_NAME")));
            String newName = quoteIdentifier("ROUND_TYPE_" + UUID.randomUUID().toString().replace("-", ""));
            String allowed = values.stream().map(value -> "'" + value + "'").collect(Collectors.joining(", "));
            // Il nuovo vincolo viene aggiunto prima di eliminare quello vecchio:
            // se l'aggiunta fallisce, il vincolo originale resta invariato.
            jdbc.execute("ALTER TABLE " + schema + "." + table + " ADD CONSTRAINT " + newName
                    + " CHECK (\"TYPE\" IN (" + allowed + "))");
            jdbc.execute("ALTER TABLE " + schema + "." + table + " DROP CONSTRAINT " + oldName);
            log.info("Vincolo di tipo round {} aggiornato su {}.{}", oldName, schema, table);
        }
    }

    private static String quoteIdentifier(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }
}
