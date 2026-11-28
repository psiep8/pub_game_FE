import { Routes } from '@angular/router';
import { DesktopOnlyGuard } from './core/guards/desktop-only.guard';
import { MobileOnlyGuard } from './core/guards/mobile-only.guard';

/**
 * Route lazy: ogni schermata arriva nel suo chunk, quindi la TV non scarica
 * il pannello admin e il telefono non scarica i componenti della TV.
 */
const tv = () => import('./features/tv/game.component').then((module) => module.GameComponent);
const remote = () => import('./features/remote/remote.component').then((module) => module.RemoteComponent);
const admin = () => import('./features/admin/admin.component').then((module) => module.Admin);
const bonusPreview = () =>
  import('./features/bonus/preview/bonus-preview.component').then((module) => module.BonusPreview);
const audioLab = () => import('./features/audio/audio-lab.component').then((module) => module.AudioLab);
const credits = () => import('./features/credits/credits.component').then((module) => module.Credits);
const setteEMezzo = () =>
  import('./features/games/sette-e-mezzo/sette-e-mezzo-game.component')
    .then((module) => module.SetteEMezzoGameComponent);

export const routes: Routes = [
  {
    path: 'tv',
    loadComponent: tv,
    canActivate: [DesktopOnlyGuard]
  },
  {
    path: 'play',
    loadComponent: remote,
    canActivate: [MobileOnlyGuard]
  },
  {
    path: 'admin',
    loadComponent: admin
  },
  {
    path: 'audio',
    loadComponent: audioLab
  },
  {
    path: 'crediti',
    loadComponent: credits
  },
  {
    path: 'sette-e-mezzo',
    loadComponent: setteEMezzo
  },
  {
    path: 'bonus-preview',
    loadComponent: bonusPreview
  },
  {
    path: 'bonus-preview/:type',
    loadComponent: bonusPreview
  },
  { path: '', redirectTo: 'tv', pathMatch: 'full' }
];
