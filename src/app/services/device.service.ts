import {Injectable} from '@angular/core';

@Injectable({providedIn: 'root'})
export class DeviceService {
  isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
}
