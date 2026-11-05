package com.pub_game_be.reliability.repository;

import com.pub_game_be.reliability.domain.QuestionUsageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface QuestionUsageRepository extends JpaRepository<QuestionUsageEntity, Long> {

    Optional<QuestionUsageEntity> findByGameIdAndQuestionKey(Long gameId, String questionKey);

    List<QuestionUsageEntity> findByGameId(Long gameId);

    List<QuestionUsageEntity> findAll();

    void deleteByGameId(Long gameId);

    long countByGameId(Long gameId);
}
