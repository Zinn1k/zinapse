"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import {
  X,
  Sparkles,
  Loader2,
  Check,
  Plus,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { generateFlashcardsWithAI, type GeneratedCard } from "@/lib/ai";
import { db, type Deck, type Card, GUEST_USER_ID } from "@/lib/db";
import { generateId, generateShareCode } from "@/lib/utils";
import { hasCloze, renderClozeQuestion, renderClozeAnswer } from "@/lib/cloze";
import { MarkdownMath } from "./MarkdownMath";

interface AIGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  targetDeckId?: string; // Optional: If provided, adds to this existing deck
  onDeckCreated?: (deckId: string) => void;
}

export function AIGenerateModal({
  isOpen,
  onClose,
  userId,
  targetDeckId,
  onDeckCreated,
}: AIGenerateModalProps) {
  const [prompt, setPrompt] = useState("");
  const [deckTitle, setDeckTitle] = useState("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [style, setStyle] = useState<"term-definition" | "exam-qa" | "concept-summary" | "cloze">("term-definition");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  if (!isOpen) return null;

  const handleImageUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Пожалуйста, загрузите изображение (PNG, JPG, WebP).");
      return;
    }
    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const res = e.target?.result as string;
      if (res) {
        setSelectedImage(res);
        if (!deckTitle) {
          const suggestedTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
          setDeckTitle(suggestedTitle);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !selectedImage) {
      setError("Введите тему, конспект или прикрепите фото конспекта.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cards = await generateFlashcardsWithAI({
        prompt: prompt.trim() || "Analyze the attached image and generate flashcards.",
        image: selectedImage || undefined,
        count,
        difficulty,
        style,
      });

      setGeneratedCards(cards);
      setSelectedIndices(new Set(cards.map((_, i) => i)));

      if (!deckTitle) {
        // Auto-generate title from prompt snippet
        const titleWords = (prompt.trim() || imageFileName || "AI Generated Deck")
          .split(/\s+/)
          .slice(0, 5)
          .join(" ");
        setDeckTitle(titleWords.length > 3 ? titleWords : "AI Generated Deck");
      }
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate cards. Ensure your Gemini API Key is set in Settings."
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectCard = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedIndices(next);
  };

  const handleSaveToDeck = async () => {
    const selectedCards = generatedCards.filter((_, i) => selectedIndices.has(i));
    if (selectedCards.length === 0) {
      setError("Please select at least one card to save.");
      return;
    }

    const now = Date.now();
    let finalDeckId = targetDeckId;

    if (!finalDeckId) {
      finalDeckId = generateId();
      const newDeck: Deck = {
        id: finalDeckId,
        ownerId: userId || GUEST_USER_ID,
        userId: userId || GUEST_USER_ID,
        title: deckTitle.trim() || "AI Generated Deck",
        description: `Generated with Gemini AI (${difficulty} level)`,
        tags: ["AI", "Gemini"],
        isPublic: true,
        shareCode: generateShareCode(),
        createdAt: now,
        updatedAt: now,
      };
      await db.decks.add(newDeck);
    }

    const cardsToInsert: Card[] = selectedCards.map((c, i) => {
      const term = c.term || c.front || "";
      const definition = c.definition || c.back || "";
      return {
        id: generateId(),
        deckId: finalDeckId!,
        term,
        definition,
        front: term,
        back: definition,
        hint: c.hint,
        order: i + 1,
        createdAt: now,
        updatedAt: now,
      };
    });

    await db.cards.bulkAdd(cardsToInsert);

    if (onDeckCreated) {
      onDeckCreated(finalDeckId);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                Generate Deck with Gemini AI
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Turns any notes, syllabus, or topic into high-yield spaced repetition cards
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 text-sm rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          {generatedCards.length === 0 ? (
            /* Input Form */
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                <span className="text-xs text-indigo-700 dark:text-indigo-300">
                  Нужно загрузить большой файл .txt или .md?
                </span>
                <Link
                  href="/create-ai"
                  onClick={onClose}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  Открыть /create-ai →
                </Link>
              </div>

              {/* Image OCR Upload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                    Фото или скан конспекта (Vision OCR)
                  </label>
                  {selectedImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImage(null);
                        setImageFileName(null);
                      }}
                      className="text-[11px] text-red-500 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Удалить фото
                    </button>
                  )}
                </div>

                {selectedImage ? (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60">
                    <img
                      src={selectedImage}
                      alt="OCR Preview"
                      className="w-12 h-12 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate text-zinc-900 dark:text-white">
                        {imageFileName || "Фото конспекта"}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Будет распознано с помощью Gemini Multimodal OCR
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="text-xs px-2.5 py-1 rounded-md border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium"
                    >
                      Заменить
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full py-2.5 px-3 border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 rounded-xl text-xs text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-2 transition"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Загрузить фото доски, формул или страницы тетради</span>
                  </button>
                )}

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
                  Topic, Notes, or Textbook Excerpt
                </label>
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Organic Chemistry reaction mechanisms, French irregular verbs, or paste your lecture notes here..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {!targetDeckId && (
                <div>
                  <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
                    Deck Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={deckTitle}
                    onChange={(e) => setDeckTitle(e.target.value)}
                    placeholder="e.g. Organic Chemistry: Alkenes & Alkynes"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Card Count
                  </label>
                  <select
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={5}>5 Cards</option>
                    <option value={10}>10 Cards</option>
                    <option value={15}>15 Cards</option>
                    <option value={20}>20 Cards</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Format / Style
                  </label>
                  <select
                    value={style}
                    onChange={(e) =>
                      setStyle(
                        e.target.value as "term-definition" | "exam-qa" | "concept-summary" | "cloze"
                      )
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="term-definition">Term — Definition</option>
                    <option value="exam-qa">Exam Q&A</option>
                    <option value="concept-summary">Concept Summary</option>
                    <option value="cloze">Cloze Deletion (Пропуски)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Difficulty Level
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) =>
                      setDifficulty(
                        e.target.value as "beginner" | "intermediate" | "advanced"
                      )
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* Cards Preview & Selection */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Generated {generatedCards.length} Cards ({selectedIndices.size} selected)
                </span>
                <button
                  onClick={() => setGeneratedCards([])}
                  className="text-xs text-indigo-500 hover:underline"
                >
                  Back to Prompt
                </button>
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {generatedCards.map((card, idx) => {
                  const isSelected = selectedIndices.has(idx);
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleSelectCard(idx)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20"
                          : "border-zinc-200 dark:border-zinc-800 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-start justify-between space-x-3">
                        <div className="flex-1 space-y-1.5">
                          <div className="font-medium text-sm text-zinc-900 dark:text-white">
                            <span className="text-xs font-semibold text-indigo-500 mr-1.5">
                              #{idx + 1}
                            </span>
                            {hasCloze(card.term || card.front || "") && (
                              <span className="mr-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                                Cloze
                              </span>
                            )}
                            <MarkdownMath
                              content={
                                hasCloze(card.term || card.front || "")
                                  ? renderClozeQuestion(card.term || card.front || "")
                                  : (card.term || card.front || "")
                              }
                            />
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-300 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                            <MarkdownMath
                              content={
                                hasCloze(card.term || card.front || "")
                                  ? `${renderClozeAnswer(card.term || card.front || "")}${card.definition ? ` — ${card.definition}` : ""}`
                                  : (card.definition || card.back || "")
                              }
                            />
                          </div>
                          {card.hint && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                              Hint: {card.hint}
                            </p>
                          )}
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                            isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "border-zinc-300 dark:border-zinc-700"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end space-x-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Cancel
          </button>

          {generatedCards.length === 0 ? (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center space-x-2 px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Cards...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Generate Cards</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleSaveToDeck}
              className="flex items-center space-x-2 px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Save {selectedIndices.size} Cards to Deck</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
