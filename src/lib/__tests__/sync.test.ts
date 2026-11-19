/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SyncQueueItem } from "../db";

// Mock firebase module
vi.mock("../firebase", () => ({
  dbFirestore: {} as unknown,
  isFirebaseConfigured: vi.fn(() => true),
}));

// Mock firebase/firestore
vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db, coll, id) => ({ path: `${coll}/${id}` })),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

// Mock db
vi.mock("../db", () => {
  return {
    db: {
      sync_queue: {
        limit: vi.fn(),
        delete: vi.fn(),
        put: vi.fn(),
        count: vi.fn(),
      },
    },
    GUEST_USER_ID: "local_guest",
  };
});

import { db } from "../db";
import { isFirebaseConfigured } from "../firebase";
import { setDoc, deleteDoc } from "firebase/firestore";
import { processSyncQueue, subscribeSyncState, type SyncState } from "../sync";

describe("processSyncQueue", () => {
  let mockQueue: SyncQueueItem[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFirebaseConfigured).mockReturnValue(true);

    mockQueue = [];
    vi.mocked(db.sync_queue.count).mockImplementation((async () => mockQueue.length) as any);
    vi.mocked(db.sync_queue.limit).mockImplementation((limitNum: number) => ({
      toArray: async () => mockQueue.slice(0, limitNum),
    } as any));
    vi.mocked(db.sync_queue.delete).mockImplementation((async (id: string) => {
      mockQueue = mockQueue.filter((item) => item.id !== id);
    }) as any);
    vi.mocked(db.sync_queue.put).mockImplementation((async (item: any) => {
      const idx = mockQueue.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        mockQueue[idx] = item;
      } else {
        mockQueue.push(item);
      }
      return item.id;
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips execution for guest or missing userId or unconfigured firebase", async () => {
    await processSyncQueue("local_guest");
    expect(db.sync_queue.limit).not.toHaveBeenCalled();

    await processSyncQueue("");
    expect(db.sync_queue.limit).not.toHaveBeenCalled();

    vi.mocked(isFirebaseConfigured).mockReturnValueOnce(false);
    await processSyncQueue("user_123");
    expect(db.sync_queue.limit).not.toHaveBeenCalled();
  });

  it("drains queue with >50 items in batches", async () => {
    // Generate 75 items
    for (let i = 0; i < 75; i++) {
      mockQueue.push({
        id: `card_${i}`,
        collection: "cards",
        docId: `doc_${i}`,
        action: "upsert",
        payload: { term: `Term ${i}` },
        timestamp: Date.now(),
        attempts: 0,
      });
    }

    expect(mockQueue.length).toBe(75);

    await processSyncQueue("user_123");

    // All 75 items should be processed and removed
    expect(setDoc).toHaveBeenCalledTimes(75);
    expect(mockQueue.length).toBe(0);
    expect(db.sync_queue.limit).toHaveBeenCalled();
  });

  it("executes deleteDoc for delete actions", async () => {
    mockQueue.push({
      id: "del_1",
      collection: "decks",
      docId: "deck_xyz",
      action: "delete",
      timestamp: Date.now(),
      attempts: 0,
    });

    await processSyncQueue("user_123");

    expect(deleteDoc).toHaveBeenCalledTimes(1);
    expect(mockQueue.length).toBe(0);
  });

  it("handles item error without interrupting sync of subsequent items and increments attempts", async () => {
    mockQueue.push(
      {
        id: "item_bad",
        collection: "cards",
        docId: "bad_card",
        action: "upsert",
        payload: { term: "Broken" },
        timestamp: Date.now(),
        attempts: 0,
      },
      {
        id: "item_good",
        collection: "cards",
        docId: "good_card",
        action: "upsert",
        payload: { term: "Good" },
        timestamp: Date.now(),
        attempts: 0,
      }
    );

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(setDoc).mockImplementation(async (ref: any) => {
      if (ref.path.includes("bad_card")) {
        throw new Error("Firestore permission-denied");
      }
    });

    await processSyncQueue("user_123");

    // item_good should be processed and deleted from queue
    expect(setDoc).toHaveBeenCalledTimes(2);

    // item_bad should still be in queue with attempts = 1
    const badItem = mockQueue.find((i) => i.id === "item_bad");
    expect(badItem).toBeDefined();
    expect(badItem?.attempts).toBe(1);

    // item_good should have been deleted
    expect(mockQueue.find((i) => i.id === "item_good")).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("drops broken item when attempts reach 3", async () => {
    mockQueue.push({
      id: "item_poison",
      collection: "cards",
      docId: "poison_card",
      action: "upsert",
      payload: { term: "Poison" },
      timestamp: Date.now(),
      attempts: 2, // already failed twice
    });

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(setDoc).mockRejectedValueOnce(new Error("Persistent schema violation"));

    await processSyncQueue("user_123");

    // Item should be dropped completely from queue
    expect(mockQueue.length).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("reached maximum sync attempts (3)"),
      expect.anything()
    );
  });

  it("prevents infinite loop with MAX_BATCHES limit", async () => {
    // Generate 600 items (exceeds 10 batches * 50 = 500 items)
    for (let i = 0; i < 600; i++) {
      mockQueue.push({
        id: `item_${i}`,
        collection: "cards",
        docId: `doc_${i}`,
        action: "upsert",
        payload: { term: `Term ${i}` },
        timestamp: Date.now(),
        attempts: 0,
      });
    }

    await processSyncQueue("user_123");

    // Exactly 10 batches of 50 = 500 items should be processed
    expect(setDoc).toHaveBeenCalledTimes(500);
    expect(mockQueue.length).toBe(100);
  });

  it("resets syncInProgress in finally block and notifies listeners", async () => {
    const states: SyncState[] = [];
    const unsub = subscribeSyncState((s) => states.push(s));

    mockQueue.push({
      id: "item_1",
      collection: "cards",
      docId: "doc_1",
      action: "upsert",
      payload: { term: "Card 1" },
      timestamp: Date.now(),
      attempts: 0,
    });

    await processSyncQueue("user_123");

    unsub();

    // Check last reported state
    const finalState = states[states.length - 1];
    expect(finalState.isSyncing).toBe(false);
  });
});
