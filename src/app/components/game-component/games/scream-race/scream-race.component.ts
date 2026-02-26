// src/app/components/game/games/scream-race/scream-race.ts

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-scream-race',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="scream-race-container">
      
      <div class="race-header">
        <h1 class="race-title">🎤 GARA DI URLA! 🏁</h1>
        <div class="race-instruction">URLA NEL TELEFONO PER CORRERE!</div>
      </div>

      <div class="race-track">
        @for (team of displayData?.teams || []; track team.playerName) {
          <div class="race-lane" 
               [class.finished]="team.finished">
            
            <div class="lane-header">
              <div class="player-name">{{ team.playerName }}</div>
              <div class="progress-text">{{ team.progress.toFixed(0) }}%</div>
              @if (team.position) {
                <div class="position-badge" 
                     [class.gold]="team.position === 1"
                     [class.silver]="team.position === 2"
                     [class.bronze]="team.position === 3">
                  {{ team.position }}°
                </div>
              }
            </div>

            <div class="track-line">
              <div class="progress-bar">
                <div class="runner" 
                     [style.left.%]="team.progress"
                     [class.celebrating]="team.finished">
                  🏃
                </div>
              </div>
            </div>
          </div>
        }

        <div class="finish-line">
          <div class="finish-flag">🏁</div>
        </div>
      </div>

      @if (displayData?.raceEnded) {
        <div class="race-ended">
          <h2>🏆 GARA TERMINATA! 🏆</h2>
          <div class="podium">
            @for (player of (displayData?.winners || []).slice(0, 3); track $index) {
              <div class="podium-place" [class]="'place-' + ($index + 1)">
                <div class="podium-emoji">
                  @if ($index === 0) { 🥇 }
                  @else if ($index === 1) { 🥈 }
                  @else { 🥉 }
                </div>
                <div class="podium-name">{{ player }}</div>
              </div>
            }
          </div>
        </div>
      }

      <div class="timer-display">
        <div class="timer-value">{{ timer }}</div>
      </div>

    </div>
  `,
  styles: [`
    .scream-race-container {
      width: 100%;
      min-height: 100vh;
      background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
      padding: 40px;
      position: relative;
      overflow: hidden;
    }

    .race-header {
      text-align: center;
      margin-bottom: 40px;
    }

    .race-title {
      font-size: 72px;
      font-weight: 900;
      color: #FFD700;
      text-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
      margin: 0;
      animation: pulse 2s infinite;
    }

    .race-instruction {
      font-size: 32px;
      color: white;
      font-weight: 700;
      margin-top: 15px;
    }

    .race-track {
      position: relative;
      max-width: 1400px;
      margin: 0 auto;
    }

    .race-lane {
      margin-bottom: 30px;
      transition: all 0.3s;
    }

    .race-lane.finished {
      opacity: 0.7;
    }

    .lane-header {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 10px;
    }

    .player-name {
      font-size: 36px;
      font-weight: 800;
      color: white;
      min-width: 250px;
    }

    .progress-text {
      font-size: 32px;
      font-weight: 700;
      color: #FFD700;
      min-width: 80px;
    }

    .position-badge {
      font-size: 28px;
      font-weight: 900;
      padding: 8px 20px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .position-badge.gold {
      background: linear-gradient(135deg, #FFD700, #FFA500);
      color: #000;
    }

    .position-badge.silver {
      background: linear-gradient(135deg, #C0C0C0, #E8E8E8);
      color: #000;
    }

    .position-badge.bronze {
      background: linear-gradient(135deg, #CD7F32, #E8A76F);
      color: #000;
    }

    .track-line {
      position: relative;
      height: 80px;
      background: linear-gradient(to right, 
        #444 0%, #444 10%, 
        transparent 10%, transparent 20%,
        #444 20%, #444 30%,
        transparent 30%, transparent 40%,
        #444 40%, #444 50%,
        transparent 50%, transparent 60%,
        #444 60%, #444 70%,
        transparent 70%, transparent 80%,
        #444 80%, #444 90%,
        transparent 90%, transparent 100%
      );
      border-radius: 10px;
      overflow: hidden;
    }

    .progress-bar {
      position: relative;
      height: 100%;
    }

    .runner {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      font-size: 60px;
      transition: left 0.2s ease-out;
      filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5));
    }

    .runner.celebrating {
      animation: celebrate 0.5s infinite;
    }

    @keyframes celebrate {
      0%, 100% { 
        transform: translateY(-50%) scale(1) rotate(0deg); 
      }
      50% { 
        transform: translateY(-50%) scale(1.3) rotate(15deg); 
      }
    }

    .finish-line {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 60px;
      background: repeating-linear-gradient(
        45deg,
        black,
        black 15px,
        white 15px,
        white 30px
      );
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .finish-flag {
      font-size: 80px;
      animation: wave 1s infinite;
    }

    @keyframes wave {
      0%, 100% { transform: rotate(-10deg); }
      50% { transform: rotate(10deg); }
    }

    .race-ended {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.95);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.5s;
    }

    .race-ended h2 {
      font-size: 96px;
      color: #FFD700;
      margin-bottom: 60px;
      text-shadow: 0 0 40px rgba(255, 215, 0, 0.8);
    }

    .podium {
      display: flex;
      gap: 40px;
      align-items: flex-end;
    }

    .podium-place {
      text-align: center;
      padding: 40px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      backdrop-filter: blur(10px);
    }

    .podium-place.place-1 {
      order: 2;
      height: 350px;
      background: linear-gradient(135deg, #FFD700, #FFA500);
      transform: scale(1.2);
    }

    .podium-place.place-2 {
      order: 1;
      height: 280px;
      background: linear-gradient(135deg, #C0C0C0, #E8E8E8);
    }

    .podium-place.place-3 {
      order: 3;
      height: 220px;
      background: linear-gradient(135deg, #CD7F32, #E8A76F);
    }

    .podium-emoji {
      font-size: 120px;
      margin-bottom: 20px;
    }

    .podium-name {
      font-size: 42px;
      font-weight: 900;
      color: #000;
    }

    .timer-display {
      position: fixed;
      bottom: 40px;
      right: 40px;
      width: 120px;
      height: 120px;
      background: rgba(255, 215, 0, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 4px solid #FFD700;
    }

    .timer-value {
      font-size: 56px;
      font-weight: 900;
      color: white;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `]
})
export class ScreamRace {
  @Input() displayData: any;
  @Input() timer: number = 0;
}
