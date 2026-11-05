package com.pub_game_be.domain.category;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "category")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String emoji;

    @Column(length = 500)
    private String description;

    /** True per le categorie con eventi ordinabili nel tempo (Timeline). */
    @Column(name = "supports_timeline")
    private boolean timeline;

    @Column(name = "sort_order")
    private int sortOrder;

    /** Colore identificativo usato dalle bolle e dalle card della TV. */
    private String color;

    private boolean active;
}