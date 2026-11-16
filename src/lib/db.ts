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
  createdAt?: number;
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
    title: "Основные формулы математики и физики",
    description: "Формулы математического анализа, алгебры и физики с KaTeX-рендерингом.",
    isPublic: true,
    shareCode: generateShareCode(),
    tags: ["Математика", "Физика", "Точные науки"],
    createdAt: now - 3600000 * 24,
    updatedAt: now - 3600000 * 24,
  };

  const mathCards: Card[] = [
    {
      id: generateId(),
      deckId: mathDeckId,
      term: "Формула корней квадратного уравнения ($ax^2 + bx + c = 0$)",
      definition: "$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\nГде $\\Delta = b^2 - 4ac$ — дискриминант уравнения.",
      front: "Формула корней квадратного уравнения ($ax^2 + bx + c = 0$)",
      back: "$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\nГде $\\Delta = b^2 - 4ac$ — дискриминант уравнения.",
      hint: "Помните про знак $\\pm$ и дискриминант под корнем.",
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      deckId: mathDeckId,
      term: "Тождество Эйлера",
      definition: "$$e^{i\\pi} + 1 = 0$$\n\nСвязывает пять фундаментальных констант: $e, i, \\pi, 1, 0$.",
      front: "Тождество Эйлера",
      back: "$$e^{i\\pi} + 1 = 0$$\n\nСвязывает пять фундаментальных констант: $e, i, \\pi, 1, 0$.",
      hint: "Связывает экспоненциальные и тригонометрические значения при угле $\\pi$.",
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      deckId: mathDeckId,
      term: "Эквивалентность массы и энергии Эйнштейна",
      definition: "$$E = mc^2$$\n\nГде $E$ — энергия, $m$ — масса, а $c \\approx 3 \\times 10^8\\text{ м/с}$ — скорость света.",
      front: "Эквивалентность массы и энергии Эйнштейна",
      back: "$$E = mc^2$$\n\nГде $E$ — энергия, $m$ — масса, а $c \\approx 3 \\times 10^8\\text{ м/с}$ — скорость света.",
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
    title: "Испанский разговорник для путешествий",
    description: "Популярные разговорные фразы с озвучкой произношения Web Speech.",
    isPublic: true,
    shareCode: generateShareCode(),
    tags: ["Испанский", "Языки", "Путешествия"],
    createdAt: now - 3600000 * 12,
    updatedAt: now - 3600000 * 12,
  };

  const spanishCards: Card[] = [
    {
      id: generateId(),
      deckId: spanishDeckId,
      term: "Где находится ближайший железнодорожный вокзал?",
      definition: "¿Dónde está la estación de tren más cercana?",
      front: "Где находится ближайший железнодорожный вокзал?",
      back: "¿Dónde está la estación de tren más cercana?",
      frontLang: "ru-RU",
      backLang: "es-ES",
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      deckId: spanishDeckId,
      term: "Не могли бы вы принести счёт, пожалуйста?",
      definition: "¿Me puede traer la cuenta, por favor?",
      front: "Не могли бы вы принести счёт, пожалуйста?",
      back: "¿Me puede traer la cuenta, por favor?",
      frontLang: "ru-RU",
      backLang: "es-ES",
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      deckId: spanishDeckId,
      term: "Я хотел бы заказать столик на двоих.",
      definition: "Quisiera reservar una mesa para dos personas.",
      front: "Я хотел бы заказать столик на двоих.",
      back: "Quisiera reservar una mesa para dos personas.",
      frontLang: "ru-RU",
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

export interface DatabaseBackup {
  version: number;
  exportedAt: number;
  decks: Deck[];
  cards: Card[];
  fsrs_states: FSRSStateRecord[];
  review_logs: ReviewLog[];
  settings?: UserSettings[];
}

/**
 * Exports all local Dexie tables to a structured JSON string.
 */
export async function exportDatabaseToJSON(): Promise<string> {
  const [decks, cards, fsrs_states, review_logs, settings] = await Promise.all([
    db.decks.toArray(),
    db.cards.toArray(),
    db.fsrs_states.toArray(),
    db.review_logs.toArray(),
    db.settings.toArray(),
  ]);

  const backup: DatabaseBackup = {
    version: 2,
    exportedAt: Date.now(),
    decks,
    cards,
    fsrs_states,
    review_logs,
    settings,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Imports and restores all tables from a JSON backup.
 */
export async function importDatabaseFromJSON(jsonString: string): Promise<{
  decksCount: number;
  cardsCount: number;
}> {
  const data = JSON.parse(jsonString) as Partial<DatabaseBackup>;
  if (!data.decks || !Array.isArray(data.decks)) {
    throw new Error("Некорректный формат файла резервной копии: отсутствует массив колод.");
  }

  await db.transaction("rw", [db.decks, db.cards, db.fsrs_states, db.review_logs, db.settings], async () => {
    if (data.decks && data.decks.length > 0) {
      await db.decks.bulkPut(data.decks);
    }
    if (data.cards && data.cards.length > 0) {
      await db.cards.bulkPut(data.cards);
    }
    if (data.fsrs_states && data.fsrs_states.length > 0) {
      await db.fsrs_states.bulkPut(data.fsrs_states);
    }
    if (data.review_logs && data.review_logs.length > 0) {
      await db.review_logs.bulkPut(data.review_logs);
    }
    if (data.settings && data.settings.length > 0) {
      await db.settings.bulkPut(data.settings);
    }
  });

  return {
    decksCount: data.decks.length,
    cardsCount: data.cards?.length || 0,
  };
}
