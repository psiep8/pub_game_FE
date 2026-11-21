package com.pub_game_be.reliability.repository;

import com.pub_game_be.reliability.domain.GameEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GameEventRepository extends JpaRepository<GameEventEntity, Long> {

    List<GameEventEntity> findByGameIdAndSeqGreaterThanOrderBySeqAsc(Long gameId, long seq);

    List<GameEventEntity> findTop50ByGameIdOrderBySeqDesc(Long gameId);

    Optional<GameEventEntity> findFirstByGameIdOrderBySeqDesc(Long gameId);

    Optional<GameEventEntity> findFirstByGameIdAndTypeOrderBySeqDesc(Long gameId, String type);

    Optional<GameEventEntity> findByEventId(String eventId);

    long countByGameId(Long gameId);

    long deleteByGameId(Long gameId);
}
