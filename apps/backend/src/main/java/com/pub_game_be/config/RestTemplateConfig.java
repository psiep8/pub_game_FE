package com.pub_game_be.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Collections;

@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate() {
        // Le chiamate a iTunes, Wikipedia e TMDB avvengono mentre si prepara un
        // round: un timeout corto evita che una rete lenta blocchi la TV.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(4));
        RestTemplate restTemplate = new RestTemplate(factory);

        restTemplate.getInterceptors().add((request, body, execution) -> {
            request.getHeaders().set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            request.getHeaders().setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            request.getHeaders().set("Accept-Language", "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7");
            return execution.execute(request, body);
        });

        return restTemplate;
    }
}