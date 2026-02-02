import { Injectable } from '@angular/core';

export interface MusicPayload {
  songTitle: string;
  artist: string;
  year?: number;
  previewUrl: string;
  albumCover?: string;
}

export interface MusicDisplayData {
  question: string;
  songTitle: string;
  artist: string;
  year?: number;
  previewUrl: string;
  albumCover?: string;

  // runtime state
  currentPhase: number; // 0..4
  audioPlaying: boolean;
  buzzedPlayer?: string;
  revealed: boolean;
}

@Injectable({ providedIn: 'root' })
export class MusicGameService {

  /**
   * 🔄 Trasforma payload BE → displayData FE
   */
  buildDisplayData(
    payload: MusicPayload,
    runtime?: Partial<MusicDisplayData>
  ): MusicDisplayData {

    return {
      question: 'Indovina la canzone!',
      songTitle: payload.songTitle,
      artist: payload.artist,
      year: payload.year,
      previewUrl: payload.previewUrl,
      albumCover: payload.albumCover,

      currentPhase: runtime?.currentPhase ?? 0,
      audioPlaying: runtime?.audioPlaying ?? false,
      buzzedPlayer: runtime?.buzzedPlayer,
      revealed: runtime?.revealed ?? false
    };
  }

  /**
   * 🎛️ Calcola fase audio in base al timer
   * duration = durata totale del round (sec)
   */
  computePhase(secondsLeft: number, duration: number): number {
    const elapsed = duration - secondsLeft;
    const ratio = elapsed / duration;

    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  }
}
