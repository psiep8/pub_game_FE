// src/app/core/services/game-mode.service.ts

import { Injectable } from '@angular/core';
import {ImageBlurMode} from '../components/game-component/mode/image-blur.mode';
import {QuizMode} from '../components/game-component/mode/quiz.mode';
import {WheelOfFortuneMode} from '../components/game-component/mode/wheel-fortune.mode';
import {ChronoMode} from '../components/game-component/mode/chrono.mode';
import {TrueFalseMode} from '../components/game-component/mode/true_false.mode';
import {GameModeConfig, IGameMode} from '../components/game-component/interfaces/game-mode-type';

/**
 * Factory Service per creare modalità di gioco
 * Pattern: Factory + Strategy
 */
@Injectable({
  providedIn: 'root'
})
export class GameModeService {
  private currentMode: IGameMode | null = null;

  /**
   * Crea una nuova modalità di gioco
   */
  createMode(config: GameModeConfig): IGameMode {
    // Cleanup modalità precedente
    if (this.currentMode) {
      this.currentMode.cleanup();
    }

    // Factory pattern
    let mode: IGameMode;

    switch (config.type) {
      case 'QUIZ':
        mode = new QuizMode();
        break;

      case 'IMAGE_BLUR':
        mode = new ImageBlurMode();
        break;

      case 'WHEEL_OF_FORTUNE':
        mode = new WheelOfFortuneMode();
        break;

      case 'CHRONO':
        mode = new ChronoMode();
        break;

      case 'TRUE_FALSE':
        mode = new TrueFalseMode();
        break;

      default:
        throw new Error(`Unknown game mode: ${config.type}`);
    }

    // Inizializza la modalità
    mode.initialize(config.payload);

    this.currentMode = mode;
    return mode;
  }

  /**
   * Ottiene la modalità corrente
   */
  getCurrentMode(): IGameMode | null {
    return this.currentMode;
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.currentMode) {
      this.currentMode.cleanup();
      this.currentMode = null;
    }
  }
}
