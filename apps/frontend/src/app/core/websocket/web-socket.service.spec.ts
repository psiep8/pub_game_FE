import { WebSocketService } from './web-socket.service';

describe('WebSocketService — memoria degli stati', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('ricorda l’ultimo stato del round e lo dimentica al round nuovo', () => {
    const ws = new WebSocketService();

    ws.broadcastStatus(1, { action: 'AZZARDO_STATE', state: { phase: 'BET', secondsLeft: 9 } });
    // Torna il payload intero, pronto da ripubblicare com'era.
    expect(ws.lastStateFor(1, 'AZZARDO_STATE')).toEqual({
      action: 'AZZARDO_STATE',
      state: { phase: 'BET', secondsLeft: 9 },
    });

    // Le azioni dei telefoni non sono stati da ripetere.
    ws.broadcastStatus(1, { action: 'AZZARDO_ACTION', value: 2 });
    expect(ws.lastStateFor(1, 'AZZARDO_ACTION')).toBeNull();

    // La memoria vale solo per la partita che l’ha scritta.
    expect(ws.lastStateFor(2, 'AZZARDO_STATE')).toBeNull();

    // Un round nuovo azzera gli stati del precedente.
    ws.clearLastStates();
    expect(ws.lastStateFor(1, 'AZZARDO_STATE')).toBeNull();

    ws.disconnect();
  });

  it('scrive nello storage solo alla pausa, non a ogni tick', () => {
    const before = new WebSocketService();
    // Un secondo di tick delle Biglie: la fotografia resta in RAM.
    before.broadcastStatus(1, { action: 'BIGLIE_STATE', state: { secondsLeft: 3 } });
    before.broadcastStatus(1, { action: 'BIGLIE_STATE', state: { secondsLeft: 2 } });
    expect(sessionStorage.getItem('pubgame.tv.last-states')).toBeNull();

    // La TV salva quando la sala va in pausa.
    before.persistLastStates();
    before.disconnect();

    // Il refresh ricrea il servizio e ritrova l’ultimo tick, non il primo.
    const refreshed = new WebSocketService();
    expect(refreshed.lastStateFor(1, 'BIGLIE_STATE')).toEqual({
      action: 'BIGLIE_STATE',
      state: { secondsLeft: 2 },
    });

    refreshed.clearLastStates();
    refreshed.disconnect();

    const nextRound = new WebSocketService();
    expect(nextRound.lastStateFor(1, 'BIGLIE_STATE')).toBeNull();
    nextRound.disconnect();
  });
});
