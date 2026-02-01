import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Deezer } from './deezer';

describe('Deezer', () => {
  let component: Deezer;
  let fixture: ComponentFixture<Deezer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Deezer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Deezer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
