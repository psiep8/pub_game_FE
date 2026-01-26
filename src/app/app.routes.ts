import { Routes } from '@angular/router';
import {GameComponent} from './components/game-component/game-component';
import {MobileOnlyGuard} from './guard/mobile-only.guard';
import {DesktopOnlyGuard} from './guard/desktop-only.guard';
import {RemoteComponent} from './components/remote-component/remote-component';

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
    component: RemoteComponent,
    canActivate: [MobileOnlyGuard]
  },
  { path: '', redirectTo: 'tv', pathMatch: 'full' }
];
