// src/app/core/game-modes/wheel-fortune/wheel-fortune-display.component.ts

import {Component, Input, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {trigger, transition, style, animate} from '@angular/animations';

@Component({
  selector: 'app-wheel-fortune',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wheel-fortune.html',
  styleUrl: './wheel-fortune.css',
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

  @Output() onConfirmCorrect = new EventEmitter<void>();
  @Output() onConfirmWrong = new EventEmitter<void>();
}
