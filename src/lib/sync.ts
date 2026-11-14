import { db, type Deck, type Card, type FSRSStateRecord } from "./db";
import { dbFirestore, isFirebaseConfigured } from "./firebase";
import { doc, setDoc, deleteDoc, getDocs, collection, query, where } from "firebase/firestore";

export interface SyncState {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
  error: string | null;
}

let syncInProgress = false;
let lastSyncedTime: number | null = null;
let syncListeners: ((state: SyncState) => void)[] = [];

export function subscribeSyncState(callback: (state: SyncState) => void) {
  syncListeners.push(callback);
  notifySyncListeners();
  return () => {
    syncListeners = syncListeners.filter((cb) => cb !== callback);
  };
}

async function notifySyncListeners(error: string | null = null) {
  const pendingCount = await db.sync_queue.count();
  const state: SyncState = {
    isSyncing: syncInProgress,
    pendingCount,
    lastSyncedAt: lastSyncedTime,
    error,
  };
  syncListeners.forEach((cb) => cb(state));
}

/**
 * Processes local pending sync queue items to Cloud Firestore asynchronously.
 */
export async function processSyncQueue(userId: string): Promise<void> {
  if (!isFirebaseConfigured() || !dbFirestore || syncInProgress || !userId || userId === "local_guest") {
    return;
  }

  syncInProgress = true;
  await notifySyncListeners();

  try {
    const queueItems = await db.sync_queue.limit(50).toArray();

    for (const item of queueItems) {
      const docRef = doc(dbFirestore, item.collection, item.docId);

      if (item.action === "delete") {
        await deleteDoc(docRef);
      } else if (item.action === "upsert" && item.payload) {
        // Enforce owner userId on cloud payload
        const cloudData = {
          ...item.payload,
          syncedUserId: userId,
          syncedAt: Date.now(),
        };
        await setDoc(docRef, cloudData, { merge: true });
      }

      // Remove from Dexie queue upon success
      await db.sync_queue.delete(item.id);
    }

    lastSyncedTime = Date.now();
    await notifySyncListeners();
  } catch (err: unknown) {
    console.error("Background sync error:", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    await notifySyncListeners(message);
  } finally {
    syncInProgress = false;
    await notifySyncListeners();
  }
}

/**
 * Downloads user's cloud decks, cards, and fsrs_states into Dexie (merging newer items).
 */
export async function syncDownFromCloud(userId: string): Promise<void> {
  if (!isFirebaseConfigured() || !dbFirestore || !userId || userId === "local_guest") {
    return;
  }

  syncInProgress = true;
  await notifySyncListeners();

  try {
    // 1. Fetch user decks
    const decksSnap = await getDocs(
      query(collection(dbFirestore, "decks"), where("ownerId", "==", userId))
    );
    const cloudDecks: Deck[] = [];
    decksSnap.forEach((d) => cloudDecks.push(d.data() as Deck));

    // 2. Fetch user cards
    const userDeckIds = cloudDecks.map((d) => d.id);
    if (userDeckIds.length > 0) {
      // In Firestore, where-in is capped at 30 items
      for (let i = 0; i < userDeckIds.length; i += 30) {
        const batchIds = userDeckIds.slice(i, i + 30);
        const cardsSnap = await getDocs(
          query(collection(dbFirestore, "cards"), where("deckId", "in", batchIds))
        );
        const cloudCards: Card[] = [];
        cardsSnap.forEach((c) => cloudCards.push(c.data() as Card));

        // Save cards to Dexie
        await db.cards.bulkPut(cloudCards);
      }
    }

    // 3. Fetch user FSRS states
    const statesSnap = await getDocs(
      query(collection(dbFirestore, "fsrs_states"), where("userId", "==", userId))
    );
    const cloudStates: FSRSStateRecord[] = [];
    statesSnap.forEach((s) => cloudStates.push(s.data() as FSRSStateRecord));

    // Merge into local Dexie
    if (cloudDecks.length > 0) await db.decks.bulkPut(cloudDecks);
    if (cloudStates.length > 0) await db.fsrs_states.bulkPut(cloudStates);

    lastSyncedTime = Date.now();
    await notifySyncListeners();
  } catch (err: unknown) {
    console.error("Sync down error:", err);
    const message = err instanceof Error ? err.message : "Failed to download data";
    await notifySyncListeners(message);
  } finally {
    syncInProgress = false;
    await notifySyncListeners();
  }
}
