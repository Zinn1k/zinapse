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
  CheckCircle2,
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
import { useTheme } from "@/components/ThemeProvider";
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
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const { resolved, toggleTheme, ready: themeReady } = useTheme();

  useEffect(() => {
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

  const handleManualSync = async () => {
    if (user) {
      await triggerFullSync(user.uid);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  const syncLabel = !syncState.isOnline
    ? "Офлайн"
    : !isFirebaseConfigured() || !user
    ? "Локально"
    : syncState.isSyncing
    ? "Синхронизация…"
    : syncState.pendingCount > 0
    ? `В очереди: ${syncState.pendingCount}`
    : "Синхронизировано";

  return (
    <header className="glass sticky top-0 z-40 w-full border-b border-line/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ZinapseLogo
            size={38}
            className="h-9 w-9 rounded-xl shadow-lg shadow-indigo-500/25 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-gradient text-xl font-extrabold tracking-tight">
                Zinapse
              </span>
              <span className="hidden rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand sm:inline">
                FSRS
              </span>
            </span>
            <span className="hidden text-xs text-ink-muted sm:block">
              Local-first карточки · AI
            </span>
          </span>
        </Link>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onOpenAIGenerate}
            title="Сгенерировать карточки с помощью Gemini AI"
            className="group inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 transition-all hover:shadow-lg hover:shadow-indigo-600/35 active:scale-[0.97]"
          >
            <Sparkles className="h-4 w-4 text-amber-200 transition-transform group-hover:scale-110" />
            <span className="hidden sm:inline">AI Колода</span>
          </button>

          {/* Sync status */}
          <button
            onClick={handleManualSync}
            disabled={!user || syncState.isSyncing || !syncState.isOnline}
            title={
              !syncState.isOnline
                ? "Нет сети. Изменения сохраняются локально в IndexedDB"
                : !isFirebaseConfigured() || !user
                ? "100% local-first режим. Войдите, чтобы включить облачную синхронизацию"
                : syncState.pendingCount > 0
                ? `В очереди ${syncState.pendingCount} изменений — нажмите для синхронизации`
                : "Все данные синхронизированы"
            }
            aria-label={`Статус синхронизации: ${syncLabel}`}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition-colors disabled:cursor-default ${
              !syncState.isOnline
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : !isFirebaseConfigured() || !user
                ? "border-dashed border-line text-ink-muted"
                : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink"
            }`}
          >
            {!syncState.isOnline ? (
              <WifiOff className="h-3.5 w-3.5" />
            ) : syncState.isSyncing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-brand" />
            ) : !isFirebaseConfigured() || !user ? (
              <CloudOff className="h-3.5 w-3.5" />
            ) : syncState.pendingCount > 0 ? (
              <Cloud className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            )}
            <span className="hidden lg:inline">{syncLabel}</span>
          </button>

          {/* Auth */}
          {user ? (
            <div className="flex items-center gap-1">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full border border-brand/30 bg-brand/15 text-xs font-bold text-brand"
                title={user.email || user.displayName || "Выполнен вход"}
              >
                {(user.displayName || user.email || "U").trim()[0]?.toUpperCase() || "U"}
              </div>
              <button
                onClick={handleSignOut}
                aria-label="Выйти из аккаунта"
                title="Выйти из аккаунта"
                className="rounded-lg p-2 text-ink-subtle transition-colors hover:bg-red-500/10 hover:text-red-500"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              title="Войти или создать аккаунт для синхронизации"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:border-line-strong hover:bg-surface-2 active:scale-[0.97] sm:px-3"
            >
              <LogIn className="h-3.5 w-3.5 text-brand" />
              <span>Войти</span>
            </button>
          )}

          <div className="mx-0.5 hidden h-6 w-px bg-line sm:block" aria-hidden />

          <button
            onClick={toggleTheme}
            aria-label={resolved === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
            title={resolved === "dark" ? "Светлая тема" : "Тёмная тема"}
            className="rounded-xl p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {!themeReady ? (
              <span className="block h-4 w-4" />
            ) : resolved === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-500" />
            )}
          </button>

          <button
            onClick={onOpenSettings}
            aria-label="Настройки"
            title="Настройки и параметры FSRS"
            className="rounded-xl p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Thin progress line while syncing */}
      {syncState.isSyncing && (
        <div
          aria-hidden
          className="animate-pulse-soft absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand to-transparent"
        />
      )}

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </header>
  );
}
