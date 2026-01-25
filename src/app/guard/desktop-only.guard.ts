import {DeviceService} from '../services/device.service';
import {Router} from '@angular/router';
import {Injectable} from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DesktopOnlyGuard {
  constructor(private device: DeviceService, private router: Router) {}

  canActivate(): boolean {
    if (this.device.isMobile()) {
      console.log('❌ Mobile/Tablet detected, redirecting to /play');
      this.router.navigate(['/play']);
      return false;
    }
    console.log('✅ Desktop detected, allowing /tv');
    return true;
  }
}
