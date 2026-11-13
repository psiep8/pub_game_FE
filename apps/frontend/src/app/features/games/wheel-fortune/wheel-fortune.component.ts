

import {Component, Input, Output, EventEmitter, ChangeDetectionStrategy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {trigger, transition, style, animate} from '@angular/animations';

@Component({
  selector: 'app-wheel-fortune',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wheel-fortune.component.html',
  styleUrl: './wheel-fortune.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({opacity: 0, transform: 'scale(0.8)'}),
        animate('300ms ease-out', style({opacity: 1, transform: 'scale(1)'}))
      ])
    ])
  ]
})
export class WheelFortune {
  @Input() displayData: any;
  @Input() timer: number = 0;
  /** Spegne il cerchio del timer al reveal: la soluzione è svelata, il tempo no. */
  @Input() timerVisible = true;

  @Output() onConfirmCorrect = new EventEmitter<void>();
  @Output() onConfirmWrong = new EventEmitter<void>();
}
