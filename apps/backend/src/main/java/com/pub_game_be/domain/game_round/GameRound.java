package com.pub_game_be.domain.game_round;

import com.pub_game_be.domain.enums.GameType;
import com.pub_game_be.domain.enums.RoundStatus;
import com.pub_game_be.domain.game.Game;
import com.pub_game_be.domain.question.Question;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "game_round")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GameRound {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private Game game;

    private int roundIndex;

    @ManyToOne
    @JoinColumn(name = "question_id")
    private Question question;

    @Column(columnDefinition = "json")
    private String payload;

    @Enumerated(EnumType.STRING)
    private GameType type = GameType.QUIZ;

    @Enumerated(EnumType.STRING)
    private RoundStatus status = RoundStatus.CREATED;
}
