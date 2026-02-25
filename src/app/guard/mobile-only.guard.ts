import { Router } from "@angular/router";
import {DeviceService} from '../services/device.service';
import {Injectable} from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MobileOnlyGuard {
  constructor(private device: DeviceService, private router: Router) {}

  canActivate(): boolean {
    if (this.device.isDesktop()) {
      
      this.router.navigate(['/tv']);
      return false;
    }
    
    return true;
  }
}
