import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';

/**
 * Nevischio leggero del tema di Natale.
 *
 * Sta sopra qualunque schermata ma non intercetta i tocchi; si ferma quando la
 * scheda non è visibile e rispetta `prefers-reduced-motion`.
 */
@Component({
  selector: 'app-snow',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (theme.xmas()) {
      <div class="snow" [class.paused]="!visible()" aria-hidden="true">
        @for (flake of flakes; track $index) {
          <span
            [style.left.%]="flake.left"
            [style.width.px]="flake.size"
            [style.height.px]="flake.size"
            [style.animation-delay.s]="-flake.delay"
            [style.animation-duration.s]="flake.duration"
            [style.opacity]="flake.opacity">
          </span>
        }
      </div>
    }
  `,
  styles: [`
    .snow {
      position: fixed;
      inset: 0;
      z-index: 85;
      overflow: hidden;
      pointer-events: none;
    }
    .snow span {
      position: absolute;
      top: -12px;
      display: block;
      border-radius: 50%;
      background: var(--paper-hi);
      animation-name: snow-fall;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
    }
    .snow.paused span { animation-play-state: paused; }
    @keyframes snow-fall {
      from { transform: translate3d(0, -10vh, 0); }
      to { transform: translate3d(18px, 110vh, 0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .snow { display: none; }
    }
  `],
})
export class SnowComponent {
  readonly theme = inject(ThemeService);
  readonly visible = signal(typeof document === 'undefined' ? true : !document.hidden);

  /** Pochi fiocchi, deterministici: niente lavoro inutile a ogni frame. */
  readonly flakes = Array.from({ length: 34 }, (_, index) => ({
    left: (index * 29 + 7) % 100,
    size: 3 + (index % 4),
    delay: (index % 11) * 0.8,
    duration: 8 + (index % 6) * 1.4,
    opacity: 0.45 + (index % 4) * 0.1,
  }));

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    this.visible.set(!document.hidden);
  }
}
