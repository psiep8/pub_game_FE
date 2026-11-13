import { Injectable, signal } from '@angular/core';

/** I sette temi cromatici dell'applicativo. `editorial-acid` è il predefinito. */
export const THEMES = [
  'editorial-acid',
  'desert-heritage',
  'arctic-noir',
  'deep-ocean',
  'kpop-aesthetic',
  'neon-cyberpunk',
  'sunset-pop',
] as const;

export type AppTheme = (typeof THEMES)[number];

const STORAGE_KEY = 'pubgame-theme';
const XMAS_KEY = 'pubgame-xmas';

/** Nome corto mostrato dal tasto tema su TV, telefono e regia. */
const LABELS: Record<AppTheme, string> = {
  'editorial-acid': 'ACIDO',
  'desert-heritage': 'SABBIA',
  'arctic-noir': 'ARTICO',
  'deep-ocean': 'OCEANO',
  'kpop-aesthetic': 'K-POP',
  'neon-cyberpunk': 'CYBER',
  'sunset-pop': 'SUNSET',
};

/** Barra di stato del telefono: lo stesso --bg-0 del tema. */
const STATUS_COLORS: Record<AppTheme, string> = {
  'editorial-acid': '#111109',
  'desert-heritage': '#211a14',
  'arctic-noir': '#080f1a',
  'deep-ocean': '#071f26',
  'kpop-aesthetic': '#21172b',
  'neon-cyberpunk': '#090713',
  'sunset-pop': '#25142a',
};

/** Nomi precedenti: `ink` era Editorial Acid, `sabbia` Desert Heritage. */
const LEGACY_NAMES: Record<string, AppTheme> = {
  ink: 'editorial-acid',
  sabbia: 'desert-heritage',
};

/** Accetta slug, nomi vecchi o valori sporchi e restituisce sempre un tema valido. */
export function normalizeTheme(value: string | null | undefined): AppTheme {
  if (!value) return 'editorial-acid';
  const legacy = LEGACY_NAMES[value];
  if (legacy) return legacy;
  return (THEMES as readonly string[]).includes(value) ? (value as AppTheme) : 'editorial-acid';
}

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
        const next = normalizeTheme(event.newValue);
        this.theme.set(next);
        this.apply(next, false);
      });
    }
  }

  /** Il tasto tema gira su tutti e sette i temi, in ordine fisso. */
  toggle(): void {
    this.set(this.nextTheme());
  }

  nextTheme(): AppTheme {
    const index = THEMES.indexOf(this.theme());
    return THEMES[(index + 1) % THEMES.length];
  }

  toggleXmas(): void {
    this.setXmas(!this.xmas());
  }

  setXmas(enabled: boolean): void {
    this.xmas.set(!!enabled);
    this.applyXmas(!!enabled);
  }

  set(next: AppTheme | string): void {
    const theme = normalizeTheme(next);
    this.theme.set(theme);
    this.apply(theme);
  }

  label(): string {
    return LABELS[this.theme()];
  }

  private readSavedTheme(): AppTheme {
    if (typeof localStorage === 'undefined') return 'editorial-acid';
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY));
    } catch {
      return 'editorial-acid';
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
      meta.setAttribute('content', STATUS_COLORS[theme]);
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
