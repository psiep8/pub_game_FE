import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export interface KaraokeRemoteState {
  phase?: string;
  manche?: number;
  totalManches?: number;
  title?: string;
  artist?: string;
  year?: number;
  points?: number;
  secondsLeft?: number;
  buzzAttempt?: number;
  micPlayer?: string | null;
  blocked?: string[];
}

/** Telefono del Karaoke: un solo tasto, il microfono. */
@Component({
  selector: 'app-karaoke-remote',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kr-remote">
      <header class="kr-head">
        <span class="kr-tag">🎤 KARAOKE</span>
        <span class="kr-manche">Manche {{ state?.manche || 1 }}/{{ state?.totalManches || 5 }}</span>
      </header>

      <div class="kr-track">
        <span class="kr-kicker">MANCHE {{ state?.manche || 1 }} · +{{ state?.points || 0 }} PT</span>
        <h2>{{ state?.title || 'La canzone sta arrivando' }}</h2>
        <p>{{ state?.artist || 'Regia' }}@if (state?.year) { · {{ state?.year }} }</p>
      </div>

      @if (state?.phase === 'STEAL') {
        @if (isBlocked()) {
          <div class="kr-wait">
            <b>FUORI DAL MICROFONO</b>
            <span>La tua squadra ha già sbagliato questa manche. Ascolta l'altra prenotazione.</span>
          </div>
        } @else {
          <button class="kr-buzz" type="button" [disabled]="disabled || sent || !!state?.micPlayer" (click)="buzz.emit()">
            <span class="kr-buzz-icon">☎</span>
            <b>{{ sent || state?.micPlayer ? 'MICROFONO PRENOTATO' : 'PRENOTA IL MICROFONO' }}</b>
            <span>{{ state?.secondsLeft || 0 }}s per rispondere</span>
          </button>
        }
      } @else if (state?.phase === 'JUDGE') {
        @if (state?.micPlayer === myself) {
          <div class="kr-mic-on">
            <span class="kr-mic-icon">🎤</span>
            <b>TOCCA A TE</b>
            <span>Canta le frasi successive al presentatore.</span>
          </div>
        } @else {
          <div class="kr-wait">
            <b>SUL PALCO: {{ state?.micPlayer }}</b>
            <span>Ascolta: se sbaglia, il microfono torna libero.</span>
          </div>
        }
      } @else if (state?.phase === 'REVEAL') {
        <div class="kr-wait">
          <b>MANCHE CHIUSA</b>
          <span>La TV mostra chi ha preso il gettone.</span>
        </div>
      } @else if (state?.phase === 'FINALE') {
        <div class="kr-wait">
          <b>KARAOKE CHIUSO</b>
          <span>La classifica è in TV.</span>
        </div>
      } @else {
        <div class="kr-wait listen">
          <span class="kr-listen-icon">🎧</span>
          <b>ASCOLTA IL TESTO</b>
          <span>La musica si ferma senza preavviso: tieni il dito pronto.</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .kr-remote { display: flex; flex-direction: column; gap: 14px; padding: 16px; height: 100%; justify-content: center; }
    .kr-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .kr-tag { padding: 3px 8px; border: 2px solid var(--coal); background: var(--tomato); color: var(--paper-hi); font-family: var(--font-mono); font-size: .68rem; font-weight: 800; letter-spacing: .1em; }
    .kr-manche { font-family: var(--font-mono); font-size: .7rem; font-weight: 700; }
    .kr-track { padding: 12px; border: 3px solid var(--coal); background: var(--paper-hi); box-shadow: 6px 6px 0 var(--mustard); }
    .kr-kicker { color: var(--tomato); font-family: var(--font-mono); font-size: .6rem; font-weight: 800; letter-spacing: .12em; }
    .kr-track h2 { margin: 5px 0 2px; font-family: var(--font-display); font-size: clamp(1.7rem, 9vw, 2.6rem); font-weight: 400; line-height: .92; text-transform: uppercase; }
    .kr-track p { margin: 0; font-family: var(--font-mono); font-size: .76rem; opacity: .72; }
    .kr-buzz { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 22px 14px; border: 4px solid var(--coal); border-radius: 0; background: var(--acid); color: var(--coal); box-shadow: 7px 7px 0 var(--coal); }
    .kr-buzz:disabled { opacity: .55; }
    .kr-buzz-icon { font-size: 2.2rem; }
    .kr-buzz b { font-family: var(--font-mono); font-size: .95rem; letter-spacing: .06em; }
    .kr-buzz span:last-child { font-family: var(--font-mono); font-size: .7rem; }
    .kr-mic-on { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 20px; border: 4px solid var(--coal); background: var(--mustard); box-shadow: 7px 7px 0 var(--tomato); text-align: center; }
    .kr-mic-icon { font-size: 2.6rem; }
    .kr-mic-on b { font-family: var(--font-display); font-size: 1.8rem; }
    .kr-mic-on span:last-child { font-family: var(--font-mono); font-size: .75rem; }
    .kr-wait { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 18px; border: 3px solid var(--coal); background: var(--paper-2); text-align: center; box-shadow: 5px 5px 0 var(--coal); }
    .kr-wait.listen { background: var(--mint); }
    .kr-wait b { font-family: var(--font-mono); font-size: .86rem; }
    .kr-wait span { font-family: var(--font-mono); font-size: .72rem; opacity: .7; }
    .kr-listen-icon { font-size: 2.2rem; }
  `],
})
export class KaraokeRemote {
  @Input() state: KaraokeRemoteState | null = null;
  @Input() myself: string | null = null;
  @Input() disabled = false;
  @Input() sent = false;
  @Output() buzz = new EventEmitter<void>();

  isBlocked(): boolean {
    const name = this.myself;
    return !!name && (this.state?.blocked ?? []).includes(name);
  }
}
