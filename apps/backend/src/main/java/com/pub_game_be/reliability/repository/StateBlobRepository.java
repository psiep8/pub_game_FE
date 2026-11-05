package com.pub_game_be.reliability.repository;

import com.pub_game_be.reliability.domain.StateBlobEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StateBlobRepository extends JpaRepository<StateBlobEntity, Long> {

    Optional<StateBlobEntity> findByGameIdAndBlobKey(Long gameId, String blobKey);

    void deleteByGameId(Long gameId);
}
