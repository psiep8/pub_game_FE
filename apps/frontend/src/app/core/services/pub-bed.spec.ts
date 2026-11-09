import {
  PUB_BED_BARS_PER_SECTION,
  PUB_BED_CYCLE_SECONDS,
  PUB_BED_SECONDS_PER_BAR,
  PUB_BED_SECONDS_PER_BEAT,
  PUB_BED_SECTIONS,
  PUB_BED_TOTAL_BARS,
  midiToFrequency,
  pubBedBar,
  pubBedSection,
} from './pub-bed';

describe('pub bed', () => {
  it('chiude un ciclo di venti minuti', () => {
    expect(PUB_BED_SECONDS_PER_BEAT).toBeCloseTo(0.9375, 6);
    expect(PUB_BED_SECONDS_PER_BAR).toBeCloseTo(3.75, 6);
    expect(PUB_BED_TOTAL_BARS).toBe(PUB_BED_BARS_PER_SECTION * PUB_BED_SECTIONS);
    expect(PUB_BED_CYCLE_SECONDS).toBeCloseTo(1200, 6);
  });

  it('alterna gli accordi ogni due battute e torna dopo otto', () => {
    expect(pubBedBar(0).chord).toBe('Cmaj7');
    expect(pubBedBar(1).chord).toBe('Cmaj7');
    expect(pubBedBar(2).chord).toBe('Am7');
    expect(pubBedBar(6).chord).toBe('G7');
    expect(pubBedBar(8).chord).toBe('Cmaj7');
  });

  it('tiene le note dentro la battuta e sotto il volume degli effetti', () => {
    for (let bar = 0; bar < PUB_BED_TOTAL_BARS; bar += 7) {
      const { notes } = pubBedBar(bar);
      expect(notes.length).toBeGreaterThan(0);
      for (const note of notes) {
        expect(note.beat).toBeGreaterThanOrEqual(0);
        expect(note.beat).toBeLessThan(4);
        expect(note.duration).toBeGreaterThan(0);
        expect(note.gain).toBeLessThanOrEqual(0.011);
        expect(note.midi).toBeGreaterThanOrEqual(24);
        expect(note.midi).toBeLessThanOrEqual(96);
      }
    }
  });

  it('entra con il tappeto e aggiunge spazzole e melodia dopo', () => {
    expect(pubBedBar(0).brushes).toEqual([]);
    expect(pubBedBar(PUB_BED_BARS_PER_SECTION).brushes).toEqual([1, 3]);
    expect(pubBedBar(PUB_BED_BARS_PER_SECTION * 3).notes.some((note) => note.midi >= 74)).toBe(true);
    expect(pubBedBar(0).notes.some((note) => note.midi >= 74)).toBe(false);
  });

  it('conta dieci sezioni e poi riparte', () => {
    expect(pubBedSection(0)).toBe(0);
    expect(pubBedSection(PUB_BED_BARS_PER_SECTION)).toBe(1);
    expect(pubBedSection(PUB_BED_BARS_PER_SECTION * (PUB_BED_SECTIONS - 1))).toBe(PUB_BED_SECTIONS - 1);
    expect(pubBedSection(PUB_BED_TOTAL_BARS)).toBe(0);
  });

  it('converte il MIDI in frequenza', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 5);
    expect(midiToFrequency(81)).toBeCloseTo(880, 5);
  });
});
