import { Routes } from '@angular/router';
import {GameComponent} from './components/game-component/game-component';
import {MobileOnlyGuard} from './guard/mobile-only.guard';
import {DesktopOnlyGuard} from './guard/desktop-only.guard';
import {RemoteComponent} from './components/remote-component/remote-component';
import {Admin} from './components/admin/admin';
import {BasketBonus} from './components/basket-bonus/basket-bonus';
import {BonusPreview} from './components/bonus/bonus-preview/bonus-preview';

export const routes: Routes = [
  {
    path: 'tv',
    component: GameComponent,
    canActivate: [DesktopOnlyGuard]
  },
  {
    path: 'play',
    component: RemoteComponent,
    canActivate: [MobileOnlyGuard]
  },
  {
    path: 'admin',
    component: Admin
  },
  {
    path: 'basket',
    component: BasketBonus
  },
  {
    path: 'bonus-preview',
    component: BonusPreview
  },
  {
    path: 'bonus-preview/:type',
    component: BonusPreview
  },
  { path: '', redirectTo: 'tv', pathMatch: 'full' }
];
