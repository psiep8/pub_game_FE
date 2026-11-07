import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DeviceService } from '../services/device.service';

@Injectable({ providedIn: 'root' })
export class MobileOnlyGuard {
  private device = inject(DeviceService);
  private router = inject(Router);

  canActivate(): boolean {
    // La regia quad apre i telefoni in iframe dentro un browser desktop:
    // non c'è touch, ma il pannello è già una vista mobile da provare.
    if (new URLSearchParams(window.location.search).get('quad') === '1') return true;

    if (this.device.isDesktop()) {
      this.router.navigate(['/tv']);
      return false;
    }

    return true;
  }
}
