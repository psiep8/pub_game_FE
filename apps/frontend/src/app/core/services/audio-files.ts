/**
 * File registrati della serata: id del catalogo → percorso in `assets/audio`.
 *
 * Chi non compare qui resta sintetizzato, e chi c'è ricade sulla sintesi se il
 * file non si carica: la regia non deve mai restare muta per un asset mancante.
 * L'ordine delle varianti è quello del catalogo: rankReveal 5°/4° posto,
 * podiumReveal dal terzo al primo, bonusEntrance nell'ordine dei bonus.
 *
 * I tappeti (`ambient`) non sono qui: sono loop generati, non file.
 *
 * gong, countdownBong, whoosh, coins e racket sono file come gli altri: la
 * registrazione di libreria non rendeva (gong da chiesa, bong debole, whoosh
 * pesante, gettoni sporchi, racchetta poco credibile), quindi sono stati
 * rifatti renderizzando la sintesi interna in `_src` e passando dallo stesso
 * script degli altri suoni.
 */
export const AUDIO_FILES: Partial<Record<string, readonly string[]>> = {
  countdownTick: ['interface/countdownTick.m4a'],
  countdownBong: ['interface/countdownBong.m4a'],
  join: ['interface/join.m4a'],
  tick: ['interface/tick.m4a'],
  rankReveal: ['interface/rankReveal-1.m4a', 'interface/rankReveal-2.m4a'],
  whoosh: ['interface/whoosh.m4a'],
  confirm: ['interface/confirm.m4a'],
  error: ['interface/error.m4a'],
  gong: ['gioco/gong.m4a'],

  correct: ['gioco/correct.m4a'],
  wrong: ['gioco/wrong.m4a'],
  timeUp: ['gioco/timeUp.m4a'],
  reveal: ['gioco/reveal.m4a'],
  elimination: ['gioco/elimination.m4a'],
  uuuh: ['gioco/uuuh.m4a'],
  bombSiren: ['gioco/bombSiren.m4a'],
  bell: ['gioco/bell.m4a'],
  coins: ['gioco/coins.m4a'],
  explosion: ['gioco/explosion.m4a'],
  fuse: ['gioco/fuse.m4a'],
  racket: ['gioco/racket.m4a'],
  marbleHit: ['gioco/marbleHit.m4a'],
  marbleWall: ['gioco/marbleWall.m4a'],
  marbleSurfaceHard: ['gioco/marbleSurfaceHard.m4a'],
  marbleSurfaceSoft: ['gioco/marbleSurfaceSoft.m4a'],

  rouletteTicks: ['casino/rouletteTicks.m4a'],
  rouletteLanding: ['casino/rouletteLanding.m4a'],

  applause: ['sala/applause.m4a'],
  drumroll: ['sala/drumroll.m4a'],
  podium: ['sala/podium.m4a'],
  podiumReveal: ['sala/podiumReveal-1.m4a', 'sala/podiumReveal-2.m4a', 'sala/podiumReveal-3.m4a'],

  bonusEntrance: [
    'bonus/bonusEntrance-1.m4a',
    'bonus/bonusEntrance-2.m4a',
    'bonus/bonusEntrance-3.m4a',
    'bonus/bonusEntrance-4.m4a',
    'bonus/bonusEntrance-5.m4a',
  ],

  heartbeat: ['attesa/heartbeat.m4a'],
  clock: ['attesa/clock.m4a'],
};
