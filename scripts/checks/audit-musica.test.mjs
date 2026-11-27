import assert from 'node:assert/strict';
import test from 'node:test';
import { auditMusicThemes } from '../audit-banche.mjs';

/**
 * La banca Musica versionata (`music-themes.json`) è la fonte che il gioco
 * serve: il test tiene ferme le regole che l'audit --ci deve far rispettare.
 */
const THEMES = [
  'Rock',
  'Pop',
  'Italiano',
  'Dance & disco',
  'Latino & tormentoni',
  'Rap & trap',
  'Colonne sonore',
  "Anni '70-'80",
  "Anni '90-2000",
  'Anni 2010-oggi',
];
const ERA_THEMES = ["Anni '70-'80", "Anni '90-2000", 'Anni 2010-oggi'];
const MIX = ['hit', 'hit', 'medium', 'medium', 'hard'];

function eraFor(year) {
  if (year >= 2010) return 'Anni 2010-oggi';
  if (year >= 1990) return "Anni '90-2000";
  if (year >= 1970) return "Anni '70-'80";
  return '';
}

/** Un brano per ogni posto del mix: 5 brani, artisti tutti diversi. */
function tracksFor(themeIndex, theme) {
  const year = theme === "Anni 2010-oggi" ? 2015 : theme === "Anni '90-2000" ? 2000 : 1980;
  return MIX.map((difficulty, index) => {
    const ordinal = themeIndex * 5 + index;
    return {
      file: `/media/music/brano-${ordinal}.m4a`,
      title: `Brano ${ordinal}`,
      artist: `Artista ${ordinal}`,
      year,
      decade: Math.floor(year / 10) * 10,
      era: eraFor(year),
      theme,
      difficulty,
    };
  });
}

function fullBank() {
  return {
    themes: THEMES,
    eraThemes: ERA_THEMES,
    familyThemes: THEMES.filter((theme) => !ERA_THEMES.includes(theme)),
    tracks: THEMES.flatMap((theme, index) => tracksFor(index, theme)),
  };
}

test('la banca Musica completa passa senza problemi', () => {
  const report = auditMusicThemes(fullBank(), null);
  assert.deepEqual(report.problems, []);
  assert.deepEqual(report.missing, []);
  assert.equal(report.total, 50);
  assert.equal(report.artists, 50);
});

test("un brano senza tema o senza decennio fa fallire l'audit", () => {
  const bank = fullBank();
  bank.tracks[0].theme = '';
  bank.tracks[1].decade = 0;
  const report = auditMusicThemes(bank, null);
  assert.ok(report.missing.some((row) => row.field === 'theme'));
  assert.ok(report.missing.some((row) => row.field === 'decade'));
});

test("un decennio che non combacia con l'anno è un problema", () => {
  const bank = fullBank();
  bank.tracks[0].decade = 1990;
  const report = auditMusicThemes(bank, null);
  assert.ok(report.problems.some((row) => /decennio 1990/.test(row.detail)));
});

test("un'era che non combacia con l'anno è un problema", () => {
  const bank = fullBank();
  bank.tracks[0].year = 2015;
  bank.tracks[0].decade = 2010;
  const report = auditMusicThemes(bank, null);
  assert.ok(report.problems.some((row) => /era «Anni '70-'80»/.test(row.detail)));
});

test('un tema con artisti ripetuti non regge il mix 2+2+1', () => {
  const bank = fullBank();
  bank.tracks[2].artist = bank.tracks[1].artist;
  const report = auditMusicThemes(bank, null);
  assert.ok(report.problems.some((row) => /mix 2 hit/.test(row.detail)));
});

test('un tema con meno di cinque brani fa fallire l\'audit', () => {
  const bank = fullBank();
  bank.tracks = bank.tracks.filter((track) => track.theme !== 'Rock' || track.difficulty !== 'hard');
  const report = auditMusicThemes(bank, null);
  assert.ok(report.problems.some((row) => row.theme === 'Rock' && /servono almeno 5/.test(row.detail)));
});

test('i brani anni 60 con era vuota per scelta non sono un errore', () => {
  const bank = fullBank();
  bank.tracks[0].year = 1966;
  bank.tracks[0].decade = 1960;
  bank.tracks[0].era = '';
  const report = auditMusicThemes(bank, null);
  assert.deepEqual(report.problems, []);
  assert.deepEqual(report.missing, []);
});
