package com.pub_game_be.reliability.repository;

import com.pub_game_be.reliability.domain.DeviceSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceSessionRepository extends JpaRepository<DeviceSessionEntity, Long> {

    Optional<DeviceSessionEntity> findBySessionToken(String sessionToken);

    Optional<DeviceSessionEntity> findFirstByGameIdAndDeviceIdAndRoleOrderByLastHeartbeatAtDesc(
            Long gameId, String deviceId, String role);

    List<DeviceSessionEntity> findByGameIdOrderByLastHeartbeatAtDesc(Long gameId);
}
