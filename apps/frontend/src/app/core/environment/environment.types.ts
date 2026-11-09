/** Profilo attivo: locale, serata di prova o pub. */
export type AppProfile = 'local' | 'test-night' | 'production';

/**
 * Configurazione del frontend: URL sempre relativi alla propria origine.
 * I file `environment*.ts` cambiano solo profilo e diagnostica.
 */
export interface AppEnvironment {
  /** Ambiente attivo: locale, serata di prova o pub. */
  profile: AppProfile;
  /** Mostra log e pannelli diagnostici: spento in produzione. */
  diagnostics: boolean;
  /** Base delle API REST: relativa, così vale per qualunque host e porta. */
  apiUrl: string;
  /** WebSocket STOMP/SockJS: stessa origine, inoltrata dal reverse proxy. */
  wsUrl: string;
  /** URL pubblico del frontend (QR code, link ai telefoni). */
  frontendUrl: string;
}
