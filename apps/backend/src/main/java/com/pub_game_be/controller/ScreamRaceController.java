package com.pub_game_be.controller;

import com.pub_game_be.dto.ScreamDto;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Controller
public class ScreamRaceController {

    private final SimpMessagingTemplate messagingTemplate;
    
    // Track progress: playerName -> progress (0-100)
    private final Map<String, Double> teamProgress = new ConcurrentHashMap<>();
    
    // Track position: playerName -> position (1st, 2nd, 3rd...)
    private final Map<String, Integer> finishOrder = new ConcurrentHashMap<>();
    
    private int finishCounter = 0;
    private boolean raceEnded = false;

    public ScreamRaceController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * 🎤 Riceve urlo dal giocatore
     */
    @MessageMapping("/scream")
    public void handleScream(ScreamDto scream) {
        if (raceEnded) {
            return; // Gara finita, ignora urli
        }

        String playerName = scream.playerName;
        double intensity = Math.max(0, Math.min(100, scream.intensity)); // Clamp 0-100

        // 🏃 Calcola avanzamento (intensity / 20 = max 5% per urlo)
        double currentProgress = teamProgress.getOrDefault(playerName, 0.0);
        double increment = intensity / 20.0; // Max 5% per urlo forte
        double newProgress = Math.min(100.0, currentProgress + increment);
        
        teamProgress.put(playerName, newProgress);

        System.out.println("🎤 " + playerName + " urla! Intensità: " + 
                          String.format("%.1f", intensity) + 
                          " → Progresso: " + String.format("%.1f%%", newProgress));

        // 🏁 Check se ha raggiunto il traguardo
        if (newProgress >= 100.0 && !finishOrder.containsKey(playerName)) {
            finishCounter++;
            finishOrder.put(playerName, finishCounter);
            
            System.out.println("🏆 " + playerName + " ha finito in posizione " + finishCounter + "!");

            // Broadcast vincitore
            Map<String, Object> winnerMsg = new HashMap<>();
            winnerMsg.put("action", "PLAYER_FINISHED");
            winnerMsg.put("playerName", playerName);
            winnerMsg.put("position", finishCounter);
            winnerMsg.put("points", calculatePoints(finishCounter));
            
            messagingTemplate.convertAndSend("/topic/game/" + scream.gameId, Optional.of(winnerMsg));

            // Se 3 squadre hanno finito, termina la gara
            if (finishCounter >= 3) {
                endRace(scream.gameId);
            }
        }

        // 📡 Broadcast aggiornamento posizione a tutti
        Map<String, Object> updateMsg = new HashMap<>();
        updateMsg.put("action", "SCREAM_UPDATE");
        updateMsg.put("playerName", playerName);
        updateMsg.put("progress", newProgress);
        updateMsg.put("intensity", intensity);
        
        messagingTemplate.convertAndSend("/topic/game/" + scream.gameId, Optional.of(updateMsg));
    }

    /**
     * 🏁 Termina la gara
     */
    private void endRace(int gameId) {
        raceEnded = true;
        
        Map<String, Object> endMsg = new HashMap<>();
        endMsg.put("action", "RACE_ENDED");
        endMsg.put("finalStandings", finishOrder);
        
        messagingTemplate.convertAndSend("/topic/game/" + gameId, Optional.of(endMsg));
        
        System.out.println("🏁 Gara terminata! Classifica finale: " + finishOrder);
    }

    /**
     * 🎯 Calcola punti in base alla posizione
     */
    private int calculatePoints(int position) {
        return switch (position) {
            case 1 -> 1000;
            case 2 -> 500;
            case 3 -> 250;
            default -> 0;
        };
    }

    /**
     * 🔄 Reset per nuova gara
     */
    @MessageMapping("/scream/reset")
    public void resetRace(Map<String, Object> payload) {
        teamProgress.clear();
        finishOrder.clear();
        finishCounter = 0;
        raceEnded = false;
        
        int gameId = (int) payload.getOrDefault("gameId", 1);
        
        Map<String, Object> resetMsg = new HashMap<>();
        resetMsg.put("action", "RACE_RESET");
        
        messagingTemplate.convertAndSend("/topic/game/" + gameId, Optional.of(resetMsg));
        
        System.out.println("🔄 Gara resettata!");
    }
}
