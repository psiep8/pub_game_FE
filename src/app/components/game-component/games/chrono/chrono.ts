import {Component, Input, OnChanges} from '@angular/core';
import {animate, style, transition, trigger} from '@angular/animations';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-chrono',
  imports: [
    FormsModule
  ],
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
export class Chrono implements OnChanges {
  @Input() displayData: any;
  @Input() timer: number = 0;

  selectedYear: number = 2000;

  ngOnChanges() {
    // Inizializza slider al centro del range
    if (this.displayData) {
      const min = this.displayData.minYear || 1900;
      const max = this.displayData.maxYear || 2024;
      this.selectedYear = Math.floor((min + max) / 2);
    }
  }
}
