import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Quiz } from './quiz.component';

describe('Quiz', () => {
  let component: Quiz;
  let fixture: ComponentFixture<Quiz>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Quiz],
    }).compileComponents();

    fixture = TestBed.createComponent(Quiz);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('displayData', {
      question: 'Qual è la capitale d’Italia?',
      isReading: false,
      correctAnswer: null,
    });
    fixture.componentRef.setInput('safeOptions', ['Roma', 'Milano']);
    fixture.componentRef.setInput('timer', 10);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the question and the options', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.quiz-question')?.textContent).toContain('capitale');
    expect(element.querySelectorAll('.quiz-option-btn')).toHaveLength(2);
  });

  it('should label the options from A to D', () => {
    expect(component.getLetter(0)).toBe('A');
    expect(component.getLetter(2)).toBe('C');
    expect(component.getLetter(3)).toBe('D');
    expect(component.getLetter(4)).toBeUndefined();
  });
});
