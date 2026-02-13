import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OneVsOne } from './one-vs-one';

describe('OneVsOne', () => {
  let component: OneVsOne;
  let fixture: ComponentFixture<OneVsOne>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OneVsOne]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OneVsOne);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
