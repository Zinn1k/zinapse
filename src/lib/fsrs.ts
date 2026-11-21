import {
  fsrs,
  createEmptyCard,
  Rating,
  State,
  generatorParameters,
  type Card as FSRSCard,
  type RecordLogItem,
} from "ts-fsrs";
import { db, type Card, type FSRSStateRecord } from "./db";
import { generateId } from "./utils";

export { Rating, State };

/**
 * How many brand-new cards a single FSRS session may introduce.
 * Shared by the session queue and the "due today" badge so the two never
 * disagree about the size of today's workload.
 */
export const NEW_CARD_DAILY_LIMIT = 20;

/** Default retention target when the user has not chosen one. */
export const DEFAULT_REQUEST_RETENTION = 0.9;

export interface IntervalPreview {
  rating: Rating;
  label: string;
  intervalText: string;
  dueDate: Date;
}

/**
 * Converts our DB FSRSStateRecord to ts-fsrs Card format
 */
export function recordToFSRSCard(record: FSRSStateRecord): FSRSCard {
  return {
    due: new Date(record.due),
    stability: record.stability,
    difficulty: record.difficulty,
    elapsed_days: record.elapsed_days,
    scheduled_days: record.scheduled_days,
    reps: record.reps,
    lapses: record.lapses,
    learning_steps: record.learning_steps ?? 0,
    state: record.state as State,
    last_review: record.last_review ? new Date(record.last_review) : undefined,
  };
}

/**
 * Converts ts-fsrs Card format to our DB FSRSStateRecord
 */
export function fsrsCardToRecord(
  card: FSRSCard,
  cardId: string,
  deckId: string,
  userId: string
): FSRSStateRecord {
  return {
    id: `${userId}_${cardId}`,
    cardId,
    deckId,
    userId,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learning_steps: card.learning_steps,
    state: card.state,
    last_review: card.last_review ? card.last_review.getTime() : null,
    updatedAt: Date.now(),
  };
}

/**
 * Formats difference between now and due date into localized text like "10 мин", "4 дня", "1 мес"
 */
export function formatFSRSInterval(
  dueDate: Date,
  nowDate: Date = new Date(),
  lang: "ru" | "en" = "ru"
): string {
  const diffMs = dueDate.getTime() - nowDate.getTime();
  if (diffMs <= 0) return lang === "ru" ? "< 1 мин" : "< 1m";

  const diffMinutes = Math.round(diffMs / (60 * 1000));
  if (diffMinutes < 60) {
    const m = Math.max(1, diffMinutes);
    return lang === "ru" ? `${m} мин` : `${m}m`;
  }

  const diffHours = Math.round(diffMs / (60 * 60 * 1000));
  if (diffHours < 24) {
    return lang === "ru" ? `${diffHours} ч` : `${diffHours}h`;
  }

  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 30) {
    return lang === "ru" ? `${diffDays} дн` : `${diffDays}d`;
  }

  const diffMonths = Math.round(diffDays / 30);
  return lang === "ru" ? `${diffMonths} мес` : `${diffMonths}mo`;
}

/**
 * Gets or creates the FSRS state for a specific card & user
 */
export async function getOrCreateFSRSState(
  cardId: string,
  deckId: string,
  userId: string
): Promise<FSRSStateRecord> {
  const id = `${userId}_${cardId}`;
  const existing = await db.fsrs_states.get(id);
  if (existing) return existing;

  const now = new Date();
  const emptyCard = createEmptyCard(now);
  const newRecord = fsrsCardToRecord(emptyCard, cardId, deckId, userId);
  await db.fsrs_states.put(newRecord);
  return newRecord;
}

/**
 * Returns projected intervals for each rating (Again, Hard, Good, Easy) in Russian / English
 */
export async function getFSRSIntervalPreviews(
  cardId: string,
  deckId: string,
  userId: string,
  requestRetention: number = 0.9,
  lang: "ru" | "en" = "ru"
): Promise<IntervalPreview[]> {
  const record = await getOrCreateFSRSState(cardId, deckId, userId);
  const fsrsCard = recordToFSRSCard(record);
  const now = new Date();

  const f = fsrs(generatorParameters({ request_retention: requestRetention }));
  const results = f.repeat(fsrsCard, now);

  const ratingsOrder: { rating: Rating; label: string }[] = [
    { rating: Rating.Again, label: lang === "ru" ? "Снова" : "Again" },
    { rating: Rating.Hard, label: lang === "ru" ? "Трудно" : "Hard" },
    { rating: Rating.Good, label: lang === "ru" ? "Хорошо" : "Good" },
    { rating: Rating.Easy, label: lang === "ru" ? "Легко" : "Easy" },
  ];

  return ratingsOrder.map(({ rating, label }) => {
    const outcome = results[rating as keyof typeof results] as RecordLogItem;
    const dueDate = outcome.card.due;
    const intervalText = formatFSRSInterval(dueDate, now, lang);
    return {
      rating,
      label,
      intervalText,
      dueDate,
    };
  });
}

/**
 * Gets today's queue for a deck in FSRS mode:
 * - Cards in Learning/Relearning due now
 * - Cards in Review due now
 * - New cards up to maxNewCards
 */
export async function getTodayFSRSQueue(
  deckId: string,
  userId: string,
  maxNewCards: number = NEW_CARD_DAILY_LIMIT
): Promise<Card[]> {
  const allCards = await db.cards.where("deckId").equals(deckId).sortBy("order");
  if (allCards.length === 0) return [];

  const states = await db.fsrs_states.where("deckId").equals(deckId).toArray();
  const userStates = states.filter((s) => s.userId === userId);
  const stateMap = new Map(userStates.map((s) => [s.cardId, s]));

  const now = Date.now();
  const learningDue: Card[] = [];
  const reviewDue: Card[] = [];
  const newCards: Card[] = [];

  for (const card of allCards) {
    const s = stateMap.get(card.id);
    if (!s || s.state === State.New) {
      newCards.push(card);
    } else if (s.state === State.Learning || s.state === State.Relearning) {
      const dueTime = s.due instanceof Date ? s.due.getTime() : s.due;
      if (dueTime <= now) {
        learningDue.push(card);
      }
    } else if (s.state === State.Review) {
      const dueTime = s.due instanceof Date ? s.due.getTime() : s.due;
      if (dueTime <= now) {
        reviewDue.push(card);
      }
    }
  }

  // Combine: learning due first, then review due, then capped new cards
  const cappedNew = newCards.slice(0, maxNewCards);
  return [...learningDue, ...reviewDue, ...cappedNew];
}

/**
 * Rates a card and schedules its next review date using FSRS.
 * If in cramMode, only adds to review_logs and leaves long-term FSRS state untouched.
 */
export async function rateCardFSRS(
  cardId: string,
  deckId: string,
  userId: string,
  rating: Rating,
  options: { requestRetention?: number; cramMode?: boolean } = {}
): Promise<FSRSStateRecord> {
  const { requestRetention = 0.9, cramMode = false } = options;
  const currentRecord = await getOrCreateFSRSState(cardId, deckId, userId);
  const now = new Date();

  // If Cram Mode: do not alter long-term FSRS schedule
  if (cramMode) {
    await db.review_logs.add({
      id: generateId(),
      cardId,
      userId,
      rating,
      elapsedDays: 0,
      reviewedAt: now.getTime(),
    });
    return currentRecord;
  }

  const fsrsCard = recordToFSRSCard(currentRecord);
  const f = fsrs(generatorParameters({ request_retention: requestRetention }));
  const results = f.repeat(fsrsCard, now);
  const outcome = results[rating as keyof typeof results] as RecordLogItem;

  const updatedRecord = fsrsCardToRecord(outcome.card, cardId, deckId, userId);

  // 1. Save directly to Dexie for 0ms UI latency
  await db.fsrs_states.put(updatedRecord);

  // 2. Add to review_logs table
  await db.review_logs.add({
    id: generateId(),
    cardId,
    userId,
    rating,
    elapsedDays: outcome.card.elapsed_days,
    reviewedAt: now.getTime(),
  });

  // 3. Queue for background cloud sync if enabled
  await db.sync_queue.add({
    id: generateId(),
    collection: "fsrs_states",
    docId: updatedRecord.id,
    action: "upsert",
    payload: updatedRecord,
    timestamp: Date.now(),
    attempts: 0,
  });

  return updatedRecord;
}

/**
 * Aggregated "today" workload across the whole library.
 *
 * Uses the exact same formula as `calculateDeckFSRSStats` (scheduled due +
 * capped new cards), so the home screen and the deck badges never disagree.
 */
export interface LibraryStats {
  decksCount: number;
  cardsCount: number;
  dueToday: number;
  newCount: number;
  learningCount: number;
  reviewDueCount: number;
  masteredCount: number;
}

export async function calculateLibraryStats(userId: string): Promise<LibraryStats> {
  const [decks, cards, states] = await Promise.all([
    db.decks.toArray(),
    db.cards.toArray(),
    db.fsrs_states.toArray(),
  ]);

  const userStates = new Map(
    states.filter((s) => s.userId === userId).map((s) => [s.cardId, s])
  );
  const now = Date.now();

  const perDeck = new Map<
    string,
    { total: number; newCount: number; learning: number; reviewDue: number; mastered: number }
  >();

  for (const card of cards) {
    const bucket =
      perDeck.get(card.deckId) ??
      { total: 0, newCount: 0, learning: 0, reviewDue: 0, mastered: 0 };
    bucket.total++;

    const state = userStates.get(card.id);
    if (!state || state.state === State.New) {
      bucket.newCount++;
    } else if (state.state === State.Learning || state.state === State.Relearning) {
      bucket.learning++;
    } else if (state.state === State.Review) {
      const dueTime = state.due instanceof Date ? state.due.getTime() : Number(state.due);
      if (dueTime <= now) bucket.reviewDue++;
      else if (state.stability >= 21) bucket.mastered++;
    }

    perDeck.set(card.deckId, bucket);
  }

  let cardsCount = 0;
  let dueToday = 0;
  let newCount = 0;
  let learningCount = 0;
  let reviewDueCount = 0;
  let masteredCount = 0;

  for (const bucket of perDeck.values()) {
    cardsCount += bucket.total;
    newCount += bucket.newCount;
    learningCount += bucket.learning;
    reviewDueCount += bucket.reviewDue;
    masteredCount += bucket.mastered;
    dueToday +=
      bucket.reviewDue + bucket.learning + Math.min(bucket.newCount, NEW_CARD_DAILY_LIMIT);
  }

  return {
    decksCount: decks.length,
    cardsCount,
    dueToday,
    newCount,
    learningCount,
    reviewDueCount,
    masteredCount,
  };
}

/**
 * Calculates deck statistics based on FSRS states for a user.
 */
export async function calculateDeckFSRSStats(deckId: string, userId: string) {
  const cards = await db.cards.where("deckId").equals(deckId).toArray();
  const states = await db.fsrs_states.where("deckId").equals(deckId).toArray();
  const userStates = states.filter((s) => s.userId === userId);

  const stateMap = new Map(userStates.map((s) => [s.cardId, s]));
  const now = Date.now();

  let newCount = 0;
  let learningCount = 0;
  let dueReviewCount = 0;
  let masteredCount = 0;

  for (const card of cards) {
    const s = stateMap.get(card.id);
    if (!s || s.state === State.New) {
      newCount++;
    } else if (s.state === State.Learning || s.state === State.Relearning) {
      learningCount++;
    } else if (s.state === State.Review) {
      const dueTime = s.due instanceof Date ? s.due.getTime() : s.due;
      if (dueTime <= now) {
        dueReviewCount++;
      } else if (s.stability >= 21) {
        masteredCount++;
      }
    }
  }

  const total = cards.length;
  const totalReviewed = total - newCount;
  const dueTotal =
    dueReviewCount + learningCount + (newCount > 0 ? Math.min(newCount, NEW_CARD_DAILY_LIMIT) : 0);

  return {
    total,
    newCount,
    learningCount,
    dueReviewCount,
    masteredCount,
    dueTotal,
    retentionEstimate:
      totalReviewed > 0
        ? Math.round(
            (userStates.reduce((acc, curr) => acc + (curr.lapses === 0 ? 1 : 0.7), 0) /
              Math.max(1, userStates.length)) *
              100
          )
        : 100,
  };
}
