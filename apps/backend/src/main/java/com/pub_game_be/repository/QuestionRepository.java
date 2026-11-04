package com.pub_game_be.repository;

import com.pub_game_be.domain.question.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface QuestionRepository extends JpaRepository<Question, Long> {
    List<Question> findByCategoryId(Long categoryId);

    @Query(value = "SELECT * FROM question WHERE category_id = :categoryId ORDER BY RAND() LIMIT 1", nativeQuery = true)
    Optional<Question> findRandomByCategory(@Param("categoryId") Long categoryId);

    @Query(value = "SELECT * FROM question WHERE category_id = :catId AND difficulty = :diff ORDER BY RAND() LIMIT 1", nativeQuery = true)
    Optional<Question> findRandomByCategoryAndDifficulty(@Param("catId") Long catId, @Param("diff") String diff);
}
