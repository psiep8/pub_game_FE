import { PlayerAvatarService } from './player-avatar.service';

const AVATAR = `data:image/png;base64,${'A'.repeat(120)}`;

describe('PlayerAvatarService', () => {
  let service: PlayerAvatarService;

  beforeEach(() => {
    localStorage.clear();
    service = new PlayerAvatarService();
  });

  it('sposta l’avatar sul nuovo nome della squadra', () => {
    service.setAvatar('Anna', AVATAR);

    service.rename('Anna', 'Anna Sofia');

    expect(service.avatarFor('Anna Sofia')).toBe(AVATAR);
    expect(service.avatarFor('Anna')).toBeNull();
  });

  it('conserva l’avatar anche dopo un refresh della TV', () => {
    service.setAvatar('Anna', AVATAR);
    service.rename('Anna', 'Anna Sofia');

    expect(new PlayerAvatarService().avatarFor('Anna Sofia')).toBe(AVATAR);
  });

  it('non fa nulla se il vecchio nome non ha avatar o i nomi coincidono', () => {
    service.setAvatar('Anna', AVATAR);

    service.rename('Bruno', 'Bruno Nuovo');
    service.rename('Anna', 'Anna');

    expect(service.avatarFor('Anna')).toBe(AVATAR);
    expect(service.avatarFor('Bruno Nuovo')).toBeNull();
  });
});
