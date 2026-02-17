import {Component, Input} from '@angular/core';
import {animate, style, transition, trigger} from '@angular/animations';

@Component({
  selector: 'app-chrono',
  imports: [],
  templateUrl: './chrono.html',
  styleUrl: './chrono.css', animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({opacity: 0, transform: 'scale(0.8)'}),
        animate('300ms ease-out', style({opacity: 1, transform: 'scale(1)'}))
      ])
    ])
  ]
})
export class Chrono {

  @Input() displayData: any;
  @Input() timer: number = 0;
}
