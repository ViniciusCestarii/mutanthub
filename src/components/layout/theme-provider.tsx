"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { THEME_STORAGE_KEY, type ResolvedTheme, type Theme } from "./theme-script";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme | undefined;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : "system";
  } catch {
    return "system";
  }
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(theme: Theme): ResolvedTheme {
  return theme === "system" ? systemTheme() : theme;
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
}

/**
 * Minimal light/dark/system theme provider. The document class is applied
 * before hydration by the inline script in `theme-script.ts` (rendered via
 * `ThemeBootstrap` with the CSP nonce) and re-applied on mount in case a root
 * layout remount wiped it. This provider renders identically on the server and
 * on the first client pass, then syncs its state from storage after mount so
 * hydration never has to reconcile a mismatch.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme | undefined>(undefined);

  useLayoutEffect(() => {
    // A root layout remount (dev Strict Mode, server action redirect) resets
    // <html> attributes and wipes the bootstrap's class; re-apply before paint.
    applyTheme(resolve(readStoredTheme()));
  }, []);

  useEffect(() => {
    // Post-mount sync from browser-only sources (localStorage, matchMedia); the
    // document class is already correct, only React state needs to catch up.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(readStoredTheme());
    setResolvedTheme(resolve(readStoredTheme()));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (readStoredTheme() !== "system") return;
      const next = systemTheme();
      setResolvedTheme(next);
      applyTheme(next);
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    try {
      if (next === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable: the change still applies for this page */
    }
    const resolved = resolve(next);
    setThemeState(next);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
