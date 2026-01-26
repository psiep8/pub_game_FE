import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrueFalse } from './true-false';

describe('TrueFalse', () => {
  let component: TrueFalse;
  let fixture: ComponentFixture<TrueFalse>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrueFalse]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrueFalse);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
