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
 * Domanda già uscita in una partita.
 *
 * <p>Sta nel database, non in memoria: un riavvio del backend non riapre il
 * pool e la stessa domanda non torna sul palco. Il vincolo univoco su
 * (gameId, questionKey) rende atomica l'assegnazione: due richieste concorrenti
 * non possono riservare la stessa domanda.</p>
 */
@Entity
@Table(name = "question_usage", uniqueConstraints = {
        @UniqueConstraint(name = "uk_question_usage_key", columnNames = { "game_id", "question_key" })
})
@Data
@NoArgsConstructor
public class QuestionUsageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private Long gameId;

    @Column(name = "question_key", nullable = false, length = 512)
    private String questionKey;

    @Column(name = "question_id", length = 128)
    private String questionId;

    @Column(length = 32)
    private String mode;

    @Column(name = "round_index")
    private Integer roundIndex;

    @Column(name = "used_at", nullable = false)
    private long usedAt;
}
