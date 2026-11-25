import { readFileSync } from 'node:fs';

/** Q-09: una sola versione leggibile in ogni punto del monorepo. */
const VERSION = '3.0.0';
const read = (path: string): string => readFileSync(path, 'utf8');

describe('versione 3.0.0 coerente', () => {
  it('VERSION è la fonte di verità', () => {
    expect(read('../../VERSION').trim()).toBe(VERSION);
  });

  it('pacchetti npm dichiarano la stessa versione', () => {
    expect(JSON.parse(read('../../package.json')).version).toBe(VERSION);
    expect(JSON.parse(read('../../package-lock.json')).version).toBe(VERSION);
    expect(JSON.parse(read('package.json')).version).toBe(VERSION);
  });

  it('backend, container e avvio locale usano la stessa versione', () => {
    const pom = read('../backend/pom.xml');
    const projectVersion = /<artifactId>pub_game_BE<\/artifactId>\s*<version>([^<]+)<\/version>/.exec(pom);
    expect(projectVersion?.[1]).toBe(VERSION);
    expect(read('../../Dockerfile')).toContain(`pubgame:${VERSION}`);
    expect(read('../../deploy/docker-compose.service.yml')).toContain(`PUBGAME_TAG:-${VERSION}`);
    expect(read('../backend/start-8090.cmd')).toContain(`pub_game_BE-${VERSION}.jar`);
  });

  it('README e presentazione dichiarano 3.0.0', () => {
    expect(read('../../README.md')).toContain(`**${VERSION}**`);
    expect(read('../../PRESENTAZIONE-PUBGAME.md')).toContain(`VERSIONE ${VERSION}`);
  });
});
