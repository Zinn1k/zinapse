"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  RotateCw,
  ArrowLeft,
  Flame,
  Award,
} from "lucide-react";
import { type Card, type Deck, db } from "@/lib/db";
import { rateCardFSRS, Rating } from "@/lib/fsrs";
import { MarkdownMath } from "../MarkdownMath";
import confetti from "canvas-confetti";

interface LearnModeProps {
  deck: Deck;
  cards: Card[];
  userId: string;
  onExit: () => void;
}

interface QuestionItem {
  card: Card;
  type: "choice" | "written";
  options?: string[]; // 4 multiple choice options
  correctIndex?: number;
}

export function LearnMode({ deck, cards, userId, onExit }: LearnModeProps) {
  const [queue, setQueue] = useState<Card[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionItem | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalAttempted, setTotalAttempted] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize learning queue prioritizing due cards
  useEffect(() => {
    async function initQueue() {
      if (cards.length === 0) {
        setLoading(false);
        return;
      }

      const states = await db.fsrs_states.where("deckId").equals(deck.id).toArray();
      const userStates = states.filter((s) => s.userId === userId);
      const stateMap = new Map(userStates.map((s) => [s.cardId, s]));
      const now = Date.now();

      // Sort: due cards first, then learning, then new
      const sorted = [...cards].sort((a, b) => {
        const sa = stateMap.get(a.id);
        const sb = stateMap.get(b.id);
        const aDue = sa ? (sa.due instanceof Date ? sa.due.getTime() : sa.due) : 0;
        const bDue = sb ? (sb.due instanceof Date ? sb.due.getTime() : sb.due) : 0;
        return aDue - bDue;
      });

      setQueue(sorted);
      setLoading(false);
    }

    initQueue();
  }, [cards, deck.id, userId]);

  // Load next question whenever queue changes
  useEffect(() => {
    if (loading) return;

    if (queue.length === 0) {
      if (totalAttempted > 0) {
        setIsFinished(true);
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      }
      return;
    }

    const nextCard = queue[0];
    const isMultipleChoice = cards.length >= 4;

    if (isMultipleChoice) {
      // Pick 3 distractor answers from other cards
      const otherCards = cards.filter((c) => c.id !== nextCard.id);
      const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5);
      const distractors = shuffledOthers
        .slice(0, 3)
        .map((c) => c.definition || c.back || "");

      const correctAns = nextCard.definition || nextCard.back || "";
      const allChoices = [...distractors, correctAns].sort(() => Math.random() - 0.5);
      const correctIdx = allChoices.indexOf(correctAns);

      setCurrentQuestion({
        card: nextCard,
        type: "choice",
        options: allChoices,
        correctIndex: correctIdx,
      });
    } else {
      setCurrentQuestion({
        card: nextCard,
        type: "written",
      });
    }

    setIsAnswered(false);
    setSelectedChoice(null);
    setWrittenAnswer("");
  }, [queue, loading, cards, totalAttempted]);

  const handleSelectChoice = (index: number) => {
    if (isAnswered || !currentQuestion) return;

    const correct = index === currentQuestion.correctIndex;
    setSelectedChoice(index);
    setIsAnswered(true);
    setIsCorrect(correct);
    setTotalAttempted((n) => n + 1);

    if (correct) {
      setCorrectCount((n) => n + 1);
      setStreak((s) => s + 1);
      rateCardFSRS(currentQuestion.card.id, deck.id, userId, Rating.Good);
    } else {
      setStreak(0);
      rateCardFSRS(currentQuestion.card.id, deck.id, userId, Rating.Again);
    }
  };

  const handleWrittenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnswered || !currentQuestion || !writtenAnswer.trim()) return;

    const cleanInput = writtenAnswer.trim().toLowerCase().replace(/[.,!?'"`$]/g, "");
    const cleanBack = (currentQuestion.card.definition || currentQuestion.card.back || "")
      .trim()
      .toLowerCase()
      .replace(/[.,!?'"`$]/g, "");

    const correct = cleanInput === cleanBack || cleanBack.includes(cleanInput);

    setIsAnswered(true);
    setIsCorrect(correct);
    setTotalAttempted((n) => n + 1);

    if (correct) {
      setCorrectCount((n) => n + 1);
      setStreak((s) => s + 1);
      rateCardFSRS(currentQuestion.card.id, deck.id, userId, Rating.Good);
    } else {
      setStreak(0);
      rateCardFSRS(currentQuestion.card.id, deck.id, userId, Rating.Again);
    }
  };

  const handleProceedNext = () => {
    if (!currentQuestion) return;

    if (isCorrect) {
      // Remove learned card from active queue
      setQueue((prev) => prev.slice(1));
    } else {
      // Re-queue card to the end of the session to ensure recall!
      setQueue((prev) => [...prev.slice(1), currentQuestion.card]);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-zinc-500">
        Loading spaced repetition queue...
      </div>
    );
  }

  if (isFinished) {
    const accuracy = Math.round((correctCount / Math.max(1, totalAttempted)) * 100);
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white mx-auto shadow-lg shadow-indigo-500/25">
          <Award className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white">
            Session Completed!
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Great job! You reviewed your queue and scheduled future retention dates.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {accuracy}%
            </div>
            <div className="text-xs text-zinc-500">First-pass Accuracy</div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {correctCount}
            </div>
            <div className="text-xs text-zinc-500">Cards Mastered</div>
          </div>
        </div>

        <div className="flex justify-center space-x-3 pt-2">
          <button
            onClick={() => {
              setIsFinished(false);
              setTotalAttempted(0);
              setCorrectCount(0);
              setQueue([...cards]);
            }}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-semibold transition"
          >
            <RotateCw className="w-4 h-4" />
            <span>Practice More</span>
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

  if (!currentQuestion) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          className="flex items-center space-x-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Learn</span>
        </button>

        <div className="flex items-center space-x-4">
          {streak > 1 && (
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/20 animate-pulse">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{streak} Streak</span>
            </div>
          )}
          <span className="text-xs font-semibold text-zinc-500">
            {queue.length} left in queue
          </span>
        </div>
      </div>

      {/* Question Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="uppercase tracking-widest font-semibold text-indigo-500">
            Question
          </span>
          {currentQuestion.card.hint && (
            <span className="text-amber-600 dark:text-amber-400 italic">
              Hint: {currentQuestion.card.hint}
            </span>
          )}
        </div>

        <div className="text-lg sm:text-xl font-medium text-zinc-900 dark:text-white leading-relaxed">
          <MarkdownMath content={currentQuestion.card.term || currentQuestion.card.front || ""} />
        </div>

        {(currentQuestion.card.imageData || currentQuestion.card.frontImage) && (
          <img
            src={currentQuestion.card.imageData || currentQuestion.card.frontImage}
            alt="Question illustration"
            className="max-h-48 mx-auto rounded-xl object-contain shadow-sm mt-3"
          />
        )}
      </div>

      {/* Answer Area */}
      {currentQuestion.type === "choice" && currentQuestion.options ? (
        <div className="space-y-2.5">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = selectedChoice === idx;
            const isTheCorrectChoice = idx === currentQuestion.correctIndex;

            let buttonStyle =
              "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-400 dark:hover:border-indigo-600 text-zinc-800 dark:text-zinc-200";

            if (isAnswered) {
              if (isTheCorrectChoice) {
                buttonStyle =
                  "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold";
              } else if (isSelected) {
                buttonStyle =
                  "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300";
              } else {
                buttonStyle = "opacity-40 border-zinc-200 dark:border-zinc-800";
              }
            }

            return (
              <button
                key={idx}
                disabled={isAnswered}
                onClick={() => handleSelectChoice(idx)}
                className={`w-full p-4 rounded-2xl border text-left flex items-start space-x-3 transition active:scale-[0.99] ${buttonStyle}`}
              >
                <span className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-400 mt-0.5 shrink-0">
                  {["A", "B", "C", "D"][idx]}
                </span>
                <div className="flex-1 text-sm sm:text-base">
                  <MarkdownMath content={option} />
                </div>
                {isAnswered && isTheCorrectChoice && (
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                )}
                {isAnswered && isSelected && !isTheCorrectChoice && (
                  <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        /* Written Input */
        <form onSubmit={handleWrittenSubmit} className="space-y-3">
          <input
            type="text"
            disabled={isAnswered}
            value={writtenAnswer}
            onChange={(e) => setWrittenAnswer(e.target.value)}
            placeholder="Type your answer here..."
            className="w-full p-4 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          {!isAnswered && (
            <button
              type="submit"
              disabled={!writtenAnswer.trim()}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm transition disabled:opacity-50"
            >
              Check Answer
            </button>
          )}
        </form>
      )}

      {/* Answer Feedback & Proceed */}
      {isAnswered && (
        <div
          className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200 ${
            isCorrect
              ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
              : "bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-800"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-sm">
              {isCorrect ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-300">
                    Correct! FSRS scheduled forward
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-red-700 dark:text-red-300">
                    Not quite! Re-queued for review
                  </span>
                </>
              )}
            </div>
            {!isCorrect && (
              <div className="text-xs text-zinc-700 dark:text-zinc-300">
                <span className="font-semibold">Correct Answer: </span>
                <MarkdownMath content={currentQuestion.card.definition || currentQuestion.card.back || ""} />
              </div>
            )}
          </div>

          <button
            onClick={handleProceedNext}
            className="flex items-center space-x-1 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-sm font-semibold transition shrink-0"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
