package com.pub_game_be.controller;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import java.util.Map;

@Controller
public class GameWebSocketController {

    @MessageMapping("/game/{gameId}/answer")
    @SendTo("/topic/game/{gameId}/responses")
    public Map<String, Object> handleAnswer(@DestinationVariable("gameId") Long gameId, Map<String, Object> payload) {
        return payload;
    }

    @MessageMapping("/game/{gameId}/status")
    @SendTo("/topic/game/{gameId}/status")
    public Map<String, Object> updateStatus(@DestinationVariable("gameId") Long gameId, Map<String, Object> status) {
        return status;
    }
}