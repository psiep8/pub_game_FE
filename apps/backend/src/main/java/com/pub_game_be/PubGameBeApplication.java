package com.pub_game_be;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

@SpringBootApplication
@EntityScan("com.pub_game_be.domain")
@EnableJpaRepositories(basePackages = "com.pub_game_be.repository")
public class PubGameBeApplication {

    public static void main(String[] args) throws IOException {
        loadDotEnv();
        SpringApplication.run(PubGameBeApplication.class, args);
    }

    private static void loadDotEnv() throws IOException {
        Path envPath = Path.of(".env");
        if (!Files.exists(envPath)) {
            System.out.println(".env file not found, skipping");
            return;
        }
        Files.readAllLines(envPath).stream()
                .map(String::trim)
                .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                .filter(line -> line.contains("="))
                .forEach(line -> {
                    int idx = line.indexOf('=');
                    String key = line.substring(0, idx).trim();
                    String value = line.substring(idx + 1).trim();
                    if (System.getenv(key) == null) {
                        System.setProperty(key, value);
                        System.out.println("Loaded env: " + key);
                    }
                });
    }

}
