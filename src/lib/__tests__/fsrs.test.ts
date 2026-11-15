import { describe, it, expect } from "vitest";
import {
  formatFSRSInterval,
  recordToFSRSCard,
  fsrsCardToRecord,
  Rating,
  State,
} from "../fsrs";
import { fsrs, generatorParameters, createEmptyCard } from "ts-fsrs";

describe("FSRS scheduler and helpers", () => {
  it("formats short intervals into minutes", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const due10m = new Date("2026-01-01T12:10:00Z");
    expect(formatFSRSInterval(due10m, now, "ru")).toBe("10 мин");
    expect(formatFSRSInterval(due10m, now, "en")).toBe("10m");
  });

  it("formats multi-day intervals", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const due4d = new Date("2026-01-05T12:00:00Z");
    expect(formatFSRSInterval(due4d, now, "ru")).toBe("4 дн");
    expect(formatFSRSInterval(due4d, now, "en")).toBe("4d");
  });

  it("formats overdue or immediate intervals as < 1 min", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const duePast = new Date("2026-01-01T11:59:00Z");
    expect(formatFSRSInterval(duePast, now, "ru")).toBe("< 1 мин");
  });

  it("converts between DB record and ts-fsrs Card correctly", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const empty = createEmptyCard(now);

    const record = fsrsCardToRecord(empty, "card_123", "deck_456", "user_789");
    expect(record.cardId).toBe("card_123");
    expect(record.deckId).toBe("deck_456");
    expect(record.userId).toBe("user_789");
    expect(record.due).toBe(now.getTime());
    expect(record.state).toBe(State.New);

    const restored = recordToFSRSCard(record);
    expect(restored.due.getTime()).toBe(now.getTime());
    expect(restored.state).toBe(State.New);
  });

  it("schedules next intervals using ts-fsrs algorithm", () => {
    const f = fsrs(generatorParameters({ request_retention: 0.9 }));
    const now = new Date("2026-01-01T12:00:00Z");
    const card = createEmptyCard(now);

    const recordItem = f.repeat(card, now);

    // Again (1), Hard (2), Good (3), Easy (4)
    const againCard = recordItem[Rating.Again].card;
    const goodCard = recordItem[Rating.Good].card;
    const easyCard = recordItem[Rating.Easy].card;

    // Good and Easy should advance scheduled days further than Again
    expect(againCard.state).toBe(State.Learning);
    expect(goodCard.due.getTime()).toBeGreaterThan(againCard.due.getTime());
    expect(easyCard.due.getTime()).toBeGreaterThanOrEqual(goodCard.due.getTime());
  });
});
