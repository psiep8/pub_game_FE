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
const basket = () =>
  import('./features/bonus/basket-legacy/basket-bonus.component').then((module) => module.BasketBonus);
const bonusPreview = () =>
  import('./features/bonus/preview/bonus-preview.component').then((module) => module.BonusPreview);

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
    path: 'basket',
    loadComponent: basket
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
