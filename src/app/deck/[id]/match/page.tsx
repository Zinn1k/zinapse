"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, GUEST_USER_ID } from "@/lib/db";
import { subscribeToAuthChanges } from "@/lib/firebase";
import { MatchMode } from "@/components/study/MatchMode";
import { Button } from "@/components/ui/button";

export default function MatchGamePage({
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

  const deck = useLiveQuery(() => db.decks.get(deckId), [deckId]);
  const cards = useLiveQuery(
    () => db.cards.where("deckId").equals(deckId).sortBy("order"),
    [deckId]
  );

  if (deck === undefined || cards === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black text-zinc-500">
        Загрузка игры...
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-black text-center space-y-4">
        <h2 className="text-xl font-bold">Колода не найдена</h2>
        <Button onClick={() => router.push("/")}>На главную</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col">
      <MatchMode
        deck={deck}
        cards={cards}
        userId={userId}
        onExit={() => router.push(`/deck/${deckId}`)}
      />
    </div>
  );
}
