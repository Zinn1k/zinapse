"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus,
  Sparkles,
  Search,
  BookOpen,
  Clock,
} from "lucide-react";
import { db, seedSampleDataIfEmpty, GUEST_USER_ID } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { AppHeader } from "@/components/AppHeader";
import { DeckCard } from "@/components/DeckCard";
import { DeckDetailView } from "@/components/DeckDetailView";
import { CreateEditDeckModal } from "@/components/CreateEditDeckModal";
import { AIGenerateModal } from "@/components/AIGenerateModal";
import { SettingsModal } from "@/components/SettingsModal";

export default function Home() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string>(GUEST_USER_ID);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAIGenerateOpen, setIsAIGenerateOpen] = useState(false);
  const [isCreateDeckOpen, setIsCreateDeckOpen] = useState(false);

  // Ensure database sample data is seeded on first load
  useEffect(() => {
    seedSampleDataIfEmpty();
  }, []);

  // Reactive Dexie Live Queries (0ms local-first source of truth)
  const decks = useLiveQuery(() => db.decks.reverse().sortBy("updatedAt"), []);
  const dueStatesCount = useLiveQuery(
    () =>
      db.fsrs_states
        .where("due")
        .belowOrEqual(Date.now())
        .count(),
    []
  );

  const deckList = decks || [];

  // Extract all unique tags
  const allTags = Array.from(
    new Set(deckList.flatMap((d) => d.tags || []))
  ).filter(Boolean);

  // Filtered decks
  const filteredDecks = deckList.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag = selectedTag ? d.tags?.includes(selectedTag) : true;

    return matchesSearch && matchesTag;
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors">
      <AppHeader
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAIGenerate={() => router.push("/create-ai")}
        currentUserId={currentUserId}
        setCurrentUserId={setCurrentUserId}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {selectedDeckId ? (
          <DeckDetailView
            deckId={selectedDeckId}
            userId={currentUserId}
            onBack={() => setSelectedDeckId(null)}
          />
        ) : (
          /* Dashboard Home */
          <div className="space-y-8 animate-in fade-in duration-150">
            {/* Hero / Daily Review Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 text-white p-6 sm:p-8 shadow-xl shadow-indigo-600/10">
              <div className="relative z-10 max-w-2xl space-y-4">
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-indigo-100 border border-white/15">
                  <Clock className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {(dueStatesCount ?? 0) > 0
                      ? `${dueStatesCount} flashcards due for FSRS review today`
                      : "All caught up! Zero cards overdue"}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                  Master Anything with Spaced Repetition.
                </h1>

                <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed">
                  Local-first, 0ms latency flashcards powered by the modern FSRS algorithm and Gemini AI generation. 100% free and offline-capable.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => router.push(`/deck/${generateId()}/edit`)}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white text-indigo-700 font-bold text-xs sm:text-sm shadow-md hover:bg-indigo-50 transition active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Deck</span>
                  </button>

                  <button
                    onClick={() => router.push("/create-ai")}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/40 text-white font-bold text-xs sm:text-sm border border-white/20 transition active:scale-95 backdrop-blur-sm"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Generate with AI</span>
                  </button>
                </div>
              </div>

              {/* Decorative shapes */}
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-purple-500/20 to-transparent pointer-events-none" />
              <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search decks by title, topic, or tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>

              {/* Tags Filter */}
              {allTags.length > 0 && (
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    onClick={() => setSelectedTag(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition ${
                      selectedTag === null
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100"
                    }`}
                  >
                    All
                  </button>
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition ${
                        selectedTag === tag
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100"
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Decks Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                  Your Decks ({filteredDecks.length})
                </h2>
              </div>

              {filteredDecks.length === 0 ? (
                <div className="py-16 text-center rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-8 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-zinc-800 dark:text-zinc-200">
                      No decks found
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Create your own deck or let Gemini generate one for you.
                    </p>
                  </div>
                  <div className="flex justify-center space-x-3 pt-2">
                    <button
                      onClick={() => router.push(`/deck/${generateId()}/edit`)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-sm"
                    >
                      Create Deck
                    </button>
                    <button
                      onClick={() => setIsAIGenerateOpen(true)}
                      className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold"
                    >
                      Generate with AI
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredDecks.map((deck) => (
                    <DeckCard
                      key={deck.id}
                      deck={deck}
                      userId={currentUserId}
                      onSelect={(id) => router.push(`/deck/${id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Global Modals */}
      <CreateEditDeckModal
        isOpen={isCreateDeckOpen}
        onClose={() => setIsCreateDeckOpen(false)}
        userId={currentUserId}
        onSaved={(id) => router.push(`/deck/${id}`)}
      />

      <AIGenerateModal
        isOpen={isAIGenerateOpen}
        onClose={() => setIsAIGenerateOpen(false)}
        userId={currentUserId}
        onDeckCreated={(id) => router.push(`/deck/${id}`)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userId={currentUserId}
      />
    </div>
  );
}
