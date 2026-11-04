import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-speed-rush',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="sr-wrap">
      <div class="sr-head">
        <div>
          <div class="sr-kicker">⚡ CORSA A TAP</div>
          <h2 class="sr-title">SPEED RUSH</h2>
        </div>
        <span class="sr-timer" [class.hot]="timer <= 10">{{ timer }}s</span>
      </div>

      <div class="sr-lanes">
        @for (lane of displayData?.lanes; track lane.playerName; let i = $index) {
          <div class="sr-lane" [class.finished]="lane.finished">
            <div class="sr-name">
              <span class="sr-pos">{{ lane.finished ? lane.position : i + 1 }}</span>
              <span class="sr-player">{{ lane.playerName }}</span>
            </div>
            <div class="sr-track">
              <div class="sr-fill" [style.width.%]="lane.progress"></div>
              <div class="sr-runner" [style.left.%]="lane.progress">🏃</div>
              <div class="sr-checker"></div>
            </div>
            <div class="sr-pct">{{ lane.progress }}%</div>
          </div>
        } @empty {
          <div class="sr-empty">In attesa delle squadre...</div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .sr-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; gap: clamp(10px, 2vh, 22px); padding: clamp(58px, 8vh, 76px) clamp(18px, 3vw, 48px) clamp(14px, 2vh, 24px); color: var(--paper); }
    .sr-head { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
    .sr-kicker { font-size: clamp(.78rem, 1.1vw, 1rem); letter-spacing: .32em; color: #fdba74; font-weight: 800; }
    .sr-title { font-size: clamp(2rem, 3.6vw, 3.4rem); margin: 0; letter-spacing: .08em; font-weight: 900; }
    .sr-timer { font-size: clamp(1.2rem, 2vw, 1.9rem); font-weight: 900; color: #fdba74; font-variant-numeric: tabular-nums; }
    .sr-timer.hot { color: #fb7185; animation: sr-pulse .8s infinite; }
    .sr-lanes { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: clamp(8px, 1.4vh, 18px); width: 100%; }
    .sr-lane { display: flex; align-items: center; gap: clamp(10px, 1.4vw, 22px); width: 100%; }
    .sr-name { width: clamp(170px, 15vw, 300px); text-align: right; font-weight: 800; display: flex; align-items: center; justify-content: flex-end; gap: 8px; font-size: clamp(1rem, 1.35vw, 1.35rem); min-width: 0; }
    .sr-player { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sr-pos { flex: 0 0 auto; width: clamp(28px, 2.6vw, 38px); height: clamp(28px, 2.6vw, 38px); line-height: 1; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255,255,255,.14); font-size: .9em; color: #fff7ed; }
    .sr-track { position: relative; flex: 1; min-width: 0; height: clamp(44px, 6vh, 66px); background: linear-gradient(180deg, rgba(255,255,255,.1), rgba(255,255,255,.04)); border: 1px solid rgba(253,186,116,.25); border-radius: 999px; overflow: hidden; box-shadow: inset 0 4px 18px rgba(0,0,0,.45); }
    .sr-fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, rgba(249,115,22,.55), rgba(251,191,36,.75)); transition: width .25s ease; }
    .sr-runner { position: absolute; top: 50%; transform: translate(-50%, -50%); font-size: clamp(1.2rem, 2vw, 1.9rem); transition: left .25s ease; filter: drop-shadow(0 4px 8px rgba(0,0,0,.5)); z-index: 2; }
    .sr-checker { position: absolute; right: 0; top: 0; bottom: 0; width: 18px; background-image: linear-gradient(45deg, #fff 25%, transparent 25%, transparent 75%, #fff 75%), linear-gradient(45deg, #fff 25%, #111 25%, #111 75%, #fff 75%); background-size: 10px 10px; background-position: 0 0, 5px 5px; opacity: .8; }
    .sr-pct { width: clamp(58px, 4.4vw, 82px); font-variant-numeric: tabular-nums; opacity: .9; font-weight: 700; font-size: clamp(.95rem, 1.2vw, 1.2rem); }
    .sr-lane.finished .sr-pct { color: #86efac; font-weight: 900; }
    .sr-lane.finished .sr-pos { background: #fde68a; color: #422006; }
    .sr-empty { text-align: center; opacity: .6; font-size: clamp(1rem, 1.6vw, 1.3rem); }
    @keyframes sr-pulse { 50% { transform: scale(1.08); opacity: .7; } }
    @media (max-width: 800px) { .sr-name { width: 120px; font-size: .72rem; } .sr-pct { width: 44px; font-size: .7rem; } }
  `]
})
export class SpeedRush {
  @Input() displayData: any;
  @Input() timer = 0;
}
