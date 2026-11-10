package com.pub_game_be.security;

import org.springframework.context.annotation.Bean;
import com.pub_game_be.reliability.DeviceSessionService;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${game.security.allowed-origins:http://localhost:4200,http://127.0.0.1:4200}")
    private String allowedOrigins;

    /** Solo la prova in casa incornicia TV, admin e telefoni nella stessa pagina. */
    @Value("${spring.profiles.active:}")
    private String activeProfiles;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, DeviceSessionService sessions) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .addFilterBefore(new SessionAuthenticationFilter(sessions), AnonymousAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll());

        // La pagina sim-duo incornicia le tre viste sulla stessa macchina.
        // In produzione resta il default DENY: nessun clickjacking.
        if (activeProfiles.contains("test-night")) {
            http.headers(headers -> headers.frameOptions(frame -> frame.disable()));
        }

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.stream(allowedOrigins.split(",")).map(String::trim).toList());
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        // Nessun cookie né sessione: credenziali off, così la wildcard non è un buco.
        configuration.setAllowCredentials(false);
        configuration.setExposedHeaders(Arrays.asList("Authorization"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}