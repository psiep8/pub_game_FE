import { Injectable } from '@angular/core';
import { ImageBlurMode } from '../../features/games/image-blur/image-blur.mode';
import { QuizMode } from '../../features/games/quiz/quiz.mode';
import { WheelOfFortuneMode } from '../../features/games/wheel-fortune/wheel-fortune.mode';
import {
  GameModeConfig,
  GameModeType,
  IGameMode,
} from '../../shared/models/game-mode-type';
import { MusicMode } from '../../features/games/song/music.mode';
import { ArenaMode } from '../../features/games/arena/arena.mode';
import { TimelineMode } from '../../features/games/timeline/timeline.mode';
import { TimeBuzzerMode } from '../../features/games/time-buzzer/time-buzzer.mode';
import { BombaMode } from '../../features/games/bomba/bomba.mode';
import { SpeedRushMode } from '../../features/games/speed-rush/speed-rush.mode';
import { AirHockeyBattleMode } from '../../features/games/air-hockey-battle/air-hockey-battle.mode';
import { UltimaSpiaggiaMode } from '../../features/games/ultima-spiaggia/ultima-spiaggia.mode';
import { AzzardoMode } from '../../features/games/azzardo/azzardo.mode';
import { BlackjackMode } from '../../features/games/blackjack/blackjack.mode';

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
    IMAGE_BLUR: (config) => this.withConfig(new ImageBlurMode(), config),
    WHEEL_OF_FORTUNE: (config) => this.withConfig(new WheelOfFortuneMode(), config),
    MUSIC: (config) => this.withConfig(new MusicMode(), config),
    ARENA: (config) => this.withConfig(new ArenaMode(), config),
    TIMELINE: (config) => this.withConfig(new TimelineMode(), config),
    TIME_BUZZER: (config) => this.withConfig(new TimeBuzzerMode(), config),
    BOMBA: (config) => this.withConfig(new BombaMode(), config),
    SPEED_RUSH: (config) => this.withConfig(new SpeedRushMode(), config),
    AIR_HOCKEY_BATTLE: (config) => this.withConfig(new AirHockeyBattleMode(), config),
    ULTIMA_SPIAGGIA: (config) => this.withConfig(new UltimaSpiaggiaMode(), config),
    AZZARDO: (config) => this.withConfig(new AzzardoMode(), config),
    BLACKJACK: (config) => this.withConfig(new BlackjackMode(), config),
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
