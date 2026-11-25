import { readFileSync } from 'node:fs';

/**
 * Q-08: il nome visibile è `quizzOne`, con la O maiuscola. Il livello 2
 * (pacchetti, Maven, percorsi, volumi, chiavi) resta fuori da questa prova:
 * qui si controllano solo i testi che la sala vede.
 */
describe('nome visibile quizzOne', () => {
  const read = (path: string): string => readFileSync(path, 'utf8');

  it('usa quizzOne nel titolo della pagina e nel manifest', () => {
    expect(read('src/index.html')).toContain('<title>quizzOne</title>');
    const manifest = JSON.parse(read('public/manifest.webmanifest'));
    expect(manifest.name).toContain('quizzOne');
    expect(manifest.short_name).toBe('quizzOne');
  });

  it('non lascia il vecchio nome nei testi di TV, telefono e regia', () => {
    for (const path of [
      'src/app/features/tv/game.component.html',
      'src/app/features/remote/remote.component.html',
      'src/app/features/admin/admin.component.html',
    ]) {
      const text = read(path);
      expect(text, path).not.toMatch(/Pub\s*Game/i);
      expect(text, path).not.toContain('PUB GAME');
    }
  });

  it('non rinomina le chiavi di archiviazione tecniche', () => {
    const theme = read('src/app/core/services/theme.service.ts');
    expect(theme).toContain("'pubgame-theme'");
    expect(theme).toContain("'pubgame-xmas'");
  });
});
