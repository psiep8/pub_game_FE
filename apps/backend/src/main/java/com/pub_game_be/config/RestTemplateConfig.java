package com.pub_game_be.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;

@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate() {
        RestTemplate restTemplate = new RestTemplate();

        restTemplate.getInterceptors().add((request, body, execution) -> {
            request.getHeaders().set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            request.getHeaders().setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            request.getHeaders().set("Accept-Language", "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7");
            return execution.execute(request, body);
        });

        return restTemplate;
    }
}