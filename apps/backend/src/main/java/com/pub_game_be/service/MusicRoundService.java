package com.pub_game_be.service;

import com.pub_game_be.reliability.StateBlobService;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Costruisce un round di Musica: un tema e cinque manche (cinque brani).
 *
 * <p>La partita di Musica sono quattro round della scaletta, quindi questo
 * servizio non gira "quattro volte dentro un mode": ogni chiamata apre UN
 * round da cinque brani. Il sacchetto dei temi e l'elenco dei brani già
 * suonati vivono nello stato della partita, persistiti su {@link StateBlobService}:
 * sopravvivono a un refresh della TV, a una pausa e a un riavvio.</p>
 */
@Service
public class MusicRoundService {

    /** Etichette d'era: sono temi come le famiglie, ma filtrano per anno reale. */
    static final List<String> ERA_THEMES = List.of("Anni '70-'80", "Anni '90-2000", "Anni 2010-oggi");

    /** Manche per round: cinque brani, uno per manca. */
    static final int MANCHES = 5;
    /** Mix dichiarato: due hit, due medi, un difficile. */
    private static final List<String> MIX = List.of("hit", "hit", "medium", "medium", "hard");

    private static final String BLOB = "music-round";

    private final LocalMediaBankService media;
    private final StateBlobService stateBlobs;
    private final KaraokeService karaoke;
    private final Random random = new Random();

    /** Ultimo stato noto per partita: si rilegge dal database solo al primo uso. */
    private final Map<Long, RoundState> states = new ConcurrentHashMap<>();

    private record RoundState(List<String> themes, List<String> songs) {
    }

    public MusicRoundService(LocalMediaBankService media, StateBlobService stateBlobs,
            KaraokeService karaoke) {
        this.media = media;
        this.stateBlobs = stateBlobs;
        this.karaoke = karaoke;
    }

    /**
     * Brani riservati al bonus Karaoke di questa partita: la banca condivide 41
     * titoli con la Musica (la maggior parte delle canzoni da cantare sono hit
     * italiane), quindi la disgiunzione non si può fare sui file ma sulle
     * cinque manche davvero scelte. La selezione del bonus è deterministica
     * (seed = gameId): la stessa esclusione vale anche dopo un refresh.
     */
    private Set<String> bonusReserved(long gameId) {
        Set<String> keys = new HashSet<>();
        for (KaraokeService.Manche manche : karaoke.selezione(gameId)) {
            keys.add(QuestionHistoryService.normalize(manche.artista())
                    + "|" + QuestionHistoryService.normalize(manche.titolo()));
        }
        return keys;
    }

    public boolean available() {
        return media.hasMusicThemes() && media.musicThemes().size() > 0;
    }

    /**
     * Payload del round: {type, theme, themes, songs[]}. Il tema lo sceglie il
     * server (è lui che decide le cinque manche) e la TV anima quella bolla.
     */
    public String nextRoundPayload(long gameId) {
        synchronized (this) {
            RoundState state = hydrate(gameId);
            List<String> remaining = new ArrayList<>(media.musicThemes());
            remaining.removeAll(state.themes());
            Collections.shuffle(remaining, random);
            Set<String> reserved = bonusReserved(gameId);

            for (String theme : remaining) {
                List<LocalMediaBankService.TaggedTrack> picked = pickManches(theme, state.songs(), reserved);
                if (picked == null) {
                    // Tema scarso o brani già usati: si scarta e se ne pesca un altro.
                    continue;
                }
                List<String> songs = new ArrayList<>(state.songs());
                for (LocalMediaBankService.TaggedTrack track : picked) {
                    songs.add(songKey(track));
                }
                List<String> themes = new ArrayList<>(state.themes());
                themes.add(theme);
                RoundState next = new RoundState(List.copyOf(themes), List.copyOf(songs));
                states.put(gameId, next);
                persist(gameId, next);
                return payload(theme, next.themes().size(), picked);
            }

            // Nessun tema disponibile con brani nuovi: si riapre il sacchetto
            // dei brani (non quello dei temi, che resta senza ripetizioni).
            for (String theme : media.musicThemes()) {
                if (state.themes().contains(theme)) {
                    continue;
                }
                List<LocalMediaBankService.TaggedTrack> picked = pickManches(theme, List.of(), reserved);
                if (picked == null) {
                    continue;
                }
                List<String> themes = new ArrayList<>(state.themes());
                themes.add(theme);
                List<String> songs = new ArrayList<>();
                for (LocalMediaBankService.TaggedTrack track : picked) {
                    songs.add(songKey(track));
                }
                RoundState next = new RoundState(List.copyOf(themes), List.copyOf(songs));
                states.put(gameId, next);
                persist(gameId, next);
                return payload(theme, next.themes().size(), picked);
            }
            return null;
        }
    }

    /** Cancella lo stato della partita (nuova serata sullo stesso id). */
    public void forget(long gameId) {
        states.remove(gameId);
        stateBlobs.forget(gameId, BLOB);
    }

    private String payload(String theme, int round, List<LocalMediaBankService.TaggedTrack> picked) {
        JSONArray songs = new JSONArray();
        for (LocalMediaBankService.TaggedTrack track : picked) {
            String cover = media.url(track.albumCover());
            songs.put(new JSONObject()
                    .put("title", track.title())
                    .put("artist", track.artist())
                    .put("year", track.year())
                    .put("previewUrl", media.url(track.file()))
                    .put("albumCover", cover == null ? JSONObject.NULL : cover));
        }

        JSONArray themes = new JSONArray();
        for (String name : media.musicThemes()) {
            themes.put(name);
        }

        JSONObject payload = new JSONObject();
        payload.put("type", "MUSIC");
        payload.put("question", "Indovina la canzone!");
        payload.put("round", round);
        payload.put("theme", theme);
        payload.put("themes", themes);
        payload.put("manches", MANCHES);
        payload.put("songs", songs);
        payload.put("source", "banca-media");
        payload.put("audioReady", true);
        payload.put("payload", JSONObject.NULL);
        return payload.toString();
    }

    /**
     * Cinque brani del tema: due hit, due medi, un difficile, artisti distinti.
     * Preferisce i brani mai usciti nella partita. Null se il tema non regge.
     */
    private List<LocalMediaBankService.TaggedTrack> pickManches(String theme,
            List<String> usedSongs, Set<String> bonusReserved) {
        List<LocalMediaBankService.TaggedTrack> pool = ERA_THEMES.contains(theme)
                ? media.byEra(theme)
                : media.byTheme(theme);
        Set<String> used = new HashSet<>(usedSongs);
        // I cinque brani del Karaoke di questa partita non entrano mai in Musica.
        pool = pool.stream()
                .filter(track -> !bonusReserved.contains(songKey(track)))
                .toList();

        List<LocalMediaBankService.TaggedTrack> fresh = new ArrayList<>();
        for (LocalMediaBankService.TaggedTrack track : pool) {
            if (!used.contains(songKey(track))) {
                fresh.add(track);
            }
        }
        List<LocalMediaBankService.TaggedTrack> picked = pickMix(fresh);
        if (picked != null) {
            return picked;
        }
        // Banca corta: si accetta il riuso, meglio un round misto che nessuno.
        // Restano esclusi i brani del Karaoke: quelli non si ripetono mai.
        return pickMix(new ArrayList<>(pool));
    }

    /**
     * Mix 2/2/1 con artisti distinti. Prova qualche mescolamento della banca
     * (basta che il tema abbia abbastanza brani per banda): niente ricerca
     * combinatoria su tutto il pool, che con centinaia di brani sarebbe lenta.
     */
    private List<LocalMediaBankService.TaggedTrack> pickMix(
            List<LocalMediaBankService.TaggedTrack> pool) {
        List<LocalMediaBankService.TaggedTrack> hits = band(pool, "hit");
        List<LocalMediaBankService.TaggedTrack> mediums = band(pool, "medium");
        List<LocalMediaBankService.TaggedTrack> hards = band(pool, "hard");
        if (hits.size() < 2 || mediums.size() < 2 || hards.size() < 1) {
            return null;
        }

        for (int attempt = 0; attempt < 120; attempt++) {
            List<LocalMediaBankService.TaggedTrack> picked = new ArrayList<>(MIX.size());
            if (takeBand(hits, picked, 2) && takeBand(mediums, picked, 2)
                    && takeBand(hards, picked, 1)) {
                Collections.shuffle(picked, random);
                return picked;
            }
            Collections.shuffle(hits, random);
            Collections.shuffle(mediums, random);
            Collections.shuffle(hards, random);
        }
        return null;
    }

    /** Aggiunge fino a `count` brani della banda con artisti non ancora usati. */
    private boolean takeBand(List<LocalMediaBankService.TaggedTrack> band,
            List<LocalMediaBankService.TaggedTrack> picked, int count) {
        int before = picked.size();
        for (LocalMediaBankService.TaggedTrack candidate : band) {
            if (picked.size() - before >= count) {
                break;
            }
            boolean duplicate = picked.stream().anyMatch(chosen ->
                    chosen == candidate || sameArtist(chosen, candidate));
            if (!duplicate) {
                picked.add(candidate);
            }
        }
        return picked.size() - before == count;
    }

    private List<LocalMediaBankService.TaggedTrack> band(
            List<LocalMediaBankService.TaggedTrack> pool, String difficulty) {
        List<LocalMediaBankService.TaggedTrack> filtered = new ArrayList<>();
        for (LocalMediaBankService.TaggedTrack track : pool) {
            if (difficulty.equalsIgnoreCase(track.difficulty())) {
                filtered.add(track);
            }
        }
        Collections.shuffle(filtered, random);
        return filtered;
    }

    private boolean sameArtist(LocalMediaBankService.TaggedTrack first,
            LocalMediaBankService.TaggedTrack second) {
        return QuestionHistoryService.normalize(first.artist())
                .equals(QuestionHistoryService.normalize(second.artist()));
    }

    private String songKey(LocalMediaBankService.TaggedTrack track) {
        return QuestionHistoryService.normalize(track.artist())
                + "|" + QuestionHistoryService.normalize(track.title());
    }

    // ------------------------------------------------------------ Persistenza

    private RoundState hydrate(long gameId) {
        RoundState known = states.get(gameId);
        if (known != null) {
            return known;
        }
        Optional<String> blob = stateBlobs.load(gameId, BLOB);
        if (blob.isEmpty()) {
            RoundState empty = new RoundState(List.of(), List.of());
            states.put(gameId, empty);
            return empty;
        }
        try {
            JSONObject json = new JSONObject(blob.get());
            return new RoundState(strings(json.optJSONArray("themes")), strings(json.optJSONArray("songs")));
        } catch (Exception malformed) {
            System.out.println("⚠️ Stato Musica illeggibile per la partita " + gameId
                    + ": " + malformed.getMessage());
            RoundState empty = new RoundState(List.of(), List.of());
            states.put(gameId, empty);
            return empty;
        }
    }

    private List<String> strings(JSONArray array) {
        List<String> values = new ArrayList<>();
        for (int index = 0; array != null && index < array.length(); index++) {
            String value = array.optString(index, "").trim();
            if (!value.isBlank()) {
                values.add(value);
            }
        }
        return List.copyOf(values);
    }

    private void persist(long gameId, RoundState state) {
        stateBlobs.save(gameId, BLOB, new JSONObject()
                .put("themes", new JSONArray(state.themes()))
                .put("songs", new JSONArray(state.songs()))
                .toString());
    }

    /** Nomi dei temi dichiarati dal file, in ordine: serve ai test e alla TV. */
    public List<String> themes() {
        return media.musicThemes();
    }

    /** Sanity check usato dai test: ogni tema deve poter reggere il round. */
    List<String> unavailableThemes() {
        List<String> unusable = new ArrayList<>();
        for (String theme : media.musicThemes()) {
            List<LocalMediaBankService.TaggedTrack> pool = ERA_THEMES.contains(theme)
                    ? media.byEra(theme)
                    : media.byTheme(theme);
            Set<String> artists = new LinkedHashSet<>();
            for (LocalMediaBankService.TaggedTrack track : pool) {
                artists.add(QuestionHistoryService.normalize(track.artist()));
            }
            if (pickMix(new ArrayList<>(pool)) == null || artists.size() < MANCHES) {
                unusable.add(theme.toUpperCase(Locale.ROOT));
            }
        }
        return unusable;
    }
}
