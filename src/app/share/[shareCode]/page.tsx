"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Check,
  Layers,
  Share2,
  GraduationCap,
  Gamepad2,
  FileCheck,
  AlertCircle,
  Copy,
} from "lucide-react";
import confetti from "canvas-confetti";
import { db, type Deck, type Card as DbCard, GUEST_USER_ID } from "@/lib/db";
import { generateId, generateShareCode } from "@/lib/utils";
import { dbFirestore, isFirebaseConfigured, subscribeToAuthChanges } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { MarkdownMath } from "@/components/MarkdownMath";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SharedDeckPage({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  const resolvedParams = use(params);
  const shareCode = resolvedParams.shareCode;
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<DbCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavedLocally, setIsSavedLocally] = useState(false);
  const [localDeckId, setLocalDeckId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>(GUEST_USER_ID);

  useEffect(() => {
    const unsub = subscribeToAuthChanges((u) => {
      if (u) setCurrentUserId(u.uid);
      else setCurrentUserId(GUEST_USER_ID);
    });
    return () => unsub();
  }, []);

  // Fetch shared deck
  useEffect(() => {
    async function loadSharedDeck() {
      setIsLoading(true);
      try {
        // 1. Try local Dexie first
        const local = await db.decks.where("shareCode").equals(shareCode).first();
        if (local) {
          setDeck(local);
          setLocalDeckId(local.id);
          setIsSavedLocally(true);
          const c = await db.cards.where("deckId").equals(local.id).sortBy("order");
          setCards(c);
          setIsLoading(false);
          return;
        }

        // 2. Query Cloud Firestore
        if (isFirebaseConfigured() && dbFirestore) {
          const q = query(
            collection(dbFirestore, "decks"),
            where("shareCode", "==", shareCode)
          );
          const snap = await getDocs(q);

          if (!snap.empty) {
            const cloudDeck = snap.docs[0].data() as Deck;
            setDeck(cloudDeck);

            // Fetch cloud cards
            const cardsQuery = query(
              collection(dbFirestore, "cards"),
              where("deckId", "==", cloudDeck.id)
            );
            const cardsSnap = await getDocs(cardsQuery);
            const cloudCards: DbCard[] = [];
            cardsSnap.forEach((docSnap) => cloudCards.push(docSnap.data() as DbCard));
            cloudCards.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            setCards(cloudCards);
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load shared deck:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSharedDeck();
  }, [shareCode]);

  // Clone deck to current user's local Dexie library
  const handleSaveToLibrary = async () => {
    if (!deck || cards.length === 0 || isSaving) return;

    setIsSaving(true);
    const newDeckId = generateId();
    const now = Date.now();

    const clonedDeck: Deck = {
      ...deck,
      id: newDeckId,
      ownerId: currentUserId,
      userId: currentUserId,
      shareCode: generateShareCode(),
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    };

    const clonedCards: DbCard[] = cards.map((c, idx) => ({
      ...c,
      id: generateId(),
      deckId: newDeckId,
      order: idx,
      createdAt: now,
      updatedAt: now,
    }));

    try {
      await db.decks.add(clonedDeck);
      await db.cards.bulkAdd(clonedCards);

      // If online and signed in, enqueue for cloud sync
      if (isFirebaseConfigured() && dbFirestore && currentUserId !== GUEST_USER_ID) {
        await db.sync_queue.put({
          id: `deck_${newDeckId}`,
          collection: "decks",
          docId: newDeckId,
          action: "upsert",
          payload: clonedDeck,
          timestamp: now,
          attempts: 0,
        });
      }

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });

      setIsSavedLocally(true);
      setLocalDeckId(newDeckId);

      // Navigate to the newly cloned deck
      setTimeout(() => {
        router.push(`/deck/${newDeckId}`);
      }, 800);
    } catch (saveErr) {
      console.error("Save error:", saveErr);
      alert("Не удалось сохранить колоду.");
    } finally {
      setIsSaving(false);
    }
  };

  const copyShareLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground animate-pulse text-sm">
          Загрузка колоды по коду {shareCode}...
        </p>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="min-h-screen max-w-md mx-auto p-4 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-3" />
        <h2 className="text-xl font-bold mb-1">Колода не найдена</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Колода с кодом <code className="font-mono text-foreground font-bold">{shareCode}</code> не существует или была удалена.
        </p>
        <Button asChild>
          <Link href="/">На главную</Link>
        </Button>
      </div>
    );
  }

  const activeDeckId = localDeckId || deck.id;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/" aria-label="Все колоды">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-primary" />
              <h1 className="font-bold text-sm sm:text-base leading-none">
                Общая колода
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Код: {deck.shareCode}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={copyShareLink}
          className="text-xs gap-1.5"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>Скопировано!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Ссылка</span>
            </>
          )}
        </Button>
      </header>

      {/* Hero Banner with Clone Action */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 text-white shadow-xl shadow-indigo-600/10 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs">
              {cards.length} карточек
            </Badge>
            {deck.tags?.map((t) => (
              <Badge
                key={t}
                className="bg-white/10 hover:bg-white/20 text-indigo-100 border-0 text-xs"
              >
                #{t}
              </Badge>
            ))}
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            {deck.title}
          </h1>

          {deck.description && (
            <p className="text-sm sm:text-base text-indigo-100/90 max-w-2xl leading-relaxed">
              {deck.description}
            </p>
          )}

          <div className="pt-2 flex flex-wrap gap-3 items-center">
            {isSavedLocally ? (
              <Button
                variant="secondary"
                size="lg"
                className="font-bold gap-2 text-indigo-700 bg-white hover:bg-indigo-50"
                asChild
              >
                <Link href={`/deck/${activeDeckId}`}>
                  <Check className="w-5 h-5 text-emerald-600" />
                  Открыть в моей библиотеке
                </Link>
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={handleSaveToLibrary}
                disabled={isSaving}
                className="font-bold gap-2 bg-white text-indigo-700 hover:bg-indigo-50 shadow-md"
              >
                <Download className="w-5 h-5" />
                {isSaving ? "Сохранение..." : "Сохранить себе в библиотеку"}
              </Button>
            )}

            <Button
              variant="outline"
              size="lg"
              className="bg-indigo-500/30 hover:bg-indigo-500/40 text-white border-white/20 font-semibold"
              asChild
            >
              <Link href={`/deck/${activeDeckId}/flashcards`}>
                <Layers className="w-4 h-4 mr-1.5" />
                Учить карточки
              </Link>
            </Button>
          </div>
        </div>

        {/* Study Modes Quick Launch */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Режимы обучения
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href={`/deck/${activeDeckId}/flashcards`}
              className="p-3.5 rounded-xl border bg-card hover:border-primary/50 transition-all text-center flex flex-col items-center gap-1.5"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold">Карточки</span>
            </Link>

            <Link
              href={`/deck/${activeDeckId}/learn`}
              className="p-3.5 rounded-xl border bg-card hover:border-purple-500/50 transition-all text-center flex flex-col items-center gap-1.5"
            >
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold">Заучивание</span>
            </Link>

            <Link
              href={`/deck/${activeDeckId}/match`}
              className="p-3.5 rounded-xl border bg-card hover:border-amber-500/50 transition-all text-center flex flex-col items-center gap-1.5"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold">Подбор</span>
            </Link>

            <Link
              href={`/deck/${activeDeckId}/test`}
              className="p-3.5 rounded-xl border bg-card hover:border-emerald-500/50 transition-all text-center flex flex-col items-center gap-1.5"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <FileCheck className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold">Тест</span>
            </Link>
          </div>
        </div>

        {/* Cards Preview List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Карточки в этой колоде ({cards.length})
            </h2>
          </div>

          <div className="space-y-2.5">
            {cards.map((card, idx) => (
              <div
                key={card.id || idx}
                className="p-4 rounded-xl border bg-card shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                    Термин #{idx + 1}
                  </div>
                  <div className="font-semibold text-sm text-foreground">
                    <MarkdownMath content={card.term} />
                  </div>
                  {card.imageData && (
                    <div className="mt-2 w-16 h-16 rounded overflow-hidden border">
                      <img
                        src={card.imageData}
                        alt="card visual"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="sm:border-l sm:pl-3 pt-2 sm:pt-0 border-t sm:border-t-0">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                    Определение
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    <MarkdownMath content={card.definition} />
                  </div>
                  {card.hint && (
                    <div className="text-[11px] text-amber-500 mt-1 italic">
                      Подсказка: {card.hint}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
