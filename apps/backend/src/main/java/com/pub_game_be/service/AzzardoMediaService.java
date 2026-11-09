package com.pub_game_be.service;

import com.pub_game_be.dto.MusicTrackDto;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Media delle quattro manche di Azzardo.
 *
 * <p>La banca è numerica e resta la fonte della verità: qui si aggiungono solo
 * gli appigli visivi o sonori. Celebrity: foto e indizi. Canzoni: preview e
 * copertina. Paesi: cartina locale e bandiera. Storia resta testuale.</p>
 */
@Service
public class AzzardoMediaService {

    private static final Pattern CELEBRITY = Pattern.compile(
            "(?:nascita di|nato|nata|morto|morta) (.+?)\\?\\s*$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern SONG = Pattern.compile(
            "uscit[oa] (.+?) di (.+?)\\?\\s*$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern COUNTRY_BORDERS = Pattern.compile(
            "con (.+?)\\?\\s*$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern COUNTRY_POPULATION = Pattern.compile(
            "ha (.+?)\\?\\s*$",
            Pattern.CASE_INSENSITIVE);

    private static final Map<String, Country> COUNTRIES = buildCountries();

    private record Country(String name, String iso2) {
    }

    private final CelebrityImageService celebrityImages;
    private final AppleMusicCuratorService music;
    private final LocalMediaBankService localMedia;
    private final boolean enabled;
    private final Map<String, Optional<MusicTrackDto>> songCache = new ConcurrentHashMap<>();

    public AzzardoMediaService(CelebrityImageService celebrityImages,
            AppleMusicCuratorService music,
            LocalMediaBankService localMedia,
            @Value("${game.azzardo.media.enabled:true}") boolean enabled) {
        this.celebrityImages = celebrityImages;
        this.music = music;
        this.localMedia = localMedia;
        this.enabled = enabled;
    }

    /** Null quando non c'è un media utile: il payload resta giocabile. */
    public JSONObject forQuestion(String category, String question) {
        if (!enabled || question == null || question.isBlank()) {
            return null;
        }
        String key = category == null ? "" : category.toUpperCase(Locale.ROOT);
        if (key.startsWith("CELEBR")) {
            return celebrity(question);
        }
        if ("CANZONI".equals(key)) {
            return song(question);
        }
        if ("PAESI".equals(key)) {
            return country(question);
        }
        return null;
    }

    private JSONObject celebrity(String question) {
        Matcher matcher = CELEBRITY.matcher(question);
        if (!matcher.find()) {
            return null;
        }

        String name = matcher.group(1).trim();
        if (name.isBlank()) {
            return null;
        }

        Optional<LocalMediaBankService.Person> local = localMedia.person(name);
        String imageUrl;
        List<String> clues;
        if (local.isPresent()) {
            LocalMediaBankService.Person person = local.get();
            imageUrl = localMedia.url(person.file());
            clues = celebrityImages.cluesFromLocal(name, person.description(), person.extract())
                    .stream()
                    .map(this::stripYears)
                    .filter(clue -> clue.length() >= 12)
                    .distinct()
                    .limit(3)
                    .toList();
        } else if (localMedia.hasPeople()) {
            // Banca volti installata: niente Wikipedia a runtime. La manche
            // resta giocabile, al massimo senza foto.
            return null;
        } else {
            imageUrl = celebrityImages.getReliableImageUrl(name);
            clues = celebrityImages.getClues(name).stream()
                    .map(this::stripYears)
                    .filter(clue -> clue.length() >= 12)
                    .distinct()
                    .limit(3)
                    .toList();
        }

        if ((imageUrl == null || imageUrl.isBlank()) && clues.isEmpty()) {
            return null;
        }

        JSONObject media = new JSONObject();
        media.put("kind", "celebrity");
        media.put("name", name);
        media.put("imageUrl", imageUrl == null ? "" : imageUrl);
        media.put("clues", new JSONArray(clues));
        return media;
    }

    private JSONObject song(String question) {
        Matcher matcher = SONG.matcher(question);
        if (!matcher.find()) {
            return null;
        }

        String title = matcher.group(1).trim();
        String artist = matcher.group(2).trim();

        Optional<LocalMediaBankService.Track> local = localMedia.findTrack(title, artist);
        if (local.isPresent()) {
            LocalMediaBankService.Track track = local.get();
            String cover = localMedia.url(track.albumCover());
            JSONObject media = new JSONObject();
            media.put("kind", "song");
            media.put("title", track.title() == null || track.title().isBlank() ? title : track.title());
            media.put("artist", track.artist() == null || track.artist().isBlank() ? artist : track.artist());
            media.put("previewUrl", localMedia.url(track.file()));
            media.put("albumCover", cover == null ? "" : cover);
            return media;
        }
        // Con la banca canzoni installata non si interroga più iTunes: se il
        // brano non è stato scaricato, la manche resta solo testuale.
        if (localMedia.hasTracks()) {
            return null;
        }

        String cacheKey = title.toLowerCase(Locale.ROOT) + "|" + artist.toLowerCase(Locale.ROOT);
        Optional<MusicTrackDto> found = songCache.computeIfAbsent(cacheKey,
                ignored -> music.findTrack(title, artist));

        if (found.isEmpty() || found.get().previewUrl == null || found.get().previewUrl.isBlank()) {
            return null;
        }

        MusicTrackDto track = found.get();
        JSONObject media = new JSONObject();
        media.put("kind", "song");
        media.put("title", track.title == null ? title : track.title);
        media.put("artist", track.artist == null ? artist : track.artist);
        media.put("previewUrl", track.previewUrl);
        media.put("albumCover", track.albumCover == null ? "" : track.albumCover);
        return media;
    }

    private JSONObject country(String question) {
        Matcher matcher = COUNTRY_BORDERS.matcher(question);
        if (!matcher.find()) {
            matcher = COUNTRY_POPULATION.matcher(question);
            if (!matcher.find()) {
                return null;
            }
        }

        String name = cleanCountryName(matcher.group(1));
        Country country = COUNTRIES.get(QuestionHistoryService.normalize(name));
        if (country == null) {
            return null;
        }

        JSONObject media = new JSONObject();
        media.put("kind", "country");
        media.put("country", country.name());
        media.put("countryCode", country.iso2());
        media.put("mapUrl", "/maps/" + country.iso2() + ".svg");
        media.put("flagUrl", "https://flagcdn.com/w640/" + country.iso2() + ".png");
        return media;
    }

    /** La domanda può dire "con Italia" o "con l'Italia": il paese è lo stesso. */
    private String cleanCountryName(String raw) {
        return raw.replaceFirst("(?i)^(l'|lo |la |il |gli |i |le )", "").trim();
    }

    /**
     * Negli indizi della manche Celebrità l'anno è la risposta: va tolto,
     * insieme alle parentesi biografiche che spesso lo contengono.
     */
    private String stripYears(String clue) {
        return clue
                .replaceAll("\\([^)]*\\b(?:1[0-9]{3}|20[0-9]{2})\\b[^)]*\\)", " ")
                .replaceAll("\\b(?:1[0-9]{3}|20[0-9]{2})\\b", " ")
                .replaceAll("(?i)\\b(?:nel|del|della|dei|degli|delle|un|una|uno|il|lo|la|le|i|gli)\\s*$", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static Map<String, Country> buildCountries() {
        Map<String, Country> map = new LinkedHashMap<>();
        country(map, "Italia", "it");
        country(map, "Francia", "fr");
        country(map, "Germania", "de");
        country(map, "Spagna", "es");
        country(map, "Svizzera", "ch");
        country(map, "Austria", "at");
        country(map, "Portogallo", "pt");
        country(map, "Belgio", "be");
        country(map, "Paesi Bassi", "nl");
        country(map, "Lussemburgo", "lu");
        country(map, "Danimarca", "dk");
        country(map, "Norvegia", "no");
        country(map, "Svezia", "se");
        country(map, "Finlandia", "fi");
        country(map, "Polonia", "pl");
        country(map, "Cechia", "cz");
        country(map, "Slovacchia", "sk");
        country(map, "Ungheria", "hu");
        country(map, "Slovenia", "si");
        country(map, "Croazia", "hr");
        country(map, "Serbia", "rs");
        country(map, "Romania", "ro");
        country(map, "Bulgaria", "bg");
        country(map, "Grecia", "gr");
        country(map, "Albania", "al");
        country(map, "Macedonia del Nord", "mk");
        country(map, "Montenegro", "me");
        country(map, "Bosnia ed Erzegovina", "ba");
        country(map, "Irlanda", "ie");
        country(map, "Regno Unito", "gb");
        country(map, "Brasile", "br");
        country(map, "Argentina", "ar");
        country(map, "Cile", "cl");
        country(map, "Perù", "pe");
        country(map, "Colombia", "co");
        country(map, "Venezuela", "ve");
        country(map, "Ecuador", "ec");
        country(map, "Bolivia", "bo");
        country(map, "Paraguay", "py");
        country(map, "Uruguay", "uy");
        country(map, "Messico", "mx");
        country(map, "Guatemala", "gt");
        country(map, "Honduras", "hn");
        country(map, "El Salvador", "sv");
        country(map, "Nicaragua", "ni");
        country(map, "Costa Rica", "cr");
        country(map, "Panama", "pa");
        country(map, "Stati Uniti", "us");
        country(map, "Canada", "ca");
        country(map, "Cina", "cn");
        country(map, "India", "in");
        country(map, "Russia", "ru");
        country(map, "Mongolia", "mn");
        country(map, "Kazakistan", "kz");
        country(map, "Uzbekistan", "uz");
        country(map, "Turkmenistan", "tm");
        country(map, "Iran", "ir");
        country(map, "Turchia", "tr");
        country(map, "Algeria", "dz");
        country(map, "Sudafrica", "za");
        country(map, "Giappone", "jp");
        country(map, "Egitto", "eg");
        country(map, "Australia", "au");
        return Map.copyOf(map);
    }

    private static void country(Map<String, Country> map, String name, String iso2) {
        map.put(QuestionHistoryService.normalize(name), new Country(name, iso2));
    }
}
