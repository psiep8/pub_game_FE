import { AzzardoPhase } from './azzardo.mode';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * TV di AZZARDO: quattro manche numeriche, una per categoria.
 * Il mode manda lo stato già deciso: qui si disegna soltanto.
 */
@Component({
  selector: 'app-azzardo',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="az-wrap">
      <header class="az-head">
        <div class="az-kicker">AZZARDO</div>
        <h2 class="az-title">
          @if (displayData?.phase === AzzardoPhase.BET) { PUNTA SULLA RISPOSTA }
          @else if (displayData?.phase === AzzardoPhase.REVEAL) { IL VALORE È }
          @else { CLASSIFICA DEL ROUND }
        </h2>
        <div class="az-meta">
          <span class="az-level">LIVELLO {{ displayData?.level ?? 1 }} · {{ levelLabel }} · ×{{ displayData?.odds ?? 2 }}</span>
          <span class="az-progress">MANCHE {{ displayData?.manche ?? 1 }} / {{ displayData?.total ?? 4 }}</span>
          <span class="az-timer" [class.hot]="(displayData?.secondsLeft ?? 0) <= 4">{{ displayData?.secondsLeft ?? 0 }}s</span>
        </div>
      </header>

      @if (displayData?.phase !== AzzardoPhase.FINALE) {
        <div class="az-question">{{ displayData?.question }}</div>
        <div class="az-category">{{ displayData?.category || 'AZZARDO' }} · in {{ displayData?.unit }}</div>

        @if (displayData?.phase === AzzardoPhase.BET && displayData?.media; as media) {
          <div class="az-media">
            @switch (media.kind) {
              @case ('celebrity') {
                <div class="az-photo">
                  @if (media.imageUrl && mediaErrorUrl !== media.imageUrl) {
                    <img [src]="media.imageUrl" alt="" referrerpolicy="no-referrer"
                      (error)="onMediaError(media.imageUrl)">
                  } @else {
                    <span class="az-media-fallback">{{ media.name?.charAt(0) || '?' }}</span>
                  }
                </div>
                <div class="az-media-copy">
                  @if ((displayData?.clueTotal ?? 0) > 0) {
                    <span class="az-media-label">INDIZIO {{ displayData?.clueIndex }} / {{ displayData?.clueTotal }}</span>
                  }
                  <p class="az-media-text az-clue">{{ displayData?.clue || 'Guarda la foto e pensa all\\'anno.' }}</p>
                </div>
              }
              @case ('song') {
                <div class="az-cover">
                  @if (media.albumCover && mediaErrorUrl !== media.albumCover) {
                    <img [src]="media.albumCover" alt="" (error)="onMediaError(media.albumCover)">
                  } @else {
                    <span class="az-media-fallback">♪</span>
                  }
                </div>
                <div class="az-media-copy">
                  <span class="az-media-label">ASCOLTA IL BRANO</span>
                  <b class="az-media-title">{{ media.title }}</b>
                  <span class="az-media-text">{{ media.artist }}</span>
                </div>
                <button class="az-play" type="button" (click)="toggleAudio()"
                  [attr.aria-label]="audioPlaying ? 'Metti in pausa' : 'Ascolta il brano'">
                  @if (audioPlaying) {
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="6" y="5" width="4" height="14"></rect>
                      <rect x="14" y="5" width="4" height="14"></rect>
                    </svg>
                  } @else {
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 5v14l11-7z"></path>
                    </svg>
                  }
                  <span>{{ audioPlaying ? 'PAUSA' : 'ASCOLTA' }}</span>
                </button>
              }
              @case ('country') {
                <div class="az-map">
                  @if (media.mapUrl && mediaErrorUrl !== media.mapUrl) {
                    <img [src]="media.mapUrl" alt="" (error)="onMediaError(media.mapUrl)">
                  } @else if (media.flagUrl && mediaErrorUrl !== media.flagUrl) {
                    <img [src]="media.flagUrl" alt="" (error)="onMediaError(media.flagUrl)">
                  } @else {
                    <span class="az-media-fallback">MAP</span>
                  }
                </div>
                <div class="az-media-copy">
                  <span class="az-media-label">CARTINA</span>
                  <b class="az-media-title">{{ media.country }}</b>
                  <span class="az-media-text">Guarda i confini prima di puntare.</span>
                </div>
              }
            }
          </div>
        }

        <div class="az-options">
          @for (option of displayData?.options ?? []; track $index; let i = $index) {
            <div class="az-option" [class.correct]="displayData?.phase === AzzardoPhase.REVEAL && i === displayData?.answerIndex">
              <span class="az-letter">{{ letter(i) }}</span>
              <b class="az-number">{{ option }}</b>
            </div>
          }
        </div>

        @if (displayData?.phase === AzzardoPhase.BET) {
          <p class="az-hint">
            Ogni fiche vale {{ displayData?.chipValue ?? 20 }} punti: quelle sull'opzione giusta
            pagano ×{{ displayData?.odds }}, quelle sbagliate costano il {{ lossPercent() }}%.
          </p>
          <div class="az-ready">
            @for (row of displayData?.ready ?? []; track row.playerName) {
              <span class="az-chip" [class.ok]="row.ready" [class.poor]="row.maxBet < 100">
                {{ row.playerName }}@if (row.ready) {<b> ✓</b>}
              </span>
            }
          </div>
        }

        @if (displayData?.phase === AzzardoPhase.REVEAL) {
          <div class="az-value">VALORE: {{ displayData?.value }} {{ displayData?.unit }}</div>
          @if (displayData?.best; as best) {
            <div class="az-best">COLPO GROSSO: {{ best.playerName }} · +{{ best.points }}</div>
          }
          <div class="az-rows">
            <div class="az-rows-head">
              <span>SQUADRA</span>
              <span>PUNTATA</span>
              <span>INCASSA / PERDE</span>
              <span>MANCHE</span>
              <span>TOTALE</span>
            </div>
            @for (row of displayData?.rows ?? []; track row.playerName) {
              <div class="az-row" [class.paid]="row.points > 0" [class.lost]="row.points < 0">
                <span class="az-name">{{ row.playerName }}</span>
                <span class="az-pick">
                  @if (row.played) {
                    @if (chipsOf(row) > 0) {
                      {{ chipsOf(row) }} fiche ({{ row.stake }} pt) su {{ letter(row.choice) }}
                    } @else {
                      {{ row.stake }} pt su {{ letter(row.choice) }}
                    }
                  } @else { non gioca }
                </span>
                <span class="az-conv">
                  @if (row.win) { <b class="plus">+{{ row.win }}</b> }
                  @if (row.loss) { <b class="minus">−{{ row.loss }}</b> }
                  @if (!row.win && !row.loss) { — }
                </span>
                <b class="az-delta">{{ signed(row.points) }}</b>
                <span class="az-total">{{ row.total }}</span>
              </div>
            }
          </div>
        }
      } @else {
        <div class="az-board">
          <div class="az-board-head">
            <span>POS</span>
            <span>SQUADRA</span>
            <span>PUNTI</span>
          </div>
          @for (row of rankedRows(); track row.playerName; let i = $index) {
            <div class="az-board-row" [class.top]="i === 0">
              <span class="az-pos">{{ i + 1 }}</span>
              <span class="az-name">{{ row.playerName }}</span>
              <b class="az-points">{{ signed(row.total) }}</b>
            </div>
          }
          <div class="az-board-note">
            QUOTA ×{{ displayData?.odds ?? 2 }} · PERDITA {{ lossPercent() }}% · FICHE DA {{ displayData?.chipValue ?? 20 }}
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .az-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(7px, 1.3vh, 14px); padding: clamp(12px, 1.8vw, 24px); color: var(--paper); }
    .az-head { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
    .az-kicker { display: inline-block; padding: 3px 10px; background: var(--tomato); color: var(--paper-hi); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .8rem); font-weight: 700; letter-spacing: .16em; transform: rotate(-1.2deg); }
    .az-title { margin: 0; font-family: var(--font-display); font-size: clamp(1.25rem, 2.3vw, 1.9rem); font-weight: 400; line-height: .95; letter-spacing: .04em; text-transform: uppercase; }
    .az-meta { display: flex; align-items: center; gap: clamp(8px, 1.4vw, 18px); flex-wrap: wrap; justify-content: center; }
    .az-level { padding: 2px 8px; background: var(--mustard); color: var(--coal); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.58rem, .85vw, .74rem); font-weight: 800; letter-spacing: .12em; }
    .az-progress { color: var(--acid); font-family: var(--font-mono); font-size: clamp(.6rem, .9vw, .78rem); font-weight: 700; letter-spacing: .16em; }
    .az-timer { font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.2rem); font-weight: 700; color: var(--acid); }
    .az-timer.hot { color: var(--tomato); animation: az-pulse .8s infinite; }
    .az-question { max-width: 1100px; font-family: var(--font-display); font-size: clamp(1.15rem, 2.5vw, 2rem); line-height: 1.15; text-align: center; }
    .az-category { padding: 2px 12px; border: 2px solid var(--coal); background: var(--acid); color: var(--coal); font-family: var(--font-mono); font-size: clamp(.58rem, .85vw, .74rem); font-weight: 700; letter-spacing: .1em; }

    .az-media { display: flex; align-items: center; gap: clamp(14px, 1.8vw, 26px); width: min(1220px, 96vw); padding: clamp(10px, 1.6vh, 18px) clamp(14px, 2vw, 24px); background: var(--paper-hi); color: var(--coal); border: 4px solid var(--coal); box-shadow: 10px 10px 0 var(--tomato); }
    /* La foto/copertina/cartina deve leggersi da fondo sala: grande e squadrata. */
    .az-photo, .az-cover, .az-map { flex: 0 0 auto; width: clamp(170px, 26vh, 300px); height: clamp(170px, 26vh, 300px); display: flex; align-items: center; justify-content: center; background: var(--paper); border: 3px solid var(--coal); overflow: hidden; }
    .az-photo img, .az-cover img { width: 100%; height: 100%; object-fit: cover; object-position: center top; }
    .az-map img { width: 100%; height: 100%; object-fit: contain; padding: 8px; }
    .az-media-fallback { font-family: var(--font-display); font-size: clamp(3rem, 7vw, 6rem); line-height: 1; text-transform: uppercase; }
    .az-media-copy { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; text-align: left; }
    .az-media-label { align-self: flex-start; padding: 2px 8px; background: var(--mustard); border: 2px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.62rem, 1vw, .82rem); font-weight: 800; letter-spacing: .16em; }
    .az-media-title { font-family: var(--font-display); font-size: clamp(1.6rem, 3.6vw, 2.9rem); font-weight: 400; line-height: 1; text-transform: uppercase; }
    .az-media-text { margin: 0; font-family: var(--font-mono); font-size: clamp(.82rem, 1.5vw, 1.15rem); line-height: 1.25; }
    .az-clue { font-family: var(--font); font-size: clamp(1rem, 1.9vw, 1.5rem); font-weight: 700; line-height: 1.25; }
    .az-play { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 10px; padding: 12px 18px; background: var(--acid); color: var(--coal); border: 3px solid var(--coal); box-shadow: 5px 5px 0 var(--coal); font-family: var(--font-mono); font-size: clamp(.7rem, 1.1vw, .95rem); font-weight: 800; letter-spacing: .08em; }
    .az-play:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--coal); }
    .az-play svg { width: clamp(20px, 2vw, 26px); height: clamp(20px, 2vw, 26px); fill: var(--coal); }

    .az-options { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(8px, 1.2vw, 16px); width: min(1180px, 96vw); }
    .az-option { display: flex; align-items: center; justify-content: center; gap: 10px; padding: clamp(10px, 1.7vw, 20px); background: var(--paper-hi); color: var(--coal); border: 3px solid var(--coal); box-shadow: 5px 5px 0 var(--coal); }
    .az-option.correct { background: var(--acid); box-shadow: 5px 5px 0 var(--tomato); }
    .az-letter { display: inline-flex; align-items: center; justify-content: center; width: clamp(24px, 2.4vw, 34px); height: clamp(24px, 2.4vw, 34px); background: var(--coal); color: var(--paper-hi); font-family: var(--font-mono); font-size: clamp(.65rem, .9vw, .8rem); font-weight: 800; }
    .az-number { font-family: var(--font-display); font-size: clamp(1.2rem, 2.4vw, 2rem); line-height: 1; font-weight: 400; }
    .az-hint { max-width: 980px; margin: 0; color: var(--ink-dim); font-family: var(--font-mono); font-size: clamp(.65rem, .95vw, .84rem); text-align: center; }
    .az-ready { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .az-chip { padding: 3px 10px; border: 2px solid var(--coal); background: var(--paper-hi); color: var(--coal); font-family: var(--font-mono); font-size: .72rem; font-weight: 700; opacity: .5; }
    .az-chip.ok { background: var(--acid); opacity: 1; }
    .az-chip.poor { border-style: dashed; }
    .az-value { padding: 6px 18px; background: var(--acid); color: var(--coal); border: 3px solid var(--coal); box-shadow: 5px 5px 0 var(--coal); font-family: var(--font-mono); font-size: clamp(.9rem, 1.4vw, 1.2rem); font-weight: 800; }
    .az-best { padding: 4px 14px; background: var(--paper-hi); color: var(--coal); border: 2px dashed var(--tomato); font-family: var(--font-mono); font-size: clamp(.7rem, 1vw, .9rem); font-weight: 700; }
    .az-rows { display: flex; flex-direction: column; gap: 4px; width: min(1180px, 96vw); }
    .az-rows-head {
      display: grid; grid-template-columns: 1.3fr 1.3fr 1fr .7fr .7fr; gap: 12px; padding: 0 14px 4px;
      border-bottom: 3px solid var(--coal);
      font-family: var(--font-mono); font-size: clamp(.55rem, .8vw, .7rem); font-weight: 800; letter-spacing: .14em; text-align: center;
    }
    .az-rows-head span:first-child, .az-rows-head span:nth-child(2) { text-align: left; }
    .az-row { display: grid; grid-template-columns: 1.3fr 1.3fr 1fr .7fr .7fr; gap: 12px; align-items: center; padding: 7px 14px; background: var(--paper-hi); color: var(--coal); border: 2px solid var(--coal); font-size: clamp(.8rem, 1.1vw, 1rem); }
    .az-row.top, .az-row.paid { background: var(--acid); }
    .az-row.lost { box-shadow: inset 4px 0 0 var(--tomato); }
    .az-pick { font-family: var(--font-mono); font-size: .82em; }
    .az-conv { font-family: var(--font-mono); font-size: .82em; text-align: center; }
    .az-conv .plus { color: var(--cobalt); }
    .az-conv .minus { color: var(--tomato); }
    .az-delta { font-family: var(--font-mono); font-weight: 800; font-size: 1.05em; text-align: center; }
    .az-row.lost .az-delta { color: var(--tomato); }
    .az-total { font-family: var(--font-mono); font-weight: 700; text-align: right; }

    /* Classifica finale: tabella stampata, colonne allineate. */
    .az-board { width: min(900px, 92vw); background: var(--paper-hi); color: var(--coal); border: 4px solid var(--coal); box-shadow: 12px 12px 0 var(--tomato); padding: clamp(10px, 1.6vh, 18px) clamp(14px, 2vw, 26px); display: flex; flex-direction: column; gap: 4px; }
    .az-board-head, .az-board-row { display: grid; grid-template-columns: 90px minmax(0, 1fr) 180px; align-items: center; gap: 14px; }
    .az-board-head { padding-bottom: 6px; border-bottom: 3px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.58rem, .85vw, .74rem); font-weight: 800; letter-spacing: .18em; }
    .az-board-head span:last-child { text-align: right; }
    .az-board-row { padding: 9px 0; border-bottom: 2px solid var(--coal); font-size: clamp(.95rem, 1.7vw, 1.45rem); }
    .az-board-row.top { background: var(--acid); }
    .az-pos { font-family: var(--font-mono); font-weight: 800; font-size: .85em; letter-spacing: .1em; }
    .az-board-row .az-name { font-family: var(--font); font-weight: 800; }
    .az-points { font-family: var(--font-mono); font-weight: 800; text-align: right; font-variant-numeric: tabular-nums; }
    .az-board-note { padding-top: 6px; font-family: var(--font-mono); font-size: clamp(.55rem, .8vw, .7rem); letter-spacing: .14em; opacity: .65; text-align: center; }
    @keyframes az-pulse { 50% { transform: scale(1.08); opacity: .7; } }

    @media (max-height: 760px) {
      .az-wrap { gap: 5px; padding: 10px 14px; }
      .az-question { font-size: clamp(1rem, 2vw, 1.5rem); }
      .az-media { padding: 8px 12px; gap: 12px; }
      .az-photo, .az-cover, .az-map { width: clamp(110px, 17vh, 150px); height: clamp(110px, 17vh, 150px); }
      .az-media-title { font-size: clamp(1.1rem, 2.4vw, 1.7rem); }
      .az-clue { font-size: clamp(.85rem, 1.4vw, 1.1rem); }
      .az-option { padding: 8px 6px; }
      .az-number { font-size: 1.15rem; }
    }
  `],
})
export class Azzardo implements OnChanges, OnDestroy {
  /** Fasi del gioco, disponibili anche nel template. */
  readonly AzzardoPhase = AzzardoPhase;

  @Input() displayData: any;
  @Input() timer = 0;

  private cdr = inject(ChangeDetectorRef);
  private audio?: HTMLAudioElement;
  private audioUrl: string | null = null;
  private mediaKey: string | null = null;

  mediaErrorUrl: string | null = null;
  audioPlaying = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['displayData']) {
      this.syncMedia();
      this.syncAudio();
    }
  }

  ngOnDestroy(): void {
    this.stopAudio();
  }

  get levelLabel(): string {
    const level = Number(this.displayData?.level) || 1;
    if (level === 1) return 'FACILE';
    return level === 3 ? 'DIFFICILE' : 'MEDIA';
  }

  lossPercent(): number {
    return Math.round((Number(this.displayData?.lossMultiplier) || 1) * 100);
  }

  letter(index: number): string {
    return index < 0 ? '—' : String.fromCharCode(65 + index);
  }

  /** Fiches giocate da una squadra nella manche appena chiusa. */
  chipsOf(row: any): number {
    const chips = row?.chips;
    if (!Array.isArray(chips)) return 0;
    return chips.reduce((sum: number, value: number) => sum + (Number(value) || 0), 0);
  }

  /** Classifica finale: chi ha più punti in cima, non l'ordine di tavolo. */
  rankedRows(): any[] {
    const rows = Array.isArray(this.displayData?.rows) ? [...this.displayData.rows] : [];
    return rows.sort((a: any, b: any) => (Number(b?.total) || 0) - (Number(a?.total) || 0));
  }

  signed(points: number | null | undefined): string {
    const value = Number(points) || 0;
    return value > 0 ? `+${value}` : `${value}`;
  }

  /** Un errore su una foto non deve spegnere anche cartina e copertina. */
  onMediaError(url: string | undefined | null): void {
    if (!url) return;
    this.mediaErrorUrl = url;
    this.cdr.markForCheck();
  }

  toggleAudio(): void {
    if (!this.audio) {
      this.syncAudio();
    }
    if (!this.audio) return;

    if (this.audio.paused) {
      void this.playAudio();
    } else {
      this.audio.pause();
      this.audioPlaying = false;
      this.cdr.markForCheck();
    }
  }

  private syncMedia(): void {
    const media = this.displayData?.media;
    const key = media
      ? `${media.kind}|${this.displayData?.manche}|${media.imageUrl || media.mapUrl || media.previewUrl || ''}`
      : null;
    if (key !== this.mediaKey) {
      this.mediaKey = key;
      this.mediaErrorUrl = null;
    }
  }

  private syncAudio(): void {
    const url = this.displayData?.phase === AzzardoPhase.BET
      ? this.displayData?.media?.previewUrl ?? null
      : null;

    if (url === this.audioUrl) return;
    this.stopAudio();
    this.audioUrl = url;
    if (!url) return;

    this.audio = new Audio(url);
    this.audio.preload = 'auto';
    this.audio.volume = 0.8;
    this.audio.addEventListener('ended', () => {
      this.audioPlaying = false;
      this.cdr.markForCheck();
    });
    // Il gesto non è garantito sulla TV: se il browser blocca l'autoplay,
    // resta il pulsante ASCOLTA nella scheda.
    void this.playAudio();
  }

  private async playAudio(): Promise<void> {
    if (!this.audio) return;
    try {
      await this.audio.play();
      this.audioPlaying = true;
    } catch {
      this.audioPlaying = false;
    }
    this.cdr.markForCheck();
  }

  private stopAudio(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.src = '';
      this.audio = undefined;
    }
    this.audioPlaying = false;
    this.audioUrl = null;
  }
}
