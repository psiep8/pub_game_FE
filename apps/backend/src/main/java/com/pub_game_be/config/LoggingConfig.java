package com.pub_game_be.config;

import ch.qos.logback.classic.LoggerContext;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LoggingConfig {

    /**
     * Registra il filtro sul contesto logback all'avvio: il livello del logger
     * di Spring non viene toccato, così i suoi ERROR veri restano visibili.
     */
    @Bean
    public InitializingBean stompSendFailureAsWarn() {
        return () -> {
            if (LoggerFactory.getILoggerFactory() instanceof LoggerContext context) {
                var filter = new StompSendFailureTurboFilter();
                filter.setContext(context);
                filter.start();
                context.addTurboFilter(filter);
            }
        };
    }
}
