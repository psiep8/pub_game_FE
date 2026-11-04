package com.pub_game_be.repository;

import com.pub_game_be.domain.category.Category;
import com.pub_game_be.domain.game.Game;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {
    @Query(value = "SELECT * FROM category WHERE active = true ORDER BY RAND() LIMIT 1", nativeQuery = true)
    java.util.Optional<Category> findRandom();
}
