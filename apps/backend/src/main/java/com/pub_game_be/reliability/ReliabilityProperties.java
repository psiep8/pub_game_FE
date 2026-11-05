package com.pub_game_be.reliability;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Parametri della affidabilità di partita.
 *
 * <p>La finestra di risposta è autorevole sul server: un telefono non può
 * decidere da solo che il proprio round è ancora aperto. Il default è largo
 * (5 minuti) perché nessuna modalità reale dura tanto, ma resta un limite
 * esplicito contro risposte arrivate dopo un riavvio o dopo un minuto di
 * schermo bloccato.</p>
 */
@Component
@ConfigurationProperties(prefix = "game.reliability")
@Data
public class ReliabilityProperties {

    /** Quanto resta aperto un round, in secondi, dalla sua apertura sul server. */
    private int answerWindowSeconds = 300;

    /** Senza heartbeat per questo tempo il dispositivo è considerato offline. */
    private int heartbeatTimeoutSeconds = 25;

    /** Quanti eventi restituire al massimo in una sincronizzazione. */
    private int eventHistoryLimit = 200;

    /** Durata di riferimento dell'Arena: base della rampa facile/media/difficile. */
    private int arenaSeconds = 130;

    /** Quante sessioni per dispositivo conservare nella diagnostica. */
    private int sessionHistoryLimit = 20;
}
