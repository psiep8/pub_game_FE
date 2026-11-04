package com.pub_game_be.repository;

import com.pub_game_be.domain.question.Question;
import com.pub_game_be.domain.question.QuestionOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface QuestionOptionRepository extends JpaRepository<QuestionOption, Long> {
}
