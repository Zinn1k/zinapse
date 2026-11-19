"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCw,
  ArrowLeft,
  Flame,
  Award,
  Volume2,
  ArrowRight,
  ArrowLeftRight,
} from "lucide-react";
import { type Card, type Deck } from "@/lib/db";
import { rateCardFSRS, Rating } from "@/lib/fsrs";
import { speakText } from "@/lib/speech";
import { sound } from "@/lib/sound";
import { checkAnswerWithFuzzy, type CheckAnswerResult } from "@/lib/levenshtein";
import {
  hasCloze,
  renderClozeQuestion,
  stripClozeSyntax,
  extractClozeItems,
} from "@/lib/cloze";
import { MarkdownMath } from "../MarkdownMath";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import confetti from "canvas-confetti";

export type CardStage = 1 | 2 | 3; // 1 = Multiple Choice, 2 = Written Input, 3 = Mastered

export interface LearnCardState {
  card: Card;
  stage: CardStage;
  attempts: number;
  streak: number;
}

export interface LearnModeProps {
  deck: Deck;
  cards: Card[];
  userId: string;
  onExit: () => void;
}

export function LearnMode({
  deck,
  cards: initialCards,
  userId,
  onExit,
}: LearnModeProps) {
  const [cardsPool, setCardsPool] = useState<Card[]>(initialCards);
  const [cardStates, setCardStates] = useState<Map<string, LearnCardState>>(new Map());
  const [activeQueue, setActiveQueue] = useState<string[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Question state
  const [mcOptions, setMcOptions] = useState<string[]>([]);
  const [mcCorrectIndex, setMcCorrectIndex] = useState<number>(0);
  const [selectedMcIndex, setSelectedMcIndex] = useState<number | null>(null);

  const [writtenInput, setWrittenInput] = useState("");
  const [fuzzyResult, setFuzzyResult] = useState<CheckAnswerResult | null>(null);

  const [isAnswered, setIsAnswered] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isReversed, setIsReversed] = useState(false);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [totalStepsCompleted, setTotalStepsCompleted] = useState(0);
  const [loading, setLoading] = useState(true);

  // Initialize Learn Session
  const initLearnSession = useCallback(() => {
    setLoading(true);
    setCardsPool(initialCards);

    if (initialCards.length === 0) {
      setLoading(false);
      return;
    }

    const stateMap = new Map<string, LearnCardState>();
    const queueIds: string[] = [];

    // Shuffle cards for varied learning order
    const shuffled = [...initialCards].sort(() => Math.random() - 0.5);

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
  }, [initialCards]);

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

    const card = currentState.card;
    const isCloze = !isReversed && hasCloze(card.term || card.front || "");
    const clozeItems = isCloze ? extractClozeItems(card.term || card.front || "") : [];

    let correctDef = "";
    if (isCloze) {
      correctDef = clozeItems[0]?.answer || card.definition || card.back || "";
    } else if (isReversed) {
      correctDef = stripClozeSyntax(card.term || card.front || "");
    } else {
      correctDef = card.definition || card.back || "";
    }

    if (currentState.stage === 1) {
      // Stage 1: Prepare 4 multiple choice options
      const otherCards = cardsPool.filter((c) => c.id !== card.id);
      const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5);
      const distractors = shuffledOthers.slice(0, 3).map((c) => {
        if (isCloze) {
          const items = extractClozeItems(c.term || c.front || "");
          return items[0]?.answer || c.definition || c.back || c.term || "";
        } else if (isReversed) {
          return stripClozeSyntax(c.term || c.front || "");
        } else {
          return c.definition || c.back || "";
        }
      });

      // If fewer than 3 other cards in deck, fill with generic options
      let fallbackIndex = 1;
      while (distractors.length < 3) {
        distractors.push(`Вариант ${fallbackIndex++}`);
      }

      const allChoices = [...distractors, correctDef].sort(() => Math.random() - 0.5);
      const correctIdx = allChoices.indexOf(correctDef);

      setMcOptions(allChoices);
      setMcCorrectIndex(correctIdx);
    }
  }, [activeQueue, cardStates, cardsPool, loading, isReversed]);

  const currentItem = currentId ? cardStates.get(currentId) : null;
  const currentCard = currentItem?.card;
  const currentStage = currentItem?.stage || 1;

  // Determine prompt and expected answer
  const isClozeCard = currentCard && !isReversed && hasCloze(currentCard.term || currentCard.front || "");
  const clozeItems = isClozeCard && currentCard ? extractClozeItems(currentCard.term || currentCard.front || "") : [];

  const promptText = currentCard
    ? isClozeCard
      ? renderClozeQuestion(currentCard.term || currentCard.front || "")
      : isReversed
      ? currentCard.definition || currentCard.back || ""
      : currentCard.term || currentCard.front || ""
    : "";

  const expectedAnswer = currentCard
    ? isClozeCard
      ? clozeItems[0]?.answer || currentCard.definition || currentCard.back || ""
      : isReversed
      ? stripClozeSyntax(currentCard.term || currentCard.front || "")
      : currentCard.definition || currentCard.back || ""
    : "";

  // Handle Stage 1: Multiple Choice selection
  const handleSelectOption = useCallback(
    (index: number) => {
      if (isAnswered || !currentId || !currentItem) return;

      const correct = index === mcCorrectIndex;
      setSelectedMcIndex(index);
      setIsAnswered(true);
      setIsSuccess(correct);

      if (correct) {
        sound.playSuccess();
        setSessionStreak((s) => s + 1);
        rateCardFSRS(currentId, deck.id, userId, Rating.Good);
      } else {
        sound.playError();
        setSessionStreak(0);
        rateCardFSRS(currentId, deck.id, userId, Rating.Again);
      }
    },
    [currentId, currentItem, deck.id, isAnswered, mcCorrectIndex, userId]
  );

  // Handle Stage 2: Written submission with Levenshtein fuzzy checking
  const handleWrittenSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isAnswered || !currentId || !currentItem || !currentCard) return;

    const result = checkAnswerWithFuzzy(writtenInput, expectedAnswer);
    setFuzzyResult(result);
    setIsAnswered(true);

    if (result.isExact) {
      sound.playSuccess();
      setIsSuccess(true);
      setSessionStreak((s) => s + 1);
      rateCardFSRS(currentId, deck.id, userId, Rating.Good);
    } else if (result.isClose) {
      // Typo detected: let user decide with "Засчитать мой ответ"
      sound.playError();
      setIsSuccess(false);
    } else {
      sound.playError();
      setIsSuccess(false);
      setSessionStreak(0);
      rateCardFSRS(currentId, deck.id, userId, Rating.Again);
    }
  };

  // Overriding a typo to count as correct (Appeal button)
  const handleOverrideCorrect = () => {
    if (!currentId) return;
    sound.playSuccess();
    setIsSuccess(true);
    setSessionStreak((s) => s + 1);
    rateCardFSRS(currentId, deck.id, userId, Rating.Good);
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
          sound.playVictory();
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

  // Audio Speech (TTS)
  const handleTTS = () => {
    if (!currentCard) return;
    const textToSpeak = isAnswered ? expectedAnswer : promptText;
    speakText(textToSpeak);
  };

  // Hotkeys 1-4 for Stage 1 selection, Enter/Space for proceed
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
      <div className="py-20 text-center text-zinc-500">
        Загрузка режима заучивания...
      </div>
    );
  }

  if (totalCards === 0) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Колода пуста</h3>
        <p className="text-sm text-zinc-500">
          Для запуска режима заучивания добавьте карточки в колоду.
        </p>
        <button
          onClick={onExit}
          className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium"
        >
          Вернуться к колоде
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Выйти из Заучивания</span>
        </button>

        <div className="flex items-center space-x-3">
          {sessionStreak > 1 && (
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs border border-amber-500/20">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{sessionStreak} подряд</span>
            </div>
          )}

          <button
            onClick={() => {
              setIsReversed((r) => !r);
            }}
            className={`p-1.5 rounded-lg border transition ${
              isReversed
                ? "bg-indigo-50 border-indigo-300 dark:bg-indigo-950/60 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-semibold"
                : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
            title="Обратный режим"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          <Badge variant="outline" className="text-xs font-mono">
            Осталось: {activeQueue.length}
          </Badge>
        </div>
      </div>

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

          {!isAllMastered && currentStage && (
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

      {/* Victory Screen */}
      {isAllMastered ? (
        <div className="my-auto py-12 px-4 text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white mx-auto shadow-2xl shadow-indigo-500/25">
            <Award className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-black text-zinc-900 dark:text-white">
              100% карточек усвоено!
            </h2>
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
            <Button onClick={onExit} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              Назад к колоде
            </Button>
          </div>
        </div>
      ) : currentCard ? (
        /* Active Question Card */
        <div className="space-y-6">
          {/* Question Card Box */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="uppercase tracking-widest font-bold text-indigo-500">
                {isReversed ? "Определение" : isClozeCard ? "Текст с пропуском" : "Термин"}
              </span>
              <button
                type="button"
                onClick={handleTTS}
                className="p-1 text-zinc-400 hover:text-indigo-500 transition"
                title="Озвучить"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xl sm:text-2xl font-medium text-zinc-900 dark:text-white leading-relaxed">
              <MarkdownMath content={promptText} />
            </div>

            {(isReversed
              ? currentCard.backImage
              : currentCard.imageData || currentCard.frontImage) && (
              <img
                src={
                  isReversed
                    ? currentCard.backImage
                    : currentCard.imageData || currentCard.frontImage
                }
                alt="Иллюстрация"
                className="mt-2 max-h-48 rounded-xl object-contain shadow-sm border border-zinc-100 dark:border-zinc-800"
              />
            )}
          </div>

          {/* Interactive Answer Area */}
          {currentStage === 1 ? (
            /* STAGE 1: Multiple Choice Options */
            <div className="space-y-3">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Выберите правильный вариант:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mcOptions.map((opt, idx) => {
                  let btnStyle =
                    "border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/50 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100";

                  if (isAnswered) {
                    if (idx === mcCorrectIndex) {
                      btnStyle =
                        "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold";
                    } else if (idx === selectedMcIndex && !isSuccess) {
                      btnStyle =
                        "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300";
                    } else {
                      btnStyle = "opacity-40 border-zinc-200 dark:border-zinc-800";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isAnswered}
                      onClick={() => handleSelectOption(idx)}
                      className={`p-4 rounded-2xl border text-left flex items-start space-x-3 transition active:scale-[0.98] ${btnStyle}`}
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div className="text-sm leading-snug flex-1">
                        <MarkdownMath content={opt} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* STAGE 2: Written Input */
            <div className="space-y-4">
              <form onSubmit={handleWrittenSubmit} className="space-y-3">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Введите точный ответ:
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={writtenInput}
                    disabled={isAnswered}
                    onChange={(e) => setWrittenInput(e.target.value)}
                    placeholder="Напечатайте ответ здесь..."
                    className="flex-1 px-4 py-3 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
                    autoFocus
                  />
                  {!isAnswered && (
                    <Button
                      type="submit"
                      disabled={!writtenInput.trim()}
                      className="px-6 py-3 h-auto rounded-2xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      Ответить
                    </Button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Feedback & Result Bar */}
          {isAnswered && (
            <div
              className={`p-5 rounded-2xl border space-y-3 animate-in fade-in duration-200 ${
                isSuccess
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60"
                  : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {isSuccess ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                        Отлично! Ответ верный
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <span className="font-bold text-sm text-red-800 dark:text-red-300">
                        Не совсем точно
                      </span>
                    </>
                  )}
                </div>

                <Button
                  onClick={handleProceedNext}
                  className="font-semibold gap-1.5 shadow-sm bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  <span>Дальше</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              {!isSuccess && (
                <div className="pt-2 border-t border-red-200 dark:border-red-900/40 text-xs space-y-1.5">
                  <div>
                    <span className="text-zinc-500">Правильный ответ: </span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm">
                      {expectedAnswer}
                    </span>
                  </div>

                  {fuzzyResult && fuzzyResult.isClose && (
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center space-x-1.5 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Обнаружена опечатка (расстояние Левенштейна: {fuzzyResult.distance})</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleOverrideCorrect}
                        className="text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950"
                      >
                        Засчитать мой ответ (Я был прав)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
