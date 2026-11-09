package com.pub_game_be;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;

import static org.assertj.core.api.Assertions.assertThat;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:application-context-test;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class PubGameBeApplicationTests {

    @Autowired
    private Environment environment;

    @Test
    void contextLoads() {
        assertThat(environment.getProperty("spring.h2.console.enabled", Boolean.class)).isFalse();
    }

}
