package com.pub_game_be.reliability.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Stato autorevole di una partita, salvato a ogni mutazione.
 *
 * <p>Non sostituisce {@code Game} e {@code GameRound}: li affianca con quello
 * che serve al recupero dopo un riavvio, cioè versione, sequenza eventi e
 * riferimenti temporali del round (apertura e scadenza) calcolati dal server.</p>
 */
@Entity
@Table(name = "game_state")
@Data
@NoArgsConstructor
public class GameStateEntity {

    @Id
    private Long gameId;

    /** Cresce a ogni mutazione: i client confrontano questa con la loro copia. */
    private long version;

    /** Ultima sequenza evento registrata per la partita. */
    private long seq;

    private String status;

    private int roundIndex;

    private String roundType;

    /** Identificativo stabile del round corrente (es. g1-r7). */
    private String roundKey;

    @Column(columnDefinition = "TEXT")
    private String payload;

    private Long roundStartedAt;

    private Long roundDeadlineAt;

    private Long updatedAt;

    private Long lastSnapshotAt;
}
