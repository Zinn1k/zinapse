"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_THEME,
  applyThemeToDocument,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";
import { db, GUEST_USER_ID } from "@/lib/db";

interface ThemeContextValue {
  /** Stored preference: light | dark | system */
  theme: ThemePreference;
  /** Concrete theme currently applied to <html> */
  resolved: ResolvedTheme;
  /** True until the client read the persisted preference (avoids icon flicker) */
  ready: boolean;
  setTheme: (preference: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function prefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Mirrors the preference into Dexie so it survives a localStorage wipe. */
async function persistThemeToSettings(preference: ThemePreference): Promise<void> {
  try {
    const existing = await db.settings.get("current");
    if (existing) {
      await db.settings.update("current", { theme: preference });
    } else {
      await db.settings.put({
        id: "current",
        userId: GUEST_USER_ID,
        requestRetention: 0.9,
        theme: preference,
        voiceSpeed: 1,
      });
    }
  } catch {
    /* settings are best-effort; localStorage remains the source of truth */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(DEFAULT_THEME);
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");
  const [ready, setReady] = useState(false);

  const apply = useCallback((preference: ThemePreference) => {
    const next = resolveTheme(preference, prefersDark());
    setResolved(next);
    applyThemeToDocument(next);
    return next;
  }, []);

  // Hydrate from storage + restore theme from Dexie when localStorage was cleared.
  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    apply(stored);
    setReady(true);

    let cancelled = false;
    db.settings
      .get("current")
      .then((settings) => {
        if (cancelled || !settings?.theme) return;
        if (window.localStorage.getItem("zinapse-theme")) return;
        const fallback = resolveTheme(settings.theme, prefersDark());
        setThemeState(settings.theme);
        setResolved(fallback);
        applyThemeToDocument(fallback);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [apply]);

  // Follow the OS when the preference is "system".
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme, apply]);

  // Keep multiple tabs in sync.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "zinapse-theme") return;
      const next = readStoredTheme();
      setThemeState(next);
      apply(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [apply]);

  const setTheme = useCallback(
    (preference: ThemePreference) => {
      setThemeState(preference);
      persistTheme(preference);
      apply(preference);
      void persistThemeToSettings(preference);
    },
    [apply]
  );

  const toggleTheme = useCallback(() => {
    const current = resolveTheme(theme, prefersDark());
    setTheme(current === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolved, ready, setTheme, toggleTheme }),
    [theme, resolved, ready, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return context;
}
