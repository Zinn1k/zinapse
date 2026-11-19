"use client";

import React, { useState, useEffect, use } from "react";
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
} from "lucide-react";
import { db, GUEST_USER_ID, deleteDeckCascade, type Card } from "@/lib/db";
import { calculateDeckFSRSStats } from "@/lib/fsrs";
import { speakText } from "@/lib/speech";
import { dbFirestore, isFirebaseConfigured, subscribeToAuthChanges } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { MarkdownMath } from "@/components/MarkdownMath";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card as UICard } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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
  const deck = useLiveQuery(() => db.decks.get(deckId), [deckId]);
  const cards = useLiveQuery(
    () => db.cards.where("deckId").equals(deckId).sortBy("order"),
    [deckId]
  );
  const stats = useLiveQuery(
    () => calculateDeckFSRSStats(deckId, userId),
    [deckId, userId]
  );

  if (deck === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black text-zinc-500">
        Загрузка колоды...
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

  const cardList: Card[] = cards || [];

  const filteredCards = cardList.filter((c) => {
    const q = searchQuery.toLowerCase();
    const term = (c.term || c.front || "").toLowerCase();
    const def = (c.definition || c.back || "").toLowerCase();
    const hint = (c.hint || "").toLowerCase();
    return term.includes(q) || def.includes(q) || hint.includes(q);
  });

  const handleDeleteDeck = async () => {
    if (confirm(`Удалить колоду «${deck.title}» и все её карточки?`)) {
      await deleteDeckCascade(deck.id);
      router.push("/");
    }
  };

  const copyShareCode = async () => {
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/share/${deck.shareCode}`
      : `/share/${deck.shareCode}`;
    await navigator.clipboard.writeText(url);
    setCopiedShareCode(true);
    setTimeout(() => setCopiedShareCode(false), 2500);

    // If cloud is connected, make sure this deck is marked isPublic and synced
    if (isFirebaseConfigured() && dbFirestore) {
      try {
        const docRef = doc(dbFirestore, "decks", deck.id);
        await setDoc(docRef, { ...deck, isPublic: true }, { merge: true });
        const allCards = await db.cards.where("deckId").equals(deck.id).toArray();
        for (const c of allCards) {
          await setDoc(doc(dbFirestore, "cards", c.id), c, { merge: true });
        }
      } catch {
        // Background push may fail if offline
      }
    }
  };

  const masteredPercentage = stats && stats.total > 0
    ? Math.round((stats.masteredCount / stats.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Все колоды</span>
          </Link>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyShareCode}
              className="text-xs"
              title="Поделиться ссылкой на колоду"
            >
              {copiedShareCode ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  <span>Ссылка скопирована!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                  <span>Поделиться</span>
                </>
              )}
            </Button>

            <Link href={`/deck/${deck.id}/edit`}>
              <Button variant="outline" size="sm" className="text-xs">
                <Edit className="w-3.5 h-3.5 mr-1" />
                <span>Редактировать</span>
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteDeck}
              className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-150">
        {/* Deck Header */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {deck.tags?.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                #{tag}
              </Badge>
            ))}

            <button
              onClick={copyShareCode}
              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:text-indigo-500"
              title="Копировать код для шаринга"
            >
              <Share2 className="w-3 h-3 mr-0.5" />
              <span>{deck.shareCode}</span>
              {copiedShareCode ? (
                <Check className="w-3 h-3 text-emerald-500 ml-1" />
              ) : (
                <Copy className="w-3 h-3 text-zinc-400 ml-1" />
              )}
            </button>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            {deck.title}
          </h1>

          {deck.description && (
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
              {deck.description}
            </p>
          )}
        </div>

        {/* Study Modes Launchpad */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Режимы обучения
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Карточки (Primary) */}
            <Link
              href={`/deck/${deck.id}/flashcards`}
              className="group p-5 rounded-2xl border-2 border-indigo-500/40 bg-white dark:bg-zinc-900 hover:border-indigo-600 dark:hover:border-indigo-500 hover:shadow-xl transition-all duration-200 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-base text-zinc-900 dark:text-white flex items-center space-x-1.5">
                    <span>Карточки</span>
                    <Badge variant="default" className="text-[10px] py-0 px-1.5">
                      FSRS
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    3D-переворот, FSRS-алгоритм или режим быстрой зубрежки (Cram).
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                <span>Начать карточки</span>
                <span>→</span>
              </div>
            </Link>

            {/* Заучивание */}
            <Link
              href={`/deck/${deck.id}/learn`}
              className="group p-5 rounded-2xl border-2 border-purple-500/40 bg-white dark:bg-zinc-900 hover:border-purple-600 dark:hover:border-purple-500 hover:shadow-xl transition-all duration-200 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-base text-zinc-900 dark:text-white flex items-center space-x-1.5">
                    <span>Заучивание</span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Адаптивные тесты 4 вариантов и письменный ввод с проверкой опечаток.
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center justify-between">
                <span>Начать заучивание</span>
                <span>→</span>
              </div>
            </Link>

            {/* Подбор */}
            <Link
              href={`/deck/${deck.id}/match`}
              className="group p-5 rounded-2xl border-2 border-amber-500/40 bg-white dark:bg-zinc-900 hover:border-amber-600 dark:hover:border-amber-500 hover:shadow-xl transition-all duration-200 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Gamepad2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-base text-zinc-900 dark:text-white flex items-center space-x-1.5">
                    <span>Подбор</span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Сетка 12 плиток на время с рекордами и штрафом за ошибки.
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                <span>Играть в подбор</span>
                <span>→</span>
              </div>
            </Link>

            {/* Тест */}
            <Link
              href={`/deck/${deck.id}/test`}
              className="group p-5 rounded-2xl border-2 border-emerald-500/40 bg-white dark:bg-zinc-900 hover:border-emerald-600 dark:hover:border-emerald-500 hover:shadow-xl transition-all duration-200 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-base text-zinc-900 dark:text-white flex items-center space-x-1.5">
                    <span>Тест</span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Экзаменационный билет: выбор, верно/неверно, ввод, сопоставление.
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                <span>Пройти тест</span>
                <span>→</span>
              </div>
            </Link>
          </div>
        </div>

        {/* FSRS Learning Progress & Metrics */}
        {stats && (
          <UICard className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <span>Прогресс усвоения (Алгоритм FSRS)</span>
                </h3>
                <p className="text-xs text-zinc-500">
                  Распределение карточек по фазам памяти
                </p>
              </div>

              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                Оценка долговременного удержания: {stats.retentionEstimate}%
              </span>
            </div>

            <Progress value={masteredPercentage} className="h-2.5" />

            <div className="grid grid-cols-3 gap-3 text-center pt-2">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <span className="block text-xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.newCount}
                </span>
                <span className="text-xs text-zinc-500">Новые</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <span className="block text-xl font-bold text-amber-600 dark:text-amber-400">
                  {stats.learningCount}
                </span>
                <span className="text-xs text-zinc-500">Изучаются</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                <span className="block text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.masteredCount}
                </span>
                <span className="text-xs text-zinc-500">Выучено (21+ дн)</span>
              </div>
            </div>
          </UICard>
        )}

        {/* Cards List Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              Карточки в колоде ({cardList.length})
            </h2>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Поиск по карточкам..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <Link href={`/deck/${deck.id}/edit`}>
                <Button size="sm" className="text-xs">
                  Редактировать
                </Button>
              </Link>
            </div>
          </div>

          {filteredCards.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-500 text-sm">
              Карточки не найдены
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCards.map((card) => (
                <UICard key={card.id} className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Term */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                          Термин
                        </span>
                        <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                          <MarkdownMath content={card.term || card.front || ""} />
                        </div>
                        {(card.imageData || card.frontImage) && (
                          <img
                            src={card.imageData || card.frontImage}
                            alt="Иллюстрация термина"
                            className="h-16 w-auto rounded-lg object-contain mt-2 border border-zinc-100 dark:border-zinc-800"
                          />
                        )}
                      </div>

                      {/* Definition */}
                      <div className="space-y-1 md:border-l md:border-zinc-100 md:dark:border-zinc-800 md:pl-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                          Определение
                        </span>
                        <div className="text-sm text-zinc-700 dark:text-zinc-300">
                          <MarkdownMath
                            content={card.definition || card.back || ""}
                          />
                        </div>
                        {card.hint && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                            Подсказка: {card.hint}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        speakText(card.term || card.front || "")
                      }
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-500 transition shrink-0"
                      title="Озвучить"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </UICard>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
