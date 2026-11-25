import { Injectable, signal } from '@angular/core';
import {
  AUDIO_EVENTS,
  BONUS_ENTRANCE_TYPES,
  type AudioEventId,
} from './audio-catalog';
import { AudioEngine } from './audio-engine';
import { SoundPlayer } from './sound-player';
import { marbleRollStyle } from './marble-roll';
import { BED_LOOPS, type BedLoopId } from './bed-loops';
import { bedDuckGain, bedForGame, bedsForAct, type BedTrack } from './bed-map';
import { AudioChannels, type AudioChannelEntry } from './audio-channels';

/** Volume del sottofondo: i loop sono a −23 LUFS, già sotto la voce. */
const BED_LEVEL = 0.9;
/** Dissolvenza incrociata al cambio gioco. */
const BED_FADE_SECONDS = 1.5;
/** Spegnimento (pausa, muto): più rapido, ma senza taglio secco. */
const BED_STOP_SECONDS = 0.6;
/** Durata dell'abbassamento per la domanda: breve, si sente appena. */
const BED_DUCK_SECONDS = 0.5;

/**
 * Suoni della serata.
 *
 * Gli effetti e i sottofondi sono file (`assets/audio/...`): loop registrati
 * per famiglia, con dissolvenza incrociata al cambio. Cosa suona lo decide
 * `bed-map.ts`: base d'atto, brano del gioco o silenzio. Musica sta nel
 * silenzio (`null`), il Time Buzzer ha il loop dell'orologeria; Quiz e Indovina
 * chi tengono la base 6 dB sotto finché la domanda è aperta. Nessun evento ricade sulla sintesi: un file
 * mancante si sente in console.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly audioEnabled = signal(true);
  private readonly engine = new AudioEngine();
  private readonly player: SoundPlayer;
  /** Sottofondo attivo: un loop registrato, o `null` per i giochi muti. */
  private bedLoop: BedTrack | null = BED_LOOPS.lobby;
  /** Atto in corso: decide la base dei giochi che non hanno un brano loro. */
  private act: number | null = null;
  /** Tipo di gioco in onda: serve alla regola dei −6 dB della domanda. */
  private gameType: string | null = null;
  /** Domanda aperta: Quiz e Indovina chi abbassano la base finché è aperta. */
  private questionOpen = false;
  /** Livello già dato al sottofondo: evita una rampa a ogni domanda inutile. */
  private appliedBedLevel = BED_LEVEL;
  /** Canali e proprietari dei loop: un solo posto decide chi suona e chi tace. */
  private channels!: AudioChannels;
  /** Pausa della TV: tace tutto, effetti compresi, finché non si riprende. */
  private paused = false;

  /** Volume generale della TV, 0–1. Il muto resta il suo interruttore. */
  readonly masterVolume = signal(1);
  /** Ultima riproduzione per evento: serve alla distanza minima del catalogo. */
  private readonly lastEventAt = new Map<string, number>();

  constructor() {
    this.player = new SoundPlayer(
      this.engine,
      () => this.audioEnabled(),
      (url) => console.warn(`[audio] file mancante: ${url}`),
    );
    this.channels = new AudioChannels({
      startLoop: (event, level, style, offsetSeconds) =>
        this.player.startLoop(event, level, style, offsetSeconds),
      stopLoop: (event, fadeSeconds) => this.player.stopLoop(event, fadeSeconds),
      isLooping: (event) => this.player.isLooping(event),
      loopPosition: (event) => this.player.loopPosition(event),
    });
    this.engine.setVolume(1);
    this.engine.armUnlock();
  }

  /**
   * Proprietario attivo dei loop: lo dice la regia TV al cambio di gioco, round,
   * bonus, pausa, reset e uscita dalla TV. Tutto ciò che appartiene al
   * proprietario uscente si spegne con una dissolvenza, e un avvio in ritardo
   * del vecchio proprietario viene rifiutato.
   */
  setOwner(owner: string): void {
    this.channels.setOwner(owner);
  }

  /** Canali attivi, per il pannello `?audiodebug=1` in sala. */
  channelSnapshot(): AudioChannelEntry[] {
    return this.channels.snapshot();
  }

  /** Reset della serata: azzera loop, sottofondo e memoria di ripresa. */
  resetAudio(): void {
    this.paused = false;
    this.channels.reset();
    this.player.stopBed(0.2);
    this.player.stopOneShots();
  }

  /**
   * Uscita dalla TV (`ngOnDestroy`, cambio rotta, `beforeunload`): nessun loop
   * resta acceso oltre la scena che lo ha chiesto.
   */
  endSession(): void {
    this.channels.release();
    this.player.stopBed(0.4);
    this.player.stopOneShots();
  }

  /**
   * Heartbeat della serata. `intensity` va da 0 (lobby) a 1 (round 40):
   * più si alza, più il battito è presente.
   */
  startHeartbeat(intensity = 0): void {
    if (!this.audioEnabled() || this.paused) return;
    const level =
      (0.55 + Math.max(0, Math.min(1, intensity)) * 0.45) * AUDIO_EVENTS.heartbeat.volume;
    this.channels.start('heartbeat', {
      channel: 'loop-gioco',
      owner: this.channels.currentOwner,
      label: 'Battito di suspense',
      level,
    });
  }

  stopHeartbeat(fadeSeconds = 0): void {
    this.channels.stop('heartbeat', fadeSeconds);
  }

  /**
   * Suspense dei giochi a conto alla rovescia: parte dal round 20 e sale
   * gradualmente fino al round 40. Il battito cresce con la serata.
   */
  startSuspense(round: number): void {
    const level = Math.max(0, Math.min(1, (round - 19) / 21));
    if (level <= 0) {
      this.stopSuspense();
      return;
    }
    this.startHeartbeat(level);
  }

  stopSuspense(fadeSeconds = 0): void {
    this.stopHeartbeat(fadeSeconds);
  }

  startClock(): void {
    if (!this.audioEnabled() || this.paused) return;
    // Il livello viene dalla bilanciatura: un ticchettio continuo sta sotto.
    this.channels.start('clock', {
      channel: 'loop-gioco',
      owner: this.channels.currentOwner,
      label: 'Ticchettio del timer',
      level: AUDIO_EVENTS.clock.volume,
    });
  }

  stopClock(fadeSeconds = 0): void {
    this.channels.stop('clock', fadeSeconds);
  }

  /**
   * Sottofondo del rotolamento delle Biglie: parte col via della gara e si
   * spegne all'arrivo. Il fondo della pista decide passo e timbro dello stesso
   * file, così la sabbia non suona come il vetro.
   */
  startMarbleBed(trackId?: string | null): void {
    if (!this.audioEnabled() || this.paused) return;
    const style = marbleRollStyle(trackId);
    this.channels.start('marbleRoll', {
      channel: 'loop-gioco',
      owner: this.channels.currentOwner,
      label: 'Rotolamento delle Biglie',
      level: style.level,
      style: { rate: style.rate, lowpass: style.lowpass },
    });
  }

  stopMarbleBed(fadeSeconds = 0): void {
    this.channels.stop('marbleRoll', fadeSeconds);
  }

  /**
   * Pausa della TV: tacciono musica e rotolamento, e finché dura nessun
   * effetto parte (tick, reveal, urti). Non tocca la corsa, che ha il suo
   * ciclo: qui si spegne solo quello che si sente.
   */
  pauseBeds(): void {
    this.paused = true;
    this.stopAmbient();
    // La pausa sospende ogni loop del proprietario attivo e ne ricorda il punto.
    this.channels.suspend();
    this.channels.clearBed();
    // Anche gli effetti lunghi già in onda (il giro della roulette, un applauso)
    // tacciono: a sala ferma non deve restare acceso nessun suono del bonus.
    this.player.stopOneShots();
  }

  /**
   * Ripresa: torna la musica, e il rotolamento solo se una gara era in corso
   * quando è arrivata la pausa. La pista è quella dell'ultima gara accesa.
   */
  resumeBeds(): void {
    this.paused = false;
    this.startAmbient();
    // Riparte solo ciò che era in onda: battito, ticchettio, rotolamento.
    this.channels.resume();
  }

  /** Fiche appoggiata sul tavolo: un tick breve, non una fanfara. */
  playChip(): void {
    this.play('coins');
  }

  playBell(): void {
    this.play('bell');
  }

  playCorrect(): void {
    this.stopClock();
    this.play('correct');
  }

  playWrong(): void {
    this.play('wrong');
  }

  playApplause(): void {
    this.play('applause');
  }

  playRacketHit(): void {
    this.play('racket');
  }

  /**
   * Urti delle Biglie: biglia contro biglia, contro il muro e contro la
   * superficie. La superficie è sorda sui fondi morbidi, secca sui duri.
   */
  playMarbleHit(): void {
    this.play('marbleHit');
  }

  playMarbleWall(): void {
    this.play('marbleWall');
  }

  playMarbleSurface(soft = false): void {
    this.play(soft ? 'marbleSurfaceSoft' : 'marbleSurfaceHard');
  }

  playBombSiren(): void {
    this.play('bombSiren');
  }

  playBonusEntrance(type: string): void {
    const index = BONUS_ENTRANCE_TYPES.indexOf(type as (typeof BONUS_ENTRANCE_TYPES)[number]);
    this.play('bonusEntrance', index < 0 ? 0 : index);
  }

  playGong(): void {
    this.play('gong');
  }

  playTimeUp(): void {
    this.play('timeUp');
  }

  playReveal(): void {
    this.stopClock();
    this.play('reveal');
  }

  playRouletteTicks(_durationMs = 6750): void {
    this.play('rouletteTicks');
  }

  playRouletteLanding(): void {
    this.play('rouletteLanding');
  }

  playJoin(): void {
    this.play('join');
  }

  playTick(): void {
    if (!this.audioEnabled()) return;
    this.play('tick');
  }

  playCountdownTick(): void {
    this.play('countdownTick');
  }

  playFuse(): void {
    this.play('fuse');
  }

  playExplosion(): void {
    this.play('explosion');
  }

  playCountdownBong(): void {
    this.play('countdownBong');
  }

  playWhoosh(): void {
    this.play('whoosh');
  }

  playElimination(): void {
    this.play('elimination');
  }

  playPodium(): void {
    this.play('podium');
  }

  playDrumroll(_seconds = 2, _strength = 0.6): void {
    this.play('drumroll');
  }

  playRankReveal(position: number): void {
    this.play('rankReveal', position === 5 ? 0 : 1);
  }

  playPodiumReveal(position: number): void {
    this.play('podiumReveal', Math.max(0, Math.min(2, position - 1)));
  }

  /**
   * Accende il sottofondo del gioco: è un loop registrato, non più un tappeto
   * generato battuta per battuta. Il file resta in onda finché non cambia il
   * gioco (`setGameBed`) o la TV va in pausa (`stopAmbient`).
   */
  startAmbient(): void {
    if (!this.audioEnabled() || this.paused || !this.bedLoop) return;
    this.appliedBedLevel = this.bedGain();
    this.channels.setBed(this.channels.currentOwner, this.bedLoop.label, this.bedLoop.file);
    this.player.startBed(this.bedLoop.file, this.appliedBedLevel, BED_FADE_SECONDS);
  }

  /**
   * Cambia il sottofondo: il gioco appena partito porta la sua famiglia di
   * loop, con dissolvenza incrociata di 1,5 s. Stessa famiglia = nessuno
   * stacco, il file continua a girare. Musica e Time Buzzer chiedono il
   * silenzio: il loop in onda si spegne e non ne parte un altro.
   */
  setGameBed(gameType: string | null | undefined): void {
    this.gameType = gameType ?? null;
    // Un gioco nuovo apre senza domanda: la regola dei −6 dB riparte da zero.
    this.questionOpen = false;
    this.applyBed(bedForGame(gameType, this.act));
  }

  /**
   * Cambia la base d'atto: i giochi senza brano proprio (Quiz, Indovina chi,
   * Ruota, Timeline, Ultima Spiaggia) passano al file dell'atto con la solita
   * dissolvenza. Un gioco con il suo loop non si muove.
   */
  setActBed(act: number | null | undefined): void {
    this.act = act ?? null;
    this.applyBed(bedForGame(this.gameType, this.act));
    // Un atto nuovo porta i suoi file: base e giochi in memoria prima che servano.
    this.preloadAct(this.act);
  }

  /**
   * Carica i sottofondi di un atto: la base e i loop dei giochi della
   * scaletta. I file finiscono nella cache del player (e in quella del service
   * worker), così il primo Quiz dell'atto non aspetta la fetch.
   */
  preloadAct(act: number | null | undefined): void {
    for (const bed of bedsForAct(act)) this.player.warmBed(bed.file);
  }

  /**
   * Domanda aperta o chiusa: con Quiz e Indovina chi la base d'atto scende di
   * altri 6 dB, per leggere le risposte senza alzare la voce. Negli altri
   * giochi non cambia nulla.
   */
  setQuestionActive(open: boolean): void {
    this.questionOpen = open;
    this.applyBedLevel();
  }

  /**
   * Sottofondo scelto per famiglia: classifica e podio non sono giochi, quindi
   * non passano dalla mappa dei tipi. Stessa famiglia = il file continua.
   */
  setBedLoop(id: BedLoopId): void {
    this.applyBed(BED_LOOPS[id]);
  }

  private applyBed(next: BedTrack | null): void {
    if ((next?.id ?? null) === (this.bedLoop?.id ?? null)) {
      // Stesso file: non riparte da capo, ma il livello può essere cambiato.
      this.applyBedLevel();
      return;
    }
    this.bedLoop = next;
    // In pausa il file si ricorda ma non parte: riparte alla ripresa.
    if (!this.audioEnabled() || this.paused) return;
    if (!next) {
      this.player.stopBed(BED_STOP_SECONDS);
      return;
    }
    this.appliedBedLevel = this.bedGain();
    this.player.startBed(next.file, this.appliedBedLevel, BED_FADE_SECONDS);
  }

  /** Volume del sottofondo: pieno, o 6 dB sotto con la domanda aperta. */
  private bedGain(): number {
    return BED_LEVEL * bedDuckGain(this.gameType, this.questionOpen);
  }

  private applyBedLevel(): void {
    if (!this.bedLoop || !this.audioEnabled() || this.paused) return;
    const level = this.bedGain();
    if (Math.abs(level - this.appliedBedLevel) < 0.001) return;
    this.appliedBedLevel = level;
    this.player.setBedLevel(level, BED_DUCK_SECONDS);
  }

  stopAmbient(): void {
    this.channels.clearBed();
    this.player.stopBed(BED_STOP_SECONDS);
  }

  /**
   * Silenzio della regia: ferma quello che sta girando — battito, ticchettio,
   * rotolamento, sottofondo — e gli effetti già partiti, così «FERMA TUTTO» è
   * davvero tutto fermo. La pausa della TV resta un'altra cosa: quella zittisce
   * anche gli eventi nuovi e si toglie da sola alla ripresa.
   */
  stopAll(): void {
    this.stopSuspense(0.3);
    this.stopClock(0.3);
    this.stopMarbleBed(0.3);
    this.stopAmbient();
    this.player.stopOneShots();
  }

  toggleAudio(): void {
    this.audioEnabled.update((enabled) => !enabled);
    this.engine.setEnabled(this.audioEnabled());
    this.engine.applyGain();
    if (!this.audioEnabled()) {
      this.stopAll();
      this.stopAmbient();
      this.stopMarbleBed();
      return;
    }
    void this.unlock();
    this.startAmbient();
    this.playTick();
  }

  isEnabled(): boolean {
    return this.audioEnabled();
  }

  /**
   * Suona un evento del catalogo, con la sua distanza minima e la sua
   * rifinitura di volume. È il punto d'ingresso della regia audio: i metodi
   * storici restano per i chiamanti esistenti.
   */
  play(event: AudioEventId, variant = 0): boolean {
    if (!this.audioEnabled() || this.paused) return false;
    const definition = AUDIO_EVENTS[event];
    if (!definition) return false;

    const now = Date.now();
    const last = this.lastEventAt.get(event) ?? -Infinity;
    if (now - last < definition.minIntervalMs) return false;
    this.lastEventAt.set(event, now);

    this.engine.beginEventBus(definition.volume);
    if (!this.player.play(event, variant)) {
      console.warn(`[audio] nessun file per l'evento «${event}»`);
      return false;
    }
    return true;
  }

  /** Volume generale 0–1, applicato al bus master senza click. */
  setMasterVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
    this.masterVolume.set(clamped);
    this.engine.setVolume(clamped);
  }

  /** Contesto condiviso: anche il Quiz musicale ci appende i suoi filtri. */
  context(): AudioContext | undefined {
    return this.engine.context();
  }

  /** Bus di uscita comune: ogni sorgente passa dal gain master. */
  output(): AudioNode | undefined {
    return this.engine.output();
  }

  /** Riprende il contesto dopo un gesto utente o al ritorno sulla scheda. */
  async unlock(): Promise<void> {
    await this.engine.unlock();
  }
}
