package com.pub_game_be.service;

import com.pub_game_be.dto.MusicTrackDto;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Predicate;

@Service
public class QuestionGeneratorService {

    private final String GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

    @Value("${groq.api.key:}")
    private String apiKey;

    @Value("${groq.api.model:openai/gpt-oss-120b}")
    private String model;

    @Value("${groq.api.temperature:0.7}")
    private double defaultTemperature;

    @Value("${groq.api.image-blur-temperature:1.3}")
    private double imageBlurTemperature;

    private final RestTemplate restTemplate;
    private final TMDBImageService tmdbImageService;
    private final AppleMusicCuratorService appleMusicCuratorService;
    private final CelebrityImageService celebrityImageService;
    private final com.pub_game_be.repository.CategoryRepository categoryRepository;

    private final Set<String> recentCelebrities = ConcurrentHashMap.newKeySet();
    private final int MAX_RECENT = 20;

    public QuestionGeneratorService(RestTemplate restTemplate,
            TMDBImageService tmdbImageService,
            AppleMusicCuratorService appleMusicCuratorService,
            CelebrityImageService celebrityImageService,
            com.pub_game_be.repository.CategoryRepository categoryRepository) {
        this.restTemplate = restTemplate;
        this.tmdbImageService = tmdbImageService;
        this.appleMusicCuratorService = appleMusicCuratorService;
        this.celebrityImageService = celebrityImageService;
        this.categoryRepository = categoryRepository;
    }

    public String generateQuestionJson(String category, String type, String difficulty) {

        if ("ROULETTE".equalsIgnoreCase(type)) {
            String[] colors = { "ROSSO", "NERO", "VERDE", "BLU", "GIALLO", "BIANCO" };
            String winningColor = colors[new Random().nextInt(colors.length)];

            JSONObject response = new JSONObject();
            response.put("type", "ROULETTE");
            response.put("question", "Scegli un colore!");
            response.put("correctAnswer", winningColor);
            response.put("options", new JSONArray(colors));
            response.put("payload", JSONObject.NULL);

            return response.toString();
        }

        if ("WHEEL_OF_FORTUNE".equalsIgnoreCase(type)
                || "WHEEL_FORTUNE".equalsIgnoreCase(type)
                || "PROVERB".equalsIgnoreCase(type)) {
            String proverb = pickRandomProverb();
            return proverb;
        }

        if ("MUSIC".equalsIgnoreCase(type)) {
            return generateMusicQuestion();
        }

        String difficultyContext = switch (difficulty.toLowerCase()) {
            case "facile" -> "Usa personaggi/domande molto popolari, quasi ovvi.";
            case "medio" -> "Usa personaggi/domande di buona fama, ma non iconici.";
            case "difficile" -> "Sii specifico. Usa personaggi/dettagli meno noti.";
            default -> "Difficoltà bilanciata.";
        };

        String prompt = "Genera una domanda per la categoria " + category + " di tipo " + type;
        if ("SCREAM_RACE".equalsIgnoreCase(type)) {
            return """
                    {
                        "type": "SCREAM_RACE",
                        "duration": 30,
                        "instructions": "Urla nel microfono per far avanzare la tua squadra!"
                    }
                    """;
        }

        if ("IMAGE_BLUR".equalsIgnoreCase(type)) {
            String recentList = recentCelebrities.isEmpty()
                    ? "nessuno"
                    : String.join(", ", recentCelebrities);

            prompt = String.format(
                    "Sei il presentatore di un quiz televisivo.\n" +
                            "CATEGORIA: %s\n" +
                            "LIVELLO: %s (%s)\n\n" +
                            "⚠️ REGOLE CRITICHE - SOLO CELEBRITÀ ULTRA-FAMOSE:\n" +
                            "1. USA SOLO personaggi ICONICI conosciuti da TUTTI\n" +
                            "2. NON usare personaggi di nicchia, emergenti o poco noti\n" +
                            "3. PREFERENZA ASSOLUTA per:\n" +
                            "   - Cinema: attori/attrici con Oscar, Golden Globe, film blockbuster\n" +
                            "   - Musica: artisti multi-platino, premi Grammy/MTV\n" +
                            "   - Sport: campioni mondiali/olimpici, leggende dello sport\n" +
                            "   - TV: conduttori storici prime-time\n\n" +
                            "4. NON USARE QUESTI (già usciti): %s\n\n" +
                            "ESEMPI ITALIANI ACCETTABILI:\n" +
                            "- Cinema: Sophia Loren, Roberto Benigni, Monica Bellucci, Pierfrancesco Favino\n" +
                            "- Musica: Laura Pausini, Eros Ramazzotti, Vasco Rossi, Ligabue, Zucchero\n" +
                            "- Sport: Francesco Totti, Alessandro Del Piero, Valentino Rossi\n" +
                            "- TV: Gerry Scotti, Maria De Filippi, Paolo Bonolis\n\n" +
                            "ESEMPI INTERNAZIONALI ACCETTABILI:\n" +
                            "- Cinema: Tom Cruise, Brad Pitt, Leonardo DiCaprio, Meryl Streep, Angelina Jolie\n" +
                            "- Musica: Michael Jackson, Madonna, Beyoncé, Ed Sheeran, Taylor Swift\n" +
                            "- Sport: Cristiano Ronaldo, Lionel Messi, LeBron James, Roger Federer\n\n" +
                            "⚠️ ESEMPI DA EVITARE (troppo di nicchia):\n" +
                            "- Attori di serie TV minori o film indie\n" +
                            "- Cantanti emergenti o con 1-2 hit\n" +
                            "- Personaggi social/influencer\n" +
                            "- Sportivi senza titoli mondiali/olimpici\n\n" +
                            "Rispondi SOLO con JSON:\n" +
                            "{\n" +
                            "  \"question\": \"Chi è questa persona?\",\n" +
                            "  \"correctAnswer\": \"Nome Completo Esatto\",\n" +
                            "  \"type\": \"IMAGE_BLUR\",\n" +
                            "  \"options\": null\n" +
                            "}",
                    category, difficulty, difficultyContext, recentList);
        }
        if ("TRUE_FALSE".equalsIgnoreCase(type)) {
            boolean shouldBeTrue = new Random().nextBoolean();
            prompt = String.format(
                    "Sei il presentatore di un quiz televisivo.\n" +
                            "CATEGORIA: %s\n" +
                            "LIVELLO: %s (%s)\n\n" +
                            "⚠️ OBBLIGO ASSOLUTO: La domanda DEVE riguardare ESCLUSIVAMENTE la categoria \"%s\". NON generare domande su argomenti estranei a questa categoria.\n\n" +
                            "Genera UNA domanda VERO/FALSO.\n\n" +
                            "⚠️ REGOLA CRITICA:\n" +
                            "La risposta corretta DEVE essere: %s\n\n" +
                            "REGOLE:\n" +
                            "1. La domanda DEVE essere strettamente correlata alla categoria \"%s\"\n" +
                            "2. La risposta deve essere OGGETTIVA e VERIFICABILE\n" +
                            "3. 'options' = [\"VERO\", \"FALSO\"]\n" +
                            "4. 'correctAnswer' = \"%s\"\n" +
                            "5. NON inventare fatti\n" +
                            "6. Se la risposta è \"FALSO\", DEVI aggiungere 'explanation'\n\n" +
                            "Rispondi SOLO con JSON valido (NO markdown).",
                    category,
                    difficulty,
                    difficultyContext,
                    category,
                    shouldBeTrue ? "VERO" : "FALSO",
                    category,
                    shouldBeTrue ? "VERO" : "FALSO");
        } else if ("QUIZ".equalsIgnoreCase(type)) {
            prompt = String.format(
                    "Sei il presentatore di un quiz televisivo.\n" +
                            "CATEGORIA: %s\n" +
                            "LIVELLO: %s (%s)\n\n" +
                            "⚠️ OBBLIGO ASSOLUTO: La domanda DEVE riguardare ESCLUSIVAMENTE la categoria \"%s\". NON generare domande su argomenti estranei a questa categoria.\n\n" +
                            "Genera UNA domanda di cultura generale.\n\n" +
                            "REGOLE RIGIDE:\n" +
                            "1. La domanda DEVE essere strettamente correlata alla categoria \"%s\"\n" +
                            "2. La domanda deve avere 4 opzioni di risposta\n" +
                            "3. UNA SOLA risposta deve essere corretta\n" +
                            "4. Le altre 3 devono essere PLAUSIBILI ma SBAGLIATE\n" +
                            "5. La 'correctAnswer' DEVE essere IDENTICA a una delle 4 opzioni\n" +
                            "6. NON inventare fatti o date inesistenti\n\n" +
                            "Rispondi SOLO con JSON valido (NO markdown, NO testo extra).\n" +
                            "IMPORTANTE: Verifica che 'correctAnswer' sia ESATTAMENTE uguale a una delle options!",
                    category, difficulty, difficultyContext, category, category);
        } else if ("CHRONO".equalsIgnoreCase(type)) {
            prompt = String.format(
                    "Sei il presentatore di un quiz televisivo.\n" +
                            "CATEGORIA: %s\n" +
                            "LIVELLO: %s (%s)\n\n" +
                            "⚠️ OBBLIGO ASSOLUTO: La domanda DEVE riguardare ESCLUSIVAMENTE la categoria \"%s\". NON generare domande su argomenti estranei a questa categoria.\n\n" +
                            "Genera UNA domanda su un ANNO storico.\n\n" +
                            "REGOLE:\n" +
                            "1. La domanda deve chiedere l'anno di un evento storico RELATIVO ALLA CATEGORIA \"%s\"\n" +
                            "2. L'anno deve essere verificabile\n" +
                            "3. 'correctAnswer' deve essere un anno (es: \"1989\")\n" +
                            "4. 'options' deve essere null\n\n" +
                            "Rispondi SOLO con JSON valido (NO markdown).",
                    category, difficulty, difficultyContext, category, category);
        }
        if ("ARENA".equalsIgnoreCase(type)) {
            // Le domande dell'arena si generano una per dispositivo tramite
            // /games/{id}/arena-question: qui non serve nessuna chiamata AI
            // (prima ne partiva una con 40 domande, subito scartate).
            JSONObject wrapper = new JSONObject();
            wrapper.put("type", "ARENA");
            wrapper.put("questions", new JSONArray());
            return wrapper.toString();
        }

        /*} else if ("ONE_VS_ONE".equalsIgnoreCase(type) || "1VS1".equalsIgnoreCase(type)) {
            prompt = String.format(
                    "Sei il presentatore di un quiz televisivo.\n" +
                            "CATEGORIA: %s\n" +
                            "LIVELLO: %s (%s)\n\n" +
                            "Genera UNA domanda QUIZ per una sfida 1 contro 1.\n\n" +
                            "REGOLE:\n" +
                            "1. La domanda deve avere 4 opzioni\n" +
                            "2. UNA SOLA risposta corretta\n" +
                            "3. Domanda di MEDIA difficoltà (non troppo facile, non impossibile)\n" +
                            "4. La 'correctAnswer' DEVE essere in 'options'\n\n" +
                            "Rispondi SOLO con JSON valido:\n" +
                            "{\n" +
                            "  \"question\": \"...\",\n" +
                            "  \"options\": [\"A\", \"B\", \"C\", \"D\"],\n" +
                            "  \"correctAnswer\": \"...\",\n" +
                            "  \"type\": \"ONE_VS_ONE\"\n" +
                            "}",
                    category, difficulty, difficultyContext);
        }*/

        String systemMsg = "Sei un generatore di domande quiz. GENERA SOLO DOMANDE SULLA CATEGORIA INDICATA NEL MESSAGGIO UTENTE. Se la categoria è 'Natura' parla di animali/piante/ecosistemi. Se 'Sport' parla di sport. Se 'Scienza' parla di fisica/chimica/biologia. Se 'Storia' parla di eventi storici. Se 'Cinema' parla di film/attori. Se 'Geografia' parla di paesi/capitali. Se 'Curiosita' parla di fatti insoluti. Se 'Arte' parla di pittura/scultura. Se 'Fumetti' parla di fumetti/manga. Se 'Letteratura' parla di scrittori/libri. Se 'Matematica' parla di numeri/formule. NON GENERARE MAI DOMANDE SUL TOPIC SBAGLIATO. Scrivi domanda, opzioni e risposte SEMPRE in italiano.";

        if (apiKey == null || apiKey.isBlank()) { System.out.println("GROQ_API_KEY assente: uso il fallback locale per " + type); return getFallbackJson(type, category); }
        int maxAttempts = 3;
        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            if (attempt > 0) {
                try { Thread.sleep(1000); } catch (InterruptedException ignored) {}
            }

            Map<String, Object> request = new HashMap<>();
            request.put("model", model);
            request.put("messages", List.of(
                    Map.of("role", "system", "content", systemMsg),
                    Map.of("role", "user", "content",
                            "IMPORTANTE: La categoria è " + category + ". La domanda DEVE riguardare ESCLUSIVAMENTE la categoria '" + category + "'.\n\n" + prompt)));
            request.put("temperature", "IMAGE_BLUR".equalsIgnoreCase(type) ? imageBlurTemperature : 0.5);
            // gpt-oss-120b: forza un oggetto JSON valido, niente testo attorno.
            request.put("response_format", Map.of("type", "json_object"));

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(apiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            try {
                ResponseEntity<String> response = restTemplate.postForEntity(GROQ_API_URL, entity, String.class);
                String rawContent = parseJsonResponse(response.getBody());
                String cleanedJson = cleanAiJson(rawContent);
                JSONObject jsonObj = new JSONObject(cleanedJson);

                if (jsonObj.has("question") && jsonObj.has("correctAnswer")) {
                    if ("QUIZ".equalsIgnoreCase(type) || "TRUE_FALSE".equalsIgnoreCase(type) || "IMAGE_BLUR".equalsIgnoreCase(type)) {
                        if (validateQuizJson(jsonObj, type)) {
                            if ("IMAGE_BLUR".equalsIgnoreCase(type) && jsonObj.has("correctAnswer")) {
                                String imageUrl = resolveCelebrityImage(jsonObj.getString("correctAnswer"));
                                if (imageUrl != null && !imageUrl.isEmpty()) {
                                    jsonObj.put("imageUrl", imageUrl);
                                    addToRecentCelebrities(jsonObj.getString("correctAnswer"));
                                }
                            }
                            return jsonObj.toString();
                        }
                    } else {
                        return cleanedJson;
                    }
                }

                System.out.println("Tentativo " + (attempt + 1) + ": JSON non valido o non rispetta le regole, riprovo...");
            } catch (Exception e) {
                if (e instanceof org.springframework.web.client.HttpClientErrorException.TooManyRequests || String.valueOf(e.getMessage()).contains("429")) { System.out.println("⚠️ Rate limit Groq (429): uso il fallback locale."); break; } System.out.println("Tentativo " + (attempt + 1) + ": errore Groq - " + e.getMessage());
            }
        }

        return getFallbackJson(type, category);
    }

    private boolean validateQuizJson(JSONObject jsonObj, String type) {
        try {
            if ("IMAGE_BLUR".equalsIgnoreCase(type)) { return jsonObj.has("correctAnswer") && !jsonObj.getString("correctAnswer").isBlank(); } if (!jsonObj.has("correctAnswer") || !jsonObj.has("options")) {
                return false;
            }

            String correctAnswer = jsonObj.getString("correctAnswer");
            JSONArray options = jsonObj.getJSONArray("options");

            if ("TRUE_FALSE".equalsIgnoreCase(type)) {
                if (options.length() != 2) {
                    return false;
                }

                boolean hasVero = false;
                boolean hasFalso = false;
                for (int i = 0; i < options.length(); i++) {
                    String opt = options.getString(i);
                    if ("VERO".equals(opt))
                        hasVero = true;
                    if ("FALSO".equals(opt))
                        hasFalso = true;
                }

                if (!hasVero || !hasFalso) {
                    return false;
                }

                if (!"VERO".equals(correctAnswer) && !"FALSO".equals(correctAnswer)) {
                    return false;
                }

                return true;
            }

            boolean found = false;
            for (int i = 0; i < options.length(); i++) {
                if (options.getString(i).equals(correctAnswer)) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                return false;
            }

            return true;

        } catch (Exception e) {
            return false;
        }
    }

    private boolean isQuestionRelatedToCategory(JSONObject jsonObj, String category) {
        try {
            String question = jsonObj.optString("question", "").toLowerCase();
            String answer = jsonObj.optString("correctAnswer", "").toLowerCase();
            String cat = category.toLowerCase();
            String combined = question + " " + answer;

            Map<String, String[]> categoryKeywords = Map.ofEntries(
                Map.entry("storia", new String[]{"storia", "storico", "storica", "guerra", "impero", "medioevo", "antico", "antica", "rivoluzione", "battaglia", "dynasty", "dynastia", "era", "secolo", "anno", "dopo cristo", "avanti cristo", "guerra mondiale", "romano", "romana", "greco", "greca", "egizio", "egizia", "napoleone", "cesare", "giulio", "cleopatra", "socrate", "platone", "aristotele", "machiavelli", "garibaldi", "mazzini", "vittorio emanuele", "risorgimento", "riforma", "illuminismo", "renaissance", "rinascimento", "feudalismo", "colonialismo", "democrazia", "repubblica", "monarchia", "costituzione", "trattato", "pace", "congresso", "consiglio", "presidente", "sovrano", "re", "regina", "imperatore", "papa", "chiesa", "tribù", "civiltà", "cultura antica", "preistoria", "protoistoria"}),
                Map.entry("scienza", new String[]{"scienza", "scientifico", "scientifico", "fisica", "chimica", "biologia", "astronomia", "medicina", "ecologia", "genetica", "atomo", "molecola", "cellula", "dna", "rna", "energia", "gravità", "forza", "massa", "velocità", "temperatura", "calore", "luce", "suono", "elettricità", "magnetismo", "pianeta", "stella", "galassia", "universo", "sistema solare", "sole", "luna", "terra", "marte", "venere", "giupiter", "saturno", "neptune", "mercurio", "organismo", "specie", "evoluzione", "batterio", "virus", "proteina", "enzima", "fotosintesi", "mitosi", "meiosi", "ereditarietà", "patrimonio genetico", "sperimento", "ipotesi", "teoria", "legge scientifica", "scoperta", "invenzione", "telescopio", "microscopio", "laboratorio"}),
                Map.entry("sport", new String[]{"sport", "calcio", "basket", "tennis", "nuoto", "atletica", "ciclismo", "formula 1", "f1", "olimpiade", "olimpico", "olimpica", "mondiale", "champions", "coppe", "campionato", "gol", "punto", "partita", "squadra", "giocatore", "allenatore", "coach", "medaglia", "podio", "traguardo", "finale", "semifinale", "quarti", "casa", "girone", "fase a", "retrocessione", "promozione", "transfer", "mercato", "contratto", "penalty", "rigore", "fallo", "cartellino", "arbitro", "stadio", "arena", "palestra", "campo", "tiro", "passaggio", "difesa", "attacco", "formazione", "modulo", "marcatura", "counter", "pressing", "cross", "corner", "autogoal", "og", "handicap", "record", "prestazione", "performance", "federazione", "serie a", "premier league", "la liga", "bundesliga", "nba", "nfl", "mlb", "nhl"}),
                Map.entry("cinema", new String[]{"cinema", "film", "regista", "regista", "attore", "attrice", "oscar", "golden globe", "cannes", "venezia", "berlino", "screenplay", "sceneggiatura", "trama", "genere", "horror", "commedia", "drammatico", "thriller", "azione", "avventura", "fantascienza", "fantasy", "animazione", "documentario", "biopic", "blockbuster", "sequel", "prequel", "remake", "spin-off", "franchise", "studio", "paramount", "warner", "disney", "pixar", "marvel", "dc", "netflix", "amazon", "streaming", "box office", "incassi", "biglietto", "proiezione", "sala", "cinematografo", "cortometraggio", "lungometraggio"}),
                Map.entry("geografia", new String[]{"geografia", "paese", "stato", "nazione", "continente", "capital", "capitale", "fiume", "montagna", "lago", "oceano", "mare", "deserto", "isola", "penisola", "golfo", "baia", "canale", "stretto", "catena montuosa", "pianura", "altopiano", "vulcano", "terremoto", "tsunami", "clima", "temperatura", "latitudine", "longitudine", "emisfero", "tropico", "equatore", "polo", "città", "villaggio", "regione", "provincia", "distretto", "confine", "frontiera", "piazza", "via", "borgo", "comune"}),
                Map.entry("curiosita", new String[]{"curiosità", "curiosità", "sapete", "sapere", "sapevate", "lo sapevi", "bizzarro", "insolito", "strano", "incredibile", "fantastico", "fenomeno", "eccezionale", "record", "primato", "migliore", "peggiore", "più grande", "più piccolo", "più longevo", "più veloce", "straniero", "particolare", "singolare", "originale", "unico", "rarità", "anomalia", "paradoss", "contraddizione", "ironia", "aneddoto", "curiosità", "dati", "numeri", "statistiche"}),
                Map.entry("arte", new String[]{"arte", "artistico", "artistica", "pittura", "scultura", "pittore", "scultore", "museo", "galleria", "mostra", "esposizione", "dipinto", "opera", "affresco", "mosaico", "ritratto", "paesaggio", "natura morta", "astratto", "figurativo", "impressionismo", "espressionismo", "cubismo", "surrealismo", "pop art", "arte contemporanea", "rinascimento", "barocco", "rococò", "neoclassicismo", "romanticismo", "realismo", "simbolismo", "futurismo", "dadaismo", "chiesa", "cattedrale", "basilica", "tempio", "palazzo", "architettura", "design", "decorazione", "ornamento"}),
                Map.entry("natura", new String[]{"natura", "animale", "animale", "pianta", "albero", "fiore", "foresta", "bosco", "selva", "giardino", "parco", "riserva", "habitat", "ecosistema", "biodiversità", "catena alimentare", "predatore", "preda", "sopravvivenza", "adattamento", "evoluzione", "specie", "genere", "famiglia", "ordine", "classe", "phylum", "regno", "batterio", "fungo", "insetto", "mammifero", "rettilile", "anfibio", "pesci", "uccello", "volatile", "marino", "terrestre", "aerale", "notturno", "diurno", "tropicale", "temperato", "polare", "desertico", "umido", "secco"}),
                Map.entry("fumetti", new String[]{"fumetto", "fumetti", "manga", "comic", "supereroe", "supereroi", "marvel", "dc", "batman", "superman", "spider-man", "spiderman", "wolverine", "x-men", "avengers", "justice league", "flash", "iron man", "captain america", "thor", "hulk", "deadpool", "aquaman", "wonder woman", "green lantern", "green arrow", "ant-man", "black panther", "daredevil", "punisher", "blade", "ghost rider", "one piece", "naruto", "dragon ball", "attack on titan", "demon slayer", "my hero academia", "death note", "bleach", "hunter x hunter", "jujutsu kaisen", "berserk", "sailor moon", "evangelion", "ghost in the shell"}),
                Map.entry("letteratura", new String[]{"letteratura", "scrittore", "scrittrice", "romanzo", "poesia", "poema", "racconto", "novella", "saggio", "biografia", "autobiografia", "libro", "pagina", "capitolo", "paragrafo", "genere letterario", "narrativa", "lirica", "drammatica", "gotico", "romantico", "realista", "naturalista", "modernista", "postmoderno", "dante", "petrarch", "boccaccio", "ariosto", "tasso", "manzoni", "verga", "pirandello", "moravia", "calvino", "shakespeare", "cervantes", "homer", "virgilio", "ovidio", "plutarco", "goethe", "tolstoj", "dostoevskij", "dickens", "austen", "hugo", "flaubert", "proust", "kafka", "borges", "hemingway", "fitzgerald", "steinbeck", "woolf", "plath"}),
                Map.entry("matematica", new String[]{"matematica", "matematico", "calcolo", "calcolare", "numero", "primo", "algebra", "geometria", "trigonometria", "statistica", "probabilità", "formula", "equazione", "funzione", "variabile", "incognita", "teorema", "dimostrazione", "assioma", "pi greco", "euler", "pythagoras", "pitagora", "fibonacci", "gauss", "newton", "einstein", "archimede", "euclide", "addizione", "sottrazione", "moltiplicazione", "divisione", "potenza", "radice", "esponente", "logaritmo", "integrale", "derivata", "limite", "matrice", "vettore", "angolo", "perimetro", "area", "volume", "circonferenza", "triangolo", "rettangolo", "quadrato", "cerchio", "diagonale", "simmetria", "proporzione", "razionale", "irrazionale", "intero", "naturale", "reale", "complesso"})
            );

            String[] keywords = categoryKeywords.get(cat);
            if (keywords == null) {
                return true;
            }

            for (String kw : keywords) {
                if (combined.contains(kw)) {
                    return true;
                }
            }

            System.out.println("Categoria '" + category + "' - nessuna keyword trovata nella domanda: " + question);
            return false;

        } catch (Exception e) {
            return true;
        }
    }

    private String requestSingleArenaQuestion(String category) {
        String prompt = "Sei il presentatore di un quiz televisivo.\n" +
                "Genera UNA singola domanda casuale per la modalità ARENA (Battle Royale).\n" +
                "⚠️ REGOLE RIGIDE:\n" +
                "1. La categoria della domanda DEVE essere la seguente: " + category + ".\n" +
                "2. Scegli casualmente il tipo: 70% probabilità 'QUIZ' (4 opzioni) o 30% probabilità 'TRUE_FALSE' (2 opzioni: VERO, FALSO).\n"
                +
                "3. Difficoltà: Facile o Media.\n" +
                "4. L'oggetto JSON deve avere ESATTAMENTE: \"question\" (testo), \"options\" (array di stringhe), \"correctAnswer\" (valore esatto), \"difficulty\", \"category\".\n"
                +
                "5. Per TRUE_FALSE, 'options' deve essere ESATTAMENTE [\"VERO\", \"FALSO\"].\n" +
                "6. Rispondi SOLO con un oggetto JSON valido, senza list, senza array attorno, nessun testo extra.\n\n"
                +
                "Esempio QUIZ:\n" +
                "{ \"question\": \"...\", \"options\": [\"A\",\"B\",\"C\",\"D\"], \"correctAnswer\": \"A\", \"difficulty\": \"easy\", \"category\": \"Storia\" }\n\n"
                +
                "Esempio TRUE_FALSE:\n" +
                "{ \"question\": \"...\", \"options\": [\"VERO\",\"FALSO\"], \"correctAnswer\": \"VERO\", \"difficulty\": \"medium\", \"category\": \"Scienza\" }";

        Map<String, Object> request = new HashMap<>();
        request.put("model", model);
        request.put("messages", List.of(Map.of("role", "user", "content", prompt)));
        request.put("temperature", defaultTemperature);
        request.put("response_format", Map.of("type", "json_object")); // Force JSON object

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(GROQ_API_URL, entity, String.class);
            String rawContent = parseJsonResponse(response.getBody());
            String cleanedJson = cleanAiJson(rawContent);

            JSONObject jsonObj = new JSONObject(cleanedJson);

            // Validate it
            if (!jsonObj.has("correctAnswer") || !jsonObj.has("options") || !jsonObj.has("question")) {
                System.err.println("❌ Formato JSON AI non valido: " + cleanedJson);
                return getSingleFallbackArenaQuestion();
            }

            return jsonObj.toString();

        } catch (Exception e) {
            System.err.println("❌ Eccezione durante la generazione AI Arena: " + e.getMessage());
            return getSingleFallbackArenaQuestion();
        }
    }

    /** Domanda arena pronta per un dispositivo, con le chiavi usate per la deduplica. */
    public record ArenaQuestion(String json, String question, String correctAnswer, String category,
            String key, String answerKey) {
    }

    /**
     * Genera una domanda arena solo se non è già uscita in questa partita.
     * Riprova fino a 3 volte: la generazione AI tende a insistere sullo stesso fatto.
     */
    public Optional<ArenaQuestion> generateArenaQuestion(String category, Predicate<ArenaQuestion> isAvailable) {
        for (int attempt = 0; attempt < 3; attempt++) {
            Optional<ArenaQuestion> candidate = toArenaQuestion(requestSingleArenaQuestion(category), category);
            if (candidate.isPresent() && isAvailable.test(candidate.get())) {
                return candidate;
            }
        }
        return Optional.empty();
    }

    /** Ripiego locale: pesca dal catalogo finché trova una domanda non ancora uscita. */
    public Optional<ArenaQuestion> fallbackArenaQuestion(String category, Predicate<ArenaQuestion> isAvailable) {
        String wanted = QuestionHistoryService.normalize(category);
        for (int attempt = 0; attempt < 24; attempt++) {
            Optional<ArenaQuestion> candidate = toArenaQuestion(getSingleFallbackArenaQuestion(), null);
            if (candidate.isPresent()
                    && wanted.equals(QuestionHistoryService.normalize(candidate.get().category()))
                    && isAvailable.test(candidate.get())) {
                return candidate;
            }
        }
        return Optional.empty();
    }

    /** Ripiego locale su tutto il catalogo. */
    public Optional<ArenaQuestion> fallbackArenaQuestion(Predicate<ArenaQuestion> isAvailable) {
        for (int attempt = 0; attempt < 24; attempt++) {
            Optional<ArenaQuestion> candidate = toArenaQuestion(getSingleFallbackArenaQuestion(), null);
            if (candidate.isPresent() && isAvailable.test(candidate.get())) {
                return candidate;
            }
        }
        return toArenaQuestion(getSingleFallbackArenaQuestion(), null);
    }

    /** Chiave di deduplica per un payload già generato (round non-arena). */
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

    private Optional<ArenaQuestion> toArenaQuestion(String raw, String requestedCategory) {
        try {
            JSONObject obj = new JSONObject(raw);
            String question = obj.optString("question", "");
            String correctAnswer = obj.optString("correctAnswer", "");
            if (question.isBlank() || correctAnswer.isBlank() || !obj.has("options")) {
                return Optional.empty();
            }
            String category = requestedCategory != null ? requestedCategory : obj.optString("category", "");
            return Optional.of(new ArenaQuestion(obj.toString(), question, correctAnswer, category,
                    QuestionHistoryService.key(question, correctAnswer, category),
                    QuestionHistoryService.answerKey(correctAnswer, category)));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /** TMDB per primo, poi il ripiego: una domanda senza immagine è ingiocabile. */
    private String resolveCelebrityImage(String celebrity) {
        String imageUrl = tmdbImageService.getCelebrityImageUrl(celebrity);
        if (imageUrl == null || imageUrl.isEmpty()) {
            imageUrl = celebrityImageService.getReliableImageUrl(celebrity);
        }
        return imageUrl;
    }

    private String getSingleFallbackArenaQuestion() {
        String[] safeFallbacks = {
                "{ \"question\": \"Quanto fa 5 + 5?\", \"options\": [\"8\", \"10\", \"12\", \"15\"], \"correctAnswer\": \"10\", \"difficulty\": \"easy\", \"category\": \"Matematica\" }",
                "{ \"question\": \"Qual è la capitale d'Italia?\", \"options\": [\"Milano\", \"Roma\", \"Napoli\", \"Torino\"], \"correctAnswer\": \"Roma\", \"difficulty\": \"easy\", \"category\": \"Geografia\" }",
                "{ \"question\": \"Qual è il fiume più lungo del mondo?\", \"options\": [\"Nilo\", \"Rio delle Amazzoni\", \"Gange\", \"Mississippi\"], \"correctAnswer\": \"Rio delle Amazzoni\", \"difficulty\": \"medium\", \"category\": \"Geografia\" }",
                "{ \"question\": \"Chi ha dipinto la Gioconda?\", \"options\": [\"Michelangelo\", \"Raffaello\", \"Munch\", \"Leonardo Da Vinci\"], \"correctAnswer\": \"Leonardo Da Vinci\", \"difficulty\": \"easy\", \"category\": \"Arte\" }",
                "{ \"question\": \"Qual è il pianeta più grande del sistema solare?\", \"options\": [\"Giove\", \"Saturno\", \"Terra\", \"Marte\"], \"correctAnswer\": \"Giove\", \"difficulty\": \"easy\", \"category\": \"Scienza\" }",
                "{ \"question\": \"La Terra è piatta?\", \"options\": [\"VERO\", \"FALSO\"], \"correctAnswer\": \"FALSO\", \"difficulty\": \"easy\", \"category\": \"Geografia\" }",
                "{ \"question\": \"L'acqua bolle a 100 gradi Celsius?\", \"options\": [\"VERO\", \"FALSO\"], \"correctAnswer\": \"VERO\", \"difficulty\": \"easy\", \"category\": \"Scienza\" }",
                "{ \"question\": \"Roma è la capitale della Francia?\", \"options\": [\"VERO\", \"FALSO\"], \"correctAnswer\": \"FALSO\", \"difficulty\": \"easy\", \"category\": \"Geografia\" }",
                "{ \"question\": \"Il sole è una stella?\", \"options\": [\"VERO\", \"FALSO\"], \"correctAnswer\": \"VERO\", \"difficulty\": \"easy\", \"category\": \"Scienza\" }",
                "{ \"question\": \"In che anno è iniziata la Prima Guerra Mondiale?\", \"options\": [\"1914\", \"1918\", \"1939\", \"1945\"], \"correctAnswer\": \"1914\", \"difficulty\": \"medium\", \"category\": \"Storia\" }",
                "{ \"question\": \"Chi ha scritto la Divina Commedia?\", \"options\": [\"Boccaccio\", \"Petrarca\", \"Dante Alighieri\", \"Machiavelli\"], \"correctAnswer\": \"Dante Alighieri\", \"difficulty\": \"easy\", \"category\": \"Letteratura\" }",
                "{ \"question\": \"Quale animale è conosciuto come il miglior amico dell'uomo?\", \"options\": [\"Gatto\", \"Cane\", \"Cavallo\", \"Delfino\"], \"correctAnswer\": \"Cane\", \"difficulty\": \"easy\", \"category\": \"Natura\" }",
                "{ \"question\": \"Il ragno è un insetto?\", \"options\": [\"VERO\", \"FALSO\"], \"correctAnswer\": \"FALSO\", \"difficulty\": \"medium\", \"category\": \"Natura\" }",
                "{ \"question\": \"Qual è lo sport più popolare al mondo?\", \"options\": [\"Basket\", \"Tennis\", \"Calcio\", \"Rugby\"], \"correctAnswer\": \"Calcio\", \"difficulty\": \"easy\", \"category\": \"Sport\" }",
                "{ \"question\": \"L'Uomo Ragno fa parte della DC Comics?\", \"options\": [\"VERO\", \"FALSO\"], \"correctAnswer\": \"FALSO\", \"difficulty\": \"medium\", \"category\": \"Fumetti\" }",
                "{ \"question\": \"Quanti giorni ci sono in un anno bisestile?\", \"options\": [\"364\", \"365\", \"366\", \"367\"], \"correctAnswer\": \"366\", \"difficulty\": \"easy\", \"category\": \"Curiosità\" }"
        };
        return safeFallbacks[new Random().nextInt(safeFallbacks.length)];
    }

    private void addToRecentCelebrities(String celebrity) {
        recentCelebrities.add(celebrity);

        if (recentCelebrities.size() > MAX_RECENT) {
            Iterator<String> iterator = recentCelebrities.iterator();
            if (iterator.hasNext()) {
                iterator.next();
                iterator.remove();
            }
        }
    }

    private String cleanAiJson(String content) {
        if (content == null)
            return "{}";

        if (content.contains("```json")) {
            content = content.substring(content.indexOf("```json") + 7);
            content = content.substring(0, content.lastIndexOf("```"));
        } else if (content.contains("```")) {
            content = content.substring(content.indexOf("```") + 3);
            content = content.substring(0, content.lastIndexOf("```"));
        }

        int firstBrace = content.indexOf("{");
        int lastBrace = content.lastIndexOf("}");

        if (firstBrace >= 0 && lastBrace >= 0) {
            return content.substring(firstBrace, lastBrace + 1).trim();
        }

        return content.trim();
    }

    private String parseJsonResponse(String responseBody) {
        JSONObject json = new JSONObject(responseBody);
        return json.getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message")
                .getString("content");
    }

    private String getFallbackJson(String type, String category) {
        if ("IMAGE_BLUR".equalsIgnoreCase(type)) {
            String[] celebrities = {"Leonardo DiCaprio", "Brad Pitt", "Tom Hanks", "Meryl Streep", "Robert De Niro"};
            String celeb = celebrities[new Random().nextInt(celebrities.length)];
            JSONObject obj = new JSONObject();
            obj.put("question", "Chi è questa persona?");
            obj.put("correctAnswer", celeb);
            obj.put("type", "IMAGE_BLUR");
            obj.put("options", JSONObject.NULL);
            try {
                String imageUrl = tmdbImageService.getCelebrityImageUrl(celeb);
                if (imageUrl != null) obj.put("imageUrl", imageUrl);
            } catch (Exception e) {}
            return obj.toString();
        }
        if ("SCREAM_RACE".equalsIgnoreCase(type)) {
            return "{\"type\":\"SCREAM_RACE\",\"duration\":30,\"instructions\":\"Urla nel microfono!\"}";
        }
        if ("WHEEL_OF_FORTUNE".equalsIgnoreCase(type) || "WHEEL_FORTUNE".equalsIgnoreCase(type) || "PROVERB".equalsIgnoreCase(type)) {
            return pickRandomProverb();
        }
        if ("ROULETTE".equalsIgnoreCase(type)) {
            String[] colors = {"ROSSO","NERO","VERDE","BLU","GIALLO","BIANCO"};
            JSONObject obj = new JSONObject();
            obj.put("question", "Scegli un colore!");
            obj.put("options", new JSONArray(colors));
            obj.put("correctAnswer", colors[new Random().nextInt(colors.length)]);
            obj.put("type", "ROULETTE");
            return obj.toString();
        }
        if ("TRUE_FALSE".equalsIgnoreCase(type)) {
            JSONObject obj = new JSONObject();
            obj.put("question", "La categoria per questa domanda è " + category + ". Riprova il prossimo round!");
            obj.put("options", new JSONArray(new String[]{"VERO", "FALSO"}));
            obj.put("correctAnswer", "VERO");
            obj.put("type", "TRUE_FALSE");
            return obj.toString();
        }
        if ("QUIZ".equalsIgnoreCase(type)) {
            JSONObject obj = new JSONObject();
            obj.put("question", "La categoria per questa domanda è " + category + ". Riprova il prossimo round!");
            obj.put("options", new JSONArray(new String[]{"A", "B", "C", "D"}));
            obj.put("correctAnswer", "A");
            obj.put("type", "QUIZ");
            return obj.toString();
        }
        if ("CHRONO".equalsIgnoreCase(type)) {
            JSONObject obj = new JSONObject();
            obj.put("question", "In che anno si è svolto questo evento legato a " + category + "?");
            obj.put("options", JSONObject.NULL);
            obj.put("correctAnswer", "2000");
            obj.put("type", "CHRONO");
            return obj.toString();
        }
        JSONObject obj = new JSONObject();
        obj.put("question", "Errore generazione domanda per " + category);
        obj.put("options", new JSONArray());
        obj.put("correctAnswer", "N/A");
        obj.put("type", type);
        return obj.toString();
    }

    private String pickRandomProverb() {
        String[] provs = new String[] {
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
                "Non si può avere la botte piena e la moglie ubriaca",
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
                "Il diavolo fa le pentole ma non i coperchi",
                "Acqua passata non macina più",
                "Chi di speranza vive disperato muore",
                "Non tutto il male viene per nuocere",
                "Chi ha orecchie per intendere intenda",
                "A buon intenditor poche parole",
        };
        return provs[new Random().nextInt(provs.length)];
    }

    private String generateMusicQuestion() {
        MusicTrackDto track = appleMusicCuratorService.getFamousSong();

        JSONObject response = new JSONObject();
        response.put("type", "MUSIC");
        response.put("songTitle", track.title);
        response.put("artist", track.artist);
        response.put("previewUrl", track.previewUrl);
        response.put("albumCover", track.albumCover);
        response.put("year", track.year);
        response.put("source", track.source);
        response.put("payload", JSONObject.NULL);

        return response.toString();
    }
}