import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  isMobile(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();

    
    const isIPad = /ipad/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    
    const isOtherMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

    
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    
    const isSmallScreen = window.innerWidth <= 1024;

    return isIPad || isOtherMobile || (hasTouch && isSmallScreen);
  }

  isDesktop(): boolean {
    return !this.isMobile();
  }

  getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIPad = /ipad/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIPad) return 'tablet';

    if (this.isMobile()) return 'mobile';

    return 'desktop';
  }
}
