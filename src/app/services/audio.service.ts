import {Injectable, signal} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {

  private audioEnabled = signal(true);
  private audioContext?: AudioContext;

  // Audio elements
  private heartbeatAudio?: HTMLAudioElement;
  private clockAudio?: HTMLAudioElement;
  private bellAudio?: HTMLAudioElement;
  private correctAudio?: HTMLAudioElement;
  private wrongAudio?: HTMLAudioElement;
  private revealAudio?: HTMLAudioElement;

  // Loops
  private heartbeatLoopInterval?: any;
  private clockLoopInterval?: any;

  constructor() {
    this.loadAudio();
  }

  /**
   * 🔊 Carica tutti i suoni
   */
  private loadAudio() {
    try {
      // Heartbeat (battito cardiaco) per attesa
      this.heartbeatAudio = new Audio('assets/audio/heartbeat.mp3');
      this.heartbeatAudio.loop = false;
      this.heartbeatAudio.volume = 0.3;

      // Clock (tic tac) per round
      this.clockAudio = new Audio('assets/audio/clock.mp3');
      this.clockAudio.loop = false;
      this.clockAudio.volume = 0.4;

      // Bell (campanella) per prenotazione
      this.bellAudio = new Audio('assets/audio/bell.mp3');
      this.bellAudio.volume = 0.6;

      // Correct (vittoria)
      this.correctAudio = new Audio('assets/audio/correct.mp3');
      this.correctAudio.volume = 0.7;

      // Wrong (errore)
      this.wrongAudio = new Audio('assets/audio/wrong.mp3');
      this.wrongAudio.volume = 0.7;

      // Reveal (rivelazione risposta)
      this.revealAudio = new Audio('assets/audio/reveal.mp3');
      this.revealAudio.volume = 0.6;

      console.log('🔊 Audio caricati');
    } catch (e) {
      console.warn('⚠️ Errore caricamento audio:', e);
    }
  }

  /**
   * 💓 Avvia heartbeat loop (battito continuo in attesa)
   */
  startHeartbeat() {
    if (!this.audioEnabled() || !this.heartbeatAudio) return;

    console.log('💓 Heartbeat START');

    // Play immediato
    this.heartbeatAudio.currentTime = 0;
    this.heartbeatAudio.play().catch(() => {});

    // Loop ogni 1.5 secondi
    this.heartbeatLoopInterval = setInterval(() => {
      if (this.heartbeatAudio) {
        this.heartbeatAudio.currentTime = 0;
        this.heartbeatAudio.play().catch(() => {});
      }
    }, 1500);
  }

  /**
   * 💓 Ferma heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatLoopInterval) {
      clearInterval(this.heartbeatLoopInterval);
      this.heartbeatLoopInterval = undefined;
    }
    if (this.heartbeatAudio) {
      this.heartbeatAudio.pause();
      this.heartbeatAudio.currentTime = 0;
    }
    console.log('💓 Heartbeat STOP');
  }

  /**
   * 🕐 Avvia clock loop (tic tac continuo durante round)
   */
  startClock() {
    if (!this.audioEnabled() || !this.clockAudio) return;

    console.log('🕐 Clock START');

    // Play immediato
    this.clockAudio.currentTime = 0;
    this.clockAudio.play().catch(() => {});

    // Loop ogni 1 secondo (tic tac)
    this.clockLoopInterval = setInterval(() => {
      if (this.clockAudio) {
        this.clockAudio.currentTime = 0;
        this.clockAudio.play().catch(() => {});
      }
    }, 1000);
  }

  /**
   * 🕐 Ferma clock
   */
  stopClock() {
    if (this.clockLoopInterval) {
      clearInterval(this.clockLoopInterval);
      this.clockLoopInterval = undefined;
    }
    if (this.clockAudio) {
      this.clockAudio.pause();
      this.clockAudio.currentTime = 0;
    }
    console.log('🕐 Clock STOP');
  }

  /**
   * 🔔 Suono campanella (prenotazione)
   */
  playBell() {
    if (!this.audioEnabled() || !this.bellAudio) return;

    console.log('🔔 Bell');
    this.bellAudio.currentTime = 0;
    this.bellAudio.play().catch(() => {});
  }

  /**
   * ✅ Suono risposta corretta
   */
  playCorrect() {
    if (!this.audioEnabled() || !this.correctAudio) return;

    console.log('✅ Correct sound');
    this.stopClock(); // Ferma clock
    this.correctAudio.currentTime = 0;
    this.correctAudio.play().catch(() => {});
  }

  /**
   * ❌ Suono risposta sbagliata
   */
  playWrong() {
    if (!this.audioEnabled() || !this.wrongAudio) return;

    console.log('❌ Wrong sound');
    this.wrongAudio.currentTime = 0;
    this.wrongAudio.play().catch(() => {});
  }

  /**
   * 🎊 Suono reveal (rivelazione risposta)
   */
  playReveal() {
    if (!this.audioEnabled() || !this.revealAudio) return;

    console.log('🎊 Reveal sound');
    this.stopClock(); // Ferma clock
    this.revealAudio.currentTime = 0;
    this.revealAudio.play().catch(() => {});
  }

  /**
   * 🔇 Ferma tutti i suoni
   */
  stopAll() {
    this.stopHeartbeat();
    this.stopClock();

    [this.bellAudio, this.correctAudio, this.wrongAudio, this.revealAudio].forEach(audio => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    console.log('🔇 Tutti i suoni fermati');
  }

  /**
   * 🔊/🔇 Toggle audio
   */
  toggleAudio() {
    this.audioEnabled.update(enabled => !enabled);

    if (!this.audioEnabled()) {
      this.stopAll();
    }

    console.log(`🔊 Audio: ${this.audioEnabled() ? 'ON' : 'OFF'}`);
  }

  /**
   * 📊 Stato audio
   */
  isEnabled() {
    return this.audioEnabled();
  }
}
