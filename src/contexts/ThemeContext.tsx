import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    localStorage.setItem('theme', theme);

    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      if (theme === 'dark') {
        StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
        StatusBar.setBackgroundColor({ color: '#0D0D0D' }).catch(() => {});
      } else {
        StatusBar.setStyle({ style: Style.Light }).catch(() => {});
        StatusBar.setBackgroundColor({ color: '#FFFFFF' }).catch(() => {});
      }
    }
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => setThemeState(t => t === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
