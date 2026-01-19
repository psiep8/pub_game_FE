import { Routes } from '@angular/router';
import {RemoteComponent} from './components/remote-component/remote-component';
import {App} from './app';
import {GameComponent} from './components/game-component/game-component';

export const routes: Routes = [
  { path: 'tv', component: GameComponent },
  { path: 'play', component: RemoteComponent },
  { path: '', redirectTo: 'tv', pathMatch: 'full' }
];
