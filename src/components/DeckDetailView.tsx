"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Layers,
  GraduationCap,
  Gamepad2,
  FileCheck,
  Plus,
  Sparkles,
  Edit,
  Trash2,
  Download,
  Volume2,
  Search,
  Clock,
} from "lucide-react";
import { db, deleteDeckCascade, type Card } from "@/lib/db";
import { calculateDeckFSRSStats } from "@/lib/fsrs";
import { speakText } from "@/lib/speech";
import { MarkdownMath } from "./MarkdownMath";
import { CardEditorModal } from "./CardEditorModal";
import { CreateEditDeckModal } from "./CreateEditDeckModal";
import { AIGenerateModal } from "./AIGenerateModal";
import { FlashcardsMode } from "./study/FlashcardsMode";
import { LearnMode } from "./study/LearnMode";
import { MatchMode } from "./study/MatchMode";
import { TestMode } from "./study/TestMode";

interface DeckDetailViewProps {
  deckId: string;
  userId: string;
  onBack: () => void;
}

type ActiveStudyMode = "none" | "flashcards" | "learn" | "match" | "test";

export function DeckDetailView({ deckId, userId, onBack }: DeckDetailViewProps) {
  const [activeMode, setActiveMode] = useState<ActiveStudyMode>("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<Card | null>(null);
  const [isEditDeckModalOpen, setIsEditDeckModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  // Live queries via Dexie hooks (0ms Local-First reactivity)
  const deck = useLiveQuery(() => db.decks.get(deckId), [deckId]);
  const cards = useLiveQuery(
    () => db.cards.where("deckId").equals(deckId).sortBy("order"),
    [deckId]
  );
  const fsrsStats = useLiveQuery(
    () => calculateDeckFSRSStats(deckId, userId),
    [deckId, userId]
  );

  if (!deck) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <p className="text-zinc-500">Deck not found or has been deleted.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const cardList = cards || [];

  // Active study mode router
  if (activeMode === "flashcards") {
    return (
      <FlashcardsMode
        deck={deck}
        cards={cardList}
        userId={userId}
        onExit={() => setActiveMode("none")}
      />
    );
  }

  if (activeMode === "learn") {
    return (
      <LearnMode
        deck={deck}
        cards={cardList}
        userId={userId}
        onExit={() => setActiveMode("none")}
      />
    );
  }

  if (activeMode === "match") {
    return (
      <MatchMode
        deck={deck}
        cards={cardList}
        onExit={() => setActiveMode("none")}
      />
    );
  }

  if (activeMode === "test") {
    return (
      <TestMode
        deck={deck}
        cards={cardList}
        onExit={() => setActiveMode("none")}
      />
    );
  }

  // Filter cards
  const filteredCards = cardList.filter((c) => {
    const q = searchQuery.toLowerCase();
    const term = (c.term || c.front || "").toLowerCase();
    const def = (c.definition || c.back || "").toLowerCase();
    const hint = (c.hint || "").toLowerCase();
    return term.includes(q) || def.includes(q) || hint.includes(q);
  });

  const handleDeleteCard = async (cardId: string) => {
    if (confirm("Delete this flashcard?")) {
      await db.cards.delete(cardId);
      await db.fsrs_states.delete(`${cardId}_${userId}`);
    }
  };

  const handleDeleteDeck = async () => {
    if (confirm(`Are you sure you want to delete deck "${deck.title}" and all its cards?`)) {
      await deleteDeckCascade(deck.id);
      onBack();
    }
  };

  const handleExportJSON = () => {
    const exportData = {
      deck,
      cards: cardList,
      exportedAt: new Date().toISOString(),
      app: "Free Quizlet Analog (Memorize)",
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.title.replace(/[^a-zA-Z0-9-_]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8 animate-in fade-in duration-150">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Decks</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportJSON}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Export deck to JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <Link
            href={`/deck/${deck.id}/edit`}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Open Deck Editor"
          >
            <Edit className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Edit Deck</span>
          </Link>
          <button
            onClick={handleDeleteDeck}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            title="Delete Deck"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Deck Title Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {deck.tags?.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800/60"
            >
              #{tag}
            </span>
          ))}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
          {deck.title}
        </h1>
        {deck.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
            {deck.description}
          </p>
        )}
      </div>

      {/* Study Modes Launchpad */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => setActiveMode("flashcards")}
          disabled={cardList.length === 0}
          className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition text-left space-y-2 group disabled:opacity-40"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-zinc-900 dark:text-white">Flashcards</div>
            <div className="text-xs text-zinc-500">3D Flip & FSRS ratings</div>
          </div>
        </button>

        <button
          onClick={() => setActiveMode("learn")}
          disabled={cardList.length === 0}
          className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-md transition text-left space-y-2 group disabled:opacity-40"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-zinc-900 dark:text-white">Learn</div>
            <div className="text-xs text-zinc-500">Adaptive spaced repetition</div>
          </div>
        </button>

        <button
          onClick={() => setActiveMode("match")}
          disabled={cardList.length < 2}
          className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-md transition text-left space-y-2 group disabled:opacity-40"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-zinc-900 dark:text-white">Match</div>
            <div className="text-xs text-zinc-500">Timed speed tile game</div>
          </div>
        </button>

        <button
          onClick={() => setActiveMode("test")}
          disabled={cardList.length === 0}
          className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md transition text-left space-y-2 group disabled:opacity-40"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-zinc-900 dark:text-white">Test</div>
            <div className="text-xs text-zinc-500">Practice exam simulator</div>
          </div>
        </button>
      </div>

      {/* FSRS Learning Metrics Bar */}
      {fsrsStats && (
        <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                FSRS Spaced Repetition Engine Status
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
              Retention Est: {fsrsStats.retentionEstimate}%
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
              <span className="block font-bold text-base text-blue-600 dark:text-blue-400">
                {fsrsStats.newCount}
              </span>
              <span className="text-zinc-500 text-[11px]">New Cards</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
              <span className="block font-bold text-base text-amber-600 dark:text-amber-400">
                {fsrsStats.learningCount}
              </span>
              <span className="text-zinc-500 text-[11px]">Learning</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
              <span className="block font-bold text-base text-red-600 dark:text-red-400">
                {fsrsStats.dueReviewCount}
              </span>
              <span className="text-zinc-500 text-[11px]">Due for Review</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
              <span className="block font-bold text-base text-emerald-600 dark:text-emerald-400">
                {fsrsStats.masteredCount}
              </span>
              <span className="text-zinc-500 text-[11px]">Mastered (21d+)</span>
            </div>
          </div>
        </div>
      )}

      {/* Cards List Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              Cards in this deck ({cardList.length})
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={() => setIsAIModalOpen(true)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-semibold hover:bg-purple-100 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>AI Expand</span>
            </button>

            <button
              onClick={() => {
                setCardToEdit(null);
                setIsCardModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Card</span>
            </button>
          </div>
        </div>

        {/* Cards Grid */}
        {filteredCards.length === 0 ? (
          <div className="py-12 text-center rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-500 space-y-3">
            <p className="text-sm">
              {searchQuery ? "No cards match your search." : "No cards in this deck yet."}
            </p>
            {!searchQuery && (
              <button
                onClick={() => {
                  setCardToEdit(null);
                  setIsCardModalOpen(true);
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
              >
                Create your first card
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCards.map((card, idx) => (
              <div
                key={card.id}
                className="p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col sm:flex-row items-start justify-between gap-4 group"
              >
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  {/* Front */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-500">
                      Term
                    </span>
                    <div className="text-sm font-medium text-zinc-900 dark:text-white">
                      <MarkdownMath content={card.term || card.front || ""} />
                    </div>
                    {(card.imageData || card.frontImage) && (
                      <img
                        src={card.imageData || card.frontImage}
                        alt="Illustration"
                        className="h-20 w-auto rounded-lg object-contain mt-2 border border-zinc-100 dark:border-zinc-800"
                      />
                    )}
                  </div>

                  {/* Back */}
                  <div className="space-y-1 md:border-l md:border-zinc-100 md:dark:border-zinc-800 md:pl-4">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-500">
                      Definition
                    </span>
                    <div className="text-sm text-zinc-700 dark:text-zinc-300">
                      <MarkdownMath content={card.definition || card.back || ""} />
                    </div>
                    {card.backImage && (
                      <img
                        src={card.backImage}
                        alt="Back"
                        className="h-20 w-auto rounded-lg object-contain mt-2 border border-zinc-100 dark:border-zinc-800"
                      />
                    )}
                    {card.hint && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                        Hint: {card.hint}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Row Actions */}
                <div className="flex items-center space-x-1 shrink-0 pt-1 sm:pt-0 self-end sm:self-start">
                  <button
                    onClick={() => speakText(card.term || card.front || "", { lang: card.frontLang })}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-500 transition"
                    title="Speak Front"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setCardToEdit(card);
                      setIsCardModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition"
                    title="Edit Card"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 transition"
                    title="Delete Card"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CardEditorModal
        isOpen={isCardModalOpen}
        onClose={() => {
          setIsCardModalOpen(false);
          setCardToEdit(null);
        }}
        deckId={deck.id}
        cardToEdit={cardToEdit}
      />

      <CreateEditDeckModal
        isOpen={isEditDeckModalOpen}
        onClose={() => setIsEditDeckModalOpen(false)}
        userId={userId}
        deckToEdit={deck}
      />

      <AIGenerateModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        userId={userId}
        targetDeckId={deck.id}
      />
    </div>
  );
}
