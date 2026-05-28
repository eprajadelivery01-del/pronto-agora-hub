import { createContext, useContext, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  return (
    <ThemeContext.Provider value={{ theme: "light", setTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
