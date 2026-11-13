import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonTestService } from '../../../core/services/button-test.service';
import { WebSocketService } from '../../../core/websocket/web-socket.service';
import { WsAction } from '../../../shared/enums/ws-action';

const CARD_LABELS = ['A', 'B', 'C'];

/**
 * Prova rapida del telefono: tocco, scelta, trascinamento, vibrazione e
 * collegamento. I passi superati restano sul server, così un reload riprende
 * dal punto giusto invece di ricominciare.
 */
@Component({
  selector: 'app-button-test',
  standalone: true,
  templateUrl: './button-test.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './button-test.component.css',
})
export class ButtonTestComponent implements OnInit, OnDestroy {
  readonly gameId = input.required<number>();
  readonly done = output<void>();

  private readonly tests = inject(ButtonTestService);
  private readonly ws = inject(WebSocketService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly step = signal(1);
  readonly steps = signal(5);
  readonly doneSteps = signal<boolean[]>([false, false, false, false, false]);
  readonly targetIndex = signal(1);
  readonly targetLabel = signal('B');
  readonly secondsLeft = signal(15);
  readonly message = signal('');
  readonly latency = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly cards = signal([2, 0, 1]);
  readonly dragIndex = signal<number | null>(null);
  readonly dropIndex = signal<number | null>(null);
  /** Spostamento del dito: la carta segue il trascinamento, non salta al rilascio. */
  readonly dragOffset = signal<{ x: number; y: number } | null>(null);
  private dragStart: { x: number; y: number } | null = null;
  readonly cardLabels = CARD_LABELS;

  private stepTimer?: ReturnType<typeof setInterval>;
  private pollTimer?: ReturnType<typeof setInterval>;
  private advanceTimer?: ReturnType<typeof setTimeout>;
  private connectionDone = false;
  private advancing = false;

  ngOnInit(): void {
    this.loadMe();
    this.pollTimer = setInterval(() => this.refreshFromServer(), 3000);
    this.ws.status$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status: any) => {
        if (status?.action !== WsAction.BUTTON_TEST_PING || this.step() !== 5) return;
        const at = Number(status.at);
        if (!Number.isFinite(at)) return;
        this.completeConnection(Math.max(0, Date.now() - at));
      });
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  retry(): void {
    this.error.set(null);
    this.loadMe();
  }

  advance(step: number, extra: { vibrated?: boolean; latencyMs?: number; flagged?: boolean } = {}): void {
    if (this.advancing || step !== this.step()) return;
    this.advancing = true;
    this.clearStepTimer();
    this.tests
      .step(this.gameId(), { step, ...extra })
      .subscribe({
        next: (team) => {
          this.doneSteps.set(team.done ?? this.doneSteps());
          this.advancing = false;
          this.cdr.detectChanges();
          if (team.completed) {
            this.finish();
            return;
          }
          this.enterStep(Math.min(this.steps(), team.nextStep));
        },
        error: () => {
          this.advancing = false;
          this.error.set('Passo non registrato: riprova.');
          this.startStepTimer();
        },
      });
  }

  choose(index: number): void {
    if (index === this.targetIndex()) {
      this.message.set('Scelta corretta');
      this.advance(2);
    } else {
      this.message.set(`Sulla TV è indicata la lettera ${this.targetLabel()}`);
    }
  }

  startDrag(index: number, event?: PointerEvent): void {
    this.dragIndex.set(index);
    this.dropIndex.set(index);
    this.dragStart = event ? { x: event.clientX, y: event.clientY } : null;
    this.dragOffset.set({ x: 0, y: 0 });
    this.vibrate();
    const target = event?.currentTarget as HTMLElement | null | undefined;
    if (event && target?.setPointerCapture) target.setPointerCapture(event.pointerId);
  }

  onDragMove(event: PointerEvent): void {
    if (this.dragIndex() === null) return;
    if (this.dragStart) {
      this.dragOffset.set({
        x: event.clientX - this.dragStart.x,
        y: event.clientY - this.dragStart.y,
      });
    }
    const target = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-card-index]');
    const index = Number(target?.dataset['cardIndex']);
    if (Number.isInteger(index)) this.dropIndex.set(index);
  }

  endDrag(): void {
    const target = this.dropIndex();
    this.dropIndex.set(null);
    this.dragStart = null;
    this.dragOffset.set(null);
    if (target !== null) this.drop(target);
  }

  /** Trasformazione della carta mentre il dito la trascina. */
  dragTransform(index: number): string | null {
    const offset = this.dragOffset();
    if (this.dragIndex() !== index || !offset) return null;
    return `translate(${offset.x}px, ${offset.y}px)`;
  }

  /** Vibrazione chiesta dal giocatore: parte da un tocco, quindi è permessa. */
  vibrateNow(): void {
    this.vibrate();
    this.message.set('Vibrazione inviata');
  }

  drop(index: number): void {
    const from = this.dragIndex();
    this.dragIndex.set(null);
    if (from === null || from === index) return;
    const next = [...this.cards()];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    this.cards.set(next);
    if (next.every((value, position) => value === position)) {
      this.message.set('Ordine corretto');
      this.advanceTimer = setTimeout(() => this.advance(3), 350);
    }
  }

  vibration(answer: boolean): void {
    this.advance(4, { vibrated: answer });
  }

  private loadMe(): void {
    this.tests.me(this.gameId()).subscribe({
      next: (team) => {
        this.applyTeam(team);
      },
      error: () => {
        this.error.set('Prova non disponibile: controlla la connessione e riprova.');
      },
    });
  }

  private refreshFromServer(): void {
    if (this.error()) return;
    this.tests.me(this.gameId()).subscribe({
      next: (team) => {
        if (team.completed) {
          this.finish();
          return;
        }
        if (team.nextStep !== this.step()) this.applyTeam(team);
      },
      error: () => {
        // Un poll perso non deve interrompere la prova già aperta.
      },
    });
  }

  private applyTeam(team: {
    done: boolean[];
    completedSteps: number;
    nextStep: number;
    completed: boolean;
    targetLabel: string;
    steps: number;
  }): void {
    this.steps.set(team.steps ?? 5);
    this.targetLabel.set(team.targetLabel ?? 'B');
    this.targetIndex.set(Math.max(0, (team.targetLabel ?? 'B').charCodeAt(0) - 65));
    this.doneSteps.set(team.done ?? this.doneSteps());
    if (team.completed) {
      this.finish();
      return;
    }
    if (!this.error()) this.enterStep(Math.max(1, Math.min(this.steps(), team.nextStep)));
  }

  private enterStep(step: number): void {
    this.step.set(step);
    this.message.set('');
    this.secondsLeft.set(15);
    this.connectionDone = false;
    if (step === 3) this.cards.set([2, 0, 1]);
    if (step === 4) this.vibrate();
    this.startStepTimer();
    if (step === 5) this.startConnection();
    this.cdr.detectChanges();
  }

  private startStepTimer(): void {
    this.clearStepTimer();
    const deadline = Date.now() + 15_000;
    this.stepTimer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      this.secondsLeft.set(left);
      this.cdr.detectChanges();
      if (left === 0) {
        this.clearStepTimer();
        this.message.set('Da controllare');
        this.advance(this.step(), { flagged: true });
      }
    }, 250);
  }

  private startConnection(): void {
    this.message.set('Collegamento in corso...');
    const startedAt = Date.now();
    this.tests.ping(this.gameId(), startedAt).subscribe({
      next: () => this.completeConnection(Date.now() - startedAt),
      error: () => this.message.set('In attesa del segnale della TV...'),
    });
  }

  private completeConnection(latencyMs: number): void {
    if (this.step() !== 5 || this.connectionDone || this.advancing) return;
    this.connectionDone = true;
    this.latency.set(Math.max(0, Math.round(latencyMs)));
    this.message.set(`Collegamento verificato · ${this.latency()} ms`);
    this.advanceTimer = setTimeout(() => this.advance(5, { latencyMs: this.latency() ?? 0 }), 700);
  }

  private vibrate(): void {
    try {
      if ('vibrate' in navigator) navigator.vibrate(160);
    } catch {
      // La vibrazione è facoltativa: la prova passa comunque.
    }
  }

  private finish(): void {
    this.clearTimers();
    this.done.emit();
  }

  private clearStepTimer(): void {
    if (this.stepTimer) clearInterval(this.stepTimer);
    this.stepTimer = undefined;
  }

  private clearTimers(): void {
    this.clearStepTimer();
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.advanceTimer) clearTimeout(this.advanceTimer);
    this.pollTimer = undefined;
    this.advanceTimer = undefined;
  }
}
