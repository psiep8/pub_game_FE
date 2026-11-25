import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebSocketService } from '../../../core/websocket/web-socket.service';
import { AudioService } from '../../../core/services/audio.service';
import { TvPause } from '../../../shared/tv-pause';
import {
  BONUS_KARAOKE_BUZZ_SECONDS,
  BONUS_KARAOKE_MANCHE_POINTS,
} from '../../../shared/models/scoring-rules';
import { KaraokeLine, KaraokeManche, KaraokeService } from './karaoke.service';

const flatWords = (text: string): string[] => text.split(/\s+/).filter(Boolean);

const Phase = {
  INTRO: 'INTRO',
  PLAYING: 'PLAYING',
  STEAL: 'STEAL',
  JUDGE: 'JUDGE',
  REVEAL: 'REVEAL',
  FINALE: 'FINALE',
} as const;
type Phase = (typeof Phase)[keyof typeof Phase];

interface VisibleWord {
  text: string;
  sung: boolean;
}

interface VisibleLine {
  line: KaraokeLine;
  active: boolean;
  past: boolean;
  answer: boolean;
  words: VisibleWord[];
}

interface KaraokeScore {
  playerName: string;
  score: number;
}

interface KaraokeReveal {
  heading: string;
  rows: Array<{ playerName: string; points: number; total: number }>;
}

const DEMO_LINES: KaraokeLine[] = [
  { indice: 1, inizioMs: 0, testo: 'Questa è una riga dimostrativa del karaoke' },
  { indice: 2, inizioMs: 3500, testo: 'Serve solo alla schermata di prova' },
  { indice: 3, inizioMs: 7200, testo: 'La riga successiva resta nascosta' },
  { indice: 4, inizioMs: 10800, testo: 'Quando la musica si ferma all’improvviso' },
  { indice: 5, inizioMs: 15100, testo: 'Il primo tavolo prenota il microfono' },
  { indice: 6, inizioMs: 19000, testo: 'E canta la frase che viene dopo' },
  { indice: 7, inizioMs: 23200, testo: 'La regia decide se è giusta' },
];

/** Banco di prova: cinque manche finte, nessun testo protetto. */
const DEMO_MANCHES: KaraokeManche[] = Array.from({ length: 5 }, (_, index) => ({
  manche: index + 1,
  punti: BONUS_KARAOKE_MANCHE_POINTS[index] ?? 100,
  titolo: `CANZONE DEMO ${index + 1}`,
  artista: 'BANCO DI PROVA',
  anno: 2026,
  file: '',
  offsetMs: 0,
  testiPronti: true,
  righe: DEMO_LINES,
  risposte: DEMO_LINES.slice(-2),
}));

@Component({
  selector: 'app-karaoke-bonus',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="karaoke-overlay">
      <div class="karaoke-card">
        <header class="karaoke-head">
          <div class="karaoke-heading">
            <span class="karaoke-kicker">🎤 KARAOKE · BONUS DELL'ATTO</span>
            <h1>{{ heading() }}</h1>
            <p class="karaoke-rule">{{ rule() }}</p>
          </div>
          <div class="karaoke-head-meta">
            <span class="karaoke-manche-badge">MANCHE {{ manche() }}/{{ songs.length }}</span>
            <span class="karaoke-points">+{{ song()?.punti ?? 0 }} PT</span>
            @if (phase() === Phase.STEAL || phase() === Phase.JUDGE) {
              <span class="karaoke-timer" [class.hot]="secondsLeft() <= 5">{{ secondsLeft() }}s</span>
            }
          </div>
        </header>

        <div class="karaoke-manches">
          @for (item of songs; track item.manche; let i = $index) {
            <div class="karaoke-manche" [class.on]="manche() === item.manche" [class.done]="manche() > item.manche">
              <span>M{{ item.manche }}</span>
              <b>{{ item.punti }}</b>
            </div>
          }
        </div>

        <section class="karaoke-song" aria-live="polite">
          <span class="karaoke-song-kicker">{{ song()?.artista }} · {{ song()?.anno }}</span>
          <h2>{{ song()?.titolo }}</h2>
        </section>

        <div class="karaoke-stage">
          <div class="karaoke-lyrics" [class.blackout]="phase() === Phase.STEAL || phase() === Phase.JUDGE">
            @for (row of visibleLines(); track row.line.indice) {
              <p
                class="karaoke-line"
                [class.active]="row.active"
                [class.past]="row.past"
                [class.answer]="row.answer">
                @for (word of row.words; track $index) {
                  <span class="karaoke-word" [class.sung]="word.sung">{{ word.text }}</span>{{ ' ' }}
                }
              </p>
            }
            @if (!song()?.righe?.length) {
              <p class="karaoke-empty">TESTO NON DISPONIBILE: carica il file locale dei testi e riavvia il bonus.</p>
            }
          </div>

          <aside class="karaoke-side">
            @switch (phase()) {
              @case (Phase.INTRO) {
                <div class="karaoke-box">
                  <span class="karaoke-big">🎶</span>
                  <b>PARTE LA CLIP</b>
                  <p>La TV mostra il testo. La musica si ferma senza preavviso: chi prenota per primo prende il microfono.</p>
                </div>
              }

              @case (Phase.PLAYING) {
                <div class="karaoke-box live">
                  <span class="karaoke-live-dot"></span>
                  <b>IN ASCOLTO</b>
                  <p>Leggi il testo. Al silenzio, il primo tavolo che tocca il telefono va al microfono.</p>
                  @if (audioBlocked()) {
                    <button type="button" class="karaoke-action" (click)="startAudio()">AVVIA LA CLIP</button>
                  }
                </div>
              }

              @case (Phase.STEAL) {
                <div class="karaoke-box steal">
                  <span class="karaoke-big">✋</span>
                  <b>CHI CANTA?</b>
                  <p>Silenzio in aula. Il primo tavolo che prenota chiede il microfono fisico al presentatore.</p>
                  <span class="karaoke-side-note">Prenotazioni aperte · {{ secondsLeft() }}s</span>
                </div>
              }

              @case (Phase.JUDGE) {
                <div class="karaoke-box judge">
                  <span class="karaoke-big">🎤</span>
                  <b>SUL PALCO: {{ micPlayer() }}</b>
                  <p>Passa il microfono fisico. La squadra canta le frasi successive; la regia giudica.</p>
                  @if (regia) {
                    <div class="karaoke-judge-buttons">
                      <button type="button" class="karaoke-good" (click)="judge('CORRECT')">✓ CORRETTO +{{ song()?.punti }}</button>
                      <button type="button" class="karaoke-bad" (click)="judge('WRONG')">✗ SBAGLIATO</button>
                    </div>
                  } @else {
                    <span class="karaoke-side-note">In attesa del verdetto della regia</span>
                  }
                </div>
              }

              @case (Phase.REVEAL) {
                <div class="karaoke-box reveal">
                  <span class="karaoke-big">🏆</span>
                  <b>{{ reveal()?.heading }}</b>
                  @if (reveal()?.rows?.length) {
                    @for (row of reveal()?.rows ?? []; track row.playerName) {
                      <p class="karaoke-reveal-row">
                        <span>{{ row.playerName }}</span>
                        <strong>+{{ row.points }}</strong>
                      </p>
                    }
                  } @else {
                    <p>Nessun punto: la manche passa alla prossima canzone.</p>
                  }
                </div>
              }

              @case (Phase.FINALE) {
                <div class="karaoke-box finale">
                  <span class="karaoke-big">🏁</span>
                  <b>KARAOKE CHIUSO</b>
                  <div class="karaoke-finale-rows">
                    @for (row of totals(); track row.playerName; let i = $index) {
                      <p><span>{{ i + 1 }}. {{ row.playerName }}</span><strong>{{ row.score }}</strong></p>
                    }
                  </div>
                </div>
              }
            }

            @if (phase() === Phase.REVEAL) {
              <div class="karaoke-answer-box">
                <span>FRASI GIUSTE</span>
                @for (line of answerLines(); track line.indice) {
                  <p>{{ line.testo }}</p>
                }
              </div>
            }
          </aside>
        </div>

        @if (blocked().length) {
          <footer class="karaoke-blocked">
            <span>FUORI DAL MICROFONO:</span>
            @for (name of blocked(); track name) { <b>{{ name }}</b> }
          </footer>
        }
      </div>
    </div>
  `,
  styles: [`
    .karaoke-overlay {
      position: fixed;
      inset: 0;
      z-index: 70;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(10px, 1.8vw, 24px);
      overflow: auto;
      background: var(--coal);
      color: var(--paper);
    }
    .karaoke-card {
      width: min(1480px, 97vw);
      max-height: 96vh;
      overflow: auto;
      padding: clamp(14px, 2vw, 26px);
      border: 4px solid var(--paper);
      background: var(--paper);
      color: var(--coal);
      box-shadow: 12px 12px 0 var(--tomato);
    }
    .karaoke-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 10px; border-bottom: 4px solid var(--coal); }
    .karaoke-kicker { color: var(--tomato); font-family: var(--font-mono); font-size: clamp(.58rem, .85vw, .76rem); font-weight: 800; letter-spacing: .2em; }
    .karaoke-head h1 { margin: 5px 0 2px; font-family: var(--font-display); font-size: clamp(1.5rem, 2.7vw, 2.5rem); font-weight: 400; line-height: .92; text-transform: uppercase; }
    .karaoke-rule { margin: 0; max-width: 72ch; font-family: var(--font-mono); font-size: clamp(.68rem, .95vw, .84rem); line-height: 1.35; }
    .karaoke-head-meta { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 7px; }
    .karaoke-manche-badge, .karaoke-points, .karaoke-timer { padding: 4px 9px; border: 3px solid var(--coal); font-family: var(--font-mono); font-size: clamp(.62rem, .85vw, .78rem); font-weight: 800; letter-spacing: .06em; white-space: nowrap; }
    .karaoke-manche-badge { background: var(--paper-2); }
    .karaoke-points { background: var(--mustard); }
    .karaoke-timer { background: var(--coat); color: var(--coal); font-size: clamp(.9rem, 1.4vw, 1.2rem); }
    .karaoke-timer.hot { background: var(--tomato); color: var(--paper-hi); }
    .karaoke-manches { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5px; margin: 8px 0; }
    .karaoke-manche { display: flex; justify-content: space-between; gap: 5px; padding: 4px 8px; border: 2px solid color-mix(in srgb, var(--coal) 28%, transparent); background: var(--paper-2); color: color-mix(in srgb, var(--coal) 55%, transparent); font-family: var(--font-mono); font-size: clamp(.54rem, .78vw, .7rem); font-weight: 700; }
    .karaoke-manche.done { background: var(--mint); color: var(--coal); }
    .karaoke-manche.on { border-color: var(--coal); background: var(--acid); color: var(--coal); box-shadow: 3px 3px 0 var(--coal); }
    .karaoke-song { display: flex; flex-direction: column; gap: 0; margin: 7px 0 9px; }
    .karaoke-song-kicker { color: var(--tomato); font-family: var(--font-mono); font-size: clamp(.62rem, .9vw, .8rem); font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    .karaoke-song h2 { margin: 0; font-family: var(--font-display); font-size: clamp(1.8rem, 3.4vw, 3.3rem); font-weight: 400; line-height: .9; text-transform: uppercase; }
    .karaoke-stage { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr); gap: clamp(12px, 2vw, 24px); align-items: start; }
    .karaoke-lyrics { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: clamp(10px, 2.2vh, 26px); min-height: clamp(280px, 52vh, 560px); padding: clamp(14px, 2vw, 30px); border: 4px solid var(--coal); background-color: var(--paper-hi); background-image: radial-gradient(color-mix(in srgb, var(--coal) 9%, transparent) 1px, transparent 1px); background-size: 14px 14px; box-shadow: 8px 8px 0 var(--ink); transition: background-color .15s linear; }
    .karaoke-lyrics.blackout { background-color: var(--coal); background-image: none; }
    /* Due righe alla volta e caratteri da leggere in fondo alla sala. */
    .karaoke-line { margin: 0; max-width: 100%; color: color-mix(in srgb, var(--coal) 55%, transparent); font-family: var(--font); font-size: clamp(1.9rem, 4.4vw, 4.8rem); font-weight: 900; line-height: 1.04; letter-spacing: -.01em; text-align: center; text-transform: uppercase; text-wrap: balance; transition: color .12s linear; }
    .karaoke-line.active { color: color-mix(in srgb, var(--coal) 55%, transparent); font-size: clamp(2.3rem, 5.4vw, 6rem); }
    .karaoke-line.past { color: color-mix(in srgb, var(--coal) 42%, transparent); }
    /* Il nero avanza parola per parola seguendo la voce: quello che è già
       passato si legge pieno, il resto resta in attesa. */
    .karaoke-word { color: color-mix(in srgb, var(--coal) 52%, transparent); transition: color .16s linear; }
    .karaoke-word.sung { color: var(--coal); }
    .karaoke-line.past .karaoke-word { color: color-mix(in srgb, var(--coal) 42%, transparent); }
    .karaoke-line.answer { color: var(--tomato); }
    .karaoke-lyrics.blackout .karaoke-line,
    .karaoke-lyrics.blackout .karaoke-word { color: color-mix(in srgb, var(--paper) 82%, transparent); font-size: clamp(2.1rem, 4.8vw, 5.2rem); }
    @media (max-height: 760px) {
      .karaoke-lyrics { min-height: 240px; }
      .karaoke-line { font-size: clamp(1.6rem, 3.6vw, 3.6rem); }
      .karaoke-line.active { font-size: clamp(1.9rem, 4.2vw, 4.4rem); }
    }
    .karaoke-empty { margin: 0; color: var(--tomato); font-family: var(--font-mono); font-size: .8rem; font-weight: 700; }
    .karaoke-side { display: flex; flex-direction: column; gap: 9px; }
    .karaoke-box { display: flex; flex-direction: column; gap: 5px; padding: 14px; border: 3px solid var(--coal); background: var(--paper-2); box-shadow: 6px 6px 0 var(--coal); }
    .karaoke-box.live { background: var(--mint); }
    .karaoke-box.steal { background: var(--acid); }
    .karaoke-box.judge { background: var(--mustard); }
    .karaoke-box.reveal { background: var(--mint); }
    .karaoke-box.finale { background: var(--paper-hi); }
    .karaoke-big { font-size: clamp(1.8rem, 3vw, 2.6rem); line-height: 1; }
    .karaoke-box b { font-family: var(--font-mono); font-size: clamp(.78rem, 1.1vw, .94rem); letter-spacing: .06em; }
    .karaoke-box p { margin: 0; font-size: clamp(.72rem, 1vw, .86rem); line-height: 1.35; }
    .karaoke-side-note { margin-top: 4px; font-family: var(--font-mono); font-size: .66rem; letter-spacing: .08em; }
    .karaoke-live-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--tomato); animation: karaokePulse .8s infinite alternate; }
    .karaoke-action, .karaoke-good, .karaoke-bad { border: 3px solid var(--coal); border-radius: 0; box-shadow: 4px 4px 0 var(--coal); font-family: var(--font-mono); font-size: .76rem; font-weight: 800; letter-spacing: .05em; padding: 9px 10px; }
    .karaoke-action { background: var(--paper-hi); color: var(--coal); }
    .karaoke-judge-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 4px; }
    .karaoke-good { background: var(--mint); color: var(--coal); }
    .karaoke-bad { background: var(--tomato); color: var(--paper-hi); }
    .karaoke-reveal-row, .karaoke-finale-rows p { display: flex; justify-content: space-between; gap: 10px; margin: 0; padding: 5px 0; border-top: 2px dashed color-mix(in srgb, var(--coal) 30%, transparent); font-family: var(--font-mono); font-size: .76rem; }
    .karaoke-answer-box { display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 3px solid var(--tomato); background: var(--paper-hi); box-shadow: 5px 5px 0 var(--tomato); }
    .karaoke-answer-box span { color: var(--tomato); font-family: var(--font-mono); font-size: .64rem; font-weight: 800; letter-spacing: .12em; }
    .karaoke-answer-box p { margin: 0; font-size: .82rem; font-weight: 700; line-height: 1.3; }
    .karaoke-blocked { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; padding-top: 7px; border-top: 3px dashed color-mix(in srgb, var(--coal) 30%, transparent); font-family: var(--font-mono); font-size: .64rem; letter-spacing: .08em; }
    .karaoke-blocked span { color: var(--tomato); font-weight: 800; }
    .karaoke-blocked b { padding: 2px 6px; border: 2px solid var(--coal); background: var(--paper-2); }
    @keyframes karaokePulse { to { opacity: .35; } }
    @media (max-width: 900px) {
      .karaoke-stage { grid-template-columns: 1fr; }
      .karaoke-lyrics { min-height: 220px; }
    }
    @media (prefers-reduced-motion: reduce) { .karaoke-live-dot { animation: none; } }
  `],
})
export class KaraokeBonus implements OnInit, OnDestroy {
  @Input({ required: true }) gameId = 1;
  @Input() players: string[] = [];
  @Input() preview = false;
  /** Regia: mostra i due pulsanti di giudizio anche sulla TV. */
  @Input() regia = false;
  @Input() resume: any | null = null;
  @Input()
  set paused(value: boolean) {
    const was = this.pause.isPaused;
    this.pause.setPaused(value);
    if (this.pausedReady && was !== this.pause.isPaused) {
      this.emitCheckpoint();
      if (this.pause.isPaused) this.audioEl?.pause();
      else if (this.phase() === Phase.PLAYING && this.audioEl && !this.audioBlocked()) {
        void this.audioEl.play().catch(() => this.audioBlocked.set(true));
      }
    }
  }
  get paused(): boolean {
    return this.pause.isPaused;
  }

  @Output() result = new EventEmitter<{ playerName: string; score: number }>();
  @Output() finished = new EventEmitter<void>();
  @Output() checkpoint = new EventEmitter<any>();

  private ws = inject(WebSocketService);
  private audio = inject(AudioService);
  private karaokeService = inject(KaraokeService);
  private destroyRef = inject(DestroyRef);
  private readonly pause = new TvPause({
    suspend: () => this.audioEl?.pause(),
    resume: () => {
      if (this.phase() === Phase.PLAYING && this.audioEl && !this.audioBlocked()) {
        void this.audioEl.play().catch(() => this.audioBlocked.set(true));
      }
    },
  });

  readonly Phase = Phase;
  songs: KaraokeManche[] = DEMO_MANCHES;
  readonly phase = signal<Phase>(Phase.INTRO);
  readonly manche = signal(0);
  readonly song = signal<KaraokeManche | null>(null);
  readonly secondsLeft = signal(0);
  readonly micPlayer = signal<string | null>(null);
  readonly blocked = signal<string[]>([]);
  readonly answerLines = signal<KaraokeLine[]>([]);
  readonly reveal = signal<KaraokeReveal | null>(null);
  readonly totals = signal<KaraokeScore[]>([]);
  readonly clipTime = signal(0);
  readonly activeLine = signal(-1);
  readonly stopIndex = signal(-1);
  readonly audioBlocked = signal(false);
  readonly loaded = signal(false);

  readonly heading = computed(() => {
    switch (this.phase()) {
      case Phase.STEAL: return 'CHI CANTA?';
      case Phase.JUDGE: return 'SUL PALCO';
      case Phase.REVEAL: return 'GETTONE ASSEGNATO';
      case Phase.FINALE: return 'KARAOKE · CLASSIFICA';
      default: return 'CANTA LA CANZONE';
    }
  });

  readonly rule = computed(() => {
    switch (this.phase()) {
      case Phase.STEAL:
        return 'La musica è ferma. Primo tavolo che prenota: microfono fisico al presentatore.';
      case Phase.JUDGE:
        return 'La squadra canta le frasi successive. La regia dice CORRETTO o SBAGLIATO.';
      case Phase.REVEAL:
        return 'La manche è chiusa. Si passa alla canzone successiva.';
      default:
        return 'La TV mostra il testo. La clip si ferma senza preavviso: ascolta e preparati a cantare.';
    }
  });

  private readonly scores = new Map<string, number>();
  private audioEl?: HTMLAudioElement;
  private playbackTimer?: ReturnType<typeof setInterval>;
  private pausedReady = false;
  private stopAtMs = 0;
  /** Numero della prenotazione nella manche: il telefono si riarma a ogni
   *  riapertura dopo un verdetto sbagliato. */
  private buzzAttempt = 0;

  ngOnInit(): void {
    this.pausedReady = true;
    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status: any) => this.onStatus(status));
    this.karaokeService.getManches(this.gameId).subscribe((manches) => {
      if (this.preview) {
        this.songs = manches.length && manches.every((item) => item.testiPronti) ? manches : DEMO_MANCHES;
      } else {
        this.songs = manches;
      }
      this.loaded.set(true);
      if (this.resume) {
        this.applyResume(this.resume);
        return;
      }
      this.later(this.preview ? 200 : 1800, () => this.startManche(0));
    });
  }

  ngOnDestroy(): void {
    this.pause.dispose();
    this.stopPlayback();
    this.audioEl = undefined;
  }

  startAudio(): void {
    if (!this.audioEl || this.phase() !== Phase.PLAYING) return;
    this.audioBlocked.set(false);
    void this.audioEl.play().catch(() => this.audioBlocked.set(true));
  }

  /**
   * Due righe alla volta, grandi da leggere dal fondo del pub: quella corrente
   * e la successiva. Al silenzio resta solo la riga su cui si è fermata la
   * musica; al reveal si vedono le frasi da cantare.
   */
  readonly visibleLines = computed<VisibleLine[]>(() => {
    const lines = this.song()?.righe ?? [];
    if (!lines.length) return [];
    const plain = (line: KaraokeLine): VisibleWord[] =>
      line.testo.split(/\s+/).filter(Boolean).map((text) => ({ text, sung: false }));

    if (this.phase() === Phase.REVEAL) {
      const from = Math.max(0, this.stopIndex());
      return lines.slice(from, from + 3).map((line, index) => ({
        line, active: false, past: false, answer: index > 0, words: plain(line),
      }));
    }
    if (this.phase() === Phase.STEAL || this.phase() === Phase.JUDGE) {
      const at = Math.max(0, this.stopIndex());
      return [lines[at]].filter(Boolean)
        .map((line) => ({ line, active: true, past: false, answer: false, words: plain(line) }));
    }

    // Solo la riga corrente e quella appena passata: mai quelle che vengono
    // dopo, altrimenti chi se lo ricorda può cantarla leggendola in anticipo.
    const at = Math.max(0, this.activeLine());
    const from = Math.max(0, at - 1);
    const now = this.clipTime();
    return lines.slice(from, at + 1).map((line, index) => {
      const position = from + index;
      const active = position === at;
      const next = lines[position + 1]?.inizioMs ?? line.inizioMs + 4500;
      const span = Math.max(700, next - line.inizioMs);
      const ratio = active ? Math.min(1, Math.max(0, (now - line.inizioMs) / span)) : 1;
      const words = flatWords(line.testo);
      const sung = Math.floor(ratio * words.length);
      return {
        line,
        active,
        past: !active,
        answer: false,
        words: words.map((text, wordIndex) => ({ text, sung: wordIndex < sung })),
      };
    });
  });

  judge(kind: 'CORRECT' | 'WRONG'): void {
    if (this.phase() !== Phase.JUDGE) return;
    const playerName = this.micPlayer();
    if (!playerName) return;
    if (kind === 'CORRECT') {
      const points = this.song()?.punti ?? 0;
      this.scores.set(playerName, (this.scores.get(playerName) ?? 0) + points);
      this.refreshTotals();
      this.reveal.set({
        heading: `CORRETTO · +${points} A ${playerName}`,
        rows: [{ playerName, points, total: this.scores.get(playerName) ?? points }],
      });
      this.result.emit({ playerName, score: points });
      this.audio.play('applause');
      this.phase.set(Phase.REVEAL);
      this.secondsLeft.set(0);
      this.publish();
      this.emitCheckpoint();
      this.later(this.preview ? 1200 : 4500, () => this.startManche(this.manche()));
      return;
    }

    this.blocked.set([...new Set([...this.blocked(), playerName])]);
    this.micPlayer.set(null);
    this.answerLines.set([]);
    this.audio.play('wrong');
    if (this.blocked().length >= Math.max(1, this.players.length)) {
      this.revealNoPoints('NESSUN TAVOLO HA CANTATO GIUSTO');
      return;
    }
    this.beginSteal();
  }

  private onStatus(status: any): void {
    if (!status) return;
    if (status.action === 'ADMIN_KARAOKE_RESULT') {
      if (this.phase() !== Phase.JUDGE) return;
      if (Number(status.manche) !== this.manche()) return;
      if (String(status.playerName ?? '') !== this.micPlayer()) return;
      this.judge(status.result === 'CORRECT' ? 'CORRECT' : 'WRONG');
      return;
    }
    if (status.action !== 'KARAOKE_ACTION') return;
    if (this.phase() !== Phase.STEAL || this.pause.isSuspended) return;
    const playerName = String(status.playerName ?? '').trim();
    if (!playerName || !this.players.includes(playerName)) return;
    if (this.blocked().includes(playerName) || this.micPlayer()) return;
    this.micPlayer.set(playerName);
    this.answerLines.set(this.correctLines());
    this.phase.set(Phase.JUDGE);
    this.secondsLeft.set(60);
    this.publish();
    this.emitCheckpoint();
    this.startJudgeClock();
    this.audio.play('bell');
  }

  private startManche(index: number): void {
    if (index >= this.songs.length) {
      this.finale();
      return;
    }
    this.stopPlayback();
    this.manche.set(index + 1);
    const song = this.songs[index];
    this.song.set(song);
    this.micPlayer.set(null);
    this.blocked.set([]);
    this.reveal.set(null);
    this.answerLines.set([]);
    this.audioBlocked.set(false);
    this.clipTime.set(0);
    this.activeLine.set(-1);
    this.stopAtMs = this.chooseStop(song);
    this.stopIndex.set(this.lineIndexAt(Math.max(0, this.stopAtMs - 50)));
    this.buzzAttempt = 0;
    this.phase.set(Phase.PLAYING);
    this.secondsLeft.set(0);
    this.publish();
    this.emitCheckpoint();

    if (this.preview) {
      this.startVisualPlayback(song);
      return;
    }

    this.audioEl = new Audio(song.file);
    this.audioEl.preload = 'auto';
    this.audioEl.volume = 0.92;
    this.audioEl.currentTime = 0;
    this.audioEl.addEventListener('ended', () => this.stopClip());
    this.playbackTimer = setInterval(() => this.tickPlayback(), 80);
    void this.audioEl.play().catch(() => this.audioBlocked.set(true));
  }

  private startVisualPlayback(song: KaraokeManche): void {
    const simulationStop = Math.min(900, Math.max(500, this.stopAtMs));
    this.stopAtMs = simulationStop;
    this.stopIndex.set(Math.max(0, Math.min(song.righe.length - 3, 3)));
    const started = Date.now();
    this.playbackTimer = setInterval(() => {
      if (this.phase() !== Phase.PLAYING || this.pause.isPaused) return;
      const elapsed = Date.now() - started;
      this.clipTime.set(elapsed);
      this.activeLine.set(this.lineIndexAt(elapsed));
      if (elapsed >= simulationStop) this.stopClip();
    }, 50);
  }

  private tickPlayback(): void {
    if (this.phase() !== Phase.PLAYING || this.pause.isPaused) return;
    const elapsed = this.audioEl ? this.audioEl.currentTime * 1000 : this.clipTime();
    this.clipTime.set(elapsed);
    this.activeLine.set(this.lineIndexAt(elapsed));
    if (elapsed >= this.stopAtMs) this.stopClip();
  }

  private stopClip(): void {
    if (this.phase() !== Phase.PLAYING) return;
    this.stopPlayback();
    this.audioEl?.pause();
    this.clipTime.set(this.stopAtMs);
    this.activeLine.set(this.stopIndex());
    this.beginSteal();
  }

  private beginSteal(): void {
    this.buzzAttempt += 1;
    this.phase.set(Phase.STEAL);
    this.micPlayer.set(null);
    this.answerLines.set([]);
    this.secondsLeft.set(this.preview ? 12 : BONUS_KARAOKE_BUZZ_SECONDS);
    this.publish();
    this.emitCheckpoint();
    this.startBuzzClock();
  }

  private startBuzzClock(): void {
    this.pause.startClock(() => {
      const next = Math.max(0, this.secondsLeft() - 1);
      this.secondsLeft.set(next);
      this.publish();
      if (next > 0) return true;
      this.revealNoPoints('TEMPO SCADUTO · NESSUNO HA PRENOTATO');
      return false;
    });
  }

  private startJudgeClock(): void {
    this.pause.startClock(() => {
      const next = Math.max(0, this.secondsLeft() - 1);
      this.secondsLeft.set(next);
      this.publish();
      if (next > 0) return true;
      this.revealNoPoints('VERDETTO NON ARRIVATO');
      return false;
    });
  }

  private revealNoPoints(heading: string): void {
    this.phase.set(Phase.REVEAL);
    this.secondsLeft.set(0);
    this.micPlayer.set(null);
    this.answerLines.set(this.correctLines());
    this.reveal.set({ heading, rows: [] });
    this.publish();
    this.emitCheckpoint();
    this.later(this.preview ? 1400 : 4200, () => this.startManche(this.manche()));
  }

  private finale(): void {
    this.stopPlayback();
    this.phase.set(Phase.FINALE);
    this.micPlayer.set(null);
    this.answerLines.set([]);
    this.secondsLeft.set(0);
    this.publish();
    this.later(this.preview ? 3000 : 6000, () => this.finished.emit());
  }

  private chooseStop(song: KaraokeManche): number {
    const candidates: Array<{ index: number; at: number }> = [];
    for (let index = 0; index < song.righe.length - 2; index++) {
      const next = song.righe[index + 1];
      if (!next) continue;
      const at = next.inizioMs - 120;
      if (at >= 5000 && at <= 25000) candidates.push({ index, at });
    }
    if (!candidates.length) {
      return Math.min(12000, Math.max(5000, song.righe[Math.max(0, song.righe.length - 3)]?.inizioMs ?? 8000));
    }
    return candidates[Math.floor(Math.random() * candidates.length)].at;
  }

  private lineIndexAt(ms: number): number {
    const lines = this.song()?.righe ?? [];
    let active = -1;
    for (let index = 0; index < lines.length; index++) {
      if (lines[index].inizioMs <= ms) active = index;
      else break;
    }
    return active;
  }

  private correctLines(): KaraokeLine[] {
    const lines = this.song()?.righe ?? [];
    return lines.slice(this.stopIndex() + 1, this.stopIndex() + 3);
  }

  private refreshTotals(): void {
    this.totals.set(
      [...this.scores.entries()]
        .map(([playerName, score]) => ({ playerName, score }))
        .sort((a, b) => b.score - a.score),
    );
  }

  private applyResume(state: any): void {
    const index = Math.max(0, Number(state?.manche ?? 1) - 1);
    const song = this.songs[index];
    if (!song) {
      this.finale();
      return;
    }
    this.manche.set(index + 1);
    this.song.set(song);
    this.stopIndex.set(Number.isFinite(Number(state?.stopIndex)) ? Number(state.stopIndex) : this.lineIndexAt(12000));
    this.stopAtMs = Number(state?.stopAtMs) || 12000;
    this.buzzAttempt = Math.max(0, Number(state?.buzzAttempt) || 0);
    this.micPlayer.set(state?.micPlayer ?? null);
    this.blocked.set(Array.isArray(state?.blocked) ? state.blocked : []);
    const scores: any[] = Array.isArray(state?.scores) ? state.scores : [];
    for (const row of scores) {
      const name = String(row?.playerName ?? '').trim();
      if (name) this.scores.set(name, Number(row?.score) || 0);
    }
    this.refreshTotals();
    const phase = state?.phase as Phase;
    this.phase.set(phase === Phase.JUDGE || phase === Phase.STEAL || phase === Phase.REVEAL ? phase : Phase.PLAYING);
    this.secondsLeft.set(Number(state?.secondsLeft) || 0);
    this.answerLines.set(phase === Phase.JUDGE || phase === Phase.REVEAL ? this.correctLines() : []);
    this.publish();
    if (phase === Phase.STEAL) this.startBuzzClock();
    if (phase === Phase.JUDGE) this.startJudgeClock();
    if (phase === Phase.REVEAL) {
      this.later(this.preview ? 1400 : 4200, () => this.startManche(this.manche()));
    }
  }

  private emitCheckpoint(): void {
    this.checkpoint.emit({
      manche: this.manche(),
      phase: this.phase(),
      secondsLeft: this.secondsLeft(),
      paused: this.paused,
      savedAt: Date.now(),
      stopIndex: this.stopIndex(),
      stopAtMs: this.stopAtMs,
      buzzAttempt: this.buzzAttempt,
      micPlayer: this.micPlayer(),
      blocked: this.blocked(),
      scores: this.totals(),
    });
  }

  private publish(): void {
    const showAnswer = this.phase() === Phase.JUDGE || this.phase() === Phase.REVEAL;
    this.ws.broadcastStatus(this.gameId, {
      action: 'KARAOKE_STATE',
      state: {
        phase: this.phase(),
        manche: this.manche(),
        totalManches: this.songs.length,
        title: this.song()?.titolo ?? '',
        artist: this.song()?.artista ?? '',
        year: this.song()?.anno ?? 0,
        points: this.song()?.punti ?? 0,
        rule: this.rule(),
        secondsLeft: this.secondsLeft(),
        clipTime: Math.round(this.clipTime()),
        stopAtMs: this.stopAtMs,
        stopIndex: this.stopIndex(),
        activeLine: this.activeLine(),
        buzzAttempt: this.buzzAttempt,
        micPlayer: this.micPlayer(),
        blocked: this.blocked(),
        lines: this.song()?.righe ?? [],
        answers: showAnswer ? this.answerLines() : [],
        reveal: this.reveal(),
        scores: this.totals(),
      },
    });
  }

  private stopPlayback(): void {
    if (this.playbackTimer) clearInterval(this.playbackTimer);
    this.playbackTimer = undefined;
    this.audioEl?.pause();
  }

  private later(ms: number, action: () => void): void {
    this.pause.later(ms, action);
  }
}
