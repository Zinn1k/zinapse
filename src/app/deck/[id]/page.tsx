"use client";

import React, { useState, useEffect, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Layers,
  GraduationCap,
  Gamepad2,
  FileCheck,
  Edit,
  Trash2,
  Share2,
  Copy,
  Check,
  Volume2,
  Search,
  Clock,
  ArrowRight,
} from "lucide-react";
import { db, GUEST_USER_ID, deleteDeckCascade, type Card } from "@/lib/db";
import { calculateDeckFSRSStats } from "@/lib/fsrs";
import { speakText } from "@/lib/speech";
import { dbFirestore, isFirebaseConfigured, subscribeToAuthChanges } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { MarkdownMath } from "@/components/MarkdownMath";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

interface StudyMode {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "indigo" | "violet" | "amber" | "emerald";
  cta: string;
  badge?: string;
}

const STUDY_MODES: StudyMode[] = [
  {
    key: "flashcards",
    title: "Карточки",
    description: "3D-переворот, FSRS-интервалы и режим быстрой зубрёжки (Cram).",
    icon: Layers,
    accent: "indigo",
    cta: "Начать карточки",
    badge: "FSRS",
  },
  {
    key: "learn",
    title: "Заучивание",
    description: "Адаптивные тесты из 4 вариантов и письменный ввод с проверкой опечаток.",
    icon: GraduationCap,
    accent: "violet",
    cta: "Начать заучивание",
  },
  {
    key: "match",
    title: "Подбор",
    description: "Сетка из 12 плиток на время: рекорды, звуки и штраф за ошибки.",
    icon: Gamepad2,
    accent: "amber",
    cta: "Играть в подбор",
  },
  {
    key: "test",
    title: "Тест",
    description: "Экзаменационный билет: выбор, верно/неверно, ввод и сопоставление.",
    icon: FileCheck,
    accent: "emerald",
    cta: "Пройти тест",
  },
];

const ACCENTS: Record<string, { tile: string; border: string; text: string }> = {
  indigo: {
    tile: "bg-indigo-500/10 text-indigo-500 dark:text-indigo-300",
    border: "hover:border-indigo-400/60",
    text: "text-indigo-600 dark:text-indigo-300",
  },
  violet: {
    tile: "bg-violet-500/10 text-violet-500 dark:text-violet-300",
    border: "hover:border-violet-400/60",
    text: "text-violet-600 dark:text-violet-300",
  },
  amber: {
    tile: "bg-amber-500/10 text-amber-500 dark:text-amber-300",
    border: "hover:border-amber-400/60",
    text: "text-amber-600 dark:text-amber-300",
  },
  emerald: {
    tile: "bg-emerald-500/10 text-emerald-500 dark:text-emerald-300",
    border: "hover:border-emerald-400/60",
    text: "text-emerald-600 dark:text-emerald-300",
  },
};

export default function DeckOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const deckId = resolvedParams.id;
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [copiedShareCode, setCopiedShareCode] = useState(false);
  const [userId, setUserId] = useState<string>(GUEST_USER_ID);

  useEffect(() => {
    const unsub = subscribeToAuthChanges((user) => {
      setUserId(user ? user.uid : GUEST_USER_ID);
    });
    return () => unsub();
  }, []);

  // Reactive Dexie queries (0ms Local-First)
  // `null` means "loaded but missing"; `undefined` means "still loading".
  const deck = useLiveQuery(async () => (await db.decks.get(deckId)) ?? null, [deckId]);
  const cards = useLiveQuery(
    () => db.cards.where("deckId").equals(deckId).sortBy("order"),
    [deckId]
  );
  const stats = useLiveQuery(
    () => calculateDeckFSRSStats(deckId, userId),
    [deckId, userId]
  );

  const cardList: Card[] = useMemo(() => cards ?? [], [cards]);
  const cardIds = useMemo(() => new Set(cardList.map((c) => c.id)), [cardList]);

  // Real, log-based 30-day retention instead of a heuristic estimate.
  const retention = useLiveQuery(async () => {
    if (cardIds.size === 0) return null;
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const logs = await db.review_logs.where("reviewedAt").aboveOrEqual(since).toArray();
    const relevant = logs.filter((log) => log.userId === userId && cardIds.has(log.cardId));
    if (relevant.length === 0) return null;
    const recalled = relevant.filter((log) => log.rating >= 3).length;
    return Math.round((recalled / relevant.length) * 100);
  }, [cardIds, userId]);

  if (deck === undefined) {
    return (
      <div className="app-shell flex flex-col">
        <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-10">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-3xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h2 className="text-xl font-bold text-ink">Колода не найдена</h2>
        <p className="max-w-sm text-sm text-ink-muted">
          Возможно, она была удалена или ссылка повреждена.
        </p>
        <Button onClick={() => router.push("/")}>На главную</Button>
      </div>
    );
  }

  const filteredCards = cardList.filter((card) => {
    const q = searchQuery.toLowerCase();
    const term = (card.term || card.front || "").toLowerCase();
    const definition = (card.definition || card.back || "").toLowerCase();
    const hint = (card.hint || "").toLowerCase();
    return term.includes(q) || definition.includes(q) || hint.includes(q);
  });

  const handleDeleteDeck = async () => {
    if (confirm(`Удалить колоду «${deck.title}» и все её карточки?`)) {
      await deleteDeckCascade(deck.id);
      router.push("/");
    }
  };

  const copyShareCode = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/share/${deck.shareCode}`
        : `/share/${deck.shareCode}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard may be blocked */
    }
    setCopiedShareCode(true);
    setTimeout(() => setCopiedShareCode(false), 2500);

    // If cloud is connected, make sure this deck is marked isPublic and synced
    if (isFirebaseConfigured() && dbFirestore) {
      try {
        const docRef = doc(dbFirestore, "decks", deck.id);
        await setDoc(docRef, { ...deck, isPublic: true }, { merge: true });
        const allCards = await db.cards.where("deckId").equals(deck.id).toArray();
        for (const card of allCards) {
          await setDoc(doc(dbFirestore, "cards", card.id), card, { merge: true });
        }
      } catch {
        // Background push may fail if offline
      }
    }
  };

  const total = stats?.total ?? cardList.length;
  const newCount = stats?.newCount ?? 0;
  const learningCount = stats?.learningCount ?? 0;
  const masteredCount = stats?.masteredCount ?? 0;
  const reviewCount = Math.max(0, total - newCount - learningCount - masteredCount);
  const pct = (value: number) => (total > 0 ? (value / total) * 100 : 0);

  return (
    <div className="app-shell flex flex-col">
      {/* Top bar */}
      <header className="glass sticky top-0 z-30 border-b border-line/80">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Все колоды</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyShareCode}>
              {copiedShareCode ? (
                <>
                  <Check className="text-emerald-500" />
                  <span>Скопировано</span>
                </>
              ) : (
                <>
                  <Share2 className="text-brand" />
                  <span>Поделиться</span>
                </>
              )}
            </Button>

            <Button variant="outline" size="sm" asChild>
              <Link href={`/deck/${deck.id}/edit`}>
                <Edit />
                <span className="hidden sm:inline">Редактировать</span>
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDeleteDeck}
              aria-label="Удалить колоду"
              className="text-ink-subtle hover:bg-red-500/10 hover:text-red-500"
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8">
        {/* Deck header */}
        <section className="animate-fade-up space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {deck.tags?.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[11px]">
                #{tag}
              </Badge>
            ))}

            <button
              onClick={copyShareCode}
              aria-live="polite"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-ink-muted transition-colors hover:border-brand/40 hover:text-brand"
              title="Скопировать публичную ссылку"
            >
              <Share2 className="h-3 w-3" />
              {deck.shareCode}
              {copiedShareCode ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {deck.title}
          </h1>

          {deck.description && (
            <p className="max-w-3xl text-sm leading-relaxed text-ink-muted sm:text-base">
              {deck.description}
            </p>
          )}
        </section>

        {/* Study modes */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-subtle">
            Режимы обучения
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STUDY_MODES.map(({ key, title, description, icon: Icon, accent, cta, badge }) => {
              const colors = ACCENTS[accent];
              return (
                <Link
                  key={key}
                  href={`/deck/${deck.id}/${key}`}
                  className={`card-lift group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${colors.border}`}
                >
                  <div className="space-y-3">
                    <span
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${colors.tile} transition-transform duration-300 group-hover:scale-110`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5 text-base font-bold text-ink">
                        {title}
                        {badge && (
                          <Badge variant="brand" className="px-1.5 py-0 text-[9px]">
                            {badge}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>
                    </div>
                  </div>

                  <div
                    className={`mt-4 flex items-center justify-between border-t border-line pt-3 text-xs font-semibold ${colors.text}`}
                  >
                    <span>{cta}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* FSRS progress */}
        {stats && (
          <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Clock className="h-4 w-4 text-brand" />
                  Фазы памяти
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Распределение карточек по фазам памяти FSRS
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 font-semibold text-ink-muted">
                  Удержание за 30 дней:{" "}
                  <span className="font-mono text-ink">
                    {retention === null || retention === undefined ? "—" : `${retention}%`}
                  </span>
                </span>
              </div>
            </div>

            {/* Stacked phase bar */}
            <div
              className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
              role="img"
              aria-label={`Новые ${newCount}, изучаются ${learningCount}, в повторении ${reviewCount}, выучено ${masteredCount}`}
            >
              <span className="bg-blue-500 transition-all duration-700" style={{ width: `${pct(newCount)}%` }} />
              <span className="bg-amber-500 transition-all duration-700" style={{ width: `${pct(learningCount)}%` }} />
              <span className="bg-indigo-500 transition-all duration-700" style={{ width: `${pct(reviewCount)}%` }} />
              <span className="bg-emerald-500 transition-all duration-700" style={{ width: `${pct(masteredCount)}%` }} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Новые", value: newCount, dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
                { label: "Изучаются", value: learningCount, dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
                { label: "В повторении", value: reviewCount, dot: "bg-indigo-500", text: "text-indigo-600 dark:text-indigo-400" },
                { label: "Выучено 21+ дн", value: masteredCount, dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
              ].map(({ label, value, dot, text }) => (
                <div key={label} className="rounded-2xl border border-line bg-surface-2/60 px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${dot}`} />
                    <span className="text-[11px] font-medium text-ink-muted">{label}</span>
                  </div>
                  <div className={`mt-1 text-xl font-extrabold tabular-nums ${text}`}>{value}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cards */}
        <section className="space-y-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="text-lg font-bold text-ink">
              Карточки
              <span className="ml-2 text-sm font-semibold text-ink-subtle">{cardList.length}</span>
            </h2>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
                <input
                  type="search"
                  placeholder="Поиск по карточкам…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Поиск по карточкам"
                  className="h-9 w-full rounded-xl border border-line bg-surface pl-8 pr-3 text-xs text-ink shadow-sm transition-all placeholder:text-ink-subtle hover:border-line-strong focus:border-brand/60 focus:outline-none focus:ring-4 focus:ring-brand/15 sm:w-56"
                />
              </div>

              <Button size="sm" asChild>
                <Link href={`/deck/${deck.id}/edit`}>
                  <Edit />
                  <span>Редактировать</span>
                </Link>
              </Button>
            </div>
          </div>

          {filteredCards.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-6 w-6" />}
              title={searchQuery ? "Ничего не найдено" : "В колоде пока нет карточек"}
              description={
                searchQuery
                  ? "Попробуйте другой запрос."
                  : "Добавьте карточки вручную или сгенерируйте их из конспекта."
              }
              action={
                <Button asChild>
                  <Link href={`/deck/${deck.id}/edit`}>
                    <Edit />
                    Открыть редактор
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {filteredCards.map((card, index) => (
                <article
                  key={card.id}
                  className="group rounded-2xl border border-line bg-surface p-4 shadow-sm transition-colors hover:border-line-strong"
                >
                  <div className="flex items-start gap-4">
                    <span className="mt-0.5 hidden w-6 shrink-0 text-right text-xs font-mono text-ink-subtle sm:block">
                      {index + 1}
                    </span>

                    <div className="grid flex-1 gap-3 md:grid-cols-2 md:gap-5">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                          Термин
                        </span>
                        <div className="text-sm font-semibold leading-relaxed text-ink">
                          <MarkdownMath content={card.term || card.front || ""} />
                        </div>
                        {(card.imageData || card.frontImage) && (
                          <img
                            src={card.imageData || card.frontImage}
                            alt={`Иллюстрация: ${card.term || card.front || "карточка"}`}
                            className="mt-2 h-16 w-auto rounded-lg border border-line object-contain"
                          />
                        )}
                      </div>

                      <div className="space-y-1 md:border-l md:border-line md:pl-5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                          Определение
                        </span>
                        <div className="text-sm leading-relaxed text-ink-muted">
                          <MarkdownMath content={card.definition || card.back || ""} />
                        </div>
                        {card.hint && (
                          <p className="text-[11px] italic text-amber-600 dark:text-amber-400">
                            Подсказка: {card.hint}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => speakText(card.term || card.front || "")}
                      aria-label="Озвучить термин"
                      className="shrink-0 rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-2 hover:text-brand"
                      title="Озвучить"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
