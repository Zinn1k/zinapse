"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus,
  Sparkles,
  Search,
  BookOpen,
  Clock,
  BarChart2,
  Layers,
  Flame,
  ArrowRight,
  X,
} from "lucide-react";
import { db, seedSampleDataIfEmpty, GUEST_USER_ID } from "@/lib/db";
import { calculateLibraryStats, NEW_CARD_DAILY_LIMIT } from "@/lib/fsrs";
import { AppHeader } from "@/components/AppHeader";
import { DeckCard } from "@/components/DeckCard";
import { DeckDetailView } from "@/components/DeckDetailView";
import { CreateEditDeckModal } from "@/components/CreateEditDeckModal";
import { AIGenerateModal } from "@/components/AIGenerateModal";
import { SettingsModal } from "@/components/SettingsModal";
import { FSRSAnalyticsModal } from "@/components/FSRSAnalyticsModal";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function startOfToday(): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function DayRing({ value, total }: { value: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 88 88" className="h-28 w-28 -rotate-90">
        <circle cx="44" cy="44" r={radius} fill="none" strokeWidth="7" stroke="rgba(255,255,255,0.16)" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          stroke="url(#dayRingGradient)"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
        <defs>
          <linearGradient id="dayRingGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold leading-none text-white">{percent}%</span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-indigo-100/80">
          дня
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string>(GUEST_USER_ID);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAIGenerateOpen, setIsAIGenerateOpen] = useState(false);
  const [isCreateDeckOpen, setIsCreateDeckOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  // Ensure database sample data is seeded on first load
  useEffect(() => {
    seedSampleDataIfEmpty();
  }, []);

  // Reactive Dexie Live Queries (0ms local-first source of truth)
  const decks = useLiveQuery(() => db.decks.reverse().sortBy("updatedAt"), []);
  const library = useLiveQuery(() => calculateLibraryStats(currentUserId), [currentUserId]);
  const reviewedToday = useLiveQuery(async () => {
    return db.review_logs
      .where("reviewedAt")
      .aboveOrEqual(startOfToday())
      .and((log) => log.userId === currentUserId)
      .count();
  }, [currentUserId]);

  const deckList = useMemo(() => decks ?? [], [decks]);
  const loading = decks === undefined;

  // Extract all unique tags
  const allTags = useMemo(
    () => Array.from(new Set(deckList.flatMap((d) => d.tags || []))).filter(Boolean),
    [deckList]
  );

  // Filtered decks
  const filteredDecks = deckList.filter((deck) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      deck.title.toLowerCase().includes(query) ||
      deck.description?.toLowerCase().includes(query) ||
      deck.tags?.some((tag) => tag.toLowerCase().includes(query));
    const matchesTag = selectedTag ? deck.tags?.includes(selectedTag) : true;
    return matchesSearch && matchesTag;
  });

  const dueToday = library?.dueToday ?? 0;
  const reviewed = reviewedToday ?? 0;
  const dayTotal = dueToday + reviewed;
  const startDeckId = deckList[0]?.id;

  const stats = [
    {
      label: "Колод",
      value: deckList.length,
      hint: "в библиотеке",
      icon: Layers,
      tint: "from-indigo-500/15 to-indigo-500/5 text-indigo-500",
    },
    {
      label: "Карточек",
      value: library?.cardsCount ?? 0,
      hint: "локально, IndexedDB",
      icon: BookOpen,
      tint: "from-violet-500/15 to-violet-500/5 text-violet-500",
    },
    {
      label: "К повторению",
      value: dueToday,
      hint:
        library && library.newCount > 0
          ? `включая ${Math.min(library.newCount, NEW_CARD_DAILY_LIMIT)} новых`
          : "по расписанию FSRS",
      icon: Clock,
      tint: "from-amber-500/15 to-amber-500/5 text-amber-500",
    },
  ];

  return (
    <div className="app-shell flex flex-col">
      <AppHeader
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAIGenerate={() => router.push("/create-ai")}
        currentUserId={currentUserId}
        setCurrentUserId={setCurrentUserId}
      />

      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {selectedDeckId ? (
          <DeckDetailView
            deckId={selectedDeckId}
            userId={currentUserId}
            onBack={() => setSelectedDeckId(null)}
          />
        ) : (
          <div className="animate-fade-up space-y-8">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-[2rem] border border-indigo-400/20 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-6 text-white shadow-[0_30px_80px_-40px_rgba(79,70,229,0.9)] sm:p-10">
              <div
                aria-hidden
                className="animate-float pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-fuchsia-400/25 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-indigo-300/20 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.12]"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
                  backgroundSize: "44px 44px",
                  maskImage:
                    "radial-gradient(ellipse 70% 60% at 70% 0%, #000 20%, transparent 75%)",
                }}
              />

              <div className="relative grid items-center gap-8 lg:grid-cols-[1.5fr_1fr]">
                <div className="space-y-5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-50 backdrop-blur-md">
                    <Flame className="h-3.5 w-3.5 text-amber-300" />
                    {dueToday > 0
                      ? `${dueToday} карточек ждут повторения сегодня`
                      : "На сегодня всё повторено — красота"}
                  </span>

                  <h1 className="max-w-2xl text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                    Запоминайте <span className="bg-gradient-to-r from-amber-200 via-pink-200 to-white bg-clip-text text-transparent">навсегда</span>,
                    <br className="hidden sm:block" /> а не до экзамена.
                  </h1>

                  <p className="max-w-xl text-sm leading-relaxed text-indigo-100/90 sm:text-base">
                    Локальные карточки с мгновенным откликом, алгоритмом FSRS v5 и
                    AI-генерацией. Работает офлайн — данные остаются на вашем устройстве.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button
                      size="lg"
                      onClick={() =>
                        startDeckId
                          ? router.push(`/deck/${startDeckId}/flashcards`)
                          : setIsCreateDeckOpen(true)
                      }
                      className="bg-white text-indigo-700 shadow-lg shadow-indigo-950/30 hover:bg-indigo-50 hover:text-indigo-800"
                    >
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      {startDeckId ? "Продолжить занятие" : "Создать первую колоду"}
                    </Button>

                    <button
                      onClick={() => setIsCreateDeckOpen(true)}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-[0.98]"
                    >
                      <Plus className="h-4 w-4" />
                      Новая колода
                    </button>

                    <button
                      onClick={() => setIsAnalyticsOpen(true)}
                      className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-indigo-100 transition hover:text-white"
                    >
                      <BarChart2 className="h-4 w-4" />
                      Аналитика
                    </button>
                  </div>
                </div>

                {/* Daily progress card */}
                <div className="relative rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-4">
                    <DayRing value={reviewed} total={dayTotal} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-100/70">
                        Прогресс дня
                      </p>
                      <p className="text-2xl font-extrabold leading-none">
                        {dayTotal > 0 ? reviewed : "—"}
                        {dayTotal > 0 && (
                          <span className="text-base font-semibold text-indigo-100/70">
                            {" "}
                            / {dayTotal}
                          </span>
                        )}
                      </p>
                      <p className="text-xs leading-snug text-indigo-100/80">
                        {dueToday > 0
                          ? `Ещё ${dueToday} карточек — и день закрыт.`
                          : reviewed > 0
                          ? "Всё повторено. Отличная работа!"
                          : "Начните сессию, чтобы запустить прогресс."}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      startDeckId
                        ? router.push(`/deck/${startDeckId}/flashcards`)
                        : setIsCreateDeckOpen(true)
                    }
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-sm font-bold text-indigo-700 transition hover:bg-white active:scale-[0.99]"
                  >
                    {dueToday > 0 ? "Повторить сейчас" : "Открыть карточки"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>

            {/* Stats */}
            <section aria-label="Статистика библиотеки" className="grid gap-3 sm:grid-cols-3">
              {stats.map(({ label, value, hint, icon: Icon, tint }) => (
                <div
                  key={label}
                  className="relative overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-sm"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${tint} opacity-60`} aria-hidden />
                  <div className="relative flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-ink-muted">{label}</p>
                      <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink">{value}</p>
                      <p className="mt-0.5 text-[11px] text-ink-subtle">{hint}</p>
                    </div>
                    <span className="rounded-xl border border-line bg-surface/70 p-2">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              ))}
            </section>

            {/* Search + tags */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <input
                  type="search"
                  placeholder="Поиск колод по названию, теме или тегу…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Поиск колод"
                  className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-10 text-sm text-ink shadow-sm transition-all placeholder:text-ink-subtle hover:border-line-strong focus:border-brand/60 focus:outline-none focus:ring-4 focus:ring-brand/15"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    aria-label="Очистить поиск"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-subtle transition hover:bg-surface-2 hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {allTags.length > 0 && (
                <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 sm:pb-0">
                  <button
                    onClick={() => setSelectedTag(null)}
                    aria-pressed={selectedTag === null}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      selectedTag === null
                        ? "bg-brand text-white shadow-sm shadow-brand/30"
                        : "border border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink"
                    }`}
                  >
                    Все
                  </button>
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                      aria-pressed={selectedTag === tag}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        selectedTag === tag
                          ? "bg-brand text-white shadow-sm shadow-brand/30"
                          : "border border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink"
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Decks grid */}
            <section className="space-y-4" aria-label="Ваши колоды">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-extrabold tracking-tight text-ink">
                  Ваши колоды
                  <span className="ml-2 align-middle text-sm font-semibold text-ink-subtle">
                    {filteredDecks.length}
                  </span>
                </h2>
                <button
                  onClick={() => setIsCreateDeckOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand transition hover:text-brand-strong"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Добавить
                </button>
              </div>

              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-3xl border border-line bg-surface p-5">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="mt-4 h-5 w-3/4" />
                      <Skeleton className="mt-2 h-3 w-full" />
                      <Skeleton className="mt-4 h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : filteredDecks.length === 0 ? (
                <EmptyState
                  icon={<BookOpen className="h-6 w-6" />}
                  title={searchQuery || selectedTag ? "Ничего не нашлось" : "Пока нет ни одной колоды"}
                  description={
                    searchQuery || selectedTag
                      ? "Попробуйте изменить запрос или сбросить фильтр по тегу."
                      : "Создайте колоду вручную или сгенерируйте её из конспекта с помощью Gemini AI."
                  }
                  action={
                    searchQuery || selectedTag ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedTag(null);
                        }}
                      >
                        Сбросить фильтры
                      </Button>
                    ) : (
                      <>
                        <Button onClick={() => setIsCreateDeckOpen(true)}>
                          <Plus className="h-4 w-4" />
                          Создать колоду
                        </Button>
                        <Button variant="outline" onClick={() => setIsAIGenerateOpen(true)}>
                          <Sparkles className="h-4 w-4 text-violet-500" />
                          Сгенерировать с AI
                        </Button>
                      </>
                    )
                  }
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
                  {filteredDecks.map((deck) => (
                    <DeckCard
                      key={deck.id}
                      deck={deck}
                      userId={currentUserId}
                      onSelect={(id) => router.push(`/deck/${id}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Global Modals */}
      <CreateEditDeckModal
        isOpen={isCreateDeckOpen}
        onClose={() => setIsCreateDeckOpen(false)}
        userId={currentUserId}
        onSaved={(id) => router.push(`/deck/${id}`)}
      />

      <AIGenerateModal
        isOpen={isAIGenerateOpen}
        onClose={() => setIsAIGenerateOpen(false)}
        userId={currentUserId}
        onDeckCreated={(id) => router.push(`/deck/${id}`)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userId={currentUserId}
      />

      <FSRSAnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        userId={currentUserId}
      />
    </div>
  );
}
