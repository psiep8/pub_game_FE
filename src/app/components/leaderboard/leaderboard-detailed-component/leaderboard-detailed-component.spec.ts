import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeaderboardDetailedComponent } from './leaderboard-detailed-component';

describe('LeaderboardDetailedComponent', () => {
  let component: LeaderboardDetailedComponent;
  let fixture: ComponentFixture<LeaderboardDetailedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeaderboardDetailedComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeaderboardDetailedComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
