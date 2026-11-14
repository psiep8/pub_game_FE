import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DeviceService } from '../services/device.service';

@Injectable({ providedIn: 'root' })
export class DesktopOnlyGuard {
  private device = inject(DeviceService);
  private router = inject(Router);

  canActivate(): boolean {
    if (this.device.isMobile()) {
      // replaceUrl evita che ogni rimbalzo finisca nella cronologia Safari.
      if (!this.router.url.startsWith('/play')) {
        void this.router.navigate(['/play'], { replaceUrl: true });
      }
      return false;
    }

    return true;
  }
}
