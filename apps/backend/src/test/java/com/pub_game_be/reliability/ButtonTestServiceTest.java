package com.pub_game_be.reliability;

import org.json.JSONObject;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ButtonTestServiceTest {

    private final ButtonTestService service = new ButtonTestService();

    @Test
    void riprendeDalPassoSuccessivoDopoUnReload() {
        service.recordStep(10L, "Anna", 1, false, -1, false);
        service.recordStep(10L, "Anna", 2, false, -1, false);

        JSONObject team = service.team(10L, "Anna");

        assertThat(team.getInt("completedSteps")).isEqualTo(2);
        assertThat(team.getInt("nextStep")).isEqualTo(3);
        assertThat(team.getBoolean("completed")).isFalse();
    }

    @Test
    void rifiutaUnPassoFuoriOrdine() {
        assertThatThrownBy(() -> service.recordStep(11L, "Anna", 3, false, -1, false))
                .isInstanceOf(ButtonTestService.BadButtonTestRequest.class);
    }

    @Test
    void laFineDelQuintoPassoChiudeLaProvaDellaSquadra() {
        for (int step = 1; step <= 5; step++) {
            service.recordStep(12L, "Anna", step, true, 42, false);
        }

        JSONObject team = service.team(12L, "Anna");
        assertThat(team.getBoolean("completed")).isTrue();
        assertThat(team.getLong("latencyMs")).isEqualTo(42);
        assertThat(team.getBoolean("vibrated")).isTrue();

        JSONObject snapshot = service.snapshot(12L, List.of("Anna"));
        assertThat(snapshot.getBoolean("allReady")).isTrue();
    }

    @Test
    void ilSaltoSbloccaTutteLeSquadrePresenti() {
        service.recordStep(13L, "Anna", 1, false, -1, false);
        JSONObject snapshot = service.skipAll(13L, List.of("Anna", "Bruno"));

        assertThat(snapshot.getBoolean("allReady")).isTrue();
        assertThat(snapshot.getJSONArray("teams").length()).isEqualTo(2);
    }

    @Test
    void ilResetDiUnaSquadraNonToccaLeAltre() {
        service.recordStep(14L, "Anna", 1, false, -1, false);
        service.recordStep(14L, "Bruno", 1, false, -1, false);

        service.resetTeam(14L, "Anna");

        assertThat(service.team(14L, "Anna").getInt("nextStep")).isEqualTo(1);
        assertThat(service.team(14L, "Bruno").getInt("nextStep")).isEqualTo(2);
    }
}
