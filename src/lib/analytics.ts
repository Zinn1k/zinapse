import { db, type FSRSStateRecord } from "./db";

export interface FSRSDayForecast {
  dayLabel: string;
  dateStr: string;
  count: number;
  isToday: boolean;
}

export interface FSRSAnalyticsData {
  totalCards: number;
  trackedCards: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  relearningCount: number;
  dueTodayCount: number;
  avgStabilityDays: number;
  avgDifficulty: number;
  estimatedRetention: number; // percentage, e.g. 92
  totalReviews: number;
  forecast7Days: FSRSDayForecast[];
}

/**
 * Pure computation of FSRS analytics and 7-day forecast given card lists and states.
 */
export function computeFSRSMetrics(
  allCards: { id: string }[],
  states: FSRSStateRecord[],
  relevantLogs: { cardId: string; userId: string }[] = [],
  referenceDate: Date = new Date()
): FSRSAnalyticsData {
  const now = referenceDate;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 86400000 - 1;

  let newCount = 0;
  let learningCount = 0;
  let reviewCount = 0;
  let relearningCount = 0;
  let dueTodayCount = 0;
  let totalStability = 0;
  let totalDifficulty = 0;

  // 7-day forecast buckets: index 0 = today, index 1 = tomorrow, ..., index 6 = +6 days
  const dayBuckets: number[] = [0, 0, 0, 0, 0, 0, 0];

  const trackedCardIds = new Set<string>();

  for (const s of states) {
    trackedCardIds.add(s.cardId);

    // State counts (0=New, 1=Learning, 2=Review, 3=Relearning)
    if (s.state === 0) newCount++;
    else if (s.state === 1) learningCount++;
    else if (s.state === 2) reviewCount++;
    else if (s.state === 3) relearningCount++;

    totalStability += s.stability || 0;
    totalDifficulty += s.difficulty || 0;

    const dueTime = s.due instanceof Date ? s.due.getTime() : Number(s.due);

    if (dueTime <= endOfToday) {
      dueTodayCount++;
      dayBuckets[0]++;
    } else {
      const diffDays = Math.floor((dueTime - startOfToday) / 86400000);
      if (diffDays >= 1 && diffDays < 7) {
        dayBuckets[diffDays]++;
      }
    }
  }

  // Cards with no state record yet are considered "New"
  const untrackedCount = allCards.length - trackedCardIds.size;
  newCount += Math.max(0, untrackedCount);

  const trackedCount = states.length;
  const avgStability = trackedCount > 0 ? totalStability / trackedCount : 0;
  const avgDifficulty = trackedCount > 0 ? totalDifficulty / trackedCount : 0;

  // Build forecast list
  const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const forecast7Days: FSRSDayForecast[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfToday + i * 86400000);
    const dayLabel = i === 0 ? "Сегодня" : i === 1 ? "Завтра" : dayNames[d.getDay()];
    const dateStr = `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;

    forecast7Days.push({
      dayLabel,
      dateStr,
      count: dayBuckets[i],
      isToday: i === 0,
    });
  }

  // Estimated retention: based on average review stability and default request retention (0.9 = 90%)
  const estimatedRetention = trackedCount > 0 ? Math.min(99, Math.max(75, Math.round(90 + (avgStability > 10 ? 4 : 0)))) : 90;

  return {
    totalCards: allCards.length,
    trackedCards: trackedCount,
    newCount,
    learningCount,
    reviewCount,
    relearningCount,
    dueTodayCount,
    avgStabilityDays: Math.round(avgStability * 10) / 10,
    avgDifficulty: Math.round(avgDifficulty * 10) / 10,
    estimatedRetention,
    totalReviews: relevantLogs.length,
    forecast7Days,
  };
}

/**
 * Computes deep FSRS statistics and 7-day due forecast for a deck (or entire library if deckId is omitted).
 */
export async function getFSRSAnalytics(
  userId: string,
  deckId?: string
): Promise<FSRSAnalyticsData> {
  const cardsQuery = deckId
    ? db.cards.where("deckId").equals(deckId)
    : db.cards;
  const allCards = await cardsQuery.toArray();
  const cardIds = new Set(allCards.map((c) => c.id));

  const statesQuery = deckId
    ? db.fsrs_states.where("deckId").equals(deckId)
    : db.fsrs_states;
  const rawStates = await statesQuery.toArray();
  const states = rawStates.filter(
    (s) => s.userId === userId && cardIds.has(s.cardId)
  );

  const logsQuery = deckId
    ? db.review_logs.toArray() // filter by cardIds
    : db.review_logs.toArray();
  const allLogs = await logsQuery;
  const relevantLogs = allLogs.filter(
    (l) => l.userId === userId && cardIds.has(l.cardId)
  );

  return computeFSRSMetrics(allCards, states, relevantLogs);
}
