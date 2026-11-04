package com.pub_game_be.controller;

import com.pub_game_be.domain.category.Category;
import com.pub_game_be.repository.CategoryRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/categories")
public class CategoryController {

    private final CategoryRepository categoryRepo;

    public CategoryController(CategoryRepository categoryRepo) {
        this.categoryRepo = categoryRepo;
    }

    @GetMapping
    public List<Category> getAll() {
        return categoryRepo.findAll();
    }
}