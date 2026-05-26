import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, type Colors } from '../constants/theme';

export type AppearanceMode = 'auto' | 'light' | 'dark';

const THEME_KEY = 'kayak_theme_v1';

interface ThemeCtx {
  colors: Colors;
  isDark: boolean;
  mode: AppearanceMode;
  setMode: (m: AppearanceMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeCtx>({
  colors: lightColors,
  isDark: false,
  mode: 'auto',
  setMode: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppearanceMode>('auto');
  const [systemDark, setSystemDark] = useState(Appearance.getColorScheme() === 'dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'auto') setModeState(v);
    });
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemDark(colorScheme === 'dark');
    });
    return () => sub.remove();
  }, []);

  const isDark = mode === 'dark' || (mode === 'auto' && systemDark);
  const resolvedColors = isDark ? darkColors : lightColors;

  async function setMode(m: AppearanceMode) {
    setModeState(m);
    await AsyncStorage.setItem(THEME_KEY, m);
  }

  return (
    <ThemeContext.Provider value={{ colors: resolvedColors, isDark, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
