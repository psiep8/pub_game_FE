import {Component, Input, ChangeDetectionStrategy} from '@angular/core';
import {animate, style, transition, trigger} from '@angular/animations';
import {UpperCasePipe} from '@angular/common';

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
export class Quiz {
  @Input() displayData: any;
  @Input() timer: number = 0;
  @Input() safeOptions: any[] = [];

  getLetter(index: number): string {
    return ['A', 'B', 'C', 'D'][index];
  }
}
