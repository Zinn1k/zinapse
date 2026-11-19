"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Timer,
  Trophy,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Zap,
  Volume2,
  VolumeX,
  ArrowLeft,
  Medal,
} from "lucide-react";
import { type Card as DbCard, type Deck } from "@/lib/db";
import { dbFirestore, isFirebaseConfigured, subscribeToAuthChanges } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { MarkdownMath } from "../MarkdownMath";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sound } from "@/lib/sound";
import confetti from "canvas-confetti";

export interface MatchModeProps {
  deck: Deck;
  cards: DbCard[];
  userId?: string;
  onExit: () => void;
}

export interface MatchTile {
  id: string; // Unique tile id
  cardId: string;
  type: "term" | "definition";
  text: string;
  imageData?: string;
  isMatched: boolean;
  isError: boolean;
}

export interface MatchRecord {
  id: string;
  timeSeconds: number;
  date: string;
  pairsCount: number;
}

export function MatchMode({ deck, cards: allCards, userId, onExit }: MatchModeProps) {
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
  const [cloudLeaderboard, setCloudLeaderboard] = useState<
    {
      id: string;
      userName: string;
      timeSeconds: number;
      date: string;
    }[]
  >([]);
  const [leaderboardTab, setLeaderboardTab] = useState<"online" | "local">("online");
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const penaltyRef = useRef<number>(0);

  // Auth subscriber for real user profile
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
        where("deckId", "==", deck.id),
        orderBy("timeSeconds", "asc"),
        limit(10)
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
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
        },
        (err) => {
          console.warn("Firestore live leaderboard subscription:", err);
        }
      );

      return () => unsub();
    } catch (err) {
      console.warn("Firestore live leaderboard setup warning:", err);
    }
  }, [deck.id]);

  // Load local records for this deck
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`quizlet_match_records_${deck.id}`);
      if (stored) {
        setRecords(JSON.parse(stored));
      }
    } catch {
      // ignore localStorage error
    }
  }, [deck.id]);

  // Start or restart game
  const startNewGame = useCallback(() => {
    if (allCards.length < 2) return;

    // Pick up to 6 random cards for a 12-tile board
    const shuffledCards = [...allCards].sort(() => 0.5 - Math.random());
    const selectedCards = shuffledCards.slice(0, Math.min(6, shuffledCards.length));

    // Generate pairs: terms and definitions
    const newTiles: MatchTile[] = [];
    selectedCards.forEach((c) => {
      newTiles.push({
        id: `${c.id}_term`,
        cardId: c.id,
        type: "term",
        text: c.term || c.front || "",
        imageData: c.imageData || c.frontImage,
        isMatched: false,
        isError: false,
      });
      newTiles.push({
        id: `${c.id}_def`,
        cardId: c.id,
        type: "definition",
        text: c.definition || c.back || "",
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

  // Game Win completion handler
  const handleGameWin = useCallback(() => {
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

    // Check if new best score
    if (topRecords.length > 0 && topRecords[0].id === newRecord.id) {
      setIsNewRecord(true);
    }

    try {
      localStorage.setItem(
        `quizlet_match_records_${deck.id}`,
        JSON.stringify(topRecords)
      );
    } catch {
      // ignore
    }

    // Publish score to Firestore match_scores for real-time multiplayer leaderboard
    if (isFirebaseConfigured() && dbFirestore) {
      try {
        const scoreRef = doc(collection(dbFirestore, "match_scores"));
        const effectiveUserId = userId || currentUser?.uid || "guest";
        const effectiveUserName =
          currentUser?.displayName ||
          currentUser?.email?.split("@")[0] ||
          (effectiveUserId !== "guest" ? `User_${effectiveUserId.slice(0, 5)}` : "Игрок");

        setDoc(scoreRef, {
          id: scoreRef.id,
          deckId: deck.id,
          userId: effectiveUserId,
          userName: effectiveUserName,
          timeSeconds: finalTime,
          pairsCount: tiles.length / 2,
          createdAt: Date.now(),
        }).catch((err) => {
          console.warn("Failed to publish match score to Firestore:", err);
        });
      } catch {
        // ignore
      }
    }
  }, [currentUser, deck.id, records, soundEnabled, tiles.length, userId]);

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

  if (allCards.length < 2) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 flex flex-col items-center justify-center text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-2" />
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
          Недостаточно карточек для игры
        </h2>
        <p className="text-zinc-500 text-sm max-w-sm">
          Для игры в «Подбор» требуется минимум 2 карточки. Добавьте больше карточек в колоду.
        </p>
        <Button onClick={onExit} variant="outline">
          Назад к колоде
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col min-h-[600px] justify-between space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b pb-4 border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center space-x-3">
          <button
            onClick={onExit}
            className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h1 className="font-bold text-sm sm:text-base leading-none text-zinc-900 dark:text-white">
                Подбор
              </h1>
            </div>
            <p className="text-xs text-zinc-500 truncate max-w-[200px] mt-0.5">
              {deck.title}
            </p>
          </div>
        </div>

        {/* Live Timer & Audio Controls */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <div
              className={`flex items-center gap-1.5 font-mono font-bold text-base sm:text-lg px-3 py-1 rounded-xl border transition-all ${
                penaltyFlash
                  ? "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 scale-105"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              }`}
            >
              <Timer className="w-4 h-4 text-indigo-500 animate-pulse" />
              <span>{elapsedTime.toFixed(1)}s</span>
            </div>

            <AnimatePresence>
              {penaltyFlash && (
                <motion.span
                  initial={{ opacity: 0, y: 0, scale: 0.8 }}
                  animate={{ opacity: 1, y: -22, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute right-0 -top-1 text-xs font-bold font-mono text-red-500 pointer-events-none"
                >
                  +1.0s
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
            title={soundEnabled ? "Выключить звук" : "Включить звук"}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-indigo-500" />
            ) : (
              <VolumeX className="w-4 h-4 text-zinc-400" />
            )}
          </button>
        </div>
      </div>

      {/* Main Game Arena */}
      {isGameOver ? (
        /* Victory Screen & Leaderboard */
        <div className="max-w-xl mx-auto py-8 text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center text-white mx-auto shadow-2xl shadow-amber-500/25">
            <Trophy className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-black text-zinc-900 dark:text-white">
              Победа! Все пары сопоставлены
            </h2>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-mono font-black text-indigo-600 dark:text-indigo-400">
                {elapsedTime.toFixed(1)} сек
              </span>
              {isNewRecord && (
                <Badge variant="warning" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  Новый рекорд!
                </Badge>
              )}
            </div>
          </div>

          {/* Leaderboard Tabs */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-left space-y-4">
            <div className="flex items-center justify-between border-b pb-2 border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Medal className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-sm text-zinc-900 dark:text-white">
                  Таблица рекордов
                </span>
              </div>
              <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs">
                <button
                  onClick={() => setLeaderboardTab("online")}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    leaderboardTab === "online"
                      ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-zinc-500"
                  }`}
                >
                  Онлайн топ-10
                </button>
                <button
                  onClick={() => setLeaderboardTab("local")}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    leaderboardTab === "local"
                      ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-zinc-500"
                  }`}
                >
                  Мои рекорды
                </button>
              </div>
            </div>

            {/* List */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {leaderboardTab === "online" ? (
                cloudLeaderboard.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-3 text-center">
                    В онлайн таблице пока нет записей. Ваш рекорд отправлен!
                  </p>
                ) : (
                  cloudLeaderboard.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-xs p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-center font-bold">
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                        </span>
                        <span className="font-medium truncate max-w-[150px]">
                          {item.userName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-400 text-[10px]">{item.date}</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {item.timeSeconds.toFixed(1)}s
                        </span>
                      </div>
                    </div>
                  ))
                )
              ) : records.length === 0 ? (
                <p className="text-xs text-zinc-400 py-3 text-center">Нет локальных записей</p>
              ) : (
                records.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-center font-bold">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                      </span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {item.date}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {item.timeSeconds.toFixed(1)}s
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" onClick={startNewGame} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              <span>Сыграть снова</span>
            </Button>
            <Button onClick={onExit} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              Назад к колоде
            </Button>
          </div>
        </div>
      ) : (
        /* 12-Tile Game Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 my-auto select-none">
          <AnimatePresence>
            {tiles.map((tile) => {
              const isSelected = selectedTileId === tile.id;

              if (tile.isMatched) {
                return (
                  <motion.div
                    key={tile.id}
                    layout
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="h-28 sm:h-36 rounded-2xl border border-transparent pointer-events-none"
                  />
                );
              }

              let tileStyle =
                "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600";

              if (isSelected) {
                tileStyle =
                  "border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/40";
              }

              if (tile.isError) {
                tileStyle =
                  "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 animate-shake";
              }

              return (
                <motion.button
                  key={tile.id}
                  layout
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleTileClick(tile)}
                  className={`h-28 sm:h-36 p-3 sm:p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center cursor-pointer transition shadow-sm overflow-hidden ${tileStyle}`}
                >
                  <div className="text-xs sm:text-sm font-medium leading-snug line-clamp-4">
                    <MarkdownMath content={tile.text} />
                  </div>
                  {tile.imageData && (
                    <img
                      src={tile.imageData}
                      alt="tile visual"
                      className="mt-1 max-h-10 object-contain rounded"
                    />
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Footer Info */}
      <div className="text-center text-xs text-zinc-400">
        Соедините все термины с соответствующими определениями как можно быстрее!
      </div>
    </div>
  );
}
