import {Component, Input} from '@angular/core';
import {animate, style, transition, trigger} from '@angular/animations';
import {UpperCasePipe} from '@angular/common';

@Component({
  selector: 'app-quiz',
  imports: [
    UpperCasePipe
  ],
  templateUrl: './quiz.html',
  styleUrl: './quiz.css', animations: [
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

  getLetter(index: number): string {
    return ['A', 'B', 'C', 'D'][index];
  }
}
