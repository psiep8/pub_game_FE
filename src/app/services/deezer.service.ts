import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface DeezerSong {
  title: string;
  artist: string;
  year: number;
  previewUrl: string;
  albumCover: string;
  duration: 30;
  deezerId: string;
  source: 'deezer';
}

@Injectable({ providedIn: 'root' })
export class DeezerService {

  // 🔥 PROXY CORS - Bypassano restrizioni CORS di Deezer
  private readonly PROXY_URLS = [
    'https://corsproxy.io/?',                    // Opzione 1 (veloce)
    'https://api.allorigins.win/raw?url=',       // Opzione 2 (affidabile)
    'https://api.codetabs.com/v1/proxy?quest=', // Opzione 3 (backup)
  ];

  private currentProxyIndex = 0;
  private readonly API_URL = 'https://api.deezer.com';

  private readonly ICONIC_PLAYLISTS = [
    '1313621735', // Global Top 50
    '1266970301', // Rock Classics
    '1677006641', // All Out 80s
    '1282483245', // All Out 90s
    '1116885485', // All Out 2000s
    '2274453102', // Massive Dance Hits
    '4341381442', // Party Classics
    '1109890211', // Classic Rock Ballads
    '3155776842', // Pop Hits
    '1479458365', // Hip Hop Classics
    '1963962142', // R&B Classics
    '1282495245', // Country Hits
    '7699973782', // Latin Hits
    '3155794842', // Indie Essentials
    '1282489245'  // Soul & Funk
  ];

  constructor(private http: HttpClient) {
    console.log('🎵 Deezer Service initialized with CORS proxy');
  }

  /**
   * 🔥 Costruisce URL con proxy CORS
   */
  private getProxiedUrl(endpoint: string): string {
    const proxy = this.PROXY_URLS[this.currentProxyIndex];
    const fullUrl = `${this.API_URL}${endpoint}`;
    const encodedUrl = encodeURIComponent(fullUrl);

    console.log(`🔗 Using proxy ${this.currentProxyIndex + 1}: ${proxy}`);
    return `${proxy}${encodedUrl}`;
  }

  /**
   * 🔄 Fallback: prova proxy successivo
   */
  private switchProxy(): void {
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.PROXY_URLS.length;
    console.log(`🔄 Switched to proxy ${this.currentProxyIndex + 1}/${this.PROXY_URLS.length}`);
  }

  /**
   * 🎯 FUNZIONE PRINCIPALE: Ottieni canzone random
   */
  async getRandomSong(): Promise<DeezerSong> {
    const maxAttempts = this.PROXY_URLS.length * 2; // Prova ogni proxy 2 volte
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        // Scegli playlist random
        const playlistId = this.ICONIC_PLAYLISTS[
          Math.floor(Math.random() * this.ICONIC_PLAYLISTS.length)
          ];

        console.log(`🎵 Attempt ${attempts + 1}/${maxAttempts}: Fetching playlist ${playlistId}`);

        const endpoint = `/playlist/${playlistId}/tracks?limit=100`;
        const url = this.getProxiedUrl(endpoint);

        // Timeout 10 secondi
        const response = await Promise.race([
          firstValueFrom(this.http.get<any>(url)),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]) as any;

        // Parse response (alcuni proxy wrappano la risposta)
        let tracks = [];

        if (response.data && Array.isArray(response.data)) {
          tracks = response.data;
        } else if (Array.isArray(response)) {
          tracks = response;
        } else {
          console.warn('⚠️ Unexpected response format:', response);
          throw new Error('Invalid response format');
        }

        // Filtra solo tracce con preview
        const tracksWithPreview = tracks.filter(
          (track: any) =>
            track &&
            track.preview &&
            track.title &&
            track.artist &&
            track.artist.name
        );

        if (tracksWithPreview.length === 0) {
          console.warn('⚠️ No tracks with preview, trying another playlist...');
          attempts++;
          continue;
        }

        // Scegli traccia random
        const track = tracksWithPreview[
          Math.floor(Math.random() * tracksWithPreview.length)
          ];

        console.log(`✅ Deezer: ${track.title} - ${track.artist.name}`);

        return {
          title: track.title,
          artist: track.artist.name,
          year: track.album?.release_date
            ? new Date(track.album.release_date).getFullYear()
            : 2020,
          previewUrl: track.preview,
          albumCover: track.album?.cover_xl || track.album?.cover_big || '',
          duration: 30,
          deezerId: track.id?.toString() || 'unknown',
          source: 'deezer'
        };

      } catch (error: any) {
        console.error(`❌ Attempt ${attempts + 1} failed:`, error.message);

        // Switch proxy ogni 2 tentativi
        if (attempts % 2 === 1) {
          this.switchProxy();
        }

        attempts++;

        // Se è l'ultimo tentativo, lancia errore
        if (attempts >= maxAttempts) {
          throw new Error(`Failed dopo ${maxAttempts} tentativi. Tutti i proxy hanno fallito.`);
        }
      }
    }

    throw new Error('Unexpected: loop terminated without result');
  }

  /**
   * Cerca canzone specifica
   */
  async searchSong(query: string): Promise<DeezerSong | null> {
    try {
      const endpoint = `/search?q=${encodeURIComponent(query)}&limit=1`;
      const url = this.getProxiedUrl(endpoint);

      const response = await Promise.race([
        firstValueFrom(this.http.get<any>(url)),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]) as any;

      let tracks = [];
      if (response.data && Array.isArray(response.data)) {
        tracks = response.data;
      } else if (Array.isArray(response)) {
        tracks = response;
      }

      const track = tracks[0];

      if (!track || !track.preview) {
        console.warn('⚠️ Track not found or no preview available');
        return null;
      }

      return {
        title: track.title,
        artist: track.artist.name,
        year: new Date(track.album?.release_date || Date.now()).getFullYear(),
        previewUrl: track.preview,
        albumCover: track.album?.cover_xl || '',
        duration: 30,
        deezerId: track.id?.toString() || 'unknown',
        source: 'deezer'
      };
    } catch (error) {
      console.error('❌ Search failed:', error);
      return null;
    }
  }

  /**
   * Get top chart (fallback)
   */
  async getFromTopChart(): Promise<DeezerSong> {
    try {
      console.log('📊 Fetching from Deezer Top Chart');

      const endpoint = `/chart/0/tracks?limit=50`;
      const url = this.getProxiedUrl(endpoint);

      const response = await Promise.race([
        firstValueFrom(this.http.get<any>(url)),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]) as any;

      let tracks = [];
      if (response.data && Array.isArray(response.data)) {
        tracks = response.data;
      } else if (Array.isArray(response)) {
        tracks = response;
      }

      const tracksWithPreview = tracks.filter((t: any) => t.preview);

      if (tracksWithPreview.length === 0) {
        throw new Error('No tracks with preview in top chart');
      }

      const track = tracksWithPreview[
        Math.floor(Math.random() * tracksWithPreview.length)
        ];

      return {
        title: track.title,
        artist: track.artist.name,
        year: 2024,
        previewUrl: track.preview,
        albumCover: track.album?.cover_xl || '',
        duration: 30,
        deezerId: track.id?.toString() || 'unknown',
        source: 'deezer'
      };
    } catch (error) {
      console.error('❌ Top chart failed:', error);
      throw new Error('Impossibile ottenere canzone da Deezer');
    }
  }

  /**
   * Reset proxy index (per testing)
   */
  resetProxy(): void {
    this.currentProxyIndex = 0;
    console.log('🔄 Proxy reset to index 0');
  }

  /**
   * Get current proxy info (per debugging)
   */
  getCurrentProxyInfo(): { index: number; url: string; total: number } {
    return {
      index: this.currentProxyIndex,
      url: this.PROXY_URLS[this.currentProxyIndex],
      total: this.PROXY_URLS.length
    };
  }
}
