import { Router } from "@angular/router";
import {DeviceService} from '../services/device.service';
import {Injectable} from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MobileOnlyGuard {
  constructor(private device: DeviceService, private router: Router) {}

  canActivate(): boolean {
    if (this.device.isDesktop()) {
      console.log('❌ Desktop detected, redirecting to /tv');
      this.router.navigate(['/tv']);
      return false;
    }
    console.log('✅ Mobile/Tablet detected, allowing /play');
    return true;
  }
}
