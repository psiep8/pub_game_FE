import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { WheelFortune } from './wheel-fortune.component';

describe('WheelFortune', () => {
  let component: WheelFortune;
  let fixture: ComponentFixture<WheelFortune>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WheelFortune],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(WheelFortune);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('displayData', {
      buzzedPlayer: null,
      displayWords: ['CHI', 'VA'],
    });
    fixture.componentRef.setInput('timer', 10);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render one letter box per character of the proverb', () => {
    expect(fixture.nativeElement.querySelectorAll('.letter-box')).toHaveLength(5);
  });
});
