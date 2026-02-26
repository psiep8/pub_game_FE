import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScreamRaceDisplayData } from '../../mode/scream-race.mode';

@Component({
  selector: 'app-scream-race',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scream-race.component.html',
  styleUrl: './scream-race.component.scss'
})
export class ScreamRace {
  @Input() displayData?: ScreamRaceDisplayData;
  @Input() timer: number = 0;

  private emojis = ['🏃', '🦖', '🦄', '🐆', '🏎️', '🚀', '👻', '🤖'];

  getRunnerEmoji(index: number): string {
    return this.emojis[index % this.emojis.length];
  }

  getRunnerFilter(index: number): string {
    return `hue-rotate(${index * 45}deg)`;
  }
}
