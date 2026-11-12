package com.pub_game_be.controller;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HealthControllerTest {

    @Test
    void rispondeOkSenzaDatabase() {
        var body = new HealthController().health();

        assertThat(body).containsEntry("status", "ok");
        assertThat(body.get("time")).isNotBlank();
    }
}
