"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Timer,
  Trophy,
  RotateCw,
  ArrowLeft,
  Zap,
} from "lucide-react";
import { type Card, type Deck } from "@/lib/db";
import { MarkdownMath } from "../MarkdownMath";
import confetti from "canvas-confetti";

interface MatchModeProps {
  deck: Deck;
  cards: Card[];
  onExit: () => void;
}

interface TileItem {
  id: string; // unique tile id
  cardId: string;
  side: "front" | "back";
  text: string;
  matched: boolean;
}

export function MatchMode({ deck, cards, onExit }: MatchModeProps) {
  const [tiles, setTiles] = useState<TileItem[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [mismatchedPair, setMismatchedPair] = useState<[string, string] | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [personalBest, setPersonalBest] = useState<number | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Load high score
  useEffect(() => {
    const savedBest = localStorage.getItem(`match_best_${deck.id}`);
    if (savedBest) {
      setPersonalBest(parseFloat(savedBest));
    }
  }, [deck.id]);

  const initGame = useCallback(() => {
    // Select up to 6 cards for a 12-tile board
    const sampleSize = Math.min(6, cards.length);
    const selectedCards = [...cards].sort(() => Math.random() - 0.5).slice(0, sampleSize);

    const generatedTiles: TileItem[] = [];
    selectedCards.forEach((c) => {
      generatedTiles.push({
        id: `front_${c.id}`,
        cardId: c.id,
        side: "front",
        text: c.term || c.front || "",
        matched: false,
      });
      generatedTiles.push({
        id: `back_${c.id}`,
        cardId: c.id,
        side: "back",
        text: c.definition || c.back || "",
        matched: false,
      });
    });

    // Shuffle tiles
    setTiles(generatedTiles.sort(() => Math.random() - 0.5));
    setSelectedTileId(null);
    setMismatchedPair(null);
    setIsCompleted(false);
    setElapsedMs(0);
    startTimeRef.current = Date.now();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 50);
  }, [cards]);

  useEffect(() => {
    if (cards.length >= 2) {
      initGame();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cards, initGame]);

  const handleTileClick = (tile: TileItem) => {
    if (tile.matched || mismatchedPair) return;

    if (!selectedTileId) {
      setSelectedTileId(tile.id);
      return;
    }

    if (selectedTileId === tile.id) {
      // Deselect if clicking the same tile
      setSelectedTileId(null);
      return;
    }

    const firstTile = tiles.find((t) => t.id === selectedTileId);
    if (!firstTile) return;

    // Check if matching pair: must have same cardId and different side
    const isMatch = firstTile.cardId === tile.cardId && firstTile.side !== tile.side;

    if (isMatch) {
      // Mark as matched
      const updated = tiles.map((t) =>
        t.id === firstTile.id || t.id === tile.id ? { ...t, matched: true } : t
      );
      setTiles(updated);
      setSelectedTileId(null);

      // Check win condition
      const remaining = updated.filter((t) => !t.matched);
      if (remaining.length === 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        const finalTime = Math.round((Date.now() - startTimeRef.current) / 100) / 10;
        setIsCompleted(true);
        confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });

        // Update personal best
        if (!personalBest || finalTime < personalBest) {
          setPersonalBest(finalTime);
          localStorage.setItem(`match_best_${deck.id}`, finalTime.toString());
        }
      }
    } else {
      // Mismatch
      setMismatchedPair([firstTile.id, tile.id]);
      setTimeout(() => {
        setMismatchedPair(null);
        setSelectedTileId(null);
      }, 700);
    }
  };

  if (cards.length < 2) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
          Нужно как минимум 2 карточки
        </h3>
        <p className="text-sm text-zinc-500">
          Для игры в «Подбор» требуется не менее 2 карточек.
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
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          className="flex items-center space-x-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Выйти из игры</span>
        </button>

        {/* Live Stopwatch */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono font-bold text-base shadow-inner">
          <Timer className="w-4 h-4 text-indigo-500 animate-pulse" />
          <span>{(elapsedMs / 1000).toFixed(1)}s</span>
        </div>

        {/* Personal Best */}
        <div className="flex items-center space-x-1 text-xs text-amber-600 dark:text-amber-400 font-semibold">
          <Trophy className="w-3.5 h-3.5" />
          <span>Рекорд: {personalBest ? `${personalBest}с` : "--"}</span>
        </div>
      </div>

      {isCompleted ? (
        /* Victory Screen */
        <div className="max-w-md mx-auto py-12 px-4 text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white mx-auto shadow-lg shadow-orange-500/25">
            <Zap className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white">
              Потрясающая скорость!
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Вы соединили все пары за{" "}
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {(elapsedMs / 1000).toFixed(1)} секунд
              </span>
              .
            </p>
          </div>

          <div className="flex justify-center space-x-3 pt-2">
            <button
              onClick={initGame}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition"
            >
              <RotateCw className="w-4 h-4" />
              <span>Играть снова</span>
            </button>
            <button
              onClick={onExit}
              className="px-5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-semibold transition"
            >
              Назад к колоде
            </button>
          </div>
        </div>
      ) : (
        /* Tiles Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          <AnimatePresence>
            {tiles.map((tile) => {
              if (tile.matched) {
                return (
                  <div
                    key={tile.id}
                    className="h-28 sm:h-32 rounded-2xl border border-transparent opacity-0 pointer-events-none"
                  />
                );
              }

              const isSelected = selectedTileId === tile.id;
              const isMismatched = mismatchedPair?.includes(tile.id);

              let style =
                "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md";

              if (isSelected) {
                style =
                  "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500 shadow-md";
              } else if (isMismatched) {
                style =
                  "bg-red-50 dark:bg-red-950/40 border-red-500 text-red-900 dark:text-red-200 ring-2 ring-red-500 animate-shake";
              }

              return (
                <motion.button
                  key={tile.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => handleTileClick(tile)}
                  className={`h-28 sm:h-32 p-3 sm:p-4 rounded-2xl border flex items-center justify-center text-center transition-all cursor-pointer overflow-hidden ${style}`}
                >
                  <div className="text-xs sm:text-sm font-medium line-clamp-4">
                    <MarkdownMath content={tile.text} />
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
