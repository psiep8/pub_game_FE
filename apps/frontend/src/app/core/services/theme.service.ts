import { Injectable, signal } from '@angular/core';

export type AppTheme = 'ink' | 'sabbia';

const STORAGE_KEY = 'pubgame-theme';
const XMAS_KEY = 'pubgame-xmas';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<AppTheme>(this.readSavedTheme());
  /** Tema di Natale: nevischio leggero su TV, telefoni e admin. */
  readonly xmas = signal<boolean>(this.readSavedXmas());

  constructor() {
    this.apply(this.theme());
    this.applyXmas(this.xmas());

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === XMAS_KEY) {
          const enabled = event.newValue === '1';
          this.xmas.set(enabled);
          this.applyXmas(enabled, false);
          return;
        }
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

  toggleXmas(): void {
    this.setXmas(!this.xmas());
  }

  setXmas(enabled: boolean): void {
    this.xmas.set(!!enabled);
    this.applyXmas(!!enabled);
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

  private readSavedXmas(): boolean {
    if (typeof localStorage === 'undefined') return false;
    try {
      return localStorage.getItem(XMAS_KEY) === '1';
    } catch {
      return false;
    }
  }

  private applyXmas(enabled: boolean, persist = true): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-xmas', enabled ? 'on' : 'off');
    }

    if (persist) {
      try {
        localStorage.setItem(XMAS_KEY, enabled ? '1' : '0');
      } catch {
        // Storage negato: il tema resta attivo nella sessione.
      }
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
