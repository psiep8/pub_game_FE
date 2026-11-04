import { Injectable, signal } from '@angular/core';

export type AppTheme = 'ink' | 'sabbia';

const STORAGE_KEY = 'pubgame-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<AppTheme>(this.readSavedTheme());

  constructor() {
    this.apply(this.theme());

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key !== STORAGE_KEY) return;
        const next: AppTheme = event.newValue === 'sabbia' ? 'sabbia' : 'ink';
        this.theme.set(next);
        this.apply(next, false);
      });
    }
  }

  toggle(): void {
    this.set(this.theme() === 'ink' ? 'sabbia' : 'ink');
  }

  set(next: AppTheme): void {
    this.theme.set(next);
    this.apply(next);
  }

  label(): string {
    return this.theme() === 'sabbia' ? 'SABBIA' : 'INCHIOSTRO';
  }

  private readSavedTheme(): AppTheme {
    if (typeof localStorage === 'undefined') return 'ink';
    try {
      return localStorage.getItem(STORAGE_KEY) === 'sabbia' ? 'sabbia' : 'ink';
    } catch {
      return 'ink';
    }
  }

  private apply(theme: AppTheme, persist = true): void {
    if (typeof document === 'undefined') return;

    document.documentElement.setAttribute('data-theme', theme);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'sabbia' ? '#211a14' : '#111109');
    }

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Storage può essere negato in modalità privata: il tema resta attivo.
      }
    }
  }
}
