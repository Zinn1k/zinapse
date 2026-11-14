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
} from "lucide-react";
import { db, seedSampleDataIfEmpty } from "@/lib/db";
import { getAvailableVoices, speakText } from "@/lib/speech";
import { isFirebaseConfigured } from "@/lib/firebase";

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
    speakText("Hello! This is a test of your spaced repetition text-to-speech audio.", {
      voiceName,
      rate: voiceSpeed,
    });
  };

  const handleReSeed = async () => {
    if (confirm("Restore sample decks (Formulas & Spanish Travel)?")) {
      await seedSampleDataIfEmpty();
      const [d, c, f] = await Promise.all([
        db.decks.count(),
        db.cards.count(),
        db.fsrs_states.count(),
      ]);
      setStats({ decks: d, cards: c, fsrs: f });
      alert("Sample decks verified/restored!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Settings</h2>
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
                <span>FSRS Target Retention Rate</span>
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
              Free Spaced Repetition Scheduler (FSRS) optimizes interval spacing to guarantee this retention rate. Recommended: 88% - 92%.
            </p>
          </div>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* AI Settings */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <Key className="w-4 h-4 text-amber-500" />
              <span>Google Gemini API Key</span>
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Used for client-side or server flashcard generation with the `@google/genai` SDK. Stored securely in your browser&apos;s local Dexie database.
            </p>
          </div>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Audio TTS Settings */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-emerald-500" />
              <span>Text-To-Speech (Native Web Speech API)</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">
                  Default Voice
                </span>
                <select
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Browser Default</option>
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Speed</span>
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
              Test Voice Pronunciation
            </button>
          </div>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Database & Cloud status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                <Database className="w-4 h-4 text-blue-500" />
                <span>Local Database (Dexie IndexedDB)</span>
              </span>
              <button
                onClick={handleReSeed}
                className="text-xs text-indigo-500 hover:underline flex items-center space-x-1"
                title="Restore default starter decks"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restore Samples</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
                <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.decks}</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Decks</div>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
                <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.cards}</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Cards</div>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
                <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.fsrs}</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">FSRS States</div>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
              {isFirebaseConfigured() ? (
                <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Cloud Firestore Sync Configured (Spark Plan)</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-zinc-500">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Cloud Sync inactive (Running 100% offline local-first)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end space-x-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
          >
            {savedSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
