import { describe, it, expect } from "vitest";
import { computeFSRSMetrics } from "../analytics";
import type { FSRSStateRecord } from "../db";

describe("FSRS Analytics & 7-Day Forecast Computation", () => {
  const baseDate = new Date("2026-05-10T10:00:00Z");
  const startOfDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()).getTime();

  it("handles empty card collection", () => {
    const res = computeFSRSMetrics([], [], [], baseDate);
    expect(res.totalCards).toBe(0);
    expect(res.trackedCards).toBe(0);
    expect(res.newCount).toBe(0);
    expect(res.dueTodayCount).toBe(0);
    expect(res.forecast7Days.length).toBe(7);
    expect(res.forecast7Days[0].isToday).toBe(true);
    expect(res.forecast7Days[0].dayLabel).toBe("Сегодня");
  });

  it("correctly counts untracked cards as New", () => {
    const cards = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
    const res = computeFSRSMetrics(cards, [], [], baseDate);
    expect(res.totalCards).toBe(3);
    expect(res.newCount).toBe(3);
    expect(res.learningCount).toBe(0);
    expect(res.reviewCount).toBe(0);
  });

  it("calculates state breakdowns, stability, and difficulty", () => {
    const cards = [{ id: "c1" }, { id: "c2" }, { id: "c3" }, { id: "c4" }];
    const states: FSRSStateRecord[] = [
      {
        id: "fs1",
        cardId: "c1",
        deckId: "d1",
        userId: "u1",
        state: 1, // Learning
        due: startOfDay + 2000, // Due today
        stability: 1.5,
        difficulty: 4.0,
        elapsed_days: 0,
        scheduled_days: 1,
        reps: 1,
        lapses: 0,
        last_review: startOfDay,
      },
      {
        id: "fs2",
        cardId: "c2",
        deckId: "d1",
        userId: "u1",
        state: 2, // Review
        due: startOfDay + 86400000 * 2, // Due in 2 days
        stability: 14.5,
        difficulty: 3.0,
        elapsed_days: 2,
        scheduled_days: 14,
        reps: 3,
        lapses: 0,
        last_review: startOfDay,
      },
    ];

    const logs = [
      { cardId: "c1", userId: "u1" },
      { cardId: "c2", userId: "u1" },
      { cardId: "c2", userId: "u1" },
    ];

    const res = computeFSRSMetrics(cards, states, logs, baseDate);
    expect(res.totalCards).toBe(4);
    expect(res.trackedCards).toBe(2);
    expect(res.learningCount).toBe(1);
    expect(res.reviewCount).toBe(1);
    expect(res.newCount).toBe(2); // 2 untracked cards
    expect(res.dueTodayCount).toBe(1); // c1 is due today
    expect(res.totalReviews).toBe(3);
    expect(res.avgStabilityDays).toBe(8); // (1.5 + 14.5) / 2 = 8
    expect(res.avgDifficulty).toBe(3.5); // (4.0 + 3.0) / 2 = 3.5

    // Forecast: day 0 has 1 due, day 2 has 1 due
    expect(res.forecast7Days[0].count).toBe(1);
    expect(res.forecast7Days[2].count).toBe(1);
  });
});
