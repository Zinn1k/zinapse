import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { fsrs, generatorParameters, createEmptyCard, type Card as FSRSCard } from "ts-fsrs";
import { db, type Card, type Deck } from "../db";
import {
  rateCardFSRS,
  fsrsCardToRecord,
  getFSRSIntervalPreviews,
  calculateDeckFSRSStats,
  calculateLibraryStats,
  NEW_CARD_DAILY_LIMIT,
  Rating,
  State,
} from "../fsrs";

const USER = "user_test";
const NOW = new Date("2026-03-01T10:00:00Z");

async function resetDb() {
  await Promise.all([
    db.decks.clear(),
    db.cards.clear(),
    db.fsrs_states.clear(),
    db.review_logs.clear(),
    db.sync_queue.clear(),
    db.settings.clear(),
  ]);
}

async function seedDeck(cardCount: number, deckId = "deck_1") {
  const deck: Deck = {
    id: deckId,
    ownerId: USER,
    title: "Test deck",
    description: "",
    isPublic: false,
    shareCode: "ABC123",
    createdAt: NOW.getTime(),
    updatedAt: NOW.getTime(),
  };
  const cards: Card[] = Array.from({ length: cardCount }, (_, i) => ({
    id: `card_${deckId}_${i}`,
    deckId,
    term: `term ${i}`,
    definition: `definition ${i}`,
    order: i,
    createdAt: NOW.getTime(),
    updatedAt: NOW.getTime(),
  }));
  await db.decks.put(deck);
  await db.cards.bulkPut(cards);
  return { deck, cards };
}

/** Builds a card already in the Review phase so retention changes its interval. */
function reviewPhaseCard(): FSRSCard {
  let card = createEmptyCard(NOW);
  let at = NOW;
  const scheduler = fsrs(generatorParameters({ request_retention: 0.9 }));
  for (let i = 0; i < 4; i++) {
    card = scheduler.next(card, at, Rating.Good).card;
    at = new Date(card.due);
  }
  return card;
}

describe("FSRS scheduling invariants", () => {
  beforeEach(resetDb);

  it("Cram Mode never mutates the long-term schedule", async () => {
    const { cards } = await seedDeck(1);
    const cardId = cards[0].id;

    await rateCardFSRS(cardId, "deck_1", USER, Rating.Good, { requestRetention: 0.9 });
    const before = await db.fsrs_states.get(`${USER}_${cardId}`);
    const queueBefore = await db.sync_queue.count();
    expect(before).toBeDefined();

    await rateCardFSRS(cardId, "deck_1", USER, Rating.Again, { cramMode: true });
    const after = await db.fsrs_states.get(`${USER}_${cardId}`);

    // Learning weights are untouched…
    expect(after?.state).toBe(before?.state);
    expect(after?.stability).toBe(before?.stability);
    expect(after?.difficulty).toBe(before?.difficulty);
    expect(after?.due).toBe(before?.due);
    expect(after?.reps).toBe(before?.reps);
    expect(after?.lapses).toBe(before?.lapses);

    // …but the review is still logged for analytics.
    const logs = await db.review_logs.toArray();
    expect(logs).toHaveLength(2);
    expect(logs.filter((log) => log.rating === Rating.Again)).toHaveLength(1);
    expect(logs.filter((log) => log.rating === Rating.Good)).toHaveLength(1);

    // Cram answers must not enqueue a cloud write for the schedule.
    expect(await db.sync_queue.count()).toBe(queueBefore);
  });

  it("persists and enqueues the new schedule in normal mode", async () => {
    const { cards } = await seedDeck(1);
    await rateCardFSRS(cards[0].id, "deck_1", USER, Rating.Good);

    const state = await db.fsrs_states.get(`${USER}_${cards[0].id}`);
    expect(state).toBeDefined();
    expect(state?.reps).toBe(1);
    expect(state?.state).toBe(State.Learning);

    const queue = await db.sync_queue.toArray();
    expect(queue).toHaveLength(1);
    expect(queue[0].collection).toBe("fsrs_states");
    expect(queue[0].action).toBe("upsert");
  });

  it("a higher retention target schedules the same answer sooner", async () => {
    const { cards } = await seedDeck(1);
    const cardId = cards[0].id;
    const record = fsrsCardToRecord(reviewPhaseCard(), cardId, "deck_1", USER);
    await db.fsrs_states.put(record);

    const relaxed = await rateCardFSRS(cardId, "deck_1", USER, Rating.Good, { requestRetention: 0.8 });
    const relaxedDue = new Date(relaxed.due).getTime();

    await db.fsrs_states.put(record);
    const strict = await rateCardFSRS(cardId, "deck_1", USER, Rating.Good, { requestRetention: 0.97 });
    const strictDue = new Date(strict.due).getTime();

    expect(strictDue).toBeLessThanOrEqual(relaxedDue);
    expect(strictDue).not.toBe(relaxedDue);
  });

  it("interval previews honour the retention target", async () => {
    const { cards } = await seedDeck(1);
    const cardId = cards[0].id;
    await db.fsrs_states.put(
      fsrsCardToRecord(reviewPhaseCard(), cardId, "deck_1", USER)
    );

    const strict = await getFSRSIntervalPreviews(cardId, "deck_1", USER, 0.97, "ru");
    const relaxed = await getFSRSIntervalPreviews(cardId, "deck_1", USER, 0.8, "ru");

    const strictGood = strict.find((p) => p.rating === Rating.Good)!;
    const relaxedGood = relaxed.find((p) => p.rating === Rating.Good)!;
    expect(strictGood.dueDate.getTime()).toBeLessThan(relaxedGood.dueDate.getTime());
  });

  it("caps new cards per session and reports the same cap in stats", async () => {
    await seedDeck(NEW_CARD_DAILY_LIMIT + 5);

    const deckStats = await calculateDeckFSRSStats("deck_1", USER);
    expect(deckStats.newCount).toBe(NEW_CARD_DAILY_LIMIT + 5);
    expect(deckStats.dueTotal).toBe(NEW_CARD_DAILY_LIMIT);

    const library = await calculateLibraryStats(USER);
    expect(library.decksCount).toBe(1);
    expect(library.cardsCount).toBe(NEW_CARD_DAILY_LIMIT + 5);
    expect(library.dueToday).toBe(NEW_CARD_DAILY_LIMIT);
  });

  it("ignores another user's schedule when computing library stats", async () => {
    const { cards } = await seedDeck(1);
    await db.fsrs_states.put({
      ...fsrsCardToRecord(reviewPhaseCard(), cards[0].id, "deck_1", "someone_else"),
      id: `someone_else_${cards[0].id}`,
    });

    const mine = await calculateLibraryStats(USER);
    expect(mine.newCount).toBe(1);
    expect(mine.masteredCount).toBe(0);
  });
});
