import type { AppEnvironment } from './environment.types';

/**
 * Produzione nel pub: un solo dominio serve frontend, API e WebSocket.
 * Diagnostica spenta: niente pannelli di debug davanti ai giocatori.
 */
const origin = typeof window !== 'undefined' ? window.location.origin : '';
const wsProtocol =
  typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsHost = typeof window !== 'undefined' ? window.location.host : '';

export const environment: AppEnvironment = {
  profile: 'production',
  diagnostics: false,
  apiUrl: '',
  wsUrl: wsHost ? `${wsProtocol}//${wsHost}/ws-pubgame` : '',
  frontendUrl: origin,
};
