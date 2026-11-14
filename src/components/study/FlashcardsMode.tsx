"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Volume2,
  Maximize2,
  Minimize2,
  Sparkles,
  HelpCircle,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { type Card, type Deck } from "@/lib/db";
import {
  rateCardFSRS,
  getFSRSIntervalPreviews,
  Rating,
  type IntervalPreview,
} from "@/lib/fsrs";
import { speakText } from "@/lib/speech";
import { MarkdownMath } from "../MarkdownMath";
import confetti from "canvas-confetti";

interface FlashcardsModeProps {
  deck: Deck;
  cards: Card[];
  userId: string;
  onExit: () => void;
}

export function FlashcardsMode({
  deck,
  cards: initialCards,
  userId,
  onExit,
}: FlashcardsModeProps) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [intervals, setIntervals] = useState<IntervalPreview[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  const currentCard = cards[currentIndex];

  // Load FSRS projected intervals for current card
  useEffect(() => {
    if (!currentCard) return;
    setIsFlipped(false);
    setShowHint(false);

    getFSRSIntervalPreviews(currentCard.id, deck.id, userId).then((previews) => {
      setIntervals(previews);
    });
  }, [currentCard, deck.id, userId]);

  const handleNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setIsCompleted(true);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }
  }, [currentIndex, cards.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  const handleFlip = useCallback(() => {
    setIsFlipped((f) => !f);
  }, []);

  const handleRate = async (rating: Rating) => {
    if (!currentCard) return;
    await rateCardFSRS(currentCard.id, deck.id, userId, rating);
    handleNext();
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleTTS = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentCard) return;
    if (isFlipped) {
      speakText(currentCard.definition || currentCard.back || "", { lang: currentCard.backLang });
    } else {
      speakText(currentCard.term || currentCard.front || "", { lang: currentCard.frontLang });
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        handleFlip();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "1") {
        handleRate(Rating.Again);
      } else if (e.key === "2") {
        handleRate(Rating.Hard);
      } else if (e.key === "3") {
        handleRate(Rating.Good);
      } else if (e.key === "4") {
        handleRate(Rating.Easy);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlip, handleNext, handlePrev]);

  if (cards.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Deck is empty</h3>
        <p className="text-sm text-zinc-500">Please add cards to this deck before studying.</p>
        <button
          onClick={onExit}
          className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium"
        >
          Return to Deck
        </button>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
          <CheckCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
            Study Session Finished!
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            You reviewed all {cards.length} cards. Your progress has been calculated by the FSRS spaced repetition engine.
          </p>
        </div>
        <div className="flex justify-center space-x-3 pt-2">
          <button
            onClick={() => {
              setIsCompleted(false);
              setCurrentIndex(0);
              setIsFlipped(false);
            }}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-semibold transition"
          >
            <RotateCw className="w-4 h-4" />
            <span>Study Again</span>
          </button>
          <button
            onClick={onExit}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition"
          >
            Back to Deck
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full max-w-4xl mx-auto px-4 py-4 ${
        isFullscreen ? "fixed inset-0 z-50 bg-white dark:bg-zinc-950 p-6 max-w-none" : ""
      }`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onExit}
          className="flex items-center space-x-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Deck</span>
        </button>

        <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
          <span>{currentIndex + 1}</span>
          <span>/</span>
          <span>{cards.length}</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleShuffle}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition"
            title="Shuffle cards"
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mb-6">
        <div
          className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
          style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
        />
      </div>

      {/* 3D Flip Card Container */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[380px] sm:min-h-[460px] perspective-1000 w-full select-none cursor-pointer">
        <motion.div
          onClick={handleFlip}
          className="relative w-full h-full max-w-3xl transform-style-3d shadow-xl rounded-3xl"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
        >
          {/* FRONT SIDE */}
          <div className="absolute inset-0 backface-hidden w-full h-full p-8 sm:p-12 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between overflow-y-auto">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="uppercase tracking-widest font-semibold text-indigo-500">
                Front Side
              </span>
              <div className="flex items-center space-x-2">
                {currentCard.hint && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHint(!showHint);
                    }}
                    className="p-1 text-amber-500 hover:text-amber-600"
                    title="Toggle Hint"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleTTS}
                  className="p-1 text-zinc-400 hover:text-indigo-500 transition"
                  title="Speak Audio"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="my-auto py-4 text-center">
              <div className="text-xl sm:text-2xl font-medium text-zinc-900 dark:text-white leading-relaxed">
                <MarkdownMath content={currentCard.term || currentCard.front || ""} />
              </div>

              {(currentCard.imageData || currentCard.frontImage) && (
                <img
                  src={currentCard.imageData || currentCard.frontImage}
                  alt="Illustration"
                  className="mt-6 max-h-56 mx-auto rounded-xl object-contain shadow-sm"
                />
              )}

              {showHint && currentCard.hint && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-2 text-xs rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 inline-block border border-amber-200 dark:border-amber-900"
                >
                  Hint: {currentCard.hint}
                </motion.div>
              )}
            </div>

            <div className="text-center text-xs text-zinc-400">
              Click or press <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono">Space</kbd> to flip
            </div>
          </div>

          {/* BACK SIDE */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 w-full h-full p-8 sm:p-12 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-indigo-500/40 dark:border-indigo-500/30 flex flex-col justify-between overflow-y-auto">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="uppercase tracking-widest font-semibold text-emerald-500">
                Back Side
              </span>
              <button
                onClick={handleTTS}
                className="p-1 text-zinc-400 hover:text-indigo-500 transition"
                title="Speak Audio"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            <div className="my-auto py-4 text-center">
              <div className="text-lg sm:text-xl text-zinc-800 dark:text-zinc-100 leading-relaxed">
                <MarkdownMath content={currentCard.definition || currentCard.back || ""} />
              </div>

              {currentCard.backImage && (
                <img
                  src={currentCard.backImage}
                  alt="Back illustration"
                  className="mt-6 max-h-56 mx-auto rounded-xl object-contain shadow-sm"
                />
              )}
            </div>

            <div className="text-center text-xs text-zinc-400">
              Rate your recall below to schedule the next review
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Controls: Navigation & FSRS Rating Buttons */}
      <div className="mt-6 space-y-3">
        {/* FSRS Rating Buttons */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-2xl mx-auto">
          {intervals.map((item) => {
            const colors: Record<Rating, string> = {
              [Rating.Manual]: "bg-zinc-50 border-zinc-200 text-zinc-600",
              [Rating.Again]:
                "bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400",
              [Rating.Hard]:
                "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 border-amber-200 dark:border-amber-900/60 text-amber-600 dark:text-amber-400",
              [Rating.Good]:
                "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400",
              [Rating.Easy]:
                "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400",
            };

            return (
              <button
                key={item.rating}
                onClick={() => handleRate(item.rating)}
                className={`py-2 px-2 sm:px-3 rounded-xl border flex flex-col items-center justify-center transition active:scale-95 shadow-sm ${colors[item.rating]}`}
              >
                <span className="text-xs font-bold">{item.label}</span>
                <span className="text-[11px] font-mono opacity-80 mt-0.5">
                  {item.intervalText}
                </span>
                <span className="text-[9px] opacity-60 hidden sm:inline">
                  [{item.rating}]
                </span>
              </button>
            );
          })}
        </div>

        {/* Previous / Flip / Next arrow buttons */}
        <div className="flex items-center justify-center space-x-6 pt-1">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-30 transition"
            title="Previous (Left arrow)"
          >
            <ChevronLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
          </button>

          <button
            onClick={handleFlip}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Flip</span>
          </button>

          <button
            onClick={handleNext}
            className="p-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
            title="Next (Right arrow)"
          >
            <ChevronRight className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
          </button>
        </div>
      </div>
    </div>
  );
}
