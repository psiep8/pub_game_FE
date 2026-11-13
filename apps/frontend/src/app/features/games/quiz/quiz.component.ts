import {ChangeDetectionStrategy, Component, Input, OnChanges, inject} from '@angular/core';
import {animate, style, transition, trigger} from '@angular/animations';
import {UpperCasePipe} from '@angular/common';
import {AudioService} from '../../../core/services/audio.service';

@Component({
  selector: 'app-quiz',
  imports: [
    UpperCasePipe
  ],
  templateUrl: './quiz.component.html',
  styleUrl: './quiz.component.css', changeDetection: ChangeDetectionStrategy.OnPush,
 animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({opacity: 0, transform: 'scale(0.8)'}),
        animate('300ms ease-out', style({opacity: 1, transform: 'scale(1)'}))
      ])
    ])
  ]
})
export class Quiz implements OnChanges {
  @Input() displayData: any;
  @Input() timer: number = 0;
  @Input() safeOptions: any[] = [];

  private readonly audio = inject(AudioService);
  private wasPending = false;

  /** Il rullo di tamburi parte quando la TV entra nell'attesa della soluzione. */
  ngOnChanges(): void {
    const data = this.displayData;
    if (!data) return;
    const pending = !!data.revealPending;
    if (pending && !this.wasPending) this.audio.playDrumroll(1.2, 0.7);
    this.wasPending = pending;
  }

  getLetter(index: number): string {
    return ['A', 'B', 'C', 'D'][index];
  }
}
