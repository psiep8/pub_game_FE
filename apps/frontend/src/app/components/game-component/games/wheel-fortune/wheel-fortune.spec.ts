import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WheelFortune } from './wheel-fortune';

describe('WheelFortune', () => {
  let component: WheelFortune;
  let fixture: ComponentFixture<WheelFortune>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WheelFortune]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WheelFortune);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
