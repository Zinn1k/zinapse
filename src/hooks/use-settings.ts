"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type UserSettings } from "@/lib/db";

export const DEFAULT_REQUEST_RETENTION = 0.9;
export const DEFAULT_VOICE_SPEED = 1;
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export const DEFAULT_SETTINGS: Omit<UserSettings, "userId"> = {
  id: "current",
  requestRetention: DEFAULT_REQUEST_RETENTION,
  theme: "dark",
  voiceSpeed: DEFAULT_VOICE_SPEED,
  geminiModel: DEFAULT_GEMINI_MODEL,
};

export interface UseSettingsResult {
  /** Persisted settings merged with defaults — never undefined. */
  settings: Omit<UserSettings, "userId">;
  /** Convenience alias used by the FSRS engines. */
  requestRetention: number;
  /** False while the IndexedDB read is in flight. */
  loaded: boolean;
}

/**
 * Live view over the single `settings` row.
 *
 * Every scheduler call must read the retention target from here instead of
 * hard-coding 0.9, otherwise the Settings slider silently does nothing.
 */
export function useSettings(userId?: string): UseSettingsResult {
  const record = useLiveQuery(() => db.settings.get("current"), [], undefined);

  const settings = {
    ...DEFAULT_SETTINGS,
    ...(record ?? {}),
    userId: record?.userId ?? userId ?? "",
  };

  const retention =
    typeof settings.requestRetention === "number" &&
    settings.requestRetention >= 0.7 &&
    settings.requestRetention <= 0.99
      ? settings.requestRetention
      : DEFAULT_REQUEST_RETENTION;

  return {
    settings,
    requestRetention: retention,
    loaded: record !== undefined,
  };
}
