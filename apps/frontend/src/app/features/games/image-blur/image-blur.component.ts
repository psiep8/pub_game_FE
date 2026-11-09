import {Component, EventEmitter, Input, Output, ChangeDetectionStrategy, inject} from '@angular/core';
import {animate, style, transition, trigger} from '@angular/animations';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';

@Component({
  selector: 'app-image-blur',
  imports: [],
  templateUrl: './image-blur.component.html',
  styleUrl: './image-blur.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  isPortrait = false;
  imgLoaded = false;
  imgError = false;

  onImgLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.isPortrait = img.naturalHeight > img.naturalWidth;
    this.imgLoaded = true;
    this.imgError = false;
  }

  onImgError(): void {
    this.imgError = true;
    this.imgLoaded = false;
  }

  /** Segnaposto con l'iniziale: la TV non resta mai vuota. */
  initial(): string {
    const answer = String(this.displayData?.correctAnswer ?? '').trim();
    return answer ? answer[0].toUpperCase() : '?';
  }

  private sanitizer = inject(DomSanitizer);

  getSafeUrl(url: string | undefined | null): SafeUrl | string {
    if (!url) return '';
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }
}
