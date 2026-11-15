"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Upload,
  FileText,
  Key,
  RotateCcw,
  Check,
  Trash2,
  Plus,
  AlertCircle,
  Loader2,
  Eye,
  Edit3,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import confetti from "canvas-confetti";
import { db, type Deck, type Card as DbCard, GUEST_USER_ID } from "@/lib/db";
import { generateId, generateShareCode } from "@/lib/utils";
import { hasCloze, renderClozeQuestion, renderClozeAnswer } from "@/lib/cloze";
import { MarkdownMath } from "@/components/MarkdownMath";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PreviewCard {
  id: string;
  term: string;
  definition: string;
  hint: string;
  isSelected: boolean;
}

export default function CreateWithAIPage() {
  const router = useRouter();

  // Input text & file
  const [sourceText, setSourceText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Settings
  const [cardCount, setCardCount] = useState<number>(10);
  const [style, setStyle] = useState<"term-definition" | "exam-qa" | "concept-summary" | "cloze">("term-definition");
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [language, setLanguage] = useState<"auto" | "ru" | "en">("auto");

  // API Key override (saved to localStorage)
  const [userApiKey, setUserApiKey] = useState("");
  const [showKeyField, setShowKeyField] = useState(false);

  // Generation status
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Preview & Results
  const [deckTitle, setDeckTitle] = useState("");
  const [deckDescription, setDeckDescription] = useState("");
  const [previewCards, setPreviewCards] = useState<PreviewCard[]>([]);
  const [isRenderMode, setIsRenderMode] = useState<Record<string, boolean>>({});

  // Load saved API key from localStorage
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem("gemini_user_api_key");
      if (savedKey) {
        setUserApiKey(savedKey);
      }
    } catch {
      // ignore
    }
  }, []);

  // Save API key to localStorage when updated
  const handleSaveApiKey = (key: string) => {
    setUserApiKey(key);
    try {
      if (key.trim()) {
        localStorage.setItem("gemini_user_api_key", key.trim());
      } else {
        localStorage.removeItem("gemini_user_api_key");
      }
    } catch {
      // ignore
    }
  };

  // Rotating loading messages
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % 4);
    }, 2800);
    return () => clearInterval(interval);
  }, [isLoading]);

  const loadingMessages = selectedImage
    ? [
        "Gemini Vision распознает рукописный и печатный текст конспекта (OCR)...",
        "Извлечение ключевых формул, определений и терминов с изображения...",
        "Форматирование математических формул в LaTeX ($...$, $$...$$)...",
        "Синтез структурированных карточек для интервального повторения FSRS...",
      ]
    : [
        "Gemini анализирует предоставленный конспект...",
        "Выделение ключевых тезисов и определений...",
        "Форматирование математических формул в LaTeX...",
        "Формирование структурированных карточек для FSRS...",
      ];

  // Image upload handling for Multimodal Vision OCR
  const handleImageUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Пожалуйста, загрузите изображение (PNG, JPG, WebP).");
      return;
    }
    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setSelectedImage(result);
        const suggestedTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        if (!deckTitle) {
          setDeckTitle(suggestedTitle);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // File drop & upload handling
  const handleFileUpload = (file: File) => {
    if (!file) return;
    if (file.type.startsWith("image/")) {
      handleImageUpload(file);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setSourceText(content);
        const suggestedTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        if (!deckTitle) {
          setDeckTitle(suggestedTitle);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Presets for quick testing
  const loadPreset = (type: "physics" | "biology" | "english") => {
    if (type === "physics") {
      setDeckTitle("Квантовая физика и механика");
      setSourceText(`Квантовая суперпозиция — принцип, согласно которому система может находиться в линейной комбинации двух или более чистых состояний одновременно до момента измерения.
Уравнение Шрёдингера описывает изменение во времени чистого состояния квантовой системы: $i\\hbar \\frac{\\partial}{\\partial t} |\\psi\\rangle = \\hat{H} |\\psi\\rangle$.
Фотоэлектрический эффект — испускание электронов веществом под действием света. Уравнение Эйнштейна: $h\\nu = A_{вых} + \\frac{m v^2}{2}$.
Постоянная Планка $h = 6.626 \\times 10^{-34}$ Дж·с — фундаментальная квантовая постоянная, связывающая энергию кванта с частотой излучения $E = h\\nu$.
Квантовая запутанность — явление, при котором квантовые состояния двух или более объектов оказываются взаимозависимыми независимо от расстояния между ними.
Принцип неопределённости Гейзенберга: $\\Delta x \\cdot \\Delta p \\ge \\frac{\\hbar}{2}$. Невозможно одновременно точно измерить координату и импульс частицы.`);
    } else if (type === "biology") {
      setDeckTitle("Цитология: Строение клетки");
      setSourceText(`Митохондрии — двумембранные органеллы, «энергетические станции клетки», где происходит клеточное дыхание и синтез молекул АТФ (аденозинтрифосфата).
Рибосомы — немембранные органоиды, состоящие из рРНК и белков, осуществляющие трансляцию (биосинтез полипептидных цепей из аминокислот).
Аппарат Гольджи — система уплощенных цистерн, модифицирующая, сортирующая и упаковывающая белки и липиды для секреции или лизосом.
Клеточная мембрана (плазмалемма) — билипидный слой с интегральными и периферическими белками, обеспечивающий избирательную проницаемость и рецепцию.
Лизосомы — мембранные пузырьки, содержащие гидролитические ферменты для расщепления биополимеров и аутофагии.`);
    } else if (type === "english") {
      setDeckTitle("Essential English Idioms");
      setSourceText(`Break the ice — to do or say something to make people feel more relaxed and comfortable in a social setting. Example: He told a funny story to break the ice.
Hit the books — to study intensely, especially before an exam. Example: I need to hit the books tonight for my finals tomorrow.
Piece of cake — something that is very easy and simple to accomplish. Example: The driving test was a piece of cake.
Bite the bullet — to force yourself to face a difficult situation with courage. Example: You just have to bite the bullet and apologize.
Burn the midnight oil — to work or study late into the night. Example: She burned the midnight oil preparing the thesis.`);
    }
  };

  // Trigger AI generation
  const handleGenerate = async () => {
    if ((!sourceText.trim() || sourceText.trim().length < 10) && !selectedImage) {
      setError("Пожалуйста, вставьте текст (не менее 10 символов) или прикрепите фото конспекта.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceText.trim() || undefined,
          image: selectedImage || undefined,
          count: cardCount,
          style,
          difficulty,
          language,
          userApiKey: userApiKey.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ошибка при генерации карточек.");
      }

      setDeckTitle(data.title || deckTitle || "Новая колода");
      setDeckDescription(data.description || "");

      interface ReturnedCard {
        term: string;
        definition: string;
        hint?: string;
      }

      const generated: PreviewCard[] = (data.cards as ReturnedCard[]).map((c) => ({
        id: crypto.randomUUID(),
        term: c.term,
        definition: c.definition,
        hint: c.hint || "",
        isSelected: true,
      }));

      setPreviewCards(generated);
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Не удалось сгенерировать карточки."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Update card in preview
  const handleUpdateCard = (id: string, field: "term" | "definition" | "hint", value: string) => {
    setPreviewCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleToggleSelectCard = (id: string) => {
    setPreviewCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isSelected: !c.isSelected } : c))
    );
  };

  const handleDeleteCard = (id: string) => {
    setPreviewCards((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddNewCard = () => {
    const newCard: PreviewCard = {
      id: crypto.randomUUID(),
      term: "",
      definition: "",
      hint: "",
      isSelected: true,
    };
    setPreviewCards((prev) => [...prev, newCard]);
  };

  // Save finalized deck to Dexie.js
  const handleSaveToDatabase = async () => {
    const selected = previewCards.filter((c) => c.isSelected && c.term.trim() && c.definition.trim());

    if (selected.length === 0) {
      setError("Необходимо выбрать и заполнить хотя бы одну карточку для сохранения.");
      return;
    }

    const newDeckId = generateId();
    const now = Date.now();

    const newDeck: Deck = {
      id: newDeckId,
      ownerId: GUEST_USER_ID,
      title: deckTitle.trim() || "Колода от Gemini AI",
      description: deckDescription.trim(),
      isPublic: false,
      shareCode: generateShareCode(),
      createdAt: now,
      updatedAt: now,
      tags: ["AI-генерация"],
    };

    const cardsToInsert: DbCard[] = selected.map((c, index) => ({
      id: generateId(),
      deckId: newDeckId,
      term: c.term.trim(),
      definition: c.definition.trim(),
      hint: c.hint.trim() || undefined,
      tags: [],
      order: index,
      createdAt: now,
      updatedAt: now,
    }));

    try {
      await db.decks.add(newDeck);
      await db.cards.bulkAdd(cardsToInsert);

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });

      router.push(`/deck/${newDeckId}`);
    } catch (saveErr) {
      console.error("Dexie Save Error:", saveErr);
      setError("Не удалось сохранить колоду в локальную базу данных.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/" aria-label="На главную">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h1 className="font-bold text-sm sm:text-base leading-none">
                AI-Генерация колоды
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Google Gemini 2.5 Flash
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowKeyField(!showKeyField)}
          className="text-xs gap-1.5"
        >
          <Key className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{userApiKey ? "Ключ установлен" : "Свой API-ключ"}</span>
          {showKeyField ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </Button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* API Key Drawer/Section */}
        {showKeyField && (
          <Card className="border-primary/30 bg-primary/5 shadow-sm">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" />
                  Персональный Google Gemini API Key
                </span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-normal"
                >
                  Получить бесплатный ключ
                  <ExternalLink className="w-3 h-3" />
                </a>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Если на сервере не настроен <code>GEMINI_API_KEY</code>, вы можете указать свой личный ключ из Google AI Studio. Он сохраняется исключительно в вашем браузере.
              </p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="AIzaSy..."
                  value={userApiKey}
                  onChange={(e) => handleSaveApiKey(e.target.value)}
                  className="text-xs font-mono"
                />
                {userApiKey && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSaveApiKey("")}
                    className="text-xs"
                  >
                    Очистить
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold mb-0.5">Ошибка при генерации</div>
              <p className="text-xs sm:text-sm leading-relaxed">{error}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="text-xs h-7 text-destructive hover:bg-destructive/20"
            >
              Закрыть
            </Button>
          </div>
        )}

        {/* STAGE 1: INPUT & SETTINGS (When no preview cards yet) */}
        {previewCards.length === 0 ? (
          <div className="space-y-6">
            {/* File Drag-and-Drop Area & Text Input */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Исходный материал (конспект, лекция, билеты)
                  </CardTitle>

                  {/* Sample Presets */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <span className="text-xs text-muted-foreground mr-1">Примеры:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => loadPreset("physics")}
                    >
                      Физика
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => loadPreset("biology")}
                    >
                      Биология
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => loadPreset("english")}
                    >
                      Идиомы
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* File Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.markdown,.csv,.json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <Upload className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground" />
                  <div className="text-xs sm:text-sm font-medium">
                    {fileName ? (
                      <span className="text-primary font-semibold">
                        Файл загружен: {fileName}
                      </span>
                    ) : (
                      "Перетащите файл .txt или .md, либо нажмите для выбора"
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Поддерживаются текстовые файлы любого объема
                  </p>
                </div>

                {/* Multimodal Vision OCR Image Upload */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-primary" />
                      Фото/скан конспекта, доски или учебника (Vision OCR)
                    </label>
                    {selectedImage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedImage(null);
                          setImageFileName(null);
                        }}
                        className="h-6 text-xs text-destructive hover:bg-destructive/10 px-1.5"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Удалить фото
                      </Button>
                    )}
                  </div>

                  {selectedImage ? (
                    <div className="relative border rounded-xl p-3 bg-muted/20 flex items-center gap-3">
                      <img
                        src={selectedImage}
                        alt="Конспект OCR"
                        className="w-16 h-16 object-cover rounded-lg border shadow-xs"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate text-foreground">
                          {imageFileName || "Изображение для распознавания"}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Gemini Vision распознает рукописный текст, формулы и графики
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => imageInputRef.current?.click()}
                        className="text-xs h-8"
                      >
                        Заменить
                      </Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => imageInputRef.current?.click()}
                      className="border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 rounded-xl p-3 text-center cursor-pointer transition flex items-center justify-center gap-2"
                    >
                      <ImageIcon className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium">
                        Прикрепить фото рукописного конспекта, формул или страницы (OCR)
                      </span>
                    </div>
                  )}

                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImageUpload(e.target.files[0]);
                      }
                    }}
                  />
                </div>

                {/* Textarea for raw text */}
                <div className="space-y-1.5">
                  <Textarea
                    placeholder="Или просто вставьте сюда текст статьи, параграфа учебника, вопросы к зачету..."
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    rows={8}
                    className="text-sm font-sans resize-y"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>
                      Символов: {sourceText.length} • Слов:{" "}
                      {sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0}
                    </span>
                    {sourceText.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSourceText("");
                          setFileName(null);
                        }}
                        className="text-xs hover:text-foreground text-muted-foreground underline"
                      >
                        Очистить
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Generation Parameters */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-primary" />
                  Настройки карточек
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Format / Style */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                    Формат карточек
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {[
                      {
                        key: "term-definition" as const,
                        label: "Термин — Определение",
                        desc: "Классические термины и понятия",
                      },
                      {
                        key: "exam-qa" as const,
                        label: "Вопрос экзамена — Ответ",
                        desc: "Для подготовки к сессиям и зачетам",
                      },
                      {
                        key: "concept-summary" as const,
                        label: "Понятие — Разбор сути",
                        desc: "Углубленное понимание с деталями",
                      },
                      {
                        key: "cloze" as const,
                        label: "Текст с пропусками (Cloze)",
                        desc: "Вставить пропущенное слово/формулу",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setStyle(opt.key)}
                        className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                          style === opt.key
                            ? "border-primary bg-primary/10 ring-1 ring-primary/40 font-semibold"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="font-semibold mb-0.5">{opt.label}</div>
                        <div className="text-[10px] text-muted-foreground leading-tight">
                          {opt.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Number of Cards Chips */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                    Количество карточек: {cardCount} шт.
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[5, 10, 15, 20, 25, 30].map((num) => (
                      <Button
                        key={num}
                        type="button"
                        variant={cardCount === num ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCardCount(num)}
                        className="h-8 text-xs font-mono"
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Difficulty & Language */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Сложность
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as "beginner" | "intermediate" | "advanced")}
                      className="w-full h-9 px-3 rounded-md border bg-background text-xs"
                    >
                      <option value="beginner">Базовый (для начинающих)</option>
                      <option value="intermediate">Средний (стандартный)</option>
                      <option value="advanced">Продвинутый (с формулами и нюансами)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Язык
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as "auto" | "ru" | "en")}
                      className="w-full h-9 px-3 rounded-md border bg-background text-xs"
                    >
                      <option value="auto">Авто (определить по тексту)</option>
                      <option value="ru">Русский</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Launch Button */}
            <Button
              size="lg"
              disabled={isLoading || sourceText.trim().length < 20}
              onClick={handleGenerate}
              className="w-full text-base font-semibold shadow-md gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Генерация карточек...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>Сгенерировать {cardCount} карточек</span>
                </>
              )}
            </Button>

            {/* Animated Loading Status */}
            {isLoading && (
              <div className="p-4 rounded-xl border bg-muted/30 text-center space-y-2 animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                <div className="text-sm font-semibold text-foreground">
                  {loadingMessages[loadingStep]}
                </div>
                <p className="text-xs text-muted-foreground">
                  Это занимает обычно от 3 до 8 секунд
                </p>
              </div>
            )}
          </div>
        ) : (
          /* STAGE 2: PREVIEW & EDIT CARDS BEFORE SAVING */
          <div className="space-y-6">
            {/* Header / Summary Bar */}
            <Card className="shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block">
                      Название колоды:
                    </label>
                    <Input
                      value={deckTitle}
                      onChange={(e) => setDeckTitle(e.target.value)}
                      className="font-bold text-base mt-1"
                      placeholder="Название колоды..."
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {previewCards.filter((c) => c.isSelected).length} из {previewCards.length} выбрано
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Вернуться к исходному тексту? Несохраненные изменения карточек будут потеряны.")) {
                          setPreviewCards([]);
                        }
                      }}
                      className="text-xs gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Заново
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block">
                    Краткое описание:
                  </label>
                  <Input
                    value={deckDescription}
                    onChange={(e) => setDeckDescription(e.target.value)}
                    className="text-xs text-muted-foreground mt-1"
                    placeholder="Краткое описание колоды..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Cards List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Сгенерированные карточки
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddNewCard}
                  className="text-xs gap-1 h-7"
                >
                  <Plus className="w-3 h-3" />
                  Добавить карточку
                </Button>
              </div>

              {previewCards.map((card, idx) => {
                const isRendered = !!isRenderMode[card.id];

                return (
                  <div
                    key={card.id}
                    className={`border rounded-xl p-4 bg-card transition-all ${
                      card.isSelected
                        ? "border-border shadow-sm"
                        : "border-border/40 opacity-60 bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={card.isSelected}
                          onChange={() => handleToggleSelectCard(card.id)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                        />
                        <span className="text-xs font-mono font-bold text-muted-foreground">
                          #{idx + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setIsRenderMode((prev) => ({
                              ...prev,
                              [card.id]: !prev[card.id],
                            }))
                          }
                          className="h-7 text-[11px] px-2 gap-1 text-muted-foreground"
                          title="Переключить предпросмотр формул"
                        >
                          {isRendered ? (
                            <>
                              <Edit3 className="w-3 h-3" />
                              Редактировать
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              Формулы
                            </>
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCard(card.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {isRendered ? (
                      /* Formatted LaTeX / Markdown View */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="p-3 rounded-lg bg-muted/40 border text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">
                              {hasCloze(card.term) ? "Лицевая сторона (Вопрос с пропуском):" : "Термин / Вопрос:"}
                            </span>
                            {hasCloze(card.term) && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60">
                                Cloze
                              </Badge>
                            )}
                          </div>
                          <MarkdownMath content={hasCloze(card.term) ? renderClozeQuestion(card.term) : (card.term || "—")} />
                        </div>
                        <div className="p-3 rounded-lg bg-muted/40 border text-sm">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                            {hasCloze(card.term) ? "Обратная сторона (Ответ):" : "Определение / Ответ:"}
                          </span>
                          <MarkdownMath content={hasCloze(card.term) ? `${renderClozeAnswer(card.term)}${card.definition ? `\n\n_${card.definition}_` : ""}` : (card.definition || "—")} />
                        </div>
                      </div>
                    ) : (
                      /* Editable Text inputs */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                            Термин / Вопрос:
                          </label>
                          <Textarea
                            value={card.term}
                            onChange={(e) =>
                              handleUpdateCard(card.id, "term", e.target.value)
                            }
                            rows={2}
                            className="text-xs resize-y"
                            placeholder="Термин..."
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                            Определение / Ответ:
                          </label>
                          <Textarea
                            value={card.definition}
                            onChange={(e) =>
                              handleUpdateCard(card.id, "definition", e.target.value)
                            }
                            rows={2}
                            className="text-xs resize-y"
                            placeholder="Определение..."
                          />
                        </div>
                      </div>
                    )}

                    {/* Hint input */}
                    <div className="mt-2">
                      <Input
                        value={card.hint}
                        onChange={(e) =>
                          handleUpdateCard(card.id, "hint", e.target.value)
                        }
                        placeholder="Подсказка / Мнемоника (необязательно)..."
                        className="text-xs h-8 text-muted-foreground"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Final Actions */}
            <div className="sticky bottom-4 z-10 p-3 bg-background/95 backdrop-blur border rounded-2xl shadow-xl flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setPreviewCards([])}
              >
                Отмена
              </Button>

              <Button
                size="lg"
                onClick={handleSaveToDatabase}
                className="flex-1 max-w-sm font-semibold gap-2 shadow"
              >
                <Check className="w-5 h-5 text-emerald-400" />
                <span>
                  Сохранить колоду ({previewCards.filter((c) => c.isSelected).length} карт.)
                </span>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
