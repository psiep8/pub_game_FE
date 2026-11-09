import {Component, ChangeDetectionStrategy, inject} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {ThemeService} from './core/services/theme.service';
import { SnowComponent } from './shared/components/snow/snow.component';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  imports: [
    RouterOutlet,
    SnowComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.component.css',

})

export class App {
  readonly theme = inject(ThemeService);

  /** Nevischio leggero: poche gocce, velocità diverse, nessun rumore visivo. */
  readonly flakes = Array.from({ length: 26 }, (_, index) => ({
    left: (index * 37) % 100,
    delay: (index % 9) * 0.7,
    duration: 9 + (index % 6) * 1.6,
    size: 6 + (index % 4) * 2,
    opacity: 0.3 + (index % 4) * 0.12,
  }));
}
