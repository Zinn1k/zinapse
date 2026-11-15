"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Image as ImageIcon,
  Volume2,
  Eye,
  Check,
} from "lucide-react";
import { db, type Card } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { compressImageToWebP } from "@/lib/image-compression";
import { speakText } from "@/lib/speech";
import { MarkdownMath } from "./MarkdownMath";

interface CardEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  deckId: string;
  cardToEdit?: Card | null;
  onSaved?: (cardId: string) => void;
}

export function CardEditorModal({
  isOpen,
  onClose,
  deckId,
  cardToEdit,
  onSaved,
}: CardEditorModalProps) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [hint, setHint] = useState("");
  const [frontImage, setFrontImage] = useState<string | undefined>(undefined);
  const [backImage, setBackImage] = useState<string | undefined>(undefined);
  const [frontLang, setFrontLang] = useState("en-US");
  const [backLang, setBackLang] = useState("en-US");
  const [showPreview, setShowPreview] = useState(false);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const frontFileRef = useRef<HTMLInputElement>(null);
  const backFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cardToEdit) {
      setFront(cardToEdit.term || cardToEdit.front || "");
      setBack(cardToEdit.definition || cardToEdit.back || "");
      setHint(cardToEdit.hint || "");
      setFrontImage(cardToEdit.imageData || cardToEdit.frontImage);
      setBackImage(cardToEdit.backImage);
      setFrontLang(cardToEdit.frontLang || "en-US");
      setBackLang(cardToEdit.backLang || "en-US");
    } else {
      setFront("");
      setBack("");
      setHint("");
      setFrontImage(undefined);
      setBackImage(undefined);
      setFrontLang("en-US");
      setBackLang("en-US");
    }
    setShowPreview(false);
    setCompressionInfo(null);
    setError(null);
  }, [cardToEdit, isOpen]);

  if (!isOpen) return null;

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    side: "front" | "back"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageCompressing(true);
    setCompressionInfo("Compressing to WebP (max ~40KB)...");

    try {
      const result = await compressImageToWebP(file, { maxSizeKB: 40 });
      if (side === "front") {
        setFrontImage(result.dataUrl);
      } else {
        setBackImage(result.dataUrl);
      }
      setCompressionInfo(`Compressed: ${result.sizeKB} KB (${result.width}x${result.height} WebP)`);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError("Failed to compress image: " + msg);
    } finally {
      setImageCompressing(false);
    }
  };

  const handleSave = async () => {
    if (!front.trim()) {
      setError("Please provide content for the Front side.");
      return;
    }
    if (!back.trim()) {
      setError("Please provide content for the Back side.");
      return;
    }

    const now = Date.now();
    const cardId = cardToEdit ? cardToEdit.id : generateId();

    if (cardToEdit) {
      await db.cards.update(cardId, {
        term: front.trim(),
        definition: back.trim(),
        front: front.trim(),
        back: back.trim(),
        hint: hint.trim() || undefined,
        imageData: frontImage,
        frontImage,
        backImage,
        frontLang,
        backLang,
        updatedAt: now,
      });
    } else {
      const maxOrderCard = await db.cards
        .where("deckId")
        .equals(deckId)
        .reverse()
        .sortBy("order");
      const nextOrder = (maxOrderCard[0]?.order ?? 0) + 1;

      const newCard: Card = {
        id: cardId,
        deckId,
        term: front.trim(),
        definition: back.trim(),
        front: front.trim(),
        back: back.trim(),
        hint: hint.trim() || undefined,
        imageData: frontImage,
        frontImage,
        backImage,
        frontLang,
        backLang,
        order: nextOrder,
        createdAt: now,
        updatedAt: now,
      };

      await db.cards.add(newCard);
    }

    if (onSaved) {
      onSaved(cardId);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            {cardToEdit ? "Edit Flashcard" : "Add Flashcard"}
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg border transition ${
                showPreview
                  ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
                  : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showPreview ? "Editor" : "Preview"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 text-sm rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          {compressionInfo && (
            <div className="p-2.5 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>{compressionInfo}</span>
            </div>
          )}

          {showPreview ? (
            /* Card Live Preview */
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500 mb-2 block">
                  Front Preview
                </span>
                <MarkdownMath content={front || "*(Empty front)*"} />
                {frontImage && (
                  <img
                    src={frontImage}
                    alt="Front"
                    className="mt-3 max-h-48 rounded-lg object-contain mx-auto"
                  />
                )}
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500 mb-2 block">
                  Back Preview
                </span>
                <MarkdownMath content={back || "*(Empty back)*"} />
                {backImage && (
                  <img
                    src={backImage}
                    alt="Back"
                    className="mt-3 max-h-48 rounded-lg object-contain mx-auto"
                  />
                )}
                {hint && (
                  <p className="mt-2 text-xs italic text-amber-600 dark:text-amber-400">
                    Hint: {hint}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Card Editor Form */
            <div className="space-y-4">
              {/* Front Side */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    FRONT (Term / Question / $LaTeX$) *
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => speakText(front, { lang: frontLang })}
                      className="p-1 text-zinc-400 hover:text-indigo-500"
                      title="Test Audio Pronunciation"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => frontFileRef.current?.click()}
                      className="text-xs text-indigo-500 hover:underline flex items-center space-x-1"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{frontImage ? "Change Image" : "Add Image"}</span>
                    </button>
                    <input
                      type="file"
                      ref={frontFileRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, "front")}
                    />
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  placeholder="e.g. What is the derivative of $\sin(x)$?"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                />

                {frontImage && (
                  <div className="relative inline-block mt-1">
                    <img
                      src={frontImage}
                      alt="Front preview"
                      className="h-16 w-16 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
                    />
                    <button
                      type="button"
                      onClick={() => setFrontImage(undefined)}
                      className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-500 text-white shadow"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Back Side */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    BACK (Answer / Definition / $$Math$$) *
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => speakText(back, { lang: backLang })}
                      className="p-1 text-zinc-400 hover:text-indigo-500"
                      title="Test Audio Pronunciation"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => backFileRef.current?.click()}
                      className="text-xs text-indigo-500 hover:underline flex items-center space-x-1"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{backImage ? "Change Image" : "Add Image"}</span>
                    </button>
                    <input
                      type="file"
                      ref={backFileRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, "back")}
                    />
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  placeholder="e.g. $$\frac{d}{dx}\sin(x) = \cos(x)$$"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                {backImage && (
                  <div className="relative inline-block mt-1">
                    <img
                      src={backImage}
                      alt="Back preview"
                      className="h-16 w-16 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
                    />
                    <button
                      type="button"
                      onClick={() => setBackImage(undefined)}
                      className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-500 text-white shadow"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Hint */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Optional Hint
                </label>
                <input
                  type="text"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="A clue to help recall..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Languages for TTS */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mb-0.5">
                    Front TTS Language
                  </span>
                  <select
                    value={frontLang}
                    onChange={(e) => setFrontLang(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  >
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Spanish (Spain)</option>
                    <option value="es-MX">Spanish (Mexico)</option>
                    <option value="fr-FR">French</option>
                    <option value="de-DE">German</option>
                    <option value="ja-JP">Japanese</option>
                    <option value="zh-CN">Chinese (Mandarin)</option>
                    <option value="ru-RU">Russian</option>
                  </select>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mb-0.5">
                    Back TTS Language
                  </span>
                  <select
                    value={backLang}
                    onChange={(e) => setBackLang(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  >
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Spanish (Spain)</option>
                    <option value="es-MX">Spanish (Mexico)</option>
                    <option value="fr-FR">French</option>
                    <option value="de-DE">German</option>
                    <option value="ja-JP">Japanese</option>
                    <option value="zh-CN">Chinese (Mandarin)</option>
                    <option value="ru-RU">Russian</option>
                  </select>
                </div>
              </div>
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
            disabled={imageCompressing}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition disabled:opacity-50"
          >
            {cardToEdit ? "Save Changes" : "Add Card"}
          </button>
        </div>
      </div>
    </div>
  );
}
