import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';

import { RECAP_PAGE_MS, recapDurationMs, recapPages, type RecapRow } from './round-recap-model';

/**
 * Riepilogo di fine round, condiviso da tutti i giochi (N-11).
 *
 * <p>Mostra i punti fatti nel round dal peggiore al migliore, a pagine ferme
 * tre secondi; l'ultima pagina è il podio. Non decide nulla: quando ha finito
 * emette `onComplete`, e la regia riparte da lì (bonus, classifica o attesa).</p>
 *
 * <p>La pausa della sala (ESC in regia) ferma anche il riepilogo: il tempo che
 * resta alla pagina e alla scena si conserva, e alla ripresa il conto riparte
 * da lì invece di saltare avanti.</p>
 */
@Component({
  selector: 'app-round-recap',
  standalone: true,
  templateUrl: './round-recap.component.html',
  styleUrl: './round-recap.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoundRecap implements OnInit, OnDestroy {
  /** Righe già ordinate dal modello: `recapRows`. */
  @Input() rows: RecapRow[] = [];
  /** Intestazione breve, per esempio «ROUND 12 · QUIZ». */
  @Input() label = '';

  @Output() readonly onComplete = new EventEmitter<void>();

  readonly pages = signal<RecapRow[][]>([]);
  readonly pageIndex = signal(0);
  readonly lastPage = computed(() => Math.max(0, this.pages().length - 1));
  readonly isPodium = computed(() => this.pages().length > 0 && this.pageIndex() === this.lastPage());

  /** Pausa della sala: il riepilogo si ferma e riprende da dove era. */
  @Input()
  set paused(value: boolean) {
    const next = !!value;
    if (next === this.pausedState) return;
    this.pausedState = next;
    // Il timbro PAUSA vive nel template: con OnPush va ridisegnato anche
    // quando la pausa arriva da un test o da un comando diretto.
    this.cdr.markForCheck();
    if (!this.started) return;
    if (next) this.freeze();
    else this.schedule();
  }

  get paused(): boolean {
    return this.pausedState;
  }

  private readonly cdr = inject(ChangeDetectorRef);
  private pausedState = false;
  private started = false;
  /** Tempo che resta alla pagina corrente e alla scena intera. */
  private pageRemaining: number = RECAP_PAGE_MS;
  private totalRemaining = 0;
  private pageDeadline = 0;
  private doneDeadline = 0;
  private pageTimer?: ReturnType<typeof setTimeout>;
  private doneTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.pages.set(recapPages(this.rows));
    this.totalRemaining = recapDurationMs(this.rows);

    if (!this.pages().length || this.totalRemaining <= 0) {
      this.onComplete.emit();
      return;
    }

    this.started = true;
    // Nata già in pausa (raro: la sala era ferma alla chiusura del round).
    if (!this.pausedState) this.schedule();
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  /** Variazione firmata: `+30`, `−10`, `0`. */
  signedDelta(delta: number): string {
    const value = Math.trunc(Number(delta) || 0);
    if (value === 0) return '0';
    return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
  }

  /** Fa partire i due conti dai tempi che restano. */
  private schedule(): void {
    this.clearTimers();

    if (this.pageIndex() < this.lastPage()) {
      this.pageDeadline = Date.now() + this.pageRemaining;
      this.pageTimer = setTimeout(() => this.nextPage(), this.pageRemaining);
    }

    this.doneDeadline = Date.now() + this.totalRemaining;
    this.doneTimer = setTimeout(() => this.onComplete.emit(), this.totalRemaining);
  }

  /** Il timer esiste solo finché c'è una pagina dopo: qui si avanza sempre. */
  private nextPage(): void {
    this.pageTimer = undefined;
    this.pageIndex.update((index) => Math.min(index + 1, this.lastPage()));
    // Ultima pagina: resta in scena fino alla fine della scena.
    if (this.pageIndex() >= this.lastPage()) return;

    this.pageDeadline = Date.now() + RECAP_PAGE_MS;
    this.pageTimer = setTimeout(() => this.nextPage(), RECAP_PAGE_MS);
  }

  /** Congela i tempi rimasti: alla ripresa si riparte esattamente da lì. */
  private freeze(): void {
    this.clearTimers();
    const now = Date.now();
    this.totalRemaining = Math.max(0, this.doneDeadline - now);
    this.pageRemaining = Math.max(0, this.pageDeadline - now);
  }

  private clearTimers(): void {
    if (this.pageTimer) clearTimeout(this.pageTimer);
    this.pageTimer = undefined;
    if (this.doneTimer) clearTimeout(this.doneTimer);
    this.doneTimer = undefined;
  }
}