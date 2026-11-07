import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DeviceService } from '../services/device.service';

@Injectable({ providedIn: 'root' })
export class MobileOnlyGuard {
  private device = inject(DeviceService);
  private router = inject(Router);

  canActivate(): boolean {
    if (this.device.isDesktop()) {
      this.router.navigate(['/tv']);
      return false;
    }

    return true;
  }
}
