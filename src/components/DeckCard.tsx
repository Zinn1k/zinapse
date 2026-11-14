"use client";

import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Layers,
  Clock,
  Trash2,
} from "lucide-react";
import { db, type Deck, deleteDeckCascade } from "@/lib/db";
import { calculateDeckFSRSStats } from "@/lib/fsrs";

interface DeckCardProps {
  deck: Deck;
  userId: string;
  onSelect: (deckId: string) => void;
}

export function DeckCard({ deck, userId, onSelect }: DeckCardProps) {
  const cardCount = useLiveQuery(
    () => db.cards.where("deckId").equals(deck.id).count(),
    [deck.id]
  );

  const stats = useLiveQuery(
    () => calculateDeckFSRSStats(deck.id, userId),
    [deck.id, userId]
  );

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete deck "${deck.title}" and its cards?`)) {
      await deleteDeckCascade(deck.id);
    }
  };

  return (
    <div
      onClick={() => onSelect(deck.id)}
      className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-500/80 dark:hover:border-indigo-500/80 hover:shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer group text-left"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-wrap gap-1.5 max-w-[80%]">
            {deck.tags?.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-semibold"
              >
                #{tag}
              </span>
            ))}
          </div>

          <button
            onClick={handleDelete}
            className="text-zinc-400 hover:text-red-500 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition"
            title="Delete Deck"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
            {deck.title}
          </h3>
          {deck.description && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
              {deck.description}
            </p>
          )}
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1.5 text-zinc-500 font-medium">
          <Layers className="w-3.5 h-3.5" />
          <span>{cardCount ?? 0} cards</span>
        </div>

        {stats && stats.dueTotal > 0 ? (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20 text-[11px]">
            <Clock className="w-3 h-3" />
            <span>{stats.dueTotal} Due</span>
          </span>
        ) : (
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Up to date
          </span>
        )}
      </div>
    </div>
  );
}
