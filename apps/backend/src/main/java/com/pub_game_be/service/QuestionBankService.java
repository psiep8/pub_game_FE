package com.pub_game_be.service;

import com.pub_game_be.dto.MusicTrackDto;
import jakarta.servlet.http.HttpServletRequest;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Predicate;

/**
 * Serve le domande leggendo la banca pre-generata (questions/questions-it.json).
 *
 * Nessun modello AI a runtime: le domande si generano una volta su un'altra
 * macchina con scripts/generate-questions/generate.py. Così una serata al pub
 * non dipende da internet, dal rate limit o dalla latenza di un provider.
 */
@Service
public class QuestionBankService {

    /** Domanda arena pronta per un dispositivo, con le chiavi di deduplica. */
    public record ArenaQuestion(String json, String question, String correctAnswer, String category,
            String key, String answerKey, String difficulty) {
    }

    /** Domanda breve per la Bomba: il server tiene la risposta corretta. */
    public record BombaQuestion(String id, String question, List<String> options,
            String correctAnswer, String kind) {
    }

    /** Riga della banca domande. */
    private record BankQuestion(String id, String category, String type, String difficulty,
            String question, String correctAnswer, List<String> options, String explanation) {
    }

    /** Brano della banca media: il file audio vive in resources/static/media/music. */
    private record MediaTrack(String title, String artist, String year, String albumCover, String file) {
    }

    private static final List<String> COLORS = List.of("ROSSO", "NERO", "VERDE", "BLU", "GIALLO", "BIANCO");

    private static final String[] PROVERBS = {
            "Chi dorme non piglia pesci",
            "L'abito non fa il monaco",
            "Chi va piano va sano e va lontano",
            "Non è tutto oro quel che luccica",
            "Tra il dire e il fare c'è di mezzo il mare",
            "A caval donato non si guarda in bocca",
            "Chi semina vento raccoglie tempesta",
            "Meglio un uovo oggi che una gallina domani",
            "Tanto va la gatta al lardo che ci lascia lo zampino",
            "Meglio soli che male accompagnati",
            "Tra moglie e marito non mettere il dito",
            "Chi troppo vuole nulla stringe",
            "Il lupo perde il pelo ma non il vizio",
            "Rosso di sera bel tempo si spera",
            "Chi fa da sé fa per tre",
            "Il gioco non vale la candela",
            "Chi trova un amico trova un tesoro",
            "Non tutte le ciambelle riescono col buco",
            "Chi è causa del suo mal pianga sé stesso",
            "Quando il gatto non c'è i topi ballano",
            "Chi ben comincia è a metà dell'opera",
            "L'erba del vicino è sempre più verde",
            "Non rimandare a domani quello che puoi fare oggi",
            "Chi ha tempo non aspetti tempo",
            "Chi va con lo zoppo impara a zoppicare",
            "Chi non risica non rosica",
            "Meglio prevenire che curare",
            "Chi di spada ferisce di spada perisce",
            "Chi di speranza vive disperato muore",
            "Non tutto il male viene per nuocere",
            "Chi ha orecchie per intendere intenda",
            "A buon intenditor poche parole"
    };

    /** Tenuta di sicurezza: se la banca non è ancora stata generata, il gioco resta vivo. */
    private static final List<BankQuestion> EMERGENCY = List.of(
            new BankQuestion("em-1", "Geografia e Viaggi", "QUIZ", "facile", "Qual è la capitale d'Italia?",
                    "Roma", List.of("Milano", "Roma", "Napoli", "Torino"), null),
            new BankQuestion("em-2", "Scienza e Spazio", "TRUE_FALSE", "facile",
                    "L'acqua bolle a 100 gradi Celsius al livello del mare.",
                    "VERO", List.of("VERO", "FALSO"), "Alla pressione atmosferica standard."),
            new BankQuestion("em-3", "Arte e Architettura", "QUIZ", "facile", "Chi ha dipinto la Gioconda?",
                    "Leonardo da Vinci",
                    List.of("Michelangelo", "Raffaello", "Leonardo da Vinci", "Caravaggio"), null)
    );

    private final List<BankQuestion> bank;
    private final TMDBImageService tmdbImageService;
    private final AppleMusicCuratorService appleMusicCuratorService;
    private final List<MediaTrack> musicTracks;
    private final Map<String, String> celebrityPhotos;
    private final String configuredMediaBaseUrl;
    private final Random random = new Random();

    /** Sotto questo numero di domande l'arena finisce le scorte della categoria. */
    private static final int MIN_ARENA_QUESTIONS = 10;

    public QuestionBankService(TMDBImageService tmdbImageService,
            AppleMusicCuratorService appleMusicCuratorService,
            @Value("${game.media-base-url:}") String mediaBaseUrl) {
        this.tmdbImageService = tmdbImageService;
        this.appleMusicCuratorService = appleMusicCuratorService;
        this.configuredMediaBaseUrl = mediaBaseUrl == null ? "" : mediaBaseUrl.trim();
        this.bank = loadBank();

        MediaBank media = loadMedia();
        this.musicTracks = media.tracks();
        this.celebrityPhotos = media.people();

        logBankSummary();
    }

    /** Payload del round: le domande vengono dalla banca, gli altri tipi sono locali. */
    public String generateQuestionJson(String category, String type, String difficulty) {
        return generateQuestionJson(category, type, difficulty, key -> true);
    }

    /**
     * Come sopra, ma scarta le domande già uscite nella partita: se la
     * categoria è esaurita si allarga alle altre categorie dello stesso tipo,
     * così una domanda non esce mai due volte.
     */
    public String generateQuestionJson(String category, String type, String difficulty,
            Predicate<String> isAvailable) {
        String requested = type == null ? "QUIZ" : type.toUpperCase(Locale.ROOT);

        return switch (requested) {
            case "ROULETTE" -> roulettePayload();
            case "WHEEL_OF_FORTUNE", "WHEEL_FORTUNE", "PROVERB" -> pickRandomProverb();
            case "MUSIC" -> musicPayload();
            case "ARENA" -> arenaWrapper();
            default -> fromBank(category, requested, isAvailable);
        };
    }

    /**
     * Pacchetto arena letto dalla banca: istantaneo, nessuna chiamata esterna.
     * Il nome "batch" resta perché è la forma usata dal pool.
     */
    public List<ArenaQuestion> generateArenaBatch(String category, int count, Predicate<ArenaQuestion> isAvailable) {
        List<BankQuestion> candidates = new ArrayList<>();
        for (BankQuestion question : allQuestions()) {
            // Arena è solo Vero/Falso: una domanda con quattro opzioni non è
            // giocabile sul telefono mentre il cerchio si stringe.
            if (!"TRUE_FALSE".equals(question.type())) {
                continue;
            }
            if (category != null && !question.category().equalsIgnoreCase(category)) {
                continue;
            }
            candidates.add(question);
        }

        Collections.shuffle(candidates, random);

        // La banca non ha lo stesso numero di VERO e FALSO: servirla così com'è
        // renderebbe conveniente indovinare sempre VERO. Il pacchetto arena
        // alterna le due risposte, così in partita il 50% resta vero.
        List<BankQuestion> trueQuestions = new ArrayList<>();
        List<BankQuestion> falseQuestions = new ArrayList<>();
        for (BankQuestion question : candidates) {
            if ("VERO".equalsIgnoreCase(question.correctAnswer())) {
                trueQuestions.add(question);
            } else if ("FALSO".equalsIgnoreCase(question.correctAnswer())) {
                falseQuestions.add(question);
            }
        }

        boolean startWithTrue = random.nextBoolean();
        List<BankQuestion> balanced = new ArrayList<>();
        for (int index = 0; index < Math.max(trueQuestions.size(), falseQuestions.size()); index++) {
            if (startWithTrue) {
                if (index < trueQuestions.size()) {
                    balanced.add(trueQuestions.get(index));
                }
                if (index < falseQuestions.size()) {
                    balanced.add(falseQuestions.get(index));
                }
            } else {
                if (index < falseQuestions.size()) {
                    balanced.add(falseQuestions.get(index));
                }
                if (index < trueQuestions.size()) {
                    balanced.add(trueQuestions.get(index));
                }
            }
        }

        List<ArenaQuestion> accepted = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (BankQuestion question : balanced) {
            if (accepted.size() >= count) {
                break;
            }
            Optional<String> payload = toPayload(question);
            if (payload.isEmpty()) {
                continue;
            }
            // Le Vero/Falso non hanno una chiave di risposta utile: la sola
            // risposta possibile è "vero" o "falso", e usarla come chiave
            // esaurirebbe la banca dopo due domande.
            String answerKey = "TRUE_FALSE".equals(question.type())
                    ? ""
                    : QuestionHistoryService.answerKey(question.correctAnswer(), question.category());
            ArenaQuestion arena = new ArenaQuestion(payload.get(), question.question(), question.correctAnswer(),
                    question.category(),
                    QuestionHistoryService.key(question.question(), question.correctAnswer(), question.category()),
                    answerKey,
                    normalizeArenaDifficulty(question.difficulty()));
            if (seen.add(arena.key()) && isAvailable.test(arena)) {
                accepted.add(arena);
            }
        }
        return accepted;
    }

    /** Una domanda arena non ancora uscita, preferendo la categoria richiesta. */
    public Optional<ArenaQuestion> generateArenaQuestion(String category, Predicate<ArenaQuestion> isAvailable) {
        if (category != null) {
            List<ArenaQuestion> sameCategory = generateArenaBatch(category, 1, isAvailable);
            if (!sameCategory.isEmpty()) {
                return Optional.of(sameCategory.get(0));
            }
        }
        List<ArenaQuestion> anyCategory = generateArenaBatch(null, 1, isAvailable);
        return anyCategory.isEmpty() ? Optional.empty() : Optional.of(anyCategory.get(0));
    }

    public Optional<ArenaQuestion> fallbackArenaQuestion(String category, Predicate<ArenaQuestion> isAvailable) {
        return generateArenaQuestion(category, isAvailable);
    }

    public Optional<ArenaQuestion> fallbackArenaQuestion(Predicate<ArenaQuestion> isAvailable) {
        return generateArenaQuestion(null, isAvailable);
    }

    /** Chiave di deduplica per un payload già costruito. */
    public static String payloadDedupeKey(String jsonPayload) {
        try {
            JSONObject obj = new JSONObject(jsonPayload);
            String question = obj.optString("question", "");
            String answer = obj.optString("correctAnswer", obj.optString("songTitle", ""));
            String category = obj.optString("category", "");
            if (!question.isBlank() || !answer.isBlank()) {
                return QuestionHistoryService.key(question, answer, category);
            }
        } catch (Exception ignored) {
            // payload non JSON (es. proverbio): si usa il testo normalizzato
        }
        return "raw|" + QuestionHistoryService.normalize(jsonPayload);
    }

    /**
     * Domande quiz per l'Air Hockey: quattro opzioni, difficoltà richiesta.
     * Restituisce righe pronte per il frontend (nessun payload AI a runtime).
     */
    public List<Map<String, Object>> quizBatch(String difficulty, int count) {
        List<BankQuestion> candidates = new ArrayList<>();
        for (BankQuestion question : allQuestions()) {
            // Air Hockey ha una banca dedicata di domande corte: se manca
            // qualcosa si completa con i QUIZ normali, non viceversa.
            if (!"AIR_HOCKEY".equals(question.type()) || question.options().size() != 4) {
                continue;
            }
            if (difficulty != null && !difficulty.isBlank()
                    && !"MIXED".equalsIgnoreCase(difficulty)
                    && !question.difficulty().equalsIgnoreCase(difficulty)) {
                continue;
            }
            candidates.add(question);
        }

        if (candidates.size() < count) {
            for (BankQuestion question : allQuestions()) {
                if (!"QUIZ".equals(question.type()) || question.options().size() != 4) {
                    continue;
                }
                if (difficulty != null && !difficulty.isBlank()
                        && !"MIXED".equalsIgnoreCase(difficulty)
                        && !question.difficulty().equalsIgnoreCase(difficulty)
                        && !airHockeyDifficulty(question.difficulty()).equalsIgnoreCase(difficulty)) {
                    continue;
                }
                candidates.add(question);
            }
        }

        Collections.shuffle(candidates, random);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (BankQuestion question : candidates) {
            if (rows.size() >= count) {
                break;
            }
            rows.add(Map.of(
                    "question", question.question(),
                    "options", question.options(),
                    "correctAnswer", question.correctAnswer(),
                    "correctIndex", Math.max(0, question.options().indexOf(question.correctAnswer())),
                    "difficulty", airHockeyDifficulty(question.difficulty())));
        }
        return rows;
    }

    /**
     * Cavallo di Battaglia: otto domande flash della categoria scelta dalla
     * squadra, preferendo le difficili. La risposta corretta viaggia con la
     * domanda perché è la TV a validare i tocchi dei telefoni.
     */
    public List<Map<String, Object>> cavalloQuestions(String category, int count) {
        int wanted = Math.max(1, Math.min(20, count));
        List<BankQuestion> hard = new ArrayList<>();
        List<BankQuestion> medium = new ArrayList<>();
        List<BankQuestion> otherCategories = new ArrayList<>();

        for (BankQuestion question : allQuestions()) {
            if (!isCavalloPlayable(question)) {
                continue;
            }
            boolean sameCategory = category == null || category.isBlank()
                    || question.category().equalsIgnoreCase(category);
            if (!sameCategory) {
                if (isHardDifficulty(question.difficulty())) {
                    otherCategories.add(question);
                }
                continue;
            }
            if (isHardDifficulty(question.difficulty())) {
                hard.add(question);
            } else {
                medium.add(question);
            }
        }

        Collections.shuffle(hard, random);
        Collections.shuffle(medium, random);
        Collections.shuffle(otherCategories, random);

        List<BankQuestion> pool = new ArrayList<>(hard);
        pool.addAll(medium);
        pool.addAll(otherCategories);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (BankQuestion question : pool) {
            if (rows.size() >= wanted) {
                break;
            }
            List<String> options = new ArrayList<>(question.options());
            Collections.shuffle(options, random);
            rows.add(Map.of(
                    "question", question.question(),
                    "options", options,
                    "correctAnswer", question.correctAnswer(),
                    "correctIndex", Math.max(0, options.indexOf(question.correctAnswer())),
                    "category", question.category(),
                    "difficulty", question.difficulty()));
        }
        return rows;
    }

    /** Il Cavallo usa solo domande con opzioni toccabili dal telefono. */
    private boolean isCavalloPlayable(BankQuestion question) {
        if (!"QUIZ".equals(question.type()) && !"TRUE_FALSE".equals(question.type())) {
            return false;
        }
        return question.options().size() >= 2 && question.options().contains(question.correctAnswer());
    }

    /**
     * Domande Bomba per atto: Vero/Falso nei primi due, tre opzioni nei
     * centrali, difficili e più rapide nell'ultimo. La risposta corretta resta
     * nel servizio e non viene mai serializzata verso TV o telefoni.
     */
    public List<BombaQuestion> bombaQuestions(int act, int count) {
        int safeAct = Math.max(1, Math.min(5, act));
        int wanted = Math.max(1, Math.min(120, count));
        boolean trueFalse = safeAct <= 2;

        List<BankQuestion> primary = bombaCandidates(trueFalse, safeAct, true);
        if (primary.size() < wanted) {
            List<BankQuestion> fallback = bombaCandidates(trueFalse, safeAct, false);
            Set<String> seen = new HashSet<>();
            for (BankQuestion question : primary) {
                seen.add(question.id());
            }
            for (BankQuestion question : fallback) {
                if (seen.add(question.id())) {
                    primary.add(question);
                }
            }
        }

        Collections.shuffle(primary, random);
        List<BombaQuestion> result = new ArrayList<>();
        Set<String> used = new HashSet<>();
        for (BankQuestion question : primary) {
            if (result.size() >= wanted) {
                break;
            }
            if (!used.add(question.id())) {
                continue;
            }

            List<String> options;
            if (trueFalse) {
                options = question.options().stream()
                        .filter(option -> "VERO".equalsIgnoreCase(option) || "FALSO".equalsIgnoreCase(option))
                        .toList();
                if (options.size() < 2) {
                    continue;
                }
            } else {
                options = threeOptions(question);
                if (options == null) {
                    continue;
                }
            }

            result.add(new BombaQuestion(
                    question.id(),
                    question.question(),
                    List.copyOf(options),
                    question.correctAnswer(),
                    trueFalse ? "VERO_FALSO" : "TRE_OPZIONI"));
        }
        return result;
    }

    private List<BankQuestion> bombaCandidates(boolean trueFalse, int act, boolean strict) {
        List<BankQuestion> candidates = new ArrayList<>();
        for (BankQuestion question : allQuestions()) {
            if (trueFalse) {
                if (!"TRUE_FALSE".equals(question.type())) {
                    continue;
                }
                if (strict && question.question().length() > 110) {
                    continue;
                }
            } else {
                if (!"QUIZ".equals(question.type()) || question.options().size() < 3
                        || !question.options().contains(question.correctAnswer())) {
                    continue;
                }
                if (strict && question.question().length() > 120) {
                    continue;
                }
                if (strict && act >= 5 && !isHardDifficulty(question.difficulty())) {
                    continue;
                }
            }
            candidates.add(question);
        }
        return candidates;
    }

    private boolean isHardDifficulty(String difficulty) {
        return "difficile".equalsIgnoreCase(difficulty) || "hard".equalsIgnoreCase(difficulty);
    }

    private List<String> threeOptions(BankQuestion question) {
        String correct = question.correctAnswer();
        List<String> distractors = question.options().stream()
                .filter(option -> !option.equalsIgnoreCase(correct))
                .distinct()
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        if (distractors.size() < 2) {
            return null;
        }
        Collections.shuffle(distractors, random);
        List<String> options = new ArrayList<>();
        options.add(correct);
        options.add(distractors.get(0));
        options.add(distractors.get(1));
        Collections.shuffle(options, random);
        return options;
    }

    /** Difficolta della banca normalizzata: facile, medio, difficile. */
    private String normalizeArenaDifficulty(String difficulty) {
        String value = difficulty == null ? "" : difficulty.toLowerCase(Locale.ROOT);
        return switch (value) {
            case "facile", "easy" -> "facile";
            case "difficile", "hard" -> "difficile";
            default -> "medio";
        };
    }

    /** Le difficoltà della banca sono in italiano; l'Air Hockey usa le sigle. */
    private String airHockeyDifficulty(String difficulty) {
        return switch (difficulty == null ? "" : difficulty.toLowerCase(Locale.ROOT)) {
            case "easy", "facile" -> "EASY";
            case "hard", "difficile" -> "HARD";
            default -> "MEDIUM";
        };
    }

    public int bankSize() {
        return bank.size();
    }

    /** Riepilogo per il log di avvio: quante domande per categoria. */
    public String bankSummary() {
        if (bank.isEmpty()) {
            return "banca domande assente: esegui scripts/generate-questions/generate.py";
        }
        Map<String, Integer> perCategory = new TreeMap<>();
        for (BankQuestion question : bank) {
            if (!"AIR_HOCKEY".equals(question.type())) {
                perCategory.merge(question.category(), 1, Integer::sum);
            }
        }
        long airHockey = bank.stream().filter(question -> "AIR_HOCKEY".equals(question.type())).count();
        StringBuilder summary = new StringBuilder("banca domande: ").append(bank.size()).append(" totali");
        perCategory.forEach((category, total) -> summary.append(" | ").append(category).append(' ').append(total));
        summary.append(" | Air Hockey ").append(airHockey);
        return summary.toString();
    }

    /** Avvisi all'avvio: meglio scoprire una categoria povera adesso che al pub. */
    private void logBankSummary() {
        System.out.println(bankSummary());
        if (bank.isEmpty()) {
            return;
        }

        Map<String, Integer> playable = new TreeMap<>();
        for (BankQuestion question : bank) {
            if ("TRUE_FALSE".equals(question.type())) {
                playable.merge(question.category(), 1, Integer::sum);
            }
        }
        playable.forEach((category, total) -> {
            if (total < MIN_ARENA_QUESTIONS) {
                System.out.println("⚠️ " + category + ": " + total
                        + " domande giocabili in arena (sotto le " + MIN_ARENA_QUESTIONS
                        + "): alcune arriveranno da altre categorie.");
            }
        });
    }

    private List<BankQuestion> allQuestions() {
        return bank.isEmpty() ? EMERGENCY : bank;
    }

    private String fromBank(String category, String type, Predicate<String> isAvailable) {
        Optional<String> sameCategory = pickPayload(category, type, isAvailable);
        if (sameCategory.isPresent()) {
            return sameCategory.get();
        }
        return pickPayload(null, type, isAvailable)
                .orElseGet(() -> emergencyPayload(type, category));
    }

    /** Mescola i candidati e restituisce il primo payload con domanda non ancora uscita. */
    private Optional<String> pickPayload(String category, String type, Predicate<String> isAvailable) {
        List<BankQuestion> shuffled = candidates(category, type);
        Collections.shuffle(shuffled, random);
        for (BankQuestion question : shuffled) {
            Optional<String> payload = toPayload(question);
            if (payload.isPresent() && isAvailable.test(payloadDedupeKey(payload.get()))) {
                return payload;
            }
        }
        return Optional.empty();
    }

    private List<BankQuestion> candidates(String category, String type) {
        List<BankQuestion> found = new ArrayList<>();
        for (BankQuestion question : allQuestions()) {
            if (!question.type().equalsIgnoreCase(type)) {
                continue;
            }
            if (category != null && !question.category().equalsIgnoreCase(category)) {
                continue;
            }
            if (question.question().isBlank() || question.correctAnswer().isBlank()) {
                continue;
            }
            found.add(question);
        }
        return found;
    }

    private Optional<String> toPayload(BankQuestion question) {
        JSONObject payload = new JSONObject();
        payload.put("question", question.question());
        payload.put("type", question.type());
        payload.put("category", question.category());
        payload.put("difficulty", question.difficulty());
        payload.put("correctAnswer", question.correctAnswer());
        payload.put("options", question.options().isEmpty() ? JSONObject.NULL : new JSONArray(question.options()));
        if (question.explanation() != null && !question.explanation().isBlank()) {
            payload.put("explanation", question.explanation());
        }
        if ("IMAGE_BLUR".equals(question.type())) {
            String imageUrl = resolveCelebrityImage(question.correctAnswer());
            if (imageUrl == null || imageUrl.isBlank()) {
                return Optional.empty();
            }
            payload.put("imageUrl", imageUrl);
        }
        return Optional.of(payload.toString());
    }

    /**
     * Foto del personaggio: prima quella scaricata in locale dalla banca media,
     * poi TMDB. Senza foto la domanda viene scartata: l'immagine è il gioco.
     */
    private String resolveCelebrityImage(String celebrity) {
        String localPhoto = celebrityPhotos.get(QuestionHistoryService.normalize(celebrity));
        if (localPhoto != null && !localPhoto.isBlank()) {
            return mediaUrl(localPhoto);
        }

        String imageUrl = tmdbImageService.getCelebrityImageUrl(celebrity);
        return imageUrl == null || imageUrl.isBlank() ? null : imageUrl;
    }

    private String roulettePayload() {
        JSONObject payload = new JSONObject();
        payload.put("question", "Scegli un colore!");
        payload.put("options", new JSONArray(COLORS));
        payload.put("correctAnswer", COLORS.get(random.nextInt(COLORS.size())));
        payload.put("type", "ROULETTE");
        return payload.toString();
    }

    private String pickRandomProverb() {
        return PROVERBS[random.nextInt(PROVERBS.length)];
    }

    private String arenaWrapper() {
        JSONObject wrapper = new JSONObject();
        wrapper.put("type", "ARENA");
        wrapper.put("questions", new JSONArray());
        return wrapper.toString();
    }

    private String musicPayload() {
        if (!musicTracks.isEmpty()) {
            MediaTrack localTrack = musicTracks.get(random.nextInt(musicTracks.size()));

            JSONObject payload = new JSONObject();
            payload.put("type", "MUSIC");
            payload.put("songTitle", localTrack.title());
            payload.put("artist", localTrack.artist());
            payload.put("previewUrl", mediaUrl(localTrack.file()));
            payload.put("albumCover",
                    localTrack.albumCover() == null ? JSONObject.NULL : localTrack.albumCover());
            payload.put("year", localTrack.year());
            payload.put("source", "banca-media");
            payload.put("payload", JSONObject.NULL);
            return payload.toString();
        }

        MusicTrackDto track = appleMusicCuratorService.getFamousSong();

        JSONObject payload = new JSONObject();
        payload.put("type", "MUSIC");
        payload.put("songTitle", track.title);
        payload.put("artist", track.artist);
        payload.put("previewUrl", track.previewUrl);
        payload.put("albumCover", track.albumCover);
        payload.put("year", track.year);
        payload.put("source", track.source);
        payload.put("payload", JSONObject.NULL);
        return payload.toString();
    }

    /** Ultima spiaggia: payload valido costruito dalle domande di emergenza. */
    private String emergencyPayload(String type, String category) {
        BankQuestion question = EMERGENCY.stream()
                .filter(candidate -> candidate.type().equalsIgnoreCase(type))
                .findFirst()
                .orElse(EMERGENCY.get(0));

        JSONObject payload = new JSONObject();
        payload.put("question", question.question());
        payload.put("type", type);
        payload.put("category", category == null ? question.category() : category);
        payload.put("difficulty", question.difficulty());
        payload.put("correctAnswer", question.correctAnswer());
        payload.put("options", question.options().isEmpty() ? JSONObject.NULL : new JSONArray(question.options()));
        return payload.toString();
    }

    private List<BankQuestion> loadBank() {
        ClassPathResource resource = new ClassPathResource("questions/questions-it.json");
        if (!resource.exists()) {
            System.out.println("⚠️ Banca domande assente: il gioco usa solo le domande di emergenza.");
            return List.of();
        }
        try (InputStream stream = resource.getInputStream()) {
            String json = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            JSONArray items = new JSONObject(json).optJSONArray("questions");
            List<BankQuestion> loaded = new ArrayList<>();
            if (items != null) {
                for (int index = 0; index < items.length(); index++) {
                    JSONObject item = items.optJSONObject(index);
                    if (item == null) {
                        continue;
                    }
                    JSONArray rawOptions = item.optJSONArray("options");
                    List<String> options = new ArrayList<>();
                    if (rawOptions != null) {
                        for (int option = 0; option < rawOptions.length(); option++) {
                            options.add(rawOptions.optString(option));
                        }
                    }
                    loaded.add(new BankQuestion(
                            item.optString("id", "q" + index),
                            item.optString("category", ""),
                            item.optString("type", "QUIZ").toUpperCase(Locale.ROOT),
                            item.optString("difficulty", "medio"),
                            item.optString("question", ""),
                            item.optString("correctAnswer", ""),
                            List.copyOf(options),
                            item.optString("explanation", null)));
                }
            }
            System.out.println("Banca domande caricata: " + loaded.size() + " domande.");
            return List.copyOf(loaded);
        } catch (Exception error) {
            System.out.println("⚠️ Banca domande illeggibile (" + error.getMessage() + "): uso le domande di emergenza.");
            return List.of();
        }
    }

    private record MediaBank(List<MediaTrack> tracks, Map<String, String> people) {
    }

    /**
     * Banca media: canzoni e foto scaricate in locale da generate_media.py.
     * Se il file non c'è si continua con iTunes e TMDB come prima.
     */
    private MediaBank loadMedia() {
        ClassPathResource resource = new ClassPathResource("questions/media-it.json");
        if (!resource.exists()) {
            return new MediaBank(List.of(), Map.of());
        }
        try (InputStream stream = resource.getInputStream()) {
            JSONObject root = new JSONObject(new String(stream.readAllBytes(), StandardCharsets.UTF_8));

            List<MediaTrack> tracks = new ArrayList<>();
            JSONArray music = root.optJSONArray("music");
            if (music != null) {
                for (int index = 0; index < music.length(); index++) {
                    JSONObject item = music.optJSONObject(index);
                    if (item == null || item.optString("file", "").isBlank()) {
                        continue;
                    }
                    tracks.add(new MediaTrack(
                            item.optString("title", ""),
                            item.optString("artist", ""),
                            item.optString("year", ""),
                            item.optString("albumCover", null),
                            item.optString("file", "")));
                }
            }

            Map<String, String> people = new LinkedHashMap<>();
            JSONArray persons = root.optJSONArray("people");
            if (persons != null) {
                for (int index = 0; index < persons.length(); index++) {
                    JSONObject item = persons.optJSONObject(index);
                    if (item == null || item.optString("file", "").isBlank()) {
                        continue;
                    }
                    people.put(QuestionHistoryService.normalize(item.optString("name", "")),
                            item.optString("file", ""));
                }
            }

            System.out.println("Banca media: " + tracks.size() + " brani, " + people.size() + " volti.");
            return new MediaBank(List.copyOf(tracks), Map.copyOf(people));
        } catch (Exception error) {
            System.out.println("⚠️ Banca media illeggibile (" + error.getMessage()
                    + "): si torna a iTunes/TMDB.");
            return new MediaBank(List.of(), Map.of());
        }
    }

    /**
     * URL servibile del file locale. Il frontend usa previewUrl e imageUrl
     * direttamente, quindi serve un URL assoluto: lo ricava dalla richiesta in
     * corso (funziona anche via IP di rete), con MEDIA_BASE_URL come ripiego.
     */
    private String mediaUrl(String file) {
        if (file == null || file.isBlank()) {
            return null;
        }
        if (file.startsWith("http://") || file.startsWith("https://")) {
            return file;
        }
        String path = file.startsWith("/") ? file : "/" + file;
        String baseUrl = currentBaseUrl();
        return baseUrl.isBlank() ? path : baseUrl + path;
    }

    private String currentBaseUrl() {
        try {
            if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
                HttpServletRequest request = attributes.getRequest();
                return request.getScheme() + "://" + request.getServerName() + ":" + request.getServerPort();
            }
        } catch (RuntimeException ignored) {
            // fuori da una richiesta HTTP: si usa la configurazione
        }
        return configuredMediaBaseUrl;
    }
}
