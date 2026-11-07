/**
 * Stato del telefono durante un round: dice al giocatore cosa sta succedendo
 * senza doverlo dedurre dai messaggi WebSocket.
 *
 * Sono `as const` e non `enum` per restare assegnabili dalle stringhe che
 * arrivano dal server.
 */
export const PlayerStatus = {
  /** In attesa: nessuna domanda aperta. */
  WAITING: 'WAITING',
  /** Può votare o rispondere. */
  VOTING: 'VOTING',
  /** Ha risposto, il server ha accettato. */
  LOCKED: 'LOCKED',
  /** Ha risposto, aspetta gli altri tavoli. */
  WAITING_FOR_OTHER: 'WAITING_FOR_OTHER',
  /** Round bloccato da un errore: la risposta non è stata registrata. */
  BLOCKED_ERROR: 'BLOCKED_ERROR',
  /** Fuori dal Time Buzzer: ha tagliato troppo presto o troppo tardi. */
  BUZZ_OUT: 'BUZZ_OUT',
  /** Fuori dall'Arena. */
  ELIMINATED: 'ELIMINATED',
} as const;

export type PlayerStatus = (typeof PlayerStatus)[keyof typeof PlayerStatus];
