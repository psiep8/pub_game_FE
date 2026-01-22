import {DeviceService} from '../services/device.service';
import {Router} from '@angular/router';
import {Injectable} from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MobileOnlyGuard {
  constructor(private device: DeviceService, private router: Router) {}

  canActivate(): boolean {
    if (!this.device.isMobile()) {
      this.router.navigate(['/tv']);
      return false;
    }
    return true;
  }
}
