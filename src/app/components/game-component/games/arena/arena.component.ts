import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ArenaDisplayData, ArenaTeamProgress } from '../../mode/arena.mode';

@Component({
    selector: 'app-arena',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './arena.component.html',
    styleUrl: './arena.component.scss',
    animations: [
        trigger('eliminateAnimation', [
            transition(':enter', [
                style({ transform: 'scale(1)', opacity: 1 }),
            ]),
            transition('* => eliminated', [
                animate('0.5s ease-out', style({ transform: 'scale(2)', opacity: 0, filter: 'hue-rotate(90deg) blur(5px)' }))
            ])
        ])
    ]
})
export class ArenaComponent {
    @Input() displayData?: ArenaDisplayData;
    @Input() timer: number = 0;

    // We assign a random angle to each team so they distribute nicely around the circle
    private teamAngles = new Map<string, number>();

    ngOnChanges() {
        if (this.displayData && this.displayData.teams) {
            this.displayData.teams.forEach(team => {
                if (!this.teamAngles.has(team.playerName)) {
                    // Assign random angle between 0 and 360 degrees
                    this.teamAngles.set(team.playerName, Math.random() * 360);
                }
            });
        }
    }

    getTeamAngle(playerName: string): number {
        return this.teamAngles.get(playerName) || 0;
    }

    // Calculate X and Y coordinates (0 to 100%) based on distance and angle
    // assuming center is 50%, 50%
    // distance corresponds to radius. 100 distance = 50% coordinate radius.
    getTeamLeft(team: ArenaTeamProgress): string {
        const angleRad = this.getTeamAngle(team.playerName) * (Math.PI / 180);
        const radiusPct = team.distance / 2; // scale 0-100 to 0-50%
        const x = 50 + (radiusPct * Math.cos(angleRad));
        return `${x}%`;
    }

    getTeamTop(team: ArenaTeamProgress): string {
        const angleRad = this.getTeamAngle(team.playerName) * (Math.PI / 180);
        const radiusPct = team.distance / 2; // scale 0-100 to 0-50%
        const y = 50 + (radiusPct * Math.sin(angleRad));
        return `${y}%`;
    }

    // Get color based on current score (green if positive, red if negative, white if 0)
    getTeamColor(score: number): string {
        if (score > 0) return '#4caf50'; // Green
        if (score < 0) return '#f44336'; // Red
        return '#ffffff'; // White
    }
}
