/**
 * Modalità di gioco della scaletta.
 *
 * Oggetto `as const` invece di `enum`: i valori restano stringhe, quindi i
 * payload del server e i confronti (`type === 'QUIZ'`) continuano a funzionare,
 * ma il nome del tipo vive in un solo posto.
 */
export const GameModeType = {
  QUIZ: 'QUIZ',
  IMAGE_BLUR: 'IMAGE_BLUR',
  MUSIC: 'MUSIC',
  WHEEL_OF_FORTUNE: 'WHEEL_OF_FORTUNE',
  ARENA: 'ARENA',
  TIMELINE: 'TIMELINE',
  TIME_BUZZER: 'TIME_BUZZER',
  BOMBA: 'BOMBA',
  SPEED_RUSH: 'SPEED_RUSH',
  AIR_HOCKEY_BATTLE: 'AIR_HOCKEY_BATTLE',
  SCOMMESSA: 'SCOMMESSA',
  QUOTA: 'QUOTA',
  BLACKJACK: 'BLACKJACK',
} as const;

export type GameModeType = (typeof GameModeType)[keyof typeof GameModeType];

/** Tutte le modalità, nell'ordine dichiarato qui sopra. */
export const GAME_MODE_TYPES: readonly GameModeType[] = Object.values(GameModeType);
