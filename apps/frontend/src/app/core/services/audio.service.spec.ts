import { describe, expect, it } from 'vitest';

import { UI_SOUNDS } from './audio.service';

/**
 * La tabella evento → suono è l'unico posto da toccare quando si aggiunge un
 * evento. Se un evento sparisce, la serata resta muta senza che nessuno se ne
 * accorga: questo test lo impedisce.
 */
describe('AudioService — suoni di interfaccia', () => {
  it('copre ogni evento della serata', () => {
    expect(Object.keys(UI_SOUNDS).sort()).toEqual([
      'eliminazione',
      'giusto',
      'ingresso',
      'prenotazione',
      'rispostaInviata',
      'rivelazione',
      'sbagliato',
      'tempoScaduto',
      'tocco',
      'vittoria',
    ]);
  });

  it('usa solo cue di Foley esistenti', () => {
    const cues = new Set([
      'tick', 'hover', 'glide', 'pop',
      'press', 'release', 'tap', 'thock',
      'on', 'off', 'switch', 'latch',
      'success', 'error', 'warning', 'denied',
      'chime', 'ping', 'bell', 'bubble',
      'swoosh', 'whoosh', 'drop', 'rise',
      'loading', 'ready', 'complete', 'sparkle',
    ]);
    for (const [event, cue] of Object.entries(UI_SOUNDS)) {
      expect(cues.has(cue), `${event} → ${cue}`).toBe(true);
    }
  });
});
