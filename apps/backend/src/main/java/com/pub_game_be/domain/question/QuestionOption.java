package com.pub_game_be.domain.question;

import com.pub_game_be.domain.category.Category;
import com.pub_game_be.domain.enums.QuestionType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Entity
@Table(name = "question_option")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class QuestionOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "opt_value")
    private String value;

    private boolean correct;

    @ManyToOne
    private Question question;
}
