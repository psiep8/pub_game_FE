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
const TEAM_DEFAULTS_KEY = 'pubgame.team-defaults';
const TEAM_CHOSEN_KEY = 'pubgame.team-themes';
const TEAM_HISTORY_KEY = 'pubgame.team-history';

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
  readonly teamThemes = signal<Partial<Record<string, AppTheme>>>(this.readTeamChosen());
  /**
   * Palette assegnata d'ufficio alle squadre che non hanno scelto. Senza,
   * tutte restano in acido e il tema del vincitore non si vede in sala.
   */
  readonly teamDefaults = signal<Partial<Record<string, AppTheme>>>(this.readTeamDefaults());
  /**
   * Ultima palette avuta da ogni nome, anche dopo l'espulsione: al rientro la
   * squadra ritrova il suo colore, così in sala non cambia identità. Se nel
   * frattempo l'ha presa un'altra squadra, ne riceve una libera.
   */
  readonly teamHistory = signal<Partial<Record<string, AppTheme>>>(this.readTeamHistory());
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
    const normalized = normalizeTheme(theme);
    this.teamThemes.update((map) => ({ ...map, [name]: normalized }));
    // Su disco come le assegnate: dopo un refresh della TV la squadra ritrova il colore.
    this.persistTeamChosen();
    // La scelta entra anche in memoria: se la squadra esce, la ritrova al rientro.
    this.teamHistory.update((map) => ({ ...map, [name]: normalized }));
    this.persistTeamHistory();
    // La scelta esplicita prende il posto della palette assegnata d'ufficio.
    this.forgetDefault(name);
  }

  /**
   * Assegna alla squadra una palette distinta, se non ne ha ancora una.
   *
   * <p>La TV la chiama all'ingresso di ogni squadra: chi sceglie il colore sul
   * telefono lo vede comunque rispettato, chi non sceglie non resta nell'acido
   * uguale a tutti, e il tema del round vinto cambia davvero in sala. Fino a
   * otto squadre le palette sono tutte diverse; oltre, il giro ricomincia.</p>
   */
  ensureTeamTheme(playerName: string): AppTheme {
    const name = playerName.trim();
    if (!name) return 'editorial-acid';

    const chosen = this.teamThemes()[name];
    if (chosen) return chosen;

    const existing = this.teamDefaults()[name];
    if (existing) return existing;

    const remembered = this.teamHistory()[name];
    if (remembered && this.isThemeFree(remembered)) {
      this.assignDefaultTheme(name, remembered);
      return remembered;
    }

    const assigned = this.nextFreeTeamTheme();
    this.assignDefaultTheme(name, assigned);
    return assigned;
  }

  /**
   * Libera la palette della squadra espulsa, assegnata o scelta che sia.
   *
   * <p>Senza questo, ogni rientro consumerebbe una palette per sempre e dopo
   * qualche espulsione tutte le squadre nuove finirebbero nello stesso colore.
   * La palette non si perde: finisce nella memoria e torna alla squadra al
   * rientro, se nel frattempo nessun altro l'ha presa.</p>
   */
  releaseTeamTheme(playerName: string): void {
    const name = playerName.trim();
    if (!name) return;

    const chosen = this.teamThemes()[name];
    if (chosen) {
      this.teamHistory.update((map) => ({ ...map, [name]: chosen }));
      this.persistTeamHistory();
      const next = { ...this.teamThemes() };
      delete next[name];
      this.teamThemes.set(next);
      this.persistTeamChosen();
    }

    this.forgetDefault(name);
  }

  /** Nuova partita: si riparte con tutte le palette libere, scelte e memoria comprese. */
  resetTeamThemes(): void {
    this.teamDefaults.set({});
    this.teamThemes.set({});
    this.teamHistory.set({});
    this.persistTeamDefaults();
    this.persistTeamChosen();
    this.persistTeamHistory();
  }

  themeForTeam(playerName: string): AppTheme {
    const name = playerName.trim();
    return this.teamThemes()[name] ?? this.teamDefaults()[name] ?? 'editorial-acid';
  }

  /** Colore del nome in classifica, sempre leggibile sulla carta chiara. */
  teamColor(playerName: string): string {
    return TEAM_INK[this.themeForTeam(playerName)];
  }

  label(): string {
    return LABELS[this.theme()];
  }

  /**
   * Prima palette non usata; finite le otto, si riparte in ciclo. L'acido è
   * l'ultima della lista: è il colore neutro della TV, quindi lo si assegna
   * solo all'ottava squadra e non alla prima.
   */
  private nextFreeTeamTheme(): AppTheme {
    const order: AppTheme[] = [...THEMES.slice(1), THEMES[0]];
    const defaults = this.teamDefaults();
    const used = new Set<AppTheme>(Object.values(defaults).filter(Boolean) as AppTheme[]);
    for (const theme of Object.values(this.teamThemes())) {
      if (theme) used.add(theme);
    }

    const free = order.find((theme) => !used.has(theme));
    if (free) return free;
    return order[Object.keys(defaults).length % order.length];
  }

  /** Una palette è libera se nessun'altra squadra la sta usando. */
  private isThemeFree(theme: AppTheme): boolean {
    return !Object.values(this.teamDefaults()).includes(theme)
      && !Object.values(this.teamThemes()).includes(theme);
  }

  /** Assegna e ricorda: la memoria serve al rientro dopo un'espulsione. */
  private assignDefaultTheme(playerName: string, theme: AppTheme): void {
    this.teamDefaults.update((map) => ({ ...map, [playerName]: theme }));
    this.teamHistory.update((map) => ({ ...map, [playerName]: theme }));
    this.persistTeamDefaults();
    this.persistTeamHistory();
  }

  private forgetDefault(playerName: string): void {
    const defaults = this.teamDefaults();
    if (!defaults[playerName]) return;
    const next = { ...defaults };
    delete next[playerName];
    this.teamDefaults.set(next);
    this.persistTeamDefaults();
  }

  private persistTeamDefaults(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(TEAM_DEFAULTS_KEY, JSON.stringify(this.teamDefaults()));
    } catch {
      // Storage negato: le palette restano valide per la sessione.
    }
  }

  private persistTeamChosen(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(TEAM_CHOSEN_KEY, JSON.stringify(this.teamThemes()));
    } catch {
      // Storage negato: la scelta resta valida per la sessione.
    }
  }

  private persistTeamHistory(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(TEAM_HISTORY_KEY, JSON.stringify(this.teamHistory()));
    } catch {
      // Storage negato: la memoria vale solo per questa sessione.
    }
  }

  private readTeamChosen(): Partial<Record<string, AppTheme>> {
    return this.readTeamMap(TEAM_CHOSEN_KEY);
  }

  private readTeamHistory(): Partial<Record<string, AppTheme>> {
    return this.readTeamMap(TEAM_HISTORY_KEY);
  }

  private readTeamDefaults(): Partial<Record<string, AppTheme>> {
    return this.readTeamMap(TEAM_DEFAULTS_KEY);
  }

  /** Legge una mappa nome→palette salvata, scartando voci vuote o corrotte. */
  private readTeamMap(key: string): Partial<Record<string, AppTheme>> {
    if (typeof localStorage === 'undefined') return {};
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return {};

      const clean: Partial<Record<string, AppTheme>> = {};
      for (const [name, theme] of Object.entries(parsed)) {
        const trimmed = name.trim();
        if (!trimmed) continue;
        clean[trimmed] = normalizeTheme(String(theme));
      }
      return clean;
    } catch {
      return {};
    }
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
