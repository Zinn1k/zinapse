"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Settings,
  Cloud,
  CloudOff,
  RefreshCw,
  Sun,
  Moon,
  LogOut,
  LogIn,
  WifiOff,
  CheckCircle,
} from "lucide-react";
import { ZinapseLogo } from "@/components/ZinapseLogo";
import { AuthModal } from "@/components/AuthModal";
import {
  subscribeToAuthChanges,
  signOutUser,
  isFirebaseConfigured,
  handleRedirectResult,
} from "@/lib/firebase";
import { subscribeSyncState, triggerFullSync, type SyncState } from "@/lib/sync";
import { db, GUEST_USER_ID } from "@/lib/db";
import type { User } from "firebase/auth";

interface AppHeaderProps {
  onOpenSettings: () => void;
  onOpenAIGenerate: () => void;
  currentUserId: string;
  setCurrentUserId: (id: string) => void;
}

export function AppHeader({
  onOpenSettings,
  onOpenAIGenerate,
  setCurrentUserId,
}: AppHeaderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    isOnline: true,
    pendingCount: 0,
    lastSyncedAt: null,
    error: null,
  });
  const [isDark, setIsDark] = useState<boolean>(true);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);

  useEffect(() => {
    // Sync theme with document element
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }

    // Handle redirect result if user returned from Google redirect auth
    handleRedirectResult().catch(() => {});

    const unsubAuth = subscribeToAuthChanges(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setCurrentUserId(firebaseUser.uid);
        try {
          // Adopt guest decks into user's account for cloud sync
          const guestDecks = await db.decks.where("ownerId").equals(GUEST_USER_ID).toArray();
          for (const gd of guestDecks) {
            await db.decks.update(gd.id, { ownerId: firebaseUser.uid, userId: firebaseUser.uid });
            await db.sync_queue.put({
              id: `deck_${gd.id}`,
              collection: "decks",
              docId: gd.id,
              action: "upsert",
              payload: { ...gd, ownerId: firebaseUser.uid, userId: firebaseUser.uid },
              timestamp: Date.now(),
              attempts: 0,
            });
          }
        } catch {
          // ignore
        }
        // Automatically sync cloud decks down and upload local queue
        triggerFullSync(firebaseUser.uid).catch(() => {});
      } else {
        setCurrentUserId(GUEST_USER_ID);
      }
    });

    const unsubSync = subscribeSyncState(setSyncState);

    return () => {
      unsubAuth();
      unsubSync();
    };
  }, [setCurrentUserId]);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  const handleManualSync = async () => {
    if (user) {
      await triggerFullSync(user.uid);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 group-hover:scale-105 transition-transform">
            <ZinapseLogo size={40} className="w-10 h-10 shadow-md shadow-indigo-500/25 rounded-2xl" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-zinc-950 via-indigo-950 to-zinc-800 dark:from-white dark:via-indigo-200 dark:to-zinc-100 bg-clip-text text-transparent">
                Zinapse
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800">
                FSRS PWA
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
              Бесплатный аналог Quizlet • Local-First
            </p>
          </div>
        </Link>

        {/* Right Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* AI Generate Button */}
          <button
            onClick={onOpenAIGenerate}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium shadow-sm transition-all hover:shadow hover:shadow-indigo-500/25 active:scale-95"
            title="Сгенерировать карточки с помощью Gemini AI"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span className="hidden sm:inline">AI Колода</span>
          </button>

          {/* Sync status indicator */}
          {!syncState.isOnline ? (
            <div
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-amber-500/30 bg-amber-500/10 text-amber-500"
              title="Нет подключения к сети. Все изменения сохраняются локально в Dexie.js"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Офлайн</span>
            </div>
          ) : !isFirebaseConfigured() || !user ? (
            <div
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400"
              title="100% Local-First режим. Войдите через Google для облачной синхронизации"
            >
              <CloudOff className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Локально</span>
            </div>
          ) : (
            <button
              onClick={handleManualSync}
              disabled={syncState.isSyncing}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 transition"
              title={
                syncState.isSyncing
                  ? "Синхронизация с Firestore..."
                  : syncState.pendingCount > 0
                  ? `В очереди ${syncState.pendingCount} изменений. Нажмите для синхронизации`
                  : "Все данные синхронизированы с облаком"
              }
            >
              {syncState.isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
              ) : syncState.pendingCount > 0 ? (
                <Cloud className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span className="hidden md:inline">
                {syncState.isSyncing
                  ? "Синхронизация..."
                  : syncState.pendingCount > 0
                  ? `В очереди: ${syncState.pendingCount}`
                  : "Синхронизировано"}
              </span>
            </button>
          )}

          {/* User Auth */}
          {user ? (
            <div className="flex items-center space-x-2 pl-1">
              <div
                className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 border border-indigo-300 dark:border-indigo-700 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300"
                title={user.email || user.displayName || "Выполнен вход"}
              >
                {user.displayName ? user.displayName[0].toUpperCase() : "U"}
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-red-500 transition"
                title="Выйти из аккаунта"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-sm transition active:scale-95"
              title="Войти или создать аккаунт для синхронизации"
            >
              <LogIn className="w-3.5 h-3.5 text-indigo-500" />
              <span>Войти</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
            title={isDark ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-600" />}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
            title="Настройки и параметры FSRS"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Account Authentication & Registration Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </header>
  );
}
