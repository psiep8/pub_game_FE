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

  it('libera anche la palette scelta e la ridà al rientro', () => {
    service.setTeamTheme('Anna', 'kpop-aesthetic');

    service.releaseTeamTheme('Anna');

    expect(service.themeForTeam('Anna')).toBe('editorial-acid');
    expect(service.ensureTeamTheme('Anna')).toBe('kpop-aesthetic');
  });

  it('la palette scelta e liberata torna disponibile per un\'altra squadra', () => {
    service.setTeamTheme('Anna', 'kpop-aesthetic');
    service.releaseTeamTheme('Anna');

    // Le sette palette libere finiscono alle sette squadre: K-POP rientra nel giro.
    const taken = Array.from({ length: 7 }, (_, index) => service.ensureTeamTheme(`Squadra ${index}`));
    expect(taken).toContain('kpop-aesthetic');

    const anna = service.ensureTeamTheme('Anna');
    expect(anna).not.toBe('kpop-aesthetic');
    // Anche questa seconda palette resta sua ai rientri successivi.
    service.releaseTeamTheme('Anna');
    expect(service.ensureTeamTheme('Anna')).toBe(anna);
  });

  it('la squadra espulsa rientra con la stessa palette', () => {
    const anna = service.ensureTeamTheme('Anna');

    service.releaseTeamTheme('Anna');

    expect(service.ensureTeamTheme('Anna')).toBe(anna);
  });

  it('se la palette è occupata, il rientro ne riceve una libera e la ricorda', () => {
    const anna = service.ensureTeamTheme('Anna');
    service.releaseTeamTheme('Anna');
    // Carla entra prima del rientro e prende la palette liberata.
    expect(service.ensureTeamTheme('Carla')).toBe(anna);

    const again = service.ensureTeamTheme('Anna');
    expect(again).not.toBe(anna);

    // La nuova palette resta la sua anche al rientro successivo.
    service.releaseTeamTheme('Anna');
    expect(service.ensureTeamTheme('Anna')).toBe(again);
  });

  it('la memoria delle palette sopravvive al refresh della TV', () => {
    const anna = service.ensureTeamTheme('Anna');
    service.releaseTeamTheme('Anna');

    const reloaded = new ThemeService();

    expect(reloaded.ensureTeamTheme('Anna')).toBe(anna);
  });

  it('sposta la palette sul nuovo nome della stessa squadra', () => {
    const anna = service.ensureTeamTheme('Anna');

    expect(service.renameTeam('Anna', 'Anna Sofia')).toBe(true);

    expect(service.themeForTeam('Anna')).toBe('editorial-acid');
    expect(service.themeForTeam('Anna Sofia')).toBe(anna);
  });

  it('sposta anche la palette scelta e la sua memoria', () => {
    service.setTeamTheme('Anna', 'kpop-aesthetic');

    service.renameTeam('Anna', 'Anna Sofia');

    expect(service.themeForTeam('Anna Sofia')).toBe('kpop-aesthetic');
    // Anche dopo un refresh della TV il nuovo nome tiene la scelta.
    expect(new ThemeService().themeForTeam('Anna Sofia')).toBe('kpop-aesthetic');
  });

  it('un nome nuovo è una squadra nuova, con una palette libera e distinta', () => {
    const anna = service.ensureTeamTheme('Anna');

    const renamed = service.ensureTeamTheme('Anna Sofia');

    expect(renamed).not.toBe(anna);
    expect(service.themeForTeam('Anna')).toBe(anna);
  });

  it('la nuova partita azzera palette assegnate e scelte', () => {
    service.ensureTeamTheme('Anna');
    service.setTeamTheme('Bruno', 'kpop-aesthetic');

    service.resetTeamThemes();

    expect(service.themeForTeam('Anna')).toBe('editorial-acid');
    expect(service.themeForTeam('Bruno')).toBe('editorial-acid');
    expect(service.ensureTeamTheme('Carla')).toBe('desert-heritage');
  });

  it('la scelta del telefono sopravvive al refresh della TV', () => {
    service.setTeamTheme('Anna', 'kpop-aesthetic');

    const reloaded = new ThemeService();

    expect(reloaded.themeForTeam('Anna')).toBe('kpop-aesthetic');
    // Anche dopo il reload la palette scelta resta fuori dal giro.
    expect(reloaded.ensureTeamTheme('Bruno')).not.toBe('kpop-aesthetic');
  });

  it('la scelta salvata viene azzerata dalla partita nuova', () => {
    service.setTeamTheme('Anna', 'kpop-aesthetic');

    service.resetTeamThemes();
    const reloaded = new ThemeService();

    expect(reloaded.themeForTeam('Anna')).toBe('editorial-acid');
  });

  it('le palette assegnate sopravvivono al refresh della TV', () => {
    const assigned = service.ensureTeamTheme('Anna');

    const reloaded = new ThemeService();

    expect(reloaded.themeForTeam('Anna')).toBe(assigned);
    expect(THEMES).toContain(reloaded.themeForTeam('Anna'));
  });
});
