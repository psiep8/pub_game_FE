package com.pub_game_be.repository;

import com.pub_game_be.domain.category.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {

    List<Category> findByActiveTrueOrderBySortOrderAscNameAsc();

    Optional<Category> findByNameIgnoreCase(String name);

    @Query(value = "SELECT * FROM category WHERE active = true ORDER BY RAND() LIMIT 1", nativeQuery = true)
    Optional<Category> findRandom();
}
