"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type ThemeColor = "pink" | "blue" | "green" | "purple" | "orange" | "red";

const themeColorMap: Record<ThemeColor, { light: string; dark: string }> = {
  pink: { light: "#ec4899", dark: "#f472b6" },
  blue: { light: "#0ea5e9", dark: "#38bdf8" },
  green: { light: "#22c55e", dark: "#4ade80" },
  purple: { light: "#a855f7", dark: "#c084fc" },
  orange: { light: "#f97316", dark: "#fb923c" },
  red: { light: "#ef4444", dark: "#f87171" },
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [themeColor, setThemeColorState] = useState<ThemeColor>("pink");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    const savedColor = localStorage.getItem("themeColor") as ThemeColor | null;
    if (saved) {
      setThemeState(saved);
    }
    if (savedColor && themeColorMap[savedColor]) {
      setThemeColorState(savedColor);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && systemDark);

    if (isDark) {
      document.documentElement.classList.add("dark");
      setResolvedTheme("dark");
    } else {
      document.documentElement.classList.remove("dark");
      setResolvedTheme("light");
    }

    const color = themeColorMap[themeColor][isDark ? "dark" : "light"];
    document.documentElement.style.setProperty("--accent", color);
    document.documentElement.style.setProperty("--ring", color);
  }, [theme, themeColor, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const setThemeColor = (newColor: ThemeColor) => {
    setThemeColorState(newColor);
    localStorage.setItem("themeColor", newColor);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themeColor, setThemeColor, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme deve essere usato dentro ThemeProvider");
  }
  return context;
}
