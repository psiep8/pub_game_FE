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
 * Sessione di un dispositivo dentro una partita.
 *
 * <p>Il token è il segreto che il dispositivo riusa dopo una riconnessione:
 * permette di riprendere la stessa squadra senza reinserire il codice partita
 * e senza creare un secondo giocatore.</p>
 */
@Entity
@Table(name = "device_session", uniqueConstraints = {
        @UniqueConstraint(name = "uk_device_session_token", columnNames = { "session_token" }),
        @UniqueConstraint(name = "uk_device_session_team", columnNames = { "game_id", "team_key" })
})
@Data
@NoArgsConstructor
public class DeviceSessionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private Long gameId;

    @Column(name = "device_id", nullable = false, length = 128)
    private String deviceId;

    @Column(name = "session_token", nullable = false, length = 64)
    private String sessionToken;

    @Column(nullable = false, length = 16)
    private String role;

    private String playerName;

    @Column(name = "team_key", length = 128)
    private String teamKey;

    // Le sessioni legacy sono state emesse senza autenticazione e non sono attendibili.
    @Column(name = "security_version")
    private Integer securityVersion;

    @Column(name = "connection_id", length = 64)
    private String connectionId;

    @Column(name = "last_heartbeat_at")
    private Long lastHeartbeatAt;

    @Column(name = "first_seen_at")
    private Long firstSeenAt;

    private int reconnections;

    private boolean active;
}
