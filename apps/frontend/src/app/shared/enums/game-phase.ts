/**
 * Fasi comuni a più giochi, così TV e telefono parlano lo stesso vocabolario.
 *
 * Le fasi di un solo gioco (per esempio `SPIN` del casino o `MANCHE_END` del
 * basket) restano nel file del gioco, come oggetto `as const` locale.
 *
 * Sono `as const` e non `enum`: arrivano dal server come stringhe, quindi
 * devono restare assegnabili senza cast.
 */
export const GamePhase = {
  /** Presentazione del gioco, prima delle regole. */
  INTRO: 'INTRO',
  /** Il telefono aspetta: nessuna azione richiesta. */
  WAITING: 'WAITING',
  /** Round o manche in corso. */
  PLAYING: 'PLAYING',
  /** Scelta o puntata da parte delle squadre. */
  PICK: 'PICK',
  /** Soluzione mostrata in TV. */
  REVEAL: 'REVEAL',
  /** Gara in corso (biglie, speed rush). */
  RACE: 'RACE',
  /** Classifica finale del gioco. */
  FINALE: 'FINALE',
} as const;

export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];
