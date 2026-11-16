import { describe, expect, it, beforeEach } from 'vitest';

import {
  AUDIO_EVENTS,
  AUDIO_EVENT_FOR_METHOD,
  AUDIO_EVENT_ORDER,
  type AudioEventId,
} from './audio-catalog';
import { AudioService } from './audio.service';

const ids = Object.keys(AUDIO_EVENTS) as AudioEventId[];

describe('Catalogo audio', () => {
  it('ha un id per ogni evento, uguale alla chiave', () => {
    for (const id of ids) {
      expect(AUDIO_EVENTS[id].id, id).toBe(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('descrive ogni evento con etichetta, momento, fonte e bus validi', () => {
    for (const id of ids) {
      const event = AUDIO_EVENTS[id];
      expect(event.label.length, id).toBeGreaterThan(3);
      expect(event.when.length, id).toBeGreaterThan(10);
      expect(['ui', 'sfx', 'bed'], id).toContain(event.source);
      expect(['tv', 'phone', 'both'], id).toContain(event.bus);
    }
  });

  it('tiene volumi, distanze minime e varianti nei limiti', () => {
    for (const id of ids) {
      const event = AUDIO_EVENTS[id];
      expect(event.volume, id).toBeGreaterThan(0);
      expect(event.volume, id).toBeLessThanOrEqual(1);
      expect(event.minIntervalMs, id).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(event.variants), id).toBe(true);
      expect(event.variants, id).toBeGreaterThanOrEqual(1);
    }
  });

  it('elenca ogni evento una volta sola nell’ordine della regia', () => {
    expect([...AUDIO_EVENT_ORDER].sort()).toEqual([...ids].sort());
  });

  it('mappa ogni metodo audio su un evento che esiste', () => {
    for (const [method, event] of Object.entries(AUDIO_EVENT_FOR_METHOD)) {
      expect(ids, method).toContain(event);
    }
  });

  it('non lascia fuori nessun metodo play*/start* del servizio', () => {
    // Aiutanti privati: compongono un evento del catalogo, non sono eventi
    // a sé. Se ne nasce un altro, va aggiunto qui con il suo motivo.
    const internal = new Set([
      'startVinyl',        // fruscio del tappeto, dentro startAmbient()
      'playCelebration',   // accordo del podio, dentro playPodiumReveal()
      'playFireworks',     // botti del podio, dentro playPodiumReveal()
      'playSuspenseSting', // richiamo del battito, dentro startSuspense()
      'playUi',            // cue Foley della tabella UI_SOUNDS
    ]);
    const methods = Object.getOwnPropertyNames(AudioService.prototype).filter(
      (name) => /^(play|start)[A-Z]/.test(name) && !internal.has(name),
    );
    expect(methods.length).toBeGreaterThan(20);
    for (const method of methods) {
      expect(AUDIO_EVENT_FOR_METHOD, method).toHaveProperty(method);
    }
  });
});

describe('AudioService — eventi del catalogo', () => {
  let audio: AudioService;

  beforeEach(() => {
    audio = new AudioService();
  });

  it('salta l’evento ripetuto troppo presto e lo riprende dopo la distanza minima', () => {
    expect(audio.play('tick')).toBe(true);
    expect(audio.play('tick')).toBe(false);

    const later = Date.now() + AUDIO_EVENTS.tick.minIntervalMs + 1;
    const realNow = Date.now;
    Date.now = () => later;
    try {
      expect(audio.play('tick')).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });

  it('resta muto quando l’audio è spento', () => {
    audio.toggleAudio();
    expect(audio.isEnabled()).toBe(false);
    expect(audio.play('gong')).toBe(false);
    audio.toggleAudio();
    audio.stopAll();
    audio.stopAmbient();
    expect(audio.isEnabled()).toBe(true);
  });

  it('tiene il volume generale fra 0 e 1', () => {
    audio.setMasterVolume(0.4);
    expect(audio.masterVolume()).toBe(0.4);
    audio.setMasterVolume(3);
    expect(audio.masterVolume()).toBe(1);
    audio.setMasterVolume(-2);
    expect(audio.masterVolume()).toBe(0);
  });
});
