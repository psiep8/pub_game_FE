import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageBlur } from './image-blur.component';

describe('ImageBlur', () => {
  let component: ImageBlur;
  let fixture: ComponentFixture<ImageBlur>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageBlur],
    }).compileComponents();

    fixture = TestBed.createComponent(ImageBlur);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('displayData', {
      buzzedPlayer: null,
      imageUrl: 'https://image.tmdb.org/t/p/w500/foo.jpg',
      blurAmount: 20,
      correctAnswer: null,
    });
    fixture.componentRef.setInput('timer', 12);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the countdown while the answer is open and hide it at the reveal', async () => {
    expect(fixture.nativeElement.querySelector('.timer-circle')).not.toBeNull();

    fixture.componentRef.setInput('timerVisible', false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.timer-circle')).toBeNull();
  });

  it('dimensiona la cornice sulla proporzione della foto, con ripiego quando manca', () => {
    fixture.componentRef.setInput('displayData', { imageWidth: 330, imageHeight: 455 });
    expect(component.frameRatio()).toBeCloseTo(330 / 455, 5);

    fixture.componentRef.setInput('displayData', { imageWidth: 0, imageHeight: 0 });
    expect(component.frameRatio()).toBeNull();

    fixture.componentRef.setInput('displayData', { imageWidth: 4000, imageHeight: 500 });
    expect(component.frameRatio()).toBe(2);
  });

  it('should return an empty string when there is no image', () => {
    expect(component.getSafeUrl(null)).toBe('');
    expect(component.getSafeUrl(undefined)).toBe('');
  });

  it('should mark a real url as safe', () => {
    const safeUrl = component.getSafeUrl('https://image.tmdb.org/t/p/w500/foo.jpg');

    expect(safeUrl).not.toBe('');
    expect(String(safeUrl)).toContain('SafeValue');
  });
});
