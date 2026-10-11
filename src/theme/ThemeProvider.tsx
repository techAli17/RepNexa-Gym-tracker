import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import type { ThemePreference } from '../domain/models';
import { makeTheme, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(makeTheme(false));

export function ThemeProvider({ preference, children }: { preference: ThemePreference; children: React.ReactNode }) {
  const system = useColorScheme();
  const dark = preference === 'dark' || (preference === 'system' && system === 'dark');
  const theme = useMemo(() => makeTheme(dark), [dark]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/** Memoized StyleSheet factory that rebuilds only when the theme changes. */
export function useStyles<T>(factory: (t: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
