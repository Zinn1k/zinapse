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
import { scheduleSync } from "@/lib/sync";
import { useSettings } from "@/hooks/use-settings";
import {
  hasCloze,
  renderClozeQuestion,
  renderClozeAnswer,
  stripClozeSyntax,
} from "@/lib/cloze";
import { MarkdownMath } from "../MarkdownMath";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

  // Retention target chosen in Settings — feeds both the interval previews
  // and the scheduler, so the slider has a visible effect.
  const { requestRetention } = useSettings(userId);

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
        const todayQueue = await getTodayFSRSQueue(deck.id, userId);
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

    getFSRSIntervalPreviews(currentCard.id, deck.id, userId, requestRetention, "ru").then(
      (previews) => {
        setIntervals(previews);
      }
    );
  }, [currentCard, deck.id, userId, mode, requestRetention]);

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
      await rateCardFSRS(currentCard.id, deck.id, userId, rating, { requestRetention });
      scheduleSync(userId);
      handleNext();
    },
    [currentCard, deck.id, handleNext, userId, requestRetention]
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
      className={
        isFullscreen
          ? "app-shell fixed inset-0 z-50 flex flex-col"
          : "app-shell flex min-h-screen flex-col"
      }
    >
      {/* Top bar */}
      <header className="glass sticky top-0 z-30 border-b border-line/80">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-2 px-3 sm:px-4">
          <button
            onClick={onExit}
            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">К колоде</span>
          </button>

          {/* Mode switcher */}
          <div
            role="group"
            aria-label="Режим повторения"
            className="flex items-center gap-0.5 rounded-xl border border-line bg-surface-2 p-1"
          >
            <button
              onClick={() => setMode("fsrs")}
              aria-pressed={mode === "fsrs"}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                mode === "fsrs"
                  ? "bg-surface text-brand shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>FSRS</span>
            </button>
            <button
              onClick={() => setMode("cram")}
              aria-pressed={mode === "cram"}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                mode === "cram"
                  ? "bg-surface text-amber-600 shadow-sm dark:text-amber-400"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Зубрёжка</span>
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setIsReversed((r) => !r);
                setIsFlipped(false);
              }}
              aria-pressed={isReversed}
              aria-label="Обратный режим: определение → термин"
              className={`rounded-xl border p-2 transition-colors ${
                isReversed
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-line text-ink-muted hover:bg-surface-2 hover:text-ink"
              }`}
              title={isReversed ? "Обратный режим включён" : "Обратный режим"}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <button
              onClick={handleShuffle}
              aria-label="Перемешать карточки"
              className="rounded-xl border border-line p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              title="Перемешать"
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              aria-label={isFullscreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
              className="rounded-xl border border-line p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              title={isFullscreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-5">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <Badge
                variant={mode === "fsrs" ? "brand" : "warning"}
                className="shrink-0 text-[10px] uppercase tracking-wide"
              >
                {mode === "fsrs" ? "FSRS" : "Cram"}
              </Badge>
              <span className="truncate font-semibold text-ink">{deck.title}</span>
            </div>
            <span className="shrink-0 font-mono text-ink-subtle">
              {currentIndex + 1} / {queue.length}
            </span>
          </div>
          <Progress value={((currentIndex + 1) / queue.length) * 100} className="h-1.5" />
        </div>

        {/* Card stage */}
        <div className="perspective-1000 flex flex-1 items-center justify-center py-6">
          <motion.div
            onClick={handleFlip}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.4}
            onDragEnd={handleDragEnd}
            className="relative h-[clamp(340px,54vh,470px)] w-full max-w-2xl transform-style-3d select-none rounded-[2rem]"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
          >
            {/* FRONT SIDE */}
            <div className="absolute inset-0 flex h-full w-full flex-col justify-between overflow-y-auto rounded-[2rem] border border-line bg-surface p-6 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.55)] backface-hidden sm:p-8">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-[2rem] bg-gradient-to-b from-indigo-500/10 to-transparent"
              />

              <div className="relative flex items-center justify-between text-xs text-ink-subtle">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">
                  {frontLabel}
                </span>
                <div className="flex items-center gap-1">
                  {currentCard.hint && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHint(!showHint);
                      }}
                      aria-label="Показать или скрыть подсказку"
                      className="rounded-lg p-1.5 text-amber-500 transition-colors hover:bg-amber-500/10"
                      title="Подсказка"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTTS(e);
                    }}
                    aria-label="Озвучить карточку"
                    className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-2 hover:text-brand"
                    title="Озвучить"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="relative my-auto space-y-4 py-4 text-center">
                <div className="text-xl font-semibold leading-snug text-ink sm:text-3xl">
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
                    alt="Иллюстрация карточки"
                    className="mx-auto max-h-52 rounded-xl border border-line object-contain shadow-sm"
                  />
                )}

                {showHint && currentCard.hint && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-block rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300"
                  >
                    Подсказка: {currentCard.hint}
                  </motion.div>
                )}
              </div>

              <div className="relative text-center text-[11px] text-ink-subtle">
                Нажмите на карточку или{" "}
                <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px]">
                  Пробел
                </kbd>
              </div>
            </div>

            {/* BACK SIDE */}
            <div className="absolute inset-0 flex h-full w-full rotate-y-180 flex-col justify-between overflow-y-auto rounded-[2rem] border border-line bg-surface p-6 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.55)] ring-2 ring-indigo-500/25 backface-hidden sm:p-8">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-[2rem] bg-gradient-to-b from-emerald-500/10 to-transparent"
              />

              <div className="relative flex items-center justify-between text-xs text-ink-subtle">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-500">
                  {backLabel}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTTS(e);
                  }}
                  aria-label="Озвучить ответ"
                  className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-2 hover:text-brand"
                  title="Озвучить"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>

              <div className="relative my-auto space-y-4 py-4 text-center">
                <div className="text-lg leading-relaxed text-ink sm:text-xl">
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
                    alt="Иллюстрация ответа"
                    className="mx-auto max-h-52 rounded-xl border border-line object-contain shadow-sm"
                  />
                )}
              </div>

              <div className="relative text-center text-[11px] text-ink-subtle">
                {mode === "fsrs"
                  ? "Оцените, насколько легко вспомнили ответ"
                  : "Отметьте, вспомнили ли вы карточку"}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Controls */}
        <div className="mt-2 space-y-3">
          {mode === "fsrs" ? (
            /* FSRS rating buttons */
            <div className="mx-auto grid max-w-2xl grid-cols-4 gap-2">
              {intervals.map((item) => {
                const colors: Record<Rating, string> = {
                  [Rating.Manual]: "border-line bg-surface-2 text-ink-muted",
                  [Rating.Again]:
                    "border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/15 dark:text-red-400",
                  [Rating.Hard]:
                    "border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400",
                  [Rating.Good]:
                    "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/15 dark:text-indigo-300",
                  [Rating.Easy]:
                    "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400",
                };

                return (
                  <button
                    key={item.rating}
                    onClick={() => handleRateFSRS(item.rating)}
                    className={`flex flex-col items-center justify-center rounded-2xl border px-2 py-2.5 shadow-sm transition-all active:scale-[0.97] ${colors[item.rating]}`}
                    aria-label={`${item.label}, следующий показ через ${item.intervalText}`}
                  >
                    <span className="text-xs font-bold">{item.label}</span>
                    <span className="mt-0.5 font-mono text-[11px] opacity-80">
                      {item.intervalText}
                    </span>
                    <span className="mt-0.5 hidden text-[9px] opacity-50 sm:inline">
                      клавиша {item.rating}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Cram quick actions */
            <div className="mx-auto grid max-w-lg grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleCramResult(false)}
                className="border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400"
              >
                <ChevronLeft />
                <span>Не знаю</span>
              </Button>

              <Button
                size="lg"
                onClick={() => handleCramResult(true)}
                className="bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-emerald-900/20 hover:from-emerald-400 hover:to-emerald-500"
              >
                <span>Знаю</span>
                <ChevronRight />
              </Button>
            </div>
          )}

          {/* Previous / flip / next */}
          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              aria-label="Предыдущая карточка"
              className="rounded-full border border-line bg-surface p-2.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
              title="Назад (←)"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              onClick={handleFlip}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-surface-2"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Перевернуть</span>
            </button>

            <button
              onClick={handleNext}
              aria-label="Следующая карточка"
              className="rounded-full border border-line bg-surface p-2.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              title="Вперёд (→)"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="text-center text-[11px] text-ink-subtle sm:hidden">
            Свайп влево — не знаю, вправо — знаю
          </div>
        </div>
      </main>
    </div>
  );
}
