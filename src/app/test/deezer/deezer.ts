import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {DeezerService, DeezerSong} from '../../services/deezer.service';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-test-deezer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="test-container">
      <h2>🎵 Test Deezer API</h2>

      <div class="controls">
        <button (click)="testRandom()" [disabled]="loading()">
          {{ loading() ? 'Loading...' : 'Get Random Song' }}
        </button>

        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search song..."
          (keyup.enter)="testSearch()">
        <button (click)="testSearch()">Search</button>
      </div>

      @if (error()) {
        <div class="error">
          ❌ {{ error() }}
        </div>
      }

      @if (song()) {
        <div class="song-card">
          <img [src]="song()!.albumCover" [alt]="song()!.title" />

          <div class="song-info">
            <h3>{{ song()!.title }}</h3>
            <p class="artist">{{ song()!.artist }}</p>
            <p class="year">{{ song()!.year }}</p>
            <span class="badge">Deezer</span>
          </div>

          <audio
            controls
            [src]="song()!.previewUrl"
            class="audio-player">
          </audio>

          <div class="metadata">
            <code>{{ song() | json }}</code>
          </div>
        </div>
      }

      <div class="stats">
        <p>Tested: {{ testedCount }} songs</p>
      </div>
    </div>
  `,
  styles: [`
    .test-container {
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      font-family: Arial, sans-serif;
    }

    h2 {
      color: #333;
      margin-bottom: 20px;
    }

    .controls {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }

    button {
      padding: 10px 20px;
      background: #3498db;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
    }

    button:hover:not(:disabled) {
      background: #2980b9;
    }

    button:disabled {
      background: #95a5a6;
      cursor: not-allowed;
    }

    input {
      flex: 1;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-size: 14px;
    }

    .error {
      padding: 15px;
      background: #e74c3c;
      color: white;
      border-radius: 5px;
      margin-bottom: 20px;
    }

    .song-card {
      border: 1px solid #ddd;
      border-radius: 10px;
      padding: 20px;
      background: white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }

    .song-card img {
      width: 200px;
      height: 200px;
      object-fit: cover;
      border-radius: 10px;
      margin-bottom: 15px;
    }

    .song-info h3 {
      margin: 0 0 5px;
      color: #2c3e50;
    }

    .artist {
      color: #7f8c8d;
      margin: 5px 0;
      font-size: 16px;
    }

    .year {
      color: #95a5a6;
      font-size: 14px;
    }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      background: #3498db;
      color: white;
      border-radius: 3px;
      font-size: 12px;
      margin-top: 5px;
    }

    .audio-player {
      width: 100%;
      margin: 15px 0;
    }

    .metadata {
      margin-top: 15px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 5px;
      max-height: 200px;
      overflow: auto;
    }

    .metadata code {
      font-size: 12px;
      white-space: pre-wrap;
    }

    .stats {
      margin-top: 20px;
      padding: 10px;
      background: #ecf0f1;
      border-radius: 5px;
      text-align: center;
    }
  `]
})
export class Deezer implements OnInit {
  song = signal<DeezerSong | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  searchQuery = '';
  testedCount = 0;

  constructor(private deezer: DeezerService) {}

  ngOnInit() {
    console.log('🎵 Test Deezer Component Ready');
  }

  async testRandom() {
    this.loading.set(true);
    this.error.set(null);
    this.song.set(null);

    try {
      const song = await this.deezer.getRandomSong();
      this.song.set(song);
      this.testedCount++;
      console.log('✅ Song loaded:', song);
    } catch (err: any) {
      this.error.set(err.message);
      console.error('❌ Error:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async testSearch() {
    if (!this.searchQuery.trim()) return;

    this.loading.set(true);
    this.error.set(null);
    this.song.set(null);

    try {
      const song = await this.deezer.searchSong(this.searchQuery);

      if (song) {
        this.song.set(song);
        this.testedCount++;
        console.log('✅ Song found:', song);
      } else {
        this.error.set('Song not found or no preview available');
      }
    } catch (err: any) {
      this.error.set(err.message);
      console.error('❌ Error:', err);
    } finally {
      this.loading.set(false);
    }
  }
}
