import {Component, ChangeDetectionStrategy} from '@angular/core';
import {RouterOutlet} from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  imports: [
    RouterOutlet
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.component.css',

})

export class App {

}
