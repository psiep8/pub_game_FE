package com.pub_game_be.controller;

import com.pub_game_be.domain.question.Question;
import com.pub_game_be.repository.QuestionRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/questions")
public class QuestionController {

    private final QuestionRepository repo;

    public QuestionController(QuestionRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<Question> all() {
        return repo.findAll();
    }

    @GetMapping("/category/{id}")
    public List<Question> byCategory(@PathVariable("id") Long id) {
        return repo.findByCategoryId(id);
    }

}
