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
  BookOpen,
  LogOut,
  LogIn,
} from "lucide-react";
import {
  subscribeToAuthChanges,
  signInWithGoogle,
  signOutUser,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { subscribeSyncState, processSyncQueue, type SyncState } from "@/lib/sync";
import { GUEST_USER_ID } from "@/lib/db";
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
  currentUserId,
  setCurrentUserId,
}: AppHeaderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
    error: null,
  });
  const [isDark, setIsDark] = useState<boolean>(true);

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

    const unsubAuth = subscribeToAuthChanges((firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setCurrentUserId(firebaseUser.uid);
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
      await processSyncQueue(user.uid);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      alert(err.message || "Failed to sign in with Google.");
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-white">
                Memorize
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800">
                FSRS PWA
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
              Free Quizlet Analog • Local-First
            </p>
          </div>
        </Link>

        {/* Right Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* AI Generate Button */}
          <button
            onClick={onOpenAIGenerate}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium shadow-sm transition-all hover:shadow hover:shadow-indigo-500/25 active:scale-95"
            title="Generate flashcards with Gemini AI"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span className="hidden sm:inline">AI Deck</span>
          </button>

          {/* Sync indicator */}
          {isFirebaseConfigured() ? (
            <button
              onClick={handleManualSync}
              disabled={syncState.isSyncing}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition"
              title={
                syncState.isSyncing
                  ? "Syncing to Firestore..."
                  : `Cloud Sync: ${syncState.pendingCount} pending`
              }
            >
              {syncState.isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span className="hidden md:inline">
                {syncState.isSyncing
                  ? "Syncing..."
                  : syncState.pendingCount > 0
                  ? `${syncState.pendingCount} unmerged`
                  : "Synced"}
              </span>
            </button>
          ) : (
            <div
              className="flex items-center space-x-1 px-2 py-1 rounded text-xs text-zinc-500 dark:text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-800"
              title="Running in 100% Local-First Offline Mode (Dexie IndexedDB)"
            >
              <CloudOff className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden lg:inline">Local-First</span>
            </div>
          )}

          {/* User Auth */}
          {user ? (
            <div className="flex items-center space-x-2 pl-1">
              <div
                className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 border border-indigo-300 dark:border-indigo-700 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300"
                title={user.email || user.displayName || "Signed in"}
              >
                {user.displayName ? user.displayName[0].toUpperCase() : "U"}
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-red-500 transition"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : isFirebaseConfigured() ? (
            <button
              onClick={handleGoogleSignIn}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          ) : null}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-600" />}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
            title="Settings & FSRS Parameters"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
