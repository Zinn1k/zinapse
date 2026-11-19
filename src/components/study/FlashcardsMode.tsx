"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, type PanInfo } from "framer-motion";
import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Volume2,
  Maximize2,
  Minimize2,
  HelpCircle,
  CheckCircle,
  ArrowLeft,
  ArrowLeftRight,
  Clock,
  Zap,
  Sparkles,
} from "lucide-react";
import { type Card, type Deck } from "@/lib/db";
import {
  rateCardFSRS,
  getFSRSIntervalPreviews,
  getTodayFSRSQueue,
  Rating,
  type IntervalPreview,
} from "@/lib/fsrs";
import { speakText } from "@/lib/speech";
import {
  hasCloze,
  renderClozeQuestion,
  renderClozeAnswer,
  stripClozeSyntax,
} from "@/lib/cloze";
import { MarkdownMath } from "../MarkdownMath";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import confetti from "canvas-confetti";

export type StudyModeType = "fsrs" | "cram";

export interface FlashcardsModeProps {
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
  const [mode, setMode] = useState<StudyModeType>("fsrs");
  const [queue, setQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isReversed, setIsReversed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [intervals, setIntervals] = useState<IntervalPreview[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load study queue based on mode
  const loadQueue = useCallback(
    async (selectedMode: StudyModeType) => {
      setLoading(true);
      setIsCompleted(false);
      setCurrentIndex(0);
      setIsFlipped(false);
      setShowHint(false);

      if (initialCards.length === 0) {
        setQueue([]);
        setLoading(false);
        return;
      }

      if (selectedMode === "fsrs") {
        const todayQueue = await getTodayFSRSQueue(deck.id, userId, Math.max(50, initialCards.length));
        setQueue(todayQueue);
      } else {
        // Cram mode: all cards shuffled or in order
        setQueue([...initialCards]);
      }
      setLoading(false);
    },
    [deck.id, initialCards, userId]
  );

  useEffect(() => {
    loadQueue(mode);
  }, [loadQueue, mode]);

  const currentCard = queue[currentIndex];

  // Load projected intervals for current card in FSRS mode
  useEffect(() => {
    if (!currentCard || mode !== "fsrs") return;
    setIsFlipped(false);
    setShowHint(false);

    getFSRSIntervalPreviews(currentCard.id, deck.id, userId, 0.9, "ru").then(
      (previews) => {
        setIntervals(previews);
      }
    );
  }, [currentCard, deck.id, userId, mode]);

  const handleFlip = useCallback(() => {
    setIsFlipped((f) => !f);
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex((i) => i + 1);
      setIsFlipped(false);
      setShowHint(false);
    } else {
      setIsCompleted(true);
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    }
  }, [currentIndex, queue.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setIsFlipped(false);
      setShowHint(false);
    }
  }, [currentIndex]);

  // FSRS Rating Handler
  const handleRateFSRS = useCallback(
    async (rating: Rating) => {
      if (!currentCard) return;
      await rateCardFSRS(currentCard.id, deck.id, userId, rating);
      handleNext();
    },
    [currentCard, deck.id, handleNext, userId]
  );

  // Cram Mode Rating Handler
  const handleCramResult = useCallback(
    async (knewIt: boolean) => {
      if (!currentCard) return;

      // Log review without skewing long-term FSRS weights
      await rateCardFSRS(
        currentCard.id,
        deck.id,
        userId,
        knewIt ? Rating.Good : Rating.Again,
        { cramMode: true }
      );

      if (!knewIt) {
        // Return card to the end of the current session queue
        setQueue((prev) => [...prev, currentCard]);
      }

      if (currentIndex < queue.length - 1) {
        setCurrentIndex((i) => i + 1);
        setIsFlipped(false);
        setShowHint(false);
      } else {
        if (!knewIt) {
          setCurrentIndex((i) => i + 1);
          setIsFlipped(false);
          setShowHint(false);
        } else {
          setIsCompleted(true);
          confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
        }
      }
    },
    [currentCard, currentIndex, deck.id, queue.length, userId]
  );

  const handleShuffle = () => {
    const shuffled = [...queue].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleTTS = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentCard) return;

    const frontRaw = currentCard.term || currentCard.front || "";
    const backRaw = currentCard.definition || currentCard.back || "";

    const frontText = stripClozeSyntax(frontRaw);
    const backText = backRaw;

    if (isReversed) {
      if (isFlipped) {
        speakText(frontText, { lang: currentCard.frontLang });
      } else {
        speakText(backText, { lang: currentCard.backLang });
      }
    } else {
      if (isFlipped) {
        speakText(backText, { lang: currentCard.backLang });
      } else {
        speakText(frontText, { lang: currentCard.frontLang });
      }
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        handleFlip();
      } else if (mode === "fsrs") {
        if (e.key === "1") handleRateFSRS(Rating.Again);
        else if (e.key === "2") handleRateFSRS(Rating.Hard);
        else if (e.key === "3") handleRateFSRS(Rating.Good);
        else if (e.key === "4") handleRateFSRS(Rating.Easy);
        else if (e.code === "ArrowLeft") {
          e.preventDefault();
          handlePrev();
        } else if (e.code === "ArrowRight") {
          e.preventDefault();
          handleNext();
        }
      } else if (mode === "cram") {
        if (e.code === "ArrowLeft") {
          e.preventDefault();
          handleCramResult(false);
        } else if (e.code === "ArrowRight") {
          e.preventDefault();
          handleCramResult(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlip, handleNext, handlePrev, handleRateFSRS, handleCramResult, mode]);

  // Touch Swipe Handler (drag gesture)
  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      // Swiped Right -> Known / Easy
      if (mode === "cram") {
        handleCramResult(true);
      } else {
        handleRateFSRS(Rating.Good);
      }
    } else if (info.offset.x < -threshold) {
      // Swiped Left -> Unknown / Again
      if (mode === "cram") {
        handleCramResult(false);
      } else {
        handleRateFSRS(Rating.Again);
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center text-zinc-500">
        Загрузка карточек...
      </div>
    );
  }

  if (initialCards.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Колода пуста</h3>
        <p className="text-sm text-zinc-500">
          Пожалуйста, добавьте карточки в эту колоду перед началом повторения.
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

  if (queue.length === 0 && mode === "fsrs") {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
          <CheckCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Все карточки повторены!
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            На сегодня нет карточек, требующих интервального повторения. Алгоритм FSRS
            рассчитал расписание для максимального сохранения в памяти.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
          <Button variant="outline" onClick={() => setMode("cram")}>
            <Zap className="w-4 h-4 mr-1.5 text-amber-500" />
            Включить Cram Mode (Зубрежка)
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setQueue([...initialCards]);
              setCurrentIndex(0);
            }}
          >
            <RotateCw className="w-4 h-4 mr-1.5" />
            Повторить всю колоду
          </Button>
          <Button onClick={onExit}>Назад к колоде</Button>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-6 animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-500/20">
          <Sparkles className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
            Сессия повторения завершена!
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {mode === "fsrs"
              ? `Вы повторили все запланированные карточки (${queue.length}). Ваш прогресс сохранен алгоритмом FSRS.`
              : `Вы успешно прогнали все карточки колоды по кругу в режиме зубрежки (${queue.length} повторений)!`}
          </p>
        </div>
        <div className="flex justify-center space-x-3 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              loadQueue(mode);
            }}
            className="gap-2"
          >
            <RotateCw className="w-4 h-4" />
            <span>Повторить снова</span>
          </Button>
          <Button onClick={onExit} className="bg-indigo-600 hover:bg-indigo-500 text-white">
            Назад к колоде
          </Button>
        </div>
      </div>
    );
  }

  if (!currentCard) return null;

  const rawFront = isReversed
    ? currentCard.definition || currentCard.back || ""
    : currentCard.term || currentCard.front || "";
  const rawBack = isReversed
    ? currentCard.term || currentCard.front || ""
    : currentCard.definition || currentCard.back || "";

  const isClozeCard = !isReversed && hasCloze(rawFront);
  const displayFront = isClozeCard ? renderClozeQuestion(rawFront) : rawFront;
  const displayBack = isClozeCard
    ? renderClozeAnswer(rawFront) +
      (rawBack && rawBack !== rawFront ? `\n\n---\n\n${rawBack}` : "")
    : rawBack;

  const frontLabel = isReversed
    ? "Определение (Лицевая сторона)"
    : isClozeCard
    ? "Текст с пропуском (Cloze)"
    : "Лицевая сторона";

  const backLabel = isReversed
    ? "Термин (Обратная сторона)"
    : isClozeCard
    ? "Ответ (Cloze)"
    : "Обратная сторона";

  return (
    <div
      className={`flex flex-col h-full max-w-4xl mx-auto px-4 py-4 ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-white dark:bg-zinc-950 p-6 max-w-none"
          : ""
      }`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <button
          onClick={onExit}
          className="flex items-center space-x-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад к колоде</span>
        </button>

        {/* Mode Switcher: FSRS vs Cram */}
        <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setMode("fsrs")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              mode === "fsrs"
                ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>FSRS (Интервалы)</span>
          </button>
          <button
            onClick={() => setMode("cram")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              mode === "cram"
                ? "bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Зубрежка (Cram)</span>
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setIsReversed((r) => !r);
              setIsFlipped(false);
            }}
            className={`p-1.5 rounded-lg border transition ${
              isReversed
                ? "bg-indigo-50 border-indigo-300 dark:bg-indigo-950/60 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-semibold"
                : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
            title={
              isReversed
                ? "Обратный режим (Определение → Термин)"
                : "Включить обратный режим (Определение → Термин)"
            }
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleShuffle}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition"
            title="Перемешать карточки"
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition"
            title={isFullscreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Progress & Badge */}
      <div className="space-y-2 mb-6">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
          <span className="flex items-center space-x-1.5">
            <Badge variant={mode === "fsrs" ? "default" : "warning"} className="text-[10px]">
              {mode === "fsrs" ? "FSRS Spaced" : "Cram Loop"}
            </Badge>
            <span>{deck.title}</span>
          </span>
          <span className="font-mono">
            {currentIndex + 1} / {queue.length}
          </span>
        </div>
        <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 3D Flip Card Container with Mobile Swipe Support */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[380px] sm:min-h-[460px] perspective-1000 w-full select-none cursor-pointer">
        <motion.div
          onClick={handleFlip}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.4}
          onDragEnd={handleDragEnd}
          className="relative w-full h-full max-w-3xl transform-style-3d shadow-xl rounded-3xl"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
        >
          {/* FRONT SIDE */}
          <div className="absolute inset-0 backface-hidden w-full h-full p-8 sm:p-12 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between overflow-y-auto">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="uppercase tracking-widest font-semibold text-indigo-500">
                {frontLabel}
              </span>
              <div className="flex items-center space-x-2">
                {currentCard.hint && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHint(!showHint);
                    }}
                    className="p-1 text-amber-500 hover:text-amber-600"
                    title="Показать / скрыть подсказку"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleTTS}
                  className="p-1 text-zinc-400 hover:text-indigo-500 transition"
                  title="Озвучить"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="my-auto py-4 text-center">
              <div className="text-xl sm:text-2xl font-medium text-zinc-900 dark:text-white leading-relaxed">
                <MarkdownMath content={displayFront} />
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
                  alt="Illustration"
                  className="mt-6 max-h-56 mx-auto rounded-xl object-contain shadow-sm border border-zinc-100 dark:border-zinc-800"
                />
              )}

              {showHint && currentCard.hint && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-2 text-xs rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 inline-block border border-amber-200 dark:border-amber-900"
                >
                  Подсказка: {currentCard.hint}
                </motion.div>
              )}
            </div>

            <div className="text-center text-xs text-zinc-400">
              Нажмите мышью или{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono">
                Пробел
              </kbd>
              , чтобы перевернуть
            </div>
          </div>

          {/* BACK SIDE */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 w-full h-full p-8 sm:p-12 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-indigo-500/40 dark:border-indigo-500/30 flex flex-col justify-between overflow-y-auto">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="uppercase tracking-widest font-semibold text-emerald-500">
                {backLabel}
              </span>
              <button
                onClick={handleTTS}
                className="p-1 text-zinc-400 hover:text-indigo-500 transition"
                title="Озвучить"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            <div className="my-auto py-4 text-center">
              <div className="text-lg sm:text-xl text-zinc-800 dark:text-zinc-100 leading-relaxed">
                <MarkdownMath content={displayBack} />
              </div>

              {(isReversed
                ? currentCard.imageData || currentCard.frontImage
                : currentCard.backImage) && (
                <img
                  src={
                    isReversed
                      ? currentCard.imageData || currentCard.frontImage
                      : currentCard.backImage
                  }
                  alt="Back illustration"
                  className="mt-6 max-h-56 mx-auto rounded-xl object-contain shadow-sm border border-zinc-100 dark:border-zinc-800"
                />
              )}
            </div>

            <div className="text-center text-xs text-zinc-400">
              {mode === "fsrs"
                ? "Оцените, насколько легко вы вспомнили ответ для FSRS интервала"
                : "Отметьте, вспомнили ли вы карточку"}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Controls */}
      <div className="mt-6 space-y-3">
        {mode === "fsrs" ? (
          /* FSRS Rating Buttons */
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
                  onClick={() => handleRateFSRS(item.rating)}
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
        ) : (
          /* Cram Mode Quick Actions */
          <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleCramResult(false)}
              className="border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              <span>Не знаю (в конец очереди)</span>
            </Button>

            <Button
              size="lg"
              onClick={() => handleCramResult(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
            >
              <span>Знаю (выучено)</span>
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        )}

        {/* Previous / Flip / Next arrow buttons */}
        <div className="flex items-center justify-center space-x-6 pt-1">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-30 transition"
            title="Назад (Стрелка влево)"
          >
            <ChevronLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
          </button>

          <button
            onClick={handleFlip}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Перевернуть</span>
          </button>

          <button
            onClick={handleNext}
            className="p-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
            title="Вперед (Стрелка вправо)"
          >
            <ChevronRight className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
          </button>
        </div>

        {/* Mobile swipe hint */}
        <div className="text-center text-[11px] text-zinc-400 sm:hidden">
          Свайп влево: Не знаю • Свайп вправо: Знаю
        </div>
      </div>
    </div>
  );
}
