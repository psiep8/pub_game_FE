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

    /** Tabellone Bomba: elementi veri della categoria e intrusi da bomba. */
    public record ScossaBoard(String prompt, List<String> safe, List<String> intruders) {
    }

    /** Riga della banca domande. */
    private record BankQuestion(String id, String category, String type, String difficulty,
            String question, String correctAnswer, List<String> options, String explanation) {
    }

    /** Brano della banca media: il file audio vive in resources/static/media/music. */
    private record MediaTrack(String title, String artist, String year, String albumCover, String file) {
    }


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
    private static final int SCOMMESSA_QUESTIONS = 3;
    private static final int QUOTA_QUESTIONS = 4;
    private static final int QUIZ_QUESTIONS = 3;

    /** Le cinque combinazioni di difficolta del Quiz, una per round. */
    private static final String[][] QUIZ_PATTERNS = {
            { "facile", "facile", "medio" },
            { "facile", "medio", "medio" },
            { "facile", "medio", "difficile" },
            { "medio", "medio", "difficile" },
            { "medio", "difficile", "difficile" }
    };

    /** Banca numerica di Quota: valore e intervallo plausibile per le fasce. */
    private record NumericQuestion(String category, String question, String unit,
            double value, double min, double max) {
    }

    private static final List<NumericQuestion> NUMERIC_QUESTIONS = List.of(
            new NumericQuestion("Storia", "In che anno è caduto il Muro di Berlino?", "anno", 1989, 1900, 2000),
            new NumericQuestion("Storia", "In che anno Colombo arrivò in America?", "anno", 1492, 1400, 1600),
            new NumericQuestion("Geografia e Viaggi", "Quanti metri è alto l'Everest?", "metri", 8849, 7000, 9500),
            new NumericQuestion("Geografia e Viaggi", "Quanti chilometri è lungo il Nilo?", "km", 6650, 4000, 8000),
            new NumericQuestion("Geografia e Viaggi", "Quanti milioni di abitanti ha l'Italia?", "milioni", 59, 40, 80),
            new NumericQuestion("Scienza e Spazio", "Qual è la velocità della luce in km/s?", "km/s", 299792, 200000, 400000),
            new NumericQuestion("Scienza e Spazio", "A quanti gradi bolle l'acqua a livello del mare?", "°C", 100, 80, 120),
            new NumericQuestion("Scienza e Spazio", "Quanti pianeti ci sono nel Sistema Solare?", "pianeti", 8, 5, 12),
            new NumericQuestion("Sport", "Quanti Mondiali di calcio ha vinto l'Italia?", "titoli", 4, 1, 8),
            new NumericQuestion("Sport", "Quanti chilometri è lunga una maratona?", "km", 42.195, 30, 60),
            new NumericQuestion("Sport", "In che anno si sono tenute le Olimpiadi di Parigi?", "anno", 2024, 1990, 2030),
            new NumericQuestion("Cinema", "In che anno è uscito Titanic?", "anno", 1997, 1980, 2010),
            new NumericQuestion("Cinema", "Quanti Oscar ha vinto Ben-Hur?", "Oscar", 11, 5, 15),
            new NumericQuestion("Musica", "Quante corde ha una chitarra classica?", "corde", 6, 4, 12),
            new NumericQuestion("Musica", "In che anno si è tenuto Woodstock?", "anno", 1969, 1950, 2000),
            new NumericQuestion("Arte e Architettura", "In che anno è stata dipinta la Gioconda?", "anno", 1503, 1400, 1600),
            new NumericQuestion("Arte e Architettura", "Quanti metri è alto il David di Michelangelo?", "metri", 5.17, 3, 8),
            new NumericQuestion("Cibo e Gastronomia", "In che anno è nata la pizza Margherita?", "anno", 1889, 1800, 1950),
            new NumericQuestion("Lingua e Letteratura", "Quante lettere ha l'alfabeto italiano?", "lettere", 21, 18, 30),
            new NumericQuestion("Lingua e Letteratura", "Quanti canti ha la Divina Commedia?", "canti", 100, 50, 150),
            new NumericQuestion("Anime e manga", "In che anno è iniziato Dragon Ball?", "anno", 1984, 1970, 2000),
            new NumericQuestion("Anime e manga", "In che anno è iniziato One Piece?", "anno", 1997, 1980, 2010),
            new NumericQuestion("Gaming e Tecnologia", "In che anno è uscito Tetris?", "anno", 1984, 1970, 2000),
            new NumericQuestion("Gaming e Tecnologia", "In che anno è uscito Minecraft?", "anno", 2011, 1995, 2025),
            new NumericQuestion("Motori", "Quanti chilometri è lungo il circuito di Monza?", "km", 5.793, 3, 8),
            new NumericQuestion("Motori", "In che anno è stata fondata la Ferrari?", "anno", 1947, 1900, 2000),
            new NumericQuestion("Politica e Attualità", "In che anno è nata l'ONU?", "anno", 1945, 1900, 2000),
            new NumericQuestion("Politica e Attualità", "In che anno è nata la Repubblica Italiana?", "anno", 1946, 1900, 2000),
            new NumericQuestion("Natura e Animali", "Quanti metri è lunga la balenottera azzurra?", "metri", 30, 15, 40),
            new NumericQuestion("Natura e Animali", "Quanti metri è alta una giraffa?", "metri", 5.5, 3, 8),
            new NumericQuestion("Serie TV", "In che anno è iniziato Friends?", "anno", 1994, 1980, 2010),
            new NumericQuestion("TV e Spettacolo", "In che anno è iniziato il Festival di Sanremo?", "anno", 1951, 1900, 2000),
            new NumericQuestion("Curiosità", "Quanti giorni ha un anno bisestile?", "giorni", 366, 360, 370),
            new NumericQuestion("Curiosità", "Quante erano le meraviglie del mondo antico?", "meraviglie", 7, 3, 12)
    );

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
            case "WHEEL_OF_FORTUNE", "WHEEL_FORTUNE", "PROVERB" -> pickRandomProverb();
            case "MUSIC" -> musicPayload();
            case "ARENA" -> arenaWrapper();
            case "SCOMMESSA" -> scommessaPayload(category, isAvailable);
            case "QUOTA" -> quotaPayload(category, isAvailable);
            case "QUIZ" -> quizPayload(category, isAvailable);
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

    /**
     * Tabellone della Bomba: elementi veri di una categoria e intrusi da
     * piazzare come bombe. Non c'è una risposta corretta da nascondere: conta
     * solo se la casella appartiene alla categoria.
     */
    public ScossaBoard scossaBoard(int cells, int bombs) {
        int safeNeeded = Math.max(1, cells - bombs);
        int bombsNeeded = Math.max(1, bombs);

        Map<String, List<String>> byCategory = scossaItems();
        List<String> categories = new ArrayList<>(byCategory.keySet());
        Collections.shuffle(categories, random);

        for (String category : categories) {
            List<String> members = byCategory.get(category);
            if (members.size() < safeNeeded) {
                continue;
            }

            Set<String> used = new HashSet<>();
            for (String value : members) {
                used.add(value.toLowerCase(Locale.ROOT));
            }

            List<String> intruders = new ArrayList<>();
            List<String> others = new ArrayList<>(categories);
            others.remove(category);
            Collections.shuffle(others, random);
            for (String other : others) {
                for (String value : byCategory.get(other)) {
                    if (intruders.size() >= bombsNeeded) {
                        break;
                    }
                    if (used.add(value.toLowerCase(Locale.ROOT))) {
                        intruders.add(value);
                    }
                }
                if (intruders.size() >= bombsNeeded) {
                    break;
                }
            }
            if (intruders.size() < bombsNeeded) {
                continue;
            }

            List<String> safe = new ArrayList<>(members);
            Collections.shuffle(safe, random);
            return new ScossaBoard(
                    "Quale tra queste NON appartiene a «" + category + "»?",
                    List.copyOf(safe.subList(0, safeNeeded)),
                    List.copyOf(intruders));
        }

        // Banca vuota o troppo povera: tabellone di riserva, sempre giocabile.
        List<String> safe = new ArrayList<>(List.of(
                "Roma", "Milano", "Napoli", "Firenze", "Torino", "Bologna",
                "Venezia", "Palermo", "Genova", "Verona", "Bari", "Catania",
                "Trieste", "Padova", "Parma", "Cagliari", "Perugia", "Ancona"));
        Collections.shuffle(safe, random);
        List<String> intruders = new ArrayList<>(List.of("Parigi", "Madrid", "Berlino", "Lisbona"));
        Collections.shuffle(intruders, random);
        return new ScossaBoard(
                "Quale tra queste NON è una città italiana?",
                safe.subList(0, Math.min(safeNeeded, safe.size())),
                intruders.subList(0, Math.min(bombsNeeded, intruders.size())));
    }

    /** Elementi brevi per categoria: risposte corrette delle domande quiz. */
    private Map<String, List<String>> scossaItems() {
        Map<String, List<String>> byCategory = new LinkedHashMap<>();
        for (BankQuestion question : allQuestions()) {
            if (!"QUIZ".equals(question.type())) {
                continue;
            }
            String answer = question.correctAnswer();
            if (answer == null || answer.isBlank() || answer.length() > 34
                    || !question.options().contains(answer)) {
                continue;
            }
            List<String> items = byCategory.computeIfAbsent(question.category(), key -> new ArrayList<>());
            if (items.stream().noneMatch(existing -> existing.equalsIgnoreCase(answer))) {
                items.add(answer);
            }
        }
        return byCategory;
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

    /**
     * Quattro domande numeriche con quattro fasce e quote, per il round Quota.
     * Le fasce coprono un intervallo plausibile e il valore cade in una sola;
     * la quota è circa il 10% sotto il rapporto giusto tra intervallo e fascia.
     */
    private String quotaPayload(String category, Predicate<String> isAvailable) {
        List<NumericQuestion> pool = new ArrayList<>();
        for (NumericQuestion question : NUMERIC_QUESTIONS) {
            if (category == null || question.category().equalsIgnoreCase(category)) {
                pool.add(question);
            }
        }
        if (pool.size() < QUOTA_QUESTIONS) {
            pool = new ArrayList<>(NUMERIC_QUESTIONS);
        }
        Collections.shuffle(pool, random);

        JSONArray questions = new JSONArray();
        for (int i = 0; i < Math.min(QUOTA_QUESTIONS, pool.size()); i++) {
            questions.put(quotaQuestionPayload(pool.get(i)));
        }

        JSONObject payload = new JSONObject();
        payload.put("type", "QUOTA");
        payload.put("question", questions.isEmpty() ? "Quota" : questions.getJSONObject(0).getString("question"));
        payload.put("category", category == null ? "" : category);
        payload.put("questions", questions);
        payload.put("explain", "Quattro domande numeriche: distribuisci 100 gettoni sulle fasce. "
                + "La fascia che contiene il valore paga la quota, le altre perdono i gettoni.");
        return payload.toString();
    }

    private JSONObject quotaQuestionPayload(NumericQuestion question) {
        double span = Math.max(0.0001, question.max() - question.min());
        int[] baseWidths = { 1, 2, 3, 5 };
        int offset = random.nextInt(baseWidths.length);
        double unit = span / 11.0;

        JSONArray bands = new JSONArray();
        double from = question.min();
        int correct = -1;
        for (int i = 0; i < baseWidths.length; i++) {
            double width = baseWidths[(i + offset) % baseWidths.length] * unit;
            double to = i == baseWidths.length - 1 ? question.max() : from + width;
            double odds = 0.9 * span / Math.max(0.0001, to - from);
            odds = Math.max(1.2, Math.min(20.0, Math.round(odds * 10) / 10.0));

            JSONObject band = new JSONObject();
            band.put("from", round1(from));
            band.put("to", round1(to));
            band.put("odds", odds);
            bands.put(band);

            if (correct < 0 && question.value() >= from && question.value() < to) {
                correct = i;
            }
            from = to;
        }
        if (correct < 0) {
            correct = baseWidths.length - 1;
        }

        JSONObject payload = new JSONObject();
        payload.put("question", question.question());
        payload.put("category", question.category());
        payload.put("unit", question.unit());
        payload.put("value", question.value());
        payload.put("bands", bands);
        payload.put("correctBand", correct);
        return payload;
    }

    private double round1(double value) {
        return Math.round(value * 10) / 10.0;
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

    /**
     * La Scommessa gioca tre domande di fila: pesca tre Quiz distinti della
     * stessa categoria (o delle altre, se la categoria è esaurita). Le risposte
     * restano nel payload perché è la TV a condurre banca e reveal.
     */
    private String scommessaPayload(String category, Predicate<String> isAvailable) {
        JSONArray questions = new JSONArray();
        List<String> picked = new ArrayList<>();

        for (int i = 0; i < SCOMMESSA_QUESTIONS; i++) {
            String raw = fromBank(category, "QUIZ", key -> !picked.contains(key) && isAvailable.test(key));
            questions.put(new JSONObject(raw));
            picked.add(payloadDedupeKey(raw));
        }

        String firstCategory = category == null ? "" : category;
        String firstQuestion = "La Scommessa";
        if (!questions.isEmpty()) {
            JSONObject first = questions.getJSONObject(0);
            firstCategory = first.optString("category", firstCategory);
            firstQuestion = first.optString("question", firstQuestion);
        }

        JSONObject payload = new JSONObject();
        payload.put("type", "SCOMMESSA");
        payload.put("category", firstCategory);
        // Serve alla deduplica della partita e all'anteprima del presentatore.
        payload.put("question", firstQuestion);
        payload.put("questions", questions);
        payload.put("explain", "Tre domande: ogni esatta raddoppia la banca, una sbagliata la brucia. Tra una e l'altra scegli se incassare.");
        return payload.toString();
    }

    /**
     * Quiz a tre manches: tre domande della stessa categoria con la
     * combinazione di difficolta del round. Ogni domanda porta con se il tetto
     * punti, calcolato sul peso della difficolta, cosi tre risposte esatte a
     * tempo zero valgono esattamente 1000 punti.
     */
    private String quizPayload(String category, Predicate<String> isAvailable) {
        String[] pattern = QUIZ_PATTERNS[random.nextInt(QUIZ_PATTERNS.length)];
        List<BankQuestion> picked = new ArrayList<>();
        Set<String> used = new HashSet<>();

        for (String difficulty : pattern) {
            BankQuestion question = pickQuizQuestion(category, difficulty, isAvailable, used);
            if (question == null) {
                question = pickQuizQuestion(null, difficulty, isAvailable, used);
            }
            if (question == null) {
                // Banca corta: si accetta anche una difficolta diversa, ma la
                // domanda resta nuova e giocabile.
                question = pickQuizQuestion(category, null, isAvailable, used);
            }
            if (question == null) {
                question = pickQuizQuestion(null, null, isAvailable, used);
            }
            if (question == null) {
                break;
            }
            picked.add(question);
            used.add(QuestionHistoryService.key(question.question(), question.correctAnswer(), question.category()));
        }

        if (picked.isEmpty()) {
            return emergencyPayload("QUIZ", category);
        }

        double totalWeight = 0;
        for (BankQuestion question : picked) {
            totalWeight += quizWeight(question.difficulty());
        }

        JSONArray questions = new JSONArray();
        int assigned = 0;
        for (int index = 0; index < picked.size(); index++) {
            BankQuestion question = picked.get(index);
            int maxPoints = index == picked.size() - 1
                    ? Math.max(0, 1000 - assigned)
                    : (int) Math.round(1000.0 * quizWeight(question.difficulty()) / totalWeight);
            assigned += maxPoints;

            List<String> options = new ArrayList<>(question.options());
            Collections.shuffle(options, random);
            questions.put(new JSONObject()
                    .put("question", question.question())
                    .put("options", new JSONArray(options))
                    .put("correctAnswer", question.correctAnswer())
                    .put("difficulty", normalizeQuizDifficulty(question.difficulty()))
                    .put("maxPoints", maxPoints)
                    .put("category", question.category()));
        }

        JSONObject first = questions.getJSONObject(0);
        JSONObject payload = new JSONObject();
        payload.put("type", "QUIZ");
        payload.put("question", first.getString("question"));
        payload.put("options", first.getJSONArray("options"));
        payload.put("correctAnswer", first.getString("correctAnswer"));
        payload.put("category", first.optString("category", category == null ? "" : category));
        payload.put("difficulty", normalizeQuizDifficulty(picked.get(0).difficulty()));
        payload.put("questions", questions);
        payload.put("manches", questions.length());
        payload.put("explain", "Tre manches: ogni domanda vale fino a 1000 diviso per il peso "
                + "della sua difficolta. Rispondere subito vale il massimo, il tempo taglia i punti.");
        return payload.toString();
    }

    /** Una domanda Quiz mai usata, preferendo la categoria e la difficolta richieste. */
    private BankQuestion pickQuizQuestion(String category, String difficulty,
            Predicate<String> isAvailable, Set<String> used) {
        List<BankQuestion> candidates = new ArrayList<>();
        for (BankQuestion question : allQuestions()) {
            if (!"QUIZ".equals(question.type()) || question.options().size() != 4
                    || question.options().isEmpty()) {
                continue;
            }
            if (category != null && !question.category().equalsIgnoreCase(category)) {
                continue;
            }
            if (difficulty != null && !question.difficulty().equalsIgnoreCase(difficulty)) {
                continue;
            }
            String key = QuestionHistoryService.key(question.question(), question.correctAnswer(), question.category());
            if (used.contains(key)) {
                continue;
            }
            Optional<String> payload = toPayload(question);
            if (payload.isPresent() && isAvailable.test(payloadDedupeKey(payload.get()))) {
                candidates.add(question);
            }
        }
        if (candidates.isEmpty()) {
            return null;
        }
        return candidates.get(random.nextInt(candidates.size()));
    }

    private double quizWeight(String difficulty) {
        String value = difficulty == null ? "" : difficulty.toLowerCase(Locale.ROOT);
        return switch (value) {
            case "facile", "easy" -> 1.0;
            case "difficile", "hard" -> 3.0;
            default -> 2.0;
        };
    }

    private String normalizeQuizDifficulty(String difficulty) {
        String value = difficulty == null ? "" : difficulty.toLowerCase(Locale.ROOT);
        return switch (value) {
            case "facile", "easy" -> "facile";
            case "difficile", "hard" -> "difficile";
            default -> "medio";
        };
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
