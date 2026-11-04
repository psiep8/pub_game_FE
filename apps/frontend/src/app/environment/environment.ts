/**
 * Configurazione unica del frontend: nessun IP e nessuna porta scritti a mano.
 *
 * L'app chiama sempre la propria origine (`apiUrl` relativo):
 * - in sviluppo il dev-server Angular fa da proxy verso il backend (`proxy.conf.mjs`);
 * - quindi `npm run dev` funziona da localhost, dalla LAN (telefono) e via tunnel,
 *   senza modificare file quando cambia la rete o la macchina;
 * - `frontendUrl` segue l'host con cui il browser ha aperto la pagina, così il QR
 *   code punta automaticamente all'IP giusto.
 */
const origin = typeof window !== 'undefined' ? window.location.origin : '';

export const environment = {
  /** Base delle API REST: relativa, così vale per qualunque host e porta. */
  apiUrl: '',
  /** WebSocket STOMP/SockJS: stessa origine, inoltrata dal proxy in sviluppo. */
  wsUrl: `${origin}/ws-pubgame`,
  /** URL pubblico del frontend (QR code, link ai telefoni). */
  frontendUrl: origin
};
