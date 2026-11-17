import { GameModeBase } from '../../../shared/models/game-mode-base.class';
import { GameModeResult, GameModeType } from '../../../shared/models/game-mode-type';

/**
 * BIGLIE — due gare per round, quattro round separati.
 *
 * Il round non ha una domanda né un timer della classe base: la schermata TV
 * gestisce introduzione, scelta della biglia, gare e finale. La TV chiude il
 * round quando il componente emette `finished`, così i punti di ogni gara
 * entrano nella classifica della serata una sola volta.
 */
export class BiglieMode extends GameModeBase {
  readonly type: GameModeType = 'BIGLIE';
  readonly timerDuration = 0;
  readonly requiresBubbles = false;
  readonly requiresBuzz = false;

  protected onInitialize(): void {
    this.revealed.set(false);
  }

  protected onStart(): void {
    // Il flusso è dentro `app-biglie-bonus`: nessun timer da avviare qui.
  }

  protected override startTimer(): void {
    // Il cronometro delle gare vive nel componente, insieme alla fisica.
  }

  protected onPause(): void {}

  protected onResume(): void {}

  protected onStop(): void {}

  protected onCleanup(): void {}

  protected onTimeout(): void {
    // La fine arriva da `finished` del componente, non da un timer di round.
  }

  protected onBuzz(_playerName: string): void {}

  protected onAnswer(_playerName: string, _answer: any, _result: any): void {}

  protected onConfirmCorrect(_result: GameModeResult): void {}

  protected onConfirmWrong(_result: GameModeResult): void {}

  protected validateAnswer(_answer: any, _timeMs: number): any {
    return { success: false, points: 0 };
  }

  protected calculatePoints(_isCorrect: boolean, _elapsedMs: number): number {
    return 0;
  }

  handlePartyEvent(_event: any): void {
    // Le scelte delle biglie passano da BIGLIE_STATE e dal componente.
  }

  getDisplayData(): any {
    return {};
  }

  override pointsFor(_isCorrect: boolean, _elapsedMs: number): number {
    return 0;
  }
}
