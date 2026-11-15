"use client";

import React, { useState, useEffect, useRef, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Timer,
  Trophy,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Zap,
  Volume2,
  VolumeX,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { db, type Card as DbCard, type Deck } from "@/lib/db";
import { dbFirestore, isFirebaseConfigured, subscribeToAuthChanges } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, onSnapshot, doc, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { MarkdownMath } from "@/components/MarkdownMath";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sound } from "@/lib/sound";

interface MatchTile {
  id: string; // Unique tile id
  cardId: string;
  type: "term" | "definition";
  text: string;
  imageData?: string;
  isMatched: boolean;
  isError: boolean;
}

interface MatchRecord {
  id: string;
  timeSeconds: number;
  date: string;
  pairsCount: number;
}

export default function MatchGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const deckId = resolvedParams.id;
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [allCards, setAllCards] = useState<DbCard[]>([]);
  const [tiles, setTiles] = useState<MatchTile[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGameActive, setIsGameActive] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [penaltyFlash, setPenaltyFlash] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Leaderboard
  const [records, setRecords] = useState<MatchRecord[]>([]);
  const [cloudLeaderboard, setCloudLeaderboard] = useState<{
    id: string;
    userName: string;
    timeSeconds: number;
    date: string;
  }[]>([]);
  const [leaderboardTab, setLeaderboardTab] = useState<"online" | "local">("online");
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const penaltyRef = useRef<number>(0);

  // Auth subscriber
  useEffect(() => {
    const unsub = subscribeToAuthChanges((u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  // Real-time Cloud Leaderboard subscription
  useEffect(() => {
    if (!isFirebaseConfigured() || !dbFirestore) return;

    try {
      const q = query(
        collection(dbFirestore, "match_scores"),
        where("deckId", "==", deckId),
        orderBy("timeSeconds", "asc"),
        limit(10)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        const scores = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userName: data.userName || "Друг",
            timeSeconds: Number(data.timeSeconds) || 0,
            date: data.createdAt
              ? new Date(data.createdAt).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                })
              : "недавно",
          };
        });
        setCloudLeaderboard(scores);
      });

      return () => unsub();
    } catch (err) {
      console.warn("Firestore live leaderboard setup warning:", err);
    }
  }, [deckId]);

  // Load deck & cards from Dexie
  useEffect(() => {
    async function loadData() {
      const d = await db.decks.get(deckId);
      if (!d) {
        router.push("/");
        return;
      }
      setDeck(d);
      const c = await db.cards.where("deckId").equals(deckId).toArray();
      setAllCards(c);

      // Load local records for this deck
      try {
        const stored = localStorage.getItem(`quizlet_match_records_${deckId}`);
        if (stored) {
          setRecords(JSON.parse(stored));
        }
      } catch {
        // ignore localStorage error
      }
    }
    loadData();
  }, [deckId, router]);

  // Start or restart game
  const startNewGame = useCallback(() => {
    if (allCards.length < 2) return;

    // Pick up to 6 random cards
    const shuffledCards = [...allCards].sort(() => 0.5 - Math.random());
    const selectedCards = shuffledCards.slice(0, Math.min(6, shuffledCards.length));

    // Generate pairs: terms and definitions
    const newTiles: MatchTile[] = [];
    selectedCards.forEach((c) => {
      newTiles.push({
        id: `${c.id}_term`,
        cardId: c.id,
        type: "term",
        text: c.term,
        imageData: c.imageData,
        isMatched: false,
        isError: false,
      });
      newTiles.push({
        id: `${c.id}_def`,
        cardId: c.id,
        type: "definition",
        text: c.definition,
        isMatched: false,
        isError: false,
      });
    });

    // Shuffle tiles
    newTiles.sort(() => 0.5 - Math.random());

    setTiles(newTiles);
    setSelectedTileId(null);
    setIsProcessing(false);
    setIsGameOver(false);
    setIsNewRecord(false);
    setPenaltyFlash(false);
    penaltyRef.current = 0;
    setElapsedTime(0);

    startTimeRef.current = Date.now();
    setIsGameActive(true);
  }, [allCards]);

  // Initialize game when cards are loaded
  useEffect(() => {
    if (allCards.length >= 2 && !isGameActive && !isGameOver) {
      startNewGame();
    }
  }, [allCards, isGameActive, isGameOver, startNewGame]);

  // High precision timer loop (updates every 50ms)
  useEffect(() => {
    if (isGameActive && !isGameOver) {
      timerRef.current = setInterval(() => {
        const currentSeconds =
          (Date.now() - startTimeRef.current) / 1000 + penaltyRef.current;
        setElapsedTime(parseFloat(currentSeconds.toFixed(1)));
      }, 50);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGameActive, isGameOver]);

  // Handle tile tap/click
  const handleTileClick = (clickedTile: MatchTile) => {
    if (
      !isGameActive ||
      isGameOver ||
      isProcessing ||
      clickedTile.isMatched ||
      clickedTile.isError
    ) {
      return;
    }

    // If clicking already selected tile: unselect
    if (selectedTileId === clickedTile.id) {
      setSelectedTileId(null);
      return;
    }

    // First tile selection
    if (!selectedTileId) {
      setSelectedTileId(clickedTile.id);
      return;
    }

    // Second tile selected: verify match
    const firstTile = tiles.find((t) => t.id === selectedTileId);
    if (!firstTile) {
      setSelectedTileId(clickedTile.id);
      return;
    }

    setIsProcessing(true);

    if (firstTile.cardId === clickedTile.cardId && firstTile.id !== clickedTile.id) {
      // MATCH SUCCESS!
      if (soundEnabled) sound.playSuccess();

      setTiles((prev) =>
        prev.map((t) =>
          t.id === firstTile.id || t.id === clickedTile.id
            ? { ...t, isMatched: true }
            : t
        )
      );
      setSelectedTileId(null);
      setIsProcessing(false);

      // Check if all are matched
      const remainingUnmatched = tiles.filter(
        (t) =>
          t.id !== firstTile.id &&
          t.id !== clickedTile.id &&
          !t.isMatched
      );

      if (remainingUnmatched.length === 0) {
        // VICTORY!
        handleGameWin();
      }
    } else {
      // MISMATCH!
      if (soundEnabled) sound.playError();

      // Apply +1.0s penalty
      penaltyRef.current += 1.0;
      setPenaltyFlash(true);
      setTimeout(() => setPenaltyFlash(false), 800);

      // Flash red on both tiles
      setTiles((prev) =>
        prev.map((t) =>
          t.id === firstTile.id || t.id === clickedTile.id
            ? { ...t, isError: true }
            : t
        )
      );

      setTimeout(() => {
        setTiles((prev) =>
          prev.map((t) =>
            t.id === firstTile.id || t.id === clickedTile.id
              ? { ...t, isError: false }
              : t
          )
        );
        setSelectedTileId(null);
        setIsProcessing(false);
      }, 650);
    }
  };

  // Game Win completion handler
  const handleGameWin = () => {
    setIsGameActive(false);
    setIsGameOver(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const finalTime = parseFloat(
      ((Date.now() - startTimeRef.current) / 1000 + penaltyRef.current).toFixed(1)
    );
    setElapsedTime(finalTime);

    if (soundEnabled) sound.playVictory();
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
    });

    // Save record to local leaderboard
    const newRecord: MatchRecord = {
      id: crypto.randomUUID(),
      timeSeconds: finalTime,
      date: new Date().toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      pairsCount: tiles.length / 2,
    };

    const updated = [...records, newRecord].sort(
      (a, b) => a.timeSeconds - b.timeSeconds
    );
    const topRecords = updated.slice(0, 10);
    setRecords(topRecords);

    // Is it a new best score?
    if (topRecords.length > 0 && topRecords[0].id === newRecord.id) {
      setIsNewRecord(true);
    }

    try {
      localStorage.setItem(
        `quizlet_match_records_${deckId}`,
        JSON.stringify(topRecords)
      );
    } catch {
      // ignore
    }

    // Publish score to Firestore match_scores for real-time multiplayer leaderboard
    if (isFirebaseConfigured() && dbFirestore) {
      try {
        const scoreRef = doc(collection(dbFirestore, "match_scores"));
        setDoc(scoreRef, {
          id: scoreRef.id,
          deckId,
          userId: currentUser?.uid || "guest",
          userName:
            currentUser?.displayName ||
            currentUser?.email?.split("@")[0] ||
            "Игрок",
          timeSeconds: finalTime,
          pairsCount: tiles.length / 2,
          createdAt: Date.now(),
        }).catch(() => {});
      } catch {
        // ignore
      }
    }
  };

  if (!deck) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground animate-pulse">Загрузка игры...</p>
      </div>
    );
  }

  if (allCards.length < 2) {
    return (
      <div className="min-h-screen max-w-xl mx-auto p-4 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Недостаточно карточек для игры</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Для игры в «Подбор» требуется минимум 2 карточки. Добавьте больше карточек в редакторе колоды.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href={`/deck/${deckId}`}>Назад к колоде</Link>
          </Button>
          <Button asChild>
            <Link href={`/deck/${deckId}/edit`}>Редактировать колоду</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation & Status Bar */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/deck/${deckId}`} aria-label="Назад к колоде">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h1 className="font-semibold text-sm sm:text-base leading-none">
                Подбор
              </h1>
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-[180px] sm:max-w-xs mt-0.5">
              {deck.title}
            </p>
          </div>
        </div>

        {/* Live Timer & Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Penalty indicator */}
          <div className="relative flex items-center">
            <div
              className={`flex items-center gap-1.5 font-mono font-bold text-base sm:text-xl px-3 py-1 rounded-lg border transition-all ${
                penaltyFlash
                  ? "border-destructive bg-destructive/15 text-destructive scale-105"
                  : "border-border bg-card text-foreground"
              }`}
            >
              <Timer className="w-4 h-4 text-primary animate-pulse" />
              <span>{elapsedTime.toFixed(1)}s</span>
            </div>

            <AnimatePresence>
              {penaltyFlash && (
                <motion.span
                  initial={{ opacity: 0, y: 0, scale: 0.8 }}
                  animate={{ opacity: 1, y: -24, scale: 1.1 }}
                  exit={{ opacity: 0 }}
                  className="absolute left-1/2 -translate-x-1/2 font-bold text-xs text-destructive bg-destructive/10 px-1.5 py-0.5 rounded shadow-sm pointer-events-none"
                >
                  +1.0s
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Sound Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Выключить звук" : "Включить звук"}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            ) : (
              <VolumeX className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>

          {/* Restart */}
          <Button
            variant="outline"
            size="sm"
            onClick={startNewGame}
            className="hidden sm:inline-flex gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Заново
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-3 sm:p-6 max-w-6xl w-full mx-auto flex flex-col justify-center">
        {!isGameOver ? (
          <div className="w-full">
            <div className="mb-3 text-center sm:hidden">
              <span className="text-xs text-muted-foreground">
                Соедините все термины с их определениями
              </span>
            </div>

            {/* 12 Tiles Grid: Mobile 3x4 (or 2x6), Desktop 4x3 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-4 auto-rows-fr">
              {tiles.map((tile) => {
                const isSelected = selectedTileId === tile.id;

                return (
                  <motion.div
                    key={tile.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{
                      opacity: tile.isMatched ? 0 : 1,
                      scale: tile.isMatched ? 0.75 : 1,
                      pointerEvents: tile.isMatched ? "none" : "auto",
                    }}
                    transition={{ duration: 0.25 }}
                    onClick={() => handleTileClick(tile)}
                    className={`min-h-[105px] sm:min-h-[140px] p-3 sm:p-4 rounded-xl border-2 flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all duration-150 relative shadow-sm ${
                      tile.isMatched
                        ? "invisible opacity-0"
                        : tile.isError
                        ? "border-destructive bg-destructive/15 text-destructive ring-2 ring-destructive animate-shake"
                        : isSelected
                        ? "border-primary bg-primary/10 ring-4 ring-primary/30 shadow-md scale-[1.02]"
                        : "border-border/80 bg-card hover:border-primary/50 hover:bg-muted/50 active:scale-[0.98]"
                    }`}
                  >
                    {/* Badge for term vs definition distinction */}
                    <div className="absolute top-2 right-2">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/60">
                        {tile.type === "term" ? "Т" : "О"}
                      </span>
                    </div>

                    {tile.imageData && tile.type === "term" && (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 mb-1.5 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={tile.imageData}
                          alt="card visual"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="text-xs sm:text-sm font-medium line-clamp-4 overflow-hidden">
                      <MarkdownMath content={tile.text} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Victory / Results Screen */
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="max-w-md w-full mx-auto bg-card border rounded-2xl p-6 sm:p-8 text-center shadow-lg"
          >
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center mb-4">
              <Trophy className="w-9 h-9" />
            </div>

            <h2 className="text-2xl font-bold mb-1">Отличная работа!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Вы соединили все пары карточек
            </p>

            {/* Time Score */}
            <div className="bg-muted/50 border rounded-xl p-4 mb-6 relative overflow-hidden">
              {isNewRecord && (
                <div className="absolute top-2 right-2">
                  <Badge className="bg-amber-500 hover:bg-amber-600 gap-1 text-[11px]">
                    <Sparkles className="w-3 h-3" />
                    Новый рекорд!
                  </Badge>
                </div>
              )}
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 font-semibold">
                Ваше время
              </div>
              <div className="text-4xl font-extrabold font-mono text-primary">
                {elapsedTime.toFixed(1)} <span className="text-xl">сек</span>
              </div>
            </div>

            {/* Deck High Scores / Leaderboard */}
            <div className="mb-6 text-left">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setLeaderboardTab("online")}
                    className={`px-2 py-0.5 rounded-md transition ${
                      leaderboardTab === "online"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Онлайн Live 🟢
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardTab("local")}
                    className={`px-2 py-0.5 rounded-md transition ${
                      leaderboardTab === "local"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Мои рекорды
                  </button>
                </div>
                <span className="text-[11px] text-muted-foreground">Топ-10</span>
              </div>

              {leaderboardTab === "online" ? (
                cloudLeaderboard.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {cloudLeaderboard.map((rec, index) => {
                      const medal =
                        index === 0
                          ? "🥇"
                          : index === 1
                          ? "🥈"
                          : index === 2
                          ? "🥉"
                          : `${index + 1}.`;
                      return (
                        <div
                          key={rec.id}
                          className="flex items-center justify-between px-3 py-2 rounded-lg text-xs border bg-background border-border/60"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-5 text-center font-mono">{medal}</span>
                            <span className="font-semibold text-foreground truncate max-w-[120px]">
                              {rec.userName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              {rec.date}
                            </span>
                            <span className="font-mono font-bold text-primary">
                              {rec.timeSeconds.toFixed(1)} с
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 text-center border rounded-lg text-xs text-muted-foreground bg-muted/20">
                    Пока нет онлайн-рекордов. Будьте первыми!
                  </div>
                )
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {records.slice(0, 5).map((rec, index) => {
                    const isCurrent = rec.timeSeconds === elapsedTime;
                    const medal =
                      index === 0
                        ? "🥇"
                        : index === 1
                        ? "🥈"
                        : index === 2
                        ? "🥉"
                        : `${index + 1}.`;

                    return (
                      <div
                        key={rec.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm border transition-colors ${
                          isCurrent
                            ? "bg-primary/10 border-primary/40 font-semibold"
                            : "bg-background border-border/60"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-center font-mono">{medal}</span>
                          <span className="text-muted-foreground text-[11px]">
                            {rec.date}
                          </span>
                        </div>
                        <span className="font-mono font-bold">
                          {rec.timeSeconds.toFixed(1)} с
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push(`/deck/${deckId}`)}
              >
                К колоде
              </Button>
              <Button className="flex-1 gap-2" onClick={startNewGame}>
                <RotateCcw className="w-4 h-4" />
                Играть снова
              </Button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
