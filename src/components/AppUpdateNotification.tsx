"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  Sparkles,
  X,
  RefreshCw,
} from "lucide-react";
import { checkForAppUpdates, type UpdateInfo } from "@/lib/updater";

export function AppUpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    // Check for updates on mount after a slight delay
    const timer = setTimeout(() => {
      checkForAppUpdates().then((info) => {
        if (info && info.hasUpdate) {
          // Check if user dismissed this specific version in sessionStorage
          const dismissedVersion = sessionStorage.getItem("dismissed_update_version");
          if (dismissedVersion !== info.latestVersion) {
            setUpdateInfo(info);
          }
        }
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  if (!updateInfo || !updateInfo.hasUpdate || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (updateInfo) {
      sessionStorage.setItem("dismissed_update_version", updateInfo.latestVersion);
    }
  };

  const handleDownload = () => {
    setIsDownloading(true);
    if (typeof window !== "undefined") {
      window.open(updateInfo.downloadUrl, "_blank");
    }
    setTimeout(() => {
      setIsDownloading(false);
    }, 2000);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full mx-4 sm:mx-0 animate-in slide-in-from-bottom-5 duration-300">
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl p-4 shadow-2xl shadow-indigo-500/20 text-zinc-900 dark:text-white">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          aria-label="Закрыть уведомление"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start space-x-3 pr-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/30">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          </div>

          <div className="flex-1 space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-sm tracking-tight">
                Доступно обновление
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                v{updateInfo.latestVersion}
              </span>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Вышла новая версия приложения Zinapse. Рекомендуется обновиться для получения свежих функций.
            </p>

            {updateInfo.releaseNotes && (
              <div className="mt-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-300 max-h-24 overflow-y-auto">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-0.5">
                  Что нового:
                </p>
                <p className="whitespace-pre-line text-zinc-500 dark:text-zinc-400 line-clamp-3">
                  {updateInfo.releaseNotes}
                </p>
              </div>
            )}

            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition active:scale-95 disabled:opacity-50"
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Загрузка...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Скачать APK</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDismiss}
                className="py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-semibold transition"
              >
                Позже
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
