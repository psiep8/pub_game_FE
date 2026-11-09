import type { AppEnvironment } from './environment.types';

/**
 * Serata di prova: TV e telefoni sulla stessa rete (LAN o tunnel HTTPS).
 * Diagnostica accesa, così un problema di sessione si vede subito in TV.
 */
const origin = typeof window !== 'undefined' ? window.location.origin : '';
const wsProtocol =
  typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsHost = typeof window !== 'undefined' ? window.location.host : '';

export const environment: AppEnvironment = {
  profile: 'test-night',
  diagnostics: true,
  apiUrl: '',
  wsUrl: wsHost ? `${wsProtocol}//${wsHost}/ws-pubgame` : '',
  frontendUrl: origin,
};
