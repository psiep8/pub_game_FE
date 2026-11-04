import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeaderboardQuickComponent } from './leaderboard-quick-component';

describe('LeaderboardQuickComponent', () => {
  let component: LeaderboardQuickComponent;
  let fixture: ComponentFixture<LeaderboardQuickComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeaderboardQuickComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeaderboardQuickComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
