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
  IMAGE_BLUR_MANCHE_POINTS,
  MUSIC_FIRST_LISTEN_POINTS,
  MUSIC_GAME_MAX,
  MUSIC_ROUND_MAX,
  MUSIC_SECOND_LISTEN_PENALTY,
  MUSIC_SECOND_LISTEN_POINTS,
  musicPointsFor,
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
  it('Musica: 4 round da 5 manche, 200 / 100 / −50', () => {
    expect(MUSIC_FIRST_LISTEN_POINTS).toBe(200);
    expect(MUSIC_SECOND_LISTEN_POINTS).toBe(100);
    expect(MUSIC_SECOND_LISTEN_PENALTY).toBe(-50);
    expect(MUSIC_ROUND_MAX).toBe(1000);
    expect(MUSIC_GAME_MAX).toBe(4000);
    expect(musicPointsFor(1, true)).toBe(200);
    expect(musicPointsFor(2, true)).toBe(100);
    expect(musicPointsFor(1, false)).toBe(0);
    expect(musicPointsFor(2, false)).toBe(-50);
    expect(SCORING_RULES.MUSIC.note).toContain('4000');
    expect(SCORING_RULES.MUSIC.note).not.toContain('750');
  });

  it('Indovina chi: il round da 1000 è diviso tre manche (333/333/334)', () => {
    expect([...IMAGE_BLUR_MANCHE_POINTS]).toEqual([333, 333, 334]);
    expect(IMAGE_BLUR_MANCHE_POINTS.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(SCORING_RULES.IMAGE_BLUR.note).toContain('da −1000 a +1000');
  });

  it('Quiz: 1000 per round, penalità scalata dal tempo', () => {
    expect(SCORING_RULES.QUIZ.wrong).toContain('−1000');
    expect(SCORING_RULES.QUIZ.wrong).toContain('tempo');
    expect(SCORING_RULES.QUIZ.note).toContain('1000 punti in tutto');
    expect(SCORING_RULES.QUIZ.note).toContain('QuizService');
    expect(SCORING_RULES.QUIZ.note).not.toContain('−3000');
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

  it('Bomba: solo malus, picco −500 e malus proporzionale alle bombe rimaste', () => {
    expect(BOMBA_PEAK).toBe(-500);
    expect(SCORING_RULES.BOMBA.correct).toContain('0');
    expect(SCORING_RULES.BOMBA.note).toContain('−500');
    expect(SCORING_RULES.BOMBA.note).toContain('bombe rimaste');
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
    expect(BONUS_CASINO_NUMBER_POINTS).toBe(1000);
    expect(BONUS_SCORING['BONUS_CASINO_NUMBER'].note).toContain('una volta sola');
    expect(BONUS_SCORING['BONUS_CASINO_NUMBER'].note).toContain('tre le girate');
    expect(BONUS_SCORING['BONUS_SETTE_E_MEZZO'].correct).toContain('premio del bar');
    expect(BONUS_SCORING['BONUS_CAVALLO'].correct).toContain('premio del bar');
    for (const rule of Object.values(BONUS_SCORING)) {
      expect(rule.wrong.startsWith('0')).toBe(true);
    }
  });

  it('il Blackjack non ha più una voce nei punteggi di gioco', () => {
    expect('BLACKJACK' in SCORING_RULES).toBe(false);
    expect(scoringRuleFor('BONUS_SETTE_E_MEZZO')?.correct).toContain('premio del bar');
  });
});
