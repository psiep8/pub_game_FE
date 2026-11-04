package com.pub_game_be.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class AppleMusicResponse {
    public List<AppleMusicTrack> results;
}