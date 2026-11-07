import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DeviceService } from '../services/device.service';

@Injectable({ providedIn: 'root' })
export class DesktopOnlyGuard {
  private device = inject(DeviceService);
  private router = inject(Router);

  canActivate(): boolean {
    if (this.device.isMobile()) {
      this.router.navigate(['/play']);
      return false;
    }

    return true;
  }
}
