import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Song } from './song';

describe('Song', () => {
  let component: Song;
  let fixture: ComponentFixture<Song>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Song],
    }).compileComponents();

    fixture = TestBed.createComponent(Song);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should describe every phase', () => {
    expect(component.getPhaseLabel()).toBe('In attesa...');

    component.currentPhase.set(1);
    expect(component.getPhaseLabel()).toContain('Irriconoscibile');
    expect(component.getPhaseColor()).toBe('#e74c3c');

    component.currentPhase.set(4);
    expect(component.getPhaseLabel()).toContain('Chiaro');
    expect(component.getPhaseColor()).toBe('#27ae60');
  });

  it('should expose an icon per phase', () => {
    component.currentPhase.set(0);
    expect(component.getPhaseIcon()).toBe('⏳');

    component.currentPhase.set(4);
    expect(component.getPhaseIcon()).toBe('📢');
  });
});
