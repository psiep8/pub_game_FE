/**
 * Azioni del canale di stato (`/topic/game/{id}/status`).
 *
 * Sono le stringhe che TV, admin e telefoni si scambiano: tenerle qui evita i
 * refusi e rende cercabile "chi manda cosa".
 */
export const WsAction = {
  // Telefono -> server
  JOIN_GAME: 'JOIN_GAME',
  SCREAM: 'SCREAM',
  ARENA_ANSWER: 'ARENA_ANSWER',
  ANSWER: 'ANSWER',
  TIME_BUZZER_START: 'TIME_BUZZER_START',
  TIME_BUZZER_ANSWER: 'TIME_BUZZER_ANSWER',
  SPEED_RUSH_PROGRESS: 'SPEED_RUSH_PROGRESS',
  TENNIS_BATTLE_ANSWER: 'TENNIS_BATTLE_ANSWER',
  PLAYER_AVATAR: 'PLAYER_AVATAR',
  /** La squadra sceglie il colore della serata: la TV lo adotta. */
  SELECT_THEME: 'SELECT_THEME',
  // Prova dei pulsanti
  /** La sequenza passa da ButtonTestService (REST): sul canale resta il ping. */
  BUTTON_TEST_PING: 'BUTTON_TEST_PING',
  // Bonus giocati dai telefoni
  CASINO_ACTION: 'CASINO_ACTION',
  CAVALLO_ACTION: 'CAVALLO_ACTION',
  BIGLIE_ACTION: 'BIGLIE_ACTION',
  ULTIMA_SPIAGGIA_ACTION: 'ULTIMA_SPIAGGIA_ACTION',
  AZZARDO_ACTION: 'AZZARDO_ACTION',
  BLACKJACK_ACTION: 'BLACKJACK_ACTION',
  // TV -> telefoni
  /** Un bonus sta partendo: i telefoni vibrano con l'ingresso. */
  BONUS_STARTED: 'BONUS_STARTED',
  SHOW_QUESTION: 'SHOW_QUESTION',
  START_VOTING: 'START_VOTING',
  PLAYER_PRENOTATO: 'PLAYER_PRENOTATO',
  ROUND_ENDED: 'ROUND_ENDED',
  BLOCKED_ERROR: 'BLOCKED_ERROR',
  BONUS_ENDED: 'BONUS_ENDED',
  ARENA_ELIMINATED: 'ARENA_ELIMINATED',
  ARENA_ENDED: 'ARENA_ENDED',
  /** La regia espelle una squadra: il telefono torna al setup. */
  PLAYER_REMOVED: 'PLAYER_REMOVED',
  /** Pausa globale: ferma timer, input e animazioni anche sui telefoni. */
  GAME_PAUSED: 'GAME_PAUSED',
  GAME_RESUMED: 'GAME_RESUMED',
  // Stato dei singoli giochi
  QUIZ_STATE: 'QUIZ_STATE',
  TIME_BUZZER_STATE: 'TIME_BUZZER_STATE',
  ULTIMA_SPIAGGIA_STATE: 'ULTIMA_SPIAGGIA_STATE',
  AZZARDO_STATE: 'AZZARDO_STATE',
  AZZARDO_MESSAGE: 'AZZARDO_MESSAGE',
  BLACKJACK_STATE: 'BLACKJACK_STATE',
  TENNIS_BATTLE_STATE: 'TENNIS_BATTLE_STATE',
  CASINO_STATE: 'CASINO_STATE',
  CAVALLO_STATE: 'CAVALLO_STATE',
  BIGLIE_STATE: 'BIGLIE_STATE',
  // Comandi del pannello admin
  ADMIN_REQUEST_STATE: 'ADMIN_REQUEST_STATE',
  ADMIN_STATE: 'ADMIN_STATE',
  ADMIN_CONFIRM_CORRECT: 'ADMIN_CONFIRM_CORRECT',
  ADMIN_CONFIRM_WRONG: 'ADMIN_CONFIRM_WRONG',
  ADMIN_NEXT_ROUND: 'ADMIN_NEXT_ROUND',
  ADMIN_START_ROUND: 'ADMIN_START_ROUND',
  ADMIN_NEXT_MANCHE: 'ADMIN_NEXT_MANCHE',
  ADMIN_SHOW_LEADERBOARD: 'ADMIN_SHOW_LEADERBOARD',
  ADMIN_TOGGLE_PAUSE: 'ADMIN_TOGGLE_PAUSE',
  ADMIN_SHOW_DEMO: 'ADMIN_SHOW_DEMO',
  ADMIN_HIDE_DEMO: 'ADMIN_HIDE_DEMO',
  /** Rivede l'intro della serata, anche se è già stata mostrata. */
  ADMIN_SHOW_INTRO: 'ADMIN_SHOW_INTRO',
  ADMIN_START_BONUS: 'ADMIN_START_BONUS',
  ADMIN_STOP_BONUS: 'ADMIN_STOP_BONUS',
  /** Q-01: riapre il bonus corrente dopo un blocco, senza toccare i punti. */
  ADMIN_RESTART_BONUS: 'ADMIN_RESTART_BONUS',
  /** Q-05: chiude la pausa d'atto e mostra la flash di ripresa. */
  ADMIN_RESUME_ACT: 'ADMIN_RESUME_ACT',
  /** Q-05: timer della pausa d'atto, 0 = nessun conto alla rovescia. */
  ADMIN_ACT_PAUSE_SECONDS: 'ADMIN_ACT_PAUSE_SECONDS',
  CHRISTMAS_TOGGLE: 'CHRISTMAS_TOGGLE',
} as const;

export type WsAction = (typeof WsAction)[keyof typeof WsAction];
