package com.pub_game_be.config;

import com.pub_game_be.domain.category.Category;
import com.pub_game_be.domain.enums.GameStatus;
import com.pub_game_be.domain.game.Game;
import com.pub_game_be.repository.CategoryRepository;
import com.pub_game_be.repository.GameRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class DataInitializer implements CommandLineRunner {

    private record CategorySeed(String name, String emoji, String description,
            boolean timeline, String color) {
    }

    /**
     * Struttura ufficiale: cultura classica e moderna, 16 categorie.
     * L'ordine della lista è anche l'ordine mostrato dalla TV.
     */
    private static final List<CategorySeed> OFFICIAL_CATEGORIES = List.of(
            new CategorySeed("Storia", "🏛️",
                    "Grandi eventi, civiltà del passato, personaggi storici",
                    true, "#b45309"),
            new CategorySeed("Geografia e Viaggi", "🗺️",
                    "Capitali, bandiere, monumenti, culture dal mondo",
                    true, "#0e7490"),
            new CategorySeed("Scienza e Spazio", "🔬",
                    "Astronomia, scoperte scientifiche, corpo umano, fisica e misteri del cosmo",
                    true, "#4338ca"),
            new CategorySeed("Natura e Animali", "🦁",
                    "Zoologia, botanica, ambiente, mari e oceani",
                    false, "#15803d"),
            new CategorySeed("Sport", "⚽",
                    "Olimpiadi, calcio, record, grandi atleti e discipline sportive",
                    true, "#dc2626"),
            new CategorySeed("Cinema, Serie TV", "🎬",
                    "Grandi cult, streaming, film d'animazione",
                    true, "#7c3aed"),
            new CategorySeed("TV e Spettacolo", "🎭",
                    "Show televisivi, teatro, festival, gossip e celebrità",
                    true, "#db2777"),
            new CategorySeed("Musica", "🎵",
                    "Cantanti, band, canzoni storiche, generi musicali e strumenti",
                    true, "#c026d3"),
            new CategorySeed("Arte e Architettura", "🎨",
                    "Pittura, scultura, musei, grandi monumenti e stili architettonici",
                    true, "#ea580c"),
            new CategorySeed("Politica e Attualità", "🌍",
                    "Cronaca, fatti recenti, economia pop e geopolitica",
                    true, "#475569"),
            new CategorySeed("Motori", "🏎️",
                    "Formula 1, MotoGP, auto storiche, supercar e case automobilistiche",
                    true, "#991b1b"),
            new CategorySeed("Cibo e Gastronomia", "🍳",
                    "Tradizioni culinarie, ingredienti, vini, chef e piatti dal mondo",
                    true, "#ca8a04"),
            new CategorySeed("Lingua e Letteratura", "📚",
                    "Grandi romanzi, autori, poesie, grammatica e curiosità linguistiche",
                    true, "#0369a1"),
            new CategorySeed("Anime e manga", "🌸",
                    "Anime, manga, Studio Ghibli, autori e personaggi cult",
                    true, "#e11d48"),
            new CategorySeed("Gaming e Tecnologia", "🎮",
                    "Videogiochi, console, internet, social media, smartphone e AI",
                    true, "#0891b2"),
            new CategorySeed("Curiosità", "💡",
                    "Record del mondo, stranezze, domande bizzarre e cultura generale",
                    false, "#d97706")
    );

    private final GameRepository gameRepository;
    private final CategoryRepository categoryRepository;

    public DataInitializer(GameRepository gameRepository, CategoryRepository categoryRepository) {
        this.gameRepository = gameRepository;
        this.categoryRepository = categoryRepository;
    }

    @Override
    public void run(String... args) {
        if (gameRepository.count() == 0) {
            Game game = new Game();
            game.setStatus(GameStatus.CREATED);
            gameRepository.save(game);
            System.out.println("Partita iniziale creata con ID: " + game.getId());
        }

        syncCategories();
    }

    /**
     * Non cancella le vecchie categorie: le disattiva, così eventuali riferimenti
     * storici restano validi ma la TV mostra soltanto la struttura ufficiale.
     */
    private void syncCategories() {
        Set<String> officialNames = OFFICIAL_CATEGORIES.stream()
                .map(seed -> seed.name().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());

        for (int index = 0; index < OFFICIAL_CATEGORIES.size(); index++) {
            CategorySeed seed = OFFICIAL_CATEGORIES.get(index);
            Category category = categoryRepository.findByNameIgnoreCase(seed.name())
                    .orElseGet(Category::new);

            category.setName(seed.name());
            category.setEmoji(seed.emoji());
            category.setDescription(seed.description());
            category.setTimeline(seed.timeline());
            category.setSortOrder(index + 1);
            category.setColor(seed.color());
            category.setActive(true);
            categoryRepository.save(category);
        }

        for (Category category : categoryRepository.findAll()) {
            if (!officialNames.contains(category.getName().toLowerCase(Locale.ROOT))
                    && category.isActive()) {
                category.setActive(false);
                categoryRepository.save(category);
            }
        }

        System.out.println("Categorie ufficiali attive: "
                + categoryRepository.findByActiveTrueOrderBySortOrderAscNameAsc().size());
    }
}
