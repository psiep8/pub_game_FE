package com.pub_game_be.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class AppleMusicTrack {
    public long trackId;
    public String trackName;
    public String artistName;
    public String previewUrl;
    public String artworkUrl100;
    public String releaseDate;
}