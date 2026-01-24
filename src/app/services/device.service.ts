import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  isMobile(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();

    // Rileva esplicitamente iPad
    const isIPad = /ipad/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Rileva altri dispositivi mobili
    const isOtherMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

    // Rileva in base al touch
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Rileva in base alle dimensioni dello schermo
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
