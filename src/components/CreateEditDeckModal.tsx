"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FolderPlus,
  Upload,
} from "lucide-react";
import { db, type Deck, type Card, GUEST_USER_ID } from "@/lib/db";
import { generateId, generateShareCode } from "@/lib/utils";

interface CreateEditDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  deckToEdit?: Deck | null;
  onSaved?: (deckId: string) => void;
}

export function CreateEditDeckModal({
  isOpen,
  onClose,
  userId,
  deckToEdit,
  onSaved,
}: CreateEditDeckModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [importMode, setImportMode] = useState(false);
  const [importText, setImportText] = useState("");
  const [termSeparator, setTermSeparator] = useState("\t"); // Tab by default (Quizlet format)
  const [cardSeparator, setCardSeparator] = useState("\n"); // New line
  const [parsedPreviewCount, setParsedPreviewCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (deckToEdit) {
      setTitle(deckToEdit.title);
      setDescription(deckToEdit.description || "");
      setTagsInput(deckToEdit.tags ? deckToEdit.tags.join(", ") : "");
    } else {
      setTitle("");
      setDescription("");
      setTagsInput("");
      setImportText("");
      setImportMode(false);
    }
    setError(null);
  }, [deckToEdit, isOpen]);

  useEffect(() => {
    if (!importText.trim()) {
      setParsedPreviewCount(0);
      return;
    }
    const lines = importText.split(cardSeparator).filter((line) => line.trim().length > 0);
    let valid = 0;
    for (const line of lines) {
      const parts = line.split(termSeparator);
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        valid++;
      }
    }
    setParsedPreviewCount(valid);
  }, [importText, termSeparator, cardSeparator]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Please provide a title for the deck.");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const now = Date.now();
    const deckId = deckToEdit ? deckToEdit.id : generateId();

    if (deckToEdit) {
      await db.decks.update(deckId, {
        title: title.trim(),
        description: description.trim(),
        tags,
        updatedAt: now,
      });
    } else {
      const newDeck: Deck = {
        id: deckId,
        ownerId: userId || GUEST_USER_ID,
        userId: userId || GUEST_USER_ID,
        title: title.trim(),
        description: description.trim(),
        tags,
        isPublic: true,
        shareCode: generateShareCode(),
        createdAt: now,
        updatedAt: now,
      };
      await db.decks.add(newDeck);
    }

    // Process Batch Import if text provided
    if (importMode && importText.trim()) {
      const lines = importText.split(cardSeparator).filter((l) => l.trim().length > 0);
      const newCards: Card[] = [];
      let order = 1;

      for (const line of lines) {
        const parts = line.split(termSeparator);
        if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
          const term = parts[0].trim();
          const definition = parts.slice(1).join(termSeparator).trim();
          newCards.push({
            id: generateId(),
            deckId,
            term,
            definition,
            front: term,
            back: definition,
            order: order++,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      if (newCards.length > 0) {
        await db.cards.bulkAdd(newCards);
      }
    }

    if (onSaved) {
      onSaved(deckId);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FolderPlus className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              {deckToEdit ? "Edit Deck" : "Create New Deck"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 text-sm rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Molecular Biology 101"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief summary of what this deck covers..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Biology, Cellular, ExamPrep"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Batch Import Toggle */}
          {!deckToEdit && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setImportMode(!importMode)}
                className="flex items-center space-x-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>
                  {importMode
                    ? "Hide Batch / Quizlet Import"
                    : "+ Import from Quizlet, Anki, or CSV"}
                </span>
              </button>

              {importMode && (
                <div className="mt-3 space-y-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                    <span>Paste exported cards:</span>
                    {parsedPreviewCount > 0 && (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {parsedPreviewCount} cards recognized
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={4}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={"Term 1\tDefinition 1\nTerm 2\tDefinition 2"}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="block text-zinc-500 dark:text-zinc-400 mb-0.5">
                        Between Term & Def:
                      </span>
                      <select
                        value={termSeparator}
                        onChange={(e) => setTermSeparator(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      >
                        <option value="	">Tab (Quizlet default)</option>
                        <option value=",">Comma (,)</option>
                        <option value=" - ">Dash ( - )</option>
                        <option value=";">Semicolon (;)</option>
                      </select>
                    </div>
                    <div>
                      <span className="block text-zinc-500 dark:text-zinc-400 mb-0.5">
                        Between Rows:
                      </span>
                      <select
                        value={cardSeparator}
                        onChange={(e) => setCardSeparator(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      >
                        <option value="
">New Line (Standard)</option>
                        <option value="
">Double Line</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
          >
            {deckToEdit ? "Save Changes" : "Create Deck"}
          </button>
        </div>
      </div>
    </div>
  );
}
