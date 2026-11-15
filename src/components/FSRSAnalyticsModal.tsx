"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  TrendingUp,
  Brain,
  Calendar,
  Sparkles,
  Zap,
} from "lucide-react";
import { getFSRSAnalytics, type FSRSAnalyticsData } from "@/lib/analytics";

interface FSRSAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  deckId?: string;
  deckTitle?: string;
}

export function FSRSAnalyticsModal({
  isOpen,
  onClose,
  userId,
  deckId,
  deckTitle,
}: FSRSAnalyticsModalProps) {
  const [data, setData] = useState<FSRSAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getFSRSAnalytics(userId, deckId).then((res) => {
      setData(res);
      setLoading(false);
    });
  }, [isOpen, userId, deckId]);

  if (!isOpen) return null;

  const maxForecastCount = data
    ? Math.max(...data.forecast7Days.map((d) => d.count), 1)
    : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center space-x-1.5">
                <span>Аналитика FSRS</span>
                {deckTitle && (
                  <span className="text-xs font-normal text-zinc-500 max-w-[200px] truncate">
                    • {deckTitle}
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-500">
                Интервальная память и прогноз повторений на 7 дней
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {loading || !data ? (
            <div className="py-16 text-center text-sm text-zinc-500">
              Загрузка аналитики FSRS...
            </div>
          ) : (
            <>
              {/* Top Key Metrics Banner */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 text-center">
                  <div className="flex items-center justify-center space-x-1 text-indigo-600 dark:text-indigo-400 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-medium">Удержание</span>
                  </div>
                  <div className="text-2xl font-black text-indigo-900 dark:text-indigo-200">
                    {data.estimatedRetention}%
                  </div>
                  <div className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80">
                    Целевой retention
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 text-center">
                  <div className="flex items-center justify-center space-x-1 text-emerald-600 dark:text-emerald-400 mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-xs font-medium">Стабильность</span>
                  </div>
                  <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
                    {data.avgStabilityDays} <span className="text-xs font-normal">дн</span>
                  </div>
                  <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                    Средний интервал
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 text-center">
                  <div className="flex items-center justify-center space-x-1 text-amber-600 dark:text-amber-400 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-medium">Повторений</span>
                  </div>
                  <div className="text-2xl font-black text-amber-900 dark:text-amber-200">
                    {data.totalReviews}
                  </div>
                  <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80">
                    Всего зафиксировано
                  </div>
                </div>
              </div>

              {/* 7-Day Forecast Chart */}
              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  <span className="flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    <span>Прогноз очереди на 7 дней</span>
                  </span>
                  <span className="text-zinc-500 font-normal">
                    К повторению сегодня: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{data.dueTodayCount}</strong>
                  </span>
                </div>

                {/* Bar Graph */}
                <div className="grid grid-cols-7 gap-2 pt-2 items-end h-32">
                  {data.forecast7Days.map((f, i) => {
                    const heightPercent = Math.max(12, Math.round((f.count / maxForecastCount) * 100));
                    return (
                      <div key={i} className="flex flex-col items-center h-full justify-end group">
                        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1 group-hover:text-indigo-500 transition">
                          {f.count}
                        </span>
                        <div
                          className={`w-full rounded-lg transition-all duration-300 ${
                            f.isToday
                              ? "bg-indigo-600 dark:bg-indigo-500 shadow-md shadow-indigo-500/20"
                              : f.count > 0
                              ? "bg-indigo-300 dark:bg-indigo-800/80 hover:bg-indigo-400"
                              : "bg-zinc-200 dark:bg-zinc-700/60"
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                        <div className="text-center mt-2">
                          <div className={`text-[11px] font-medium ${f.isToday ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-zinc-600 dark:text-zinc-300"}`}>
                            {f.dayLabel}
                          </div>
                          <div className="text-[9px] text-zinc-400">
                            {f.dateStr}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* State Breakdown Progress */}
              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  <span>Распределение карточек ({data.totalCards})</span>
                  <span className="text-zinc-500 font-normal">
                    В процессе: {data.trackedCards}
                  </span>
                </div>

                {/* Multi-segmented bar */}
                <div className="w-full h-3 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden flex">
                  {data.totalCards > 0 && (
                    <>
                      <div
                        className="bg-blue-500 h-full"
                        style={{ width: `${(data.newCount / data.totalCards) * 100}%` }}
                        title={`Новые: ${data.newCount}`}
                      />
                      <div
                        className="bg-amber-500 h-full"
                        style={{ width: `${(data.learningCount / data.totalCards) * 100}%` }}
                        title={`Изучаются: ${data.learningCount}`}
                      />
                      <div
                        className="bg-emerald-500 h-full"
                        style={{ width: `${(data.reviewCount / data.totalCards) * 100}%` }}
                        title={`Закрепленные: ${data.reviewCount}`}
                      />
                      <div
                        className="bg-red-500 h-full"
                        style={{ width: `${(data.relearningCount / data.totalCards) * 100}%` }}
                        title={`Снова на повторении: ${data.relearningCount}`}
                      />
                    </>
                  )}
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-zinc-600 dark:text-zinc-400">Новые:</span>
                    <strong className="text-zinc-900 dark:text-white">{data.newCount}</strong>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-zinc-600 dark:text-zinc-400">В процессе:</span>
                    <strong className="text-zinc-900 dark:text-white">{data.learningCount}</strong>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-zinc-600 dark:text-zinc-400">Закреплены:</span>
                    <strong className="text-zinc-900 dark:text-white">{data.reviewCount}</strong>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                    <span className="text-zinc-600 dark:text-zinc-400">Ошибки:</span>
                    <strong className="text-zinc-900 dark:text-white">{data.relearningCount}</strong>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
