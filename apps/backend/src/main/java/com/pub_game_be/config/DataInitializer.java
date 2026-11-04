package com.pub_game_be.config;

import com.pub_game_be.domain.category.Category;
import com.pub_game_be.domain.enums.GameStatus;
import com.pub_game_be.domain.game.Game;
import com.pub_game_be.repository.CategoryRepository;
import com.pub_game_be.repository.GameRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DataInitializer implements CommandLineRunner {

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

        if (categoryRepository.count() == 0) {
            List<String> categoryNames = List.of(
                "Storia", "Scienza", "Sport", "Cinema", "Geografia",
                "Musica", "Arte", "Politica", "Motori", "Cibo e Gastronomia",
                "Televisione", "Lingue e Parole"
            );
            categoryNames.forEach(name -> {
                Category cat = new Category();
                cat.setName(name);
                cat.setActive(true);
                categoryRepository.save(cat);
            });
            System.out.println("Categorie iniziali create: " + categoryRepository.count());
        }
    }
}
