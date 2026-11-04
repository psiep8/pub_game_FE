import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrueFalse } from './true-false';

describe('TrueFalse', () => {
  let component: TrueFalse;
  let fixture: ComponentFixture<TrueFalse>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrueFalse],
    }).compileComponents();

    fixture = TestBed.createComponent(TrueFalse);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('displayData', {
      question: 'Il cielo è blu?',
      correctAnswer: null,
      explanation: null,
    });
    fixture.componentRef.setInput('safeOptions', ['VERO', 'FALSO']);
    fixture.componentRef.setInput('timer', 7);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the question and both answers', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.question-text')?.textContent).toContain('Il cielo è blu?');
    expect(element.querySelectorAll('.option-card')).toHaveLength(2);
  });

  it('should show the explanation once the answer is revealed', () => {
    fixture.componentRef.setInput('displayData', {
      question: 'Il cielo è blu?',
      correctAnswer: 'FALSO',
      explanation: 'Di notte è nero.',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.explanation-text')?.textContent).toContain(
      'Di notte è nero.',
    );
  });
});
