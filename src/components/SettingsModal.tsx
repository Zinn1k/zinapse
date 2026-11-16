"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Key,
  Sliders,
  Volume2,
  Database,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Download,
  Upload,
} from "lucide-react";
import {
  db,
  seedSampleDataIfEmpty,
  exportDatabaseToJSON,
  importDatabaseFromJSON,
} from "@/lib/db";
import { getAvailableVoices, speakText } from "@/lib/speech";
import { isFirebaseConfigured } from "@/lib/firebase";
import { checkForAppUpdates, APP_CURRENT_VERSION } from "@/lib/updater";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function SettingsModal({ isOpen, onClose, userId }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [retention, setRetention] = useState(0.9);
  const [voiceName, setVoiceName] = useState("");
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [stats, setStats] = useState({ decks: 0, cards: 0, fsrs: 0 });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Load voices
    getAvailableVoices().then((v) => setVoices(v));

    // Load settings from Dexie
    db.settings.get("current").then((setting) => {
      if (setting) {
        setApiKey(setting.geminiApiKey || "");
        setRetention(setting.requestRetention ?? 0.9);
        setVoiceName(setting.voiceName || "");
        setVoiceSpeed(setting.voiceSpeed ?? 1.0);
      }
    });

    // Load stats
    Promise.all([
      db.decks.count(),
      db.cards.count(),
      db.fsrs_states.count(),
    ]).then(([d, c, f]) => {
      setStats({ decks: d, cards: c, fsrs: f });
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await db.settings.put({
      id: "current",
      userId,
      geminiApiKey: apiKey.trim(),
      requestRetention: retention,
      theme: "dark",
      voiceName,
      voiceSpeed,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleTestTTS = () => {
    speakText("Привет! Это проверка синтеза речи для интервальных повторений.", {
      voiceName,
      rate: voiceSpeed,
    });
  };

  const handleReSeed = async () => {
    if (confirm("Восстановить демонстрационные колоды (Формулы и Испанский разговорник)?")) {
      await seedSampleDataIfEmpty();
      const [d, c, f] = await Promise.all([
        db.decks.count(),
        db.cards.count(),
        db.fsrs_states.count(),
      ]);
      setStats({ decks: d, cards: c, fsrs: f });
      alert("Демонстрационные колоды восстановлены!");
    }
  };

  const handleExportBackup = async () => {
    try {
      const json = await exportDatabaseToJSON();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zinapse-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert("Ошибка при экспорте резервной копии: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const result = await importDatabaseFromJSON(text);
        const [d, c, f] = await Promise.all([
          db.decks.count(),
          db.cards.count(),
          db.fsrs_states.count(),
        ]);
        setStats({ decks: d, cards: c, fsrs: f });
        alert(`Резервная копия успешно восстановлена!\nКолод: ${result.decksCount}, Карточек: ${result.cardsCount}`);
      } catch (err: unknown) {
        alert("Ошибка при импорте резервной копии: " + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCheckUpdatesManually = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus("Проверка обновлений...");
    try {
      const info = await checkForAppUpdates();
      if (info && info.hasUpdate) {
        setUpdateStatus(`Доступна новая версия v${info.latestVersion}! Скачивание начнётся при клике.`);
        if (confirm(`Найдена новая версия v${info.latestVersion}!\n\nОткрыть страницу релиза и скачать APK?`)) {
          window.open(info.downloadUrl, "_blank");
        }
      } else {
        setUpdateStatus(`У вас установлена актуальная версия Zinapse (v${APP_CURRENT_VERSION}).`);
      }
    } catch {
      setUpdateStatus("Не удалось проверить обновления. Проверьте интернет-соединение.");
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Настройки</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* FSRS Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                <span>Целевой уровень удержания FSRS</span>
              </label>
              <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {Math.round(retention * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.80"
              max="0.97"
              step="0.01"
              value={retention}
              onChange={(e) => setRetention(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Алгоритм FSRS оптимизирует интервалы повторений для гарантии данного уровня удержания памяти. Рекомендуется: 88% – 92%.
            </p>
          </div>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* AI Settings */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <Key className="w-4 h-4 text-amber-500" />
              <span>API-ключ Google Gemini</span>
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Используется для генерации карточек с помощью AI SDK. Надёжно хранится локально в IndexedDB вашего браузера.
            </p>
          </div>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Audio TTS Settings */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-emerald-500" />
              <span>Синтез речи (Native Web Speech API)</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">
                  Голос по умолчанию
                </span>
                <select
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">По умолчанию браузера</option>
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Скорость</span>
                  <span className="text-xs font-mono">{voiceSpeed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.5"
                  step="0.05"
                  value={voiceSpeed}
                  onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestTTS}
              className="text-xs px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition"
            >
              Проверить произношение
            </button>
          </div>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Database & Cloud status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                <Database className="w-4 h-4 text-blue-500" />
                <span>Локальная база данных (Dexie IndexedDB)</span>
              </span>
              <button
                onClick={handleReSeed}
                className="text-xs text-indigo-500 hover:underline flex items-center space-x-1"
                title="Восстановить демонстрационные колоды"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Восстановить примеры</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
                <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.decks}</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Колоды</div>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
                <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.cards}</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Карточки</div>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
                <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.fsrs}</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Состояния FSRS</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition"
              >
                <Download className="w-3.5 h-3.5 text-indigo-500" />
                <span>Экспорт базы (JSON)</span>
              </button>

              <label className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 cursor-pointer transition">
                <Upload className="w-3.5 h-3.5 text-emerald-500" />
                <span>Импорт базы (JSON)</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleImportBackup}
                />
              </label>
            </div>

            <div className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
              {isFirebaseConfigured() ? (
                <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Облачная синхронизация Cloud Firestore активна</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-zinc-500">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Облачная синхронизация отключена (работа 100% офлайн локально)</span>
                </div>
              )}
            </div>
          </div>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* App Version & Updates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
                  Версия приложения
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Zinapse v{APP_CURRENT_VERSION} (Android / Web)
                </span>
              </div>
              <button
                type="button"
                onClick={handleCheckUpdatesManually}
                disabled={isCheckingUpdate}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium transition disabled:opacity-50"
              >
                {isCheckingUpdate ? "Проверка..." : "Проверить обновления"}
              </button>
            </div>
            {updateStatus && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium pt-1">
                {updateStatus}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end space-x-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
          >
            {savedSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>Сохранено!</span>
              </>
            ) : (
              <span>Сохранить изменения</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
