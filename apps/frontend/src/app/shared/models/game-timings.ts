/**
 * Tempi ufficiali dei round, in un solo posto.
 *
 * Li usano i modi di gioco (timer e manche), le demo animate e il manuale sul
 * telefono. `timings-consistency.spec.ts` fallisce se un testo di demo o
 * manuale cita un numero diverso da quello scritto qui.
 */
export const GAME_TIMINGS = {
  QUIZ: {
    manches: 3,
    mancheSeconds: 10,
  },
  MUSIC: {
    manches: 4,
    mancheSeconds: 30,
  },
  IMAGE_BLUR: {
    seconds: 60,
    clueEverySeconds: 15,
  },
  WHEEL_OF_FORTUNE: {
    seconds: 75,
  },
  TIMELINE: {
    seconds: 45,
  },
  TIME_BUZZER: {
    manches: 3,
    mancheSeconds: 30,
    minTargetSeconds: 5,
    maxTargetSeconds: 20,
  },
} as const;
