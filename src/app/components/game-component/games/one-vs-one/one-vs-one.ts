import {Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
  selector: 'app-one-vs-one-component',
  imports: [],
  standalone: true,
  templateUrl: './one-vs-one.html',
  styleUrl: './one-vs-one.css',
})
export class OneVsOne {
  @Input() displayData: any;
  @Input() timer: number = 0;

  @Output() onConfirmCorrect = new EventEmitter<void>();
  @Output() onConfirmWrong = new EventEmitter<void>();
  protected readonly String = String;
}
