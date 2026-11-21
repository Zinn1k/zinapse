import { describe, it, expect } from "vitest";
import {
  DEFAULT_THEME,
  isThemePreference,
  resolveTheme,
  type ThemePreference,
} from "../theme";

describe("theme resolution", () => {
  it("resolves explicit preferences", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the system preference only when asked to", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("falls back to the default theme for unknown or missing values", () => {
    expect(resolveTheme(null, true)).toBe(DEFAULT_THEME);
    expect(resolveTheme("midnight", true)).toBe(DEFAULT_THEME);
    expect(resolveTheme(undefined, false)).toBe(DEFAULT_THEME);
  });

  it("recognises only supported preferences", () => {
    const valid: ThemePreference[] = ["light", "dark", "system"];
    for (const value of valid) {
      expect(isThemePreference(value)).toBe(true);
    }
    for (const value of ["", "DARK", "auto", null, 42]) {
      expect(isThemePreference(value)).toBe(false);
    }
  });
});
