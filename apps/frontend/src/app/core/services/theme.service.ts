import { Injectable, signal } from '@angular/core';

/** Gli otto temi cromatici dell'applicativo. `editorial-acid` è il predefinito. */
export const THEMES = [
  'editorial-acid',
  'desert-heritage',
  'arctic-noir',
  'deep-ocean',
  'kpop-aesthetic',
  'neon-cyberpunk',
  'sunset-pop',
  'premium-gold',
] as const;

export type AppTheme = (typeof THEMES)[number];

const STORAGE_KEY = 'pubgame-theme';
const XMAS_KEY = 'pubgame-xmas';

/** Nome corto mostrato dal tasto tema su TV, telefono e regia. */
export const LABELS: Record<AppTheme, string> = {
  'editorial-acid': 'ACIDO',
  'desert-heritage': 'SABBIA',
  'arctic-noir': 'ARTICO',
  'deep-ocean': 'OCEANO',
  'kpop-aesthetic': 'K-POP',
  'neon-cyberpunk': 'CYBER',
  'sunset-pop': 'SUNSET',
  'premium-gold': 'ORO',
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
  'premium-gold': '#101820',
};

/**
 * Colore con cui una squadra si riconosce nella classifica della serata.
 * Deve restare leggibile sulla carta chiara (tema Editorial Acid), quindi per
 * i temi a base scura è la versione scura dell'accento, non quella fluo.
 */
export const TEAM_INK: Record<AppTheme, string> = {
  'editorial-acid': '#57661b',
  'desert-heritage': '#8f4929',
  'arctic-noir': '#2f6984',
  'deep-ocean': '#107469',
  'kpop-aesthetic': '#a34d75',
  'neon-cyberpunk': '#cc0086',
  'sunset-pop': '#ad5240',
  'premium-gold': '#8f6b1f',
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

/** Le otto scelte mostrate sul telefono prima del tutorial, in ordine fisso. */
export const THEME_OPTIONS: ReadonlyArray<{ id: AppTheme; label: string }> = THEMES.map((id) => ({
  id,
  label: LABELS[id],
}));

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<AppTheme>(this.readSavedTheme());
  /** Tema di Natale: nevischio leggero su TV, telefoni e admin. */
  readonly xmas = signal<boolean>(this.readSavedXmas());
  /** Palette scelta da ogni squadra: la TV la usa per i colori dei nomi. */
  readonly teamThemes = signal<Partial<Record<string, AppTheme>>>({});
  /**
   * Sul telefono il colore si sceglie una volta sola, prima del tutorial: dopo
   * l'ingresso in partita il tasto sparisce e `set()` non cambia più nulla.
   */
  private locked = false;

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

  /** Il tasto tema gira su tutti gli otto temi, in ordine fisso. */
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
    if (this.locked) return;
    const theme = normalizeTheme(next);
    this.theme.set(theme);
    this.apply(theme);
  }

  /** Chiude la scelta: da qui in poi il tema del telefono è quello della partita. */
  lock(): void {
    this.locked = true;
  }

  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Tema imposto dalla TV (o da un altro dispositivo): scavalca il blocco, perché
   * il blocco riguarda solo la scelta locale del telefono.
   */
  applyFromRemote(next: AppTheme | string): void {
    const theme = normalizeTheme(next);
    this.theme.set(theme);
    this.apply(theme);
  }

  /** La TV registra la palette di una squadra appena entra. */
  setTeamTheme(playerName: string, theme: AppTheme | string): void {
    const name = playerName.trim();
    if (!name) return;
    this.teamThemes.update((map) => ({ ...map, [name]: normalizeTheme(theme) }));
  }

  themeForTeam(playerName: string): AppTheme {
    return this.teamThemes()[playerName.trim()] ?? 'editorial-acid';
  }

  /** Colore del nome in classifica, sempre leggibile sulla carta chiara. */
  teamColor(playerName: string): string {
    return TEAM_INK[this.themeForTeam(playerName)];
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
