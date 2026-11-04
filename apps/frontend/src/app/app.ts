import {Component, ChangeDetectionStrategy} from '@angular/core';
import {RouterOutlet} from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  imports: [
    RouterOutlet
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.css',

})

export class App {

}
