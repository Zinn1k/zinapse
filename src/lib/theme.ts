/**
 * Theme preference helpers.
 *
 * The app supports three preferences: `light`, `dark` and `system`.
 * The *resolved* theme is always either `light` or `dark` — that value is what
 * ends up as the `dark` class on <html>. Tailwind reads it through the
 * `@custom-variant dark` rule declared in globals.css.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "zinapse-theme";

export const DEFAULT_THEME: ThemePreference = "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Resolves a stored preference into a concrete theme.
 * Unknown values fall back to the default (dark), never throw.
 */
export function resolveTheme(
  preference: ThemePreference | string | null | undefined,
  prefersDark: boolean
): ResolvedTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  if (preference === "system") return prefersDark ? "dark" : "light";
  return "dark";
}

/** Safely reads the persisted preference (SSR / privacy modes included). */
export function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Persists the preference; failures (Safari private mode) are non-fatal. */
export function persistTheme(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* storage disabled — theme still applies for the session */
  }
}

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#fafafc",
  dark: "#08080c",
};

/** Applies the resolved theme to <html> so CSS variables and `dark:` flip together. */
export function applyThemeToDocument(theme: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;

  // Keep the Android status bar / PWA title bar in sync with the active theme.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = THEME_COLORS[theme];
  }
}

/**
 * Blocking snippet injected before first paint to avoid a light/dark flash.
 * Kept as a string so it can be inlined in the document head.
 */
export function getThemeInitScript(): string {
  return `(function(){try{var k="${THEME_STORAGE_KEY}";var s=localStorage.getItem(k);var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var d=s==="light"?"light":s==="dark"?"dark":s==="system"?(m?"dark":"light"):"dark";var r=document.documentElement;if(d==="dark")r.classList.add("dark");else r.classList.remove("dark");r.style.colorScheme=d;}catch(e){document.documentElement.classList.add("dark");}})();`;
}
