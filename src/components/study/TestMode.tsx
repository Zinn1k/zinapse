"use client";

import React, { useState } from "react";
import {
  FileCheck,
  CheckCircle,
  XCircle,
  ArrowLeft,
  RotateCw,
  Award,
} from "lucide-react";
import { type Card, type Deck } from "@/lib/db";
import { MarkdownMath } from "../MarkdownMath";
import confetti from "canvas-confetti";

interface TestModeProps {
  deck: Deck;
  cards: Card[];
  onExit: () => void;
}

interface TestQuestion {
  id: string;
  card: Card;
  type: "choice" | "true_false" | "written";
  prompt: string;
  correctAnswer: string;
  options?: string[];
  isTrue?: boolean;
}

export function TestMode({ deck, cards, onExit }: TestModeProps) {
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number; percent: number } | null>(
    null
  );

  const initTest = () => {
    const testQuestions: TestQuestion[] = [];
    const shuffled = [...cards].sort(() => Math.random() - 0.5);

    shuffled.forEach((c, idx) => {
      // Alternate question types
      const typeIndex = idx % 3;

      if (typeIndex === 0 && cards.length >= 4) {
        // Multiple choice
        const distractors = cards
          .filter((other) => other.id !== c.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((other) => other.back);
        const options = [...distractors, c.back].sort(() => Math.random() - 0.5);

        testQuestions.push({
          id: `q_${c.id}_choice`,
          card: c,
          type: "choice",
          prompt: c.front,
          correctAnswer: c.back,
          options,
        });
      } else if (typeIndex === 1 && cards.length >= 2) {
        // True / False
        const isTrue = Math.random() > 0.5;
        let displayedAnswer = c.back;
        if (!isTrue) {
          const falseCard = cards.find((other) => other.id !== c.id);
          if (falseCard) displayedAnswer = falseCard.back;
        }

        testQuestions.push({
          id: `q_${c.id}_tf`,
          card: c,
          type: "true_false",
          prompt: `${c.front}\n\n*Statement:* "${displayedAnswer}"`,
          correctAnswer: isTrue ? "True" : "False",
          options: ["True", "False"],
          isTrue,
        });
      } else {
        // Written answer
        testQuestions.push({
          id: `q_${c.id}_written`,
          card: c,
          type: "written",
          prompt: c.front,
          correctAnswer: c.back,
        });
      }
    });

    setQuestions(testQuestions);
    setUserAnswers({});
    setIsSubmitted(false);
    setScore(null);
  };

  React.useEffect(() => {
    if (cards.length > 0) {
      initTest();
    }
  }, [cards]);

  const handleSelectAnswer = (qId: string, answer: string) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({ ...prev, [qId]: answer }));
  };

  const handleSubmit = () => {
    let correct = 0;
    questions.forEach((q) => {
      const userAns = (userAnswers[q.id] || "").trim().toLowerCase();
      const actualAns = q.correctAnswer.trim().toLowerCase();

      if (q.type === "written") {
        const cleanUser = userAns.replace(/[.,!?'"`$]/g, "");
        const cleanActual = actualAns.replace(/[.,!?'"`$]/g, "");
        if (cleanUser === cleanActual || cleanActual.includes(cleanUser)) {
          correct++;
        }
      } else {
        if (userAns === actualAns) {
          correct++;
        }
      }
    });

    const total = questions.length;
    const percent = Math.round((correct / Math.max(1, total)) * 100);

    setScore({ correct, total, percent });
    setIsSubmitted(true);

    if (percent >= 70) {
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
    }
  };

  if (cards.length === 0) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Deck is empty</h3>
        <p className="text-sm text-zinc-500">Need cards to generate a test.</p>
        <button
          onClick={onExit}
          className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium"
        >
          Return to Deck
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onExit}
          className="flex items-center space-x-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Test</span>
        </button>

        <div className="flex items-center space-x-2">
          <FileCheck className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            Practice Test: {deck.title}
          </h2>
        </div>

        <span className="text-xs text-zinc-400">
          {Object.keys(userAnswers).length} / {questions.length} answered
        </span>
      </div>

      {/* Results Banner if submitted */}
      {isSubmitted && score && (
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg text-center space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-center space-x-2">
            <Award className="w-6 h-6 text-indigo-500" />
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
              Test Results
            </h3>
          </div>

          <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400">
            {score.percent}%
          </div>

          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You scored {score.correct} out of {score.total} questions correctly.
          </p>

          <div className="flex justify-center space-x-3 pt-2">
            <button
              onClick={initTest}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold transition"
            >
              <RotateCw className="w-4 h-4" />
              <span>Retake Test</span>
            </button>
            <button
              onClick={onExit}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
            >
              Back to Deck
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-6">
        {questions.map((q, idx) => {
          const userAns = userAnswers[q.id] || "";
          const isQuestionAnswered = Boolean(userAns);

          let isQuestionCorrect = false;
          if (isSubmitted) {
            const u = userAns.trim().toLowerCase().replace(/[.,!?'"`$]/g, "");
            const a = q.correctAnswer.trim().toLowerCase().replace(/[.,!?'"`$]/g, "");
            isQuestionCorrect = u === a || a.includes(u);
          }

          return (
            <div
              key={q.id}
              className={`p-6 rounded-2xl bg-white dark:bg-zinc-900 border transition-all ${
                isSubmitted
                  ? isQuestionCorrect
                    ? "border-emerald-500/60 bg-emerald-50/10"
                    : "border-red-500/60 bg-red-50/10"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Question {idx + 1} • {q.type === "choice" ? "Multiple Choice" : q.type === "true_false" ? "True / False" : "Written"}
                </span>
                {isSubmitted && (
                  <div>
                    {isQuestionCorrect ? (
                      <span className="flex items-center space-x-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="w-4 h-4" />
                        <span>Correct</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-xs font-bold text-red-600 dark:text-red-400">
                        <XCircle className="w-4 h-4" />
                        <span>Incorrect</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="text-base font-medium text-zinc-900 dark:text-white mb-4">
                <MarkdownMath content={q.prompt} />
              </div>

              {q.card.frontImage && (
                <img
                  src={q.card.frontImage}
                  alt="Question illustration"
                  className="max-h-40 rounded-xl mb-4 object-contain shadow-sm"
                />
              )}

              {/* Multiple Choice / True False */}
              {(q.type === "choice" || q.type === "true_false") && q.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = userAns === opt;
                    const isTheActualAnswer = opt === q.correctAnswer;

                    let optStyle =
                      "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 hover:border-indigo-400";

                    if (isSelected) {
                      optStyle =
                        "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-300 font-semibold ring-1 ring-indigo-600";
                    }

                    if (isSubmitted) {
                      if (isTheActualAnswer) {
                        optStyle =
                          "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold";
                      } else if (isSelected && !isTheActualAnswer) {
                        optStyle =
                          "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300";
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        disabled={isSubmitted}
                        onClick={() => handleSelectAnswer(q.id, opt)}
                        className={`p-3 rounded-xl border text-left text-sm flex items-start space-x-2 transition ${optStyle}`}
                      >
                        <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {["A", "B", "C", "D"][optIdx] || optIdx + 1}
                        </span>
                        <div className="flex-1">
                          <MarkdownMath content={opt} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Written */}
              {q.type === "written" && (
                <div className="space-y-2">
                  <input
                    type="text"
                    disabled={isSubmitted}
                    value={userAns}
                    onChange={(e) => handleSelectAnswer(q.id, e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {isSubmitted && !isQuestionCorrect && (
                    <div className="p-3 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      <span className="font-semibold block mb-0.5">Correct Answer:</span>
                      <MarkdownMath content={q.correctAnswer} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Bar */}
      {!isSubmitted && (
        <div className="pt-4 pb-12 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={Object.keys(userAnswers).length === 0}
            className="flex items-center space-x-2 px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md shadow-indigo-500/25 transition disabled:opacity-40"
          >
            <CheckCircle className="w-5 h-5" />
            <span>Submit Test ({Object.keys(userAnswers).length}/{questions.length})</span>
          </button>
        </div>
      )}
    </div>
  );
}
