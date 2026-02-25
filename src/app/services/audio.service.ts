import {Injectable, signal} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {

  private audioEnabled = signal(true);
  private audioContext?: AudioContext;

  
  private heartbeatAudio?: HTMLAudioElement;
  private clockAudio?: HTMLAudioElement;
  private bellAudio?: HTMLAudioElement;
  private correctAudio?: HTMLAudioElement;
  private wrongAudio?: HTMLAudioElement;
  private revealAudio?: HTMLAudioElement;

  
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
      
      this.heartbeatAudio = new Audio('assets/audio/heartbeat.mp3');
      this.heartbeatAudio.loop = false;
      this.heartbeatAudio.volume = 0.3;

      
      this.clockAudio = new Audio('assets/audio/clock.mp3');
      this.clockAudio.loop = false;
      this.clockAudio.volume = 0.4;

      
      this.bellAudio = new Audio('assets/audio/bell.mp3');
      this.bellAudio.volume = 0.6;

      
      this.correctAudio = new Audio('assets/audio/correct.mp3');
      this.correctAudio.volume = 0.7;

      
      this.wrongAudio = new Audio('assets/audio/wrong.mp3');
      this.wrongAudio.volume = 0.7;

      
      this.revealAudio = new Audio('assets/audio/reveal.mp3');
      this.revealAudio.volume = 0.6;

      
    } catch (e) {
      console.warn('⚠️ Errore caricamento audio:', e);
    }
  }

  /**
   * 💓 Avvia heartbeat loop (battito continuo in attesa)
   */
  startHeartbeat() {
    if (!this.audioEnabled() || !this.heartbeatAudio) return;

    

    
    this.heartbeatAudio.currentTime = 0;
    this.heartbeatAudio.play().catch(() => {});

    
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
    
  }

  /**
   * 🕐 Avvia clock loop (tic tac continuo durante round)
   */
  startClock() {
    if (!this.audioEnabled() || !this.clockAudio) return;

    

    
    this.clockAudio.currentTime = 0;
    this.clockAudio.play().catch(() => {});

    
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
    
  }

  /**
   * 🔔 Suono campanella (prenotazione)
   */
  playBell() {
    if (!this.audioEnabled() || !this.bellAudio) return;

    
    this.bellAudio.currentTime = 0;
    this.bellAudio.play().catch(() => {});
  }

  /**
   * ✅ Suono risposta corretta
   */
  playCorrect() {
    if (!this.audioEnabled() || !this.correctAudio) return;

    
    this.stopClock(); 
    this.correctAudio.currentTime = 0;
    this.correctAudio.play().catch(() => {});
  }

  /**
   * ❌ Suono risposta sbagliata
   */
  playWrong() {
    if (!this.audioEnabled() || !this.wrongAudio) return;

    
    this.wrongAudio.currentTime = 0;
    this.wrongAudio.play().catch(() => {});
  }

  /**
   * 🎊 Suono reveal (rivelazione risposta)
   */
  playReveal() {
    if (!this.audioEnabled() || !this.revealAudio) return;

    
    this.stopClock(); 
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

    
  }

  /**
   * 🔊/🔇 Toggle audio
   */
  toggleAudio() {
    this.audioEnabled.update(enabled => !enabled);

    if (!this.audioEnabled()) {
      this.stopAll();
    }

    
  }

  /**
   * 📊 Stato audio
   */
  isEnabled() {
    return this.audioEnabled();
  }
}
