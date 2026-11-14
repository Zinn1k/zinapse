import Dexie, { type Table } from "dexie";
import { generateId } from "./utils";

export interface Deck {
  id: string;
  userId: string;
  title: string;
  description: string;
  tags: string[];
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  hint?: string;
  frontImage?: string; // base64 WebP <= 40KB
  backImage?: string; // base64 WebP <= 40KB
  frontLang?: string;
  backLang?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface FSRSStateRecord {
  id: string; // `${cardId}_${userId}`
  cardId: string;
  deckId: string;
  userId: string;
  due: number; // timestamp ms
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  learning_steps?: number;
  state: number; // 0=New, 1=Learning, 2=Review, 3=Relearning
  last_review?: number | null;
  updatedAt: number;
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
  sync_queue!: Table<SyncQueueItem, string>;
  settings!: Table<UserSettings, string>;

  constructor() {
    super("FreeQuizletDB");
    this.version(1).stores({
      decks: "id, userId, title, createdAt, updatedAt",
      cards: "id, deckId, order, createdAt, updatedAt",
      fsrs_states: "id, cardId, deckId, userId, due, state, updatedAt",
      sync_queue: "id, collection, timestamp",
      settings: "id, userId",
    });
  }
}

export const db = new QuizletDatabase();

export const GUEST_USER_ID = "local_guest";

/**
 * Cascade deletes a deck, all its cards, and all corresponding FSRS states.
 */
export async function deleteDeckCascade(deckId: string): Promise<void> {
  await db.transaction("rw", [db.decks, db.cards, db.fsrs_states, db.sync_queue], async () => {
    // 1. Delete cards and their FSRS states
    const cards = await db.cards.where("deckId").equals(deckId).toArray();
    const cardIds = cards.map((c) => c.id);

    await db.cards.where("deckId").equals(deckId).delete();
    await db.fsrs_states.where("deckId").equals(deckId).delete();
    await db.decks.delete(deckId);

    // Queue sync deletes
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

  // Deck 1: Math & Science Formulas (LaTeX KaTeX showcase)
  const mathDeckId = generateId();
  const mathDeck: Deck = {
    id: mathDeckId,
    userId: GUEST_USER_ID,
    title: "Essential Math & Physics Formulas",
    description: "Formulas in calculus, algebra, and quantum physics with KaTeX math rendering.",
    tags: ["Math", "Physics", "STEM"],
    isPublic: true,
    createdAt: now - 3600000 * 24,
    updatedAt: now - 3600000 * 24,
  };

  const mathCards: Card[] = [
    {
      id: generateId(),
      deckId: mathDeckId,
      front: "What is the **Quadratic Formula** for solving $ax^2 + bx + c = 0$?",
      back: "The roots are given by:\n\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\nWhere the discriminant is $\\Delta = b^2 - 4ac$.",
      hint: "Remember the plus-minus sign and the discriminant under the radical.",
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      deckId: mathDeckId,
      front: "State **Euler's Identity**, linking five fundamental mathematical constants.",
      back: "$$e^{i\\pi} + 1 = 0$$\n\nIt connects: $e$ (Euler's number), $i$ (imaginary unit), $\\pi$ (pi), $1$, and $0$.",
      hint: "Relates exponential and trigonometric functions.",
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      deckId: mathDeckId,
      front: "What is the **Fundamental Theorem of Calculus** (Part 1)?",
      back: "If $f$ is continuous on $[a, b]$ and $F(x) = \\int_{a}^{x} f(t)\\,dt$, then:\n\n$$F'(x) = f(x)$$\n\nDifferentiation and integration are inverse operations.",
      order: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      deckId: mathDeckId,
      front: "What is **Einstein's Mass-Energy Equivalence** formula?",
      back: "$$E = mc^2$$\n\nWhere $E$ is energy, $m$ is relativistic mass, and $c \\approx 3 \\times 10^8\\text{ m/s}$ is the speed of light in vacuum.",
      order: 4,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      deckId: mathDeckId,
      front: "What is the definition of the **Normal (Gaussian) Distribution** PDF?",
      back: "$$f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} \\exp\\left( -\\frac{1}{2}\\left(\\frac{x - \\mu}{\\sigma}\\right)^2 \\right)$$\n\nWhere $\\mu$ is the mean and $\\sigma$ is the standard deviation.",
      order: 5,
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Deck 2: Spanish Travel Vocabulary (TTS Audio showcase)
  const spanishDeckId = generateId();
  const spanishDeck: Deck = {
    id: spanishDeckId,
    userId: GUEST_USER_ID,
    title: "Spanish Conversation & Travel Essentials",
    description: "High-frequency conversational phrases with native Web Speech pronunciation.",
    tags: ["Spanish", "Languages", "Travel"],
    isPublic: true,
    createdAt: now - 3600000 * 12,
    updatedAt: now - 3600000 * 12,
  };

  const spanishCards: Card[] = [
    {
      id: generateId(),
      deckId: spanishDeckId,
      front: "Where is the nearest train station?",
      back: "¿Dónde está la estación de tren más cercana?",
      hint: "dónde está...",
      frontLang: "en-US",
      backLang: "es-ES",
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      deckId: spanishDeckId,
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
      front: "I would like to order a table for two people.",
      back: "Quisiera reservar una mesa para dos personas.",
      frontLang: "en-US",
      backLang: "es-ES",
      order: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      deckId: spanishDeckId,
      front: "Do you speak English? I am learning Spanish.",
      back: "¿Habla inglés? Estoy aprendiendo español.",
      frontLang: "en-US",
      backLang: "es-ES",
      order: 4,
      createdAt: now,
      updatedAt: now,
    },
  ];

  await db.transaction("rw", [db.decks, db.cards], async () => {
    await db.decks.bulkAdd([mathDeck, spanishDeck]);
    await db.cards.bulkAdd([...mathCards, ...spanishCards]);
  });
}
