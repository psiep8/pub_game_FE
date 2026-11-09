/**
 * Configurazione unica del frontend: nessun IP e nessuna porta scritti a mano.
 *
 * L'app chiama sempre la propria origine (`apiUrl` relativo):
 * - in sviluppo il dev-server Angular fa da proxy verso il backend (`proxy.conf.mjs`);
 * - in produzione la stessa origine serve i file statici e inoltra le API al backend
 *   (vedi docs/DEPLOYMENT.md);
 * - `frontendUrl` segue l'host con cui il browser ha aperto la pagina, così il QR
 *   code punta automaticamente all'IP o al dominio giusto.
 *
 * I file `environment.test-night.ts` e `environment.prod.ts` sostituiscono questo
 * in build tramite `fileReplacements` (angular.json).
 */
import type { AppEnvironment } from './environment.types';

export type { AppEnvironment };

const origin = typeof window !== 'undefined' ? window.location.origin : '';
const wsProtocol =
  typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsHost = typeof window !== 'undefined' ? window.location.host : '';

export const environment: AppEnvironment = {
  profile: 'local',
  diagnostics: true,
  apiUrl: '',
  wsUrl: wsHost ? `${wsProtocol}//${wsHost}/ws-pubgame` : '',
  frontendUrl: origin,
};
