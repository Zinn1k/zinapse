import {
  fsrs,
  createEmptyCard,
  Rating,
  State,
  generatorParameters,
  type Card as FSRSCard,
  type RecordLogItem,
} from "ts-fsrs";
import { db, type FSRSStateRecord } from "./db";
import { generateId } from "./utils";

export { Rating, State };

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
    id: `${cardId}_${userId}`,
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
 * Formats difference between now and due date into user-friendly text like "10m", "1d", "4d"
 */
export function formatFSRSInterval(dueDate: Date, nowDate: Date = new Date()): string {
  const diffMs = dueDate.getTime() - nowDate.getTime();
  if (diffMs <= 0) return "< 1m";

  const diffMinutes = Math.round(diffMs / (60 * 1000));
  if (diffMinutes < 60) return `${Math.max(1, diffMinutes)}m`;

  const diffHours = Math.round(diffMs / (60 * 60 * 1000));
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 30) return `${diffDays}d`;

  const diffMonths = (diffDays / 30).toFixed(1);
  return `${diffMonths}mo`;
}

/**
 * Gets or creates the FSRS state for a specific card & user
 */
export async function getOrCreateFSRSState(
  cardId: string,
  deckId: string,
  userId: string
): Promise<FSRSStateRecord> {
  const id = `${cardId}_${userId}`;
  const existing = await db.fsrs_states.get(id);
  if (existing) return existing;

  const now = new Date();
  const emptyCard = createEmptyCard(now);
  const newRecord = fsrsCardToRecord(emptyCard, cardId, deckId, userId);
  await db.fsrs_states.put(newRecord);
  return newRecord;
}

/**
 * Returns projected intervals for each rating (Again, Hard, Good, Easy)
 */
export async function getFSRSIntervalPreviews(
  cardId: string,
  deckId: string,
  userId: string,
  requestRetention: number = 0.9
): Promise<IntervalPreview[]> {
  const record = await getOrCreateFSRSState(cardId, deckId, userId);
  const fsrsCard = recordToFSRSCard(record);
  const now = new Date();

  const f = fsrs(generatorParameters({ request_retention: requestRetention }));
  const results = f.repeat(fsrsCard, now);

  const ratingsOrder: { rating: Rating; label: string }[] = [
    { rating: Rating.Again, label: "Again" },
    { rating: Rating.Hard, label: "Hard" },
    { rating: Rating.Good, label: "Good" },
    { rating: Rating.Easy, label: "Easy" },
  ];

  return ratingsOrder.map(({ rating, label }) => {
    const outcome = results[rating as keyof typeof results] as RecordLogItem;
    const dueDate = outcome.card.due;
    const intervalText = formatFSRSInterval(dueDate, now);
    return {
      rating,
      label,
      intervalText,
      dueDate,
    };
  });
}

/**
 * Rates a card and schedules its next review date using FSRS
 */
export async function rateCardFSRS(
  cardId: string,
  deckId: string,
  userId: string,
  rating: Rating,
  requestRetention: number = 0.9
): Promise<FSRSStateRecord> {
  const currentRecord = await getOrCreateFSRSState(cardId, deckId, userId);
  const fsrsCard = recordToFSRSCard(currentRecord);
  const now = new Date();

  const f = fsrs(generatorParameters({ request_retention: requestRetention }));
  const results = f.repeat(fsrsCard, now);
  const outcome = results[rating as keyof typeof results] as RecordLogItem;

  const updatedRecord = fsrsCardToRecord(outcome.card, cardId, deckId, userId);

  // 1. Save directly to Dexie for 0ms UI latency
  await db.fsrs_states.put(updatedRecord);

  // 2. Queue for background cloud sync if enabled
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
 * Calculates deck statistics based on FSRS states for a user
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
      if (s.due <= now) {
        dueReviewCount++;
      } else if (s.stability >= 21) {
        masteredCount++;
      }
    }
  }

  const total = cards.length;
  const totalReviewed = total - newCount;
  const dueTotal = dueReviewCount + learningCount + (newCount > 0 ? Math.min(newCount, 15) : 0);

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
