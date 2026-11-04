package com.pub_game_be.dto;

public class ScreamDto {
    public int gameId;
    public String playerName;
    public double intensity; // 0-100
    public long timestamp;

    public ScreamDto() {
    }

    public ScreamDto(int gameId, String playerName, double intensity) {
        this.gameId = gameId;
        this.playerName = playerName;
        this.intensity = intensity;
        this.timestamp = System.currentTimeMillis();
    }
}
