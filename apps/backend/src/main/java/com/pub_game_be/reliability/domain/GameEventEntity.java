package com.pub_game_be.reliability.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Evento di gioco persistito.
 *
 * <p>La coppia (gameId, seq) è univoca: due eventi non possono occupare la
 * stessa posizione, quindi un doppio invio concorrente viene rifiutato dal
 * database invece di duplicare lo stato. {@code eventId} permette al client di
 * riconoscere un evento già applicato.</p>
 */
@Entity
@Table(name = "game_event", uniqueConstraints = {
        @UniqueConstraint(name = "uk_game_event_seq", columnNames = { "game_id", "seq" }),
        @UniqueConstraint(name = "uk_game_event_event_id", columnNames = { "event_id" })
})
@Data
@NoArgsConstructor
public class GameEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private Long gameId;

    @Column(nullable = false)
    private long seq;

    @Column(name = "event_id", nullable = false, length = 64)
    private String eventId;

    @Column(nullable = false, length = 64)
    private String type;

    @Column(columnDefinition = "TEXT")
    private String payload;

    private String roundKey;

    private String deviceId;

    @Column(nullable = false)
    private long createdAt;
}
