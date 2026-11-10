import { of } from 'rxjs';
import { ButtonTestSnapshot } from '../../core/services/button-test.service';

/** Nessuna rete: la prova risulta già completata e non blocca i test esistenti. */
export class FakeButtonTestService {
  readonly empty: ButtonTestSnapshot = {
    active: true,
    steps: 5,
    targetIndex: 1,
    targetLabel: 'B',
    allReady: false,
    startedAt: 0,
    teams: [],
  };

  snapshot() {
    return of(this.empty);
  }

  me() {
    return of({
      playerName: 'Test',
      completedSteps: 5,
      nextStep: 5,
      done: [true, true, true, true, true],
      latencyMs: 12,
      vibrated: true,
      flagged: false,
      skipped: false,
      completed: true,
      updatedAt: 0,
      steps: 5,
      targetLabel: 'B',
    });
  }

  step() {
    return this.me();
  }

  ping() {
    return of({ serverTime: Date.now(), clientAt: Date.now() });
  }

  start() {
    return of(this.empty);
  }

  reset() {
    return of({
      playerName: 'Test',
      completedSteps: 0,
      nextStep: 1,
      done: [false, false, false, false, false],
      latencyMs: -1,
      vibrated: null,
      flagged: false,
      skipped: false,
      completed: false,
      updatedAt: 0,
    });
  }

  skip() {
    return of(this.empty);
  }

  finish() {
    return of(this.empty);
  }
}
