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

  it('ritrova lo stato dopo un refresh della TV, poi lo dimentica al round nuovo', () => {
    const before = new WebSocketService();
    before.broadcastStatus(1, {
      action: 'ULTIMA_SPIAGGIA_STATE',
      state: { phase: 'LEVEL', secondsLeft: 6 },
    });
    before.disconnect();

    // Il refresh ricrea il servizio: la fotografia vive nella scheda.
    const refreshed = new WebSocketService();
    expect(refreshed.lastStateFor(1, 'ULTIMA_SPIAGGIA_STATE')).toEqual({
      action: 'ULTIMA_SPIAGGIA_STATE',
      state: { phase: 'LEVEL', secondsLeft: 6 },
    });

    refreshed.clearLastStates();
    refreshed.disconnect();

    const nextRound = new WebSocketService();
    expect(nextRound.lastStateFor(1, 'ULTIMA_SPIAGGIA_STATE')).toBeNull();
    nextRound.disconnect();
  });
});
