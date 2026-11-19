import { db, type Deck, type Card, type FSRSStateRecord } from "./db";
import { dbFirestore, isFirebaseConfigured } from "./firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";

export interface SyncState {
  isSyncing: boolean;
  isOnline: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
  error: string | null;
}

let syncInProgress = false;
let lastSyncedTime: number | null = null;
let syncListeners: ((state: SyncState) => void)[] = [];
let isOnline = typeof window !== "undefined" ? navigator.onLine : true;

// Setup online/offline listeners
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    isOnline = true;
    notifySyncListeners();
  });
  window.addEventListener("offline", () => {
    isOnline = false;
    notifySyncListeners();
  });
}

export function subscribeSyncState(callback: (state: SyncState) => void) {
  syncListeners.push(callback);
  notifySyncListeners();
  return () => {
    syncListeners = syncListeners.filter((cb) => cb !== callback);
  };
}

async function notifySyncListeners(error: string | null = null) {
  try {
    const pendingCount = await db.sync_queue.count();
    const state: SyncState = {
      isSyncing: syncInProgress,
      isOnline,
      pendingCount,
      lastSyncedAt: lastSyncedTime,
      error,
    };
    syncListeners.forEach((cb) => cb(state));
  } catch {
    // Database may be closing or not ready
  }
}

/**
 * Uploads local pending changes from Dexie sync_queue to Cloud Firestore.
 */
export async function processSyncQueue(userId: string): Promise<void> {
  if (
    !isFirebaseConfigured() ||
    !dbFirestore ||
    syncInProgress ||
    !userId ||
    userId === "local_guest" ||
    !isOnline
  ) {
    return;
  }

  syncInProgress = true;
  await notifySyncListeners();

  let syncError: string | null = null;
  const BATCH_SIZE = 50;
  const MAX_BATCHES = 10; // Process at most 500 items per run to prevent infinite loops
  const failedItemIds = new Set<string>();

  try {
    let batchCount = 0;

    while (batchCount < MAX_BATCHES) {
      if (!isOnline) {
        break;
      }

      const queueItems = await db.sync_queue.limit(BATCH_SIZE).toArray();
      if (queueItems.length === 0) {
        break;
      }

      // Filter out items that have already failed during this sync run
      const actionableItems = queueItems.filter((item) => !failedItemIds.has(item.id));
      if (actionableItems.length === 0) {
        break;
      }

      batchCount++;

      for (const item of actionableItems) {
        try {
          const docRef = doc(dbFirestore, item.collection, item.docId);

          if (item.action === "delete") {
            await deleteDoc(docRef);
          } else if (item.action === "upsert" && item.payload) {
            // Enforce owner / syncedUserId
            const cloudData = {
              ...(item.payload as Record<string, unknown>),
              syncedUserId: userId,
              syncedAt: Date.now(),
            };
            await setDoc(docRef, cloudData, { merge: true });
          }

          // Remove from local Dexie queue once written
          await db.sync_queue.delete(item.id);
        } catch (itemErr: unknown) {
          console.error(
            `Sync error on item ${item.id} (${item.collection}/${item.docId}):`,
            itemErr
          );
          failedItemIds.add(item.id);

          const attempts = (item.attempts || 0) + 1;
          if (attempts >= 3) {
            console.error(
              `Item ${item.id} reached maximum sync attempts (${attempts}). Dropping from queue:`,
              item
            );
            await db.sync_queue.delete(item.id);
          } else {
            await db.sync_queue.put({
              ...item,
              attempts,
            });
          }
        }
      }
    }

    lastSyncedTime = Date.now();
  } catch (err: unknown) {
    console.error("Background push sync error:", err);
    syncError = err instanceof Error ? err.message : "Sync push failed";
  } finally {
    syncInProgress = false;
    await notifySyncListeners(syncError);
  }
}

/**
 * Downloads user's cloud decks, cards, and fsrs_states into Dexie with updatedAt conflict resolution.
 */
export async function syncDownFromCloud(userId: string): Promise<void> {
  if (
    !isFirebaseConfigured() ||
    !dbFirestore ||
    !userId ||
    userId === "local_guest" ||
    !isOnline
  ) {
    return;
  }

  syncInProgress = true;
  await notifySyncListeners();

  try {
    // 1. Fetch user decks from Firestore
    const decksSnap = await getDocs(
      query(collection(dbFirestore, "decks"), where("ownerId", "==", userId))
    );
    const cloudDecks: Deck[] = [];
    decksSnap.forEach((d) => cloudDecks.push(d.data() as Deck));

    // Conflict resolution for decks by updatedAt
    for (const cDeck of cloudDecks) {
      const localDeck = await db.decks.get(cDeck.id);
      if (!localDeck || (cDeck.updatedAt || 0) >= (localDeck.updatedAt || 0)) {
        await db.decks.put(cDeck);
      } else {
        // Local is newer -> enqueue for push
        await db.sync_queue.put({
          id: `deck_${localDeck.id}`,
          collection: "decks",
          docId: localDeck.id,
          action: "upsert",
          payload: localDeck,
          timestamp: Date.now(),
          attempts: 0,
        });
      }
    }

    // 2. Fetch user cards from Firestore
    const userDeckIds = cloudDecks.map((d) => d.id);
    if (userDeckIds.length > 0) {
      for (let i = 0; i < userDeckIds.length; i += 30) {
        const batchIds = userDeckIds.slice(i, i + 30);
        const cardsSnap = await getDocs(
          query(collection(dbFirestore, "cards"), where("deckId", "in", batchIds))
        );
        const cloudCards: Card[] = [];
        cardsSnap.forEach((c) => cloudCards.push(c.data() as Card));

        for (const cCard of cloudCards) {
          const localCard = await db.cards.get(cCard.id);
          if (!localCard || (cCard.updatedAt || 0) >= (localCard.updatedAt || 0)) {
            await db.cards.put(cCard);
          } else {
            // Local is newer -> enqueue for push
            await db.sync_queue.put({
              id: `card_${localCard.id}`,
              collection: "cards",
              docId: localCard.id,
              action: "upsert",
              payload: localCard,
              timestamp: Date.now(),
              attempts: 0,
            });
          }
        }
      }
    }

    // 3. Fetch user FSRS states
    const statesSnap = await getDocs(
      query(collection(dbFirestore, "fsrs_states"), where("userId", "==", userId))
    );
    const cloudStates: FSRSStateRecord[] = [];
    statesSnap.forEach((s) => cloudStates.push(s.data() as FSRSStateRecord));

    for (const cState of cloudStates) {
      const localState = await db.fsrs_states.get(cState.id);
      const cloudReviewTime = cState.last_review
        ? new Date(cState.last_review).getTime()
        : 0;
      const localReviewTime = localState?.last_review
        ? new Date(localState.last_review).getTime()
        : 0;

      if (!localState || cloudReviewTime >= localReviewTime) {
        await db.fsrs_states.put(cState);
      } else {
        // Local is newer -> enqueue for push
        await db.sync_queue.put({
          id: `fsrs_${localState.id}`,
          collection: "fsrs_states",
          docId: localState.id,
          action: "upsert",
          payload: localState,
          timestamp: Date.now(),
          attempts: 0,
        });
      }
    }

    lastSyncedTime = Date.now();
    await notifySyncListeners();
  } catch (err: unknown) {
    console.error("Sync pull error:", err);
    const message = err instanceof Error ? err.message : "Failed to pull cloud data";
    await notifySyncListeners(message);
  } finally {
    syncInProgress = false;
    await notifySyncListeners();
  }
}

/**
 * Performs a complete bidirectional sync (push local queue, then pull newer items).
 */
export async function triggerFullSync(userId: string): Promise<void> {
  await processSyncQueue(userId);
  await syncDownFromCloud(userId);
}

let debounceTimer: NodeJS.Timeout | null = null;

/**
 * Triggers debounced background push after local mutations (0ms latency for UI).
 */
export function scheduleSync(userId: string) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    processSyncQueue(userId).catch(() => {});
  }, 2000);
}
