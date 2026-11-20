import { describe, expect, it } from 'vitest';
import {
  BIGLIE_FIRST,
  BIGLIE_LAST,
  BONUS_CASINO_COLOR_POINTS,
  BONUS_CASINO_DOZEN_POINTS,
  BONUS_CASINO_NUMBER_POINTS,
  BONUS_SCORING,
  BOMBA_PEAK,
  CASINO_SPINS,
  MUSIC_MANCHE_POINTS,
  SCORING_RULES,
  SPEED_RUSH_FIRST,
  SPEED_RUSH_LAST,
  TENNIS_WIN,
  TIMELINE_POSITION_POINTS,
  TIME_BUZZER_FIRST,
  TIME_BUZZER_LAST,
  TIME_BUZZER_PERFECT,
  scoringRuleFor,
} from './scoring-rules';

describe('regole dei punteggi', () => {
  it('Musica: quattro manche, 1000 / 750 / 500 / 250', () => {
    expect([...MUSIC_MANCHE_POINTS]).toEqual([1000, 750, 500, 250]);
    expect(SCORING_RULES.MUSIC.correct).toContain('1000');
    expect(SCORING_RULES.MUSIC.note).toContain('750');
  });

  it('Timeline: da +400 a −200 con otto posti giusti', () => {
    expect([...TIMELINE_POSITION_POINTS]).toEqual([-200, -200, -100, -50, 0, 100, 200, 300, 400]);
    expect(SCORING_RULES.TIMELINE.note).toContain('400');
    expect(SCORING_RULES.TIMELINE.note).toContain('−200');
  });

  it('Time Buzzer: 300 al primo, −200 all’ultimo, 600 col tempo perfetto', () => {
    expect(TIME_BUZZER_FIRST).toBe(300);
    expect(TIME_BUZZER_LAST).toBe(-200);
    expect(TIME_BUZZER_PERFECT).toBe(600);
    expect(SCORING_RULES.TIME_BUZZER.note).not.toContain('elimin');
  });

  it('Bomba: solo malus, picco −500', () => {
    expect(BOMBA_PEAK).toBe(-500);
    expect(SCORING_RULES.BOMBA.correct).toContain('0');
    expect(SCORING_RULES.BOMBA.note).toContain('−500');
  });

  it('Speed Rush, Biglie e Tennis usano le nuove costanti', () => {
    expect([SPEED_RUSH_FIRST, SPEED_RUSH_LAST]).toEqual([800, -400]);
    expect([BIGLIE_FIRST, BIGLIE_LAST]).toEqual([500, -400]);
    expect(TENNIS_WIN).toBe(500);
    expect(SCORING_RULES.TENNIS_BATTLE.note).not.toContain('consolazione');
  });

  it('i cinque bonus hanno i valori nuovi e nessun malus', () => {
    expect(BONUS_CASINO_COLOR_POINTS * CASINO_SPINS).toBe(300);
    expect(BONUS_CASINO_DOZEN_POINTS * CASINO_SPINS).toBe(600);
    expect(BONUS_CASINO_NUMBER_POINTS).toBe(500);
    expect(BONUS_SCORING['BONUS_BLACKJACK'].correct).toContain('3 consumazioni');
    expect(BONUS_SCORING['BONUS_CAVALLO'].correct).toContain('1 consumazione');
    for (const rule of Object.values(BONUS_SCORING)) {
      expect(rule.wrong.startsWith('0')).toBe(true);
    }
  });

  it('il Blackjack non ha più una voce nei punteggi di gioco', () => {
    expect('BLACKJACK' in SCORING_RULES).toBe(false);
    expect(scoringRuleFor('BONUS_BLACKJACK')?.correct).toContain('3 consumazioni');
  });
});
