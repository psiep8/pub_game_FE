import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-speed-rush',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="sr-wrap">
      <div class="sr-head">
        <h2 class="sr-title">⚡ SPEED RUSH</h2>
        <span class="sr-timer">{{ timer }}s</span>
      </div>

      <div class="sr-lanes">
        @for (lane of displayData?.lanes; track lane.playerName; let i = $index) {
          <div class="sr-lane" [class.finished]="lane.finished">
            <div class="sr-name">
              <span class="sr-pos">{{ lane.finished ? lane.position : i + 1 }}</span>
              {{ lane.playerName }}
            </div>
            <div class="sr-track">
              <div class="sr-runner" [style.left.%]="lane.progress">🏃</div>
              <div class="sr-fill" [style.width.%]="lane.progress"></div>
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
    .sr-wrap { height: 100%; display: flex; flex-direction: column; gap: 18px; padding: 24px; color: #fff7ed; }
    .sr-head { display: flex; align-items: baseline; justify-content: center; gap: 24px; }
    .sr-title { font-size: 2.8rem; margin: 0; letter-spacing: 4px; }
    .sr-timer { font-size: 1.6rem; font-weight: 900; color: #fdba74; }
    .sr-lanes { display: flex; flex-direction: column; gap: 10px; width: 100%; }
    .sr-lane { display: flex; align-items: center; gap: 12px; }
    .sr-name { width: 220px; text-align: right; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sr-pos { display: inline-block; width: 26px; height: 26px; line-height: 26px; text-align: center; border-radius: 50%; background: rgba(255,255,255,.15); font-size: .8rem; margin-right: 8px; }
    .sr-track { position: relative; flex: 1; height: 34px; background: rgba(255,255,255,.08); border-radius: 999px; overflow: hidden; }
    .sr-fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #f97316, #fbbf24); opacity: .7; transition: width .25s ease; }
    .sr-runner { position: absolute; top: 50%; transform: translate(-50%, -50%); font-size: 1.4rem; transition: left .25s ease; }
    .sr-pct { width: 56px; font-variant-numeric: tabular-nums; opacity: .8; }
    .sr-lane.finished .sr-pct { color: #86efac; font-weight: 900; }
    .sr-empty { text-align: center; opacity: .6; }
  `]
})
export class SpeedRush {
  @Input() displayData: any;
  @Input() timer = 0;
}
