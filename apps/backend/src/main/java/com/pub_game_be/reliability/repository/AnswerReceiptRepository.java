package com.pub_game_be.reliability.repository;

import com.pub_game_be.reliability.domain.AnswerReceiptEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AnswerReceiptRepository extends JpaRepository<AnswerReceiptEntity, Long> {

    Optional<AnswerReceiptEntity> findByGameIdAndCommandKey(Long gameId, String commandKey);
}
