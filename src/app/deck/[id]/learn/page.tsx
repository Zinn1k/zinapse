"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, GUEST_USER_ID } from "@/lib/db";
import { subscribeToAuthChanges } from "@/lib/firebase";
import { LearnMode } from "@/components/study/LearnMode";
import { Button } from "@/components/ui/button";

export default function LearnModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const deckId = resolvedParams.id;
  const router = useRouter();

  const [userId, setUserId] = useState<string>(GUEST_USER_ID);

  useEffect(() => {
    const unsub = subscribeToAuthChanges((user) => {
      setUserId(user ? user.uid : GUEST_USER_ID);
    });
    return () => unsub();
  }, []);

  // `null` means "loaded but missing"; `undefined` means "still loading".
  const deck = useLiveQuery(async () => (await db.decks.get(deckId)) ?? null, [deckId]);
  const cards = useLiveQuery(
    () => db.cards.where("deckId").equals(deckId).sortBy("order"),
    [deckId]
  );

  if (deck === undefined || cards === undefined) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center text-sm text-ink-muted">
        Загрузка режима заучивания...
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <h2 className="text-xl font-bold text-ink">Колода не найдена</h2>
        <Button onClick={() => router.push("/")}>На главную</Button>
      </div>
    );
  }

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <LearnMode
        deck={deck}
        cards={cards}
        userId={userId}
        onExit={() => router.push(`/deck/${deckId}`)}
      />
    </div>
  );
}
