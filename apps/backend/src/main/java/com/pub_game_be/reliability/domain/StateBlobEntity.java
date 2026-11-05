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
 * Stato serializzato di un pezzo di partita (round Timeline, prezzi, arena).
 *
 * <p>Serve a far sopravvivere al riavvio ciò che prima viveva solo in memoria:
 * round in corso, risposte già accettate e punteggi. È volutamente un blob JSON
 * con chiave stabile, non un'astrazione nuova: proporzionato all'app esistente.</p>
 */
@Entity
@Table(name = "state_blob", uniqueConstraints = {
        @UniqueConstraint(name = "uk_state_blob_key", columnNames = { "game_id", "blob_key" })
})
@Data
@NoArgsConstructor
public class StateBlobEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private Long gameId;

    @Column(name = "blob_key", nullable = false, length = 96)
    private String blobKey;

    @Column(columnDefinition = "TEXT")
    private String payload;

    @Column(name = "updated_at", nullable = false)
    private long updatedAt;
}
