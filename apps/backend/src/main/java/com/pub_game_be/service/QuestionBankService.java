package com.pub_game_be.service;

import com.pub_game_be.dto.MusicTrackDto;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

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
import java.util.UUID;
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
    private final CelebrityImageService celebrityImageService;
    private final AzzardoMediaService azzardoMediaService;
    private final LocalMediaBankService localMedia;
    private final Random random = new Random();

    /** Sotto questo numero di domande l'arena finisce le scorte della categoria. */
    private static final int MIN_ARENA_QUESTIONS = 10;
    /** Livelli di Ultima spiaggia: uno per occorrenza, usabile una volta per squadra. */
    private static final int[] ULTIMA_SPIAGGIA_LEVELS = { 100, 200, 300, 400, 500 };

    /** Livello 1-2 dalla fascia facile, 3-4 dalla media, 5 dalla difficile. */
    private static final String[] ULTIMA_SPIAGGIA_BANDS =
            { "facile", "facile", "medio", "medio", "difficile" };
    private static final int QUIZ_QUESTIONS = 3;

    /** Le cinque combinazioni di difficolta del Quiz, una per round. */
    private static final String[][] QUIZ_PATTERNS = {
            { "facile", "facile", "medio" },
            { "facile", "medio", "medio" },
            { "facile", "medio", "difficile" },
            { "medio", "medio", "difficile" },
            { "medio", "difficile", "difficile" }
    };

    /** Banca di Azzardo: una domanda numerica per categoria e livello. */
    private record AzzardoQuestion(int level, String category, String question, String unit,
            double value, double step) {
    }

    private static final List<String> AZZARDO_CATEGORIES =
            List.of("CELEBRITÀ", "CANZONI", "PAESI", "STORIA");

    /** Tenuta minima se il file della banca manca: una domanda per categoria e livello. */
    private static final List<AzzardoQuestion> AZZARDO_EMERGENCY = List.of(
            new AzzardoQuestion(1, "CELEBRITÀ", "Qual è l'anno di nascita di Albert Einstein?", "anno", 1879, 2),
            new AzzardoQuestion(1, "CANZONI", "In che anno è uscita Imagine di John Lennon?", "anno", 1971, 2),
            new AzzardoQuestion(1, "PAESI", "Quanti paesi confinano con l'Italia?", "paesi confinanti", 6, 1),
            new AzzardoQuestion(1, "STORIA", "In che anno è caduto il Muro di Berlino?", "anno", 1989, 2),
            new AzzardoQuestion(2, "CELEBRITÀ", "Qual è l'anno di nascita di Madonna?", "anno", 1958, 3),
            new AzzardoQuestion(2, "CANZONI", "In che anno è uscita Hotel California di Eagles?", "anno", 1976, 3),
            new AzzardoQuestion(2, "PAESI", "Quanti paesi confinano con il Brasile?", "paesi confinanti", 10, 1),
            new AzzardoQuestion(2, "STORIA", "In che anno è stato assassinato John Kennedy?", "anno", 1963, 3),
            new AzzardoQuestion(3, "CELEBRITÀ", "Qual è l'anno di nascita di Stephen Hawking?", "anno", 1942, 4),
            new AzzardoQuestion(3, "CANZONI", "In che anno è uscita Stairway to Heaven di Led Zeppelin?", "anno", 1971, 4),
            new AzzardoQuestion(3, "PAESI", "Quanti milioni di abitanti ha l'Italia?", "milioni di abitanti", 59, 5),
            new AzzardoQuestion(3, "STORIA", "In che anno è caduta Costantinopoli?", "anno", 1453, 4)
    );

    /** Banca caricata da questions/azzardo-it.json. */
    private final List<AzzardoQuestion> azzardoQuestions;

    public QuestionBankService(TMDBImageService tmdbImageService,
            AppleMusicCuratorService appleMusicCuratorService,
            CelebrityImageService celebrityImageService,
            AzzardoMediaService azzardoMediaService,
            LocalMediaBankService localMedia) {
        this.tmdbImageService = tmdbImageService;
        this.appleMusicCuratorService = appleMusicCuratorService;
        this.celebrityImageService = celebrityImageService;
        this.azzardoMediaService = azzardoMediaService;
        this.localMedia = localMedia;
        this.bank = loadBank();
        this.azzardoQuestions = loadAzzardo();

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
            case "ULTIMA_SPIAGGIA" -> ultimaSpiaggiaPayload(category, isAvailable);
            case "AZZARDO" -> azzardoPayload(category, difficulty, isAvailable);
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
            JSONArray rounds = obj.optJSONArray("rounds");
            if (rounds != null && !rounds.isEmpty()) {
                // Ultima spiaggia contiene piu domande: la chiave deve descrivere
                // l'intero pacchetto, non il titolo fisso del round.
                StringBuilder signature = new StringBuilder();
                for (int index = 0; index < rounds.length(); index++) {
                    JSONObject round = rounds.optJSONObject(index);
                    if (round == null) {
                        continue;
                    }
                    signature.append(round.optString("category", "")).append('|');
                    JSONArray questions = round.optJSONArray("questions");
                    if (questions == null) {
                        continue;
                    }
                    for (int questionIndex = 0; questionIndex < questions.length(); questionIndex++) {
                        JSONObject question = questions.optJSONObject(questionIndex);
                        if (question == null) {
                            continue;
                        }
                        signature.append(question.optString("question", "")).append('|')
                                .append(question.optString("correctAnswer", "")).append('|');
                    }
                }
                return "bundle|" + UUID.nameUUIDFromBytes(
                        signature.toString().getBytes(StandardCharsets.UTF_8));
            }
            // Azzardo e Quiz mettono le domande in `questions`: il titolo del
            // round è fisso ("Azzardo: quattro manche"), quindi senza questa
            // firma due pacchetti diversi nella stessa categoria avrebbero la
            // stessa chiave e il secondo verrebbe rifiutato come doppione.
            JSONArray questions = obj.optJSONArray("questions");
            if (questions != null && !questions.isEmpty()) {
                StringBuilder signature = new StringBuilder();
                for (int index = 0; index < questions.length(); index++) {
                    JSONObject question = questions.optJSONObject(index);
                    if (question == null) {
                        continue;
                    }
                    signature.append(question.optString("category", "")).append('|')
                            .append(question.optString("question", "")).append('|');
                    String answer = question.optString("correctAnswer", "");
                    if (answer.isEmpty()) {
                        answer = String.valueOf(question.opt("value"));
                    }
                    signature.append(answer).append('|');
                }
                return "questions|" + UUID.nameUUIDFromBytes(
                        signature.toString().getBytes(StandardCharsets.UTF_8));
            }

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
     * Domande quiz per l'Tennis: quattro opzioni, difficoltà richiesta.
     * Restituisce righe pronte per il frontend (nessun payload AI a runtime).
     */
    public List<Map<String, Object>> quizBatch(String difficulty, int count) {
        List<BankQuestion> candidates = new ArrayList<>();
        for (BankQuestion question : allQuestions()) {
            // Tennis ha una banca dedicata di domande corte: se manca
            // qualcosa si completa con i QUIZ normali, non viceversa.
            if (!"TENNIS_BATTLE".equals(question.type()) || question.options().size() != 4) {
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
                        && !tennisDifficulty(question.difficulty()).equalsIgnoreCase(difficulty)) {
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
                    "difficulty", tennisDifficulty(question.difficulty())));
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

    private int difficultyRank(String difficulty) {
        String value = difficulty == null ? "" : difficulty.toLowerCase(Locale.ROOT);
        return switch (value) {
            case "facile", "easy" -> 1;
            case "difficile", "hard" -> 3;
            default -> 2;
        };
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

    /** Le difficoltà della banca sono in italiano; l'Tennis usa le sigle. */
    private String tennisDifficulty(String difficulty) {
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
        return scossaBoard(cells, bombs, 5);
    }

    public ScossaBoard scossaBoard(int cells, int bombs, int act) {
        int safeNeeded = Math.max(1, cells - bombs);
        int bombsNeeded = Math.max(1, bombs);

        // Bomba è il gioco dei dettagli: si parte dalle risposte difficili,
        // poi si allarga a media+difficile e solo alla fine a tutta la banca.
        Map<String, List<String>> byCategory = scossaItems(act >= 4 ? 3 : 2);
        if (!hasPlayableCategory(byCategory, safeNeeded)) {
            byCategory = scossaItems(2);
        }
        if (!hasPlayableCategory(byCategory, safeNeeded)) {
            byCategory = scossaItems(0);
        }
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

    private boolean hasPlayableCategory(Map<String, List<String>> byCategory, int needed) {
        return byCategory.values().stream().anyMatch(items -> items.size() >= needed);
    }

    /** Elementi brevi per categoria: risposte corrette delle domande quiz. */
    private Map<String, List<String>> scossaItems(int minDifficultyRank) {
        Map<String, List<String>> byCategory = new LinkedHashMap<>();
        for (BankQuestion question : allQuestions()) {
            if (!"QUIZ".equals(question.type())) {
                continue;
            }
            if (difficultyRank(question.difficulty()) < minDifficultyRank) {
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
            if (!"TENNIS_BATTLE".equals(question.type())) {
                perCategory.merge(question.category(), 1, Integer::sum);
            }
        }
        long tennis = bank.stream().filter(question -> "TENNIS_BATTLE".equals(question.type())).count();
        StringBuilder summary = new StringBuilder("banca domande: ").append(bank.size()).append(" totali");
        perCategory.forEach((category, total) -> summary.append(" | ").append(category).append(' ').append(total));
        summary.append(" | Tennis ").append(tennis);
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
     * Azzardo: quattro manche, una domanda per categoria (celebrità, canzoni,
     * paesi, storia) con quattro opzioni numeriche vicine tra loro. Il livello
     * arriva dalla difficoltà del round: 1 facile, 2 media, 3 difficile.
     */
    private String azzardoPayload(String category, String difficulty, Predicate<String> isAvailable) {
        int level = levelForDifficulty(difficulty);
        JSONArray questions = new JSONArray();

        for (String wanted : AZZARDO_CATEGORIES) {
            azzardoQuestion(wanted, level).ifPresent(question -> questions.put(azzardoQuestionPayload(question)));
        }

        JSONObject payload = new JSONObject();
        payload.put("type", "AZZARDO");
        payload.put("level", level);
        payload.put("odds", level + 1);
        payload.put("question", "Azzardo: quattro manche");
        payload.put("category", category == null ? "" : category);
        payload.put("questions", questions);
        payload.put("explain", "Quattro manche numeriche, una per categoria. Punta 100, 200 o 300 punti "
                + "sulla risposta giusta: vince puntata x quota (2, 3 o 4), sbagliare costa una parte "
                + "della puntata che scende manche dopo manche.");
        return payload.toString();
    }

    /** Una domanda della categoria e del livello richiesti, pescata a caso. */
    private Optional<AzzardoQuestion> azzardoQuestion(String category, int level) {
        List<AzzardoQuestion> pool = new ArrayList<>();
        for (AzzardoQuestion question : azzardoQuestions) {
            if (question.level() == level && question.category().equalsIgnoreCase(category)) {
                pool.add(question);
            }
        }
        if (pool.isEmpty()) {
            for (AzzardoQuestion question : azzardoQuestions) {
                if (question.level() == level) {
                    pool.add(question);
                }
            }
        }
        if (pool.isEmpty()) {
            pool.addAll(azzardoQuestions);
        }
        Collections.shuffle(pool, random);
        return pool.isEmpty() ? Optional.empty() : Optional.of(pool.get(0));
    }

    private JSONObject azzardoQuestionPayload(AzzardoQuestion question) {
        double step = Math.max(0.0001, question.step());
        List<Double> values = new ArrayList<>();
        for (double offset : new double[] { -2, -1, 0, 1 }) {
            values.add(round2(question.value() + offset * step));
        }
        Collections.shuffle(values, random);

        JSONArray options = new JSONArray();
        int answerIndex = -1;
        for (int i = 0; i < values.size(); i++) {
            double value = values.get(i);
            options.put(value);
            if (answerIndex < 0 && Math.abs(value - question.value()) < 0.0001) {
                answerIndex = i;
            }
        }

        JSONObject payload = new JSONObject();
        payload.put("question", question.question());
        payload.put("category", question.category());
        payload.put("unit", question.unit());
        payload.put("value", question.value());
        payload.put("options", options);
        payload.put("answerIndex", Math.max(0, answerIndex));

        JSONObject media = azzardoMediaService.forQuestion(question.category(), question.question());
        if (media != null) {
            payload.put("media", media);
        }
        return payload;
    }

    private int levelForDifficulty(String difficulty) {
        if (difficulty == null) {
            return 2;
        }
        return switch (difficulty.toLowerCase(Locale.ROOT)) {
            case "facile", "easy" -> 1;
            case "difficile", "hard" -> 3;
            default -> 2;
        };
    }

    private double round2(double value) {
        return Math.round(value * 100) / 100.0;
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
            // La domanda resta giocabile anche senza foto: la TV mostra il
            // segnaposto con l'iniziale invece di saltare il round.
            payload.put("imageUrl", imageUrl == null ? "" : imageUrl);
            payload.put("imageFallback", imageUrl == null || imageUrl.isBlank());

            // Indizi già ripuliti dal nome: la TV ne svela uno ogni pochi
            // secondi, dal più vago al più diretto.
            List<String> clues = cluesFor(question.correctAnswer());
            if (!clues.isEmpty()) {
                payload.put("clues", new JSONArray(clues));
            }
        }
        return Optional.of(payload.toString());
    }

    /**
     * Foto del personaggio: prima la banca media locale, poi TMDB, infine
     * Wikipedia. Quest'ultima non richiede chiavi ed evita che la TV resti
     * senza volto quando TMDB non è configurato. Se manca anche lì, la TV
     * mostra il segnaposto con l'iniziale.
     */
    private String resolveCelebrityImage(String celebrity) {
        LocalMediaBankService.Person localPhoto = localMedia.person(celebrity).orElse(null);
        if (localPhoto != null) {
            return localMedia.url(localPhoto.file());
        }
        // Con la banca volti installata non si esce in rete: chi non ha la
        // foto locale resta con il segnaposto dell'iniziale.
        if (localMedia.hasPeople()) {
            return null;
        }

        String imageUrl = tmdbImageService.getCelebrityImageUrl(celebrity);
        if (imageUrl != null && !imageUrl.isBlank()) {
            return imageUrl;
        }

        // Senza chiave TMDB la foto restava vuota. Wikipedia non richiede
        // chiavi e copre tutte le celebrità della banca.
        return celebrityImageService.getReliableImageUrl(celebrity);
    }

    /**
     * Indizi: dalla banca locale quando c'è, altrimenti da Wikipedia. Con la
     * banca installata non si esce comunque in rete.
     */
    private List<String> cluesFor(String celebrity) {
        LocalMediaBankService.Person local = localMedia.person(celebrity).orElse(null);
        if (local != null) {
            return celebrityImageService.cluesFromLocal(
                    celebrity, local.description(), local.extract());
        }
        return localMedia.hasPeople() ? List.of() : celebrityImageService.getClues(celebrity);
    }

    /**
     * Ultima spiaggia: una sola manche per occorrenza. La categoria viene
     * estratta per questa occorrenza e resta fissa; ogni squadra sceglie un
     * livello mai consumato nelle occorrenze precedenti della stessa partita.
     * Il payload contiene le cinque domande, una per livello.
     */
    private String ultimaSpiaggiaPayload(String category, Predicate<String> isAvailable) {
        List<String> categories = ultimaSpiaggiaCategories();
        if (categories.isEmpty()) {
            return emergencyPayload("ULTIMA_SPIAGGIA", category);
        }

        Collections.shuffle(categories, random);
        if (category != null && !category.isBlank()) {
            for (int index = 0; index < categories.size(); index++) {
                if (categories.get(index).equalsIgnoreCase(category)) {
                    categories.add(0, categories.remove(index));
                    break;
                }
            }
        }

        // Si usa la prima categoria che abbia cinque domande nuove: le
        // occorrenze successive avranno una nuova estrazione e nuovi livelli
        // residui per ogni squadra.
        for (String candidate : categories) {
            JSONObject round = ultimaSpiaggiaRound(1, candidate, isAvailable, new HashSet<>());
            if (round == null) {
                continue;
            }

            JSONObject payload = new JSONObject();
            payload.put("type", "ULTIMA_SPIAGGIA");
            payload.put("category", round.optString("category", ""));
            payload.put("question", "Ultima spiaggia");
            payload.put("questions", round.getJSONArray("questions"));
            // Un solo round: il campo resta per la compatibilità e per la
            // chiave di deduplica dell'intero pacchetto di cinque domande.
            payload.put("rounds", new JSONArray().put(round));
            payload.put("explain", "Una categoria per occorrenza. Ogni squadra sceglie un livello "
                    + "da 100 a 500 mai usato nelle occorrenze precedenti; giusta paga il livello, "
                    + "sbagliata o scaduta costa metà.");
            return payload.toString();
        }

        throw new IllegalStateException("Banca insufficiente per Ultima spiaggia: "
                + "serve una categoria con cinque domande nuove per i cinque livelli.");
    }

    private JSONObject ultimaSpiaggiaRound(int roundNumber, String category,
            Predicate<String> isAvailable, Set<String> used) {
        JSONArray questions = new JSONArray();
        Set<String> roundUsed = new HashSet<>(used);

        for (int index = 0; index < ULTIMA_SPIAGGIA_LEVELS.length; index++) {
            BankQuestion picked = pickUltimaSpiaggiaQuestion(
                    category, ULTIMA_SPIAGGIA_BANDS[index], isAvailable, roundUsed);
            if (picked == null) {
                return null;
            }
            roundUsed.add(QuestionHistoryService.key(
                    picked.question(), picked.correctAnswer(), picked.category()));
            // Stesso testo, risposta scritta in modo diverso: per il giocatore
            // resta la stessa domanda, quindi non deve occupare un altro livello.
            roundUsed.add(questionTextKey(picked));

            List<String> options = new ArrayList<>(picked.options());
            Collections.shuffle(options, random);
            questions.put(new JSONObject()
                    .put("level", ULTIMA_SPIAGGIA_LEVELS[index])
                    .put("question", picked.question())
                    .put("category", picked.category())
                    .put("options", new JSONArray(options))
                    .put("correctAnswer", picked.correctAnswer()));
        }

        used.addAll(roundUsed);
        return new JSONObject()
                .put("round", roundNumber)
                .put("category", category)
                .put("questions", questions);
    }

    private List<String> ultimaSpiaggiaCategories() {
        List<String> categories = new ArrayList<>();
        for (BankQuestion question : allQuestions()) {
            if ("QUIZ".equals(question.type()) && question.options().size() == 4
                    && !question.category().isBlank()
                    && !categories.contains(question.category())) {
                categories.add(question.category());
            }
        }
        return categories;
    }

    private List<BankQuestion> ultimaSpiaggiaPool(String category) {
        List<BankQuestion> pool = new ArrayList<>();
        for (BankQuestion question : allQuestions()) {
            if (!"QUIZ".equals(question.type()) || question.options().size() != 4) {
                continue;
            }
            if (!question.category().equalsIgnoreCase(category)) {
                continue;
            }
            pool.add(question);
        }
        return pool;
    }

    /** Una domanda nuova per il livello, nella categoria del round. */
    private BankQuestion pickUltimaSpiaggiaQuestion(String category, String band,
            Predicate<String> isAvailable, Set<String> used) {
        List<BankQuestion> pool = ultimaSpiaggiaPool(category);

        List<BankQuestion> sameBand = new ArrayList<>();
        for (BankQuestion question : pool) {
            if (question.difficulty().equalsIgnoreCase(band)) {
                sameBand.add(question);
            }
        }
        Collections.shuffle(sameBand, random);
        for (BankQuestion question : sameBand) {
            if (isFresh(question, isAvailable, used)) {
                return question;
            }
        }

        Collections.shuffle(pool, random);
        for (BankQuestion question : pool) {
            if (isFresh(question, isAvailable, used)) {
                return question;
            }
        }
        return null;
    }

    private boolean isFresh(BankQuestion question, Predicate<String> isAvailable, Set<String> used) {
        String key = QuestionHistoryService.key(
                question.question(), question.correctAnswer(), question.category());
        return !used.contains(key) && !used.contains(questionTextKey(question)) && isAvailable.test(key);
    }

    /** Deduplica per testo: la stessa domanda non cambia se cambia la risposta. */
    private String questionTextKey(BankQuestion question) {
        return "text|" + QuestionHistoryService.normalize(question.question());
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
        if (localMedia.hasTracks()) {
            List<LocalMediaBankService.Track> localTracks = localMedia.tracks();
            LocalMediaBankService.Track localTrack = localTracks.get(random.nextInt(localTracks.size()));
            String cover = localMedia.url(localTrack.albumCover());

            JSONObject payload = new JSONObject();
            payload.put("type", "MUSIC");
            payload.put("songTitle", localTrack.title());
            payload.put("artist", localTrack.artist());
            payload.put("previewUrl", localMedia.url(localTrack.file()));
            payload.put("albumCover", cover == null ? JSONObject.NULL : cover);
            payload.put("year", localTrack.year());
            payload.put("source", "banca-media");
            payload.put("audioReady", true);
            payload.put("payload", JSONObject.NULL);
            return payload.toString();
        }

        MusicTrackDto track = appleMusicCuratorService.getFamousSong();
        if (track.previewUrl == null || track.previewUrl.isBlank()) {
            // Doppia estrazione: la prima può arrivare da una risposta iTunes
            // incompleta. La riserva del servizio ha sempre una preview reale.
            track = appleMusicCuratorService.getFamousSong();
        }

        JSONObject payload = new JSONObject();
        payload.put("type", "MUSIC");
        payload.put("songTitle", track.title);
        payload.put("artist", track.artist);
        payload.put("previewUrl", track.previewUrl);
        payload.put("albumCover", track.albumCover);
        payload.put("year", track.year);
        payload.put("source", track.source);
        payload.put("audioReady", track.previewUrl != null && !track.previewUrl.isBlank());
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

    /**
     * Banca di Azzardo: trenta domande per categoria e livello, generate da
     * scripts/generate-questions/build_azzardo_bank.py. Se il file manca o è
     * illeggibile resta la tenuta minima, così il round parte comunque.
     */
    private List<AzzardoQuestion> loadAzzardo() {
        ClassPathResource resource = new ClassPathResource("questions/azzardo-it.json");
        if (!resource.exists()) {
            System.out.println("⚠️ Banca Azzardo assente: uso la tenuta minima.");
            return AZZARDO_EMERGENCY;
        }
        try (InputStream stream = resource.getInputStream()) {
            JSONArray items = new JSONArray(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
            List<AzzardoQuestion> loaded = new ArrayList<>();
            for (int index = 0; index < items.length(); index++) {
                JSONObject item = items.optJSONObject(index);
                if (item == null) {
                    continue;
                }
                String question = item.optString("question", "");
                if (question.isBlank()) {
                    continue;
                }
                loaded.add(new AzzardoQuestion(
                        item.optInt("level", 2),
                        item.optString("category", ""),
                        question,
                        item.optString("unit", ""),
                        item.optDouble("value", 0),
                        item.optDouble("step", 1)));
            }
            System.out.println("Banca Azzardo caricata: " + loaded.size() + " domande.");
            return List.copyOf(loaded);
        } catch (Exception error) {
            System.out.println("⚠️ Banca Azzardo illeggibile (" + error.getMessage() + "): uso la tenuta minima.");
            return AZZARDO_EMERGENCY;
        }
    }

}
