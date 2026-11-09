import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
} from '@angular/core';
import {provideRouter, withViewTransitions} from '@angular/router';

import {routes} from './app.routes';
import {provideServiceWorker} from '@angular/service-worker';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {provideHttpClient, withXhr, withInterceptors, HttpInterceptorFn} from '@angular/common/http';
import { inject } from '@angular/core';
import { ReliabilityService } from './core/services/reliability.service';

const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/games') && !request.url.startsWith('/categories') && !request.url.startsWith('/questions')) return next(request);
  if (/\/games\/\d+\/session$/.test(request.url)) return next(request);
  const token = inject(ReliabilityService).sessionToken();
  return next(token ? request.clone({ setHeaders: { 'X-Session-Token': token } }) : request);
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Transizioni tra schermate native del browser; se non supportate resta il
    // fallback CSS (router-outlet + *).
    provideRouter(routes, withViewTransitions()),
    provideHttpClient(withXhr(), withInterceptors([sessionInterceptor])),
    provideAnimationsAsync(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately'
    })
  ]
};
