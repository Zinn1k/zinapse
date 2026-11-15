"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCw,
  Flame,
  Award,
  Volume2,
  ArrowRight,
} from "lucide-react";
import { db, type Card, type Deck, GUEST_USER_ID } from "@/lib/db";
import { rateCardFSRS, Rating } from "@/lib/fsrs";
import { speakText } from "@/lib/speech";
import { checkAnswerWithFuzzy, type CheckAnswerResult } from "@/lib/levenshtein";
import { MarkdownMath } from "@/components/MarkdownMath";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import confetti from "canvas-confetti";

type CardStage = 1 | 2 | 3; // 1 = Multiple Choice, 2 = Written Input, 3 = Mastered

interface LearnCardState {
  card: Card;
  stage: CardStage;
  attempts: number;
  streak: number;
}

export default function LearnModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const deckId = resolvedParams.id;
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cardsPool, setCardsPool] = useState<Card[]>([]);
  const [cardStates, setCardStates] = useState<Map<string, LearnCardState>>(new Map());
  const [activeQueue, setActiveQueue] = useState<string[]>([]); // Card IDs in active queue
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Question state
  const [mcOptions, setMcOptions] = useState<string[]>([]);
  const [mcCorrectIndex, setMcCorrectIndex] = useState<number>(0);
  const [selectedMcIndex, setSelectedMcIndex] = useState<number | null>(null);

  const [writtenInput, setWrittenInput] = useState("");
  const [fuzzyResult, setFuzzyResult] = useState<CheckAnswerResult | null>(null);

  const [isAnswered, setIsAnswered] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [totalStepsCompleted, setTotalStepsCompleted] = useState(0);
  const [loading, setLoading] = useState(true);

  const userId = GUEST_USER_ID;

  // Initialize Learn Session
  const initLearnSession = useCallback(async () => {
    setLoading(true);
    const d = await db.decks.get(deckId);
    if (!d) {
      setLoading(false);
      return;
    }
    setDeck(d);

    const cards = await db.cards.where("deckId").equals(deckId).sortBy("order");
    setCardsPool(cards);

    if (cards.length === 0) {
      setLoading(false);
      return;
    }

    const stateMap = new Map<string, LearnCardState>();
    const queueIds: string[] = [];

    // Shuffle cards for varied learning order
    const shuffled = [...cards].sort(() => Math.random() - 0.5);

    shuffled.forEach((c) => {
      stateMap.set(c.id, {
        card: c,
        stage: 1, // Start with Stage 1: Multiple Choice
        attempts: 0,
        streak: 0,
      });
      queueIds.push(c.id);
    });

    setCardStates(stateMap);
    setActiveQueue(queueIds);
    setTotalStepsCompleted(0);
    setSessionStreak(0);
    setLoading(false);
  }, [deckId]);

  useEffect(() => {
    initLearnSession();
  }, [initLearnSession]);

  // Set up question when activeQueue or currentId changes
  useEffect(() => {
    if (loading || activeQueue.length === 0) {
      setCurrentId(null);
      return;
    }

    const nextCardId = activeQueue[0];
    const currentState = cardStates.get(nextCardId);
    if (!currentState) return;

    setCurrentId(nextCardId);
    setIsAnswered(false);
    setSelectedMcIndex(null);
    setWrittenInput("");
    setFuzzyResult(null);

    const currentCard = currentState.card;
    const correctDef = currentCard.definition || currentCard.back || "";

    if (currentState.stage === 1) {
      // Stage 1: Prepare 4 multiple choice options
      const otherCards = cardsPool.filter((c) => c.id !== currentCard.id);
      const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5);
      const distractors = shuffledOthers
        .slice(0, 3)
        .map((c) => c.definition || c.back || "");

      // If fewer than 3 other cards in deck, fill with generic options
      while (distractors.length < 3) {
        distractors.push(`Вариант ${distractors.length + 2}`);
      }

      const allChoices = [...distractors, correctDef].sort(() => Math.random() - 0.5);
      const correctIdx = allChoices.indexOf(correctDef);

      setMcOptions(allChoices);
      setMcCorrectIndex(correctIdx);
    }
  }, [activeQueue, cardStates, cardsPool, loading]);

  const currentItem = currentId ? cardStates.get(currentId) : null;
  const currentCard = currentItem?.card;
  const currentStage = currentItem?.stage || 1;

  // Handle Stage 1: Multiple Choice selection
  const handleSelectOption = useCallback((index: number) => {
    if (isAnswered || !currentId || !currentItem) return;

    const correct = index === mcCorrectIndex;
    setSelectedMcIndex(index);
    setIsAnswered(true);
    setIsSuccess(correct);

    if (correct) {
      setSessionStreak((s) => s + 1);
      rateCardFSRS(currentId, deckId, userId, Rating.Good);
    } else {
      setSessionStreak(0);
      rateCardFSRS(currentId, deckId, userId, Rating.Again);
    }
  }, [currentId, currentItem, deckId, isAnswered, mcCorrectIndex, userId]);

  // Handle Stage 2: Written submission with Levenshtein fuzzy checking
  const handleWrittenSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isAnswered || !currentId || !currentItem || !currentCard) return;

    const expectedTerm = currentCard.term || currentCard.front || "";
    const result = checkAnswerWithFuzzy(writtenInput, expectedTerm);

    setFuzzyResult(result);
    setIsAnswered(true);

    if (result.isExact) {
      setIsSuccess(true);
      setSessionStreak((s) => s + 1);
      rateCardFSRS(currentId, deckId, userId, Rating.Good);
    } else if (result.isClose) {
      // Typo detected: let user decide with "Засчитать мой ответ"
      setIsSuccess(false);
    } else {
      setIsSuccess(false);
      setSessionStreak(0);
      rateCardFSRS(currentId, deckId, userId, Rating.Again);
    }
  };

  // Overriding a typo to count as correct
  const handleOverrideCorrect = () => {
    if (!currentId) return;
    setIsSuccess(true);
    setSessionStreak((s) => s + 1);
    rateCardFSRS(currentId, deckId, userId, Rating.Good);
  };

  // Transition to next question in active queue
  const handleProceedNext = useCallback(() => {
    if (!currentId || !currentItem) return;

    const nextStates = new Map(cardStates);

    if (isSuccess) {
      setTotalStepsCompleted((n) => n + 1);

      if (currentStage === 1) {
        // Advanced from Stage 1 to Stage 2: Written input
        nextStates.set(currentId, {
          ...currentItem,
          stage: 2,
          attempts: currentItem.attempts + 1,
        });
        // Move to the back of the queue to practice writing it later
        setActiveQueue((prev) => [...prev.slice(1), currentId]);
      } else if (currentStage === 2) {
        // Mastered!
        nextStates.set(currentId, {
          ...currentItem,
          stage: 3,
          attempts: currentItem.attempts + 1,
        });
        // Remove from active queue
        const remaining = activeQueue.slice(1);
        setActiveQueue(remaining);

        if (remaining.length === 0) {
          confetti({ particleCount: 120, spread: 85, origin: { y: 0.6 } });
        }
      }
    } else {
      // Made an error: reset to Stage 1 and re-queue at end
      nextStates.set(currentId, {
        ...currentItem,
        stage: 1,
        attempts: currentItem.attempts + 1,
      });
      setActiveQueue((prev) => [...prev.slice(1), currentId]);
    }

    setCardStates(nextStates);
  }, [activeQueue, cardStates, currentId, currentItem, currentStage, isSuccess]);

  // Hotkeys 1-4 for Stage 1 selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (currentStage === 1 && !isAnswered) {
        if (e.key === "1") handleSelectOption(0);
        else if (e.key === "2") handleSelectOption(1);
        else if (e.key === "3") handleSelectOption(2);
        else if (e.key === "4") handleSelectOption(3);
      } else if (isAnswered && (e.key === "Enter" || e.code === "Space")) {
        e.preventDefault();
        handleProceedNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStage, isAnswered, handleSelectOption, handleProceedNext]);

  // Calculations for progress
  const totalCards = cardsPool.length;
  const masteredCards = Array.from(cardStates.values()).filter(
    (s) => s.stage === 3
  ).length;
  const progressPercent =
    totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;
  const isAllMastered = activeQueue.length === 0 && totalCards > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black text-zinc-500">
        Загрузка режима заучивания...
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
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
      {/* Top Bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href={`/deck/${deck.id}`}
            className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Выйти из Заучивания</span>
          </Link>

          <div className="flex items-center space-x-3">
            {sessionStreak > 1 && (
              <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs border border-amber-500/20">
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>{sessionStreak} подряд</span>
              </div>
            )}
            <Badge variant="outline" className="text-xs font-mono">
              Осталось: {activeQueue.length}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 flex flex-col justify-between space-y-6">
        {/* Progress Bar & Stage Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
            <span className="flex items-center space-x-2">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                Усвоение: {progressPercent}%
              </span>
              <span>
                ({masteredCards} из {totalCards} выучено)
              </span>
            </span>

            {currentStage && (
              <Badge
                variant={currentStage === 1 ? "secondary" : "default"}
                className="text-[10px]"
              >
                {currentStage === 1
                  ? "Этап 1: Выбор варианта"
                  : "Этап 2: Письменный ввод"}
              </Badge>
            )}
          </div>

          <Progress value={progressPercent} className="h-2" />
        </div>

        {isAllMastered ? (
          /* Victory Screen - 100% Mastery Achieved */
          <div className="my-auto py-12 px-4 text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white mx-auto shadow-2xl shadow-indigo-500/25">
              <Award className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-black">100% карточек усвоено!</h2>
              <p className="text-sm text-zinc-500 max-w-md mx-auto">
                Поздравляем! Вы успешно прошли оба этапа (тестовый и письменный) для всех карточек этой колоды.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div>
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {totalCards}
                </div>
                <div className="text-[11px] text-zinc-500">Выучено</div>
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {totalStepsCompleted}
                </div>
                <div className="text-[11px] text-zinc-500">Шагов проверки</div>
              </div>
            </div>

            <div className="flex justify-center space-x-3 pt-2">
              <Button variant="outline" onClick={initLearnSession}>
                <RotateCw className="w-4 h-4 mr-1.5" />
                Пройти заново
              </Button>
              <Button onClick={() => router.push(`/deck/${deck.id}`)}>
                Обзор колоды
              </Button>
            </div>
          </div>
        ) : currentCard ? (
          /* Active Question Interface */
          <div className="flex-1 flex flex-col justify-between space-y-6">
            {/* Prompt Box */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="uppercase tracking-widest font-bold text-indigo-500">
                  {currentStage === 1 ? "Вопрос (Термин)" : "Напишите термин по определению"}
                </span>
                <div className="flex items-center space-x-2">
                  {currentCard.hint && (
                    <span className="text-amber-600 dark:text-amber-400 text-xs italic">
                      Подсказка: {currentCard.hint}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      speakText(
                        currentStage === 1
                          ? currentCard.term || currentCard.front || ""
                          : currentCard.definition || currentCard.back || ""
                      )
                    }
                    className="p-1 text-zinc-400 hover:text-indigo-500 transition"
                    title="Озвучить"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Display term if Stage 1, or definition if Stage 2 */}
              <div className="text-lg sm:text-xl font-medium text-zinc-900 dark:text-white leading-relaxed">
                <MarkdownMath
                  content={
                    currentStage === 1
                      ? currentCard.term || currentCard.front || ""
                      : currentCard.definition || currentCard.back || ""
                  }
                />
              </div>

              {(currentCard.imageData || currentCard.frontImage) && (
                <img
                  src={currentCard.imageData || currentCard.frontImage}
                  alt="Иллюстрация"
                  className="max-h-44 rounded-xl object-contain shadow-sm border border-zinc-100 dark:border-zinc-800"
                />
              )}
            </div>

            {/* Answer Controls: Stage 1 vs Stage 2 */}
            {currentStage === 1 ? (
              /* Stage 1: 4 Multiple Choice Options */
              <div className="space-y-2.5">
                {mcOptions.map((option, idx) => {
                  const isSelected = selectedMcIndex === idx;
                  const isTheCorrect = idx === mcCorrectIndex;

                  let style =
                    "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-indigo-400";

                  if (isAnswered) {
                    if (isTheCorrect) {
                      style =
                        "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-semibold ring-1 ring-emerald-500";
                    } else if (isSelected && !isTheCorrect) {
                      style =
                        "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 ring-1 ring-red-500";
                    } else {
                      style = "opacity-40 border-zinc-200 dark:border-zinc-800";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      disabled={isAnswered}
                      onClick={() => handleSelectOption(idx)}
                      className={`w-full p-4 rounded-2xl border text-left flex items-start space-x-3 transition active:scale-[0.99] ${style}`}
                    >
                      <span className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-400 shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 text-sm sm:text-base">
                        <MarkdownMath content={option} />
                      </div>
                      {isAnswered && isTheCorrect && (
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      )}
                      {isAnswered && isSelected && !isTheCorrect && (
                        <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}

                <div className="text-center text-[11px] text-zinc-400">
                  Клавиши <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[10px]">1–4</kbd> для быстрого выбора
                </div>
              </div>
            ) : (
              /* Stage 2: Written input with Levenshtein fuzzy validation */
              <form onSubmit={handleWrittenSubmit} className="space-y-3">
                <input
                  type="text"
                  disabled={isAnswered}
                  value={writtenInput}
                  onChange={(e) => setWrittenInput(e.target.value)}
                  placeholder="Введите точный термин..."
                  className="w-full p-4 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />

                {!isAnswered && (
                  <Button
                    type="submit"
                    disabled={!writtenInput.trim()}
                    className="w-full py-6 text-base rounded-2xl"
                  >
                    Проверить ответ
                  </Button>
                )}
              </form>
            )}

            {/* Answer Feedback Banner */}
            {isAnswered && (
              <div
                className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200 ${
                  isSuccess
                    ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
                    : fuzzyResult?.isClose
                    ? "bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
                    : "bg-red-50/80 dark:bg-red-950/40 border-red-300 dark:border-red-800"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-sm">
                    {isSuccess ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-300">
                          {currentStage === 1
                            ? "Верно! Переходим к письменному закреплению."
                            : "Отлично! Карточка полностью усвоена."}
                        </span>
                      </>
                    ) : fuzzyResult?.isClose ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-amber-700 dark:text-amber-300">
                          Почти верно! Возможно, опечатка:
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <span className="text-red-700 dark:text-red-300">
                          Неверно. Карточка возвращена на повторение.
                        </span>
                      </>
                    )}
                  </div>

                  {(!isSuccess || fuzzyResult?.isClose) && (
                    <div className="text-xs text-zinc-700 dark:text-zinc-300 pt-0.5">
                      <span className="font-semibold">Правильный ответ: </span>
                      <span className="font-bold underline text-indigo-600 dark:text-indigo-400">
                        {currentStage === 1
                          ? currentCard.definition || currentCard.back || ""
                          : currentCard.term || currentCard.front || ""}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                  {fuzzyResult?.isClose && !isSuccess && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOverrideCorrect}
                      className="text-xs border-amber-400 text-amber-700 dark:text-amber-300"
                    >
                      Засчитать мой ответ
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={handleProceedNext}
                    className="flex items-center space-x-1 text-xs"
                  >
                    <span>Далее</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
