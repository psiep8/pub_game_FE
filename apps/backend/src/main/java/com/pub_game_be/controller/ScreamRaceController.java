package com.pub_game_be.controller;

import com.pub_game_be.dto.ScreamDto;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Gara di urla: ogni partita ha la sua classifica.
 *
 * Prima lo stato era unico per tutto il backend, quindi due tavoli che
 * giocavano insieme si mescolavano (e un reset cancellava anche la gara
 * dell'altro).
 */
@Controller
public class ScreamRaceController {

    private static final int FINISHERS_TO_END = 3;

    private static final class RaceState {
        final Map<String, Double> progress = new ConcurrentHashMap<>();
        final Map<String, Integer> finishOrder = new ConcurrentHashMap<>();
        final AtomicInteger finishCounter = new AtomicInteger();
        volatile boolean ended;
    }

    private final SimpMessagingTemplate messagingTemplate;
    private final Map<Integer, RaceState> races = new ConcurrentHashMap<>();

    public ScreamRaceController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /** Riceve l'urlo di un giocatore e aggiorna solo la gara di quella partita. */
    @MessageMapping("/scream")
    public void handleScream(ScreamDto scream) {
        int gameId = scream.gameId;
        RaceState state = races.computeIfAbsent(gameId, id -> new RaceState());
        if (state.ended) {
            return;
        }

        String playerName = scream.playerName == null || scream.playerName.isBlank()
                ? "anonimo"
                : scream.playerName;
        double intensity = Double.isNaN(scream.intensity) ? 0 : Math.max(0, Math.min(100, scream.intensity));

        double currentProgress = state.progress.getOrDefault(playerName, 0.0);
        double newProgress = Math.min(100.0, currentProgress + intensity / 20.0);
        state.progress.put(playerName, newProgress);

        System.out.println("🎤 gioco " + gameId + " - " + playerName + " urla ("
                + String.format("%.1f", intensity) + ") → " + String.format("%.1f%%", newProgress));

        if (newProgress >= 100.0 && !state.finishOrder.containsKey(playerName)) {
            int position = state.finishCounter.incrementAndGet();
            state.finishOrder.put(playerName, position);

            Map<String, Object> winnerMsg = new HashMap<>();
            winnerMsg.put("action", "PLAYER_FINISHED");
            winnerMsg.put("playerName", playerName);
            winnerMsg.put("position", position);
            winnerMsg.put("points", calculatePoints(position));
            messagingTemplate.convertAndSend("/topic/game/" + gameId, Optional.of(winnerMsg));

            if (position >= FINISHERS_TO_END) {
                endRace(gameId, state);
            }
        }

        Map<String, Object> updateMsg = new HashMap<>();
        updateMsg.put("action", "SCREAM_UPDATE");
        updateMsg.put("playerName", playerName);
        updateMsg.put("progress", newProgress);
        updateMsg.put("intensity", intensity);
        messagingTemplate.convertAndSend("/topic/game/" + gameId, Optional.of(updateMsg));
    }

    private void endRace(int gameId, RaceState state) {
        state.ended = true;

        Map<String, Object> endMsg = new HashMap<>();
        endMsg.put("action", "RACE_ENDED");
        endMsg.put("finalStandings", state.finishOrder);
        messagingTemplate.convertAndSend("/topic/game/" + gameId, Optional.of(endMsg));

        System.out.println("🏁 gioco " + gameId + " - gara terminata: " + state.finishOrder);
    }

    private int calculatePoints(int position) {
        return switch (position) {
            case 1 -> 1000;
            case 2 -> 500;
            case 3 -> 250;
            default -> 0;
        };
    }

    /** Reset della sola partita indicata (nuova gara o ritorno alla lobby). */
    @MessageMapping("/scream/reset")
    public void resetRace(Map<String, Object> payload) {
        Object rawGameId = payload.getOrDefault("gameId", 1);
        int gameId = rawGameId instanceof Number number ? number.intValue() : 1;

        races.remove(gameId);

        Map<String, Object> resetMsg = new HashMap<>();
        resetMsg.put("action", "RACE_RESET");
        messagingTemplate.convertAndSend("/topic/game/" + gameId, Optional.of(resetMsg));

        System.out.println("🔄 gioco " + gameId + " - gara resettata");
    }
}
