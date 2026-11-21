"use client";

import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Layers, Clock, Trash2, Edit3, ArrowUpRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { db, type Deck, deleteDeckCascade } from "@/lib/db";
import { calculateDeckFSRSStats } from "@/lib/fsrs";

interface DeckCardProps {
  deck: Deck;
  userId: string;
  onSelect: (deckId: string) => void;
}

/** Stable per-deck hue so every deck gets its own colour accent. */
function deckHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return hash;
}

function MasteryRing({ percent, hue }: { percent: number; hue: number }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <svg
      viewBox="0 0 36 36"
      className="h-9 w-9 -rotate-90"
      role="img"
      aria-label={`Освоено ${percent}%`}
    >
      <circle cx="18" cy="18" r={radius} fill="none" strokeWidth="3.5" className="stroke-line" />
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        strokeWidth="3.5"
        strokeLinecap="round"
        stroke={`hsl(${hue} 85% 60%)`}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700"
      />
    </svg>
  );
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

  const hue = deckHue(deck.id);
  const total = cardCount ?? 0;
  const mastered = stats?.masteredCount ?? 0;
  const masteryPercent = total > 0 ? Math.round((mastered / total) * 100) : 0;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Удалить колоду «${deck.title}» и все её карточки?`)) {
      await deleteDeckCascade(deck.id);
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(deck.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(deck.id);
        }
      }}
      aria-label={`Открыть колоду ${deck.title}`}
      className="card-lift group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-line bg-surface p-5 text-left shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Colour aura */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full opacity-[0.22] blur-2xl transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: `hsl(${hue} 90% 60%)` }}
      />
      <div
        aria-hidden
        className="absolute inset-x-5 top-0 h-px opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, hsl(${hue} 90% 62% / .8), transparent)` }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {deck.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-muted"
            >
              #{tag}
            </span>
          ))}
          {deck.isPublic && (
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              общая
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
          <Link
            href={`/deck/${deck.id}/edit`}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Редактировать ${deck.title}`}
            className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-2 hover:text-brand"
          >
            <Edit3 className="h-4 w-4" />
          </Link>
          <button
            onClick={handleDelete}
            aria-label={`Удалить ${deck.title}`}
            className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-red-500/10 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative mt-4 flex-1 space-y-1.5">
        <h3 className="line-clamp-1 text-base font-bold text-ink transition-colors group-hover:text-brand">
          {deck.title}
        </h3>
        {deck.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {deck.description}
          </p>
        ) : (
          <p className="text-xs italic text-ink-subtle">Без описания</p>
        )}
      </div>

      <div className="relative mt-5 flex items-center justify-between border-t border-line pt-4">
        <div className="flex items-center gap-3 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Layers className="h-3.5 w-3.5" />
            {total} карт.
          </span>
          {stats && stats.dueTotal > 0 ? (
            <span
              title="Карточек к повторению сегодня"
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400"
            >
              <Clock className="h-3 w-3" />
              {stats.dueTotal}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              всё повторено
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <MasteryRing percent={masteryPercent} hue={hue} />
          <ArrowUpRight className="h-4 w-4 text-ink-subtle transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
        </div>
      </div>
    </article>
  );
}
