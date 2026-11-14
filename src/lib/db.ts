import Dexie, { type Table } from "dexie";
import { generateId, generateShareCode } from "./utils";

export interface Deck {
  id: string; // uuid
  ownerId: string;
  title: string;
  description: string;
  isPublic: boolean;
  shareCode: string;
  createdAt: number;
  updatedAt: number;

  // Backwards compatibility
  tags?: string[];
  userId?: string;
}

export interface Card {
  id: string; // uuid
  deckId: string;
  term: string;
  definition: string;
  hint?: string;
  imageData?: string; // base64 WebP <= 40KB
  tags?: string[];
  order: number;
  createdAt: number;
  updatedAt: number;

  // Backwards compatibility aliases
  front?: string;
  back?: string;
  frontImage?: string;
  backImage?: string;
  frontLang?: string;
  backLang?: string;
}

export interface FSRSStateRecord {
  id: string; // `${userId}_${cardId}`
  cardId: string;
  deckId: string;
  userId: string;
  state: number; // 0=New, 1=Learning, 2=Review, 3=Relearning
  due: Date | number; // Date or timestamp ms
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  last_review?: Date | number | null;

  learning_steps?: number;
  updatedAt?: number;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  userId: string;
  rating: number; // 1..4
  elapsedDays: number;
  reviewedAt: number;
}

export interface SyncQueueItem {
  id: string;
  collection: "decks" | "cards" | "fsrs_states";
  docId: string;
  action: "upsert" | "delete";
  payload?: unknown;
  timestamp: number;
  attempts: number;
}

export interface UserSettings {
  id: string; // "current"
  userId: string;
  geminiApiKey?: string;
  requestRetention: number; // default 0.9
  theme: "system" | "light" | "dark";
  voiceSpeed: number;
  voiceName?: string;
}

export class QuizletDatabase extends Dexie {
  decks!: Table<Deck, string>;
  cards!: Table<Card, string>;
  fsrs_states!: Table<FSRSStateRecord, string>;
  review_logs!: Table<ReviewLog, string>;
  sync_queue!: Table<SyncQueueItem, string>;
  settings!: Table<UserSettings, string>;

  constructor() {
    super("FreeQuizletDB");
    this.version(2).stores({
      decks: "id, ownerId, title, isPublic, shareCode, createdAt, updatedAt",
      cards: "id, deckId, order, *tags, createdAt, updatedAt",
      fsrs_states: "id, cardId, deckId, userId, state, due",
      review_logs: "id, cardId, userId, rating, reviewedAt",
      sync_queue: "id, collection, timestamp",
      settings: "id, userId",
    });
  }
}

export const db = new QuizletDatabase();

export const GUEST_USER_ID = "local_guest";

/**
 * Cascade deletes a deck, all its cards, and all corresponding FSRS states and logs.
 */
export async function deleteDeckCascade(deckId: string): Promise<void> {
  await db.transaction("rw", [db.decks, db.cards, db.fsrs_states, db.review_logs, db.sync_queue], async () => {
    const cards = await db.cards.where("deckId").equals(deckId).toArray();
    const cardIds = cards.map((c) => c.id);

    await db.cards.where("deckId").equals(deckId).delete();
    await db.fsrs_states.where("deckId").equals(deckId).delete();
    for (const cid of cardIds) {
      await db.review_logs.where("cardId").equals(cid).delete();
    }
    await db.decks.delete(deckId);

    const now = Date.now();
    await db.sync_queue.add({
      id: generateId(),
      collection: "decks",
      docId: deckId,
      action: "delete",
      timestamp: now,
      attempts: 0,
    });

    for (const cid of cardIds) {
      await db.sync_queue.add({
        id: generateId(),
        collection: "cards",
        docId: cid,
        action: "delete",
        timestamp: now,
        attempts: 0,
      });
    }
  });
}

/**
 * Seed sample starter decks if the database is completely empty.
 */
export async function seedSampleDataIfEmpty(): Promise<void> {
  const count = await db.decks.count();
  if (count > 0) return;

  const now = Date.now();

  // Deck 1: Math & Science Formulas
  const mathDeckId = generateId();
  const mathDeck: Deck = {
    id: mathDeckId,
    ownerId: GUEST_USER_ID,
    userId: GUEST_USER_ID,
    title: "Essential Math & Physics Formulas",
    description: "Formulas in calculus, algebra, and physics with KaTeX math rendering.",
    isPublic: true,
    shareCode: generateShareCode(),
    tags: ["Math", "Physics", "STEM"],
    createdAt: now - 3600000 * 24,
    updatedAt: now - 3600000 * 24,
  };

  const mathCards: Card[] = [
    {
      id: generateId(),
      deckId: mathDeckId,
      term: "Quadratic Formula ($ax^2 + bx + c = 0$)",
      definition: "$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\nWhere $\\Delta = b^2 - 4ac$ is the discriminant.",
      front: "Quadratic Formula ($ax^2 + bx + c = 0$)",
      back: "$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\nWhere $\\Delta = b^2 - 4ac$ is the discriminant.",
      hint: "Remember the $\\pm$ sign and $\\Delta$ under the square root.",
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      deckId: mathDeckId,
      term: "Euler's Identity",
      definition: "$$e^{i\\pi} + 1 = 0$$\n\nConnects five fundamental constants: $e, i, \\pi, 1, 0$.",
      front: "Euler's Identity",
      back: "$$e^{i\\pi} + 1 = 0$$\n\nConnects five fundamental constants: $e, i, \\pi, 1, 0$.",
      hint: "Relates exponential and trigonometric values at $\\pi$.",
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      deckId: mathDeckId,
      term: "Einstein's Mass-Energy Equivalence",
      definition: "$$E = mc^2$$\n\nWhere $E$ is energy, $m$ is mass, and $c \\approx 3 \\times 10^8\\text{ m/s}$ is the speed of light.",
      front: "Einstein's Mass-Energy Equivalence",
      back: "$$E = mc^2$$\n\nWhere $E$ is energy, $m$ is mass, and $c \\approx 3 \\times 10^8\\text{ m/s}$ is the speed of light.",
      order: 3,
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Deck 2: Spanish Travel Vocabulary
  const spanishDeckId = generateId();
  const spanishDeck: Deck = {
    id: spanishDeckId,
    ownerId: GUEST_USER_ID,
    userId: GUEST_USER_ID,
    title: "Spanish Travel & Conversation",
    description: "High-frequency conversational phrases with native Web Speech pronunciation.",
    isPublic: true,
    shareCode: generateShareCode(),
    tags: ["Spanish", "Languages", "Travel"],
    createdAt: now - 3600000 * 12,
    updatedAt: now - 3600000 * 12,
  };

  const spanishCards: Card[] = [
    {
      id: generateId(),
      deckId: spanishDeckId,
      term: "Where is the nearest train station?",
      definition: "¿Dónde está la estación de tren más cercana?",
      front: "Where is the nearest train station?",
      back: "¿Dónde está la estación de tren más cercana?",
      frontLang: "en-US",
      backLang: "es-ES",
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      deckId: spanishDeckId,
      term: "Could you bring me the bill, please?",
      definition: "¿Me puede traer la cuenta, por favor?",
      front: "Could you bring me the bill, please?",
      back: "¿Me puede traer la cuenta, por favor?",
      frontLang: "en-US",
      backLang: "es-ES",
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      deckId: spanishDeckId,
      term: "I would like to order a table for two.",
      definition: "Quisiera reservar una mesa para dos personas.",
      front: "I would like to order a table for two.",
      back: "Quisiera reservar una mesa para dos personas.",
      frontLang: "en-US",
      backLang: "es-ES",
      order: 3,
      createdAt: now,
      updatedAt: now,
    },
  ];

  await db.transaction("rw", [db.decks, db.cards], async () => {
    await db.decks.bulkAdd([mathDeck, spanishDeck]);
    await db.cards.bulkAdd([...mathCards, ...spanishCards]);
  });
}
