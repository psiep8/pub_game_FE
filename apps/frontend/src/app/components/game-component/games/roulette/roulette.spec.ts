import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Roulette } from './roulette';

describe('Roulette', () => {
  let component: Roulette;
  let fixture: ComponentFixture<Roulette>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Roulette],
    }).compileComponents();

    fixture = TestBed.createComponent(Roulette);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should build a wheel of 24 slices with no repeated neighbours', () => {
    const segments = component.segments();

    expect(segments).toHaveLength(24);
    for (let i = 0; i < segments.length; i++) {
      expect(Object.keys(component.colorMap)).toContain(segments[i]);
      if (i > 0) expect(segments[i]).not.toBe(segments[i - 1]);
    }
    expect(segments[0]).not.toBe(segments[segments.length - 1]);
  });

  it('should compute a slice path as an svg arc', () => {
    const path = component.getSlicePath(0, 24);

    expect(path.startsWith('M 50 50 L')).toBe(true);
    expect(path).toContain(' A 50 50 0 ');
  });
});
