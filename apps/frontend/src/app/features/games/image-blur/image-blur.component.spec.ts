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
