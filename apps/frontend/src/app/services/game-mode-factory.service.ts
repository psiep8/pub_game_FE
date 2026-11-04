import { Injectable } from '@angular/core';
import { ImageBlurMode } from '../components/game-component/mode/image-blur.mode';
import { QuizMode } from '../components/game-component/mode/quiz.mode';
import { WheelOfFortuneMode } from '../components/game-component/mode/wheel-fortune.mode';
import { ChronoMode } from '../components/game-component/mode/chrono.mode';
import { TrueFalseMode } from '../components/game-component/mode/true_false.mode';
import {
  GameModeConfig,
  GameModeType,
  IGameMode,
} from '../components/game-component/interfaces/game-mode-type';
import { RouletteMode } from '../components/game-component/mode/roulette.mode';
import { MusicMode } from '../components/game-component/mode/music.mode';
import { ScreamRaceMode } from '../components/game-component/mode/scream-race.mode';
import { ArenaMode } from '../components/game-component/mode/arena.mode';
import { TimelineMode } from '../components/game-component/mode/timeline.mode';
import { PriceMode } from '../components/game-component/mode/price.mode';
import { SpeedRushMode } from '../components/game-component/mode/speed-rush.mode';
import { PingPongMode } from '../components/game-component/mode/ping-pong.mode';

type ModeFactory = (config: GameModeConfig) => IGameMode;

/**
 * Factory delle modalità di gioco (Factory + Strategy).
 *
 * Ogni modalità è una strategia autonoma: la TV riceve un `IGameMode` e non
 * deve conoscere quale implementazione stia usando.
 */
@Injectable({ providedIn: 'root' })
export class GameModeService {
  private currentMode: IGameMode | null = null;

  private readonly factories: Record<GameModeType, ModeFactory> = {
    QUIZ: (config) => this.withConfig(new QuizMode(), config),
    TRUE_FALSE: (config) => this.withConfig(new TrueFalseMode(), config),
    CHRONO: (config) => this.withConfig(new ChronoMode(), config),
    IMAGE_BLUR: (config) => this.withConfig(new ImageBlurMode(), config),
    WHEEL_OF_FORTUNE: (config) => this.withConfig(new WheelOfFortuneMode(), config),
    ROULETTE: (config) => this.withConfig(new RouletteMode(), config),
    MUSIC: (config) => this.withConfig(new MusicMode(), config),
    SCREAM_RACE: (config) => this.withConfig(new ScreamRaceMode(), config),
    ARENA: (config) => this.withConfig(new ArenaMode(), config),
    TIMELINE: (config) => this.withConfig(new TimelineMode(), config),
    PRICE: (config) => this.withConfig(new PriceMode(), config),
    SPEED_RUSH: (config) => this.withConfig(new SpeedRushMode(), config),
    PING_PONG: (config) => this.withConfig(new PingPongMode(), config),
  };

  createMode(config: GameModeConfig): IGameMode {
    this.currentMode?.cleanup();

    const factory = this.factories[config.type];
    if (!factory) throw new Error(`Unknown game mode: ${config.type}`);

    const mode = factory(config);
    this.currentMode = mode;
    return mode;
  }

  getCurrentMode(): IGameMode | null {
    return this.currentMode;
  }

  cleanup(): void {
    if (!this.currentMode) return;

    this.currentMode.cleanup();
    this.currentMode = null;
  }

  private withConfig(mode: IGameMode, config: GameModeConfig): IGameMode {
    mode.initialize(config.payload);
    mode.setConfig(config);
    return mode;
  }
}
