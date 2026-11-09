package com.pub_game_be.service;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@Service
public class CelebrityImageService {

    @Value("${pexels.api.key:563492ad6f91700001000001c4d5d7e0a6ce4a0fb28f0c4c6e4b3e8a}")
    private String pexelsApiKey;

    private static final String PEXELS_API_URL = "https://api.pexels.com/v1/search";
    private static final String WIKI_SUMMARY_URL =
            "https://%s.wikipedia.org/api/rest_v1/page/summary/%s";

    private final RestTemplate restTemplate;
    private final Map<String, Optional<WikiSummary>> summaries = new ConcurrentHashMap<>();

    /**
     * Riepilogo pubblico della voce: la foto e le frasi biografiche arrivano
     * dalla stessa chiamata, così non servono chiavi TMDB o Pexels.
     */
    public record WikiSummary(String imageUrl, String description, String extract) {
    }

    public CelebrityImageService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String getImageUrl(String celebrityName) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", pexelsApiKey);

            String url = String.format("%s?query=%s+portrait&per_page=1",
                    PEXELS_API_URL,
                    celebrityName.replace(" ", "+"));

            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, entity, String.class);

            JSONObject json = new JSONObject(response.getBody());
            JSONArray photos = json.getJSONArray("photos");

            if (photos.length() > 0) {
                JSONObject photo = photos.getJSONObject(0);
                return photo.getJSONObject("src").getString("large");
            }

            return getFallbackImageUrl(celebrityName);

        } catch (Exception e) {
            return getFallbackImageUrl(celebrityName);
        }
    }

    private Map<String, String> buildFallbackMap() {
        Map<String, String> fallbackImages = new HashMap<>();

        fallbackImages.put("Leonardo DiCaprio",
                "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?w=800");
        fallbackImages.put("Tom Hanks", "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?w=800");
        fallbackImages.put("Margot Robbie", "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?w=800");
        fallbackImages.put("Brad Pitt", "https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?w=800");
        fallbackImages.put("Zendaya", "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?w=800");
        fallbackImages.put("Jake Gyllenhaal",
                "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?w=800");
        fallbackImages.put("Pedro Pascal", "https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?w=800");
        fallbackImages.put("Oscar Isaac", "https://images.pexels.com/photos/1121796/pexels-photo-1121796.jpeg?w=800");

        fallbackImages.put("Alessandro Borghi",
                "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?w=800");
        fallbackImages.put("Luca Marinelli",
                "https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?w=800");
        fallbackImages.put("Elodie", "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?w=800");
        fallbackImages.put("Mahmood", "https://images.pexels.com/photos/1121796/pexels-photo-1121796.jpeg?w=800");
        fallbackImages.put("Blanco", "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?w=800");
        fallbackImages.put("Annalisa", "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?w=800");
        fallbackImages.put("Jannik Sinner", "https://images.pexels.com/photos/1878730/pexels-photo-1878730.jpeg?w=800");
        fallbackImages.put("Gianmarco Tamberi",
                "https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?w=800");
        fallbackImages.put("Federica Pellegrini",
                "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?w=800");
        fallbackImages.put("Alessandro Cattelan",
                "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?w=800");
        fallbackImages.put("Jasmine Trinca", "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?w=800");

        Map<String, String> normalized = new HashMap<>();
        for (Map.Entry<String, String> e : fallbackImages.entrySet()) {
            normalized.put(e.getKey().toLowerCase(Locale.ROOT).trim(), e.getValue());
        }
        return normalized;
    }

    public String getFallbackImageUrl(String celebrityName) {
        Map<String, String> normalized = buildFallbackMap();
        String key = celebrityName == null ? "" : celebrityName.toLowerCase(Locale.ROOT).trim();

        return normalized.getOrDefault(
                key,
                "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?w=800");
    }

    /**
     * Foto della celebrità da Wikipedia. Restituisce null se la voce non ha
     * un'immagine: meglio il segnaposto con l'iniziale che la foto di un'altra
     * persona presa da un archivio generico.
     */
    public String getReliableImageUrl(String celebrityName) {
        return summary(celebrityName)
                .map(WikiSummary::imageUrl)
                .filter(url -> url != null && !url.isBlank())
                .orElse(null);
    }

    /**
     * Frasi già ripulite dal nome: vanno mostrate una alla volta come indizi.
     * La descrizione breve viene prima, poi le frasi biografiche.
     */
    public List<String> getClues(String celebrityName) {
        if (celebrityName == null || celebrityName.isBlank()) {
            return List.of();
        }
        return summary(celebrityName)
                .map(found -> cluesFrom(celebrityName, found))
                .orElse(List.of());
    }

    /** Riepilogo con cache: la stessa celebrità non chiama Wikipedia due volte. */
    public Optional<WikiSummary> summary(String celebrityName) {
        if (celebrityName == null || celebrityName.isBlank()) {
            return Optional.empty();
        }
        String key = QuestionHistoryService.normalize(celebrityName);
        Optional<WikiSummary> cached = summaries.get(key);
        if (cached != null) {
            return cached;
        }

        Optional<WikiSummary> found = fetch("it", celebrityName);
        if (found.isEmpty()) {
            found = fetch("en", celebrityName);
        }
        // Solo i successi restano in cache: se la rete era giù al primo
        // tentativo, la domanda successiva può riprovare.
        if (found.isPresent()) {
            summaries.put(key, found);
        }
        return found;
    }

    private Optional<WikiSummary> fetch(String language, String celebrityName) {
        try {
            String page = URLEncoder.encode(celebrityName.replace(' ', '_'), StandardCharsets.UTF_8)
                    .replace("+", "_");
            String url = String.format(WIKI_SUMMARY_URL, language, page);

            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return Optional.empty();
            }

            JSONObject json = new JSONObject(response.getBody());
            if ("disambiguation".equalsIgnoreCase(json.optString("type"))) {
                return Optional.empty();
            }

            String imageUrl = null;
            JSONObject thumbnail = json.optJSONObject("thumbnail");
            if (thumbnail != null) {
                imageUrl = thumbnail.optString("source", null);
            }
            if (imageUrl == null || imageUrl.isBlank()) {
                JSONObject original = json.optJSONObject("originalimage");
                if (original != null) {
                    imageUrl = original.optString("source", null);
                }
            }

            String description = json.optString("description", "");
            String extract = json.optString("extract", "");
            if ((imageUrl == null || imageUrl.isBlank())
                    && description.isBlank() && extract.isBlank()) {
                return Optional.empty();
            }

            return Optional.of(new WikiSummary(
                    imageUrl == null ? "" : imageUrl,
                    description,
                    extract));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    /**
     * Indizi dalla banca locale: stesso taglio di quelli di Wikipedia, ma
     * senza chiamate di rete. La banca li salva insieme alla foto.
     */
    public List<String> cluesFromLocal(String celebrityName, String description, String extract) {
        return cluesFrom(celebrityName, new WikiSummary("",
                description == null ? "" : description,
                extract == null ? "" : extract));
    }

    private List<String> cluesFrom(String celebrityName, WikiSummary summary) {
        LinkedHashSet<String> clues = new LinkedHashSet<>();
        addClue(clues, summary.description(), celebrityName);

        String extract = summary.extract();
        if (extract != null && !extract.isBlank()) {
            String normalizedName = celebrityName.toLowerCase(Locale.ROOT);
            for (String sentence : extract.split("(?<=[.!?])\\s+")) {
                // La prima frase contiene il nome: mostrarla svelerebbe la
                // risposta. Si usano solo le frasi successive.
                if (sentence.toLowerCase(Locale.ROOT).contains(normalizedName)) {
                    continue;
                }
                addClue(clues, sentence, celebrityName);
                if (clues.size() >= 4) {
                    break;
                }
            }
        }

        return List.copyOf(clues);
    }

    private void addClue(Set<String> clues, String raw, String celebrityName) {
        if (raw == null || raw.isBlank()) {
            return;
        }
        String clue = raw
                .replaceAll("(?i)" + Pattern.quote(celebrityName), " ")
                .replaceAll("\\([^)]*\\)", " ")
                .replaceAll("\\s+", " ")
                .replaceAll("^[\\s,;:–—-]+", "")
                .replaceAll("[\\s,;:–—-]+$", "")
                .trim();

        if (clue.length() < 12 || clue.equalsIgnoreCase(celebrityName)) {
            return;
        }
        if (clue.length() > 180) {
            clue = clue.substring(0, 177).trim() + "…";
        }
        clues.add(clue);
    }
}
