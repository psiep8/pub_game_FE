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
 * Ricevuta di un comando già andato a buon fine.
 *
 * <p>Il vincolo univoco su (gameId, commandKey) è ciò che rende idempotente il
 * retry di un telefono: due invii dello stesso comando producono un solo
 * effetto, e il secondo riceve la stessa risposta del primo.</p>
 */
@Entity
@Table(name = "answer_receipt", uniqueConstraints = {
        @UniqueConstraint(name = "uk_answer_receipt_key", columnNames = { "game_id", "command_key" })
})
@Data
@NoArgsConstructor
public class AnswerReceiptEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private Long gameId;

    @Column(name = "command_key", nullable = false, length = 128)
    private String commandKey;

    @Column(nullable = false, length = 48)
    private String kind;

    @Column(columnDefinition = "TEXT")
    private String response;

    private String deviceId;

    @Column(nullable = false)
    private long createdAt;
}
