export const THEME_STORAGE_KEY = 'turquesa.theme';
export const PALETTE_STORAGE_KEY = 'turquesa.palette';

export type ThemeMode = 'light' | 'dark';
export type PaletteId = 'turquesa' | 'grafite' | 'navy' | 'bronze';

export const PALETTE_OPTIONS: {
  id: PaletteId;
  label: string;
  hint: string;
  swatch: string;
}[] = [
  { id: 'turquesa', label: 'Turquesa', hint: 'Clássico do salão', swatch: '#047482' },
  { id: 'grafite', label: 'Grafite', hint: 'Sóbrio, mais masculino', swatch: '#2C3338' },
  { id: 'navy', label: 'Marinho', hint: 'Azul profundo', swatch: '#1E3A5F' },
  { id: 'bronze', label: 'Bronze', hint: 'Quente e seco', swatch: '#6B4F2A' },
];

export const THEME_OPTIONS: { id: ThemeMode; label: string; hint: string }[] = [
  { id: 'light', label: 'Claro', hint: 'Fundo claro, leitura no salão' },
  { id: 'dark', label: 'Escuro', hint: 'Menos brilho à noite' },
];

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

export function isPaletteId(value: string | null): value is PaletteId {
  return (
    value === 'turquesa' ||
    value === 'grafite' ||
    value === 'navy' ||
    value === 'bronze'
  );
}

export function readStoredTheme(): { theme: ThemeMode; palette: PaletteId } {
  if (typeof window === 'undefined') {
    return { theme: 'light', palette: 'turquesa' };
  }
  try {
    const themeRaw = window.localStorage.getItem(THEME_STORAGE_KEY);
    const paletteRaw = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    return {
      theme: isThemeMode(themeRaw) ? themeRaw : 'light',
      palette: isPaletteId(paletteRaw) ? paletteRaw : 'turquesa',
    };
  } catch {
    return { theme: 'light', palette: 'turquesa' };
  }
}

export function applyAppearance(theme: ThemeMode, palette: PaletteId) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.palette = palette;
  root.style.colorScheme = theme;
  const primary =
    getComputedStyle(root).getPropertyValue('--brand-primary').trim() ||
    '#047482';
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', primary);
}

export function persistAppearance(theme: ThemeMode, palette: PaletteId) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  } catch {
    /* private mode */
  }
  applyAppearance(theme, palette);
}

export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var p=localStorage.getItem('${PALETTE_STORAGE_KEY}');if(t!=='light'&&t!=='dark')t='light';if(p!=='turquesa'&&p!=='grafite'&&p!=='navy'&&p!=='bronze')p='turquesa';var r=document.documentElement;r.dataset.theme=t;r.dataset.palette=p;r.style.colorScheme=t;}catch(e){}})();`;
