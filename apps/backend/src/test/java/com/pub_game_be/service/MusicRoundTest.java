package com.pub_game_be.service;

import com.pub_game_be.reliability.StateBlobService;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Un round di Musica sono un tema e cinque manche. La partita sono quattro
 * round della scaletta: tema e brani non si ripetono nella stessa partita.
 */
class MusicRoundTest {

    private LocalMediaBankService media;
    private StateBlobService blobs;
    private final Map<String, String> store = new HashMap<>();

    @BeforeEach
    void setUp() {
        media = new LocalMediaBankService("", new ClassPathResource("questions/media-it.json"));
        blobs = mock(StateBlobService.class);
        store.clear();

        when(blobs.load(anyLong(), anyString())).thenAnswer(invocation ->
                Optional.ofNullable(store.get(invocation.getArgument(0) + ":" + invocation.getArgument(1))));
        doAnswer(invocation -> {
            store.put(invocation.getArgument(0) + ":" + invocation.getArgument(1), invocation.getArgument(2));
            return null;
        }).when(blobs).save(anyLong(), anyString(), anyString());
    }

    private JSONObject next(MusicRoundService service, long gameId) {
        String payload = service.nextRoundPayload(gameId);
        assertThat(payload).as("payload Musica").isNotNull();
        return new JSONObject(payload);
    }

    @Test
    void ogniRoundHaUnTemaEDaCinqueManche() {
        MusicRoundService service = new MusicRoundService(media, blobs);

        JSONObject payload = next(service, 1L);

        assertThat(payload.getString("type")).isEqualTo("MUSIC");
        assertThat(payload.getInt("round")).isEqualTo(1);
        assertThat(payload.getJSONArray("themes").length()).isEqualTo(10);
        assertThat(payload.getString("theme")).isIn(
                toList(payload.getJSONArray("themes")));

        JSONArray songs = payload.getJSONArray("songs");
        assertThat(songs.length()).isEqualTo(5);
        for (int index = 0; index < songs.length(); index++) {
            JSONObject song = songs.getJSONObject(index);
            assertThat(song.getString("title")).isNotBlank();
            assertThat(song.getString("artist")).isNotBlank();
            assertThat(song.getString("year")).isNotBlank();
            assertThat(song.getString("previewUrl")).startsWith("/media/music/");
        }
    }

    @Test
    void ilRoundRispettaIlMixEDistingueGliArtisti() {
        MusicRoundService service = new MusicRoundService(media, blobs);

        JSONObject payload = next(service, 2L);
        Map<String, String> difficultyByTitle = new HashMap<>();
        for (LocalMediaBankService.TaggedTrack track : media.taggedTracks()) {
            difficultyByTitle.put(track.title(), track.difficulty());
        }

        Map<String, Integer> mix = new HashMap<>();
        Set<String> artists = new HashSet<>();
        JSONArray songs = payload.getJSONArray("songs");
        for (int index = 0; index < songs.length(); index++) {
            JSONObject song = songs.getJSONObject(index);
            mix.merge(difficultyByTitle.get(song.getString("title")), 1, Integer::sum);
            artists.add(QuestionHistoryService.normalize(song.getString("artist")));
        }

        assertThat(mix.get("hit")).isEqualTo(2);
        assertThat(mix.get("medium")).isEqualTo(2);
        assertThat(mix.get("hard")).isEqualTo(1);
        assertThat(artists).hasSize(5);
    }

    @Test
    void quattroRoundNonRipetonoTemaNeBrano() {
        MusicRoundService service = new MusicRoundService(media, blobs);

        Set<String> themes = new HashSet<>();
        Set<String> songs = new HashSet<>();
        List<String> artistsInRound = new ArrayList<>();

        for (int round = 1; round <= 4; round++) {
            JSONObject payload = next(service, 3L);
            assertThat(payload.getInt("round")).isEqualTo(round);
            assertThat(themes.add(payload.getString("theme")))
                    .as("tema ripetuto in partita: " + payload.getString("theme"))
                    .isTrue();

            artistsInRound.clear();
            JSONArray list = payload.getJSONArray("songs");
            for (int index = 0; index < list.length(); index++) {
                JSONObject song = list.getJSONObject(index);
                String key = QuestionHistoryService.normalize(song.getString("artist"))
                        + "|" + QuestionHistoryService.normalize(song.getString("title"));
                assertThat(songs.add(key)).as("brano ripetuto: " + key).isTrue();
                artistsInRound.add(QuestionHistoryService.normalize(song.getString("artist")));
            }
            assertThat(artistsInRound).doesNotHaveDuplicates();
        }

        assertThat(themes).hasSize(4);
        assertThat(songs).hasSize(20);
    }

    @Test
    void loStatoDellaPartitaSopravviveAlRiavvio() {
        MusicRoundService service = new MusicRoundService(media, blobs);
        Set<String> played = new HashSet<>();
        for (int round = 1; round <= 4; round++) {
            played.add(next(service, 4L).getString("theme"));
        }

        // Nuova istanza, stesso database: il sacchetto riparte da dove era.
        MusicRoundService restarted = new MusicRoundService(media, blobs);
        JSONObject fifth = next(restarted, 4L);

        assertThat(played).doesNotContain(fifth.getString("theme"));
        assertThat(fifth.getInt("round")).isEqualTo(5);
    }

    @Test
    void ogniTemaDellaBancaReggeUnRound() {
        MusicRoundService service = new MusicRoundService(media, blobs);

        assertThat(media.hasMusicThemes()).isTrue();
        assertThat(media.musicThemes()).hasSize(10);
        assertThat(service.unavailableThemes()).isEmpty();
    }

    private List<String> toList(JSONArray array) {
        List<String> values = new ArrayList<>();
        for (int index = 0; index < array.length(); index++) {
            values.add(array.getString(index));
        }
        return values;
    }
}
