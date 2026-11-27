import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  signal,
} from '@angular/core';

import { RECAP_PAGE_MS, recapDurationMs, recapPages, type RecapRow } from './round-recap-model';

/**
 * Riepilogo di fine round, condiviso da tutti i giochi (N-11).
 *
 * <p>Mostra i punti fatti nel round dal peggiore al migliore, a pagine ferme
 * tre secondi; l'ultima pagina è il podio. Non decide nulla: quando ha finito
 * emette `onComplete`, e la regia riparte da lì (bonus, classifica o attesa).</p>
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
  readonly page = computed<RecapRow[]>(() => this.pages()[this.pageIndex()] ?? []);
  readonly isPodium = computed(() => this.pages().length > 0 && this.pageIndex() === this.lastPage());
  readonly durationMs = computed(() => recapDurationMs(this.rows));

  private pageTimer?: ReturnType<typeof setInterval>;
  private doneTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.pages.set(recapPages(this.rows));

    if (!this.pages().length) {
      this.onComplete.emit();
      return;
    }

    if (this.pages().length > 1) {
      this.pageTimer = setInterval(() => {
        this.pageIndex.update((index) => Math.min(index + 1, this.lastPage()));
        if (this.pageIndex() === this.lastPage()) this.clearPageTimer();
      }, RECAP_PAGE_MS);
    }

    this.doneTimer = setTimeout(() => this.onComplete.emit(), this.durationMs());
  }

  ngOnDestroy(): void {
    this.clearPageTimer();
    if (this.doneTimer) clearTimeout(this.doneTimer);
    this.doneTimer = undefined;
  }

  /** Variazione firmata: `+30`, `−10`, `0`. */
  signedDelta(delta: number): string {
    const value = Math.trunc(Number(delta) || 0);
    if (value === 0) return '0';
    return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
  }

  private clearPageTimer(): void {
    if (this.pageTimer) clearInterval(this.pageTimer);
    this.pageTimer = undefined;
  }
}