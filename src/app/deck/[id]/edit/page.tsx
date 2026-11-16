"use client";

import React, { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Image as ImageIcon,
  Save,
  Share2,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  X,
} from "lucide-react";
import { db, type Deck, type Card, GUEST_USER_ID } from "@/lib/db";
import { generateId, generateShareCode } from "@/lib/utils";
import { scheduleSync } from "@/lib/sync";
import { compressImageToWebP } from "@/lib/image-compression";
import { previewImport, type ImportPreview } from "@/lib/importer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface EditCardItem {
  id: string;
  term: string;
  definition: string;
  hint?: string;
  imageData?: string;
  order: number;
}

export default function EditDeckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const deckId = resolvedParams.id;
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [shareCode, setShareCode] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [cards, setCards] = useState<EditCardItem[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRawText, setImportRawText] = useState("");
  const [importPreviewData, setImportPreviewData] = useState<ImportPreview | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [copiedShareCode, setCopiedShareCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Load deck and cards from Dexie
  useEffect(() => {
    async function loadData() {
      const existingDeck = await db.decks.get(deckId);
      if (existingDeck) {
        setDeck(existingDeck);
        setTitle(existingDeck.title);
        setDescription(existingDeck.description || "");
        setIsPublic(existingDeck.isPublic ?? true);
        setShareCode(existingDeck.shareCode || generateShareCode());
        setTagsInput(existingDeck.tags ? existingDeck.tags.join(", ") : "");

        const existingCards = await db.cards
          .where("deckId")
          .equals(deckId)
          .sortBy("order");

        if (existingCards.length > 0) {
          setCards(
            existingCards.map((c, i) => ({
              id: c.id,
              term: c.term || c.front || "",
              definition: c.definition || c.back || "",
              hint: c.hint,
              imageData: c.imageData || c.frontImage,
              order: i + 1,
            }))
          );
        } else {
          // Add 3 default blank cards
          setCards([
            { id: generateId(), term: "", definition: "", order: 1 },
            { id: generateId(), term: "", definition: "", order: 2 },
            { id: generateId(), term: "", definition: "", order: 3 },
          ]);
        }
      } else {
        // Creating a new deck at this id
        const newCode = generateShareCode();
        setShareCode(newCode);
        setCards([
          { id: generateId(), term: "", definition: "", order: 1 },
          { id: generateId(), term: "", definition: "", order: 2 },
          { id: generateId(), term: "", definition: "", order: 3 },
        ]);
      }
    }

    loadData();
  }, [deckId]);

  // Update import preview on typing
  useEffect(() => {
    if (!importRawText.trim()) {
      setImportPreviewData(null);
      return;
    }
    const preview = previewImport(importRawText);
    setImportPreviewData(preview);
  }, [importRawText]);

  // Card modifications
  const handleCardChange = (
    id: string,
    field: "term" | "definition" | "hint",
    value: string
  ) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleAddCard = () => {
    const newCard: EditCardItem = {
      id: generateId(),
      term: "",
      definition: "",
      order: cards.length + 1,
    };
    setCards((prev) => [...prev, newCard]);
  };

  const handleDeleteCard = (id: string) => {
    if (cards.length <= 1) {
      alert("Колода должна содержать как минимум одну карточку.");
      return;
    }
    setCards((prev) =>
      prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i + 1 }))
    );
  };

  const handleMoveCard = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === cards.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const reordered = [...cards];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    setCards(reordered.map((c, i) => ({ ...c, order: i + 1 })));
  };

  // Image Upload with Client-Side Canvas WebP Compression (maxWidth: 800px, quality: 0.7)
  const handleImageUpload = async (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await compressImageToWebP(file, {
        maxWidth: 800,
        maxHeight: 800,
        initialQuality: 0.7,
        maxSizeKB: 40,
      });

      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, imageData: result.dataUrl } : c))
      );
    } catch (err: unknown) {
      console.error(err);
      alert("Не удалось сжать изображение в WebP.");
    }
  };

  // 1-Click Import Cards
  const handleApplyImport = () => {
    if (!importPreviewData || importPreviewData.cards.length === 0) {
      alert("В тексте не найдено подходящих карточек.");
      return;
    }

    const newCards: EditCardItem[] = importPreviewData.cards.map((p, i) => ({
      id: generateId(),
      term: p.term,
      definition: p.definition,
      hint: p.hint,
      order: cards.length + i + 1,
    }));

    // If existing cards only contain 3 empty default cards, replace them
    const isOnlyEmptyDefaults =
      cards.length === 3 && cards.every((c) => !c.term.trim() && !c.definition.trim());

    if (isOnlyEmptyDefaults) {
      setCards(newCards.map((c, i) => ({ ...c, order: i + 1 })));
    } else {
      setCards((prev) => [...prev, ...newCards]);
    }

    setIsImportModalOpen(false);
    setImportRawText("");
  };

  // Save Deck to Dexie
  const handleSaveDeck = async () => {
    if (!title.trim()) {
      setErrorMessage("Пожалуйста, укажите название колоды.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const validCards = cards.filter(
      (c) => c.term.trim() || c.definition.trim() || c.imageData
    );

    if (validCards.length === 0) {
      setErrorMessage("Пожалуйста, добавьте хотя бы одну карточку с термином или определением.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const now = Date.now();
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const deckData: Deck = {
      id: deckId,
      ownerId: deck?.ownerId || GUEST_USER_ID,
      title: title.trim(),
      description: description.trim(),
      isPublic,
      shareCode: shareCode || generateShareCode(),
      tags,
      createdAt: deck?.createdAt || now,
      updatedAt: now,
    };

    const cardsData: Card[] = validCards.map((c, i) => ({
      id: c.id,
      deckId,
      term: c.term.trim(),
      definition: c.definition.trim(),
      hint: c.hint?.trim() || undefined,
      imageData: c.imageData,
      order: i + 1,
      createdAt: now,
      updatedAt: now,
      // For backwards compatibility:
      front: c.term.trim(),
      back: c.definition.trim(),
      frontImage: c.imageData,
    }));

    await db.transaction("rw", [db.decks, db.cards, db.sync_queue], async () => {
      await db.decks.put(deckData);
      await db.sync_queue.put({
        id: `deck_${deckData.id}`,
        collection: "decks",
        docId: deckData.id,
        action: "upsert",
        payload: deckData,
        timestamp: now,
        attempts: 0,
      });

      // Replace deck cards
      await db.cards.where("deckId").equals(deckId).delete();
      await db.cards.bulkPut(cardsData);

      for (const card of cardsData) {
        await db.sync_queue.put({
          id: `card_${card.id}`,
          collection: "cards",
          docId: card.id,
          action: "upsert",
          payload: card,
          timestamp: now,
          attempts: 0,
        });
      }
    });

    if (deckData.ownerId && deckData.ownerId !== GUEST_USER_ID) {
      scheduleSync(deckData.ownerId);
    }

    setIsSaving(false);
    router.push("/");
  };

  const copyShareCodeToClipboard = () => {
    navigator.clipboard.writeText(shareCode);
    setCopiedShareCode(true);
    setTimeout(() => setCopiedShareCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад к колодам</span>
          </Link>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="text-xs"
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              <span>Импорт Quizlet / CSV</span>
            </Button>

            <Button
              size="sm"
              onClick={handleSaveDeck}
              disabled={isSaving}
              className="text-xs"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              <span>{isSaving ? "Сохранение..." : "Сохранить"}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-sm flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Deck Metadata Header */}
        <UICard className="shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Название колоды *
                </label>
                <Input
                  type="text"
                  placeholder="Например: Медицинская терминология: Нервная система"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-base font-semibold"
                  autoFocus
                />
              </div>

              <div className="flex items-center space-x-4 shrink-0 pt-2 sm:pt-4">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-zinc-500">Публичная</span>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>

                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <Share2 className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-xs font-mono font-bold">{shareCode}</span>
                  <button
                    type="button"
                    onClick={copyShareCodeToClipboard}
                    className="p-1 hover:text-indigo-500"
                    title="Скопировать код доступа"
                  >
                    {copiedShareCode ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3 text-zinc-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Описание
              </label>
              <Textarea
                rows={2}
                placeholder="О чем эта колода?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Теги (через запятую)
              </label>
              <Input
                type="text"
                placeholder="Медицина, Анатомия, Экзамен"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
          </CardContent>
        </UICard>

        {/* Card Rows List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              Карточки ({cards.length})
            </h2>
            <span className="text-xs text-zinc-500">
              Используйте <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-[10px]">Tab</kbd> для переключения между полями
            </span>
          </div>

          <div className="space-y-4">
            {cards.map((card, index) => (
              <UICard key={card.id} className="relative group overflow-hidden border-zinc-200 dark:border-zinc-800">
                <CardContent className="p-5 space-y-4">
                  {/* Row Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      #{index + 1}
                    </span>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleMoveCard(index, "up")}
                        disabled={index === 0}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20"
                        title="Переместить вверх"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveCard(index, "down")}
                        disabled={index === cards.length - 1}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20"
                        title="Переместить вниз"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCard(card.id)}
                        className="p-1 rounded text-zinc-400 hover:text-red-500 transition"
                        title="Удалить карточку"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Term and Definition Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Term Input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">
                          Термин *
                        </label>
                      </div>
                      <Input
                        value={card.term}
                        onChange={(e) => handleCardChange(card.id, "term", e.target.value)}
                        placeholder="Введите термин или вопрос..."
                        className="font-medium"
                      />
                    </div>

                    {/* Definition Input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">
                          Определение *
                        </label>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[card.id]?.click()}
                            className="text-[11px] text-indigo-500 hover:underline flex items-center space-x-1"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>{card.imageData ? "Заменить картинку" : "Добавить картинку"}</span>
                          </button>
                          <input
                            type="file"
                            ref={(el) => {
                              fileInputRefs.current[card.id] = el;
                            }}
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload(card.id, e)}
                          />
                        </div>
                      </div>
                      <Textarea
                        rows={2}
                        value={card.definition}
                        onChange={(e) => handleCardChange(card.id, "definition", e.target.value)}
                        placeholder="Введите определение или ответ..."
                      />
                    </div>
                  </div>

                  {/* Image Thumbnail & Hint */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                    <div className="flex-1 w-full max-w-sm">
                      <Input
                        value={card.hint || ""}
                        onChange={(e) => handleCardChange(card.id, "hint", e.target.value)}
                        placeholder="Подсказка или мнемоника (необязательно)..."
                        className="text-xs h-8"
                      />
                    </div>

                    {card.imageData && (
                      <div className="relative inline-flex items-center space-x-2 p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
                        <img
                          src={card.imageData}
                          alt="Прикрепленное изображение"
                          className="h-10 w-10 object-cover rounded"
                        />
                        <span className="text-[10px] text-zinc-500">Изображение WebP</span>
                        <button
                          type="button"
                          onClick={() =>
                            setCards((prev) =>
                              prev.map((c) =>
                                c.id === card.id ? { ...c, imageData: undefined } : c
                              )
                            )
                          }
                          className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </UICard>
            ))}
          </div>

          {/* Add Card & Actions Bar */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddCard}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Добавить карточку</span>
            </Button>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                onClick={() => setIsImportModalOpen(true)}
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                <span>Пакетный импорт</span>
              </Button>

              <Button onClick={handleSaveDeck} disabled={isSaving}>
                <Save className="w-4 h-4 mr-1.5" />
                <span>Сохранить колоду</span>
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* 1-Click Batch Import Dialog */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-indigo-500" />
              <span>Быстрый импорт из Quizlet, Excel или CSV</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-2">
            <p className="text-xs text-zinc-500">
              Вставьте ваши термины и определения ниже. Поддерживается экспорт из Quizlet (с табуляцией), точки с запятой, дефисы (<code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800"> - </code>) или CSV.
            </p>

            <Textarea
              rows={6}
              value={importRawText}
              onChange={(e) => setImportRawText(e.target.value)}
              placeholder={"Клетка\tОсновная структурно-функциональная единица жизни\nДНК\tДезоксирибонуклеиновая кислота\nМитохондрия\tЭнергетическая станция клетки"}
              className="font-mono text-xs"
            />

            {importPreviewData && (
              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>
                    Распознано: {importPreviewData.validCount} карточек
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    Разделитель: {importPreviewData.detectedTermSeparator === "\t" ? "Табуляция" : `"${importPreviewData.detectedTermSeparator}"`}
                  </Badge>
                </div>

                <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
                  {importPreviewData.cards.slice(0, 15).map((pc, idx) => (
                    <div key={idx} className="p-2.5 flex items-start space-x-3 bg-white dark:bg-zinc-900">
                      <span className="font-mono text-zinc-400 text-[10px] w-6 shrink-0 pt-0.5">
                        #{idx + 1}
                      </span>
                      <div className="font-bold text-zinc-900 dark:text-zinc-100 w-1/3 truncate">
                        {pc.term}
                      </div>
                      <div className="text-zinc-600 dark:text-zinc-400 flex-1 truncate">
                        {pc.definition}
                      </div>
                    </div>
                  ))}
                  {importPreviewData.cards.length > 15 && (
                    <div className="p-2 text-center text-zinc-400 text-[11px] bg-zinc-50 dark:bg-zinc-900">
                      ...и еще {importPreviewData.cards.length - 15} карточек
                    </div>
                  )}
                </div>

                {importPreviewData.invalidLines.length > 0 && (
                  <p className="text-[11px] text-amber-500">
                    Пропущено {importPreviewData.invalidLines.length} нераспознанных строк.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button variant="ghost" onClick={() => setIsImportModalOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleApplyImport}
              disabled={!importPreviewData || importPreviewData.validCount === 0}
            >
              Добавить {importPreviewData?.validCount ?? 0} карточек
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
