"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, type PanInfo } from "framer-motion";
import {
  ArrowLeft,
  RotateCw,
  Shuffle,
  Volume2,
  Maximize2,
  Minimize2,
  HelpCircle,
  CheckCircle,
  Zap,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { db, type Card, type Deck, GUEST_USER_ID } from "@/lib/db";
import {
  rateCardFSRS,
  getFSRSIntervalPreviews,
  getTodayFSRSQueue,
  Rating,
  type IntervalPreview,
} from "@/lib/fsrs";
import { speakText } from "@/lib/speech";
import { MarkdownMath } from "@/components/MarkdownMath";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import confetti from "canvas-confetti";

type StudyModeType = "fsrs" | "cram";

export default function FlashcardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const deckId = resolvedParams.id;
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [queue, setQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mode, setMode] = useState<StudyModeType>("fsrs");
  const [intervals, setIntervals] = useState<IntervalPreview[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const userId = GUEST_USER_ID;

  // Load deck & cards
  const loadDeckAndQueue = useCallback(
    async (selectedMode: StudyModeType) => {
      setLoading(true);
      setIsCompleted(false);
      setCurrentIndex(0);
      setIsFlipped(false);

      const d = await db.decks.get(deckId);
      if (!d) {
        setLoading(false);
        return;
      }
      setDeck(d);

      const cards = await db.cards.where("deckId").equals(deckId).sortBy("order");
      setAllCards(cards);

      if (cards.length === 0) {
        setQueue([]);
        setLoading(false);
        return;
      }

      if (selectedMode === "fsrs") {
        const todayQueue = await getTodayFSRSQueue(deckId, userId, 25);
        setQueue(todayQueue);
      } else {
        // Cram mode: all cards shuffled or in order
        setQueue([...cards]);
      }

      setLoading(false);
    },
    [deckId, userId]
  );

  useEffect(() => {
    loadDeckAndQueue(mode);
  }, [loadDeckAndQueue, mode]);

  const currentCard = queue[currentIndex];

  // Load projected intervals for current card in FSRS mode
  useEffect(() => {
    if (!currentCard || mode !== "fsrs") return;
    setIsFlipped(false);
    setShowHint(false);

    getFSRSIntervalPreviews(currentCard.id, deckId, userId, 0.9, "ru").then(
      (previews) => {
        setIntervals(previews);
      }
    );
  }, [currentCard, deckId, userId, mode]);

  const handleFlip = useCallback(() => {
    setIsFlipped((f) => !f);
  }, []);

  // FSRS Rating Handler
  const handleRateFSRS = useCallback(async (rating: Rating) => {
    if (!currentCard) return;

    await rateCardFSRS(currentCard.id, deckId, userId, rating);

    if (currentIndex < queue.length - 1) {
      setCurrentIndex((i) => i + 1);
      setIsFlipped(false);
      setShowHint(false);
    } else {
      setIsCompleted(true);
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    }
  }, [currentCard, currentIndex, deckId, queue.length, userId]);

  // Cram Mode Rating Handlers
  const handleCramResult = useCallback((knewIt: boolean) => {
    if (!currentCard) return;

    // Log review without skewing long-term FSRS interval weights
    rateCardFSRS(currentCard.id, deckId, userId, knewIt ? Rating.Good : Rating.Again, {
      cramMode: true,
    });

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
        // If current card was added to end, advance index
        setCurrentIndex((i) => i + 1);
        setIsFlipped(false);
        setShowHint(false);
      } else {
        setIsCompleted(true);
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      }
    }
  }, [currentCard, currentIndex, deckId, queue.length, userId]);

  // Audio Speech (TTS)
  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentCard) return;
    const textToSpeak = isFlipped
      ? currentCard.definition || currentCard.back || ""
      : currentCard.term || currentCard.front || "";
    speakText(textToSpeak);
  };

  // Keyboard navigation
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
  }, [handleFlip, handleRateFSRS, handleCramResult, mode]);

  // Touch Swipe Handler (drag gesture)
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
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

  const handleShuffle = () => {
    const shuffled = [...queue].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black text-zinc-500">
        Загрузка карточек...
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
    <div
      className={`min-h-screen flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 ${
        isFullscreen ? "fixed inset-0 z-50 p-4" : ""
      }`}
    >
      {/* Top Navbar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href={`/deck/${deck.id}`}
            className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Обзор колоды</span>
          </Link>

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

          <div className="flex items-center space-x-2">
            <button
              onClick={handleShuffle}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
              title="Перемешать карточки"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
              title={isFullscreen ? "Выйти из полноэкранного режима" : "Во весь экран"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Study Arena */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col justify-between">
        {allCards.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <p className="text-zinc-500">В этой колоде пока нет карточек.</p>
            <Button onClick={() => router.push(`/deck/${deck.id}/edit`)}>
              Добавить карточки
            </Button>
          </div>
        ) : queue.length === 0 && mode === "fsrs" ? (
          /* All cards caught up in FSRS mode */
          <div className="max-w-md mx-auto py-16 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Все карточки повторены!</h2>
              <p className="text-sm text-zinc-500">
                На сегодня нет карточек, требующих интервального повторения. Алгоритм FSRS рассчитал расписание для максимального сохранения в памяти.
              </p>
            </div>
            <div className="flex justify-center space-x-3 pt-2">
              <Button variant="outline" onClick={() => setMode("cram")}>
                <Zap className="w-4 h-4 mr-1.5 text-amber-500" />
                Включить Cram Mode (Зубрежка)
              </Button>
              <Button onClick={() => router.push(`/deck/${deck.id}`)}>
                Обзор колоды
              </Button>
            </div>
          </div>
        ) : isCompleted ? (
          /* Session Completed Screen */
          <div className="max-w-md mx-auto py-16 text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-500/20">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black">Сессия завершена!</h2>
              <p className="text-sm text-zinc-500">
                {mode === "fsrs"
                  ? "Интервалы FSRS сохранены в локальную базу данных Dexie.js."
                  : "Вы успешно прогнали все карточки колоды по кругу!"}
              </p>
            </div>

            <div className="flex justify-center space-x-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  loadDeckAndQueue(mode);
                }}
              >
                <RotateCw className="w-4 h-4 mr-1.5" />
                Повторить заново
              </Button>
              <Button onClick={() => router.push(`/deck/${deck.id}`)}>
                К колоде
              </Button>
            </div>
          </div>
        ) : currentCard ? (
          /* Active Flipcard View */
          <div className="flex-1 flex flex-col justify-between space-y-6">
            {/* Top Indicator & Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-500 font-semibold">
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
            <div className="flex-1 flex items-center justify-center min-h-[380px] sm:min-h-[460px] perspective-1000 w-full select-none cursor-pointer">
              <motion.div
                onClick={handleFlip}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                onDragEnd={handleDragEnd}
                className="relative w-full h-full max-w-2xl transform-style-3d shadow-xl rounded-3xl"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.45, ease: "easeInOut" }}
              >
                {/* FRONT SIDE (Термин) */}
                <div className="absolute inset-0 backface-hidden w-full h-full p-8 sm:p-12 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 flex flex-col justify-between overflow-y-auto">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="uppercase tracking-widest font-bold text-indigo-500">
                      Термин
                    </span>
                    <div className="flex items-center space-x-2">
                      {currentCard.hint && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowHint(!showHint);
                          }}
                          className="p-1 text-amber-500 hover:text-amber-600"
                          title="Показать подсказку"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSpeak}
                        className="p-1 text-zinc-400 hover:text-indigo-500 transition"
                        title="Озвучить (TTS)"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="my-auto py-4 text-center">
                    <div className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white leading-relaxed">
                      <MarkdownMath content={currentCard.term || currentCard.front || ""} />
                    </div>

                    {(currentCard.imageData || currentCard.frontImage) && (
                      <img
                        src={currentCard.imageData || currentCard.frontImage}
                        alt="Иллюстрация термина"
                        className="mt-4 max-h-48 mx-auto rounded-xl object-contain shadow-sm border border-zinc-100 dark:border-zinc-800"
                      />
                    )}

                    {showHint && currentCard.hint && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-2.5 text-xs rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 inline-block border border-amber-200 dark:border-amber-900"
                      >
                        Подсказка: {currentCard.hint}
                      </motion.div>
                    )}
                  </div>

                  <div className="text-center text-xs text-zinc-400">
                    Нажмите <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono">Пробел</kbd> или кликните для переворота
                  </div>
                </div>

                {/* BACK SIDE (Определение) */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 w-full h-full p-8 sm:p-12 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-indigo-500/40 dark:border-indigo-500/30 flex flex-col justify-between overflow-y-auto">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="uppercase tracking-widest font-bold text-emerald-500">
                      Определение
                    </span>
                    <button
                      type="button"
                      onClick={handleSpeak}
                      className="p-1 text-zinc-400 hover:text-indigo-500 transition"
                      title="Озвучить (TTS)"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="my-auto py-4 text-center">
                    <div className="text-lg sm:text-xl text-zinc-800 dark:text-zinc-100 leading-relaxed">
                      <MarkdownMath
                        content={currentCard.definition || currentCard.back || ""}
                      />
                    </div>

                    {currentCard.backImage && (
                      <img
                        src={currentCard.backImage}
                        alt="Иллюстрация определения"
                        className="mt-4 max-h-48 mx-auto rounded-xl object-contain shadow-sm border border-zinc-100 dark:border-zinc-800"
                      />
                    )}
                  </div>

                  <div className="text-center text-xs text-zinc-400">
                    Оцените карточку внизу для перехода дальше
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Bottom Controls */}
            <div className="space-y-3 pt-2">
              {mode === "fsrs" ? (
                /* FSRS 4 Rating Buttons with Calculated Intervals */
                <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-2xl mx-auto">
                  {intervals.map((item) => {
                    const colorStyles: Record<Rating, string> = {
                      [Rating.Manual]: "bg-zinc-100 text-zinc-600",
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
                        className={`py-2 px-2 sm:px-3 rounded-2xl border flex flex-col items-center justify-center transition active:scale-95 shadow-sm ${
                          colorStyles[item.rating]
                        }`}
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
                    className="border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    <span>Не знаю (в конец очереди)</span>
                  </Button>

                  <Button
                    size="lg"
                    onClick={() => handleCramResult(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <span>Знаю (выучено)</span>
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                </div>
              )}

              {/* Mobile swipe hint */}
              <div className="text-center text-[11px] text-zinc-400 sm:hidden">
                Свайп влево: Не знаю • Свайп вправо: Знаю
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
