import {Component, EventEmitter, Input, Output} from '@angular/core';
import {animate, style, transition, trigger} from '@angular/animations';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';

@Component({
  selector: 'app-image-blur',
  imports: [],
  templateUrl: './image-blur.html',
  styleUrl: './image-blur.css',
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ])
  ]
})
export class ImageBlur {
  @Input() displayData: any;
  @Input() timer: number = 0;

  @Output() onConfirmCorrect = new EventEmitter<void>();
  @Output() onConfirmWrong = new EventEmitter<void>();

  constructor(private sanitizer: DomSanitizer) {}

  getSafeUrl(url: string | undefined | null): SafeUrl | string {
    if (!url) return '';
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }
}
