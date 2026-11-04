import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Chrono } from './chrono';

describe('Chrono', () => {
  let component: Chrono;
  let fixture: ComponentFixture<Chrono>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Chrono],
    }).compileComponents();

    fixture = TestBed.createComponent(Chrono);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('displayData', {
      question: 'In che anno è caduto il muro di Berlino?',
      isReading: false,
      correctAnswer: null,
      hint: 'Fine anni ’80',
      minYear: 1900,
      maxYear: 2000,
      step: 5,
    });
    fixture.componentRef.setInput('timer', 30);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the question and the hint', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.chrono-question')?.textContent).toContain('muro di Berlino');
    expect(element.querySelector('.chrono-hint')?.textContent).toContain('anni ’80');
  });

  it('should expose the year range coming from the mode', () => {
    expect(component.displayData.minYear).toBe(1900);
    expect(component.displayData.maxYear).toBe(2000);
  });
});
