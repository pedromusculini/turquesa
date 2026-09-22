'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  applyAppearance,
  persistAppearance,
  readStoredTheme,
  type PaletteId,
  type ThemeMode,
} from '@/lib/visual/theme';

type ThemeContextValue = {
  theme: ThemeMode;
  palette: PaletteId;
  setTheme: (theme: ThemeMode) => void;
  setPalette: (palette: PaletteId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [{ theme, palette }, setState] = useState(readStoredTheme);

  useEffect(() => {
    applyAppearance(theme, palette);
  }, [theme, palette]);

  const setTheme = useCallback((next: ThemeMode) => {
    setState((prev) => {
      persistAppearance(next, prev.palette);
      return { ...prev, theme: next };
    });
  }, []);

  const setPalette = useCallback((next: PaletteId) => {
    setState((prev) => {
      persistAppearance(prev.theme, next);
      return { ...prev, palette: next };
    });
  }, []);

  const value = useMemo(
    () => ({ theme, palette, setTheme, setPalette }),
    [theme, palette, setTheme, setPalette],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppearance precisa do ThemeProvider');
  }
  return ctx;
}
