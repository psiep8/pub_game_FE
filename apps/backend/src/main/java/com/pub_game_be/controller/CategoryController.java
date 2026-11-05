package com.pub_game_be.controller;

import com.pub_game_be.domain.category.Category;
import com.pub_game_be.repository.CategoryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Categorie ufficiali della serata.
 *
 * <p>La TV legge solo quelle attive ({@code GET /categories}); il pannello admin
 * usa gli endpoint sotto {@code /categories/admin} per accendere e spegnere una
 * categoria e per gestire il flag Timeline. Nessuna categoria viene cancellata:
 * disattivarla basta a toglierla dal gioco senza rompere i riferimenti storici.</p>
 */
@RestController
@RequestMapping("/categories")
public class CategoryController {

    /** Corpo di creazione/modifica: tutti i campi sono facoltativi tranne il nome. */
    public record CategoryRequest(String name, String emoji, String description,
            Boolean timeline, Integer sortOrder, String color, Boolean active) {
    }

    private final CategoryRepository categoryRepo;

    public CategoryController(CategoryRepository categoryRepo) {
        this.categoryRepo = categoryRepo;
    }

    @GetMapping
    public List<Category> getAll() {
        return categoryRepo.findByActiveTrueOrderBySortOrderAscNameAsc();
    }

    /** Tutte le categorie, comprese quelle spente: e la vista dell'admin. */
    @GetMapping("/admin")
    public List<Category> getAllForAdmin() {
        return categoryRepo.findAll().stream()
                .sorted((first, second) -> Integer.compare(first.getSortOrder(), second.getSortOrder()))
                .toList();
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CategoryRequest request) {
        String name = clean(request.name());
        if (name == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Il nome della categoria e obbligatorio"));
        }
        if (categoryRepo.findByNameIgnoreCase(name).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Esiste gia una categoria con questo nome"));
        }

        Category category = new Category();
        category.setName(name);
        category.setEmoji(request.emoji() == null || request.emoji().isBlank() ? "\uD83C\uDFAF" : request.emoji().trim());
        category.setDescription(request.description());
        category.setTimeline(Boolean.TRUE.equals(request.timeline()));
        category.setColor(request.color() == null || request.color().isBlank() ? "#475569" : request.color().trim());
        category.setSortOrder(request.sortOrder() == null ? nextSortOrder() : request.sortOrder());
        category.setActive(request.active() == null || request.active());
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryRepo.save(category));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable("id") Long id, @RequestBody CategoryRequest request) {
        Category category = categoryRepo.findById(id).orElse(null);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }

        String name = clean(request.name());
        if (name != null && !name.equalsIgnoreCase(category.getName())) {
            if (categoryRepo.findByNameIgnoreCase(name).isPresent()) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("error", "Esiste gia una categoria con questo nome"));
            }
            category.setName(name);
        }
        if (request.emoji() != null && !request.emoji().isBlank()) {
            category.setEmoji(request.emoji().trim());
        }
        if (request.description() != null) {
            category.setDescription(request.description());
        }
        if (request.timeline() != null) {
            category.setTimeline(request.timeline());
        }
        if (request.sortOrder() != null) {
            category.setSortOrder(request.sortOrder());
        }
        if (request.color() != null && !request.color().isBlank()) {
            category.setColor(request.color().trim());
        }
        if (request.active() != null) {
            category.setActive(request.active());
        }
        return ResponseEntity.ok(categoryRepo.save(category));
    }

    /** Interruttore rapido del flag Timeline dal pannello admin. */
    @PatchMapping("/{id}/timeline")
    public ResponseEntity<?> toggleTimeline(@PathVariable("id") Long id,
            @RequestBody(required = false) CategoryRequest request) {
        Category category = categoryRepo.findById(id).orElse(null);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }
        boolean next = request != null && request.timeline() != null
                ? request.timeline()
                : !category.isTimeline();
        category.setTimeline(next);
        return ResponseEntity.ok(categoryRepo.save(category));
    }

    /** Spegne la categoria: resta nello storico, sparisce dalla TV. */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deactivate(@PathVariable("id") Long id) {
        Category category = categoryRepo.findById(id).orElse(null);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }
        category.setActive(false);
        categoryRepo.save(category);
        return ResponseEntity.ok(Map.of("id", id, "active", false));
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<?> activate(@PathVariable("id") Long id) {
        Category category = categoryRepo.findById(id).orElse(null);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }
        category.setActive(true);
        categoryRepo.save(category);
        return ResponseEntity.ok(Map.of("id", id, "active", true));
    }

    private String clean(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private int nextSortOrder() {
        return categoryRepo.findAll().stream()
                .mapToInt(Category::getSortOrder)
                .max()
                .orElse(0) + 1;
    }
}
