import {Component, Input} from '@angular/core';
import {animate, style, transition, trigger} from '@angular/animations';

@Component({
  selector: 'app-true-false',
  imports: [],
  templateUrl: './true-false.html',
  styleUrl: './true-false.css', animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({opacity: 0, transform: 'scale(0.8)'}),
        animate('300ms ease-out', style({opacity: 1, transform: 'scale(1)'}))
      ])
    ])
  ]
})
export class TrueFalse {
  @Input() displayData: any;
  @Input() timer: number = 0;
}
