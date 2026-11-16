import { TestBed } from '@angular/core/testing';

import { THEMES, ThemeService } from './theme.service';

describe('ThemeService — palette di squadra', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('assegna palette diverse alle prime otto squadre', () => {
    const names = ['Anna', 'Bruno', 'Carla', 'Dario', 'Elena', 'Fabio', 'Giorgia', 'Ivan'];
    const palettes = names.map((name) => service.ensureTeamTheme(name));

    expect(new Set(palettes).size).toBe(8);
    // L'acido resta l'ultimo: la prima squadra non ha il colore neutro della TV.
    expect(service.themeForTeam('Anna')).not.toBe('editorial-acid');
  });

  it('oltre otto squadre riparte il giro delle palette', () => {
    for (let index = 0; index < 9; index += 1) {
      service.ensureTeamTheme(`Squadra ${index}`);
    }

    expect(service.themeForTeam('Squadra 8')).toBe(service.themeForTeam('Squadra 0'));
  });

  it('la stessa squadra tiene la palette che le è stata data', () => {
    const first = service.ensureTeamTheme('Anna');
    const second = service.ensureTeamTheme('Anna');

    expect(second).toBe(first);
    // Chiamarla di nuovo non consuma una palette nuova.
    expect(service.themeForTeam('Bruno')).not.toBe(first);
  });

  it('una scelta esplicita prende il posto della palette assegnata', () => {
    service.ensureTeamTheme('Anna');
    service.setTeamTheme('Anna', 'kpop-aesthetic');

    expect(service.themeForTeam('Anna')).toBe('kpop-aesthetic');
    // La palette liberata torna disponibile alla squadra dopo.
    expect(service.ensureTeamTheme('Bruno')).not.toBe('kpop-aesthetic');
  });

  it('una scelta fatta prima dell’ingresso resta quella della squadra', () => {
    service.setTeamTheme('Carla', 'sunset-pop');

    expect(service.ensureTeamTheme('Carla')).toBe('sunset-pop');
    expect(service.themeForTeam('Carla')).toBe('sunset-pop');
  });

  it('una squadra mai vista e senza scelta resta in acido', () => {
    expect(service.themeForTeam('Nessuno')).toBe('editorial-acid');
    expect(service.ensureTeamTheme('   ')).toBe('editorial-acid');
  });

  it('libera la palette assegnata quando la squadra viene espulsa', () => {
    const names = ['Anna', 'Bruno', 'Carla', 'Dario', 'Elena', 'Fabio', 'Giorgia', 'Ivan'];
    names.forEach((name) => service.ensureTeamTheme(name));
    const anna = service.themeForTeam('Anna');

    service.releaseTeamTheme('Anna');

    expect(service.themeForTeam('Anna')).toBe('editorial-acid');
    // La palette liberata torna disponibile alla prima squadra che entra.
    expect(service.ensureTeamTheme('Nuova')).toBe(anna);
  });

  it('la nuova partita azzera palette assegnate e scelte', () => {
    service.ensureTeamTheme('Anna');
    service.setTeamTheme('Bruno', 'kpop-aesthetic');

    service.resetTeamThemes();

    expect(service.themeForTeam('Anna')).toBe('editorial-acid');
    expect(service.themeForTeam('Bruno')).toBe('editorial-acid');
    expect(service.ensureTeamTheme('Carla')).toBe('desert-heritage');
  });

  it('le palette assegnate sopravvivono al refresh della TV', () => {
    const assigned = service.ensureTeamTheme('Anna');

    const reloaded = new ThemeService();

    expect(reloaded.themeForTeam('Anna')).toBe(assigned);
    expect(THEMES).toContain(reloaded.themeForTeam('Anna'));
  });
});
